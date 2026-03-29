import * as FileSystem from "expo-file-system/legacy";
import { Platform } from "react-native";

const isWeb = Platform.OS === "web";
const memoryStore: Record<string, string> = {};
const STORAGE_FILE = `${FileSystem.documentDirectory ?? ""}eyegasto-storage.json`;

export const StorageKeys = {
  USERS: "users",
  CURRENT_USER: "currentUser",
  EXPENSES: "expenses",
  APP_VERSION: "appVersion",
  DASHBOARD_PREFERENCES: "dashboardPreferences",
} as const;

class StorageService {
  private nativeCache: Record<string, string> | null = null;

  private async handleError(error: any, operation: string) {
    console.error(`Storage Error [${operation}]:`, error);
    return null;
  }

  private getWebStorage() {
    return isWeb && typeof localStorage !== "undefined" ? localStorage : null;
  }

  private async readNativeStore() {
    if (this.nativeCache) {
      return this.nativeCache;
    }

    try {
      if (!STORAGE_FILE) {
        this.nativeCache = { ...memoryStore };
        return this.nativeCache;
      }

      const fileInfo = await FileSystem.getInfoAsync(STORAGE_FILE);
      if (!fileInfo.exists) {
        this.nativeCache = {};
        return this.nativeCache;
      }

      const raw = await FileSystem.readAsStringAsync(STORAGE_FILE);
      this.nativeCache = raw ? (JSON.parse(raw) as Record<string, string>) : {};
      return this.nativeCache;
    } catch (error) {
      await this.handleError(error, "readNativeStore");
      this.nativeCache = { ...memoryStore };
      return this.nativeCache;
    }
  }

  private async writeNativeStore(store: Record<string, string>) {
    this.nativeCache = store;

    if (!STORAGE_FILE) {
      Object.assign(memoryStore, store);
      return;
    }

    await FileSystem.writeAsStringAsync(STORAGE_FILE, JSON.stringify(store));
  }

  async getItem<T>(key: string): Promise<T | null> {
    try {
      const webStorage = this.getWebStorage();
      if (webStorage) {
        const data = webStorage.getItem(key);
        return data ? (JSON.parse(data) as T) : null;
      }

      const nativeStore = await this.readNativeStore();
      const data = nativeStore[key] ?? null;
      return data ? (JSON.parse(data) as T) : null;
    } catch (error) {
      return this.handleError(error, "getItem");
    }
  }

  async setItem<T>(key: string, value: T): Promise<boolean> {
    try {
      const stringValue = JSON.stringify(value);
      const webStorage = this.getWebStorage();

      if (webStorage) {
        webStorage.setItem(key, stringValue);
        return true;
      }

      const nativeStore = await this.readNativeStore();
      await this.writeNativeStore({
        ...nativeStore,
        [key]: stringValue,
      });
      return true;
    } catch (error) {
      this.handleError(error, "setItem");
      return false;
    }
  }

  async removeItem(key: string): Promise<boolean> {
    try {
      const webStorage = this.getWebStorage();

      if (webStorage) {
        webStorage.removeItem(key);
        return true;
      }

      const nativeStore = await this.readNativeStore();
      const nextStore = { ...nativeStore };
      delete nextStore[key];
      await this.writeNativeStore(nextStore);
      return true;
    } catch (error) {
      this.handleError(error, "removeItem");
      return false;
    }
  }

  async clearAll(): Promise<boolean> {
    try {
      const webStorage = this.getWebStorage();

      if (webStorage) {
        webStorage.clear();
        return true;
      }

      this.nativeCache = {};
      if (STORAGE_FILE) {
        const fileInfo = await FileSystem.getInfoAsync(STORAGE_FILE);
        if (fileInfo.exists) {
          await FileSystem.deleteAsync(STORAGE_FILE, { idempotent: true });
        }
      }

      Object.keys(memoryStore).forEach((key) => delete memoryStore[key]);
      return true;
    } catch (error) {
      this.handleError(error, "clearAll");
      return false;
    }
  }

  async multiGet(keys: string[]): Promise<Record<string, any>> {
    try {
      const webStorage = this.getWebStorage();
      const data: Record<string, any> = {};

      if (webStorage) {
        keys.forEach((key) => {
          const value = webStorage.getItem(key);
          data[key] = value ? JSON.parse(value) : null;
        });
        return data;
      }

      const nativeStore = await this.readNativeStore();
      keys.forEach((key) => {
        const value = nativeStore[key];
        data[key] = value ? JSON.parse(value) : null;
      });
      return data;
    } catch (error) {
      this.handleError(error, "multiGet");
      return {};
    }
  }

  async multiSet(items: Record<string, any>): Promise<boolean> {
    try {
      const webStorage = this.getWebStorage();

      if (webStorage) {
        Object.entries(items).forEach(([key, value]) => {
          webStorage.setItem(key, JSON.stringify(value));
        });
        return true;
      }

      const nativeStore = await this.readNativeStore();
      const nextStore = { ...nativeStore };
      Object.entries(items).forEach(([key, value]) => {
        nextStore[key] = JSON.stringify(value);
      });
      await this.writeNativeStore(nextStore);
      return true;
    } catch (error) {
      this.handleError(error, "multiSet");
      return false;
    }
  }
}

export default new StorageService();
