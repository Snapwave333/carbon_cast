import { Component } from '@angular/core';
import { FollowedSeriesComponent } from '@iptvnator/ui/epg';

@Component({
    selector: 'app-followed-series-route',
    imports: [FollowedSeriesComponent],
    template: '<app-followed-series />',
})
export class FollowedSeriesRouteComponent {}
