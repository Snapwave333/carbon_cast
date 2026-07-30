// End-to-end smoke test: connect to this MCP server using the SAME
// @modelcontextprotocol/sdk client that Ember uses, proving protocol compatibility.
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const EMBER = process.env.EMBER_DIR || 'C:/Users/chrom/Desktop/Ember AI Coach';
// Resolve the SDK from Ember's node_modules, honoring its package `exports` map.
const emberRequire = createRequire(path.join(EMBER, 'package.json'));
const sdk = (p) => pathToFileURL(emberRequire.resolve(`@modelcontextprotocol/sdk/${p}`)).href;

const { Client } = await import(sdk('client/index.js'));
const { StdioClientTransport } = await import(sdk('client/stdio.js'));

const mainPath = path.join(__dirname, 'src', 'main.mjs');
const transport = new StdioClientTransport({ command: process.execPath, args: [mainPath] });
const client = new Client({ name: 'smoke', version: '0.0.1' }, { capabilities: {} });

const text = (r) => r.content?.[0]?.text ?? '';
let failures = 0;
const check = (cond, label) => {
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}`);
    if (!cond) failures++;
};

await client.connect(transport);

const list = await client.listTools();
console.log('tools:', list.tools.map((t) => t.name).join(', '));
check(list.tools.length >= 13, `tools/list returns catalog and live tools (got ${list.tools.length})`);
check(
    list.tools.some((tool) => tool.name === 'player_get_state'),
    'tools/list exposes the live player control surface'
);

const status = JSON.parse(text(await client.callTool({ name: 'get_app_status', arguments: {} })));
check(status.databaseFound === true, 'get_app_status finds the database');

const playlists = JSON.parse(text(await client.callTool({ name: 'list_playlists', arguments: {} })));
check(Array.isArray(playlists) && playlists.length >= 1, `list_playlists returns >=1 (got ${playlists.length})`);
const pid = playlists[0]?.id;
console.log('playlist:', playlists[0]?.name, `(${playlists[0]?.channels} channels)`);

const cats = JSON.parse(text(await client.callTool({ name: 'list_categories', arguments: { playlistId: pid } })));
check(cats.canonicalCount > 0, `list_categories returns categories (${cats.rawGroupCount} raw -> ${cats.canonicalCount} canonical)`);
check(cats.canonicalCount <= cats.rawGroupCount, 'canonical count <= raw group count (dedup)');
console.log('top categories:', cats.categories.slice(0, 5).map((c) => `${c.label}:${c.channels}`).join(', '));

const chans = JSON.parse(text(await client.callTool({ name: 'list_channels', arguments: { playlistId: pid, limit: 3 } })));
check(chans.count > 0, `list_channels returns channels (total ${chans.total})`);
check(
    chans.channels.every((channel) => !Object.hasOwn(channel, 'url')),
    'catalog channels never expose raw stream URLs'
);

const search = JSON.parse(text(await client.callTool({ name: 'search_channels', arguments: { query: 'news', limit: 5 } })));
check(Array.isArray(search.results), `search_channels 'news' -> ${search.count} results`);

// EPG tools — find a channel that has guide data and confirm now/next lookup works.
const chList = JSON.parse(text(await client.callTool({ name: 'list_channels', arguments: { playlistId: pid, limit: 60 } })));
let epgHit = 0;
let epgTvg = null;
for (const ch of chList.channels) {
    if (!ch.tvgId) continue;
    const epg = JSON.parse(text(await client.callTool({ name: 'get_epg_now_next', arguments: { tvgId: ch.tvgId } })));
    if (epg.programsForChannel > 0) {
        epgHit = epg.programsForChannel;
        epgTvg = ch.tvgId;
        console.log(`EPG for "${ch.name}": ${epg.programsForChannel} programs; now="${epg.now?.title ?? 'n/a'}", next=${epg.next.length}`);
        break;
    }
}
check(epgHit > 0, `get_epg_now_next finds guide programmes for a channel (${epgHit})`);

const won = JSON.parse(text(await client.callTool({ name: 'whats_on_now', arguments: { playlistId: pid, limit: 20 } })));
check(Array.isArray(won.channels) && won.channels.length > 0, `whats_on_now returns ${won.channels?.length} channels`);

const nowPlaying = JSON.parse(text(await client.callTool({ name: 'find_now_playing', arguments: { playlistId: pid } })));
check(nowPlaying.count > 0, `find_now_playing (all) -> ${nowPlaying.count} channels on now`);
if (nowPlaying.results[0]) console.log(`e.g. now: "${nowPlaying.results[0].channel}" — ${nowPlaying.results[0].title}`);

if (epgTvg) {
    const sched = JSON.parse(text(await client.callTool({ name: 'get_epg_schedule', arguments: { tvgId: epgTvg, hours: 12 } })));
    check(sched.count > 0, `get_epg_schedule (12h) -> ${sched.count} programmes`);
}

await client.close();
console.log(failures === 0 ? '\nALL SMOKE CHECKS PASSED' : `\n${failures} CHECK(S) FAILED`);
process.exit(failures === 0 ? 0 : 1);
