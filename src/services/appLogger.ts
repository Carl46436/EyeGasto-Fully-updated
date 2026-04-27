import storageService, { StorageKeys } from "./storageService";

type LogLevel = "info" | "warn" | "error";

interface AppLogEntry {
  id: string;
  event: string;
  level: LogLevel;
  details?: Record<string, unknown>;
  createdAt: string;
}

const MAX_LOG_ENTRIES = 80;

class AppLogger {
  async log(
    event: string,
    level: LogLevel = "info",
    details?: Record<string, unknown>,
  ) {
    const entry: AppLogEntry = {
      id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      event,
      level,
      details,
      createdAt: new Date().toISOString(),
    };

    if (level === "error") {
      console.error(`[EyeGasto:${event}]`, details ?? {});
    } else if (level === "warn") {
      console.warn(`[EyeGasto:${event}]`, details ?? {});
    } else {
      console.info(`[EyeGasto:${event}]`, details ?? {});
    }

    const logs = (await storageService.getItem<AppLogEntry[]>(StorageKeys.APP_LOGS)) ?? [];
    const next = [entry, ...logs].slice(0, MAX_LOG_ENTRIES);
    await storageService.setItem(StorageKeys.APP_LOGS, next);
  }
}

export default new AppLogger();
