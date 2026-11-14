import { useMemo, useState } from "react";
import { HARPOONS, MAX_HARPOON, MAX_ROD, RODS, STONE_PRICE, ROD_SELL_BONUS, harpoonLevelOf, harpoonStats, rarityOdds, rodEffects, rodLevelOf } from "@fishing/shared";
import type { PlayerProfile } from "@fishing/shared";
import { sfx } from "../audio";
import { api } from "../net";
import { HarpoonPreview, RodPreview } from "./Lobby";

type Phase = "idle" | "charging" | "success" | "fail" | "result";
interface Result { success: boolean; from: number; to: number; spent: { stones: number; coins: number } }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 단계에 따른 능력치(강화 전후를 비교해서 보여 준다) */
function stats(level: number, harpoon = false): Array<[string, string]> {
  if (harpoon) {
    const h = harpoonStats(level);
    return [
      ["사거리", `${h.range.toFixed(1)}m`],
      ["작살 속도", `${h.speed.toFixed(1)}m/s`],
      ["재장전", `${(h.cooldownMs / 1000).toFixed(2)}초`],
      ["조준 안정", `${Math.round((1 - h.steady) * 100)}%`],
    ];
  }
  const e = rodEffects(level);
  const o = rarityOdds(level);
  const pct = (x: number) => `${(x * 100).toFixed(2)}%`; // 신화처럼 작은 값도 보이게 소수 둘째 자리까지
  return [
    ["희귀 확률", pct(o.rare)],
    ["매우 희귀 확률", pct(o.veryRare)],
    ["전설 확률", pct(o.legendary)],
    ["신화 확률", pct(o.mythic)],
    ["던지는 거리", `+${Math.round((e.castMul - 1) * 100)}%`],
    ["타이밍 칸", `+${Math.round((e.zoneMul - 1) * 100)}%`],
    ["물고기 판매가", `+${(ROD_SELL_BONUS * level * 100).toFixed(1).replace(/\.0$/, "")}%`],
  ];
}

/** 대장장이에게서 낚싯대를 강화하는 화면: 재료와 코인을 보여 주고, 불꽃 연출 뒤에 성공·실패 결과를 보여 준다 */
export function Forge({ profile, reload, onClose, kind = "rod", onUpgraded }: { profile: PlayerProfile; reload: () => Promise<void>; onClose: () => void; kind?: "rod" | "harpoon"; onUpgraded?: () => void }) {
  const H = kind === "harpoon"; // 수중 탐험의 작살총 강화도 같은 화면을 쓴다
  const TABLE = H ? HARPOONS : RODS, MAX = H ? MAX_HARPOON : MAX_ROD, NAME = H ? "작살총" : "낚싯대";
  const Pv = ({ level }: { level: number }) => (H ? <HarpoonPreview level={level} /> : <RodPreview level={level} />);
  const level = H ? harpoonLevelOf(profile.equipped) : rodLevelOf(profile.equipped);
  const next = level < MAX ? TABLE[level + 1] : null;
  const haveStones = profile.stones ?? 0;
  const haveCoins = profile.coins;
  const enough = !!next && haveStones >= next.cost && haveCoins >= next.coins;
  const [phase, setPhase] = useState<Phase>("idle");
  const [res, setRes] = useState<Result | null>(null);
  const [err, setErr] = useState("");
  const [run, setRun] = useState(0);
  // 불꽃·재 알갱이: 한 번 정한 방향과 거리를 쓴다
  const bits = useMemo(() => Array.from({ length: 40 }, (_, i) => ({ a: (i / 40) * 360 + (i % 3) * 7, r: 90 + ((i * 53) % 170), d: 0.7 + ((i * 37) % 60) / 100, s: 3 + (i % 4) * 2 })), [run]);

  const buy = async (count: number) => {
    setErr("");
    try {
      await api("/api/stone/buy", { count });
      sfx.success("rare");
      await reload();
    } catch (e) {
      sfx.fail();
      setErr(e instanceof Error ? e.message : "사지 못했어요");
    }
  };

  const go = async () => {
    if (!next || !enough || phase !== "idle") return;
    setErr("");
    setRun((n) => n + 1);
    setPhase("charging");
    sfx.reel();
    const t0 = Date.now();
    try {
      const r = await api(H ? "/api/harpoon/upgrade" : "/api/rod/upgrade", {});
      await sleep(Math.max(0, 1800 - (Date.now() - t0))); // 모으는 연출은 항상 같은 길이
      const out: Result = { success: !!r.success, from: level, to: r.success ? level + 1 : level, spent: r.spent };
      setRes(out);
      setPhase(out.success ? "success" : "fail");
      if (out.success) sfx.success("legendary"); else sfx.fail();
      await sleep(1700);
      setPhase("result");
      await reload(); // 결과 창이 뜬 다음에 내 정보를 새로 읽는다
      onUpgraded?.();
    } catch (e) {
      setPhase("idle");
      setErr(e instanceof Error ? e.message : "강화하지 못했어요");
    }
  };

  const showLevel = phase === "result" && res ? res.to : level;
  const cur = stats(level, H), nxt = next ? stats(level + 1, H) : null;

  return (
    <div className="forge-back" onClick={phase === "idle" ? onClose : undefined}>
      <div className={`forge ${phase === "charging" ? "shake" : ""} ${phase === "fail" ? "fail" : ""}`} onClick={(e) => e.stopPropagation()}>
        <button className="forge-x" onClick={onClose} disabled={phase !== "idle"} aria-label="닫기">✕</button>
        <div className="forge-title">🔨 {NAME} 강화</div>

        <div className="forge-item"><Pv level={showLevel} /></div>
        <div className="forge-name">{TABLE[showLevel].name}</div>
        {next ? (
          <div className="forge-step"><b>{level}단계</b> <span className="arrows">›››</span> <b className="to">{level + 1}단계</b></div>
        ) : (
          <div className="forge-step"><b className="to">최고 단계예요</b></div>
        )}

        {/* 가운데 구슬: 성공 확률 */}
        <div className={`forge-stage ${phase}`}>
          <div className="wing l" /><div className="wing r" />
          <div className="orb">
            <div className="pct">{next ? `${Math.round(next.rate * 100)}%` : "MAX"}</div>
            <div className="lbl">성공 확률</div>
          </div>
          <div className="ring a" /><div className="ring b" />
          {(phase === "charging" || phase === "success" || phase === "fail") && (
            <div className={`bits ${phase}`}>
              {bits.map((b, i) => (
                <i key={`${run}-${i}`} style={{ ["--a" as any]: `${b.a}deg`, ["--r" as any]: `${b.r}px`, ["--d" as any]: `${b.d}s`, width: b.s, height: b.s }} />
              ))}
            </div>
          )}
        </div>

        {/* 재료 칸: 가진 수 / 필요한 수 */}
        {next && (
          <div className="forge-mats">
            <div className={`slot ${haveStones >= next.cost ? "" : "lack"}`}><div className="ic">💎</div><div className="nm">강화석</div><div className="ct"><b>{haveStones.toLocaleString()}</b> / {next.cost.toLocaleString()}</div></div>
            <div className={`slot ${haveCoins >= next.coins ? "" : "lack"}`}><div className="ic">🪙</div><div className="nm">코인</div><div className="ct"><b>{haveCoins.toLocaleString()}</b> / {next.coins.toLocaleString()}</div></div>
          </div>
        )}
        {next && (
          <div className="forge-cost">
            <div><span className="k">강화 비용</span><span>💎 {next.cost.toLocaleString()}</span><span>🪙 {next.coins.toLocaleString()}</span></div>
            <div><span className="k">소지 금액</span><span className={haveStones >= next.cost ? "ok" : "bad"}>💎 {haveStones.toLocaleString()}</span><span className={haveCoins >= next.coins ? "ok" : "bad"}>🪙 {haveCoins.toLocaleString()}</span></div>
          </div>
        )}
        {nxt && (
          <div className="forge-fx">
            {nxt.slice(0, 4).map(([k, v], i) => <div key={k}><span>{k}</span><span>{cur[i][1]} <em>›</em> <b>{v}</b></span></div>)}
          </div>
        )}
        <div className="forge-buy">
          <span>💎 강화석 사기 (1개 🪙 {STONE_PRICE})</span>
          {[1, 10, 100].map((n) => (
            <button key={n} disabled={phase !== "idle" || haveCoins < n * STONE_PRICE} onClick={() => void buy(n)}>{n}개 · 🪙 {(n * STONE_PRICE).toLocaleString()}</button>
          ))}
        </div>
        <p className="forge-hint">{H ? "" : "확률은 네 맵·낮밤 평균이에요. "}강화는 확률로 성공해요. 실패하면 강화석과 코인만 사라지고 단계는 그대로예요.</p>
        {err && <p className="err">{err}</p>}
        <button className="forge-go" disabled={!enough || phase !== "idle"} onClick={go}>
          {!next ? `이미 가장 좋은 ${NAME}이에요` : !enough ? "재료나 코인이 부족해요" : `${NAME} 강화`}
        </button>

        {/* 강화 결과 창 */}
        {phase === "result" && res && (
          <div className={`forge-result ${res.success ? "ok" : "no"}`} onClick={() => { setPhase("idle"); setRes(null); }}>
            <div className="rays" />
            <div className="box">
              <div className="ricon"><Pv level={res.to} /></div>
              <div className="rname">{TABLE[res.to].name}</div>
              <div className="rstep">{res.to}단계</div>
              <div className="rtitle">{res.success ? "강화 성공" : "강화 실패"}</div>
              <div className="rrows">
                {res.success
                  ? stats(res.to, H).slice(0, 4).map(([k, v], i) => <div key={k}><span>{k}</span><span>{stats(res.from, H)[i][1]} <em>›››</em> <b>{v}</b> <i>▲</i></span></div>)
                  : <>
                      <div><span>강화석</span><span className="bad">−{res.spent.stones.toLocaleString()}</span></div>
                      <div><span>코인</span><span className="bad">−{res.spent.coins.toLocaleString()}</span></div>
                      <div><span>{NAME} 단계</span><span>{res.from}단계 유지</span></div>
                    </>}
              </div>
              <div className="rok">화면을 누르면 닫혀요</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
