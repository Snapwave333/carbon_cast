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
import { RadioStation } from '@iptvnator/portal/radio/data-access';

@Component({
    selector: 'app-radio-station-grid',
    template: `
        <ul class="station-grid" role="list">
            @for (station of stations(); track station.id) {
                <li
                    class="station-card"
                    [class.is-current]="station.id === currentStationId()"
                >
                    <button
                        type="button"
                        class="station-card__main"
                        [attr.aria-label]="
                            'RADIO.PLAY_STATION' | translate: { name: station.name }
                        "
                        (click)="played.emit(station)"
                    >
                        <span class="station-card__logo">
                            @if (station.favicon && !isBroken(station.id)) {
                                <img
                                    [src]="station.favicon"
                                    alt=""
                                    loading="lazy"
                                    (error)="markBroken(station.id)"
                                />
                            } @else {
                                <mat-icon svgIcon="radio"></mat-icon>
                            }
                            <span class="station-card__play">
                                <mat-icon
                                    [svgIcon]="
                                        station.id === currentStationId()
                                            ? 'graphic_eq'
                                            : 'play_arrow'
                                    "
                                ></mat-icon>
                            </span>
                        </span>

                        <span class="station-card__name" [title]="station.name">
                            {{ station.name }}
                        </span>
                        <span
                            class="station-card__meta"
                            [title]="describe(station)"
                        >
                            {{ describe(station) }}
                        </span>
                    </button>

                    <div class="station-card__tags">
                        @for (tag of station.tags.slice(0, 3); track tag) {
                            <span class="station-card__tag">{{ tag }}</span>
                        }
                        @if (station.bitrate > 0) {
                            <span class="station-card__tag station-card__tag--tech">
                                {{ station.bitrate }} kbps
                            </span>
                        }
                    </div>

                    <button
                        mat-icon-button
                        class="station-card__favorite"
                        [class.is-active]="isFavorite()(station.id)"
                        [matTooltip]="
                            (isFavorite()(station.id)
                                ? 'RADIO.REMOVE_FAVORITE'
                                : 'RADIO.ADD_FAVORITE'
                            ) | translate
                        "
                        [attr.aria-label]="
                            (isFavorite()(station.id)
                                ? 'RADIO.REMOVE_FAVORITE'
                                : 'RADIO.ADD_FAVORITE'
                            ) | translate
                        "
                        [attr.aria-pressed]="isFavorite()(station.id)"
                        (click)="favoriteToggled.emit(station)"
                    >
                        <mat-icon svgIcon="favorite"></mat-icon>
                    </button>
                </li>
            }
        </ul>
    `,
    styleUrl: './radio-station-grid.component.scss',
    changeDetection: ChangeDetectionStrategy.OnPush,
    imports: [MatButtonModule, MatIcon, MatTooltip, TranslatePipe],
})
export class RadioStationGridComponent {
    readonly stations = input.required<readonly RadioStation[]>();
    readonly currentStationId = input<string | null>(null);
    readonly isFavorite = input.required<(stationId: string) => boolean>();

    readonly played = output<RadioStation>();
    readonly favoriteToggled = output<RadioStation>();

    /** Station logos are third-party URLs and rot constantly. */
    private readonly brokenLogos = signal<ReadonlySet<string>>(new Set());

    isBroken(stationId: string): boolean {
        return this.brokenLogos().has(stationId);
    }

    markBroken(stationId: string): void {
        this.brokenLogos.update((broken) => new Set(broken).add(stationId));
    }

    describe(station: RadioStation): string {
        return [station.country, station.languages[0], station.codec]
            .filter(Boolean)
            .join(' · ');
    }
}
