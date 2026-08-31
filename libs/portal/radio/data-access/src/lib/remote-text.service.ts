/**
 * Compatibility re-export.
 *
 * `RemoteTextService` was written for podcast feeds and lived here, but it is
 * generic and the free-channel catalogue needs it too. It now lives in
 * `@iptvnator/services`; this file keeps the existing radio imports working.
 */
export {
    RemoteTextService,
    RemoteTextUnavailableError,
} from '@iptvnator/services';
