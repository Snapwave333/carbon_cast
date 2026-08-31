import {
    ChangeDetectionStrategy,
    Component,
    ElementRef,
    OnDestroy,
    computed,
    inject,
    input,
    output,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { registerControlsEffects } from './controls-effects';
import { ControlsFeedback } from './controls-feedback';
import { ControlsFullscreen } from './controls-fullscreen';
import { ControlsMenuSelection } from './controls-menu-selection';
import { ControlsMenuState } from './controls-menu-state';
import { ControlsShortcuts } from './controls-shortcuts';
import { ControlsSurface } from './controls-surface';
import { ControlsTimeline } from './controls-timeline';
import { ControlsVisibility } from './controls-visibility';
import { createControlsViewModel } from './controls-view-model';
import { ControlsVolume } from './controls-volume';
import { PLAYER_CONTROLS_SETTINGS } from './web-player-controls.flag';
import { formatTime, speedLabel } from './controls-format.utils';
import { AUTO_QUALITY_ID } from './player-quality.util';
import type {
    PlayerController,
    PlayerMediaTitle,
    PlayerTrack,
} from './player-controls.model';

@Component({
    selector: 'app-player-controls',
    templateUrl: './player-controls.component.html',
    styleUrl: './player-controls.component.scss',
    imports: [MatButtonModule, MatIconModule, MatTooltipModule, TranslatePipe],
    changeDetection: ChangeDetectionStrategy.OnPush,
    host: {
        class: 'player-controls-host',
        '[class.player-controls-host--cursor-hidden]': 'hideCursor()',
        '[class.player-controls-host--compact]':
            'preferences.density === "compact"',
        '[class.player-controls-host--solid]':
            'preferences.opacity === "solid"',
        '[class.player-controls-host--small]': 'preferences.size === "small"',
        '[class.player-controls-host--large]': 'preferences.size === "large"',
    },
})
export class PlayerControlsComponent implements OnDestroy {
    private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
    private readonly translate = inject(TranslateService);
    readonly preferences = inject(PLAYER_CONTROLS_SETTINGS);
    readonly controller = input.required<PlayerController>();
    readonly playerSurface = input<HTMLElement | null>(null);
    readonly showControls = input(true);
    readonly shortcutsEnabled = input(true);
    readonly mediaTitle = input<PlayerMediaTitle | null>(null);
    readonly previousEpisodeRequested = output<void>();
    readonly nextEpisodeRequested = output<void>();
    /** Host-driven, like the episode actions above: channel flipping is a
     * playlist concern that no engine could implement. */
    readonly channelNavigation = input(false);
    readonly channelUpRequested = output<void>();
    readonly channelDownRequested = output<void>();
    readonly barHovered = signal(false);
    private readonly barFocused = signal(false);
    readonly menus = new ControlsMenuState();
    readonly feedback = new ControlsFeedback();
    readonly anyMenuOpen = this.menus.anyOpen;
    private readonly shortcuts = new ControlsShortcuts();
    private readonly visibility = new ControlsVisibility(
        () => this.canHide(),
        this.preferences.autoHideDelayMs
    );
    private readonly fullscreen = new ControlsFullscreen(
        () => this.playerSurface(),
        () => this.reveal()
    );
    private readonly volume = new ControlsVolume({
        apply: (value) => this.controller().commands.setVolume(value),
        flash: (icon, label) => this.feedback.flash(icon, label),
        mutedLabel: () => this.translate.instant('EMBEDDED_MPV.PLAYER.MUTED'),
        openPopover: () => this.menus.open('volume'),
        closePopover: () => this.menus.close('volume'),
    });
    private readonly surface = new ControlsSurface(
        {
            reveal: () => this.reveal(),
            toggleFullscreen: () => void this.toggleFullscreen(),
            closePopovers: () => this.closePopovers(),
            togglePlay: () => this.togglePlay(),
            canTogglePlay: () => this.canTogglePlay(),
            isMenuOpen: () => this.menus.anyOpen(),
        },
        this.host
    );
    readonly menuSelection = new ControlsMenuSelection({
        commands: () => this.controller().commands,
        menus: this.menus,
        visibility: this.visibility,
        revealSticky: () => this.reveal({ scheduleHide: false }),
    });

    readonly state = computed(() => this.controller().state());
    readonly capabilities = computed(() => this.controller().capabilities());
    private readonly controllerVolume = computed(() => this.state().volume);
    private readonly timeline = new ControlsTimeline(this.state);
    readonly scrubPosition = this.timeline.scrubPosition;
    readonly timelineDuration = this.timeline.duration;
    readonly timelineValue = this.timeline.value;
    readonly timelineProgress = this.timeline.progress;

    readonly displayVolume = this.volume.value;
    readonly isFullscreen = this.fullscreen.isFullscreen;
    readonly resolvedShowControls = computed(
        () => this.showControls() && this.preferences.visible
    );

    // The page around the player already names the content; the overlay only
    // fills that gap in fullscreen, where no other chrome is visible.
    readonly fullscreenMediaTitle = computed<PlayerMediaTitle | null>(() => {
        if (!this.resolvedShowControls() || !this.isFullscreen()) {
            return null;
        }
        const mediaTitle = this.mediaTitle();
        return mediaTitle?.primary?.trim() ? mediaTitle : null;
    });

    private readonly vm = createControlsViewModel({
        state: this.state,
        capabilities: this.capabilities,
        volume: this.volume.value,
        isFullscreen: this.isFullscreen,
        canFullscreenNative: () => this.fullscreen.canFullscreen(),
        showControls: this.resolvedShowControls,
        autoHideVisible: this.visibility.visible,
        anyMenuOpen: this.menus.anyOpen,
    });

    readonly isLoading = this.vm.isLoading;
    readonly isBuffering = this.vm.isBuffering;
    readonly isPaused = this.vm.isPaused;
    readonly isPlaying = this.vm.isPlaying;
    readonly canTogglePlay = this.vm.canTogglePlay;
    readonly hasAudioTracks = this.vm.hasAudioTracks;
    readonly hasSubtitleTracks = this.vm.hasSubtitleTracks;
    readonly hasQualityLevels = this.vm.hasQualityLevels;
    /**
     * The adaptive entry carries only the rendition it settled on; the word
     * "Auto" is added here so the engine layer stays free of translation.
     */
    readonly selectedQualityLabel = computed(() => {
        const selected = this.state().qualityLevels.find(
            (level) => level.selected
        );
        return selected ? this.qualityLabel(selected) : '';
    });
    readonly canRecord = this.vm.canRecord;
    readonly isRecording = this.vm.isRecording;
    readonly recordingStatusText = this.vm.recordingStatusText;
    readonly volumeIcon = this.vm.volumeIcon;
    readonly canFullscreen = this.vm.canFullscreen;
    readonly volumePercent = computed(() =>
        Math.round(this.displayVolume() * 100)
    );
    readonly controlsAreVisible = this.vm.controlsAreVisible;
    readonly hideCursor = this.vm.hideCursor;
    constructor() {
        this.shortcuts.attach({
            isAvailable: () =>
                this.shortcutsEnabled() && this.resolvedShowControls(),
            canTogglePaused: () => this.canTogglePlay(),
            canSeek: () => this.capabilities().seek && this.state().canSeek,
            canAdjustVolume: () => this.capabilities().volume,
            canToggleFullscreen: () => this.canFullscreen(),
            onEscape: () => this.closePopovers(),
            togglePaused: () => this.togglePlay(),
            toggleFullscreen: () => void this.toggleFullscreen(),
            seekBy: (delta) => this.seekBy(delta),
            seekToFraction: (fraction) => this.seekToFraction(fraction),
            adjustVolume: (delta) => this.adjustVolume(delta),
            toggleMute: () => this.toggleMute(),
        });
        registerControlsEffects({
            controller: this.controller,
            state: this.state,
            capabilities: this.capabilities,
            controllerVolume: this.controllerVolume,
            playerSurface: this.playerSurface,
            showControls: this.resolvedShowControls,
            hideCursor: this.hideCursor,
            scrubPosition: this.scrubPosition,
            surface: this.surface,
            fullscreen: this.fullscreen,
            volume: this.volume,
            menus: this.menus,
            visibility: this.visibility,
            feedback: this.feedback,
            recordingLabels: () => ({
                active: this.translate.instant('EMBEDDED_MPV.PLAYER.RECORDING'),
                inactive: this.translate.instant(
                    'EMBEDDED_MPV.PLAYER.RECORDING_SAVED'
                ),
            }),
        });
    }
    ngOnDestroy(): void {
        this.shortcuts.detach();
        this.feedback.dispose();
        this.visibility.dispose();
        this.fullscreen.dispose();
        this.volume.dispose();
        this.surface.dispose();
    }
    formatTime = formatTime;
    speedLabel = speedLabel;
    qualityLabel(level: PlayerTrack): string {
        if (level.id !== AUTO_QUALITY_ID) {
            return level.label;
        }
        const auto = this.translate.instant('EMBEDDED_MPV.PLAYER.QUALITY_AUTO');
        return level.label ? `${auto} (${level.label})` : auto;
    }
    togglePlay(): void {
        this.reveal();
        if (!this.canTogglePlay()) {
            return;
        }
        this.controller().commands.togglePlay();
    }
    seekBy(deltaSeconds: number): void {
        this.reveal();
        if (!this.capabilities().seek || !this.state().canSeek) {
            return;
        }
        this.controller().commands.seekBy(deltaSeconds);
        this.feedback.flash(
            deltaSeconds >= 0 ? 'forward_10' : 'replay_10',
            `${deltaSeconds >= 0 ? '+' : ''}${Math.round(deltaSeconds)}s`
        );
    }
    seekToFraction(fraction: number): void {
        this.reveal();
        if (!this.capabilities().seek || !this.state().canSeek) {
            return;
        }
        const duration = this.timelineDuration();
        if (duration <= 0) {
            return;
        }
        const target = Math.max(0, Math.min(1, fraction)) * duration;
        this.controller().commands.seekTo(target);
        this.feedback.flash(
            target >= this.state().positionSeconds ? 'forward_10' : 'replay_10',
            formatTime(target)
        );
    }

    onTimelineInput(event: Event): void {
        this.reveal();
        this.scrubPosition.set(this.timeline.readEventValue(event));
    }
    onTimelineCommit(event: Event): void {
        this.reveal();
        const target = this.timeline.readEventValue(event);
        this.scrubPosition.set(null);
        if (
            target === null ||
            !this.capabilities().seek ||
            !this.state().canSeek
        ) {
            return;
        }
        this.controller().commands.seekTo(target);
    }
    requestPreviousEpisode(): void {
        this.reveal();
        if (!this.state().canPreviousEpisode) {
            return;
        }
        this.previousEpisodeRequested.emit();
    }
    requestNextEpisode(): void {
        this.reveal();
        if (!this.state().canNextEpisode) {
            return;
        }
        this.nextEpisodeRequested.emit();
    }
    requestChannel(direction: 'up' | 'down'): void {
        this.reveal();
        const out =
            direction === 'up'
                ? this.channelUpRequested
                : this.channelDownRequested;
        out.emit();
    }
    onVolumeInput(event: Event): void {
        this.volume.set(Number((event.target as HTMLInputElement).value));
        this.reveal({ scheduleHide: false });
    }
    onVolumeWheel(event: WheelEvent): void {
        event.preventDefault();
        this.adjustVolume(event.deltaY > 0 ? -0.05 : 0.05);
    }
    onVolumeHoverEnter(): void {
        this.volume.hoverEnter();
    }
    onVolumeHoverLeave(): void {
        this.volume.hoverLeave();
    }

    toggleMute(): void {
        if (!this.capabilities().volume) {
            return;
        }
        this.volume.toggleMute();
        this.reveal();
    }

    toggleMenu(
        menu: 'audio' | 'subtitle' | 'quality' | 'speed' | 'aspect'
    ): void {
        this.menus.toggle(menu);
        this.reveal();
    }
    toggleRecording(): void {
        if (!this.canRecord()) {
            return;
        }
        this.reveal({ scheduleHide: false });
        this.controller().commands.toggleRecording();
    }

    togglePictureInPicture(): void {
        this.reveal();
        const state = this.state();
        if (this.capabilities().pictureInPicture && state.canPictureInPicture) {
            this.controller().commands.togglePictureInPicture();
        }
    }
    async toggleFullscreen(): Promise<void> {
        this.reveal();
        if (!this.canFullscreen()) {
            return;
        }
        await this.fullscreen.toggle();
    }
    private adjustVolume(delta: number): void {
        if (!this.capabilities().volume) {
            return;
        }
        this.volume.adjust(delta);
        this.reveal();
    }
    private closePopovers(): void {
        if (!this.menus.anyOpen()) {
            return;
        }
        this.menus.closeAll();
        this.visibility.scheduleHide();
    }

    reveal(options: { scheduleHide?: boolean } = {}): void {
        this.shortcuts.activate();
        this.visibility.reveal(options);
    }

    onBarPointerEnter(): void {
        this.barHovered.set(true);
        this.reveal({ scheduleHide: false });
    }

    onBarPointerLeave(): void {
        this.barHovered.set(false);
        this.visibility.scheduleHide();
    }

    onBarFocusIn(): void {
        this.barFocused.set(true);
        this.reveal({ scheduleHide: false });
    }

    onBarFocusOut(event: FocusEvent): void {
        const bar = event.currentTarget as HTMLElement | null;
        const next = event.relatedTarget;
        if (bar && next instanceof Node && bar.contains(next)) {
            return;
        }
        this.barFocused.set(false);
        this.visibility.scheduleHide();
    }

    private canHide(): boolean {
        return (
            this.isPlaying() &&
            !this.barHovered() &&
            !this.barFocused() &&
            !this.menus.anyOpen() &&
            !this.state().statusMessage
        );
    }
}
