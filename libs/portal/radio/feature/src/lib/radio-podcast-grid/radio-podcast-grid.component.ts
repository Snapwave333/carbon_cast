import {
    ChangeDetectionStrategy,
    Component,
    input,
    output,
    signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import { PodcastShow } from '@iptvnator/portal/radio/data-access';

@Component({
    selector: 'app-radio-podcast-grid',
    template: `
        <ul class="podcast-grid" role="list">
            @for (show of shows(); track show.id) {
                <li class="podcast-card">
                    <button
                        type="button"
                        class="podcast-card__main"
                        [attr.aria-label]="
                            'RADIO.OPEN_SHOW' | translate: { name: show.title }
                        "
                        (click)="opened.emit(show)"
                    >
                        <span class="podcast-card__artwork">
                            @if (show.artwork && !isBroken(show.id)) {
                                <img
                                    [src]="show.artwork"
                                    alt=""
                                    loading="lazy"
                                    (error)="markBroken(show.id)"
                                />
                            } @else {
                                <mat-icon svgIcon="podcasts"></mat-icon>
                            }
                        </span>
                        <span class="podcast-card__title" [title]="show.title">
                            {{ show.title }}
                        </span>
                        <span class="podcast-card__author" [title]="show.author">
                            {{ show.author }}
                        </span>
                    </button>

                    <button
                        mat-icon-button
                        class="podcast-card__subscribe"
                        [class.is-active]="isSubscribed()(show.id)"
                        [matTooltip]="
                            (isSubscribed()(show.id)
                                ? 'RADIO.UNSUBSCRIBE'
                                : 'RADIO.SUBSCRIBE'
                            ) | translate
                        "
                        [attr.aria-label]="
                            (isSubscribed()(show.id)
                                ? 'RADIO.UNSUBSCRIBE'
                                : 'RADIO.SUBSCRIBE'
                            ) | translate
                        "
                        [attr.aria-pressed]="isSubscribed()(show.id)"
                        (click)="subscriptionToggled.emit(show)"
                    >
                        <mat-icon
                            [svgIcon]="
                                isSubscribed()(show.id) ? 'check_circle' : 'add_circle'
                            "
                        ></mat-icon>
                    </button>
                </li>
            }
        </ul>
    `,
    styleUrl: './radio-podcast-grid.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatIcon, MatTooltip, TranslatePipe],
})
export class RadioPodcastGridComponent {
    readonly shows = input.required<readonly PodcastShow[]>();
    readonly isSubscribed = input.required<(showId: string) => boolean>();

    readonly opened = output<PodcastShow>();
    readonly subscriptionToggled = output<PodcastShow>();

    private readonly brokenArtwork = signal<ReadonlySet<string>>(new Set());

    isBroken(showId: string): boolean {
        return this.brokenArtwork().has(showId);
    }

    markBroken(showId: string): void {
        this.brokenArtwork.update((broken) => new Set(broken).add(showId));
    }
}
