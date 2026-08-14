import { createWebBackendApp } from './app/web-backend-app';

const port = Number(process.env['PORT'] ?? 3000);
const app = createWebBackendApp();

app.listen(port, () => {
    console.log(
        `CarbonCast IPTV web backend listening on http://localhost:${port}`
    );
});
