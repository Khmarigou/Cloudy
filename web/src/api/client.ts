import type {
  Music,
  MusicUploadSpec,
  UserAuth,
  UserStorage,
} from "./types";

const ACCESS_KEY = "cloudy.accessToken";
const REFRESH_KEY = "cloudy.refreshToken";
const USER_KEY = "cloudy.user";

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function getAccessToken(): string | null {
  return localStorage.getItem(ACCESS_KEY);
}

export function getStoredUser(): UserAuth["user"] | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as UserAuth["user"];
  } catch {
    return null;
  }
}

export function saveSession(auth: UserAuth): void {
  localStorage.setItem(ACCESS_KEY, auth.tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, auth.tokens.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(auth.user));
}

export function clearSession(): void {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

async function parseError(response: Response): Promise<string> {
  const text = await response.text();
  if (!text) return `Request failed (${response.status})`;
  try {
    const parsed: unknown = JSON.parse(text);
    if (typeof parsed === "string") return parsed;
    if (parsed && typeof parsed === "object" && "message" in parsed) {
      const message = (parsed as { message: unknown }).message;
      if (typeof message === "string") return message;
    }
  } catch {
    return text;
  }
  return text;
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  { auth = true, parseJson = true }: { auth?: boolean; parseJson?: boolean } = {},
): Promise<T> {
  const headers = new Headers(init.headers);
  if (auth) {
    const token = getAccessToken();
    if (!token) {
      throw new ApiError(401, "Not signed in");
    }
    headers.set("Authorization", `Bearer ${token}`);
  }
  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(path, { ...init, headers });
  if (!response.ok) {
    if (response.status === 401) {
      clearSession();
    }
    throw new ApiError(response.status, await parseError(response));
  }
  if (!parseJson || response.status === 204) {
    return undefined as T;
  }
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export function logIn(username: string, password: string): Promise<UserAuth> {
  return request<UserAuth>(
    "/auth/logIn",
    {
      method: "POST",
      body: JSON.stringify({ username, password }),
    },
    { auth: false },
  );
}

export function listMusic(): Promise<Music[]> {
  return request<Music[]>("/music/ofUser");
}

export function getStorage(): Promise<UserStorage> {
  return request<UserStorage>("/users/storage");
}

export async function uploadMusic(
  file: File,
  spec: MusicUploadSpec,
  cover?: Blob,
  searchMetadata = false,
): Promise<Music> {
  const form = new FormData();
  form.append("metadata", JSON.stringify(spec));
  form.append("file", file, file.name);
  if (cover) {
    form.append("cover", cover, "cover.jpg");
  }
  const query = searchMetadata ? "?searchMetadata=true" : "";
  return request<Music>(`/music/upload${query}`, {
    method: "POST",
    body: form,
  });
}

export async function deleteMusic(ids: string[]): Promise<void> {
  await request(
    "/music",
    {
      method: "DELETE",
      body: JSON.stringify(ids),
    },
    { parseJson: false },
  );
}

export async function fetchAuthorizedBlob(path: string): Promise<string> {
  const token = getAccessToken();
  if (!token) throw new ApiError(401, "Not signed in");
  const response = await fetch(path, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new ApiError(response.status, await parseError(response));
  }
  const blob = await response.blob();
  return URL.createObjectURL(blob);
}

export function coverIdFromPath(coverPath: string): string | null {
  const prefix = "music/cover/";
  if (!coverPath.startsWith(prefix)) return null;
  const id = coverPath.slice(prefix.length);
  return id || null;
}
