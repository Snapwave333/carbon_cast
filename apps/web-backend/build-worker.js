const esbuild = require('esbuild');
const path = require('path');

// Node.js built-in modules that should stay external (resolved at runtime).
const nodeBuiltins = [
    'assert', 'async_hooks', 'buffer', 'child_process', 'cluster',
    'console', 'constants', 'crypto', 'dgram', 'dns', 'domain',
    'events', 'fs', 'http', 'http2', 'https', 'inspector', 'module',
    'net', 'os', 'path', 'perf_hooks', 'process', 'punycode',
    'querystring', 'readline', 'repl', 'stream', 'string_decoder',
    'sys', 'timers', 'tls', 'trace_events', 'tty', 'url', 'util',
    'v8', 'vm', 'worker_threads', 'zlib'
];

const isProduction = process.env.NODE_ENV === 'production';

async function buildWorker() {
    try {
        console.log(
            `Building web-backend EPG parser worker with esbuild (${
                isProduction ? 'production' : 'development'
            })...`
        );

        // The worker must land next to the main bundle (main.cjs): the bundled
        // client resolves it via
        // path.join(__dirname, 'epg-parser.worker' + extname(__filename)),
        // which is '.cjs' at runtime because __filename is the main.cjs bundle.
        await esbuild.build({
            entryPoints: [
                path.join(__dirname, 'src/app/workers/epg-parser.worker.ts'),
            ],
            bundle: true,
            platform: 'node',
            target: 'node22',
            format: 'cjs',
            outfile: path.join(
                __dirname,
                '../../dist/apps/web-backend/epg-parser.worker.cjs'
            ),
            external: [
                ...nodeBuiltins.map((m) => `node:${m}`),
                ...nodeBuiltins,
            ],
            sourcemap: !isProduction,
            minify: isProduction,
        });

        console.log('✅ web-backend EPG parser worker built successfully!');
    } catch (error) {
        console.error('❌ web-backend worker build failed:', error);
        process.exit(1);
    }
}

buildWorker();
