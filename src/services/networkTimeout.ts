export const NETWORK_TIMEOUT_MS = 3500;

export class NetworkTimeoutError extends Error {
  constructor(message = "Network request timed out") {
    super(message);
    this.name = "NetworkTimeoutError";
  }
}

export const withNetworkTimeout = <T>(
  operation: PromiseLike<T>,
  timeoutMs = NETWORK_TIMEOUT_MS,
): Promise<T> => {
  return Promise.race([
    Promise.resolve(operation),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new NetworkTimeoutError()), timeoutMs);
    }),
  ]);
};

export const isOfflineLikeError = (error: unknown) => {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  return (
    error instanceof NetworkTimeoutError ||
    message.includes("network request failed") ||
    message.includes("failed to fetch") ||
    message.includes("networkerror") ||
    message.includes("offline") ||
    message.includes("timed out")
  );
};
