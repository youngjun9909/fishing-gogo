/** 접속 토큰을 확인해서 사용자 번호를 돌려준다. 확인할 수 없으면 null */
export type Authenticator = (token: string) => Promise<string | null>;

export interface AuthEnv {
  SUPABASE_URL?: string;
  SUPABASE_ANON_KEY?: string;
  /** 개발용 로그인(dev:아이디)을 허용할지. 배포에서는 "false"로 끈다 */
  ALLOW_DEV_LOGIN?: string;
}

/**
 * - `sb:<토큰>`: 카카오 로그인 뒤 Supabase가 발급한 토큰. Supabase에 물어서 사용자 번호를 받는다.
 * - `dev:<아이디>`: 개발용. ALLOW_DEV_LOGIN이 "false"이면 거절한다.
 */
export function createAuthenticator(env: AuthEnv, fetchImpl: typeof fetch = fetch): Authenticator {
  const devAllowed = env.ALLOW_DEV_LOGIN !== "false";
  return async (token) => {
    if (token.startsWith("dev:")) {
      const id = token.slice(4).trim();
      return devAllowed && id.length > 0 && id.length <= 40 ? `dev:${id}` : null;
    }
    if (token.startsWith("sb:") && env.SUPABASE_URL && env.SUPABASE_ANON_KEY) {
      try {
        const res = await fetchImpl(`${env.SUPABASE_URL}/auth/v1/user`, {
          headers: { apikey: env.SUPABASE_ANON_KEY, Authorization: `Bearer ${token.slice(3)}` },
        });
        if (!res.ok) return null;
        const user = (await res.json()) as { id?: string };
        return user.id ? `sb:${user.id}` : null;
      } catch {
        return null;
      }
    }
    return null;
  };
}
