import { boot } from "@colyseus/testing";
import type { ColyseusTestServer } from "@colyseus/testing";
import type { Room as ClientRoom } from "colyseus.js";
import { createGameServer } from "../src/index";
import { defaultDeps } from "../src/FishingRoom";
import type { RoomDeps } from "../src/FishingRoom";
import { GameService } from "../src/service";
import { MemoryStore } from "../src/store";

/** reset()으로 저장소를 갈아 끼워도 서비스가 새 저장소를 쓰게 한다 */
function proxyStore(get: () => MemoryStore): MemoryStore {
  return new Proxy({} as MemoryStore, {
    get: (_t, prop) => (get() as any)[prop].bind(get()),
  });
}

export interface Harness {
  colyseus: ColyseusTestServer;
  store: MemoryStore;
  service: GameService;
  clock: { now: number };
  rng: { next: () => number };
  /** 방을 만들고 이름으로 접속한 클라이언트들을 돌려준다 */
  open(names: string[], map?: string): Promise<{ code: string; clients: ClientRoom[] }>;
  /** 테스트 사이에 시간, 난수, 저장된 기록을 처음 상태로 돌린다 */
  reset(): void;
}

export async function startHarness(overrides: Partial<RoomDeps> = {}): Promise<Harness> {
  let store = new MemoryStore();
  const clock = { now: 0 };
  const rng = { next: () => 0 };
  const service = new GameService(proxyStore(() => store), () => clock.now);
  const deps = defaultDeps({
    service,
    authenticate: async (t) => t || null,
    rng: () => rng.next(),
    now: () => clock.now,
    waitMs: () => 20,
    biteWindowMs: 300,
    minigameTimeoutMs: 600,
    ...overrides,
  });
  const colyseus = await boot(createGameServer(deps));
  return {
    colyseus, service, clock, rng,
    get store() {
      return store;
    },
    reset() {
      store = new MemoryStore();
      clock.now = 0;
      rng.next = () => 0;
    },
    async open(names, map = "lake") {
      const room = await colyseus.createRoom("fishing", { map });
      const clients: ClientRoom[] = [];
      for (const n of names) clients.push(await colyseus.connectTo(room, { token: n }));
      // 모두의 첫 상태 동기화가 끝날 때까지 기다린다
      await until(() => clients.every((c: any) => c.state?.players?.size === names.length));
      return { code: room.roomId, clients };
    },
  };
}

export async function until(cond: () => boolean, ms = 2000): Promise<void> {
  const end = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > end) throw new Error("until: 시간 초과");
    await new Promise((r) => setTimeout(r, 10));
  }
}

export function waitMessage<T = any>(
  room: ClientRoom,
  type: string,
  when: (m: T) => boolean = () => true,
  ms = 2000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`메시지 ${type} 시간 초과`)), ms);
    room.onMessage(type, (m: T) => {
      if (!when(m)) return;
      clearTimeout(t);
      resolve(m);
    });
  });
}
