import { Component, computed, inject, input } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatTooltip } from '@angular/material/tooltip';
import { FollowedSeriesService } from '@iptvnator/epg/data-access';
import {
    EpgProgram,
    FollowedSeriesSource,
    FollowSeriesRequest,
} from '@iptvnator/shared/interfaces';

@Component({
    selector: 'app-follow-series-button',
    imports: [MatIcon, MatTooltip],
    templateUrl: './follow-series-button.component.html',
    styleUrl: './follow-series-button.component.scss',
})
export class FollowSeriesButtonComponent {
    private readonly followedSeries = inject(FollowedSeriesService);

    readonly source = input.required<FollowedSeriesSource>();
    readonly seriesTitle = input.required<string>();
    readonly seriesId = input<string | number | null>(null);
    readonly sourcePlaylistId = input<string | null>(null);
    readonly artworkUrl = input<string | null>(null);
    readonly aliases = input<string[]>([]);
    readonly epgProgram = input<EpgProgram | null>(null);
    readonly compact = input(false);

    readonly request = computed<FollowSeriesRequest>(() => ({
        source: this.source(),
        sourceSeriesId: this.seriesId(),
        sourcePlaylistId: this.sourcePlaylistId(),
        title: this.seriesTitle(),
        artworkUrl: this.artworkUrl(),
        aliases: this.aliases(),
        epgProgram: this.epgProgram(),
    }));
    readonly followed = computed(() =>
        this.followedSeries.findFollowed(this.request())
    );

    toggle(): void {
        const followed = this.followed();
        if (followed) {
            this.followedSeries.unfollow(followed.id);
        } else {
            this.followedSeries.follow(this.request());
        }
    }
}
