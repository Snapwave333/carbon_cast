import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    computed,
    inject,
    signal,
    viewChild,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import {
    DocumentPictureInPictureService,
    PlaybackBarService,
} from '@iptvnator/portal/shared/util';
import { RadioPlayerStore } from '@iptvnator/portal/radio/data-access';
import { RadioPlayerComponent } from '@iptvnator/portal/radio/feature';

/**
 * The workspace playback bar.
 *
 * It is rendered by the shell rather than by any one page, so audio keeps
 * playing while the user moves around the app. The bar owns its own chrome —
 * size cycling and pop-out — and hosts whichever player currently has media.
 */
@Component({
    selector: 'app-workspace-playback-bar',
    templateUrl: './workspace-playback-bar.component.html',
    styleUrl: './workspace-playback-bar.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        MatButtonModule,
        MatIcon,
        MatTooltip,
        RadioPlayerComponent,
        TranslatePipe,
    ],
})
export class WorkspacePlaybackBarComponent {
    private readonly bar = inject(PlaybackBarService);
    private readonly pip = inject(DocumentPictureInPictureService);
    private readonly radio = inject(RadioPlayerStore);

    /** Moved wholesale into the PiP window, then moved back on close. */
    private readonly content =
        viewChild.required<ElementRef<HTMLElement>>('content');
    private readonly slot = viewChild.required<ElementRef<HTMLElement>>('slot');

    readonly size = this.bar.size;
    readonly height = this.bar.height;
    readonly isPoppedOut = this.bar.isPoppedOut;
    readonly canPopOut = this.pip.isSupported;

    readonly radioTrack = this.radio.current;
    readonly hasMedia = computed(() => this.radioTrack() !== null);

    // The button cycles, so it is labelled with what the next press does
    // rather than with the size the bar is already at.
    readonly sizeIcon = computed(() => {
        switch (this.size()) {
            case 'compact':
                return 'unfold_more';
            case 'medium':
                return 'expand_less';
            default:
                return 'unfold_less';
        }
    });
    readonly sizeLabel = computed(() => {
        switch (this.size()) {
            case 'compact':
                return 'PLAYBACK_BAR.EXPAND';
            case 'medium':
                return 'PLAYBACK_BAR.MAXIMIZE';
            default:
                return 'PLAYBACK_BAR.COLLAPSE';
        }
    });

    readonly popOutFailed = signal(false);

    constructor() {
        // The bar is destroyed as soon as playback stops. Without this the
        // floating window would survive its own content being torn out of it
        // and linger as an empty always-on-top window.
        inject(DestroyRef).onDestroy(() => this.pip.close());
    }

    cycleSize(): void {
        this.bar.cycleSize();
    }

    async togglePopOut(): Promise<void> {
        if (this.pip.isOpen) {
            this.pip.close();
            // Clear a previous failure so its alert cannot outlive the
            // pop-out it referred to.
            this.popOutFailed.set(false);
            return;
        }

        const opened = await this.pip.open({
            content: this.content().nativeElement,
            placeholder: this.slot().nativeElement,
            width: 460,
            height: 280,
            onClose: () => this.bar.setPoppedOut(false),
        });

        this.bar.setPoppedOut(opened);
        this.popOutFailed.set(!opened);
    }
}
