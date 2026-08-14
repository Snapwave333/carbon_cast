// One probe per renderer session: preparing the addon loads the native
// library in the main process, so the result is cached for every player host.
let embeddedMpvFallbackProbe: Promise<boolean> | null = null;

export function probeEmbeddedMpvFallback(): Promise<boolean> {
    if (!embeddedMpvFallbackProbe) {
        embeddedMpvFallbackProbe = (async () => {
            try {
                const support = await Promise.race([
                    window.electron?.prepareEmbeddedMpv?.(),
                    // A hung main process must not wedge the fallback path;
                    // the diagnostic (with its external-player actions) stays
                    // up instead.
                    new Promise<'timeout'>((resolve) =>
                        setTimeout(() => resolve('timeout'), 8000)
                    ),
                ]);
                if (support === 'timeout') {
                    // Slow is not unsupported — allow a later retry.
                    embeddedMpvFallbackProbe = null;
                    return false;
                }
                return support?.supported === true;
            } catch {
                return false;
            }
        })();
    }
    return embeddedMpvFallbackProbe;
}

/** Test-only: clears the cached embedded-MPV availability probe. */
export function resetEmbeddedMpvFallbackProbeForTesting(): void {
    embeddedMpvFallbackProbe = null;
}
