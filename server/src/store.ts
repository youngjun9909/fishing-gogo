import type { Appearance, CatchRecord, CodexEntry, PlayerProfile } from "@fishing/shared";
import { STARTING_COINS } from "@fishing/shared";

/** 저장소 계약: 시험용 메모리 구현과 Supabase 구현이 같은 모양을 따른다 */
export interface PlayerStore {
  getProfile(id: string): Promise<PlayerProfile | null>;
  saveProfile(profile: PlayerProfile): Promise<void>;
  addCatch(playerId: string, record: CatchRecord): Promise<void>;
  listCatches(playerId: string): Promise<CatchRecord[]>;
  /** 지운 기록을 돌려준다. 내 물고기가 아닌 id는 무시한다 */
  removeCatches(playerId: string, ids: string[]): Promise<CatchRecord[]>;
  getCodex(playerId: string): Promise<CodexEntry[]>;
  listCustomMaps(playerId: string): Promise<StoredMap[]>;
  saveCustomMap(playerId: string, map: StoredMap): Promise<void>;
}

export interface StoredMap {
  id: string;
  name: string;
  data: unknown;
}

export const DEFAULT_APPEARANCE: Appearance = {
  eyes: 0, nose: 0, mouth: 0, hair: 0, skinColor: 0, hairColor: 0, eyeColor: 0, body: 0,
};

export function newProfile(id: string, nickname: string, appearance = DEFAULT_APPEARANCE): PlayerProfile {
  return {
    id,
    nickname,
    appearance,
    coins: STARTING_COINS,
    ownedItems: [],
    equipped: {},
    titles: [],
    claimedRewards: [],
  };
}

export class MemoryStore implements PlayerStore {
  private profiles = new Map<string, PlayerProfile>();
  private catches = new Map<string, CatchRecord[]>();
  private codex = new Map<string, Map<string, CodexEntry>>();
  private maps = new Map<string, StoredMap[]>();

  async getProfile(id: string) {
    const p = this.profiles.get(id);
    return p ? structuredClone(p) : null;
  }

  async saveProfile(profile: PlayerProfile) {
    this.profiles.set(profile.id, structuredClone(profile));
  }

  async addCatch(playerId: string, record: CatchRecord) {
    const list = this.catches.get(playerId) ?? [];
    list.push(record);
    this.catches.set(playerId, list);

    const codex = this.codex.get(playerId) ?? new Map();
    const prev = codex.get(record.speciesId);
    codex.set(record.speciesId, {
      speciesId: record.speciesId,
      firstCaughtAt: prev?.firstCaughtAt ?? record.caughtAt,
      maxSize: Math.max(prev?.maxSize ?? 0, record.size),
      count: (prev?.count ?? 0) + 1,
    });
    this.codex.set(playerId, codex);
  }

  async listCatches(playerId: string) {
    return structuredClone(this.catches.get(playerId) ?? []);
  }

  async removeCatches(playerId: string, ids: string[]) {
    const list = this.catches.get(playerId) ?? [];
    const wanted = new Set(ids);
    const removed = list.filter((c) => wanted.has(c.id));
    this.catches.set(playerId, list.filter((c) => !wanted.has(c.id)));
    return removed;
  }

  async getCodex(playerId: string) {
    return structuredClone([...(this.codex.get(playerId)?.values() ?? [])]);
  }

  async listCustomMaps(playerId: string) {
    return structuredClone(this.maps.get(playerId) ?? []);
  }

  async saveCustomMap(playerId: string, map: StoredMap) {
    const list = this.maps.get(playerId) ?? [];
    const i = list.findIndex((m) => m.id === map.id);
    if (i >= 0) list[i] = structuredClone(map);
    else list.push(structuredClone(map));
    this.maps.set(playerId, list);
  }
}
