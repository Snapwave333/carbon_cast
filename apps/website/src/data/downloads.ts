export const LATEST_VERSION = '0.22.0';
export const RELEASE_TAG = `v${LATEST_VERSION}`;

export const REPO_URL = 'https://github.com/Snapwave333/carbon_cast';
export const RELEASE_NOTES_URL = `${REPO_URL}/releases/tag/${RELEASE_TAG}`;
export const ALL_RELEASES_URL = `${REPO_URL}/releases`;

export const CONTAINER_IMAGE = 'ghcr.io/snapwave333/carbon_cast';

/**
 * Set once the hosted PWA instance is live. While it is null the download page
 * renders the self-host instructions instead of a dead "try it" link.
 */
export const DEMO_URL: string | null = null;

/** Release artifacts keep the legacy `iptvnator-` prefix for upgrade compatibility. */
const ARTIFACT_PREFIX = `iptvnator-${LATEST_VERSION}`;

export type PlatformId = 'windows' | 'macos' | 'linux';

export interface DownloadAsset {
    label: string;
    detail: string;
    file: string;
    bytes: number;
    primary?: boolean;
    /** Assets sharing a group render under one heading instead of one long list. */
    group?: string;
}

export interface InstallStep {
    title: string;
    body: string;
}

export interface Platform {
    id: PlatformId;
    name: string;
    /** Shown under the auto-detected primary button. */
    shortName: string;
    icon: string;
    assets: DownloadAsset[];
    install: InstallStep[];
}

export function assetUrl(file: string): string {
    return `${REPO_URL}/releases/download/${RELEASE_TAG}/${file}`;
}

export function formatSize(bytes: number): string {
    return `${(bytes / 1024 / 1024).toFixed(0)} MB`;
}

export const platforms: Platform[] = [
    {
        id: 'windows',
        name: 'Windows',
        shortName: 'Windows',
        icon: 'M3 12V6.75l8-1.25V12H3zm0 .5h8v6.5l-8-1.25V12.5zM11.5 5.35L21 3.75V12h-9.5V5.35zm0 7.15H21v8.25l-9.5-1.6V12.5z',
        assets: [
            {
                label: 'Installer',
                detail: '64-bit · .exe',
                file: `${ARTIFACT_PREFIX}-windows-x64-setup.exe`,
                bytes: 185813512,
                primary: true,
            },
        ],
        install: [
            {
                title: 'Run the installer',
                body: 'Double-click the downloaded .exe. CarbonCast installs per-user, so no administrator password is needed.',
            },
            {
                title: 'Clear the SmartScreen warning',
                body: 'The installer is not code-signed yet, so Windows shows "Windows protected your PC". Choose More info, then Run anyway.',
            },
            {
                title: 'Updates',
                body: 'The app checks for new releases on start and can install them in place from Settings.',
            },
        ],
    },
    {
        id: 'macos',
        name: 'macOS',
        shortName: 'macOS',
        icon: 'M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z',
        assets: [
            {
                label: 'Apple Silicon',
                detail: 'M1 to M4 · .dmg',
                file: `${ARTIFACT_PREFIX}-mac-arm64.dmg`,
                bytes: 185070719,
                primary: true,
            },
            {
                label: 'Intel',
                detail: 'x64 · .dmg',
                file: `${ARTIFACT_PREFIX}-mac-x64.dmg`,
                bytes: 195908890,
            },
            {
                label: 'Apple Silicon',
                detail: 'M1 to M4 · .zip',
                file: `${ARTIFACT_PREFIX}-mac-arm64.zip`,
                bytes: 177716224,
            },
            {
                label: 'Intel',
                detail: 'x64 · .zip',
                file: `${ARTIFACT_PREFIX}-mac-x64.zip`,
                bytes: 188285850,
            },
        ],
        install: [
            {
                title: 'Open the disk image',
                body: 'Drag CarbonCast IPTV into your Applications folder, then eject the image.',
            },
            {
                title: 'If macOS says the app is damaged',
                body: 'The build is unsigned, so Gatekeeper quarantines it. Run xattr -cr "/Applications/CarbonCast IPTV.app" in Terminal and open it again.',
            },
            {
                title: 'Pick the right build',
                body: 'Apple Silicon Macs run the arm64 build natively. The Intel build also works through Rosetta 2 but uses more power.',
            },
        ],
    },
    {
        id: 'linux',
        name: 'Linux',
        shortName: 'Linux',
        icon: 'M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 00-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.368 1.884 1.43.39.03.8-.066 1.109-.199.69-.3 1.286-1.065 1.09-1.745a21.03 21.03 0 01-.174-.606c-.101-.427-.2-.855-.29-1.283-.09-.428.04-.546.481-.735.463-.199.833-.338 1.073-.668.24-.33.364-.8.269-1.437-.14-.98-.689-2.072-1.329-3.069-.645-1-.34-1.665-.34-2.863.006-1.497-.898-2.987-1.792-4.048-.89-1.06-1.78-1.835-2.085-2.748-.228-.68-.098-1.401.128-2.056.112-.322.254-.631.325-.933.07-.303.072-.622-.058-.853C13.56.199 13.04 0 12.504 0z',
        assets: [
            {
                label: 'AppImage',
                detail: 'x86_64 · runs anywhere',
                file: `${ARTIFACT_PREFIX}-linux-x86_64.AppImage`,
                group: 'Intel and AMD (x86_64)',
                bytes: 154815076,
                primary: true,
            },
            {
                label: 'Debian / Ubuntu',
                detail: 'amd64 · .deb',
                file: `${ARTIFACT_PREFIX}-linux-amd64.deb`,
                group: 'Intel and AMD (x86_64)',
                bytes: 98450820,
            },
            {
                label: 'Fedora / openSUSE',
                detail: 'x86_64 · .rpm',
                file: `${ARTIFACT_PREFIX}-linux-x86_64.rpm`,
                group: 'Intel and AMD (x86_64)',
                bytes: 98783937,
            },
            {
                label: 'Arch',
                detail: 'x64 · .pacman',
                file: `${ARTIFACT_PREFIX}-linux-x64.pacman`,
                group: 'Intel and AMD (x86_64)',
                bytes: 98494412,
            },
            {
                label: 'Flatpak',
                detail: 'x86_64 · .flatpak',
                file: `${ARTIFACT_PREFIX}-linux-x86_64.flatpak`,
                group: 'Intel and AMD (x86_64)',
                bytes: 101539272,
            },
            {
                label: 'Snap',
                detail: 'amd64 · .snap',
                file: `${ARTIFACT_PREFIX}-linux-amd64.snap`,
                group: 'Intel and AMD (x86_64)',
                bytes: 131743744,
            },
            {
                label: 'AppImage',
                detail: 'arm64 · Raspberry Pi 4/5',
                file: `${ARTIFACT_PREFIX}-linux-arm64.AppImage`,
                group: 'ARM64',
                bytes: 155070025,
            },
            {
                label: 'Debian / Ubuntu',
                detail: 'arm64 · .deb',
                file: `${ARTIFACT_PREFIX}-linux-arm64.deb`,
                group: 'ARM64',
                bytes: 93233882,
            },
            {
                label: 'AppImage',
                detail: 'armv7l · 32-bit ARM',
                file: `${ARTIFACT_PREFIX}-linux-armv7l.AppImage`,
                group: 'ARM 32-bit',
                bytes: 143895571,
            },
            {
                label: 'Debian / Ubuntu',
                detail: 'armv7l · .deb',
                file: `${ARTIFACT_PREFIX}-linux-armv7l.deb`,
                group: 'ARM 32-bit',
                bytes: 93362320,
            },
        ],
        install: [
            {
                title: 'AppImage',
                body: 'chmod +x the downloaded file and run it. Nothing is installed system-wide and no root access is needed.',
            },
            {
                title: 'Packages',
                body: 'Install with sudo apt install ./<file>.deb, sudo dnf install ./<file>.rpm, or sudo pacman -U ./<file>.pacman.',
            },
            {
                title: 'Embedded MPV on x64',
                body: 'The DEB, RPM and Pacman packages use your system libmpv. The AppImage, Snap and Flatpak builds bundle their own copy.',
            },
        ],
    },
];
