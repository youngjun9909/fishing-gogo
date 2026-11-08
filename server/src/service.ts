import {
  CODEX_REWARDS, EMOTES, ITEMS, MAX_CUSTOM_MAPS, MAX_BAIT, MAX_ROD, RODS, baitById, rodLevelOf, SECRET_EMOTES, codexRatio, itemById, sellPrice,
  speciesById,
} from "@fishing/shared";
import type { Appearance, CatchRecord, MapId, PlayerProfile } from "@fishing/shared";
import { DEFAULT_APPEARANCE, newProfile } from "./store";
import type { PlayerStore, StoredMap } from "./store";

const LIMITS: Record<keyof Appearance, number> = {
  eyes: 10, nose: 6, mouth: 8, hair: 15, skinColor: 12, hairColor: 12, eyeColor: 12, body: 3, gender: 2,
};

export function validAppearance(a: unknown): a is Appearance {
  if (!a || typeof a !== "object") return false;
  return (Object.keys(LIMITS) as (keyof Appearance)[]).every((k) => {
    const v = (a as Record<string, unknown>)[k];
    if (k === "gender" && v === undefined) return true;
    return Number.isInteger(v) && (v as number) >= 0 && (v as number) < LIMITS[k];
  });
}

export function validNickname(n: unknown): n is string {
  return typeof n === "string" && n.trim().length >= 1 && n.trim().length <= 10;
}

export class GameService {
  constructor(
    private store: PlayerStore,
    private now: () => number = Date.now,
    private newId: () => string = () => crypto.randomUUID(),
  ) {}

  async profile(id: string): Promise<PlayerProfile | null> {
    return this.store.getProfile(id);
  }

  /** 처음 로그인하면 기본 캐릭터로 만든다 */
  async ensureProfile(id: string, nickname = "낚시꾼"): Promise<PlayerProfile> {
    const existing = await this.store.getProfile(id);
    if (existing) return existing;
    const created = newProfile(id, nickname, DEFAULT_APPEARANCE);
    await this.store.saveProfile(created);
    return created;
  }

  async setCharacter(id: string, nickname: string, appearance: Appearance): Promise<PlayerProfile> {
    if (!validNickname(nickname)) throw new Error("닉네임은 1~10자로 정해 주세요");
    if (!validAppearance(appearance)) throw new Error("캐릭터 모양이 올바르지 않아요");
    const p = await this.ensureProfile(id);
    p.nickname = nickname.trim();
    p.appearance = appearance;
    await this.store.saveProfile(p);
    return p;
  }

  /** 낚은 물고기를 바로 저장하고, 도감 보상이 새로 열렸는지 확인한다 */
  async recordCatch(playerId: string, speciesId: string, size: number, mapId: MapId) {
    const record: CatchRecord = {
      id: this.newId(), speciesId, size, caughtAt: this.now(), mapId,
    };
    const before = (await this.store.getCodex(playerId)).find((c) => c.speciesId === speciesId);
    await this.store.addCatch(playerId, record);
    const rewards = await this.claimRewards(playerId);
    return { record, rewards, isNew: !before, isRecord: !!before && size > before.maxSize };
  }

  async inventory(playerId: string) {
    return this.store.listCatches(playerId);
  }

  async codex(playerId: string) {
    return this.store.getCodex(playerId);
  }

  async sell(playerId: string, ids: string[]): Promise<{ earned: number; coins: number; sold: number }> {
    const p = await this.mustProfile(playerId);
    const removed = await this.store.removeCatches(playerId, ids);
    let earned = 0;
    for (const c of removed) {
      const sp = speciesById(c.speciesId);
      if (sp) earned += sellPrice(sp, c.size);
    }
    p.coins += earned;
    await this.store.saveProfile(p);
    return { earned, coins: p.coins, sold: removed.length };
  }

  shop() {
    return ITEMS.filter((i) => i.purchasable);
  }

  async buy(playerId: string, itemId: string): Promise<PlayerProfile> {
    const item = itemById(itemId);
    if (!item || !item.purchasable) throw new Error("살 수 없는 아이템이에요");
    const p = await this.mustProfile(playerId);
    if (p.ownedItems.includes(itemId)) throw new Error("이미 가지고 있어요");
    if (p.coins < item.price) throw new Error("돈이 부족해요");
    p.coins -= item.price;
    p.ownedItems.push(itemId);
    await this.store.saveProfile(p);
    return p;
  }

  /** 낚싯대를 한 단계 올린다. 단계는 입은 것(equipped)의 "rod" 값으로 저장한다 */
  async upgradeRod(playerId: string): Promise<PlayerProfile> {
    const p = await this.mustProfile(playerId);
    const level = rodLevelOf(p.equipped);
    if (level >= MAX_ROD) throw new Error("이미 가장 좋은 낚싯대예요");
    const next = RODS[level + 1];
    if (p.coins < next.price) throw new Error("돈이 부족해요");
    p.coins -= next.price;
    p.equipped.rod = String(next.level);
    await this.store.saveProfile(p);
    return p;
  }

  /** 미끼 한 묶음을 산다. 처음 사면 그 미끼를 바로 쓰도록 골라 둔다 */
  async buyBait(playerId: string, baitId: string): Promise<PlayerProfile> {
    const b = baitById(baitId);
    if (!b) throw new Error("없는 미끼예요");
    const p = await this.mustProfile(playerId);
    p.baits ??= {};
    const have = p.baits[b.id] ?? 0;
    if (have + b.pack > MAX_BAIT) throw new Error(`미끼는 ${MAX_BAIT}개까지 가질 수 있어요`);
    if (p.coins < b.price) throw new Error("돈이 부족해요");
    p.coins -= b.price;
    p.baits[b.id] = have + b.pack;
    await this.store.saveProfile(p);
    return p;
  }

  /** 던질 때 고른 미끼 1개를 쓴다. 가진 게 없으면 id가 null */
  async consumeBait(playerId: string, baitId: string): Promise<{ id: string | null; left: number }> {
    const p = await this.store.getProfile(playerId);
    const have = p?.baits?.[baitId] ?? 0;
    if (!p || !baitById(baitId) || have <= 0) return { id: null, left: 0 };
    p.baits = { ...p.baits, [baitId]: have - 1 };
    await this.store.saveProfile(p);
    return { id: baitId, left: have - 1 };
  }

  async equip(playerId: string, slot: string, itemId: string | null): Promise<PlayerProfile> {
    if (slot === "rod") throw new Error("낚싯대는 강화로만 바꿀 수 있어요");
    const p = await this.mustProfile(playerId);
    if (itemId === null) {
      delete p.equipped[slot];
    } else {
      const item = itemById(itemId);
      if (!item || item.slot !== slot) throw new Error("이 칸에 입을 수 없어요");
      if (!p.ownedItems.includes(itemId)) throw new Error("가지고 있지 않아요");
      p.equipped[slot] = itemId;
    }
    await this.store.saveProfile(p);
    return p;
  }

  /** 개발용: 돈 5000을 준다(아이템은 상점에서 직접 산다) */
  async devGrant(playerId: string): Promise<PlayerProfile> {
    const p = await this.mustProfile(playerId);
    p.coins += 5000;
    await this.store.saveProfile(p);
    return p;
  }

  canUseEmote(profile: PlayerProfile, emote: string): boolean {
    if ((EMOTES as readonly string[]).includes(emote)) return true;
    return (SECRET_EMOTES as readonly string[]).includes(emote) && profile.claimedRewards.includes("all-100");
  }

  /** 도감 완성도를 확인해 아직 받지 않은 보상을 지급한다 */
  async claimRewards(playerId: string) {
    const p = await this.mustProfile(playerId);
    const caught = new Set((await this.store.getCodex(playerId)).map((c) => c.speciesId));
    const given = [];
    for (const r of CODEX_REWARDS) {
      if (p.claimedRewards.includes(r.id)) continue;
      if (codexRatio(r.mapId, caught) < r.ratio) continue;
      p.claimedRewards.push(r.id);
      if (r.title) p.titles.push(r.title);
      if (r.coins) p.coins += r.coins;
      for (const it of r.items ?? []) if (!p.ownedItems.includes(it)) p.ownedItems.push(it);
      given.push(r);
    }
    if (given.length) await this.store.saveProfile(p);
    return given;
  }

  async saveCustomMap(playerId: string, map: StoredMap, validate: (data: unknown) => string | null) {
    const err = validate(map.data);
    if (err) throw new Error(err);
    const existing = await this.store.listCustomMaps(playerId);
    if (!existing.some((m) => m.id === map.id) && existing.length >= MAX_CUSTOM_MAPS) {
      throw new Error(`맵은 ${MAX_CUSTOM_MAPS}개까지 저장할 수 있어요`);
    }
    await this.store.saveCustomMap(playerId, map);
  }

  customMaps(playerId: string) {
    return this.store.listCustomMaps(playerId);
  }

  private async mustProfile(id: string): Promise<PlayerProfile> {
    const p = await this.store.getProfile(id);
    if (!p) throw new Error("프로필이 없어요");
    return p;
  }
}
