const getDatabase = jest.fn();

jest.mock('electron', () => ({
    ipcMain: {
        handle: jest.fn(),
    },
}));

jest.mock('../../database/connection', () => ({
    getDatabase: (...args: unknown[]) => getDatabase(...args),
}));

function getRegisteredChannels(): string[] {
    const { ipcMain } = jest.requireMock('electron') as {
        ipcMain: { handle: jest.Mock };
    };
    return (
        ipcMain.handle.mock.calls as Array<
            [string, (...args: unknown[]) => unknown]
        >
    ).map(([registeredChannel]) => registeredChannel);
}

function getIpcMainHandler(channel: string): (...args: unknown[]) => unknown {
    const { ipcMain } = jest.requireMock('electron') as {
        ipcMain: { handle: jest.Mock };
    };
    const calls = ipcMain.handle.mock.calls as Array<
        [string, (...args: unknown[]) => unknown]
    >;
    const match = calls.find(
        ([registeredChannel]) => registeredChannel === channel
    );

    if (!match) {
        throw new Error(`Missing ipcMain handler for ${channel}`);
    }

    return match[1];
}

describe('epg-db.events', () => {
    let consoleErrorSpy: jest.SpyInstance;

    beforeEach(async () => {
        jest.resetModules();
        getDatabase.mockReset();
        const { ipcMain } = jest.requireMock('electron') as {
            ipcMain: { handle: jest.Mock };
        };
        ipcMain.handle.mockClear();
        consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

        await import('./epg-db.events');
    });

    afterEach(() => {
        consoleErrorSpy.mockRestore();
    });

    it('registers the programme search and bounded followed-series lookup', () => {
        expect(getRegisteredChannels()).toEqual([
            'EPG_DB_SEARCH_PROGRAMS',
            'EPG_DB_FOLLOWED_SERIES_PROGRAMS',
        ]);
    });

    it('returns an empty result for a blank search term without querying', async () => {
        const all = jest.fn();
        getDatabase.mockResolvedValue({ all });

        await expect(
            getIpcMainHandler('EPG_DB_SEARCH_PROGRAMS')({}, '   ')
        ).resolves.toEqual([]);

        expect(all).not.toHaveBeenCalled();
    });

    it('searches programmes with a LIKE pattern built from the trimmed term', async () => {
        const rows = [{ title: 'News', channel_name: 'NHK' }];
        const all = jest.fn().mockResolvedValue(rows);
        getDatabase.mockResolvedValue({ all });

        await expect(
            getIpcMainHandler('EPG_DB_SEARCH_PROGRAMS')({}, '  news  ', 25)
        ).resolves.toEqual(rows);

        expect(all).toHaveBeenCalledTimes(1);
        const query = all.mock.calls[0][0] as {
            queryChunks?: unknown[];
        };
        const boundParams = JSON.stringify(query);
        expect(boundParams).toContain('%news%');
        expect(boundParams).toContain('25');
    });

    it('bounds followed-series lookahead and normalizes SQLite booleans', async () => {
        const all = jest.fn().mockResolvedValue([
            {
                title: 'The Office',
                channel: 'office.us',
                start: '2026-08-01T10:00:00Z',
                stop: '2026-08-01T10:30:00Z',
                desc: null,
                category: null,
                isNew: 1,
                previouslyShown: 0,
            },
        ]);
        getDatabase.mockResolvedValue({ all });

        await expect(
            getIpcMainHandler('EPG_DB_FOLLOWED_SERIES_PROGRAMS')(
                {},
                {
                    from: '2026-08-01T00:00:00Z',
                    to: '2026-08-15T00:00:00Z',
                    titleHints: ['The Office', 'The Office'],
                    limit: 50_000,
                }
            )
        ).resolves.toEqual([
            expect.objectContaining({ isNew: true, previouslyShown: false }),
        ]);

        const query = JSON.stringify(all.mock.calls[0][0]);
        expect(query).toContain('%The Office%');
        expect(query).toContain('10000');
    });

    it('rejects invalid or empty followed-series ranges without querying', async () => {
        const all = jest.fn();
        getDatabase.mockResolvedValue({ all });

        await expect(
            getIpcMainHandler('EPG_DB_FOLLOWED_SERIES_PROGRAMS')(
                {},
                {
                    from: 'invalid',
                    to: '2026-08-01T00:00:00Z',
                    titleHints: [],
                }
            )
        ).resolves.toEqual([]);
        expect(all).not.toHaveBeenCalled();
    });
});
