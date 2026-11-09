import type { ReactElement } from "react";

// 신화 물고기 8종을 직접 그린 일러스트(벡터). 도감·인벤토리·카드에서 쓴다. 좌표는 240 x 160 칸.
const L = "#5a4a78"; // 윤곽선 색(부드러운 진한 보라)
const o = { stroke: L, strokeWidth: 1.6, strokeLinejoin: "round" as const };

function Defs({ id, stops }: { id: string; stops: Array<{ k: string; kind?: "lin" | "rad"; from: [string, string?, string?]; to?: [string, string?, string?] }> }) {
  return (
    <defs>
      {stops.map((s) => (
        s.kind === "rad" ? (
          <radialGradient key={s.k} id={`${id}-${s.k}`}>
            <stop offset="0" stopColor={s.from[0]} />
            <stop offset="0.55" stopColor={s.from[1] ?? s.from[0]} />
            <stop offset="1" stopColor={s.from[2] ?? s.from[0]} stopOpacity={s.to ? 0 : 1} />
          </radialGradient>
        ) : (
          <linearGradient key={s.k} id={`${id}-${s.k}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={s.from[0]} />
            <stop offset="0.5" stopColor={s.from[1] ?? s.from[0]} />
            <stop offset="1" stopColor={s.from[2] ?? s.from[0]} />
          </linearGradient>
        )
      ))}
    </defs>
  );
}

const Sparkle = ({ x, y, r = 4, c = "#fff8c8" }: { x: number; y: number; r?: number; c?: string }) => (
  <path d={`M${x} ${y - r} L${x + r * 0.28} ${y - r * 0.28} L${x + r} ${y} L${x + r * 0.28} ${y + r * 0.28} L${x} ${y + r} L${x - r * 0.28} ${y + r * 0.28} L${x - r} ${y} L${x - r * 0.28} ${y - r * 0.28}Z`} fill={c} />
);

/** 눈: 크고 동그란 귀여운 눈 */
const Eye = ({ x, y, r = 6, iris = "#3a2a4a" }: { x: number; y: number; r?: number; iris?: string }) => (
  <g>
    <circle cx={x} cy={y} r={r} fill="#fff" stroke={L} strokeWidth="1.3" />
    <circle cx={x + r * 0.12} cy={y + r * 0.05} r={r * 0.72} fill={iris} />
    <circle cx={x + r * 0.12} cy={y + r * 0.05} r={r * 0.4} fill="#120a1c" />
    <circle cx={x + r * 0.38} cy={y - r * 0.3} r={r * 0.26} fill="#fff" />
    <circle cx={x - r * 0.25} cy={y + r * 0.3} r={r * 0.12} fill="#fff" />
  </g>
);

// ------------------------------------------------------------------ 천년이무기
function Imugi() {
  const id = "imugi";
  const body = "M72 62 C100 46 150 36 172 70 C192 102 150 128 120 114 C92 102 108 76 132 86";
  return (
    <g>
      <Defs id={id} stops={[{ k: "glow", kind: "rad", from: ["#fff6b0", "#ffd860", "#ffd860"], to: ["x"] }]} />
      <circle cx="40" cy="34" r="22" fill={`url(#${id}-glow)`} />
      <circle cx="40" cy="34" r="9" fill="#ffd24a" stroke="#c88a10" strokeWidth="1.4" />
      <circle cx="37" cy="31" r="3" fill="#fff8d0" />
      <circle cx="40" cy="34" r="16" fill="none" stroke="#ffe890" strokeWidth="1" strokeDasharray="3 3" opacity=".8" />
      <path d={body} fill="none" stroke="#ffcc3a" strokeWidth="24" strokeDasharray="2.6 9" strokeLinecap="round" />
      <path d={body} fill="none" stroke={L} strokeWidth="19" strokeLinecap="round" />
      <path d={body} fill="none" stroke="#0e8f6a" strokeWidth="16.5" strokeLinecap="round" />
      <path d={body} fill="none" stroke="#18b88a" strokeWidth="9" strokeLinecap="round" transform="translate(0 -2)" />
      <path d={body} fill="none" stroke="#fff0b8" strokeWidth="5" strokeLinecap="round" transform="translate(0 4)" opacity=".95" />
      <path d={body} fill="none" stroke="#ffd860" strokeWidth="3.2" strokeDasharray="0.1 8" strokeLinecap="round" transform="translate(0 -3)" />
      {/* 꼬리 끝 */}
      <path d="M132 86 C142 82 150 88 146 96 C138 92 132 92 132 86Z" fill="#18b88a" {...o} />
      <path d="M142 92 C150 100 142 110 132 108 C138 104 138 98 142 92Z" fill="#ffe27a" {...o} />
      {/* 하얀 갈기 */}
      {[[88, 66, -30], [94, 74, -10], [84, 56, -50], [98, 60, -40]].map(([x, y, r], i) => (
        <path key={i} d="M0 0 C14 -6 22 2 30 10 C18 8 8 6 0 0Z" fill="#fff8ec" stroke="#e6d8c0" strokeWidth="0.8" transform={`translate(${x} ${y}) rotate(${r})`} />
      ))}
      {/* 머리 */}
      <path d="M60 56 C66 40 90 40 94 58 C96 74 70 80 60 70 C54 66 54 60 60 56Z" fill="#14a07a" {...o} />
      <path d="M46 62 C50 56 60 58 62 66 C60 74 48 74 44 68Z" fill="#6fe0b8" {...o} />
      <path d="M52 70 C58 74 66 72 70 68" stroke={L} strokeWidth="1.2" fill="none" />
      <circle cx="49" cy="64" r="1.2" fill={L} />
      <Eye x={75} y={56} r={7} iris="#ffcc3a" />
      <path d="M78 44 C84 30 94 28 100 22 M88 36 C92 30 98 32 102 30 M86 42 C94 40 100 44 104 42" stroke="#ffcc3a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <path d="M72 44 C70 34 62 30 56 26 M66 38 C62 34 58 36 54 34" stroke="#ffcc3a" strokeWidth="2.6" fill="none" strokeLinecap="round" />
      <path d="M50 70 C40 80 30 78 22 86 C30 92 44 86 52 76" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M58 72 C50 88 56 100 46 110" stroke="#fff" strokeWidth="2.2" fill="none" strokeLinecap="round" />
      <Sparkle x={20} y={58} r={4} /><Sparkle x={200} y={30} r={5} c="#fff0b0" /><Sparkle x={210} y={120} r={3.5} c="#c8fff0" />
    </g>
  );
}

// ------------------------------------------------------------------ 연화봉황어
function Phoenix() {
  const id = "phx";
  return (
    <g>
      <Defs id={id} stops={[
        { k: "body", from: ["#ffb040", "#ffd890", "#fff2e2"] },
        { k: "tail", from: ["#ffd24a", "#ff8a5a", "#ff4a7a"] },
        { k: "tail2", from: ["#fff0c8", "#ffc080", "#ff6a8a"] },
      ]} />
      {/* 꼬리 깃털 5개 */}
      {[
        "M96 88 C70 70 40 60 20 30 C50 34 82 56 100 84Z",
        "M96 90 C66 84 30 86 10 70 C40 66 78 78 100 88Z",
        "M96 94 C68 100 34 112 14 130 C44 130 80 114 100 94Z",
        "M98 96 C80 116 60 134 52 152 C76 142 96 124 104 98Z",
        "M96 86 C72 56 60 30 40 14 C66 20 90 50 102 82Z",
      ].map((d, i) => <path key={i} d={d} fill={`url(#${id}-${i % 2 ? "tail2" : "tail"})`} {...o} strokeWidth={1.3} />)}
      {/* 등 깃털 */}
      <path d="M118 56 C130 32 156 22 176 24 C160 32 150 46 140 62Z" fill={`url(#${id}-tail2)`} {...o} strokeWidth={1.3} />
      <path d="M126 58 C142 44 166 42 188 50 C170 52 156 62 138 70Z" fill={`url(#${id}-tail)`} {...o} strokeWidth={1.3} />
      {/* 몸 */}
      <ellipse cx="124" cy="86" rx="44" ry="31" fill={`url(#${id}-body)`} {...o} />
      <path d="M104 100 C124 112 150 108 162 94" stroke="#ffc8d0" strokeWidth="3" fill="none" strokeLinecap="round" opacity=".8" />
      {[[116, 82], [130, 74], [136, 92], [112, 98], [124, 88]].map(([x, y], i) => <path key={i} d={`M${x - 5} ${y} q5 -5 10 0`} stroke="#ffb860" strokeWidth="1.4" fill="none" opacity=".8" />)}
      {/* 가슴 깃털 */}
      <path d="M128 98 C140 118 130 140 108 148 C106 130 112 112 126 100Z" fill={`url(#${id}-tail2)`} {...o} strokeWidth={1.3} />
      <path d="M134 100 C154 114 158 136 144 150 C136 134 130 118 132 102Z" fill={`url(#${id}-tail)`} {...o} strokeWidth={1.3} />
      {/* 봉황 볏과 금관 */}
      {[[150, 50, -12], [156, 52, 6], [144, 52, -30]].map(([x, y, r], i) => (
        <path key={i} d="M0 0 C-6 -10 -2 -22 4 -30 C10 -18 10 -8 4 0Z" fill={i === 1 ? "#ff3a4a" : "#ff6a5a"} {...o} strokeWidth={1.2} transform={`translate(${x} ${y}) rotate(${r})`} />
      ))}
      <path d="M142 58 q10 -8 22 -2 l-3 5 q-8 -5 -16 0Z" fill="#ffd24a" {...o} strokeWidth={1.2} />
      <circle cx="152" cy="55" r="2" fill="#ff3a4a" />
      <Eye x={152} y={80} r={7} iris="#ff6a3a" />
      <path d="M164 90 q4 3 8 0" stroke={L} strokeWidth="1.5" fill="none" strokeLinecap="round" />
      <circle cx="146" cy="92" r="4" fill="#ffb0b8" opacity=".6" />
      {/* 연꽃잎 */}
      {[[30, 110, 20], [200, 44, -30], [184, 126, 40], [40, 146, -20]].map(([x, y, r], i) => <ellipse key={i} cx={x} cy={y} rx="7" ry="3.2" fill="#ffb0c8" stroke="#ff8aa8" strokeWidth="0.8" transform={`rotate(${r} ${x} ${y})`} />)}
      <Sparkle x={208} y={96} r={5} /><Sparkle x={18} y={16} r={4} c="#ffe0a0" />
    </g>
  );
}

// ------------------------------------------------------------------ 용왕의 해신수
function DragonKingTurtle() {
  const id = "dkt";
  const hex = (cx: number, cy: number, r: number, fill: string, k: string) => {
    const pts = Array.from({ length: 6 }, (_, i) => `${cx + Math.cos((i / 6) * Math.PI * 2) * r},${cy + Math.sin((i / 6) * Math.PI * 2) * r * 0.8}`).join(" ");
    return <polygon key={k} points={pts} fill={fill} stroke="#c8801a" strokeWidth="1.4" strokeLinejoin="round" />;
  };
  return (
    <g>
      <Defs id={id} stops={[
        { k: "shell", from: ["#34c8b8", "#16a0a0", "#0c6a80"] },
        { k: "skin", from: ["#4adac8", "#1fb0b0", "#c8fff0"] },
      ]} />
      {/* 물방울 */}
      {[[26, 30, 7], [214, 40, 9], [200, 130, 6], [34, 120, 5]].map(([x, y, r], i) => <g key={i}><circle cx={x} cy={y} r={r} fill="#d8f8ff" opacity=".55" stroke="#9adff0" strokeWidth="1" /><circle cx={x - r * 0.3} cy={y - r * 0.3} r={r * 0.25} fill="#fff" /></g>)}
      {/* 뒷지느러미와 꼬리 */}
      <path d="M62 112 C40 124 34 142 50 148 C66 142 76 128 80 116Z" fill={`url(#${id}-skin)`} {...o} />
      <path d="M52 146 q-2 4 -8 2" stroke="#ffd24a" strokeWidth="3" strokeLinecap="round" />
      <path d="M44 86 C28 88 20 96 16 108 C26 104 38 102 50 100Z" fill={`url(#${id}-skin)`} {...o} />
      <circle cx="18" cy="106" r="3" fill="#ff8a6a" stroke="#c8501a" strokeWidth=".8" />
      {/* 배갑과 등껍질 */}
      <path d="M52 100 C54 60 96 38 140 52 C170 62 184 86 176 108 C140 124 80 124 52 100Z" fill={`url(#${id}-shell)`} {...o} />
      <path d="M58 100 C78 114 148 116 172 104" stroke="#ffd24a" strokeWidth="5" fill="none" strokeLinecap="round" />
      {hex(112, 76, 22, "#ff9a7a", "c")}
      {hex(84, 86, 16, "#ff8a6a", "l")}
      {hex(142, 84, 16, "#ff8a6a", "r")}
      {hex(110, 100, 14, "#ffb090", "b")}
      {hex(152, 100, 11, "#ffb090", "b2")}
      <circle cx="112" cy="76" r="9" fill="#ffd24a" stroke="#c8801a" strokeWidth="1.2" />
      <circle cx="112" cy="76" r="4.5" fill="none" stroke="#fff2b0" strokeWidth="1.2" />
      {/* 등 위의 산호 */}
      <path d="M98 56 C96 40 92 30 94 18 M96 42 C88 38 84 30 82 24 M96 36 C102 30 106 26 108 18" stroke="#ff7a6a" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M130 52 C134 38 140 30 138 16 M136 34 C146 30 150 24 152 18" stroke="#ff9a8a" strokeWidth="3" fill="none" strokeLinecap="round" />
      {/* 앞지느러미 */}
      <path d="M158 108 C176 118 190 140 174 150 C158 144 148 126 148 112Z" fill={`url(#${id}-skin)`} {...o} />
      <path d="M176 148 q4 -2 6 -8" stroke="#ffd24a" strokeWidth="3" strokeLinecap="round" />
      {/* 머리 */}
      <path d="M168 66 C180 52 206 56 212 72 C216 86 202 98 186 96 C172 94 162 80 168 66Z" fill={`url(#${id}-skin)`} {...o} />
      <path d="M200 84 C206 88 212 86 214 80" fill="#c8fff0" stroke={L} strokeWidth="1.2" />
      <Eye x={192} y={72} r={6.5} iris="#ffcc3a" />
      <path d="M184 64 q8 -5 14 0" stroke="#38e0c8" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <path d="M180 58 C176 44 168 38 164 26 M174 46 C168 44 162 40 160 34 M182 52 C190 42 196 40 200 30" stroke="#ff8a7a" strokeWidth="3.4" fill="none" strokeLinecap="round" />
      <path d="M176 58 C170 52 164 54 160 48" stroke="#ffd24a" strokeWidth="3" fill="none" strokeLinecap="round" />
      <Sparkle x={120} y={20} r={4} c="#fff0b0" />
    </g>
  );
}

// ------------------------------------------------------------------ 무지개유니콘피쉬
function UnicornFish() {
  const id = "uni";
  return (
    <g>
      <Defs id={id} stops={[
        { k: "body", from: ["#e0d0ff", "#fff6fa", "#ffffff"] },
        { k: "wing", from: ["#ffb0e8", "#c8a8ff", "#9ae0ff"] },
        { k: "wing2", from: ["#fff0a0", "#ffc8a0", "#ffb0d8"] },
      ]} />
      {/* 무지개 꼬리 3갈래 */}
      <path d="M70 84 C46 56 24 52 10 36 C34 34 66 52 84 78Z" fill="#ff8ab0" opacity=".92" {...o} strokeWidth={1.3} />
      <path d="M70 92 C42 90 22 96 8 90 C30 80 56 82 86 90Z" fill="#ffe27a" opacity=".92" {...o} strokeWidth={1.3} />
      <path d="M70 100 C46 124 24 128 12 146 C38 148 66 130 86 104Z" fill="#7ad8ff" opacity=".92" {...o} strokeWidth={1.3} />
      {/* 큰 나비 날개 지느러미 */}
      <path d="M118 64 C128 24 170 8 208 14 C214 44 180 74 140 84Z" fill={`url(#${id}-wing)`} opacity=".88" {...o} />
      <path d="M120 84 C150 80 196 84 216 112 C196 136 150 120 124 96Z" fill={`url(#${id}-wing2)`} opacity=".88" {...o} />
      {[[150, 40], [172, 30], [176, 52], [168, 100], [190, 108]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="2.6" fill="#fff" opacity=".85" />)}
      <path d="M128 70 C150 50 176 34 204 20 M130 90 C158 94 186 100 208 110" stroke="#fff" strokeWidth="1" fill="none" opacity=".7" />
      {/* 몸 */}
      <ellipse cx="108" cy="86" rx="46" ry="38" fill={`url(#${id}-body)`} {...o} />
      <path d="M72 66 C90 46 122 44 142 60 C124 52 96 54 72 66Z" fill="#ffd8e8" opacity=".8" />
      <path d="M76 62 C96 44 126 46 142 58" stroke="#c8e8ff" strokeWidth="5" fill="none" opacity=".6" strokeLinecap="round" />
      <path d="M80 70 C100 54 126 54 138 66" stroke="#e8d0ff" strokeWidth="4" fill="none" opacity=".55" strokeLinecap="round" />
      <ellipse cx="94" cy="108" rx="14" ry="5" fill="#ffd0e8" opacity=".6" />
      <path d="M96 100 l3 6 6 1 -5 4 1 6 -5 -3 -5 3 1 -6 -5 -4 6 -1Z" fill="#ffe27a" stroke="#f0b840" strokeWidth=".8" transform="translate(-10 -4) scale(.9)" />
      <path d="M118 102 l2 4 4 .6 -3 3 .8 4 -3.6 -2 -3.6 2 .8 -4 -3 -3 4 -.6Z" fill="#ff9ac8" stroke="#e070a8" strokeWidth=".7" />
      {/* 눈 */}
      <Eye x={130} y={86} r={9} iris="#6ad0ff" />
      <path d="M142 100 q4 3 8 0" stroke={L} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <ellipse cx="126" cy="100" rx="6" ry="3.6" fill="#ffa0c0" opacity=".6" />
      {/* 나선 뿔 */}
      <path d="M118 50 L136 8 L142 52Z" fill="#fff6fb" {...o} />
      {[0, 1, 2, 3, 4].map((i) => <path key={i} d={`M${121 + i * 0.5} ${48 - i * 8} L${142 - i * 1} ${46 - i * 8}`} stroke={["#ff7a9a", "#ffb070", "#fff070", "#8aff9a", "#7ad0ff"][i]} strokeWidth="3.4" opacity=".9" strokeLinecap="round" />)}
      <path d="M114 52 q16 6 32 0 l-2 6 q-14 5 -28 0Z" fill="#ffd860" stroke="#d09a20" strokeWidth="1.2" />
      <Sparkle x={26} y={22} r={5} c="#ffe0f8" /><Sparkle x={206} y={140} r={4} c="#d8f0ff" />
      {[[40, 124, 5, "#ffc8e8"], [220, 62, 6, "#c8e8ff"], [60, 24, 4, "#ffe8b0"]].map(([x, y, r, c], i) => <circle key={i} cx={x as number} cy={y as number} r={r as number} fill={c as string} opacity=".8" />)}
    </g>
  );
}

// ------------------------------------------------------------------ 설령빙호어
function SnowFox() {
  const id = "fox";
  const tails = [-62, -40, -20, 0, 20, 40, 62];
  return (
    <g>
      <Defs id={id} stops={[
        { k: "body", from: ["#cde8ff", "#f4fbff", "#ffffff"] },
        { k: "tail", from: ["#ffffff", "#e0d4ff", "#b8e0ff"] },
      ]} />
      {/* 눈송이 */}
      {[[26, 30], [214, 24], [30, 128], [204, 130]].map(([x, y], i) => (
        <g key={i} stroke="#bfe0ff" strokeWidth="1.4" strokeLinecap="round" transform={`translate(${x} ${y}) scale(${0.9 + (i % 2) * 0.3})`}>
          {[0, 60, 120].map((r) => <path key={r} d="M-8 0 L8 0 M-5 -3 L-8 0 L-5 3 M5 -3 L8 0 L5 3" transform={`rotate(${r})`} />)}
        </g>
      ))}
      {/* 꼬리 7갈래 */}
      {tails.map((r, i) => (
        <path key={i} d="M0 0 C-22 -10 -52 -8 -70 8 C-52 20 -22 14 0 6Z" fill={`url(#${id}-tail)`} stroke="#9ec0ee" strokeWidth="1.3" strokeLinejoin="round" transform={`translate(86 88) rotate(${r} 0 0) scale(${1.1 - Math.abs(r) / 260})`} opacity={i % 2 ? 0.95 : 1} />
      ))}
      {tails.map((r, i) => <circle key={i} cx={86 + Math.cos(((r + 180) * Math.PI) / 180) * 76 * (1.1 - Math.abs(r) / 260)} cy={88 + Math.sin(((r + 180) * Math.PI) / 180) * 76 * (1.1 - Math.abs(r) / 260)} r="3" fill="#cfeaff" stroke="#7ac0ee" strokeWidth=".8" />)}
      {/* 가슴 지느러미 털 */}
      <path d="M116 108 C112 124 100 134 84 134 C94 124 98 116 104 106Z" fill="#fff" stroke="#b8d4f0" strokeWidth="1.2" />
      {/* 몸 */}
      <ellipse cx="124" cy="92" rx="46" ry="34" fill={`url(#${id}-body)`} {...o} stroke="#8aa8d8" />
      <path d="M96 100 C116 116 146 114 162 100" stroke="#e8f4ff" strokeWidth="6" fill="none" strokeLinecap="round" />
      {/* 얼음 결정 등지느러미 */}
      {[[104, 62, -14], [118, 58, 0], [132, 60, 14]].map(([x, y, r], i) => <path key={i} d="M0 0 L-5 -4 L-2 -20 L2 -20 L5 -4Z" fill="#d8f2ff" stroke="#7ac0ee" strokeWidth="1.2" strokeLinejoin="round" transform={`translate(${x} ${y}) rotate(${r})`} />)}
      {/* 여우 귀 */}
      <path d="M134 62 L142 28 L158 54Z" fill="#fff" stroke="#8aa8d8" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M140 56 L144 38 L152 54Z" fill="#d8b8ff" />
      <path d="M156 68 L176 40 L180 70Z" fill="#fff" stroke="#8aa8d8" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M164 68 L174 50 L176 68Z" fill="#d8b8ff" />
      {/* 얼굴 */}
      <Eye x={152} y={86} r={8} iris="#4a9aff" />
      <path d="M142 80 q8 -6 18 -2" stroke="#c8a8ff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <ellipse cx="172" cy="94" rx="10" ry="8" fill="#fff" stroke="#8aa8d8" strokeWidth="1.4" />
      <ellipse cx="179" cy="92" rx="2.4" ry="2" fill="#2a2a4a" />
      <path d="M170 99 q3 3 7 0" stroke="#5a4a78" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      <circle cx="146" cy="98" r="4" fill="#d8c8ff" opacity=".6" />
      <Sparkle x={20} y={80} r={4} c="#e8f4ff" /><Sparkle x={212} y={98} r={4} c="#e0f0ff" />
    </g>
  );
}

// ------------------------------------------------------------------ 빙하거신수
function GlacierTitan() {
  const id = "gt";
  const crystal = (pts: string, fill = "#9ad8ff", k = "") => <polygon key={k} points={pts} fill={fill} stroke="#3a78c8" strokeWidth="1.4" strokeLinejoin="round" opacity=".96" />;
  return (
    <g>
      <Defs id={id} stops={[
        { k: "ice", from: ["#d8f4ff", "#7ac0ff", "#2a68d0"] },
        { k: "skin", from: ["#4a9aff", "#2a68d0", "#b8d8f0"] },
      ]} />
      {/* 떠 있는 얼음 조각 */}
      {[[22, 34, 0], [212, 26, 30], [30, 126, 20]].map(([x, y, r], i) => <polygon key={i} points="0,-9 5,0 0,9 -5,0" fill="#d8f2ff" stroke="#7ac0ee" strokeWidth="1" transform={`translate(${x} ${y}) rotate(${r})`} />)}
      {/* 다리 */}
      <path d="M56 112 C46 124 48 140 62 144 C76 140 84 128 82 114Z" fill={`url(#${id}-skin)`} {...o} stroke="#2a4a98" />
      <path d="M142 112 C140 126 150 142 166 142 C176 134 172 120 164 110Z" fill={`url(#${id}-skin)`} {...o} stroke="#2a4a98" />
      <path d="M56 144 l-4 8 8 -4Z M64 146 l0 9 6 -6Z" fill="#d8f4ff" stroke="#3a78c8" strokeWidth="1" />
      <path d="M156 142 l-2 9 8 -5Z M166 142 l2 8 5 -6Z" fill="#d8f4ff" stroke="#3a78c8" strokeWidth="1" />
      {/* 등껍질 바닥 */}
      <path d="M40 104 C44 78 80 66 120 68 C158 70 182 84 180 106 C150 120 70 120 40 104Z" fill="#2a58b8" stroke="#1a3a88" strokeWidth="1.6" strokeLinejoin="round" />
      {/* 큰 결정들 */}
      {crystal("70,92 84,40 104,86", "#8ad0ff", "a")}
      {crystal("100,90 116,14 140,88", `url(#${id}-ice)`, "b")}
      {crystal("136,92 156,36 172,94", "#9adcff", "c")}
      {crystal("54,100 62,66 76,98", "#b8e8ff", "d")}
      {crystal("160,100 176,64 184,104", "#b8e8ff", "e")}
      {crystal("92,96 100,58 112,94", "#d0f4ff", "f")}
      <path d="M116 14 L116 88 M84 40 L90 88 M156 36 L150 90" stroke="#fff" strokeWidth="1" opacity=".7" />
      {/* 꼬리 */}
      <path d="M176 100 C188 98 196 102 200 108 C190 114 180 112 174 108Z" fill={`url(#${id}-skin)`} {...o} stroke="#2a4a98" />
      <polygon points="198,100 214,96 204,110" fill="#c8f0ff" stroke="#3a78c8" strokeWidth="1.2" />
      {/* 머리 */}
      <path d="M22 84 C30 62 64 62 76 80 C84 94 70 112 46 110 C28 108 16 98 22 84Z" fill={`url(#${id}-skin)`} {...o} stroke="#2a4a98" />
      <path d="M26 98 C34 106 50 108 62 102 C54 110 38 112 26 106Z" fill="#c8e4ff" opacity=".7" />
      <circle cx="46" cy="82" r="8" fill="#e8f8ff" stroke="#2a4a98" strokeWidth="1.4" />
      <circle cx="47" cy="82" r="5.4" fill="#4ac8ff" />
      <circle cx="47" cy="82" r="2.6" fill="#0a2a60" />
      <circle cx="49" cy="79.5" r="1.8" fill="#fff" />
      <polygon points="40,66 36,46 48,64" fill="#e0f6ff" stroke="#3a78c8" strokeWidth="1.2" strokeLinejoin="round" />
      <polygon points="54,66 56,44 64,66" fill="#e0f6ff" stroke="#3a78c8" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M30 96 q6 4 12 0" stroke="#1a3a88" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      <Sparkle x={100} y={10} r={5} c="#ffffff" /><Sparkle x={196} y={50} r={4} c="#d8f4ff" />
    </g>
  );
}

// ------------------------------------------------------------------ 심연의 흑룡
function AbyssDragon() {
  const id = "abd";
  const body = "M74 70 C104 52 156 50 176 82 C194 112 150 136 118 120 C90 106 108 84 132 92";
  return (
    <g>
      <Defs id={id} stops={[{ k: "wing", from: ["#c070ff", "#7a3ad0", "#3a1a78"] }]} />
      {/* 어둠 입자 */}
      {[[20, 30, 5], [212, 40, 7], [200, 134, 5], [30, 122, 6], [118, 22, 4]].map(([x, y, r], i) => <circle key={i} cx={x} cy={y} r={r} fill="#7a3ad0" opacity=".55" />)}
      {/* 날개 */}
      <path d="M150 62 C158 30 186 14 214 18 C204 28 206 38 196 46 C198 56 186 62 178 66 C170 62 160 62 150 62Z" fill={`url(#${id}-wing)`} stroke="#2a1458" strokeWidth="1.5" strokeLinejoin="round" opacity=".95" />
      <path d="M156 62 C170 44 188 32 208 22 M160 64 C176 54 190 48 200 44" stroke="#e0b0ff" strokeWidth="1" fill="none" opacity=".8" />
      {/* 몸 */}
      <path d={body} fill="none" stroke="#9a5aff" strokeWidth="25" strokeDasharray="3 10" strokeLinecap="round" />
      <path d={body} fill="none" stroke="#1a0e40" strokeWidth="20" strokeLinecap="round" />
      <path d={body} fill="none" stroke="#10163a" strokeWidth="17" strokeLinecap="round" />
      <path d={body} fill="none" stroke="#2c1a5a" strokeWidth="6" strokeLinecap="round" transform="translate(0 5)" />
      <path d={body} fill="none" stroke="#b070ff" strokeWidth="2.4" strokeDasharray="6 12" strokeLinecap="round" transform="translate(0 -2)" />
      <path d={body} fill="none" stroke="#3a4aa0" strokeWidth="3" strokeDasharray="0.1 9" strokeLinecap="round" transform="translate(0 4)" />
      {/* 꼬리 3갈래와 보라 결정 */}
      <path d="M132 92 C144 88 152 92 150 100 C142 98 134 98 132 92Z" fill="#2c1a5a" stroke={L} strokeWidth="1.2" />
      {[[152, 90, 10], [150, 100, 34], [146, 108, 56]].map(([x, y, r], i) => <g key={i} transform={`translate(${x} ${y}) rotate(${r})`}><path d="M0 0 C10 -3 22 -2 28 3 C20 6 8 7 0 4Z" fill="#5a2aa0" stroke="#2a1458" strokeWidth="1.1" /><polygon points="26,3 36,0 30,8" fill="#c080ff" stroke="#5a2aa0" strokeWidth="1" /></g>)}
      {/* 보라 균열 */}
      {[[110, 56], [140, 54], [168, 74], [172, 100], [150, 122], [114, 114]].map(([x, y], i) => <path key={i} d={`M${x - 4} ${y} l3 -5 l2 4 l3 -4`} stroke="#c890ff" strokeWidth="1.6" fill="none" strokeLinecap="round" />)}
      {/* 머리 */}
      <path d="M52 66 C56 46 86 46 92 64 C96 80 70 86 58 80 C50 76 50 70 52 66Z" fill="#161c46" stroke="#0a0820" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M38 72 C42 64 54 66 56 74 C54 82 42 82 38 76Z" fill="#2a2a68" stroke="#0a0820" strokeWidth="1.4" />
      <circle cx="43" cy="72" r="1.2" fill="#c090ff" />
      <path d="M42 78 l2 3 2 -3 M48 79 l2 3 2 -3" stroke="#fff" strokeWidth="1.2" fill="none" />
      <g>
        <circle cx="72" cy="62" r="7" fill="#b070ff" stroke="#0a0820" strokeWidth="1.2" />
        <ellipse cx="73" cy="62" rx="2.2" ry="5.4" fill="#10062a" />
        <circle cx="75" cy="59" r="1.6" fill="#fff" />
      </g>
      <path d="M76 50 C84 34 98 28 108 20 M88 40 C92 32 100 34 104 30 M96 46 C106 42 112 46 116 42" stroke="#ffc83a" strokeWidth="3.2" fill="none" strokeLinecap="round" />
      <path d="M66 52 C62 38 52 32 44 26 M58 40 C52 38 46 40 42 36" stroke="#ffc83a" strokeWidth="2.8" fill="none" strokeLinecap="round" />
      <path d="M50 78 C36 90 24 88 14 98" stroke="#a070d8" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Sparkle x={24} y={46} r={4} c="#d8b0ff" /><Sparkle x={208} y={96} r={3.5} c="#ffd860" />
    </g>
  );
}

// ------------------------------------------------------------------ 태초의 성운어
function NebulaFish() {
  const id = "neb";
  const stars = [[70, 74], [84, 66], [100, 80], [116, 62], [130, 76], [146, 66], [96, 96], [124, 92], [150, 88], [78, 90], [110, 72], [138, 100], [66, 82], [158, 76]];
  return (
    <g>
      <Defs id={id} stops={[
        { k: "body", from: ["#3a3aa8", "#1a1c6a", "#0a0c3a"] },
        { k: "belly", from: ["#fff", "#e8e4ff", "#c8c0f0"] },
        { k: "gal", kind: "rad", from: ["#b070ff", "#4ac8ff", "#4ac8ff"], to: ["x"] },
      ]} />
      {/* 금빛 고리와 행성 */}
      <ellipse cx="116" cy="84" rx="100" ry="30" fill="none" stroke="#ffd24a" strokeWidth="2.6" transform="rotate(-16 116 84)" />
      <ellipse cx="116" cy="88" rx="84" ry="52" fill="none" stroke="#ffe27a" strokeWidth="1.8" transform="rotate(24 116 88)" opacity=".9" />
      <g transform="translate(206 54)"><circle r="9" fill="#ff8a6a" stroke="#b04a2a" strokeWidth="1.2" /><ellipse rx="15" ry="4" fill="none" stroke="#ffe27a" strokeWidth="2" transform="rotate(-20)" /><circle cx="-3" cy="-3" r="2" fill="#ffc8a0" /></g>
      <g transform="translate(26 112)"><circle r="7" fill="#6ad8ff" stroke="#2a78a8" strokeWidth="1.2" /><circle cx="-2" cy="-2" r="1.6" fill="#d8f4ff" /></g>
      <g transform="translate(40 30)"><circle r="6" fill="#c08aff" stroke="#6a3aa8" strokeWidth="1.1" /><ellipse rx="11" ry="3" fill="none" stroke="#ffe27a" strokeWidth="1.6" transform="rotate(25)" /></g>
      <circle cx="214" cy="116" r="5" fill="#8aff9a" stroke="#3aa860" strokeWidth="1" />
      {/* 꼬리 */}
      <path d="M52 92 C34 80 22 62 18 44 C38 46 62 62 74 82Z" fill="#2a2a98" stroke="#0a0c3a" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M52 94 C36 106 26 120 28 136 C48 130 66 114 76 98Z" fill="#3a3ab8" stroke="#0a0c3a" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M44 74 q10 6 22 12 M40 118 q12 -4 24 -12" stroke="#8ad0ff" strokeWidth="1.2" fill="none" opacity=".8" />
      {/* 등지느러미 */}
      <path d="M112 54 C118 34 140 28 156 30 C146 40 142 52 136 62Z" fill="#3a3ab8" stroke="#0a0c3a" strokeWidth="1.6" strokeLinejoin="round" />
      {/* 몸 */}
      <path d="M60 90 C62 60 112 50 156 62 C186 72 200 92 184 106 C160 126 90 126 66 108 C62 102 60 96 60 90Z" fill={`url(#${id}-body)`} stroke="#0a0c3a" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M70 102 C100 124 160 124 182 104 C172 112 150 116 120 114 C96 112 80 108 70 102Z" fill={`url(#${id}-belly)`} />
      <path d="M72 92 C100 70 130 100 170 78" stroke="#a070ff" strokeWidth="7" fill="none" opacity=".5" strokeLinecap="round" />
      <path d="M76 84 C104 60 136 90 176 70" stroke="#4ac8ff" strokeWidth="4" fill="none" opacity=".55" strokeLinecap="round" />
      {stars.map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 4 === 0 ? 1.8 : 1} fill={i % 5 === 0 ? "#ffe9a0" : "#fff"} />)}
      <Sparkle x={150} y={72} r={4} c="#ffe9a0" />
      {/* 이마의 별 */}
      <path d="M170 64 l3 7 7.5 .8 -5.7 5 1.8 7.4 -6.6 -3.9 -6.6 3.9 1.8 -7.4 -5.7 -5 7.5 -.8Z" fill="#ffe27a" stroke="#d09a20" strokeWidth="1" />
      {/* 눈 */}
      <g>
        <circle cx="170" cy="92" r="7" fill="#e8fff8" stroke="#0a0c3a" strokeWidth="1.2" />
        <circle cx="171" cy="92" r="4.8" fill="#58e8d8" />
        <circle cx="171.5" cy="92" r="2.4" fill="#2a1a6a" />
        <circle cx="173" cy="90" r="1.6" fill="#fff" />
      </g>
      <path d="M178 104 q4 3 9 0" stroke="#e8e4ff" strokeWidth="1.4" fill="none" strokeLinecap="round" />
      {/* 가슴지느러미 */}
      <path d="M122 104 C130 120 114 134 96 136 C100 124 108 112 118 104Z" fill="#6a5ae0" stroke="#0a0c3a" strokeWidth="1.4" strokeLinejoin="round" opacity=".92" />
      {[[106, 124], [112, 118], [118, 112]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r="1.4" fill="#d8f0ff" />)}
    </g>
  );
}

const ART: Record<string, () => ReactElement> = {
  천년이무기: Imugi, 연화봉황어: Phoenix, "용왕의 해신수": DragonKingTurtle, 무지개유니콘피쉬: UnicornFish,
  설령빙호어: SnowFox, 빙하거신수: GlacierTitan, "심연의 흑룡": AbyssDragon, "태초의 성운어": NebulaFish,
};

export const hasMythicArt = (name: string) => name in ART;

/** 신화 물고기 일러스트(직접 그린 벡터 그림) */
export function MythicArt({ name, size = 96, silhouette = false }: { name: string; size?: number; silhouette?: boolean }) {
  const Art = ART[name];
  if (!Art) return null;
  return (
    <svg viewBox="0 0 240 160" width={size} height={(size * 160) / 240} style={{ overflow: "visible", filter: silhouette ? "brightness(0) opacity(0.35)" : "drop-shadow(0 2px 3px rgba(80,60,120,0.25))" }} aria-label={name}>
      <Art />
    </svg>
  );
}
