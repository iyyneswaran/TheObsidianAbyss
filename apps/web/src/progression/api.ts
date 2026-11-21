import { apiUrl } from "../endpoints";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(path: string, body?: object): Promise<T> {
  const response = await fetch(apiUrl(path), {
    credentials: "include",
    signal: AbortSignal.timeout(10000),
    ...(body
      ? {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      : {}),
  });
  if (!response.ok) {
    const data = (await response.json().catch(() => undefined)) as
      { error?: string } | undefined;
    throw new ApiError(
      data?.error ?? "Progression is unavailable.",
      response.status,
    );
  }
  return (response.status === 204 ? undefined : await response.json()) as T;
}

let guest: Promise<unknown> | undefined;
export async function progression<T>(path: string): Promise<T> {
  try {
    return await api<T>(path);
  } catch (error) {
    if (!(error instanceof ApiError) || error.status !== 401) throw error;
    guest ??= api("/session/guest", {}).finally(() => {
      guest = undefined;
    });
    await guest;
    return api<T>(path);
  }
}
