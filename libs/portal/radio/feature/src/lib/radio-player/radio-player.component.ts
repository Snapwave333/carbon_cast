import {
    ChangeDetectionStrategy,
    Component,
    DestroyRef,
    ElementRef,
    computed,
    effect,
    inject,
    signal,
    untracked,
    viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import {
    RadioLibraryStore,
    RadioPlayerStore,
} from '@iptvnator/portal/radio/data-access';
import { RadioVisualizerComponent } from '../radio-visualizer/radio-visualizer.component';
import { formatPlaybackTime } from './radio-duration.util';

/** How often a podcast resume point is written while playing. */
const PROGRESS_SAVE_INTERVAL_MS = 10_000;
const SKIP_BACK_SECONDS = 10;
const SKIP_FORWARD_SECONDS = 30;
/** Shared with the m3u audio player so one volume applies to all audio. */
const VOLUME_STORAGE_KEY = 'volume';

@Component({
    selector: 'app-radio-player',
    templateUrl: './radio-player.component.html',
    styleUrl: './radio-player.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        FormsModule,
        MatButtonModule,
        MatIcon,
        MatSliderModule,
        MatTooltip,
        RadioVisualizerComponent,
        TranslatePipe,
    ],
})
export class RadioPlayerComponent {
    private readonly player = inject(RadioPlayerStore);
    private readonly library = inject(RadioLibraryStore);
    private readonly destroyRef = inject(DestroyRef);

    private readonly audioRef =
        viewChild.required<ElementRef<HTMLAudioElement>>('audio');

    readonly track = this.player.current;
    readonly status = this.player.status;
    readonly errorMessage = this.player.errorMessage;
    readonly hasNext = this.player.hasNext;
    readonly hasPrevious = this.player.hasPrevious;

    readonly volume = signal(readStoredVolume());
    readonly isMuted = signal(false);
    readonly position = signal(0);
    readonly duration = signal<number | null>(null);
    readonly artworkFailed = signal(false);

    readonly isPlaying = computed(() => this.status() === 'playing');
    readonly isBuffering = computed(() => this.status() === 'loading');
    readonly isLive = computed(() => this.track()?.kind === 'station');
    readonly isSeekable = computed(() => {
        const duration = this.duration();
        return (
            !this.isLive() && duration !== null && Number.isFinite(duration) && duration > 0
        );
    });
    readonly positionLabel = computed(() => formatPlaybackTime(this.position()));
    readonly durationLabel = computed(() => formatPlaybackTime(this.duration()));
    readonly progressPercent = computed(() => {
        const duration = this.duration();
        if (!this.isSeekable() || duration === null) {
            return 0;
        }
        return Math.min(100, (this.position() / duration) * 100);
    });
    readonly volumeIcon = computed(() => {
        const level = this.volume();
        if (this.isMuted() || level === 0) {
            return 'volume_off';
        }
        return level < 0.5 ? 'volume_down' : 'volume_up';
    });
    readonly artwork = computed(() =>
        this.artworkFailed() ? '' : (this.track()?.artwork ?? '')
    );

    /** Guards against writing a resume point before the seek to it lands. */
    private pendingResumeSeek: number | null = null;
    private progressTimer: ReturnType<typeof setInterval> | null = null;
    private volumeBeforeMute = 1;

    constructor() {
        effect(() => {
            const track = this.track();
            const audio = this.audioRef().nativeElement;

            untracked(() => {
                this.artworkFailed.set(false);
                this.position.set(0);
                this.duration.set(track?.durationSeconds ?? null);
                this.pendingResumeSeek =
                    track?.kind === 'episode'
                        ? (this.library.episodeProgress(track.id)
                              ?.positionSeconds ?? null)
                        : null;

                if (!track) {
                    audio.pause();
                    audio.removeAttribute('src');
                    audio.load();
                    return;
                }

                audio.src = track.streamUrl;
                audio.volume = this.isMuted() ? 0 : this.volume();
                audio.load();
                void audio.play().catch(() => {
                    // Autoplay can be refused before the first user gesture;
                    // the transport button then starts it.
                    this.player.status.set('paused');
                });
            });
        });

        this.destroyRef.onDestroy(() => {
            this.stopProgressTimer();
            this.saveProgress();
            this.audioRef().nativeElement.pause();
        });
    }

    togglePlay(): void {
        const audio = this.audioRef().nativeElement;
        if (this.isPlaying()) {
            audio.pause();
            return;
        }

        void audio.play().catch((error: unknown) => {
            this.player.reportError(toErrorMessage(error));
        });
    }

    stop(): void {
        this.saveProgress();
        this.player.stop();
    }

    next(): void {
        this.saveProgress();
        this.player.next();
    }

    previous(): void {
        this.saveProgress();
        this.player.previous();
    }

    skip(seconds: number): void {
        if (!this.isSeekable()) {
            return;
        }

        const audio = this.audioRef().nativeElement;
        const duration = this.duration() ?? audio.duration;
        audio.currentTime = Math.max(
            0,
            Math.min(duration, audio.currentTime + seconds)
        );
    }

    skipBack(): void {
        this.skip(-SKIP_BACK_SECONDS);
    }

    skipForward(): void {
        this.skip(SKIP_FORWARD_SECONDS);
    }

    seekTo(seconds: number): void {
        if (!this.isSeekable()) {
            return;
        }
        this.audioRef().nativeElement.currentTime = seconds;
        this.position.set(seconds);
    }

    setVolume(value: number): void {
        const level = Math.round(Math.max(0, Math.min(1, value)) * 100) / 100;
        this.volume.set(level);
        this.isMuted.set(level === 0);
        this.audioRef().nativeElement.volume = level;

        try {
            localStorage.setItem(VOLUME_STORAGE_KEY, String(level));
        } catch {
            // Volume falls back to the session default on the next boot.
        }
    }

    toggleMute(): void {
        if (this.isMuted() || this.volume() === 0) {
            this.setVolume(this.volumeBeforeMute || 1);
            return;
        }

        this.volumeBeforeMute = this.volume();
        this.setVolume(0);
    }

    onPlaying(): void {
        this.player.status.set('playing');
        this.player.errorMessage.set(null);
        this.startProgressTimer();
    }

    onPause(): void {
        if (this.status() !== 'error') {
            this.player.status.set('paused');
        }
        this.stopProgressTimer();
        this.saveProgress();
    }

    onWaiting(): void {
        if (this.status() !== 'error') {
            this.player.status.set('loading');
        }
    }

    onTimeUpdate(): void {
        this.position.set(this.audioRef().nativeElement.currentTime);
    }

    onLoadedMetadata(): void {
        const audio = this.audioRef().nativeElement;
        if (Number.isFinite(audio.duration) && audio.duration > 0) {
            this.duration.set(audio.duration);
        }

        const resumeAt = this.pendingResumeSeek;
        this.pendingResumeSeek = null;
        if (resumeAt !== null && resumeAt < audio.duration) {
            audio.currentTime = resumeAt;
            this.position.set(resumeAt);
        }
    }

    onEnded(): void {
        this.stopProgressTimer();
        const track = this.track();
        if (track?.kind === 'episode') {
            // Finished episodes must not keep a resume point.
            this.library.saveEpisodeProgress(
                track.id,
                this.duration() ?? 0,
                this.duration()
            );
        }

        if (this.hasNext()) {
            this.player.next();
        } else {
            this.player.status.set('paused');
        }
    }

    onError(): void {
        this.stopProgressTimer();
        this.player.reportError(
            describeMediaError(this.audioRef().nativeElement.error)
        );
    }

    retry(): void {
        const track = this.track();
        if (!track) {
            return;
        }

        const audio = this.audioRef().nativeElement;
        this.player.status.set('loading');
        this.player.errorMessage.set(null);
        audio.load();
        void audio.play().catch((error: unknown) => {
            this.player.reportError(toErrorMessage(error));
        });
    }

    private startProgressTimer(): void {
        if (this.progressTimer !== null || this.track()?.kind !== 'episode') {
            return;
        }
        this.progressTimer = setInterval(
            () => this.saveProgress(),
            PROGRESS_SAVE_INTERVAL_MS
        );
    }

    private stopProgressTimer(): void {
        if (this.progressTimer === null) {
            return;
        }
        clearInterval(this.progressTimer);
        this.progressTimer = null;
    }

    private saveProgress(): void {
        const track = this.track();
        if (track?.kind !== 'episode' || this.pendingResumeSeek !== null) {
            return;
        }

        this.library.saveEpisodeProgress(
            track.id,
            this.position(),
            this.duration()
        );
    }
}

function readStoredVolume(): number {
    const stored = Number.parseFloat(
        localStorage.getItem(VOLUME_STORAGE_KEY) ?? '1'
    );
    return Number.isFinite(stored) ? Math.max(0, Math.min(1, stored)) : 1;
}

function toErrorMessage(error: unknown): string {
    return error instanceof Error ? error.message : String(error);
}

function describeMediaError(error: MediaError | null): string {
    switch (error?.code) {
        case MediaError.MEDIA_ERR_ABORTED:
            return 'Playback was aborted';
        case MediaError.MEDIA_ERR_NETWORK:
            return 'The stream could not be reached';
        case MediaError.MEDIA_ERR_DECODE:
            return 'The stream could not be decoded';
        case MediaError.MEDIA_ERR_SRC_NOT_SUPPORTED:
            return 'This stream format is not supported';
        default:
            return 'The stream could not be played';
    }
}
