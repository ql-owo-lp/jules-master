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

globalForLogger.logEmitter = logEmitter;

let isInitialized = globalForLogger.isLoggerInitialized || false;

export const LOG_BUFFER_SIZE = 1000;
export const logBuffer: LogEntry[] = [];

export function initLogger() {
  if (isInitialized) return;
  isInitialized = true;
  globalForLogger.isLoggerInitialized = true;

  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;




// eslint-disable-next-line @typescript-eslint/no-explicit-any
function emitLog(type: LogType, ...args: any[]) {
    try {
      const message = args
        .map((arg) => {
          if (typeof arg === 'object') {
            try {
              const str = JSON.stringify(arg);
              // Filter empty object logs
              if (str === '{}') return '';
              return str;
            } catch {
              return String(arg);
            }
          }
          return String(arg);
        })
        .filter(msg => msg !== '') // Remove empty messages after stringify
        .join(' ');

      if (!message.trim()) return; // Don't log empty messages

      const entry: LogEntry = {
        timestamp: new Date().toISOString(),
        type,
        message,
      };

      // Add to buffer
      logBuffer.push(entry);
      if (logBuffer.length > LOG_BUFFER_SIZE) {
          logBuffer.shift();
      }

      logEmitter.emit('log', entry);
    } catch (err) {
      // Avoid infinite loops if logging fails
      originalError('Failed to capture log:', err);
    }
}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.log = (...args: any[]) => {
    emitLog('log', ...args);
    originalLog.apply(console, [new Date().toISOString(), ...args]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.error = (...args: any[]) => {
    emitLog('error', ...args);
    originalError.apply(console, [new Date().toISOString(), ...args]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.warn = (...args: any[]) => {
    emitLog('warn', ...args);
    originalWarn.apply(console, [new Date().toISOString(), ...args]);
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  console.info = (...args: any[]) => {
    emitLog('info', ...args);
    originalInfo.apply(console, [new Date().toISOString(), ...args]);
  };
}
