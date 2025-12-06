import { EventEmitter } from 'events';

export type LogType = 'log' | 'error' | 'warn' | 'info';

export interface LogEntry {
  timestamp: string;
  type: LogType;
  message: string;
}

class LogEmitter extends EventEmitter {}

// Use globalThis to maintain the singleton across hot reloads in development
const globalForLogger = globalThis as unknown as {
  logEmitter: LogEmitter;
  isLoggerInitialized: boolean;
};

export const logEmitter = globalForLogger.logEmitter || new LogEmitter();

if (process.env.NODE_ENV !== 'production') {
    globalForLogger.logEmitter = logEmitter;
}

let isInitialized = globalForLogger.isLoggerInitialized || false;

export function initLogger() {
  if (isInitialized) return;
  isInitialized = true;
  globalForLogger.isLoggerInitialized = true;

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;

  function emitLog(type: LogType, ...args: unknown[]) {
    try {
      const message = args
        .map((arg) => {
          if (typeof arg === 'object') {
            try {
              return JSON.stringify(arg);
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .join(' ');

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        type,
        message,
      };

      logEmitter.emit('log', entry);
    } catch (err) {
      // Avoid infinite loops if logging fails
      originalError('Failed to capture log:', err);
    }
  }

  console.log = (...args: unknown[]) => {
    emitLog('log', ...args);
    originalLog.apply(console, args);
  };

  console.error = (...args: unknown[]) => {
    emitLog('error', ...args);
    originalError.apply(console, args);
  };

  console.warn = (...args: unknown[]) => {
    emitLog('warn', ...args);
    originalWarn.apply(console, args);
  };

  console.info = (...args: unknown[]) => {
    emitLog('info', ...args);
    originalInfo.apply(console, args);
  };
}
