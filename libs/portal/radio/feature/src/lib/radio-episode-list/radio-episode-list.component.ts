import { DatePipe } from '@angular/common';
import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { PodcastEpisode } from '@iptvnator/portal/radio/data-access';
import { formatEpisodeLength } from '../radio-player/radio-duration.util';

@Component({
    selector: 'app-radio-episode-list',
    template: `
        <ol class="episode-list" role="list">
            @for (episode of episodes(); track episode.id) {
                <li
                    class="episode"
                    [class.is-current]="episode.id === currentEpisodeId()"
                >
                    <button
                        mat-icon-button
                        class="episode__play"
                        [matTooltip]="
                            (resumePercent()(episode.id) > 0
                                ? 'RADIO.RESUME'
                                : 'RADIO.PLAY'
                            ) | translate
                        "
                        [attr.aria-label]="
                            'RADIO.PLAY_EPISODE'
                                | translate: { name: episode.title }
                        "
                        (click)="played.emit(episode)"
                    >
                        <mat-icon
                            [svgIcon]="
                                episode.id === currentEpisodeId()
                                    ? 'graphic_eq'
                                    : 'play_circle'
                            "
                        ></mat-icon>
                    </button>

                    <div class="episode__body">
                        <h4 class="episode__title">{{ episode.title }}</h4>
                        <p class="episode__meta">
                            @if (episode.publishedAt) {
                                <span>{{
                                    episode.publishedAt | date: 'mediumDate'
                                }}</span>
                            }
                            @if (length(episode); as duration) {
                                <span>{{ duration }}</span>
                            }
                        </p>
                        @if (episode.description) {
                            <p class="episode__description">
                                {{ episode.description }}
                            </p>
                        }
                        @if (resumePercent()(episode.id); as percent) {
                            <mat-progress-bar
                                class="episode__resume"
                                mode="determinate"
                                [value]="percent"
                                [attr.aria-label]="'RADIO.RESUME' | translate"
                            />
                        }
                    </div>
                </li>
            }
        </ol>
    `,
    styleUrl: './radio-episode-list.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [
        DatePipe,
        MatButtonModule,
        MatIcon,
        MatProgressBarModule,
        MatTooltip,
        TranslatePipe,
    ],
})
export class RadioEpisodeListComponent {
    readonly episodes = input.required<readonly PodcastEpisode[]>();
    readonly currentEpisodeId = input<string | null>(null);
    /** Resume position as a percentage, or 0 when the episode is unstarted. */
    readonly resumePercent = input.required<(episodeId: string) => number>();

    readonly played = output<PodcastEpisode>();

    length(episode: PodcastEpisode): string {
        return formatEpisodeLength(episode.durationSeconds);
    }
}
