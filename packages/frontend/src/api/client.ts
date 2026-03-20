const BASE_PATH = "/api/v1";

class ApiError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

interface ErrorBody {
  success: false;
  error: { code: string; message: string };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    let code = "UNKNOWN";
    let message = response.statusText;

    try {
      const body = (await response.json()) as ErrorBody;
      code = body.error.code;
      message = body.error.message;
    } catch {
      // Use defaults
    }

    throw new ApiError(response.status, code, message);
  }

  const json = (await response.json()) as { success: true; data: T };
  return json.data;
}

export async function apiGet<T>(
  path: string,
  params?: Record<string, string>,
): Promise<T> {
  const url = new URL(`${BASE_PATH}${path}`, window.location.origin);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const response = await fetch(url, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });

  return handleResponse<T>(response);
}

export async function apiPost<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_PATH}${path}`, {
    method: "POST",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(`${BASE_PATH}${path}`, {
    method: "PATCH",
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(body),
  });

  return handleResponse<T>(response);
}

export { ApiError };
