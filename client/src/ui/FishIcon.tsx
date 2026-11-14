import type { FishSpecies, Rarity } from "@fishing/shared";
import { useEffect, useState } from "react";
import { speciesColors, speciesPattern } from "../three/fishModel";
import { cachedFishIcon, fishIconUrl } from "../three/fishIcon3d";
import { MythicArt, hasMythicArt } from "./MythicArt";

export const RARITY_LABEL: Record<Rarity, string> = {
  common: "일반", rare: "희귀", veryRare: "매우 희귀", legendary: "전설", mythic: "신화",
};
export const RARITY_COLOR: Record<Rarity, string> = {
  common: "#9aa6b2", rare: "#4aa3ff", veryRare: "#b46bff", legendary: "#ffb020", mythic: "#ff4d6d",
};

const hex = (c: { getHexString(): string }) => `#${c.getHexString()}`;

/** 도감과 인벤토리에 쓰는 2D 물고기 그림 (종마다 색과 무늬가 다르다) */
export function FishIcon({ sp, size = 96, silhouette = false }: { sp: FishSpecies; size?: number; silhouette?: boolean }) {
  const special = sp.rarity === "legendary" || (!!sp.look && !silhouette); // 수중 탐험 물고기는 특색 부품이 보이도록 3D 모델을 찍은 그림을 쓴다(못 잡은 것은 그림자라 2D)
  const [img, setImg] = useState<string | null>(() => (special ? cachedFishIcon(sp.id) : null));
  useEffect(() => { setImg(special ? cachedFishIcon(sp.id) : null); }, [sp.id]); // 같은 자리에서 다른 물고기로 바뀌면 앞 그림을 지운다
  useEffect(() => {
    if (!special || img) return;
    let alive = true;
    void fishIconUrl(sp).then((u) => alive && u && setImg(u));
    return () => { alive = false; };
  }, [sp.id, special, img]);
  if (sp.body === "shell") { // 수중 탐험에서 줍는 조개(물고기 모양이 아니다)
    const c = sp.name === "소라" ? ["#ffd6a0", "#e8a35c"] : sp.name === "진주조개" ? ["#e3defc", "#a99be0"] : ["#ffb8cb", "#e98aa5"];
    const k = silhouette ? ["#8a93a8", "#7a839a"] : c;
    return (
      <svg width={size} height={size} viewBox="0 0 100 100">
        {sp.name === "소라" ? (
          <>
            <path d="M22 62 C20 36 44 20 66 30 C84 38 86 62 66 74 C50 82 28 80 22 62Z" fill={k[0]} stroke={k[1]} strokeWidth="3" />
            <path d="M34 60 C36 44 52 38 62 46 C70 54 62 66 50 66" fill="none" stroke={k[1]} strokeWidth="3" strokeLinecap="round" />
            <circle cx="52" cy="56" r="4" fill={k[1]} />
          </>
        ) : (
          <>
            <path d="M50 18 C80 18 92 48 86 70 C70 84 30 84 14 70 C8 48 20 18 50 18Z" fill={k[0]} stroke={k[1]} strokeWidth="3" />
            {[-34, -17, 0, 17, 34].map((x) => <path key={x} d={`M50 78 L${50 + x * 1.5} 26`} stroke={k[1]} strokeWidth="2.5" strokeLinecap="round" />)}
            <rect x="38" y="76" width="24" height="10" rx="4" fill={k[1]} />
            {sp.name === "진주조개" && !silhouette && <circle cx="50" cy="52" r="9" fill="#fff" stroke="#cfc8f2" strokeWidth="2" />}
          </>
        )}
      </svg>
    );
  }
  const { base, belly, accent } = speciesColors(sp);
  const b = silhouette ? "#8a93a8" : hex(base);
  const bl = silhouette ? "#9aa3b8" : hex(belly);
  const ac = silhouette ? "#7a839a" : hex(accent);
  const id = `g-${sp.id}`;
  const pat = speciesPattern(sp);
  const pattern = pat === "bands" ? "stripes" : ["freckles", "mottled", "patches", "parr"].includes(pat) ? "spots" : pat;
  const body = sp.body;
  let shape: React.ReactElement;
  const eye = (x: number, y: number) =>
    silhouette ? null : (
      <>
        <circle cx={x} cy={y} r="6.6" fill="#fff" stroke="#4a3b52" strokeWidth="1.4" />
        <circle cx={x + 1.2} cy={y + 0.4} r="4.4" fill="#2b2230" />
        <circle cx={x + 2.8} cy={y - 1.6} r="1.7" fill="#fff" />
        <circle cx={x - 0.6} cy={y + 2} r="0.9" fill="#fff" />
      </>
    );
  const clip = `${id}-c`;
  if (body === "eel") {
    shape = (
      <>
        <path id={clip} d="M12 46 C30 20 44 70 66 44 S96 30 108 38 L108 50 C96 56 86 70 66 56 S30 84 12 56 Z" fill={`url(#${id})`} stroke="#4a3b52" strokeWidth="2" />
        {eye(100, 42)}
      </>
    );
  } else if (body === "ray") {
    shape = (
      <>
        <path d="M60 14 C100 34 108 46 60 62 C12 46 20 34 60 14Z" fill={`url(#${id})`} stroke="#4a3b52" strokeWidth="2" />
        <path d="M60 60 L58 76 L62 76 Z" fill={ac} />
        {eye(52, 34)}
        {eye(68, 34)}
      </>
    );
  } else if (body === "squid") {
    shape = (
      <>
        <path d="M18 40 C30 20 62 22 80 36 L80 46 C62 60 30 60 18 40Z" fill={`url(#${id})`} stroke="#4a3b52" strokeWidth="2" />
        {[0, 1, 2, 3].map((i) => <path key={i} d={`M80 ${34 + i * 4} q14 ${i % 2 ? 6 : -6} 28 ${i * 2 - 3}`} stroke={b} strokeWidth="3.2" fill="none" strokeLinecap="round" />)}
        {eye(70, 36)}
      </>
    );
  } else {
    const rx = body === "round" || body === "puffer" ? 30 : body === "whale" || body === "shark" ? 46 : body === "slim" ? 44 : 38;
    const ry = body === "round" || body === "puffer" ? 28 : body === "flat" ? 28 : body === "slim" ? 15 : body === "shark" ? 18 : body === "whale" ? 26 : 22;
    const cx = 60 - (46 - rx) * 0.2;
    shape = (
      <>
        <path d={`M${cx - rx + 2} 40 L${cx - rx - 14} ${40 - 16} Q${cx - rx - 6} 40 ${cx - rx - 14} ${40 + 16} Z`} fill={ac} stroke="#4a3b52" strokeWidth="2" strokeLinejoin="round" />
        <path d={`M${cx - rx * 0.2} ${40 - ry + 2} Q${cx} ${40 - ry - 16} ${cx + rx * 0.35} ${40 - ry + 3} Z`} fill={ac} stroke="#4a3b52" strokeWidth="2" strokeLinejoin="round" />
        <ellipse cx={cx} cy="40" rx={rx} ry={ry} fill={`url(#${id})`} stroke="#4a3b52" strokeWidth="2" />
        {pattern === "stripes" && !silhouette && [-0.35, -0.05, 0.25].map((k, i) => <path key={i} d={`M${cx + rx * k} ${40 - ry * 0.85} Q${cx + rx * k + 4} 40 ${cx + rx * k} ${40 + ry * 0.4}`} stroke={ac} strokeWidth="4" fill="none" opacity=".8" />)}
        {pattern === "spots" && !silhouette && [[-0.3, -0.3], [0, -0.1], [-0.15, 0.2], [0.25, -0.35], [0.3, 0.1]].map(([x, y], i) => <circle key={i} cx={cx + rx * x} cy={40 + ry * y} r={3 + (i % 2)} fill={ac} opacity=".8" />)}
        {pattern === "sidestripe" && !silhouette && <path d={`M${cx - rx * 0.8} 40 Q${cx} 36 ${cx + rx * 0.7} 41`} stroke={ac} strokeWidth="6" fill="none" strokeLinecap="round" />}
        <path d={`M${cx - 4} 46 q10 8 20 -2`} stroke="#4a3b52" strokeWidth="2" fill="none" opacity=".35" />
        {eye(cx + rx * 0.55, 36 - ry * 0.05)}
        {sp.features.includes("horn") && <path d={`M${cx + rx * 0.5} ${40 - ry + 3} l4 -14 l4 14Z`} fill={ac} stroke="#4a3b52" strokeWidth="1.6" />}
        {sp.features.includes("whiskers") && <path d={`M${cx + rx} 44 q8 4 14 10 M${cx + rx} 46 q10 0 16 4`} stroke="#4a3b52" strokeWidth="1.6" fill="none" />}
      </>
    );
  }
  if (sp.rarity === "mythic" && hasMythicArt(sp.name)) return <MythicArt name={sp.name} size={size} silhouette={silhouette} />; // 직접 그린 일러스트
  // 전설은 3D 모델로 찍은 그림을 쓴다(아직 못 만들었으면 기본 그림)
  if (special && img) {
    return <img src={img} width={size} height={(size * 2) / 3} alt={sp.name} draggable={false} style={{ objectFit: "contain", filter: silhouette ? "brightness(0) opacity(0.35)" : undefined }} />;
  }
  return (
    <svg viewBox="0 0 120 80" width={size} height={(size * 80) / 120} style={{ overflow: "visible" }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={b} />
          <stop offset="0.6" stopColor={b} />
          <stop offset="1" stopColor={bl} />
        </linearGradient>
      </defs>
      {shape}
      {sp.rarity === "legendary" && !silhouette && (
        <g fill="#ffd45a">
          <path d="M104 8 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2Z" />
          <path d="M14 14 l1.5 3.5 3.5 1.5 -3.5 1.5 -1.5 3.5 -1.5 -3.5 -3.5 -1.5 3.5 -1.5Z" />
        </g>
      )}
    </svg>
  );
}
