import {
    isBrowserAccessFailure,
    isCodecFailure,
    isDrmOrEncryptionFailure,
    isEarlyEofFailure,
    isNetworkFailure,
    normalizeErrorDetails,
} from './playback-error-patterns.util';

describe('playback-error-patterns.util', () => {
    describe('normalizeErrorDetails', () => {
        it('joins the present HLS parts and drops the empty ones', () => {
            expect(
                normalizeErrorDetails({
                    type: 'networkError',
                    details: 'manifestLoadError',
                    message: 'boom',
                    error: 'socket hang up',
                })
            ).toBe('manifestLoadError boom socket hang up');
        });

        it('reads the mpegts info payload', () => {
            expect(
                normalizeErrorDetails({
                    details: 'mediaError',
                    info: { code: 3 },
                })
            ).toBe('mediaError {"code":3}');
        });

        it('flattens an Error instance to its message', () => {
            expect(
                normalizeErrorDetails({
                    details: 'fatal',
                    error: new Error('decode failed'),
                })
            ).toBe('fatal decode failed');
        });

        it('appends enumerable Error properties when present', () => {
            const error = Object.assign(new Error('load failed'), {
                url: '/x',
            });
            expect(normalizeErrorDetails({ details: 'd', error })).toContain(
                'load failed'
            );
            expect(normalizeErrorDetails({ details: 'd', error })).toContain(
                '"url":"/x"'
            );
        });

        it('falls back to String() for a non-serializable payload', () => {
            const circular: Record<string, unknown> = {};
            circular['self'] = circular;
            expect(
                normalizeErrorDetails({ details: 'x', info: circular })
            ).toBe('x [object Object]');
        });

        it('returns an empty string when nothing is present', () => {
            expect(normalizeErrorDetails({})).toBe('');
        });
    });

    describe('isNetworkFailure', () => {
        it('matches on the error type', () => {
            expect(isNetworkFailure('networkError', '')).toBe(true);
        });

        it('matches on network-flavoured details', () => {
            expect(isNetworkFailure('other', 'loaderror')).toBe(true);
            expect(isNetworkFailure('other', 'timeout')).toBe(true);
            expect(isNetworkFailure('other', 'status 404')).toBe(true);
        });

        it('is false for unrelated errors', () => {
            expect(isNetworkFailure('media', 'decode')).toBe(false);
        });
    });

    describe('isBrowserAccessFailure', () => {
        it('matches CORS, CSP and mixed-content markers', () => {
            expect(isBrowserAccessFailure('blocked by cors')).toBe(true);
            expect(isBrowserAccessFailure('cross-origin request')).toBe(true);
            expect(
                isBrowserAccessFailure('content security policy violation')
            ).toBe(true);
            expect(isBrowserAccessFailure('mixed content')).toBe(true);
            expect(isBrowserAccessFailure('err_cleartext_not_permitted')).toBe(
                true
            );
        });

        it('is false for unrelated details', () => {
            expect(isBrowserAccessFailure('generic failure')).toBe(false);
        });
    });

    describe('isEarlyEofFailure', () => {
        it('ignores punctuation when detecting an early EOF', () => {
            expect(isEarlyEofFailure('early-eof reached')).toBe(true);
            expect(isEarlyEofFailure('early eof')).toBe(true);
        });

        it('is false without an early-eof marker', () => {
            expect(isEarlyEofFailure('unexpected end')).toBe(false);
        });
    });

    describe('isCodecFailure', () => {
        it('matches codec-related markers', () => {
            expect(isCodecFailure('incompatiblecodecs')).toBe(true);
            expect(isCodecFailure('addcodec failed')).toBe(true);
        });

        it('is false for unrelated details', () => {
            expect(isCodecFailure('network down')).toBe(false);
        });
    });

    describe('isDrmOrEncryptionFailure', () => {
        it('matches DRM and encryption markers', () => {
            expect(isDrmOrEncryptionFailure('keysystem error')).toBe(true);
            expect(isDrmOrEncryptionFailure('license request failed')).toBe(
                true
            );
            expect(isDrmOrEncryptionFailure('failed to decrypt')).toBe(true);
        });

        it('is false for unrelated details', () => {
            expect(isDrmOrEncryptionFailure('timeout')).toBe(false);
        });
    });
});
