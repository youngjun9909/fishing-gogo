import { useEffect, useMemo, useRef, useState } from "react";
import { BASE_MAPS, CODEX_REWARDS, ITEMS, SPECIES, codexSpeciesFor, itemById, sellPrice, speciesById } from "@fishing/shared";
import type { Appearance, CatchRecord, CodexEntry, MapId, PlayerProfile, ShopItem } from "@fishing/shared";
import { getAudio, setMuted, setVolume, sfx } from "../audio";
import { api } from "../net";
import { EYE, HAIR, SKIN } from "../three/character";
import { LobbyScene } from "../three/LobbyScene";
import { FishIcon, RARITY_COLOR, RARITY_LABEL } from "./FishIcon";

type Modal = null | "create" | "join" | "inventory" | "codex" | "shop" | "settings";

const MAP_INFO: Record<MapId, { emoji: string; desc: string }> = {
  lake: { emoji: "🌳", desc: "잔잔한 물가에서 느긋하게. 처음 시작하기 좋아요." },
  pier: { emoji: "⚓", desc: "바다로 길게 뻗은 부두. 큰 물고기가 숨어 있어요." },
  ice: { emoji: "❄️", desc: "눈 덮인 숲속 차가운 호수. 얼음 조각이 둥둥 떠 있어요." },
};

export function Lobby(props: {
  profile: PlayerProfile;
  reload: () => Promise<void>;
  onCreate: (map: string) => void;
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
    sceneRef.current?.setLook(look);
  }, [look]);

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
            <button className="btn mint wide" onClick={() => open("join")}>🔑 코드로 입장</button>
            <button className="btn" onClick={() => open("inventory")}>🎒 인벤토리</button>
            <button className="btn" onClick={() => open("codex")}>📖 도감</button>
            <button className="btn sun" onClick={() => open("shop")}>🛍️ 상점</button>
            <button className="btn ghost" onClick={() => { sfx.click(); setCreating(true); }}>✨ 꾸미기</button>
            {props.error && <div className="err wide" style={{ gridColumn: "span 2" }}>{props.error}</div>}
          </div>
        )}

        {creating && (
          <Creator
            profile={profile}
            onPreview={(l) => sceneRef.current?.setLook(l)}
            onEmote={(e) => sceneRef.current?.playEmote(e)}
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

      {modal === "create" && <CreateRoom onClose={() => setModal(null)} onPick={(m) => props.onCreate(m)} />}
      {modal === "join" && <JoinRoom onClose={() => setModal(null)} onJoin={props.onJoin} />}
      {modal === "inventory" && <Inventory onClose={() => setModal(null)} reload={props.reload} />}
      {modal === "codex" && <Codex onClose={() => setModal(null)} profile={profile} />}
      {modal === "shop" && <Shop onClose={() => setModal(null)} profile={profile} reload={props.reload} />}
      {modal === "settings" && <Settings onClose={() => setModal(null)} onLogout={props.onLogout} />}
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

function CreateRoom({ onClose, onPick }: { onClose: () => void; onPick: (m: string) => void }) {
  return (
    <Modal title="어디서 낚시할까요?" onClose={onClose}>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))" }}>
        {(Object.keys(BASE_MAPS) as MapId[]).map((m) => (
          <button key={m} className="cell" style={{ minHeight: 170, cursor: "pointer" }} onClick={() => { sfx.click(); onPick(m); }}>
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
  useEffect(() => {
    let alive = true;
    api<T>(path).then((d) => alive && setData(d)).catch(() => alive && setData(null));
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, tick, ...deps]);
  return [data, () => setTick((t) => t + 1)] as const;
}

function Inventory({ onClose, reload }: { onClose: () => void; reload: () => Promise<void> }) {
  const [list, refetch] = useFetch<CatchRecord[]>("/api/inventory");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [msg, setMsg] = useState("");
  const total = (list ?? []).filter((c) => sel.has(c.id)).reduce((a, c) => a + sellPrice(speciesById(c.speciesId)!, c.size), 0);
  const sorted = [...(list ?? [])].sort((a, b) => b.caughtAt - a.caughtAt);

  const sell = async () => {
    try {
      const r = await api("/api/sell", { ids: [...sel] });
      sfx.success("rare");
      setMsg(`${r.sold}마리를 팔아서 🪙 ${r.earned}을 벌었어요!`);
      setSel(new Set());
      refetch();
      await reload();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "");
    }
  };

  return (
    <Modal title={`🎒 인벤토리 (${list?.length ?? 0}마리)`} onClose={onClose}>
      <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        <button className="btn small ghost" onClick={() => setSel(new Set(sorted.map((c) => c.id)))}>모두 선택</button>
        <button className="btn small ghost" onClick={() => setSel(new Set())}>선택 해제</button>
        <button className="btn small sun" disabled={!sel.size} onClick={sell}>선택한 {sel.size}마리 팔기 (🪙 {total})</button>
        <span className="hint">{msg}</span>
      </div>
      {list && !list.length && <p className="hint">아직 잡은 물고기가 없어요. 방을 만들어 낚시를 떠나 볼까요?</p>}
      <div className="grid">
        {sorted.map((c) => {
          const sp = speciesById(c.speciesId)!;
          return (
            <button
              key={c.id}
              className={`cell ${sel.has(c.id) ? "sel" : ""}`}
              onClick={() => setSel((s) => { const n = new Set(s); n.has(c.id) ? n.delete(c.id) : n.add(c.id); return n; })}
            >
              <FishIcon sp={sp} size={92} />
              <div className="nm">{sp.name}</div>
              <div className="sub">{c.size}cm · 🪙 {sellPrice(sp, c.size)}</div>
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
  const [tab, setTab] = useState<MapId | "all">("lake");
  const known = new Map((codex ?? []).map((c) => [c.speciesId, c]));
  const list = tab === "all" ? SPECIES : codexSpeciesFor(tab);
  const got = list.filter((s) => known.has(s.id)).length;
  const names: Record<string, string> = { lake: "🌳 호수", pier: "⚓ 부두", ice: "❄️ 얼음", all: "📚 전체" };
  const rewards = CODEX_REWARDS.filter((r) => r.mapId === tab);

  return (
    <Modal title="📖 물고기 도감" onClose={onClose}>
      <div className="tabs">
        {(["lake", "pier", "ice", "all"] as const).map((t) => (
          <button key={t} className={`tab ${tab === t ? "on" : ""}`} onClick={() => setTab(t)}>{names[t]}</button>
        ))}
        <span className="chip" style={{ marginLeft: "auto" }}>{got} / {list.length}</span>
      </div>
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

const SLOT_NAME = { outfit: "옷", hat: "모자", aura: "오라" } as const;
const SLOT_EMOJI = { outfit: "👕", hat: "🎩", aura: "✨" } as const;

function Shop({ onClose, profile, reload }: { onClose: () => void; profile: PlayerProfile; reload: () => Promise<void> }) {
  const [slot, setSlot] = useState<ShopItem["slot"]>("outfit");
  const [msg, setMsg] = useState("");
  const items = ITEMS.filter((i) => i.slot === slot && (i.purchasable || profile.ownedItems.includes(i.id)));

  const act = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      sfx.success("rare");
      setMsg(ok);
      await reload();
    } catch (e) {
      sfx.fail();
      setMsg(e instanceof Error ? e.message : "");
    }
  };

  return (
    <Modal title={`🛍️ 상점  🪙 ${profile.coins.toLocaleString()}`} onClose={onClose}>
      <div className="tabs">
        {(["outfit", "hat", "aura"] as const).map((s) => (
          <button key={s} className={`tab ${slot === s ? "on" : ""}`} onClick={() => setSlot(s)}>{SLOT_EMOJI[s]} {SLOT_NAME[s]}</button>
        ))}
        <span className="hint" style={{ alignSelf: "center" }}>{msg}</span>
      </div>
      <div className="grid">
        <div className="cell">
          <div style={{ fontSize: 38 }}>🚫</div>
          <div className="nm">벗기</div>
          <button className="btn small ghost" disabled={!profile.equipped[slot]} onClick={() => act(() => api("/api/equip", { slot, itemId: null }), "벗었어요")}>벗기</button>
        </div>
        {items.map((it) => {
          const owned = profile.ownedItems.includes(it.id);
          const worn = profile.equipped[slot] === it.id;
          return (
            <div key={it.id} className={`cell ${worn ? "sel" : ""}`}>
              <div style={{ fontSize: 38 }}>{SLOT_EMOJI[it.slot]}</div>
              <div className="nm">{it.name}</div>
              {!it.purchasable && <span className="badge" style={{ background: RARITY_COLOR.legendary }}>도감 보상</span>}
              {owned ? (
                <button className="btn small mint" onClick={() => act(() => api("/api/equip", { slot, itemId: worn ? null : it.id }), worn ? "벗었어요" : `${it.name}을 입었어요`)}>{worn ? "벗기" : "입기"}</button>
              ) : (
                <button className="btn small sun" disabled={profile.coins < it.price} onClick={() => act(() => api("/api/buy", { itemId: it.id }), `${it.name}을 샀어요!`)}>🪙 {it.price}</button>
              )}
            </div>
          );
        })}
      </div>
      <p className="hint" style={{ marginTop: 12 }}>입은 모습은 로비의 캐릭터와 방 안에서 바로 보여요.</p>
    </Modal>
  );
}

function Settings({ onClose, onLogout }: { onClose: () => void; onLogout: () => void }) {
  const [a, setA] = useState(getAudio());
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
      <button className="btn pink" onClick={onLogout}>로그아웃</button>
    </Modal>
  );
}

// ---- 캐릭터 만들기 ----------------------------------------------------
const FIELDS: Array<{ key: keyof Appearance; label: string; n: number }> = [
  { key: "eyes", label: "눈 모양", n: 10 },
  { key: "nose", label: "코", n: 6 },
  { key: "mouth", label: "입", n: 8 },
  { key: "hair", label: "머리 스타일", n: 15 },
  { key: "body", label: "체형", n: 3 },
];
const COLORS: Array<{ key: keyof Appearance; label: string; list: string[] }> = [
  { key: "skinColor", label: "피부색", list: SKIN },
  { key: "hairColor", label: "머리색", list: HAIR },
  { key: "eyeColor", label: "눈동자색", list: EYE },
];

// 눈, 코, 입, 머리, 피부, 머리색, 눈동자색, 체형
const PRESETS: Array<[string, Appearance]> = [
  ["상큼 소녀", { eyes: 1, nose: 1, mouth: 0, hair: 4, skinColor: 0, hairColor: 2, eyeColor: 2, body: 0 }],
  ["씩씩 소년", { eyes: 0, nose: 0, mouth: 1, hair: 2, skinColor: 2, hairColor: 0, eyeColor: 1, body: 1 }],
  ["벚꽃 친구", { eyes: 5, nose: 3, mouth: 3, hair: 5, skinColor: 7, hairColor: 6, eyeColor: 9, body: 0 }],
  ["어부 아저씨", { eyes: 3, nose: 2, mouth: 5, hair: 12, skinColor: 4, hairColor: 4, eyeColor: 0, body: 2 }],
  ["달콤 곱슬", { eyes: 6, nose: 1, mouth: 6, hair: 11, skinColor: 5, hairColor: 1, eyeColor: 1, body: 1 }],
  ["민트 요정", { eyes: 4, nose: 5, mouth: 2, hair: 13, skinColor: 8, hairColor: 8, eyeColor: 3, body: 0 }],
  ["하늘 모험가", { eyes: 9, nose: 0, mouth: 0, hair: 9, skinColor: 1, hairColor: 7, eyeColor: 10, body: 1 }],
  ["펑크 낚시꾼", { eyes: 7, nose: 4, mouth: 7, hair: 8, skinColor: 3, hairColor: 5, eyeColor: 5, body: 1 }],
];

function Creator({ profile, onPreview, onEmote, onDone, onCancel }: {
  profile: PlayerProfile;
  onPreview: (l: { appearance: Appearance; equipped: Record<string, string> }) => void;
  onEmote: (e: string) => void;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [a, setA] = useState<Appearance>(profile.appearance);
  const [name, setName] = useState(profile.nickname === "낚시꾼" ? "" : profile.nickname);
  const [err, setErr] = useState("");
  const set = (k: keyof Appearance, v: number) => {
    const next = { ...a, [k]: v };
    setA(next);
    onPreview({ appearance: next, equipped: profile.equipped });
  };
  const randomize = () => {
    const r = (n: number) => Math.floor(Math.random() * n);
    const next: Appearance = { eyes: r(10), nose: r(6), mouth: r(8), hair: r(15), skinColor: r(12), hairColor: r(12), eyeColor: r(12), body: r(3) };
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
          <label>추천 모습 (눌러서 바꿔 봐요)</label>
          <div className="opts">
            {PRESETS.map(([n, p]) => (
              <button key={n} className="opt" onClick={() => { setA(p); onPreview({ appearance: p, equipped: profile.equipped }); }}>{n}</button>
            ))}
          </div>
        </div>
        {FIELDS.map((f) => (
          <div className="row" key={f.key}>
            <label>{f.label}</label>
            <div className="opts">
              {Array.from({ length: f.n }, (_, i) => (
                <button key={i} className={`opt ${a[f.key] === i ? "on" : ""}`} onClick={() => set(f.key, i)}>{i + 1}</button>
              ))}
            </div>
          </div>
        ))}
        {COLORS.map((f) => (
          <div className="row" key={f.key}>
            <label>{f.label}</label>
            <div className="opts">
              {f.list.map((c, i) => (
                <button key={i} className={`swatch ${a[f.key] === i ? "on" : ""}`} style={{ background: c }} onClick={() => set(f.key, i)} aria-label={`${f.label} ${i + 1}`} />
              ))}
            </div>
          </div>
        ))}
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
