import { showToast, Toast } from "@raycast/api";

export class CaptureError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown,
  ) {
    super(message);
    this.name = "CaptureError";
  }
}

export async function handleError(error: unknown, title = "Operation Failed") {
  console.error(title, error);

  const message = error instanceof Error ? error.message : String(error);
  await showToast({
    style: Toast.Style.Failure,
    title,
    message,
  });
}

export async function withErrorHandling<T>(operation: () => Promise<T>, errorTitle: string): Promise<T | null> {
  try {
    return await operation();
  } catch (error) {
    await handleError(error, errorTitle);
    return null;
  }
}

export function isError(error: unknown): error is Error {
  return error instanceof Error;
}
