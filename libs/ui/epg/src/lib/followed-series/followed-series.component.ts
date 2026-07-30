import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { MatIcon } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FollowedSeriesService } from '@iptvnator/epg/data-access';
import {
    AutoSwitchSchedule,
    BroadcastInstance,
    FollowedEpisode,
    FollowedSeriesNotificationPreferences,
    FollowedSeriesPreferences,
    FollowedSeriesPreferencesPatch,
} from '@iptvnator/shared/interfaces';
import { BroadcastRemainingTimeComponent } from './broadcast-remaining-time.component';
import {
    buildFollowedSeriesView,
    FollowedBroadcastView,
} from './followed-series-view.util';
import { EpgProgrammeDialogService } from '../epg-programme-dialog.service';

@Component({
    selector: 'app-followed-series',
    imports: [
        BroadcastRemainingTimeComponent,
        DatePipe,
        MatIcon,
        MatProgressSpinnerModule,
    ],
    templateUrl: './followed-series.component.html',
    styleUrl: './followed-series.component.scss',
})
export class FollowedSeriesComponent {
    readonly followed = inject(FollowedSeriesService);
    private readonly programmeDialog = inject(EpgProgrammeDialogService);
    readonly expandedEpisodeId = signal<string | null>(null);
    readonly settingsOpen = signal(false);
    readonly notificationPermission = signal<NotificationPermission>(
        typeof Notification === 'undefined' ? 'denied' : Notification.permission
    );
    readonly view = computed(() =>
        buildFollowedSeriesView(this.followed.state())
    );
    readonly pendingConflictSchedules = computed(() => {
        const conflict = this.followed.pendingConflict();
        if (!conflict) return [];
        return conflict.scheduleIds
            .map((id) =>
                this.followed.schedules().find((item) => item.id === id)
            )
            .filter((item): item is AutoSwitchSchedule => Boolean(item));
    });

    episodeCode(episode: FollowedEpisode): string {
        if (episode.seasonNumber == null || episode.episodeNumber == null) {
            return 'Episode';
        }
        return `S${String(episode.seasonNumber).padStart(2, '0')}E${String(
            episode.episodeNumber
        ).padStart(2, '0')}`;
    }

    toggleAlternatives(episodeId: string): void {
        this.expandedEpisodeId.update((current) =>
            current === episodeId ? null : episodeId
        );
    }

    isAutoEnabled(schedule: AutoSwitchSchedule | null): boolean {
        return Boolean(schedule && !['off', 'ended'].includes(schedule.status));
    }

    autoSwitchLabel(schedule: AutoSwitchSchedule | null): string {
        const labels: Record<AutoSwitchSchedule['status'], string> = {
            off: 'Auto Switch Off',
            enabled: 'Auto Switch Enabled',
            'switching-soon': 'Switching Soon',
            'currently-playing': 'Currently Playing',
            ended: 'Episode Ended',
            'broadcast-unavailable': 'Broadcast Unavailable',
            'permission-required': 'Permission Required',
            'schedule-changed': 'Schedule Changed',
        };
        return schedule ? labels[schedule.status] : 'Auto Switch Off';
    }

    crossesDateBoundary(startAt: string, endAt: string): boolean {
        const start = new Date(startAt);
        const end = new Date(endAt);
        return (
            start.getFullYear() !== end.getFullYear() ||
            start.getMonth() !== end.getMonth() ||
            start.getDate() !== end.getDate()
        );
    }

    toggleAuto(view: FollowedBroadcastView): void {
        if (this.isAutoEnabled(view.schedule)) {
            this.followed.disableAutoSwitch(view.broadcast.id);
        } else {
            this.followed.enableAutoSwitch(view.broadcast.id);
        }
    }

    openChannel(schedule: AutoSwitchSchedule | null): void {
        if (schedule) void this.followed.switchNow(schedule.id, false);
    }

    showDetails(episode: FollowedEpisode, broadcast: BroadcastInstance): void {
        this.programmeDialog.open({
            start: broadcast.startAt,
            stop: broadcast.endAt,
            channel: broadcast.epgChannelId,
            channelName: broadcast.channelName,
            channelLogo: broadcast.channelLogo,
            title: episode.title,
            desc: episode.description,
            category: null,
            episodeNum: this.episodeCode(episode),
            programId: episode.programId,
            seriesId: broadcast.sourceSeriesId,
            episodeTitle: episode.title,
            isNew: episode.newness === 'new',
            previouslyShown: episode.newness === 'repeat',
        });
    }

    chooseConflict(scheduleId: string): void {
        const conflict = this.followed.pendingConflict();
        if (conflict) this.followed.chooseConflict(conflict.id, scheduleId);
    }

    scheduleSummary(schedule: AutoSwitchSchedule): string {
        const broadcast = this.followed
            .broadcasts()
            .find((item) => item.id === schedule.broadcastId);
        const episode = this.followed
            .episodes()
            .find((item) => item.id === schedule.episodeId);
        const series = this.followed
            .followedSeries()
            .find((item) => item.id === schedule.seriesId);
        return `${series?.title ?? 'Series'} · ${episode?.title ?? 'Episode'} · ${
            broadcast?.channelName ?? 'Unknown channel'
        }`;
    }

    updateBoolean(key: keyof FollowedSeriesPreferences, event: Event): void {
        const checked = (event.target as HTMLInputElement).checked;
        this.followed.updatePreferences({
            [key]: checked,
        } as FollowedSeriesPreferencesPatch);
    }

    updateNumber(key: keyof FollowedSeriesPreferences, event: Event): void {
        const input = event.target as HTMLInputElement;
        const value = Math.max(0, Math.trunc(input.valueAsNumber || 0));
        this.followed.updatePreferences({
            [key]: value,
        } as FollowedSeriesPreferencesPatch);
    }

    updateText(key: keyof FollowedSeriesPreferences, event: Event): void {
        this.followed.updatePreferences({
            [key]: (event.target as HTMLInputElement | HTMLSelectElement).value,
        } as FollowedSeriesPreferencesPatch);
    }

    updateNotification(
        key: keyof FollowedSeriesNotificationPreferences,
        event: Event
    ): void {
        const target = event.target as HTMLInputElement | HTMLSelectElement;
        const value =
            target instanceof HTMLInputElement ? target.checked : target.value;
        this.followed.updatePreferences({ notifications: { [key]: value } });
    }

    togglePreferredChannel(channelId: string, event: Event): void {
        const current = new Set(
            this.followed.preferences().preferredChannelIds
        );
        if ((event.target as HTMLInputElement).checked) current.add(channelId);
        else current.delete(channelId);
        this.followed.updatePreferences({ preferredChannelIds: [...current] });
    }

    async requestNotificationPermission(): Promise<void> {
        if (typeof Notification === 'undefined') return;
        this.notificationPermission.set(await Notification.requestPermission());
    }
}
