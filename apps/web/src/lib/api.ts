import { auth } from "./firebase";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface RequestOptions extends RequestInit {
  organizationId?: string | undefined;
}

async function getAuthHeaders(
  organizationId?: string
): Promise<Record<string, string>> {
  const user = auth.currentUser;
  if (!user) return {};

  const token = await user.getIdToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  if (organizationId) {
    headers["X-Organization-Id"] = organizationId;
  }

  return headers;
}

async function request<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { organizationId, ...fetchOptions } = options;
  const headers = await getAuthHeaders(organizationId);

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers: { ...headers, ...fetchOptions.headers },
  });

  const json = await res.json() as { success: boolean; data?: T; error?: string };

  if (!res.ok || !json.success) {
    throw new ApiError(json.error ?? "Request failed", res.status);
  }

  return json.data as T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: "GET", ...options }),

  post: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: "POST",
      body: JSON.stringify(body),
      ...options,
    }),

  put: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: "PUT",
      body: JSON.stringify(body),
      ...options,
    }),

  patch: <T>(path: string, body: unknown, options?: RequestOptions) =>
    request<T>(path, {
      method: "PATCH",
      body: JSON.stringify(body),
      ...options,
    }),

  delete: <T>(path: string, options?: RequestOptions) =>
    request<T>(path, { method: "DELETE", ...options }),
};
