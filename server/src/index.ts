import { Server, matchMaker } from "@colyseus/core";
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
  // 방 목록: 공개이고 아직 자리가 있는 방만(꽉 차면 Colyseus가 잠가서 빠진다)
  const listRooms = async () =>
    (await matchMaker.query({ name: "fishing", private: false, locked: false })).map((r) => ({
      code: r.roomId, title: r.metadata?.title ?? "", mapId: r.metadata?.mapId ?? "lake", hostName: r.metadata?.hostName ?? "", players: r.clients, max: r.maxClients,
    }));
  const api = createApi(deps.service, deps.authenticate, validateMap, listRooms);
  // 매치메이킹 요청은 Colyseus가 처리하고, /api/ 요청만 여기서 처리한다
  (server.transport as any).server.on("request", (req: any, res: any) => {
    // Render 같은 호스팅이 "/"로 서버가 살아 있는지 확인한다. 아무도 답하지 않으면 멈춘 것으로 보고 접속을 끊는다
    const path = String(req.url ?? "").split("?")[0];
    if (path === "/" || path === "/health") {
      res.writeHead(200, { "Content-Type": "text/plain" });
      res.end("ok");
      return;
    }
    void api(req, res);
  });
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
  // Render 무료 서버는 바깥에서 15분간 요청이 없으면 잠든다. 서버가 자기 공개 주소로 10분마다 요청해 깨어 있게 한다(Render가 RENDER_EXTERNAL_URL을 넣어 준다)
  // shortcut: 서버가 이미 죽었거나 잠들었다면 이 타이머도 멈춘다. 그때는 외부 핑 서비스가 필요하다.
  if (env.RENDER_EXTERNAL_URL) {
    setInterval(() => void fetch(`${env.RENDER_EXTERNAL_URL}/health`).catch(() => {}), 10 * 60 * 1000);
  }
}
