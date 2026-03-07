const LEVEL_PRIORITY = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

function createLogger(initialLevel = "info") {
  const logs = [];
  let currentLevel = LEVEL_PRIORITY[initialLevel] ? initialLevel : "info";

  function shouldLog(level) {
    return LEVEL_PRIORITY[level] >= LEVEL_PRIORITY[currentLevel];
  }

  function push(level, source, message) {
    if (!shouldLog(level)) {
      return;
    }

    const entry = {
      id: `${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      timestamp: new Date().toISOString(),
      level,
      source,
      message,
    };

    logs.unshift(entry);
    if (logs.length > 2000) {
      logs.length = 2000;
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
  };
}

module.exports = {
  createLogger,
};