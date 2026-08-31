import type {
    AgentControlOperation,
    AgentControlScope,
} from '@iptvnator/shared/interfaces';

/**
 * The scope each safe operation requires. Kept free of Electron imports so the
 * routing and metering rules stay unit-testable on their own.
 */
export const operationScopes: Record<AgentControlOperation, AgentControlScope> = {
    'player.getState': 'state.read',
    'player.play': 'player.control',
    'player.pause': 'player.control',
    'player.stop': 'player.control',
    'player.setVolume': 'player.control',
    'player.setMuted': 'player.control',
    'player.seek': 'player.control',
    'player.setFullscreen': 'player.control',
    'player.togglePictureInPicture': 'player.control',
    'player.setSubtitle': 'player.control',
    'player.setAudioTrack': 'player.control',
    'channel.list': 'library.read',
    'channel.switch': 'player.control',
    'channel.next': 'player.control',
    'channel.previous': 'player.control',
    'epg.getNowNext': 'library.read',
    'epg.refresh': 'library.write',
    'favorite.list': 'library.read',
    'favorite.set': 'library.write',
    'follow.list': 'library.read',
    'follow.set': 'follow.write',
    'follow.setAutoSwitch': 'follow.write',
    'recording.start': 'recording.control',
    'recording.stop': 'recording.control',
    'settings.get': 'state.read',
    'settings.update': 'settings.write',
    'diagnostics.get': 'diagnostics.read',
    'diagnostics.screenshot': 'diagnostics.read',
    'app.navigate': 'player.control',
    'app.launch': 'app.lifecycle',
    'app.window.get': 'state.read',
    'app.window.set': 'player.control',
    'app.display.list': 'state.read',
    'app.display.move': 'player.control',
    'app.quit': 'app.lifecycle',
};

/**
 * Operations the main process answers itself instead of forwarding to the
 * renderer. Two reasons, both load-bearing:
 *
 * - A renderer cannot move, minimise, or fullscreen the window that hosts it,
 *   and it certainly cannot outlive `app.quit`.
 * - These are exactly the operations worth having when the renderer has
 *   stopped answering, which is when routing through it would fail.
 *
 * `diagnostics.screenshot` was the first member and set the pattern.
 */
export const mainProcessOperations: ReadonlySet<AgentControlOperation> = new Set([
    'diagnostics.screenshot',
    'app.launch',
    'app.quit',
    'app.window.get',
    'app.window.set',
    'app.display.list',
    'app.display.move',
]);

/**
 * Every operation — read or write — arrives on `POST /command`, so the rate
 * limit cannot be inferred from the HTTP method. Derive it from the operation's
 * own scope instead: listing channels is a read and belongs in the 120/min
 * budget, not the 30/min control budget that a handful of `channel.list` calls
 * would otherwise exhaust.
 *
 * `diagnostics.screenshot` is the deliberate exception. Its scope is
 * `diagnostics.read`, but it captures the window and writes a file, so it is
 * metered as control to keep it from filling the disk.
 */
export function isControlOperation(operation: AgentControlOperation): boolean {
    if (operation === 'diagnostics.screenshot') return true;
    return !operationScopes[operation].endsWith('.read');
}
