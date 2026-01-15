
// A simple event emitter
class EventEmitter {
  private events: { [key: string]: ((...args: any[]) => void)[] };

  constructor() {
    this.events = {};
  }

  on(event: string, listener: (...args: any[]) => void) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
  }

  off(event: string, listener: (...args: any[]) => void) {
    if (!this.events[event]) return;
    this.events[event] = this.events[event].filter(l => l !== listener);
  }

  emit(event: string, payload?: any) {
    if (!this.events[event]) return;
    this.events[event].forEach(listener => listener(payload));
  }
}

export const storageEmitter = new EventEmitter();
