import { error as logToFile } from "@tauri-apps/plugin-log";

export function logError(message: string, cause?: unknown): void {
  if (cause !== undefined) {
    console.error(message, cause);
  } else {
    console.error(message);
  }

  const payload = cause === undefined ? message : `${message} | ${formatCause(cause)}`;
  void logToFile(payload).catch(() => {
    // Swallow: writing the log itself failed; the devtools console already
    // shows the original error, and recursing here would risk a loop.
  });
}

function formatCause(cause: unknown): string {
  if (cause instanceof Error) {
    return cause.stack ?? `${cause.name}: ${cause.message}`;
  }
  if (typeof cause === "string") {
    return cause;
  }
  try {
    return JSON.stringify(cause);
  } catch {
    return String(cause);
  }
}
