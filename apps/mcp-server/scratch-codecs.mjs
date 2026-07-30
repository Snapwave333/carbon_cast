// Probes what the running Electron can actually decode.
const list = await (await fetch('http://127.0.0.1:9222/json')).json();
const page = list.find((t) => t.type === 'page' && !/devtools/.test(t.url));
const ws = new WebSocket(page.webSocketDebuggerUrl);
let id = 0;
const send = (m, p) =>
    new Promise((res) => {
        const mid = ++id;
        const h = (ev) => { const x = JSON.parse(ev.data); if (x.id === mid) { ws.removeEventListener('message', h); res(x.result); } };
        ws.addEventListener('message', h);
        ws.send(JSON.stringify({ id: mid, method: m, params: p || {} }));
    });
await new Promise((r) => ws.addEventListener('open', r));
const expr = `(() => {
  const v = document.createElement('video');
  const probes = {
    'H.264 (avc1)': 'video/mp4; codecs="avc1.640028"',
    'HEVC/H.265 (hvc1)': 'video/mp4; codecs="hvc1.1.6.L93.B0"',
    'HEVC/H.265 (hev1)': 'video/mp4; codecs="hev1.1.6.L93.B0"',
    'AV1': 'video/mp4; codecs="av01.0.05M.08"',
    'VP9': 'video/mp4; codecs="vp09.00.10.08"',
    'MPEG-2 video': 'video/mpeg',
    'AAC audio': 'audio/mp4; codecs="mp4a.40.2"',
    'AC-3 (Dolby)': 'audio/mp4; codecs="ac-3"',
    'E-AC-3 (DD+)': 'audio/mp4; codecs="ec-3"',
    'DTS': 'audio/mp4; codecs="dtsc"',
    'MP3': 'audio/mpeg',
    'Opus': 'audio/mp4; codecs="opus"',
    'FLAC': 'audio/mp4; codecs="flac"',
    'MPEG-TS (H.264+AAC)': 'video/mp2t; codecs="avc1.640028,mp4a.40.2"',
    'Matroska/MKV': 'video/x-matroska',
  };
  const out = {};
  for (const [name, type] of Object.entries(probes)) {
    const canPlay = v.canPlayType(type) || 'no';
    const mse = (window.MediaSource && MediaSource.isTypeSupported(type)) ? 'yes' : 'no';
    out[name] = 'element=' + canPlay + ' mse=' + mse;
  }
  return JSON.stringify(out, null, 1);
})()`;
const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true });
console.log(r.result?.value);
ws.close();
