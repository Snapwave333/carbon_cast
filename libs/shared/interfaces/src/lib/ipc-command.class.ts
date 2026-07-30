export class IpcCommand<T = unknown> {
    constructor(
        public id: string,
        public callback: (payload: T) => void
    ) {
        this.id = id;
        this.callback = callback;
    }
}
