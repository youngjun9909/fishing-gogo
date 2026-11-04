import { Client } from "colyseus.js";

const host = import.meta.env.VITE_SERVER_URL ?? `${location.protocol}//${location.hostname}:2567`;
export const SERVER_HTTP: string = host;
export const colyseus = new Client(host);

const TOKEN_KEY = "fishing.token";

export const auth = {
  get token(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set token(v: string | null) {
    try {
      if (v) localStorage.setItem(TOKEN_KEY, v);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // 저장소를 못 쓰는 환경이면 이번 접속에서만 유지된다
    }
  },
};

export async function api<T = any>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${SERVER_HTTP}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${auth.token ?? ""}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "요청을 처리하지 못했어요");
  return json as T;
}

/** 초대 링크: 주소에 방 코드를 담는다 */
export function inviteLink(code: string) {
  return `${location.origin}${location.pathname}?room=${code}`;
}

export function roomFromUrl(): string | null {
  return new URLSearchParams(location.search).get("room")?.toUpperCase() ?? null;
}
