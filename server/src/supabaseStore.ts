import type { CatchRecord, CodexEntry, PlayerProfile } from "@fishing/shared";
import type { PlayerStore, StoredMap } from "./store";

/** Supabase(PostgREST)에 기록을 저장하는 저장소. 서버에서만 쓰고, 서비스 키는 절대 화면(클라이언트)에 넣지 않는다 */
export class SupabaseStore implements PlayerStore {
  constructor(
    private url: string,
    private serviceKey: string,
    private fetchImpl: typeof fetch = fetch,
  ) {}

  private async rest<T = unknown>(path: string, init: RequestInit & { prefer?: string } = {}): Promise<T> {
    const res = await this.fetchImpl(`${this.url}/rest/v1/${path}`, {
      ...init,
      headers: {
        apikey: this.serviceKey,
        Authorization: `Bearer ${this.serviceKey}`,
        "Content-Type": "application/json",
        ...(init.prefer ? { Prefer: init.prefer } : {}),
      },
    });
    if (!res.ok) throw new Error(`저장소 오류 ${res.status}: ${await res.text()}`);
    const text = await res.text();
    return (text ? JSON.parse(text) : null) as T;
  }

  private fromRow(r: any): PlayerProfile {
    return {
      id: r.id, nickname: r.nickname, appearance: r.appearance, coins: r.coins,
      ownedItems: r.owned_items, equipped: r.equipped, titles: r.titles, claimedRewards: r.claimed_rewards,
    };
  }

  async getProfile(id: string) {
    const rows = await this.rest<any[]>(`profiles?id=eq.${encodeURIComponent(id)}&select=*`);
    return rows[0] ? this.fromRow(rows[0]) : null;
  }

  async saveProfile(p: PlayerProfile) {
    await this.rest("profiles?on_conflict=id", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: JSON.stringify({
        id: p.id, nickname: p.nickname, appearance: p.appearance, coins: p.coins,
        owned_items: p.ownedItems, equipped: p.equipped, titles: p.titles, claimed_rewards: p.claimedRewards,
      }),
    });
  }

  async addCatch(playerId: string, r: CatchRecord) {
    await this.rest("catches", {
      method: "POST",
      body: JSON.stringify({ id: r.id, player_id: playerId, species_id: r.speciesId, size: r.size, caught_at: r.caughtAt, map_id: r.mapId }),
    });
    const prev = (await this.rest<any[]>(`codex?player_id=eq.${encodeURIComponent(playerId)}&species_id=eq.${r.speciesId}&select=*`))[0];
    await this.rest("codex?on_conflict=player_id,species_id", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: JSON.stringify({
        player_id: playerId, species_id: r.speciesId,
        first_caught_at: prev?.first_caught_at ?? r.caughtAt,
        max_size: Math.max(prev?.max_size ?? 0, r.size),
        count: (prev?.count ?? 0) + 1,
      }),
    });
  }

  async listCatches(playerId: string): Promise<CatchRecord[]> {
    const rows = await this.rest<any[]>(`catches?player_id=eq.${encodeURIComponent(playerId)}&select=*&order=caught_at.desc`);
    return rows.map((r) => ({ id: r.id, speciesId: r.species_id, size: r.size, caughtAt: Number(r.caught_at), mapId: r.map_id }));
  }

  async removeCatches(playerId: string, ids: string[]): Promise<CatchRecord[]> {
    if (!ids.length) return [];
    const list = ids.map((i) => `"${i.replace(/"/g, "")}"`).join(",");
    const rows = await this.rest<any[]>(`catches?player_id=eq.${encodeURIComponent(playerId)}&id=in.(${encodeURIComponent(list)})`, {
      method: "DELETE",
      prefer: "return=representation",
    });
    return (rows ?? []).map((r) => ({ id: r.id, speciesId: r.species_id, size: r.size, caughtAt: Number(r.caught_at), mapId: r.map_id }));
  }

  async getCodex(playerId: string): Promise<CodexEntry[]> {
    const rows = await this.rest<any[]>(`codex?player_id=eq.${encodeURIComponent(playerId)}&select=*`);
    return rows.map((r) => ({ speciesId: r.species_id, firstCaughtAt: Number(r.first_caught_at), maxSize: r.max_size, count: r.count }));
  }

  async listCustomMaps(playerId: string): Promise<StoredMap[]> {
    const rows = await this.rest<any[]>(`custom_maps?player_id=eq.${encodeURIComponent(playerId)}&select=*`);
    return rows.map((r) => ({ id: r.id, name: r.name, data: r.data }));
  }

  async saveCustomMap(playerId: string, m: StoredMap) {
    await this.rest("custom_maps?on_conflict=player_id,id", {
      method: "POST",
      prefer: "resolution=merge-duplicates",
      body: JSON.stringify({ player_id: playerId, id: m.id, name: m.name, data: m.data }),
    });
  }
}
