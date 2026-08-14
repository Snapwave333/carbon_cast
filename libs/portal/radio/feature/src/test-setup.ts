import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

setupZoneTestEnv({
    errorOnUnknownElements: true,
    errorOnUnknownProperties: true,
});

// jsdom ships no media stack: `play()`/`pause()`/`load()` throw "Not
// implemented", which would fail any test that renders the radio player.
Object.defineProperties(HTMLMediaElement.prototype, {
    play: { writable: true, value: jest.fn().mockResolvedValue(undefined) },
    pause: { writable: true, value: jest.fn() },
    load: { writable: true, value: jest.fn() },
});
