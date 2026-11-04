// 카카오 로그인은 Supabase 인증(OAuth)을 쓴다. 키가 없으면 개발용 로그인만 동작한다.
// VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY 가 설정되면 카카오 로그인 버튼이 켜진다.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const kakaoConfigured = Boolean(url && key);

async function client() {
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url!, key!);
}

export async function kakaoLogin() {
  const supabase = await client();
  await supabase.auth.signInWithOAuth({
    provider: "kakao",
    // 카카오에서는 고유 번호만 쓰도록 닉네임, 이메일 동의 항목은 요청하지 않는다
    options: { redirectTo: location.href, scopes: "" },
  });
}

/** 카카오 로그인에서 돌아왔거나 이미 로그인한 상태면 서버에 보낼 토큰을 돌려준다 */
export async function kakaoSession(): Promise<string | null> {
  if (!kakaoConfigured) return null;
  const supabase = await client();
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token ? `sb:${data.session.access_token}` : null;
}
