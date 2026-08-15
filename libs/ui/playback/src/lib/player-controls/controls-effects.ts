import { Signal, WritableSignal, effect, untracked } from '@angular/core';
import type { ControlsFeedback } from './controls-feedback';
import type { ControlsFullscreen } from './controls-fullscreen';
import type { ControlsMenuState } from './controls-menu-state';
import type { ControlsSurface } from './controls-surface';
import type { ControlsVisibility } from './controls-visibility';
import type { ControlsVolume } from './controls-volume';
import type {
    PlayerController,
    PlayerControlsCapabilities,
    PlayerControlsState,
} from './player-controls.model';

export interface ControlsEffectsDeps {
    controller: Signal<PlayerController>;
    state: Signal<PlayerControlsState>;
    capabilities: Signal<PlayerControlsCapabilities>;
    controllerVolume: Signal<number>;
    playerSurface: Signal<HTMLElement | null>;
    showControls: Signal<boolean>;
    hideCursor: Signal<boolean>;
    scrubPosition: WritableSignal<number | null>;
    surface: ControlsSurface;
    fullscreen: ControlsFullscreen;
    volume: ControlsVolume;
    menus: ControlsMenuState;
    visibility: ControlsVisibility;
    feedback: ControlsFeedback;
    recordingLabels: () => { active: string; inactive: string };
}

/**
 * Registers the controls' reactive side effects. Must be called from an
 * injection context (the component constructor); it is split out only to keep
 * the component itself down to bindings and command handlers.
 */
export function registerControlsEffects(deps: ControlsEffectsDeps): void {
    effect((onCleanup) => {
        const playerSurface = deps.playerSurface();
        const surface = deps.showControls() ? playerSurface : null;
        deps.fullscreen.sync();
        onCleanup(deps.surface.attachSurface(surface));
    });

    effect(() => {
        const controller = deps.controller();
        if (
            !deps.volume.beginCapabilityEpoch(
                controller,
                deps.capabilities().volume
            )
        ) {
            return;
        }
        const volume = deps.controllerVolume();
        untracked(() => deps.volume.initializeController(controller, volume));
    });

    effect(() => {
        const controller = deps.controller();
        const volume = deps.controllerVolume();
        untracked(() => deps.volume.reconcileController(controller, volume));
    });

    effect((onCleanup) => {
        const surface = deps.playerSurface();
        if (!surface || !deps.hideCursor()) {
            return;
        }
        const previousCursor = surface.style.cursor;
        surface.style.cursor = 'none';
        onCleanup(() => {
            if (surface.style.cursor === 'none') {
                surface.style.cursor = previousCursor;
            }
        });
    });

    effect(() => {
        const state = deps.state();
        const showControls = deps.showControls();
        const capabilities = deps.capabilities();
        untracked(() => {
            if (!capabilities.seek || !state.canSeek) {
                deps.scrubPosition.set(null);
            }
            deps.menus.reconcileControllerAvailability(
                showControls,
                capabilities,
                state
            );
            deps.visibility.scheduleHide();
            deps.feedback.flashRecordingState(
                state.recording,
                deps.recordingLabels()
            );
        });
    });
}
