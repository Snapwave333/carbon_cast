import { createAgentControlClient } from '../../agent-control/src/client.mjs';

const command =
    (operation) =>
    async (args = {}) =>
        createAgentControlClient().command(operation, args);

export const liveHandlers = {
    player_get_state: () => createAgentControlClient().getState(),
    player_play: command('player.play'),
    player_pause: command('player.pause'),
    player_stop: command('player.stop'),
    player_set_volume: command('player.setVolume'),
    player_set_muted: command('player.setMuted'),
    player_seek: command('player.seek'),
    player_set_fullscreen: command('player.setFullscreen'),
    player_toggle_picture_in_picture: command('player.togglePictureInPicture'),
    channel_list_active: command('channel.list'),
    channel_switch: command('channel.switch'),
    channel_next: command('channel.next'),
    channel_previous: command('channel.previous'),
    epg_current: command('epg.getNowNext'),
    epg_refresh: command('epg.refresh'),
    favorites_list_live: command('favorite.list'),
    favorites_set: command('favorite.set'),
    follows_list: command('follow.list'),
    follows_set: command('follow.set'),
    follows_set_auto_switch: command('follow.setAutoSwitch'),
    recording_start: command('recording.start'),
    recording_stop: command('recording.stop'),
    settings_get_live: command('settings.get'),
    settings_update_live: command('settings.update'),
    diagnostics_get_live: command('diagnostics.get'),
    app_navigate: command('app.navigate'),
    agent_tokens_list: () => createAgentControlClient().listTokens(),
    agent_tokens_create: (args) => createAgentControlClient().createToken(args),
    agent_tokens_revoke: ({ tokenId }) =>
        createAgentControlClient().revokeToken(tokenId),
    agent_tokens_rotate: ({ tokenId }) =>
        createAgentControlClient().rotateToken(tokenId),
};

const schema = (name, description, properties = {}, required = []) => ({
    name,
    description,
    inputSchema: { type: 'object', properties, required },
});

export const liveTools = [
    schema(
        'player_get_state',
        'Live, redacted player/channel/settings state from the running CarbonCast IPTV renderer.'
    ),
    schema('player_play', 'Play the active built-in player.'),
    schema('player_pause', 'Pause the active built-in player.'),
    schema(
        'player_stop',
        'Stop and rewind the active seekable built-in player.'
    ),
    schema(
        'player_set_volume',
        'Set player volume from 0 to 1.',
        { volume: { type: 'number', minimum: 0, maximum: 1 } },
        ['volume']
    ),
    schema(
        'player_set_muted',
        'Set player mute state.',
        { muted: { type: 'boolean' } },
        ['muted']
    ),
    schema(
        'player_seek',
        'Seek a VOD player to a number of seconds.',
        { seconds: { type: 'number', minimum: 0 } },
        ['seconds']
    ),
    schema(
        'player_set_fullscreen',
        'Enter or exit built-in player fullscreen.',
        { fullscreen: { type: 'boolean' } },
        ['fullscreen']
    ),
    schema(
        'player_toggle_picture_in_picture',
        'Toggle standard browser picture-in-picture for the active built-in player.'
    ),
    schema(
        'channel_list_active',
        'List safe channel metadata from the currently loaded playlist.',
        {
            query: { type: 'string' },
            limit: { type: 'number', minimum: 1, maximum: 200 },
        }
    ),
    schema(
        'channel_switch',
        'Switch the GUI to a loaded channel by channelId or one-based number.',
        {
            channelId: { type: 'string' },
            number: { type: 'number', minimum: 1 },
        }
    ),
    schema('channel_next', 'Switch to the next loaded channel.'),
    schema('channel_previous', 'Switch to the previous loaded channel.'),
    schema('epg_current', 'Get the current programme from the GUI state.'),
    schema(
        'epg_refresh',
        'Refresh the configured EPG sources without exposing their URLs.'
    ),
    schema(
        'favorites_list_live',
        'List active-playlist favorites from the GUI state.'
    ),
    schema(
        'favorites_set',
        'Add or remove a favorite by channelId.',
        { channelId: { type: 'string' }, favorite: { type: 'boolean' } },
        ['channelId', 'favorite']
    ),
    schema('follows_list', 'List followed series with safe metadata.'),
    schema('follows_set', 'Follow a series or unfollow by seriesId.', {
        seriesId: { type: 'string' },
        followed: { type: 'boolean' },
        title: { type: 'string' },
        source: { type: 'string', enum: ['epg', 'xtream', 'stalker'] },
        sourceSeriesId: { type: 'string' },
        sourcePlaylistId: { type: 'string' },
    }),
    schema(
        'follows_set_auto_switch',
        'Enable or disable auto-switch for a scheduled broadcast.',
        { broadcastId: { type: 'string' }, enabled: { type: 'boolean' } },
        ['broadcastId', 'enabled']
    ),
    schema(
        'recording_start',
        'Start recording when the active engine exposes a safe recording command.'
    ),
    schema(
        'recording_stop',
        'Stop recording when the active engine exposes a safe recording command.'
    ),
    schema('settings_get_live', 'Get safe, agent-editable GUI settings.'),
    schema(
        'settings_update_live',
        'Update safe GUI settings such as layout, captions, shared controls, or player control preferences.',
        {
            mirrorLayout: { type: 'boolean' },
            showCaptions: { type: 'boolean' },
            webPlayerSharedControls: { type: 'boolean' },
            playerControls: { type: 'object' },
        }
    ),
    schema('diagnostics_get_live', 'Get redacted runtime diagnostics.'),
    schema(
        'app_navigate',
        'Navigate the running GUI to an internal route.',
        { route: { type: 'string' } },
        ['route']
    ),
    schema(
        'agent_tokens_list',
        'List token metadata. Requires tokens.manage scope.'
    ),
    schema(
        'agent_tokens_create',
        'Create a scoped token. The token value is returned exactly once.',
        {
            label: { type: 'string' },
            scopes: { type: 'array', items: { type: 'string' } },
            expiresAt: { type: 'string' },
        },
        ['scopes']
    ),
    schema(
        'agent_tokens_revoke',
        'Revoke a token by id.',
        { tokenId: { type: 'string' } },
        ['tokenId']
    ),
    schema(
        'agent_tokens_rotate',
        'Rotate a token by id. The replacement value is returned exactly once.',
        { tokenId: { type: 'string' } },
        ['tokenId']
    ),
];
