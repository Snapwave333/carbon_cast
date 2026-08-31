import { CommonModule } from '@angular/common';
import { Component, input, output, ViewEncapsulation } from '@angular/core';
import { FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslateModule } from '@ngx-translate/core';
import { CoverSize, Language } from '@iptvnator/shared/interfaces';
import {
    CoverSizeOption,
    DefaultWorkspacePageOption,
    PlaylistDefaultSectionOption,
    StartupBehaviorOption,
} from './settings.models';

@Component({
    selector: 'app-settings-general-section',
    imports: [
        CommonModule,
        MatCheckboxModule,
        MatFormFieldModule,
        MatIconModule,
        MatInputModule,
        MatSelectModule,
        MatTooltipModule,
        ReactiveFormsModule,
        TranslateModule,
    ],
    templateUrl: './settings-general-section.component.html',
    encapsulation: ViewEncapsulation.None,
    styles: [':host { display: contents; }'],
})
export class SettingsGeneralSectionComponent {
    readonly form = input.required<FormGroup>();
    readonly activeSection = input.required<string>();
    readonly showAdvanced = input(false);
    readonly languageEnum = input.required<typeof Language>();
    readonly coverSizeOptions = input.required<CoverSizeOption[]>();
    readonly startupBehaviorOptions = input.required<StartupBehaviorOption[]>();
    readonly defaultWorkspacePageOptions =
        input.required<DefaultWorkspacePageOption[]>();
    readonly playlistDefaultSectionOptions =
        input.required<PlaylistDefaultSectionOption[]>();

    readonly selectCoverSize = output<CoverSize>();
}
