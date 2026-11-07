import type { IncomingMessage, ServerResponse } from "node:http";
import type { GameService } from "./service";

type Handler = (userId: string, body: any) => Promise<unknown>;

/** 방 밖(로비)에서 쓰는 HTTP 요청: 프로필, 인벤토리, 도감, 상점, 캐릭터 */
export function createApi(
  service: GameService,
  authenticate: (token: string) => Promise<string | null>,
  validateMap: (data: unknown) => string | null,
) {
  const routes: Record<string, Handler> = {
    "GET /api/me": (id) => service.ensureProfile(id),
    "POST /api/character": (id, b) => service.setCharacter(id, b.nickname, b.appearance),
    "GET /api/inventory": (id) => service.inventory(id),
    "GET /api/codex": (id) => service.codex(id),
    "GET /api/shop": async () => service.shop(),
    "POST /api/sell": (id, b) => service.sell(id, Array.isArray(b.ids) ? b.ids : []),
    "POST /api/buy": (id, b) => service.buy(id, b.itemId),
    "POST /api/equip": (id, b) => service.equip(id, b.slot, b.itemId ?? null),
    // 개발용 로그인 계정만: 돈을 받아 상점에서 직접 사 보게 한다(배포에서는 개발용 로그인이 꺼져 있다)
    "POST /api/dev/grant": async (id) => {
      if (!id.startsWith("dev:")) throw new Error("개발용 계정만 쓸 수 있어요");
      return service.devGrant(id);
    },
    "GET /api/maps": (id) => service.customMaps(id),
    "POST /api/maps": async (id, b) => {
      await service.saveCustomMap(id, { id: String(b.id), name: String(b.name ?? "내 맵"), data: b.data }, validateMap);
      return { ok: true };
    },
  };

  const send = (res: ServerResponse, status: number, body: unknown) => {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify(body));
  };

  /** 처리했으면 true. /api/ 가 아닌 요청은 건드리지 않는다(매치메이킹 등) */
  return async function handle(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
    const url = req.url ?? "";
    if (!url.startsWith("/api/")) return false;
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") {
      res.writeHead(204).end();
      return true;
    }
    const route = routes[`${req.method} ${url.split("?")[0]}`];
    if (!route) return send(res, 404, { error: "없는 주소예요" }), true;
    const token = (req.headers.authorization ?? "").replace(/^Bearer\s+/i, "");
    const userId = token ? await authenticate(token) : null;
    if (!userId) return send(res, 401, { error: "로그인이 필요해요" }), true;
    try {
      let body: any = {};
      if (req.method === "POST") {
        const chunks: Buffer[] = [];
        for await (const c of req) chunks.push(c as Buffer);
        body = chunks.length ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {};
      }
      send(res, 200, await route(userId, body));
    } catch (e) {
      send(res, 400, { error: e instanceof Error ? e.message : "요청을 처리하지 못했어요" });
    }
    return true;
  };
}
