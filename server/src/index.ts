import { Server } from "@colyseus/core";
import { WebSocketTransport } from "@colyseus/ws-transport";
import { createApi } from "./api";
import { createAuthenticator } from "./auth";
import { createFishingRoom, defaultDeps } from "./FishingRoom";
import { GameService } from "./service";
import { MemoryStore } from "./store";
import type { PlayerStore } from "./store";
import { SupabaseStore } from "./supabaseStore";

type Deps = ReturnType<typeof defaultDeps>;

export function createGameServer(deps: Deps, validateMap: (data: unknown) => string | null = () => null) {
  const server = new Server({ transport: new WebSocketTransport() });
  server.define("fishing", createFishingRoom(deps));
  const api = createApi(deps.service, deps.authenticate, validateMap);
  // 매치메이킹 요청은 Colyseus가 처리하고, /api/ 요청만 여기서 처리한다
  (server.transport as any).server.on("request", (req: any, res: any) => void api(req, res));
  return server;
}

/** 환경 변수에 Supabase 키가 있으면 거기에 저장하고, 없으면 메모리에만 저장한다(서버를 끄면 사라진다) */
function storeFromEnv(env: NodeJS.ProcessEnv): PlayerStore {
  if (env.SUPABASE_URL && env.SUPABASE_SERVICE_KEY) {
    console.log("기록을 Supabase에 저장해요");
    return new SupabaseStore(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY);
  }
  console.warn("Supabase 키가 없어서 메모리에만 저장해요. 서버를 끄면 기록이 사라져요.");
  return new MemoryStore();
}

if (process.argv[1]?.endsWith("index.ts")) {
  const env = process.env;
  const service = new GameService(storeFromEnv(env));
  const authenticate = createAuthenticator(env);
  if (!(env.SUPABASE_URL && env.SUPABASE_ANON_KEY)) console.warn("카카오 로그인(Supabase) 설정이 없어서 개발용 로그인만 돼요.");
  if (env.ALLOW_DEV_LOGIN === "false" && !env.SUPABASE_URL) console.error("개발용 로그인을 껐는데 Supabase 설정도 없어서 아무도 접속할 수 없어요.");
  const server = createGameServer(defaultDeps({ service, authenticate }));
  const port = Number(env.PORT ?? 2567);
  server.listen(port).then(() => console.log(`game server on ${port}`));
}
