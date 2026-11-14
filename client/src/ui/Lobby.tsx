import { useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { BAITS, BASE_MAPS, CODEX_REWARDS, ITEMS, MAX_ROD, ROD_SELL_BONUS, RODS, SPECIES, STONES_PER_FISH, UW_FISH, UW_ZONE_NAMES, codexSpeciesFor, itemById, rodEffects, rodLevelOf, sellPrice, speciesById } from "@fishing/shared";
import type { Appearance, CatchRecord, CodexEntry, MapId, PlayerProfile, ShopItem } from "@fishing/shared";
import { getAudio, setMuted, setVolume, sfx } from "../audio";
import { api, auth } from "../net";
import { CharacterRig, EYE, HAIR } from "../three/character";
import type { Look } from "../three/character";
import { LobbyScene } from "../three/LobbyScene";
import { buildBait } from "../three/baits";
import { buildRod } from "../three/rods";
import { buildHarpoonGun } from "../three/uwProps";
import { FishIcon, RARITY_COLOR, RARITY_LABEL } from "./FishIcon";

type Modal = null | "create" | "rooms" | "join" | "inventory" | "codex" | "mounts" | "shop" | "settings";

const MAP_INFO: Record<MapId, { emoji: string; desc: string }> = {
  lake: { emoji: "🌳", desc: "잔잔한 물가에서 느긋하게. 처음 시작하기 좋아요." },
  pier: { emoji: "⚓", desc: "바다로 길게 뻗은 부두. 큰 물고기가 숨어 있어요." },
  ice: { emoji: "❄️", desc: "눈 덮인 숲속 차가운 호수. 얼음 조각이 둥둥 떠 있어요." },
  cruise: { emoji: "🚢", desc: "망망대해를 가르는 크루즈선. 밤에는 갑판에서 파티가 열려요." },
};

export function Lobby(props: {
  profile: PlayerProfile;
  reload: () => Promise<void>;
  onCreate: (map: string, title: string, isPublic: boolean) => void;
  onJoin: (code: string) => void;
  onLogout: () => void;
  error: string;
}) {
  const { profile } = props;
  const stageRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<LobbyScene | null>(null);
  const [modal, setModal] = useState<Modal>(null);
  const [creating, setCreating] = useState(profile.nickname === "낚시꾼" && profile.titles.length === 0 && profile.claimedRewards.length === 0);

  const look = useMemo(() => ({ appearance: profile.appearance, equipped: profile.equipped }), [profile.appearance, profile.equipped]);

  useEffect(() => {
    const scene = new LobbyScene(stageRef.current!, look);
    sceneRef.current = scene;
    return () => scene.dispose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!creating) sceneRef.current?.setLook(look); // 꾸미는 중에는 프로필을 다시 읽어도 미리보기를 덮어쓰지 않는다
  }, [look, creating]);
  useEffect(() => {
    sceneRef.current?.setCreatorMode(creating);
  }, [creating]);

  const open = (m: Modal) => {
    sfx.click();
    setModal(m);
  };

  return (
    <>
      <div className="stage" ref={stageRef} />
      <div className="overlay">
        <div className="topbar">
          <div className="who">
            <span className="panel chip">{profile.titles.at(-1) ? `🏅 ${profile.titles.at(-1)}` : "🎣 새내기 낚시꾼"}</span>
            <span className="panel chip"><b style={{ fontWeight: "normal" }}>{profile.nickname}</b></span>
            <span className="panel chip">🪙 {profile.coins.toLocaleString()}</span>
          </div>
          <button className="btn small ghost" onClick={() => open("settings")}>⚙️ 설정</button>
        </div>

        {!creating && (
          <div className="menu panel">
            <button className="btn pink wide" onClick={() => open("create")}>🎣 방 만들기</button>
            <button className="btn mint small" onClick={() => open("rooms")}>📋 방 목록</button>
            <button className="btn mint small" onClick={() => open("join")}>🔑 코드 입장</button>
            <button className="btn wide small" onClick={() => { sfx.click(); location.href = "/underwater.html"; }}>🌊 수중 탐험</button>
            {/* 자주 안 누르는 것들은 작은 그림 단추 한 줄로 모은다 */}
            <div className="tiles">
              <button className="btn tile" onClick={() => open("inventory")}><span>🎒</span>가방</button>
              <button className="btn tile" onClick={() => open("codex")}><span>📖</span>도감</button>
              <button className="btn tile" onClick={() => open("mounts")}><span>🐉</span>탈것</button>
              <button className="btn tile sun" onClick={() => open("shop")}><span>🛍️</span>상점</button>
              <button className="btn tile ghost" onClick={() => { sfx.click(); setCreating(true); }}><span>✨</span>꾸미기</button>
            </div>
            {props.error && <div className="err wide" style={{ gridColumn: "span 2" }}>{props.error}</div>}
          </div>
        )}

        {creating && (
          <Creator
            profile={profile}
            onPreview={(l) => sceneRef.current?.setLook(l)}
            onEmote={(e) => sceneRef.current?.playEmote(e)}
            onRotate={(r) => sceneRef.current?.rotateBy(r)}
            onFace={(r) => sceneRef.current?.faceTo(r)}
            onDone={async () => {
              await props.reload();
              setCreating(false);
            }}
            onCancel={() => {
              sceneRef.current?.setLook(look);
              setCreating(false);
            }}
          />
        )}
      </div>

      {modal === "create" && <CreateRoom onClose={() => setModal(null)} defaultTitle={`${profile.nickname}의 방`} onPick={props.onCreate} />}
      {modal === "rooms" && <RoomList onClose={() => setModal(null)} onJoin={props.onJoin} />}
      {modal === "join" && <JoinRoom onClose={() => setModal(null)} onJoin={props.onJoin} />}
      {modal === "inventory" && <Inventory onClose={() => setModal(null)} reload={props.reload} rod={rodLevelOf(profile.equipped)} />}
      {modal === "codex" && <Codex onClose={() => setModal(null)} profile={profile} />}
      {modal === "mounts" && <Mounts onClose={() => setModal(null)} profile={profile} reload={props.reload} />}
      {modal === "shop" && <Shop onClose={() => setModal(null)} profile={profile} reload={props.reload} />}
      {modal === "settings" && <Settings onClose={() => setModal(null)} onLogout={props.onLogout} reload={props.reload} />}
    </>
  );
}

function Modal({ title, onClose, children, narrow }: { title: string; onClose: () => void; children: React.ReactNode; narrow?: boolean }) {
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`modal panel ${narrow ? "narrow" : ""}`}>
        <header>
          <h2>{title}</h2>
          <button className="x" onClick={onClose}>✕</button>
        </header>
        <div className="body">{children}</div>
      </div>
    </div>
  );
}
export { Modal };

function CreateRoom({ onClose, onPick, defaultTitle }: { onClose: () => void; onPick: (m: string, title: string, isPublic: boolean) => void; defaultTitle: string }) {
  const [title, setTitle] = useState("");
  const [isPublic, setPublic] = useState(false);
  return (
    <Modal title="어디서 낚시할까요?" onClose={onClose}>
      <input className="field" placeholder={`방 제목 (비우면 "${defaultTitle}")`} maxLength={20} value={title} onChange={(e) => setTitle(e.target.value)} style={{ marginBottom: 10 }} />
      <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
        <button className={`opt ${!isPublic ? "on" : ""}`} onClick={() => setPublic(false)}>🔒 비공개</button>
        <button className={`opt ${isPublic ? "on" : ""}`} onClick={() => setPublic(true)}>🌍 공개</button>
      </div>
      <p className="hint" style={{ marginBottom: 14 }}>{isPublic ? "방 목록에 나와서 누구나 들어올 수 있어요." : "방 목록에 안 나오고, 코드나 초대 링크로만 들어와요."}</p>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {(Object.keys(BASE_MAPS) as MapId[]).map((m) => (
          <button key={m} className="cell" style={{ minHeight: 170, cursor: "pointer" }} onClick={() => { sfx.click(); onPick(m, title.trim() || defaultTitle, isPublic); }}>
            <div style={{ fontSize: 46 }}>{MAP_INFO[m].emoji}</div>
            <div className="nm" style={{ fontSize: 22 }}>{BASE_MAPS[m].name}</div>
            <div className="sub">{MAP_INFO[m].desc}</div>
          </button>
        ))}
      </div>
      <p className="hint" style={{ marginTop: 14 }}>방을 만들면 초대 코드가 생기고, 카카오톡으로 친구를 부를 수 있어요. (최대 8명)</p>
    </Modal>
  );
}

interface RoomInfo { code: string; title: string; mapId: MapId; hostName: string; players: number; max: number }

function RoomList({ onClose, onJoin }: { onClose: () => void; onJoin: (code: string) => void }) {
  const [rooms, refetch] = useFetch<RoomInfo[]>("/api/rooms");
  return (
    <Modal title="📋 공개 방 목록" onClose={onClose}>
      <button className="btn small ghost" style={{ marginBottom: 12 }} onClick={() => { sfx.click(); refetch(); }}>🔄 새로고침</button>
      {rooms && !rooms.length && <p className="hint">지금 열려 있는 공개 방이 없어요. 직접 방을 만들어 보세요!</p>}
      <div className="stack">
        {(rooms ?? []).map((r) => (
          <button key={r.code} className="cell" style={{ textAlign: "left", cursor: "pointer", minHeight: 0, padding: "10px 14px" }} onClick={() => { sfx.click(); onJoin(r.code); }}>
            <div className="nm">{r.title || "이름 없는 방"}</div>
            <div className="sub">{BASE_MAPS[r.mapId]?.name ?? "내 맵"} · 👥 {r.players}/{r.max}{r.hostName && ` · 방장 ${r.hostName}`}</div>
          </button>
        ))}
      </div>
    </Modal>
  );
}

function JoinRoom({ onClose, onJoin }: { onClose: () => void; onJoin: (code: string) => void }) {
  const [code, setCode] = useState("");
  return (
    <Modal title="초대 코드로 입장" onClose={onClose} narrow>
      <input
        className="field"
        placeholder="초대 코드 4글자"
        maxLength={4}
        autoFocus
        value={code}
        style={{ textAlign: "center", fontSize: 34, letterSpacing: 8, textTransform: "uppercase" }}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        onKeyDown={(e) => e.key === "Enter" && code.length === 4 && onJoin(code)}
      />
      <button className="btn mint" style={{ marginTop: 14, width: "100%" }} disabled={code.length !== 4} onClick={() => onJoin(code)}>
        입장하기
      </button>
    </Modal>
  );
}

function useFetch<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [tick, setTick] = useState(0);
  const [error, setError] = useState("");
  useEffect(() => {
    let alive = true;
    setError("");
    api<T>(path)
      .then((d) => alive && setData(d))
      .catch((e) => alive && (setData(null), setError(e instanceof Error ? e.message : "불러오지 못했어요")));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  return [data, () => setTick((t) => t + 1), error] as const;
}

/** uw: 수중 탐험에서 열었을 때. 수중에서 잡은 것(uw-)만 그 방에서 팔 수 있고(채널 인원 보너스 mul 이 붙는다), 낚시로 잡은 것은 흐리게 보인다. extra 는 위쪽 단추 줄에 끼우는 것 */
export function Inventory({ onClose, reload, rod, canSell = true, uw, extra }: { onClose: () => void; reload: () => Promise<void>; rod: number; canSell?: boolean; uw?: { mul: number; sell: (ids: string[]) => Promise<{ sold: number; earned: number; stones: number; mul: number }> }; extra?: React.ReactNode }) {
  const [list, refetch, loadError] = useFetch<CatchRecord[]>("/api/inventory");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const mul = uw?.mul ?? 1;
  const sellable = (id: string) => !uw || id.startsWith("uw-");
  const picked = (list ?? []).filter((c) => sel.has(c.id));
  const total = picked.reduce((a, c) => a + Math.round(sellPrice(speciesById(c.speciesId)!, c.size, rod) * mul), 0);
  const stonesTotal = picked.reduce((a, c) => a + STONES_PER_FISH[speciesById(c.speciesId)!.rarity], 0);
  const sorted = [...(list ?? [])].sort((a, b) => b.caughtAt - a.caughtAt);

  const sell = async () => {
    try {
      const r = uw ? await uw.sell([...sel]) : await api("/api/sell", { ids: [...sel] });
      sfx.success("rare");
      setMsg(`${r.sold}마리를 팔아서 🪙 ${r.earned}과 💎 강화석 ${r.stones}개를 받았어요!`);
      setSel(new Set());
      refetch();
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "");
    }
  };

  return (
    <Modal title={`🎒 인벤토리 (${list?.length ?? 0}마리)`} onClose={onClose}>
      {canSell ? (
        <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
          <button className="btn small ghost" onClick={() => setSel(new Set(sorted.filter((c) => sellable(c.speciesId)).map((c) => c.id)))}>모두 선택</button>
          <button className="btn small ghost" onClick={() => setSel(new Set())}>선택 해제</button>
          <button className="btn small sun" disabled={!sel.size} onClick={sell}>선택한 {sel.size}마리 팔기 (🪙 {total} · 💎 {stonesTotal})</button>
          {extra}
          <span className="hint">{msg}</span>
        </div>
      ) : (
        <p className="hint" style={{ marginBottom: 12 }}>물고기는 상인 아저씨에게 가서 팔 수 있어요 🧑‍🌾</p>
      )}
      {loadError && (
        <p className="err">
          물고기 목록을 불러오지 못했어요: {loadError} <button className="btn small ghost" onClick={refetch}>다시 시도</button>
        </p>
      )}
      {list && !list.length && <p className="hint">아직 잡은 물고기가 없어요. 방을 만들어 낚시를 떠나 볼까요?</p>}
      <div className="grid">
        {sorted.map((c) => {
          const sp = speciesById(c.speciesId)!;
          return (
            <button
              key={c.id}
              className={`cell ${sel.has(c.id) ? "sel" : ""}`}
              style={sellable(c.speciesId) ? undefined : { opacity: 0.55 }}
              onClick={() => canSell && sellable(c.speciesId) && setSel((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
            >
              <FishIcon sp={sp} size={92} />
              <div className="nm">{sp.name}</div>
              <div className="sub">{c.size}cm · 🪙 {Math.round(sellPrice(sp, c.size, rod) * (sellable(c.speciesId) ? mul : 1))} · 💎 {STONES_PER_FISH[sp.rarity]}</div>
              <span className="badge" style={{ background: RARITY_COLOR[sp.rarity] }}>{RARITY_LABEL[sp.rarity]}</span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}

function Codex({ onClose, profile }: { onClose: () => void; profile: PlayerProfile }) {
  const [codex] = useFetch<CodexEntry[]>("/api/codex");
  const [tab, setTab] = useState<MapId | "all" | "uw">("lake");
  const known = new Map((codex ?? []).map((c) => [c.speciesId, c]));
  const [uwZone, setUwZone] = useState(0); // 수중 도감은 구역별로 나눠 본다(마지막 칸은 조개)
  const list = tab === "all" ? SPECIES : tab === "uw" ? UW_FISH.filter((s) => s.id.startsWith(uwZone < UW_ZONE_NAMES.length ? `uw-${uwZone}-` : "uw-s-")) : codexSpeciesFor(tab);
  const got = list.filter((s) => known.has(s.id)).length;
  const names: Record<string, string> = { lake: "🌳 호수", pier: "⚓ 부두", ice: "❄️ 얼음", cruise: "🚢 크루즈", all: "📚 전체", uw: "🌊 수중" };
  const rewards = CODEX_REWARDS.filter((r) => r.mapId === tab);

  return (
    <Modal title="📖 물고기 도감" onClose={onClose}>
      <div className="tabs">
        {(["lake", "pier", "ice", "cruise", "uw", "all"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{names[t]}</button>
        ))}
        <span className="chip" style={{ marginLeft: "auto" }}>{got} / {list.length}</span>
      </div>
      {tab === "uw" && (
        <div className="tabs">
          {[...UW_ZONE_NAMES, "조개"].map((n, i) => (
            <button key={n} className={`tab ${uwZone === i ? "on" : ""}`} style={{ fontSize: 14, padding: "6px 12px" }} onClick={() => setUwZone(i)}>
              {n} {UW_FISH.filter((s) => s.id.startsWith(i < UW_ZONE_NAMES.length ? `uw-${i}-` : "uw-s-") && known.has(s.id)).length}/{i < UW_ZONE_NAMES.length ? 50 : 3}
            </button>
          ))}
        </div>
      )}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
        {rewards.map((r) => (
          <span key={r.id} className="chip" style={{ opacity: profile.claimedRewards.includes(r.id) ? 1 : 0.55 }}>
            {profile.claimedRewards.includes(r.id) ? "✅" : "🔒"} {r.ratio * 100}% {r.title}
            {r.items ? " · 전용 오라와 이모트" : r.coins ? ` · 🪙${r.coins}` : ""}
          </span>
        ))}
      </div>
      <div className="grid">
        {list.map((sp) => {
          const e = known.get(sp.id);
          return (
            <div key={sp.id} className={`cell ${e ? "" : "unknown"}`}>
              <FishIcon sp={sp} size={92} silhouette={!e} />
              <div className="nm">{e ? sp.name : "???"}</div>
              <div className="sub">{e ? `최대 ${e.maxSize}cm · ${e.count}마리` : sp.time === "night" ? "밤에 만날 수 있대요" : "아직 못 잡았어요"}</div>
              {e && <span className="badge" style={{ background: RARITY_COLOR[sp.rarity] }}>{RARITY_LABEL[sp.rarity]}</span>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

/** 신화 탈것: 잡아 본 신화 물고기를 칸 1~4에 넣어 두면 수중 탐험에서 숫자 키로 불러 탄다 */
function Mounts({ onClose, profile, reload }: { onClose: () => void; profile: PlayerProfile; reload: () => Promise<void> }) {
  const [codex] = useFetch<CodexEntry[]>("/api/codex");
  const [sel, setSel] = useState(1);
  const [msg, setMsg] = useState("");
  const have = new Set((codex ?? []).map((c) => c.speciesId));
  const myth = SPECIES.filter((sp) => sp.rarity === "mythic");
  const put = async (slot: number, speciesId: string | null) => {
    try {
      await api("/api/mount", { slot, speciesId });
      await reload();
      sfx.click();
      setMsg("");
    } catch (e) {
      setMsg((e as Error).message);
    }
  };
  return (
    <Modal title="🐉 신화 탈것" onClose={onClose}>
      <div className="sub" style={{ marginBottom: 10 }}>칸을 고른 뒤 아래에서 잡아 본 신화를 누르면 들어가요. 수중 탐험에서 숫자 키 1~4로 불러 탈 수 있어요.</div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 10, marginBottom: 14 }}>
        {[1, 2, 3, 4].map((n) => {
          const sp = myth.find((q) => q.id === profile.equipped[`mount${n}`]);
          return (
            <div key={n} className="cell" onClick={() => setSel(n)} style={{ cursor: "pointer", outline: sel === n ? `3px solid ${RARITY_COLOR.mythic}` : "none" }}>
              <span className="badge" style={{ background: sel === n ? RARITY_COLOR.mythic : "#8fa3b3" }}>{n}번 키</span>
              {sp ? <FishIcon sp={sp} size={84} /> : <div style={{ height: 84, display: "grid", placeItems: "center", fontSize: 30, opacity: 0.4 }}>＋</div>}
              <div className="nm">{sp ? sp.name : "빈 칸"}</div>
              {sp ? <button className="btn small ghost" onClick={(e) => { e.stopPropagation(); void put(n, null); }}>비우기</button> : <div className="sub">아래에서 골라요</div>}
            </div>
          );
        })}
      </div>
      {msg && <div className="err" style={{ marginBottom: 10 }}>{msg}</div>}
      <div className="grid">
        {myth.map((sp) => {
          const got = have.has(sp.id);
          const at = [1, 2, 3, 4].find((n) => profile.equipped[`mount${n}`] === sp.id);
          return (
            <div key={sp.id} className={`cell ${got ? "" : "unknown"}`} style={{ cursor: got ? "pointer" : "default" }} onClick={() => got && void put(sel, sp.id)}>
              <FishIcon sp={sp} size={92} silhouette={!got} />
              <div className="nm">{got ? sp.name : "???"}</div>
              <div className="sub">{!got ? "아직 못 잡았어요" : at ? `${at}번 칸에 있어요` : `눌러서 ${sel}번 칸에 넣기`}</div>
              {at && <span className="badge" style={{ background: RARITY_COLOR.mythic }}>{at}번</span>}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}

const SLOT_NAME = { top: "상의", pants: "하의", shoes: "신발", aura: "오라" } as const;
const SLOT_EMOJI = { top: "👕", pants: "👖", shoes: "👟", aura: "✨" } as const;

export function Shop({ onClose, profile, reload }: { onClose: () => void; profile: PlayerProfile; reload: () => Promise<void> }) {
  const [slot, setSlot] = useState<ShopItem["slot"] | "rod" | "bait">("bait"); // 낚싯대 강화는 대장장이에게서 한다
  const [pick, setPick] = useState<string | null>(null); // 미리 입어 볼 상품(null이면 지금 입은 그대로)
  const changeSlot = (s: ShopItem["slot"] | "rod" | "bait") => {
    setSlot(s);
    setPick(null);
  };
  const [msg, setMsg] = useState("");
  const items = slot === "rod" || slot === "bait" ? [] : ITEMS.filter((i) => i.slot === slot && (i.purchasable || profile.ownedItems.includes(i.id)));

  const previewLook: Look = useMemo(() => {
    const equipped = { ...profile.equipped };
    if (slot !== "rod" && slot !== "bait" && pick) {
      if (pick === "none") delete equipped[slot];
      else equipped[slot] = pick;
    }
    return { appearance: profile.appearance, equipped };
  }, [profile.appearance, profile.equipped, slot, pick]);

  const act = async (fn: () => Promise<unknown>, ok: string | ((r: any) => string)) => {
    try {
      const r: any = await fn();
      if (r?.success === false) sfx.fail();
      else sfx.success("rare");
      setMsg(typeof ok === "function" ? ok(r) : ok);
      await reload();
    } catch (e) {
      sfx.fail();
      setMsg(e instanceof Error ? e.message : "");
    }
  };

  return (
    <Modal title={`🛍️ 상점  🪙 ${profile.coins.toLocaleString()}  💎 ${(profile.stones ?? 0).toLocaleString()}`} onClose={onClose}>
      <div className="tabs">
        <button className={`tab ${slot === "bait" ? "on" : ""}`} onClick={() => changeSlot("bait")}>🪱 미끼</button>
        {(["top", "pants", "shoes", "aura"] as const).map((s) => (
          <button key={s} className={`tab ${slot === s ? "on" : ""}`} onClick={() => changeSlot(s)}>{SLOT_EMOJI[s]} {SLOT_NAME[s]}</button>
        ))}
        <span className="hint" style={{ alignSelf: "center" }}>{msg}</span>
      </div>
      {slot === "bait" && <BaitTab profile={profile} act={act} />}
      {slot !== "rod" && slot !== "bait" && <div className="shop-split">
        <div className="rod-view">
          <CharacterPreview look={previewLook} slot={slot} />
          <div className="nm" style={{ fontSize: 18 }}>{pick === "none" ? "기본 옷" : pick ? itemById(pick)?.name : profile.equipped[slot] ? itemById(profile.equipped[slot])?.name : "기본 옷"}</div>
          <div className="hint">상품을 누르면 입어 볼 수 있어요</div>
        </div>
        <div className="grid">
        <div className={`cell ${pick === "none" ? "pick" : ""}`} onClick={() => setPick("none")}>
          <div style={{ fontSize: 38 }}>🚫</div>
          <div className="nm">벗기</div>
          <button className="btn small ghost" disabled={!profile.equipped[slot]} onClick={(e) => { e.stopPropagation(); void act(() => api("/api/equip", { slot, itemId: null }), "벗었어요"); }}>벗기</button>
        </div>
        {items.map((it) => {
          const owned = profile.ownedItems.includes(it.id);
          const worn = profile.equipped[slot] === it.id;
          return (
            <div key={it.id} className={`cell ${worn ? "sel" : ""} ${pick === it.id ? "pick" : ""}`} onClick={() => setPick(it.id)}>
              <div style={{ fontSize: 38 }}>{SLOT_EMOJI[it.slot]}</div>
              <div className="nm">{it.name}</div>
              {!it.purchasable && <span className="badge" style={{ background: RARITY_COLOR.legendary }}>도감 보상</span>}
              {owned ? (
                <button className="btn small mint" onClick={(e) => { e.stopPropagation(); void act(() => api("/api/equip", { slot, itemId: worn ? null : it.id }), worn ? "벗었어요" : `${it.name}을 입었어요`); }}>{worn ? "벗기" : "입기"}</button>
              ) : (
                <button className="btn small sun" disabled={profile.coins < it.price} onClick={(e) => { e.stopPropagation(); void act(() => api("/api/buy", { itemId: it.id }), `${it.name}을 샀어요!`); }}>🪙 {it.price}</button>
              )}
            </div>
          );
        })}
        </div>
      </div>}
      <p className="hint" style={{ marginTop: 12 }}>입은 모습은 로비의 캐릭터와 방 안에서 바로 보여요.</p>
    </Modal>
  );
}

/** 모델(낚싯대·미끼)을 빙글빙글 돌려 보여 주는 작은 3D 화면 */
export function ModelPreview({ k, make, camZ, rotZ = 0 }: { k: string; make: () => { group: THREE.Group; update: (t: number, reeling: boolean) => void }; camZ: number; rotZ?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current!;
    const w = el.clientWidth || 220, h = el.clientHeight || 300;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 50);
    cam.position.set(0, 0.05, camZ);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x9aa7bb, 1.7));
    const sun = new THREE.DirectionalLight(0xffffff, 1.4);
    sun.position.set(2, 3, 4);
    scene.add(sun);
    const fx = make();
    const spin = new THREE.Group();
    fx.group.rotation.z = rotZ;
    spin.add(fx.group);
    scene.add(spin);
    let raf = 0;
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      spin.rotation.y = t * 0.9;
      fx.update(t, false);
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        (Array.isArray(mat) ? mat : mat ? [mat] : []).forEach((x) => x.dispose());
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [k]);
  return <div className="rod-preview" ref={ref} />;
}

/** 작살총 단계별 모습(강화 창). 총은 앞뒤로 길어서 옆으로 돌려 보여 준다 */
export const HarpoonPreview = ({ level }: { level: number }) => <ModelPreview k={`hp${level}`} make={() => { const f = buildHarpoonGun(level), w = new THREE.Group(); f.group.rotation.y = Math.PI / 2; f.group.position.x = -0.75; w.add(f.group); return { group: w, update: (t) => f.update(t) }; }} camZ={5.2} rotZ={0.35} />;
export const RodPreview = ({ level }: { level: number }) => <ModelPreview k={`rod${level}`} make={() => buildRod(level)} camZ={4.1} rotZ={0.5} />;
const BaitPreview = ({ id }: { id: string }) => <ModelPreview k={id} make={() => { const f = buildBait(id); return { group: f.group, update: (t) => f.update(t) }; }} camZ={3.6} />;

/** 칸마다 잘 보이는 높이와 거리(캐릭터 키 약 2.6) */
const PREVIEW_FOCUS: Record<string, { y: number; d: number }> = {
  top: { y: 1.7, d: 5.6 },
  pants: { y: 1.0, d: 5.4 },
  shoes: { y: 0.55, d: 4.2 },
  aura: { y: 1.4, d: 8 },
};

/** 내 캐릭터가 고른 상품을 입은 모습을 빙글빙글 돌려 보여 주는 작은 3D 화면 */
function CharacterPreview({ look, slot }: { look: Look; slot: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const key = JSON.stringify(look) + slot;
  useEffect(() => {
    const el = ref.current!;
    const w = el.clientWidth || 240, h = el.clientHeight || 340;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(w, h);
    el.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const f = PREVIEW_FOCUS[slot] ?? PREVIEW_FOCUS.top;
    const cam = new THREE.PerspectiveCamera(30, w / h, 0.1, 60);
    cam.position.set(0, f.y, f.d);
    cam.lookAt(0, f.y, 0);
    scene.add(new THREE.HemisphereLight(0xffffff, 0xaab4c8, 1.9));
    const sun = new THREE.DirectionalLight(0xffffff, 1.5);
    sun.position.set(2, 4, 5);
    scene.add(sun);
    const rig = new CharacterRig(look);
    scene.add(rig.root);
    let raf = 0;
    let last = performance.now();
    const loop = () => {
      const now = performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      rig.facing += dt * 0.7;
      rig.update(dt, { moving: false, fishing: "idle" });
      renderer.render(scene, cam);
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      rig.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return <div className="rod-preview tall" ref={ref} />;
}

function BaitTab({ profile, act }: { profile: PlayerProfile; act: (fn: () => Promise<unknown>, ok: string) => Promise<void> }) {
  const [view, setView] = useState(BAITS[0].id);
  const bait = BAITS.find((b) => b.id === view) ?? BAITS[0];
  return (
    <div className="rodtab">
      <div className="rod-view">
        <BaitPreview id={bait.id} />
        <div className="nm" style={{ fontSize: 20 }}>{bait.name}</div>
        <ul className="rod-fx"><li>{bait.desc}</li><li>방 안에서 누르면 한 개를 쓰고 1분 동안 이어져요</li></ul>
      </div>
      <div className="rod-list">
        {BAITS.map((b) => {
          const have = profile.baits?.[b.id] ?? 0;
          return (
            <div key={b.id} className={`rod-row ${view === b.id ? "sel" : ""}`} onClick={() => setView(b.id)}>
              <div>
                <div className="nm">{b.name}</div>
                <div className="sub">가진 개수 {have}개</div>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button className="btn small sun" disabled={profile.coins < b.price} onClick={(e) => { e.stopPropagation(); void act(() => api("/api/bait/buy", { baitId: b.id }), `${b.name} ${b.pack}개를 샀어요!`); }}>
                  🪙 {b.price.toLocaleString()} · {b.pack}개
                </button>
              </div>
            </div>
          );
        })}
        <p className="hint">미끼는 낚시할 때 방 화면 위쪽의 "🪱 미끼" 버튼에서 쓸지 말지, 어떤 미끼를 쓸지 고를 수 있어요. 던지는 순간 하나씩 줄고, 최대 99개까지 가질 수 있어요.</p>
      </div>
    </div>
  );
}

function Settings({ onClose, onLogout, reload }: { onClose: () => void; onLogout: () => void; reload: () => Promise<void> }) {
  const [a, setA] = useState(getAudio());
  const [devMsg, setDevMsg] = useState("");
  return (
    <Modal title="⚙️ 설정" onClose={onClose} narrow>
      <div className="row">
        <label>음량 {Math.round(a.volume * 100)}%</label>
        <input type="range" min={0} max={1} step={0.05} value={a.volume} style={{ width: "100%" }}
          onChange={(e) => { const v = Number(e.target.value); setVolume(v); setA({ ...a, volume: v }); }} />
      </div>
      <div className="row">
        <button className="btn ghost" onClick={() => { setMuted(!a.muted); setA({ ...a, muted: !a.muted }); }}>
          {a.muted ? "🔇 소리 꺼짐 (누르면 켜요)" : "🔊 소리 켜짐 (누르면 꺼요)"}
        </button>
      </div>
      {auth.token?.startsWith("dev:") && (
        <div className="row">
          <button className="btn sun" onClick={async () => {
            try { await api("/api/dev/grant", {}); await reload(); setDevMsg("돈 5000과 강화석 500을 받았어요"); } catch (e) { setDevMsg(e instanceof Error ? e.message : ""); }
          }}>🧪 개발용: 돈 5000 + 강화석 500 받기</button>
          <p className="hint">{devMsg}</p>
        </div>
      )}
      <button className="btn pink" onClick={onLogout}>로그아웃</button>
    </Modal>
  );
}

// ---- 캐릭터 만들기 (성별, 머리 스타일, 머리색만 바꾼다) ----------------------
const HAIR_NAMES = [
  ["포니테일", "양갈래", "단발", "긴 생머리"],
  ["웨이브 펌", "가르마", "덮은 앞머리", "헝클머리"],
];

function Creator({ profile, onPreview, onEmote, onRotate, onFace, onDone, onCancel }: {
  profile: PlayerProfile;
  onPreview: (l: { appearance: Appearance; equipped: Record<string, string> }) => void;
  onEmote: (e: string) => void;
  onRotate: (rad: number) => void;
  onFace: (rad: number) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [a, setA] = useState<Appearance>({ ...profile.appearance, gender: profile.appearance.gender ?? 0 });
  const [name, setName] = useState(profile.nickname === "낚시꾼" ? "" : profile.nickname);
  const [err, setErr] = useState("");
  const g = a.gender === 1 ? 1 : 0;
  const set = (k: keyof Appearance, v: number) => {
    const next = { ...a, [k]: v };
    setA(next);
    onPreview({ appearance: next, equipped: profile.equipped });
  };
  const randomize = () => {
    const r = (n: number) => Math.floor(Math.random() * n);
    const next: Appearance = { ...a, hair: r(4), hairColor: r(HAIR.length), eyeColor: r(EYE.length) };
    setA(next);
    onPreview({ appearance: next, equipped: profile.equipped });
  };
  const save = async () => {
    try {
      await api("/api/character", { nickname: name.trim(), appearance: a });
      sfx.success("rare");
      onDone();
    } catch (e) {
      setErr(e instanceof Error ? e.message : "");
    }
  };

  return (
    <div className="creator panel">
      <h2 className="big-title">나만의 캐릭터</h2>
      <input className="field" placeholder="닉네임 (1~10글자)" maxLength={10} value={name} onChange={(e) => setName(e.target.value)} />
      <div className="scroll">
        <div className="row">
          <label>돌려 보기 (캐릭터를 끌어도 돌아요)</label>
          <div className="opts">
            <button className="opt" onClick={() => onRotate(-Math.PI / 4)}>⟲</button>
            <button className="opt" onClick={() => onRotate(Math.PI / 4)}>⟳</button>
            <button className="opt" onClick={() => onFace(0)}>앞</button>
            <button className="opt" onClick={() => onFace(Math.PI / 2)}>옆</button>
            <button className="opt" onClick={() => onFace(Math.PI)}>뒤</button>
          </div>
        </div>
        <div className="row">
          <label>성별</label>
          <div className="opts">
            {["여자", "남자"].map((n, i) => (
              <button key={n} className={`opt ${g === i ? "on" : ""}`} onClick={() => set("gender", i)}>{n}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <label>머리 스타일</label>
          <div className="opts">
            {HAIR_NAMES[g].map((n, i) => (
              <button key={n} className={`opt ${a.hair % 4 === i ? "on" : ""}`} onClick={() => set("hair", i)}>{n}</button>
            ))}
          </div>
        </div>
        <div className="row">
          <label>머리색</label>
          <div className="opts">
            {HAIR.map((c, i) => (
              <button key={i} className={`swatch ${a.hairColor === i ? "on" : ""}`} style={{ background: c }} onClick={() => set("hairColor", i)} aria-label={`머리색 ${i + 1}`} />
            ))}
          </div>
        </div>
        <div className="row">
          <label>눈동자 색 (눈썹은 머리색을 따라가요)</label>
          <div className="opts">
            {EYE.map((c, i) => (
              <button key={i} className={`swatch ${a.eyeColor === i ? "on" : ""}`} style={{ background: c }} onClick={() => set("eyeColor", i)} aria-label={`눈동자 색 ${i + 1}`} />
            ))}
          </div>
        </div>
        <div className="row">
          <label>이모트 미리보기</label>
          <div className="opts">
            {[["wave", "👋"], ["angry", "💢"], ["aegyo", "💕"], ["dance", "🎵"], ["cry", "😢"]].map(([id, e]) => (
              <button key={id} className="opt" onClick={() => onEmote(id)}>{e}</button>
            ))}
          </div>
        </div>
      </div>
      <div className="err">{err}</div>
      <div style={{ display: "flex", gap: 8 }}>
        <button className="btn ghost small" onClick={randomize}>🎲 랜덤</button>
        <button className="btn ghost small" onClick={onCancel}>취소</button>
        <button className="btn mint" style={{ flex: 1 }} disabled={!name.trim()} onClick={save}>저장하기</button>
      </div>
    </div>
  );
}

export { itemById };
