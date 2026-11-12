import {
  CODEX_REWARDS, EMOTES, SPECIES, ITEMS, MAX_CUSTOM_MAPS, MAX_BAIT, MAX_ROD, MAX_STONE_BUY, RODS, STONE_PRICE, STONES_PER_FISH, baitById, rodLevelOf, SECRET_EMOTES, codexRatio, itemById, sellPrice,
  speciesById,
} from "@fishing/shared";
import type { Appearance, CatchRecord, MapId, PlayerProfile } from "@fishing/shared";
import { hasBadWord } from "./chat";
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
    /** 강화 성공 판정에 쓰는 난수(시험에서 값을 고정한다) */
    public rng: () => number = Math.random,
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
    if (hasBadWord(nickname)) throw new Error("닉네임에 쓸 수 없는 말이 들어 있어요");
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

  async sell(playerId: string, ids: string[]): Promise<{ earned: number; stones: number; coins: number; totalStones: number; sold: number }> {
    const p = await this.mustProfile(playerId);
    const removed = await this.store.removeCatches(playerId, ids);
    let earned = 0, stones = 0;
    for (const c of removed) {
      const sp = speciesById(c.speciesId);
      if (!sp) continue;
      earned += sellPrice(sp, c.size, rodLevelOf(p.equipped));
      stones += STONES_PER_FISH[sp.rarity]; // 팔 때마다 등급별로 강화석을 준다
    }
    p.coins += earned;
    p.stones = (p.stones ?? 0) + stones;
    await this.store.saveProfile(p);
    return { earned, stones, coins: p.coins, totalStones: p.stones, sold: removed.length };
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
  /** 낚싯대 강화 1회: 강화석과 코인을 쓰고 확률로 한 단계 오른다(실패하면 재료와 코인만 사라진다) */
  async upgradeRod(playerId: string): Promise<{ profile: PlayerProfile; success: boolean; spent: { stones: number; coins: number } }> {
    const p = await this.mustProfile(playerId);
    const level = rodLevelOf(p.equipped);
    if (level >= MAX_ROD) throw new Error("이미 가장 좋은 낚싯대예요");
    const next = RODS[level + 1];
    p.stones ??= 0;
    if (p.stones < next.cost) throw new Error("강화석이 부족해요");
    if (p.coins < next.coins) throw new Error("돈이 부족해요");
    p.stones -= next.cost;
    p.coins -= next.coins;
    const success = this.rng() < next.rate;
    if (success) p.equipped.rod = String(next.level);
    await this.store.saveProfile(p);
    return { profile: p, success, spent: { stones: next.cost, coins: next.coins } };
  }

  /** 대장장이에게서 강화석을 코인으로 산다(한 개 STONE_PRICE) */
  async buyStones(playerId: string, count: number): Promise<PlayerProfile> {
    if (!Number.isInteger(count) || count < 1 || count > MAX_STONE_BUY) throw new Error("살 수 없는 개수예요");
    const p = await this.mustProfile(playerId);
    const cost = count * STONE_PRICE;
    if (p.coins < cost) throw new Error("돈이 부족해요");
    p.coins -= cost;
    p.stones = (p.stones ?? 0) + count;
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

  /** 신화 탈것 칸(1~4)에 잡아 본 신화 물고기를 넣거나(speciesId) 비운다(null). 입은 것(equipped)의 "mount1"~"mount4" 로 저장한다 */
  async setMount(playerId: string, slot: number, speciesId: string | null): Promise<PlayerProfile> {
    if (![1, 2, 3, 4].includes(slot)) throw new Error("탈것 칸은 1~4번이에요");
    const p = await this.mustProfile(playerId);
    if (speciesId === null) {
      delete p.equipped[`mount${slot}`];
    } else {
      const sp = SPECIES.find((q) => q.id === speciesId);
      if (!sp || sp.rarity !== "mythic") throw new Error("신화 물고기만 탈 수 있어요");
      if (!(await this.store.getCodex(playerId)).some((c) => c.speciesId === speciesId)) throw new Error("아직 잡지 못한 신화예요");
      for (const n of [1, 2, 3, 4]) if (p.equipped[`mount${n}`] === speciesId) delete p.equipped[`mount${n}`]; // 같은 신화는 한 칸에만
      p.equipped[`mount${slot}`] = speciesId;
    }
    await this.store.saveProfile(p);
    return p;
  }

  /** 개발용: 돈 5000을 준다(아이템은 상점에서 직접 산다) */
  async devGrant(playerId: string): Promise<PlayerProfile> {
    const p = await this.mustProfile(playerId);
    p.coins += 5000;
    p.stones = (p.stones ?? 0) + 500;
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
