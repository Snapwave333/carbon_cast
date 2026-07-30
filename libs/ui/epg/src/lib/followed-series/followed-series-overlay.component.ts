import { Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { FollowedSeriesService } from '@iptvnator/epg/data-access';
import { AutoSwitchSchedule } from '@iptvnator/shared/interfaces';

@Component({
    selector: 'app-followed-series-overlay',
    imports: [MatIcon],
    templateUrl: './followed-series-overlay.component.html',
    styleUrl: './followed-series-overlay.component.scss',
})
export class FollowedSeriesOverlayComponent implements OnDestroy {
    readonly followed = inject(FollowedSeriesService);
    private readonly now = signal(Date.now());
    private readonly timerId = setInterval(() => this.now.set(Date.now()), 250);
    readonly remainingSeconds = computed(() => {
        const countdown = this.followed.countdown();
        return countdown
            ? Math.max(
                  0,
                  Math.ceil(
                      (Date.parse(countdown.switchAt) - this.now()) / 1_000
                  )
              )
            : 0;
    });
    readonly conflictSchedules = computed(() => {
        const conflict = this.followed.pendingConflict();
        if (!conflict) return [];
        return conflict.scheduleIds
            .map((id) =>
                this.followed.schedules().find((item) => item.id === id)
            )
            .filter((item): item is AutoSwitchSchedule => Boolean(item));
    });

    choose(scheduleId: string): void {
        const conflict = this.followed.pendingConflict();
        if (conflict) this.followed.chooseConflict(conflict.id, scheduleId);
    }

    disableEpisode(scheduleId: string): void {
        const schedule = this.followed
            .schedules()
            .find((item) => item.id === scheduleId);
        if (schedule) this.followed.disableAutoSwitch(schedule.broadcastId);
    }

    summary(schedule: AutoSwitchSchedule): string {
        const state = this.followed.state();
        const series = state.followedSeries.find(
            (item) => item.id === schedule.seriesId
        );
        const episode = state.episodes.find(
            (item) => item.id === schedule.episodeId
        );
        const broadcast = state.broadcasts.find(
            (item) => item.id === schedule.broadcastId
        );
        return `${series?.title ?? 'Series'} · ${episode?.title ?? 'Episode'} · ${broadcast?.channelName ?? 'Channel'}`;
    }

    ngOnDestroy(): void {
        clearInterval(this.timerId);
    }
}
