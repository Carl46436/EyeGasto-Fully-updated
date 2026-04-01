import { Platform } from "react-native";

export type AuthRedirectPayload = {
  accessToken?: string;
  refreshToken?: string;
  tokenHash?: string;
  code?: string;
  type?: string;
};

const parseSearchParams = (input: string) => {
  const params = new URLSearchParams(input);

  return {
    accessToken: params.get("access_token") ?? undefined,
    refreshToken: params.get("refresh_token") ?? undefined,
    tokenHash: params.get("token_hash") ?? undefined,
    code: params.get("code") ?? undefined,
    type: params.get("type") ?? undefined,
  } satisfies AuthRedirectPayload;
};

export const buildAuthRedirectUrl = (path: string) => {
  if (Platform.OS === "web" && typeof window !== "undefined") {
    return window.location.origin;
  }

  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `expensetracker:/${normalizedPath}`;
};

export const getRecommendedAuthRedirects = () => ({
  webSiteUrl: "http://localhost:8081",
  webRedirects: ["http://localhost:8081", "http://localhost:8081/**"],
  mobileRedirects: [
    "expensetracker://auth/callback",
    "expensetracker://reset-password",
  ],
});

export const parseAuthRedirectUrl = (url: string): AuthRedirectPayload => {
  const hashIndex = url.indexOf("#");
  if (hashIndex >= 0) {
    const hashParams = parseSearchParams(url.slice(hashIndex + 1));
    if (
      hashParams.accessToken ||
      hashParams.refreshToken ||
      hashParams.tokenHash ||
      hashParams.code ||
      hashParams.type
    ) {
      return hashParams;
    }
  }

  const queryIndex = url.indexOf("?");
  if (queryIndex >= 0) {
    return parseSearchParams(url.slice(queryIndex + 1));
  }

  return {};
};
