
// A simple event emitter
type Listener = (payload?: unknown) => void;

class EventEmitter {
  private events: { [key: string]: Listener[] };

  constructor() {
    this.events = {};
  }

  on(event: string, listener: Listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: Listener) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event: string, payload?: unknown) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(payload));
  }
}

export const storageEmitter = new EventEmitter();
