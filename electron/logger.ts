import type { LogEntry, LogLevel } from "../src/app/types/state";

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

export interface Logger {
  debug(source: string, message: string): void;
  info(source: string, message: string): void;
  warn(source: string, message: string): void;
  error(source: string, message: string): void;
  setLevel(level: LogLevel): void;
  getLevel(): LogLevel;
  entries(): LogEntry[];
  clear(): void;
}

export function createLogger(initialLevel: LogLevel = "info"): Logger {
  const logs: LogEntry[] = [];
  let currentLevel: LogLevel = LEVEL_PRIORITY[initialLevel] ? initialLevel : "info";

  function shouldLog(level: LogLevel): boolean {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
  }

  function push(level: LogLevel, source: string, message: string): void {
    if (!shouldLog(level)) {
      return;
    }

    const entry: LogEntry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
    };

    logs.unshift(entry);
    if (logs.length > 4000) {
      logs.length = 4000;
    }
  }

  return {
    debug(source, message) {
      push("debug", source, message);
    },
    info(source, message) {
      push("info", source, message);
    },
    warn(source, message) {
      push("warn", source, message);
    },
    error(source, message) {
      push("error", source, message);
    },
    setLevel(level) {
      if (LEVEL_PRIORITY[level]) {
        currentLevel = level;
      }
    },
    getLevel() {
      return currentLevel;
    },
    entries() {
      return logs.slice();
    },
    clear() {
      logs.length = 0;
    },
  };
}
