import { useEffect, useRef, useState } from "react";
import type { Room } from "colyseus.js";
import { BAITS, BASE_MAPS, CODEX_REWARDS, CYCLE_MS, DAY_MS, EMOTES, MAX_PLAYERS, RECONNECT_SECONDS, cursorAt, inFrenzy, rodLevelOf, speciesById, tugDecay, tugPull } from "@fishing/shared";
import type { MapId, PlayerProfile, Rarity, TugParams } from "@fishing/shared";
import type { Joined } from "../App";
import { sfx, startBgm, stopBgm } from "../audio";
import { api, colyseus, inviteLink } from "../net";
import { GameScene } from "../three/GameScene";
import { FishIcon, RARITY_COLOR, RARITY_LABEL } from "./FishIcon";
import { Inventory, Modal, Shop } from "./Lobby";
import { Forge } from "./Forge";

const BAIT_EMOJI: Record<string, string> = { "bait-worm": "🪱", "bait-plain": "🎣", "bait-glitter": "✨", "bait-gold": "👑" };

const EMOTE_UI: Array<[string, string, string]> = [
  ["wave", "👋", "손 흔들기"], ["angry", "💢", "화내기"], ["aegyo", "💕", "애교"], ["dance", "🎵", "춤추기"], ["cry", "😢", "울기"],
];

interface Row { sessionId: string; name: string; value: number; count: number; biggest: { speciesId: string; size: number } | null }
interface RankMsg { value: Row[]; count: Row[]; biggest: Row[] }

declare global {
  interface Window { Kakao?: any }
}

/** 카카오톡 공유하기가 준비되어 있으면 쓰고, 아니면 링크를 복사한다 */
async function shareInvite(code: string, mapName: string): Promise<string> {
  const link = inviteLink(code);
  const K = window.Kakao;
  if (K?.isInitialized?.()) {
    try {
      K.Share.sendDefault({
        objectType: "feed",
        content: { title: "퐁당에 초대할게요! 🎣", description: `${mapName}에서 같이 낚시해요. 초대 코드: ${code}`, imageUrl: `${location.origin}/invite.png`, link: { mobileWebUrl: link, webUrl: link } },
        buttons: [{ title: "같이 낚시하러 가기", link: { mobileWebUrl: link, webUrl: link } }],
      });
      return "카카오톡 공유 창을 열었어요";
    } catch {
      // 아래 복사로 넘어간다
    }
  }
  try {
    await navigator.clipboard.writeText(link);
    return "초대 링크를 복사했어요! 카카오톡에 붙여넣어 보내 주세요";
  } catch {
    return link;
  }
}

export function RoomScreen({ joined, profile, reload, onLeave, onRejoin }: {
  joined: Joined;
  profile: PlayerProfile;
  reload: () => Promise<void>;
  onLeave: () => void;
  onRejoin: (room: Room<any>) => void;
}) {
  const { room } = joined;
  const stage = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<GameScene | null>(null);
  const [code, setCode] = useState(room.roomId);
  const [mapId, setMapId] = useState(joined.mapId);
  const [chat, setChat] = useState<Array<{ id: number; name: string; text: string }>>([]);
  const [rank, setRank] = useState<RankMsg>({ value: [], count: [], biggest: [] });
  const [rankTab, setRankTab] = useState<"value" | "count" | "biggest">("value");
  const [rankOpen, setRankOpen] = useState(() => window.innerWidth > 720); // 좁은 화면에서는 접어 둔다
  const [hudOpen, setHudOpen] = useState(() => window.innerWidth > 720); // 왼쪽 위 메뉴도 좁은 화면에서는 접어 둔다
  // 좁은 화면에서는 메뉴와 순위가 겹치니 하나를 열면 다른 하나는 접는다
  const toggleHud = () => { setHudOpen((o) => !o); if (window.innerWidth <= 720) setRankOpen(false); };
  const [toast, setToast] = useState("");
  const [flash, setFlash] = useState(0);
  const [announce, setAnnounce] = useState<{ text: string; rarity: Rarity } | null>(null);
  const [power, setPower] = useState(0);
  const [phase, setPhase] = useState("idle");
  const [mini, setMini] = useState<{ target: number; zoneWidth: number; speed: number; timeoutMs: number; startedAt: number } | null>(null);
  const [tug, setTug] = useState<(TugParams & { startedAt: number }) | null>(null);
  const bumpRef = useRef<(() => void) | null>(null);
  const [result, setResult] = useState<any>(null);
  const [text, setText] = useState("");
  const [players, setPlayers] = useState(1);
  const [clock, setClock] = useState({ night: false, left: 0 });
  const [lost, setLost] = useState(false);
  // 미끼: 낚시할 때 쓸지, 어떤 미끼를 쓸지 여기서 고른다(처음엔 안 씀)
  const [baitActive, setBaitActive] = useState<{ id: string; endAt: number } | null>(null); // 쓰는 중인 미끼와 끝나는 시각
  const [baitTick, setBaitTick] = useState(0);
  const [baitCounts, setBaitCounts] = useState<Record<string, number>>(() => ({ ...(profile.baits ?? {}) }));
  // 창: 인벤토리는 보기만, 상인(NPC)에게 가면 팔기·상점 창을 열 수 있다
  const [panel, setPanel] = useState<null | "inventory" | "npc" | "sell" | "shop" | "forge">(null);
  const [smithNear, setSmithNear] = useState(false);
  const [npcNear, setNpcNear] = useState(false);
  const npcNearRef = useRef(false);
  useEffect(() => { setBaitCounts({ ...(profile.baits ?? {}) }); }, [profile.baits]);
  const chatId = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const meRef = useRef(room.sessionId);

  useEffect(() => {
    const scene = new GameScene(stage.current!, room, joined.mapId || "lake", room.sessionId);
    sceneRef.current = scene;
    const off: Array<() => void> = [];
    const on = (t: string, f: (d: any) => void) => off.push(scene.bus.on(t, f));
    on("chat", (m) => setChat((c) => [...c.slice(-99), { id: ++chatId.current, name: m.name, text: m.text }]));
    on("ranking", setRank);
    on("baitLeft", (m: { id: string | null; left: number; ms?: number; out?: string }) => {
      if (m.out) { setToast("미끼가 없어요"); setTimeout(() => setToast(""), 2200); setBaitCounts((c) => ({ ...c, [m.out!]: 0 })); return; }
      if (m.id) {
        setBaitCounts((c) => ({ ...c, [m.id!]: m.left }));
        setBaitActive({ id: m.id, endAt: performance.now() + (m.ms ?? 60000) });
        sfx.click();
      }
    });
    on("toast", (t) => { setToast(t); setTimeout(() => setToast(""), 2200); sfx.fail(); });
    on("flash", () => { setFlash((n) => n + 1); setTimeout(() => setFlash(0), 1600); });
    on("announce", (m) => {
      setAnnounce({ text: `${m.name}님이 ${RARITY_LABEL[m.rarity as Rarity]} ${m.speciesName}을(를) 낚았어요! (${m.size}cm)`, rarity: m.rarity });
      setTimeout(() => setAnnounce(null), 4500);
      sfx.success(m.rarity);
    });
    on("charge", setPower);
    on("phase", (p) => {
      setPhase(p);
      if (p === "waiting") { sfx.cast(); setTimeout(() => sfx.splash(), 350); }
      if (p === "idle") { setMini(null); setTug(null); }
    });
    on("bite", () => sfx.bite());
    on("minigame", (m) => { setMini(m); sfx.reel(); });
    on("tug", (m) => { setMini(null); setTug(m); });
    on("pulled", () => bumpRef.current?.());
    on("result", (m) => {
      setMini(null);
      setTug(null);
      setResult(m);
      if (m.success) sfx.success(speciesById(m.catch.speciesId)?.rarity ?? "common");
      else sfx.fail();
    });
    on("emoteKey", (i: number) => scene.emote(EMOTES[i]));
    on("npcNear", (n: boolean) => { npcNearRef.current = n; setNpcNear(n); if (!n) setPanel((p) => (p === "npc" || p === "sell" || p === "shop" ? null : p)); });
    on("npcKey", () => setPanel((p) => p ?? "npc"));
    on("smithNear", (n: boolean) => { setSmithNear(n); if (!n) setPanel((p) => (p === "forge" ? null : p)); });
    on("smithKey", () => setPanel((p) => p ?? "forge"));

    room.onMessage("welcome", (m: any) => { setCode(m.code); setMapId(m.mapId); });
    const tick = setInterval(() => {
      setBaitTick((n) => n + 1);
      const players = room.state?.players;
      if (players) setPlayers(players.size);
      const now = scene.timeOfDayInfo();
      const phase = now % CYCLE_MS;
      setClock(phase < DAY_MS ? { night: false, left: DAY_MS - phase } : { night: true, left: CYCLE_MS - phase });
    }, 500);

    const joinedAt = Date.now();
    startBgm(joined.mapId || "lake");

    room.onLeave((c: number) => {
      // 정상 퇴장(1000, 4000)이 아니면 1분 동안 다시 접속을 시도한다
      if (c === 1000 || c === 4000) return;
      if (c === 4002) { onLeave(); return; } // 같은 계정으로 다른 곳에서 들어와 밀려났다
      setLost(true);
      const token = room.reconnectionToken;
      const started = Date.now();
      const conn = (navigator as any).connection;
      const info = { code: c, hidden: document.hidden, sinceVisChangeSec: Math.round((Date.now() - lastVisChange) / 1000), online: navigator.onLine, net: conn?.effectiveType ?? "", rttMs: conn?.rtt ?? null, inRoomSec: Math.round((Date.now() - joinedAt) / 1000), mobile: isTouch, map: joined.mapId };
      const report = (reconnected: boolean) => void api("/api/diag", { ...info, reconnected, afterSec: Math.round((Date.now() - started) / 1000) }).catch(() => {});
      const tryAgain = async () => {
        try {
          const back = await colyseus.reconnect(token);
          setLost(false);
          report(true);
          onRejoin(back);
        } catch {
          if (Date.now() - started < RECONNECT_SECONDS * 1000) setTimeout(tryAgain, 2000);
          else { report(false); onLeave(); }
        }
      };
      void tryAgain();
    });

    return () => {
      off.forEach((f) => f());
      clearInterval(tick);
      stopBgm();
      scene.dispose();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === "Enter") {
        if (document.activeElement === inputRef.current) {
          inputRef.current?.blur();
        } else {
          e.preventDefault();
          inputRef.current?.focus();
        }
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);

  const send = () => {
    const t = text.trim();
    if (t) room.send("chat", { text: t });
    setText("");
    inputRef.current?.blur();
  };

  const leave = async () => {
    await room.leave();
    onLeave();
  };

  // 팔거나 사고 나면 내 정보를 다시 읽고, 방에도 알려 모습·낚싯대를 맞춘다
  const afterChange = async () => {
    room.send("refresh");
    await reload();
  };

  const me = room.state?.players?.get(meRef.current);
  const isHost = room.state?.hostId === meRef.current;
  const map = BASE_MAPS[(mapId || "lake") as MapId];
  const rows = rank[rankTab];

  const hint =
    phase === "idle" ? (isTouch ? "🎣 버튼을 꾹 눌렀다 놓으면 낚싯대를 던져요" : "마우스(스페이스)를 꾹 눌렀다 놓으면 낚싯대를 던져요")
      : phase === "waiting" ? "찌를 지켜봐요... (C: 거두기)"
        : phase === "bite" ? "지금이에요! 클릭!"
          : "초록 칸에 맞춰 클릭!";

  return (
    <>
      <div className="stage" ref={stage} />
      <div className={`overlay ${isTouch ? "touch" : ""}`}>
        <div className={`hud-tl ${hudOpen ? "" : "closed"}`}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button className="hud-toggle btn small mint" onClick={toggleHud}>☰ 메뉴 {hudOpen ? "▲" : "▼"}</button>
            <div className="panel chip invite hud-fold">
              초대 코드 <b style={{ letterSpacing: 4, fontWeight: "normal", color: "var(--pink-deep)" }}>{code}</b>
              <button className="btn small pink" onClick={async () => { setToast(await shareInvite(code, map?.name ?? "")); setTimeout(() => setToast(""), 2500); }}>친구 초대</button>
            </div>
            <span className="panel chip">🪙 {profile.coins.toLocaleString()}</span>
            <span className="panel chip">💎 {(profile.stones ?? 0).toLocaleString()}</span>
          </div>
          <div className="hud-fold" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <span className="panel chip">{map?.name}</span>
            <span className="panel chip">👥 {players}/{MAX_PLAYERS}</span>
            <span className="panel chip">{clock.night ? "🌙 밤" : "☀️ 낮"} · {Math.ceil(clock.left / 60000)}분</span>
          </div>
          <div className="hud-fold" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn small mint" onClick={() => { sfx.click(); setPanel("inventory"); }}>🎒 인벤토리</button>
            <button className="btn small" onClick={() => { sfx.click(); const say = (t: string) => { setToast(t); setTimeout(() => setToast(""), 2200); }; void afterChange().then(() => say("내 정보를 새로 불러왔어요")).catch(() => say("불러오지 못했어요. 잠시 뒤에 다시 눌러 주세요")); }}>🔄 새로고침</button>
            <button className="btn small ghost" onClick={leave}>나가기</button>
          </div>
          {/* 미끼: 누르면 한 개를 쓰고 1분 동안 입질이 빨라진다. 쓰는 중이면 남은 시간이 보인다 */}
          {(baitActive || Object.values(baitCounts).some((n) => n > 0)) && (
            <div className="bait-row">
              {BAITS.map((b) => {
                const n = baitCounts[b.id] ?? 0;
                const leftSec = baitActive?.id === b.id ? Math.max(0, Math.ceil((baitActive.endAt - performance.now()) / 1000)) : 0;
                void baitTick;
                return (
                  <button
                    key={b.id}
                    className={`panel chip bait-chip ${leftSec > 0 ? "on" : ""}`}
                    disabled={n <= 0 || (baitActive ? baitActive.endAt > performance.now() : false)}
                    title={b.desc}
                    onClick={() => { room.send("bait", { id: b.id }); }}
                  >
                    {BAIT_EMOJI[b.id]} {b.name.replace(" 미끼", "")} ×{n}
                    {leftSec > 0 && <span className="left">⏱ {Math.floor(leftSec / 60)}:{String(leftSec % 60).padStart(2, "0")}</span>}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="hud-tr">
          <div className={`rank panel ${rankOpen ? "" : "closed"}`}>
            <button className="rank-toggle tab on" onClick={() => { setRankOpen((o) => !o); if (window.innerWidth <= 720) setHudOpen(false); }}>🏆 순위 {rankOpen ? "▲" : "▼"}</button>
            <div className="tabs">
              <button className={`tab ${rankTab === "value" ? "on" : ""}`} onClick={() => setRankTab("value")}>💰 가치</button>
              <button className={`tab ${rankTab === "count" ? "on" : ""}`} onClick={() => setRankTab("count")}>🐟 마릿수</button>
              <button className={`tab ${rankTab === "biggest" ? "on" : ""}`} onClick={() => setRankTab("biggest")}>📏 대물</button>
            </div>
            <ol>
              {rows.length === 0 && <li style={{ justifyContent: "center", color: "var(--ink-soft)" }}>아직 아무도 못 잡았어요</li>}
              {rows.slice(0, 8).map((r, i) => (
                <li key={r.sessionId}>
                  <span>{["🥇", "🥈", "🥉"][i] ?? `${i + 1}.`} {r.name}</span>
                  <span>{rankTab === "value" ? r.value : rankTab === "count" ? `${r.count}마리` : `${r.biggest?.size}cm`}</span>
                </li>
              ))}
            </ol>
          </div>
          {isHost && <span className="chip" style={{ fontSize: 13 }}>👑 내가 방장이에요</span>}
        </div>

        {flash > 0 && <div className="mythic-flash" key={flash} />}
        {announce && (
          <div className={`announce panel ${announce.rarity}`} style={{ borderColor: RARITY_COLOR[announce.rarity] }}>{announce.rarity === "mythic" ? "🌈✨" : "🎉"} {announce.text}</div>
        )}
        {toast && <div className="toast">{toast}</div>}

        <div className="chat">
          <div className="log">
            {[...chat].reverse().map((c) => (
              <div className="msg" key={c.id}><b>{c.name}</b>{c.text}</div>
            ))}
          </div>
          <input
            ref={inputRef}
            className="field"
            style={{ padding: "7px 14px", fontSize: 16, opacity: 0.92 }}
            placeholder="엔터를 눌러 채팅해요"
            maxLength={100}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); send(); } }}
          />
        </div>

        {power > 0 && <div className="charge"><i style={{ width: `${power * 100}%` }} /></div>}
        {phase === "bite" && (
          <div className="bite"><div className="bang">!</div><p>지금 클릭!</p></div>
        )}
        {mini && <Minigame mini={mini} />}
        {tug && <Tug tug={tug} bumpRef={bumpRef} onPull={() => sceneRef.current?.actionDown()} />}
        {!result && <div className="hint-bar">{hint}</div>}
        {smithNear && !panel && (
          <button className="btn sun npc-talk forge-talk" onClick={() => { sfx.click(); setPanel("forge"); }}>🔨 대장장이와 이야기하기 {isTouch ? "" : "(E)"}</button>
        )}
        {npcNear && !smithNear && !panel && (
          <button className="btn sun npc-talk" onClick={() => { sfx.click(); setPanel("npc"); }}>🧑‍🌾 상인 아저씨와 이야기하기 {isTouch ? "" : "(E)"}</button>
        )}

        <div className="emotes panel">
          {EMOTE_UI.map(([id, e, label], i) => (
            <button key={id} className="emote" title={label} onClick={() => { sfx.click(); sceneRef.current?.emote(id); }}>
              {e}<small>{i + 1}</small>
            </button>
          ))}
          <button className="emote" title="찌 거두기" disabled={phase === "idle"} onClick={() => sceneRef.current?.cancel()}>↩️</button>
        </div>

        {isTouch && <TouchControls scene={sceneRef} />}

        {result && <CatchCard result={result} onClose={() => setResult(null)} />}
      </div>
      {panel === "inventory" && <Inventory onClose={() => setPanel(null)} reload={afterChange} rod={rodLevelOf(profile.equipped)} canSell={false} />}
      {panel === "forge" && <Forge profile={profile} reload={afterChange} onClose={() => setPanel(null)} />}
      {panel === "sell" && <Inventory onClose={() => setPanel("npc")} reload={afterChange} rod={rodLevelOf(profile.equipped)} />}
      {panel === "shop" && <Shop onClose={() => setPanel("npc")} profile={profile} reload={afterChange} />}
      {panel === "npc" && (
        <Modal title="🧑‍🌾 상인 아저씨" onClose={() => setPanel(null)} narrow>
          <p style={{ marginTop: 0 }}>어서 와! 잡은 물고기를 팔거나, 필요한 걸 사 가렴.</p>
          <div style={{ display: "grid", gap: 10 }}>
            <button className="btn sun" onClick={() => setPanel("sell")}>🐟 물고기 팔기</button>
            <button className="btn mint" onClick={() => setPanel("shop")}>🛍️ 상점 (낚싯대·미끼·옷)</button>
            <button className="btn ghost" onClick={() => setPanel(null)}>다음에 올게요</button>
          </div>
        </Modal>
      )}
      {lost && <div className="leave-overlay"><div>연결이 끊겼어요<br />다시 연결하는 중... 🎣</div></div>}
    </>
  );
}

const isTouch = typeof window !== "undefined" && ("ontouchstart" in window || navigator.maxTouchPoints > 0);

function Minigame({ mini }: { mini: { target: number; zoneWidth: number; speed: number; timeoutMs: number; startedAt: number } }) {
  const cursor = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLElement>(null);
  useEffect(() => {
    let raf = 0;
    const loop = () => {
      const e = performance.now() - mini.startedAt;
      if (cursor.current) cursor.current.style.left = `${cursorAt(e, mini.speed) * 100}%`;
      if (bar.current) bar.current.style.width = `${Math.max(0, 1 - e / mini.timeoutMs) * 100}%`;
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [mini]);
  return (
    <div className="mini panel">
      <div style={{ fontSize: 22 }}>초록 칸에 맞춰서 클릭!</div>
      <div className="track">
        <div className="zone" style={{ left: `${(mini.target - mini.zoneWidth / 2) * 100}%`, width: `${mini.zoneWidth * 100}%` }} />
        <div className="cursor" ref={cursor} />
      </div>
      <div className="time"><i ref={bar as any} /></div>
    </div>
  );
}

// 접속이 끊긴 이유를 모으려고 탭이 보였다 가려진 시각을 기억해 둔다
let lastVisChange = Date.now();
if (typeof document !== "undefined") document.addEventListener("visibilitychange", () => { lastVisChange = Date.now(); });

/** 발작 시작 전 이만큼 앞부터 3-2-1을 보여 준다(숫자 하나에 0.5초, 합쳐서 1.5초) */
const FRENZY_WARN_MS = 1500;

/** 힘겨루기: 서버와 같은 계산으로 게이지를 보여 준다(판정은 서버가 한다) */
function Tug({ tug, onPull, bumpRef }: { tug: TugParams & { startedAt: number }; onPull: () => void; bumpRef: React.MutableRefObject<(() => void) | null> }) {
  const fill = useRef<HTMLDivElement>(null);
  const label = useRef<HTMLDivElement>(null);
  const state = useRef({ g: tug.start, at: 0 });
  const mythic = tug.frenzy.length > 0; // 발작이 있는 건 신화뿐이다
  const [intro, setIntro] = useState(mythic);
  const [count, setCount] = useState<number | null>(null);
  useEffect(() => {
    if (!mythic) return;
    sfx.mythicHook();
    const id = setTimeout(() => setIntro(false), 1400);
    return () => clearTimeout(id);
  }, [mythic, tug]);
  useEffect(() => {
    state.current = { g: tug.start, at: 0 };
    let raf = 0;
    let shown: number | null = null;
    const loop = () => {
      const t = performance.now() - tug.startedAt;
      const s = state.current;
      s.g = tugDecay(tug, s.g, s.at, t);
      s.at = t;
      // 발작이 1.5초 안에 시작하면 3 → 2 → 1
      const next = tug.frenzy.find(([from]) => t >= from - FRENZY_WARN_MS && t < from);
      const n = next ? (t < next[0] - 1000 ? 3 : t < next[0] - 500 ? 2 : 1) : null;
      if (n !== shown) { shown = n; setCount(n); if (n) sfx.countdown(n); }
      if (fill.current) fill.current.style.width = `${Math.max(0, Math.min(1, s.g)) * 100}%`;
      if (label.current) label.current.textContent = inFrenzy(tug, t) ? "⚠️ 날뛰는 중! 누르지 말고 버텨요!" : n ? "계속 눌러요! 숫자가 끝나면 손 떼요!" : isTouch ? "버튼을 마구 눌러요!" : "E 또는 스페이스를 연타해요!";
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => cancelAnimationFrame(raf);
  }, [tug]);
  // 키·마우스·버튼 어느 쪽으로 눌러도 GameScene이 서버로 보내고 "pulled"를 알려 주면 여기서 게이지 표시를 올린다
  useEffect(() => {
    bumpRef.current = () => {
      const s = state.current;
      const t = performance.now() - tug.startedAt;
      s.g = tugPull(tug, tugDecay(tug, s.g, s.at, t), t);
      s.at = t;
      sfx.click();
    };
    return () => { bumpRef.current = null; };
  }, [tug, bumpRef]);
  return (
    <>
      {intro && (
        <>
          <div className="mythic-flash" />
          <div className="mythic-intro"><b>🌈 신화다!! 🌈</b><span>발작할 땐 누르지 마세요!</span></div>
        </>
      )}
      {count !== null && <div className="frenzy-cd"><b key={count}>{count}</b><span>끝나면 손 떼요!</span></div>}
      <div className={`mini panel tug ${mythic ? "mythic" : ""}`}>
        <div ref={label} style={{ fontSize: 22 }} />
        <div className="track"><div className="tugfill" ref={fill} /></div>
        {isTouch && <button className="btn sun tugbtn" onPointerDown={(e) => { e.preventDefault(); onPull(); }}>당겨!</button>}
      </div>
    </>
  );
}

function CatchCard({ result, onClose }: { result: any; onClose: () => void }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter" || e.key === "Escape") { e.preventDefault(); onClose(); }
    };
    const t = setTimeout(onClose, 7000);
    window.addEventListener("keydown", k);
    return () => { window.removeEventListener("keydown", k); clearTimeout(t); };
  }, [onClose]);

  if (!result.success) {
    const msg = result.reason === "missed" ? "입질을 놓쳤어요..." : result.reason === "timeout" ? "시간이 다 됐어요" : "물고기가 도망갔어요!";
    return (
      <div className="catch panel" onClick={onClose}>
        <div style={{ fontSize: 54 }}>💦</div>
        <div className="name">{msg}</div>
        <p className="hint">다시 던져 볼까요?</p>
        <button className="btn ghost small">확인</button>
      </div>
    );
  }
  const sp = speciesById(result.catch.speciesId)!;
  const rewards = (result.rewards as string[]).map((id) => CODEX_REWARDS.find((r) => r.id === id)).filter(Boolean);
  return (
    <div className={`catch panel ${sp.rarity}`} onClick={onClose}>
      {result.isNew && <p className="new">✨ 새로운 물고기! 도감에 등록됐어요</p>}
      {result.isRecord && <p className="new">🏆 최대 크기 신기록!</p>}
      <FishIcon sp={sp} size={190} />
      <div className="name">{sp.name}</div>
      <div className="meta">
        <span className="badge" style={{ background: RARITY_COLOR[sp.rarity], fontSize: 15, padding: "3px 12px" }}>{RARITY_LABEL[sp.rarity]}</span>
        <span className="chip">📏 {result.catch.size}cm</span>
        <span className="chip">🪙 {result.price}</span>
      </div>
      {rewards.map((r) => (
        <p key={r!.id} className="new">🎁 {r!.title}{r!.items ? " · 전용 오라와 이모트를 받았어요!" : r!.coins ? ` · 🪙${r!.coins}` : ""}</p>
      ))}
      <button className="btn mint small">좋아요! (스페이스)</button>
    </div>
  );
}

/** 모바일 터치 조작: 가상 조이스틱과 낚시 버튼 */
function TouchControls({ scene }: { scene: React.MutableRefObject<GameScene | null> }) {
  const knob = useRef<HTMLElement>(null);
  const base = useRef<HTMLDivElement>(null);
  const active = useRef(false);
  const move = (e: React.PointerEvent) => {
    if (!active.current || !base.current) return;
    const r = base.current.getBoundingClientRect();
    let x = (e.clientX - (r.left + r.width / 2)) / (r.width / 2);
    let y = (e.clientY - (r.top + r.height / 2)) / (r.height / 2);
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    if (knob.current) knob.current.style.transform = `translate(${x * 40}px, ${y * 40}px)`;
    scene.current?.setJoystick(x, -y);
  };
  const end = () => {
    active.current = false;
    if (knob.current) knob.current.style.transform = "";
    scene.current?.setJoystick(0, 0);
  };
  return (
    <>
      <div
        className="stick"
        ref={base}
        onPointerDown={(e) => { active.current = true; (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        <i ref={knob as any} />
      </div>
      <button
        className="btn pink fishbtn"
        onPointerDown={() => scene.current?.actionDown()}
        onPointerUp={() => scene.current?.actionUp()}
      >
        🎣
      </button>
    </>
  );
}
