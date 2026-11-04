import { describe, expect, it } from "vitest";
import { createAuthenticator } from "../src/auth";

const fakeFetch = (user: unknown, ok = true) => (async () => ({ ok, json: async () => user })) as unknown as typeof fetch;

describe("로그인 토큰 확인", () => {
  it("개발용 토큰은 허용되고, 끄면 거절된다", async () => {
    expect(await createAuthenticator({})("dev:alice")).toBe("dev:alice");
    expect(await createAuthenticator({ ALLOW_DEV_LOGIN: "false" })("dev:alice")).toBeNull();
    expect(await createAuthenticator({})("dev:")).toBeNull();
  });

  it("Supabase 토큰은 Supabase가 알려 준 사용자 번호로 바뀐다", async () => {
    const env = { SUPABASE_URL: "https://x.supabase.co", SUPABASE_ANON_KEY: "anon" };
    expect(await createAuthenticator(env, fakeFetch({ id: "u-1" }))("sb:abc")).toBe("sb:u-1");
    expect(await createAuthenticator(env, fakeFetch({}, false))("sb:abc")).toBeNull();
  });

  it("설정이 없거나 알 수 없는 토큰은 거절된다", async () => {
    expect(await createAuthenticator({})("sb:abc")).toBeNull();
    expect(await createAuthenticator({})("아무거나")).toBeNull();
  });
});
