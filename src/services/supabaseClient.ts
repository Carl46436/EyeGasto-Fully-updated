import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";
import { Platform } from "react-native";
import storageService, { StorageKeys } from "./storageService";

const EXPO_PUBLIC_SUPABASE_URL =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  (Constants.expoConfig?.extra as any)?.SUPABASE_URL;

const EXPO_PUBLIC_SUPABASE_ANON_KEY =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  (Constants.expoConfig?.extra as any)?.SUPABASE_ANON_KEY;

const isExpoGo = Constants.appOwnership === "expo";

// ensure the required values are available before attempting to create the client
if (!EXPO_PUBLIC_SUPABASE_URL || !EXPO_PUBLIC_SUPABASE_ANON_KEY) {
  const message =
    "[Supabase] Missing SUPABASE_URL or SUPABASE_ANON_KEY. " +
    "Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in your env or app.json `extra`." +
    " See README for details.";
  // log a warning so devs see it in console, then throw so the error is obvious
  console.warn(message);
  throw new Error(message);
}

export const supabase = createClient(
  EXPO_PUBLIC_SUPABASE_URL,
  EXPO_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      storage: {
        getItem: (key) => {
          if (isExpoGo && key === StorageKeys.SUPABASE_SESSION) {
            return null;
          }

          return storageService.getItem<string>(key);
        },
        setItem: async (key, value) => {
          if (isExpoGo && key === StorageKeys.SUPABASE_SESSION) {
            return;
          }

          await storageService.setItem(key, value);
        },
        removeItem: async (key) => {
          if (isExpoGo && key === StorageKeys.SUPABASE_SESSION) {
            return;
          }

          await storageService.removeItem(key);
        },
      },
      storageKey: StorageKeys.SUPABASE_SESSION,
      persistSession: !isExpoGo,
      autoRefreshToken: Platform.OS !== "web" && !isExpoGo,
      detectSessionInUrl: false,
    },
  },
);
