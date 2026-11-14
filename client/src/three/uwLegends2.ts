import * as THREE from "three";
import { C, crystal, dorsalFin, eyeBall, finishMythic, glass, glow, glowTex, kit, phys, profileBody, raysTex, ring, sideFin, tailFin, tube, veil } from "./uwLegends";
import type { Anim, Maker } from "./uwLegends";

// 수중 탐험의 전설·신화 (뒤 절반): 보물 동굴, 심해 협곡, 거북이 만. 도우미는 uwLegends.ts 의 것을 쓴다.
const { V, PI, PI2, sph, cyl, cone, box, tor, dome, M, G, lit, add, gold, gem, iron, wood, cloth, spr, motes, painted, vgrad, rnd, fin, petal, sway, eyesOn, arm, coral, anemone, crown, finL } = kit;

// ================================================================ 3 보물 동굴
/** 진주왕관해마: 꼿꼿이 선 큰 해마. 마디마다 금 테를 두른 진주빛 갑옷, 큰 왕관과 비단 갈기, 말린 꼬리로 감싸 쥔 빛나는 큰 진주, 목걸이 */
const pearlCrownSeahorse: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [], gd = gold();
  const pearl = phys("#fff4fa", { roughness: 0.12, clearcoat: 1, emissive: C("#ffd0e8"), emissiveIntensity: 0.3, iridescence: 1 } as THREE.MeshPhysicalMaterialParameters);
  const pts: Array<[number, number, number]> = [[0.2, -1.05, 0.05], [0.36, -1.14, 0.065], [0.5, -1.06, 0.075], [0.5, -0.9, 0.085], [0.36, -0.82, 0.095], [0.2, -0.8, 0.11], [0.06, -0.7, 0.13], [-0.02, -0.55, 0.155], [-0.05, -0.38, 0.19], [-0.02, -0.18, 0.24], [0.04, 0.02, 0.275], [0.07, 0.22, 0.255], [0.04, 0.42, 0.21], [-0.02, 0.6, 0.17], [0.0, 0.78, 0.175], [0.1, 0.9, 0.2]];
  pts.forEach(([x, y, r], i) => { g.add(M(sph(r, 18, 14), pearl, [x, y, 0], [0, 0, 0], [1, 1, 0.85])); if (i > 4 && i < 14) g.add(M(tor(r * 0.98, 0.016), gd, [x, y, 0], [PI / 2, 0, 0], [1, 0.85, 1])); }); // 마디마다 금 테
  g.add(tube([V(0.22, 0.88, 0), V(0.46, 0.82, 0), V(0.7, 0.78, 0)], 0.075, pearl, 0.8), M(cyl(0.085, 0.06, 0.06, 12, true), gd, [0.72, 0.78, 0], [0, 0, PI / 2]));
  eyesOn(g, 0.07, 0.2, 0.98, 0.15, "#ff8ac0");
  const cr = crown(0.17, 7, ["#ff8ac0", "#ffffff"]); cr.position.set(0.06, 1.08, 0); cr.rotation.z = 0.1; g.add(cr);
  const silk = (c: string) => phys(c, { side: THREE.DoubleSide, transparent: true, opacity: 0.8, emissive: C(c), emissiveIntensity: 0.4 });
  for (let i = 0; i < 6; i++) { const f = petal(0.5 - i * 0.03, 0.16, silk(i % 2 ? "#ffd0e8" : "#ffe07a")), h = G([-0.1 - (i > 2 ? 0.04 : 0), 0.95 - i * 0.14, 0], f); h.rotation.z = 0.3 - i * 0.12; g.add(h); sway(anim, h, "y", 0.3, 2.6, i); } // 비단 갈기
  const df = fin([[0, -0.3], [-0.34, -0.16], [-0.38, 0.2], [0, 0.32]], silk("#ffe07a"), 0.02); df.position.set(-0.2, 0.05, 0); g.add(df); sway(anim, df, "y", 0.5, 9);
  for (const s of [-1, 1]) { const pf = sideFin(0.3, silk("#ffd0e8")), h = G([0.06, 0.62, s * 0.15], pf); pf.rotation.set(s * 1.1, 0, -0.4); g.add(h); sway(anim, h, "x", 0.4, 8, s); }
  for (let k = 0; k < 2; k++) for (let i = 0; i < 12; i++) { const a = -1.2 + (i / 11) * 2.4; g.add(M(sph(0.032, 8, 6), gem("#ffffff"), [0.06 + Math.cos(a) * (0.2 + k * 0.03), 0.42 - k * 0.1 - Math.cos(a) * 0.08, Math.sin(a) * (0.2 + k * 0.03)])); }
  g.add(M(new THREE.OctahedronGeometry(0.07), gem("#ff5a8a"), [0.3, 0.22, 0]));
  const bigGlow = spr("#ffe0f4", 1.0, 0.7), big = G([0.34, -0.96, 0], M(sph(0.15, 20, 16), phys("#ffffff", { roughness: 0.05, emissive: C("#fff0ff"), emissiveIntensity: 1.1 })), bigGlow); g.add(big); // 꼬리로 감싼 큰 진주
  anim.push((t) => bigGlow.scale.setScalar(1.0 + Math.sin(t * 2) * 0.15));
  const orb = new THREE.Group(); for (let i = 0; i < 7; i++) { const p = M(sph(0.04, 10, 8), gem("#fff4ff")); p.userData.ph = (i / 7) * PI2; orb.add(p); } g.add(orb);
  anim.push((t) => orb.children.forEach((p, i) => { const a = (p.userData.ph as number) + t * 0.8; p.position.set(Math.cos(a) * 0.75, -0.2 + Math.sin(a * 2 + i) * 0.8, Math.sin(a) * 0.75); }));
  motes(g, anim, ["#ffe0f4", "#ffffff", "#ffe07a"], 40, [0.9, 1.3, 0.8], [0, 0.15, 0], 0.09);
  return finL(g, anim, 1.5, "#ffd0e8", "#ffe07a", [2.0, 3.0, 1.8], 30);
};

/** 황금잉어대왕: 금·주홍·흰 얼룩의 큰 비단잉어. 몸길이만 한 나비 지느러미와 두 갈래 꼬리, 긴 수염, 이마의 왕(王) 무늬, 몸을 도는 금화 고리 */
const goldenKoiKing: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [], gd = gold();
  const skin = painted((x, W, H) => { vgrad(x, W, H, [[0, "#ffb820"], [0.6, "#ffd860"], [1, "#fff6d8"]]); for (let i = 0; i < 16; i++) { x.fillStyle = i % 2 ? "#ff5a2a" : "#ffffff"; x.beginPath(); x.ellipse(rnd(i) * W, rnd(i + 4) * H * 0.6, 26 + rnd(i + 8) * 34, 16 + rnd(i + 2) * 22, rnd(i) * 3, 0, 7); x.fill(); } x.strokeStyle = "rgba(160,90,0,.35)"; x.lineWidth = 2; for (let r = 0; r < 12; r++) for (let c = 0; c < 26; c++) { x.beginPath(); x.arc(c * 20 + (r % 2) * 10, r * 18, 10, 0.2, PI - 0.2); x.stroke(); } }, { emissiveIntensity: 0.3 });
  g.add(M(profileBody(1.9, 0.82, 0.64, 0.56, false, 0.75), skin));
  eyesOn(g, 0.085, 0.66, 0.1, 0.25, "#ffcf40");
  g.add(M(tor(0.09, 0.03), phys("#ff8a6a"), [0.93, -0.06, 0], [0, PI / 2, 0]));
  const silk = (c: string, op = 0.82) => phys(c, { side: THREE.DoubleSide, transparent: true, opacity: op, emissive: C(c), emissiveIntensity: 0.45 });
  for (const s of [-1, 1]) {
    for (let i = 0; i < 2; i++) g.add(tube([V(0.9, -0.1, s * 0.08), V(1.1, -0.25 - i * 0.1, s * (0.3 + i * 0.15)), V(0.8, -0.6 - i * 0.12, s * (0.6 + i * 0.2)), V(0.2, -0.85 - i * 0.1, s * (0.75 + i * 0.2))], 0.022, gd, 0.4)); // 긴 수염
    const pf = petal(1.3, 0.55, silk("#ffcf40")), h = G([0.42, -0.2, s * 0.3], pf); h.rotation.set(s * 0.5, s * 0.9, 0.35); g.add(h); sway(anim, h, "y", 0.3, 1.6, s, s * 0.9); sway(anim, pf, "x", 0.25, 1.3, s); // 나비 가슴지느러미
    const vf = petal(0.9, 0.36, silk("#ff9a40")), hv = G([-0.2, -0.3, s * 0.2], vf); hv.rotation.set(s * 0.5, s * 0.5, 0.6); g.add(hv); sway(anim, hv, "y", 0.3, 1.8, s + 1, s * 0.5);
    for (let r = 0; r < 3; r++) for (let i = 0; i < 6; i++) g.add(M(cyl(0.07, 0.07, 0.012, 12), gd, [0.4 - i * 0.2, 0.12 - r * 0.15, s * (0.3 - Math.abs(0.4 - i * 0.2 - 0.1) * 0.12 - r * 0.02)], [PI / 2, 0, 0])); // 금화 비늘
  }
  for (const a of [-0.45, 0.45, -0.15, 0.15]) { const f = petal(1.7 - Math.abs(a) * 0.6, 0.6, silk(Math.abs(a) > 0.3 ? "#ffcf40" : "#fff0c0", 0.7)), h = G([-0.9, 0, 0], f); h.rotation.z = -a; g.add(h); sway(anim, h, "y", 0.35, 1.9, a * 5); sway(anim, f, "x", 0.3, 1.5, a * 3); }
  for (let i = 0; i < 7; i++) { const d = petal(0.55 + Math.sin((i / 6) * PI) * 0.25, 0.2, silk("#ff9a40")), h = G([0.35 - i * 0.16, 0.36, 0], d); h.rotation.z = -1.1 + i * 0.05; g.add(h); sway(anim, h, "x", 0.2, 2.2, i); }
  const mark = G([0.62, 0.36, 0]); for (const y of [0.09, 0, -0.09]) mark.add(M(box(0.03, 0.025, 0.16), lit("#ff3a2a"), [0, y, 0])); mark.add(M(box(0.03, 0.2, 0.025), lit("#ff3a2a"))); mark.rotation.z = -0.9; g.add(mark); // 이마의 왕(王)
  const cr = crown(0.12, 5, ["#ff3a5a", "#ffffff"]); cr.position.set(0.4, 0.42, 0); cr.rotation.z = -0.15; g.add(cr);
  const coins = new THREE.Group(); for (let i = 0; i < 16; i++) { const c = M(cyl(0.065, 0.065, 0.014, 12), gd); c.userData.ph = (i / 16) * PI2; coins.add(c); } g.add(coins);
  anim.push((t) => coins.children.forEach((c, i) => { const a = (c.userData.ph as number) + t * 0.9; c.position.set(Math.cos(a) * 1.5 - 0.1, Math.sin(a) * 0.8, Math.sin(a * 2) * 0.35); c.rotation.set(t * 3 + i, a, 0); }));
  motes(g, anim, ["#ffe07a", "#ffffff", "#ffb030"], 50, [2.0, 1.0, 1.0], [-0.4, 0.1, 0], 0.1);
  return finL(g, anim, 1.35, "#ffcf40", "#ff7a3a", [3.6, 2.0, 2.0], 34);
};

/** 수정날개날치: 몸이 맑은 유리 같은 날치. 수정 조각을 부채처럼 엮은 날개 네 장으로 날갯짓하고, 등에 수정 볏, 지나간 자리에 무지갯빛 가루 */
const crystalFlyingFish: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const body = new THREE.MeshPhysicalMaterial({ color: "#d8f6ff", transparent: true, opacity: 0.72, roughness: 0.05, clearcoat: 1, emissive: new THREE.Color("#7ad8ff"), emissiveIntensity: 0.4, iridescence: 1, depthWrite: false } as THREE.MeshPhysicalMaterialParameters);
  g.add(M(profileBody(2.0, 0.42, 0.36, 0.5, true, 0.85), body), M(profileBody(1.5, 0.12, 0.1, 0.5, true, 0.85), lit("#ffffff"), [0, 0, 0])); // 비치는 몸과 속의 빛줄기
  eyesOn(g, 0.07, 0.66, 0.05, 0.14, "#b08aff");
  const PR = ["#7ad8ff", "#b08aff", "#ff8ad8", "#8affd0", "#ffe07a", "#ffffff"];
  const wing = (len: number, n: number) => { const w = new THREE.Group(); for (let i = 0; i < n; i++) { const c = PR[i % 6], L = len * (1 - Math.abs(i - (n - 1) / 2) * 0.09), k = crystal(L, 0.045, C(c), C(c)); k.position.set(-Math.sin((i - (n - 1) / 2) * 0.17) * L * 0.5, 0, Math.cos((i - (n - 1) / 2) * 0.17) * L * 0.5 + 0.05); k.rotation.set(PI / 2, 0, (i - (n - 1) / 2) * 0.17); k.scale.set(1.5, 1, 0.4); w.add(k); } return w; };
  for (const s of [-1, 1]) {
    const w1 = wing(1.5, 9), h1 = G([0.35, 0.05, s * 0.15], w1); w1.scale.z = s; g.add(h1); anim.push((t) => { h1.rotation.x = -s * (0.25 + Math.sin(t * 5) * 0.55); });
    const w2 = wing(0.85, 6), h2 = G([-0.35, 0, s * 0.12], w2); w2.scale.z = s; g.add(h2); anim.push((t) => { h2.rotation.x = -s * (0.2 + Math.sin(t * 5 - 0.9) * 0.45); });
  }
  for (let i = 0; i < 7; i++) { const k = crystal(0.22 + Math.sin((i / 6) * PI) * 0.22, 0.035, C(PR[i % 6]), C(PR[i % 6])); k.position.set(0.5 - i * 0.18, 0.26, 0); k.rotation.z = -0.35; g.add(k); }
  const tail = G([-1.0, 0, 0]); for (const [a, L] of [[0.5, 0.6], [-0.75, 1.15]] as const) { const k = crystal(L, 0.035, C("#b08aff"), C("#7ad8ff")); k.position.set(-Math.cos(a) * L * 0.5, Math.sin(a) * L * 0.5, 0); k.rotation.z = PI / 2 - a; k.scale.set(1.4, 1, 0.4); tail.add(k); } g.add(tail); sway(anim, tail, "y", 0.4, 6);
  for (let i = 0; i < 3; i++) { const r = Object.assign(M(tor(0.5 + i * 0.22, 0.012, PI2, 40), add(PR[i], 0.7), [-0.9 - i * 0.5, 0, 0], [0, PI / 2, 0]), { name: "fx" }); g.add(r); anim.push((t) => { const u = (t * 0.6 + i / 3) % 1; r.position.x = -0.6 - u * 2.2; r.scale.setScalar(0.5 + u * 1.6); (r.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - u); }); } // 뒤로 퍼지는 빛 고리
  motes(g, anim, PR, 80, [2.2, 0.7, 1.4], [-1.4, 0, 0], 0.1, [-0.8, 0, 0]);
  return finL(g, anim, 1.3, "#7ad8ff", "#b08aff", [3.4, 1.4, 3.6], 32);
};

/** 보물지기 미믹(신화): 보물 상자가 통째로 물고기가 된 괴물. 뚜껑이 턱처럼 여닫히고 안에는 금화 더미와 혀, 가장자리에 보석 이빨, 뚜껑 위의 성난 눈과 왕관, 열쇠 꼬리, 흘러나오는 금화 */
const treasureMimic: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [], gd = gold(), wd = painted((x, W, H) => { vgrad(x, W, H, [[0, "#9a6230"], [1, "#6a3e1c"]]); x.fillStyle = "rgba(40,20,8,.5)"; for (let i = 0; i < 8; i++) x.fillRect(0, (i / 8) * H, W, 4); for (let i = 0; i < 40; i++) x.fillRect(rnd(i) * W, rnd(i + 2) * H, 30 + rnd(i) * 60, 2); }, { roughness: 0.7, clearcoat: 0.2, emissiveIntensity: 0.18 });
  const GEM = ["#ff3a5a", "#3ad8ff", "#5aff9a", "#c87aff", "#ffe04a"];
  const lower = G([0, -0.3, 0], M(box(2.0, 0.7, 1.3), wd), M(box(1.9, 0.1, 1.2), phys("#2a1408"), [0, 0.32, 0])), lid = G([-1.0, 0.05, 0]); // 뚜껑은 뒤쪽 경첩을 축으로 열린다
  lid.add(M(new THREE.CylinderGeometry(0.65, 0.65, 2.0, 20, 1, false, 0, PI), wd, [1.0, 0, 0], [PI / 2, 0, PI / 2]), M(box(2.0, 0.08, 1.3), phys("#2a1408"), [1.0, 0.0, 0]));
  for (const x0 of [-0.8, 0, 0.8]) { lower.add(M(box(0.16, 0.74, 1.34), gd, [x0, 0, 0])); lid.add(M(tor(0.67, 0.07, PI, 20), gd, [1.0 + x0, 0, 0], [0, PI / 2, 0])); }
  lower.add(M(box(2.04, 0.1, 1.34), gd, [0, 0.33, 0]), M(box(2.04, 0.1, 1.34), gd, [0, -0.33, 0])); lid.add(M(box(2.04, 0.1, 1.34), gd, [1.0, 0.02, 0]), M(box(0.3, 0.36, 0.1), gd, [2.02, -0.02, 0], [0, PI / 2, 0]), M(cyl(0.05, 0.05, 0.12, 10), phys("#1a0c04"), [2.08, 0.0, 0], [0, 0, PI / 2]));
  for (let i = 0; i < 12; i++) { const z = -0.55 + (i / 11) * 1.1, c = GEM[i % 5]; lower.add(M(cone(0.07, 0.3, 5), gem(c), [1.0, 0.5, z])); lid.add(M(cone(0.07, 0.34, 5), gem(GEM[(i + 2) % 5]), [2.0, -0.2, z], [PI, 0, 0])); } // 앞니
  for (let i = 0; i < 8; i++) for (const s of [-1, 1]) { lower.add(M(cone(0.06, 0.24, 5), gem(GEM[i % 5]), [0.85 - i * 0.2, 0.47, s * 0.62])); lid.add(M(cone(0.06, 0.26, 5), gem(GEM[(i + 3) % 5]), [1.85 - i * 0.2, -0.17, s * 0.62], [PI, 0, 0])); } // 어금니
  const pile = G([0.1, 0.4, 0], M(dome(0.5, 20, 8), phys("#ffcf40", { metalness: 0.8, roughness: 0.3, emissive: C("#ffb020"), emissiveIntensity: 0.9 }), [0, 0, 0], [0, 0, 0], [1.6, 0.5, 1.0]), spr("#ffd860", 2.2, 0.6)); for (let i = 0; i < 26; i++) pile.add(M(cyl(0.09, 0.09, 0.02, 12), gd, [(rnd(i) - 0.5) * 1.3, 0.1 + rnd(i + 3) * 0.22, (rnd(i + 5) - 0.5) * 0.8], [rnd(i) * 2, rnd(i + 1) * 3, 0])); for (let i = 0; i < 7; i++) pile.add(M(new THREE.OctahedronGeometry(0.1), gem(GEM[i % 5]), [(rnd(i + 9) - 0.5) * 1.1, 0.28, (rnd(i + 11) - 0.5) * 0.7]));
  lower.add(pile); lower.children[lower.children.length - 1].position.y = 0.34;
  const tongue = tube([V(0.5, 0.1, 0), V(1.0, 0.16, 0), V(1.45, 0.0, 0.05), V(1.75, -0.25, 0)], 0.16, phys("#e8405a", { roughness: 0.5 }), 0.7); tongue.scale.z = 1.6; lower.add(tongue); sway(anim, tongue, "y", 0.2, 2.5);
  for (const s of [-1, 1]) { const e = eyeBall(0.2, "#ff5a2a", "slit", 1.3); e.position.set(1.7, 0.42, s * 0.36); e.rotation.y = -s * 0.5; lid.add(e, M(box(0.44, 0.08, 0.1), gd, [1.74, 0.66, s * 0.36], [0, s * -0.5, s * 0.0 - 0.45 * 1])); (lid.children[lid.children.length - 1] as THREE.Mesh).rotation.set(0, -s * 0.5, -0.4); }
  const cr = crown(0.26, 7, GEM); cr.position.set(1.0, 0.66, 0); lid.add(cr);
  g.add(lower, lid);
  anim.push((t) => { const o = Math.max(0, Math.sin(t * 1.4)) ** 0.6; lid.rotation.z = 0.12 + o * 0.5; lower.rotation.z = -o * 0.08; }); // 뚜껑을 벌렸다 덥석 닫는다
  for (const s of [-1, 1]) { const f = fin([[0, 0], [-0.3, 0.5], [-0.9, 0.62], [-1.2, 0.2], [-0.9, -0.1]], phys("#ffcf40", { side: THREE.DoubleSide, metalness: 0.6, emissive: C("#b87a00"), emissiveIntensity: 0.5 })), h = G([0.2, -0.35, s * 0.68], f); f.rotation.x = s * 1.2; g.add(h); sway(anim, h, "x", 0.4, 3, s); for (const x0 of [-0.75, 0.75]) g.add(M(tor(0.16, 0.035, PI, 12), gd, [x0, -0.25, s * 0.68], [PI / 2, 0, s > 0 ? 0 : PI])); }
  const tail = G([-1.05, -0.2, 0]); for (let i = 0; i < 6; i++) tail.add(M(tor(0.1, 0.03, PI2, 12), gd, [-0.1 - i * 0.16, 0, 0], [i % 2 ? PI / 2 : 0, 0, 0])); tail.add(M(cyl(0.05, 0.05, 0.8, 8), gd, [-1.45, 0, 0], [0, 0, PI / 2]), M(tor(0.2, 0.05), gd, [-2.05, 0, 0]), M(box(0.1, 0.26, 0.06), gd, [-1.2, -0.16, 0]), M(box(0.1, 0.2, 0.06), gd, [-1.38, -0.13, 0])); g.add(tail); sway(anim, tail, "y", 0.45, 2.4); // 사슬과 열쇠 꼬리
  const orbit = new THREE.Group(); for (let i = 0; i < 8; i++) { const o = G([0, 0, 0], M(new THREE.OctahedronGeometry(0.12), gem(GEM[i % 5])), spr(GEM[i % 5], 0.6, 0.5)); o.userData.ph = (i / 8) * PI2; orbit.add(o); } g.add(orbit);
  anim.push((t) => orbit.children.forEach((o, i) => { const a = (o.userData.ph as number) + t * 0.6; o.position.set(Math.cos(a) * 2.1, 0.3 + Math.sin(a * 2 + i) * 0.5, Math.sin(a) * 1.5); o.rotation.y = t * 2; }));
  for (const x0 of [-0.3, 0.6]) g.add(Object.assign(M(cyl(0.7, 0.25, 5, 16, true), add("#ffe07a", 0.12), [x0, 2.4, 0]), { name: "fx" }));
  motes(g, anim, ["#ffe07a", "#ffcf40", "#ffffff"], 110, [2.4, 1.2, 1.4], [-0.9, -0.15, 0], 0.14, [-0.8, 0, 0]);
  return finishMythic(g, anim, 1.5, "#ffcf40", "#ff5a3a", [4.6, 2.8, 3.0], 60);
};

// ================================================================ 4 심해 협곡
/** 대왕유령해파리: 세 겹의 비치는 우산과 네잎 무늬의 속빛, 넓은 주름 팔 네 가닥, 길게 끌리는 촉수 스무 가닥. 숨 쉬듯 오므라들고 곁에 새끼 해파리가 떠다닌다 */
const ghostJelly: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const veilM = (c: string, op: number) => new THREE.MeshPhysicalMaterial({ color: c, transparent: true, opacity: op, roughness: 0.1, side: THREE.DoubleSide, emissive: new THREE.Color(c), emissiveIntensity: 0.6, depthWrite: false });
  const bell = G([0, 0.5, 0], M(new THREE.SphereGeometry(0.5, 36, 18, 0, PI2, 0, PI * 0.6), veilM("#c8a8ff", 0.45), [0, 0, 0], [0, 0, 0], [2.2, 1.7, 2.2]), M(new THREE.SphereGeometry(0.5, 30, 14, 0, PI2, 0, PI * 0.55), veilM("#ffffff", 0.35), [0, 0.02, 0], [0, 0, 0], [1.8, 1.4, 1.8]), M(sph(0.5, 20, 14), lit("#f0e0ff"), [0, 0.32, 0], [0, 0, 0], [0.6, 0.4, 0.6]), spr("#c8a0ff", 2.6, 0.5));
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI2 + PI / 4; bell.add(M(tor(0.2, 0.05, PI2, 20), lit("#ff9af0"), [Math.cos(a) * 0.3, 0.48, Math.sin(a) * 0.3], [PI / 2, 0, 0])); } // 네잎 무늬
  for (let i = 0; i < 24; i++) { const a = (i / 24) * PI2; bell.add(M(sph(0.06, 8, 6), lit("#ffffff"), [Math.cos(a) * 1.03, -0.24, Math.sin(a) * 1.03])); }
  for (const s of [-1, 1]) bell.add(M(sph(0.07, 10, 8), lit("#ffffff"), [0.7, 0.3, s * 0.3]), spr("#ffffff", 0.4, 0.6)); // 희미한 두 눈빛
  bell.children[bell.children.length - 1].position.set(0.7, 0.3, 0);
  g.add(bell);
  for (let i = 0; i < 4; i++) { const a = (i / 4) * PI2, v = veil(2.6, 0.7, C(i % 2 ? "#ffffff" : "#e0c8ff"), 0.45, anim, i * 1.5), h = G([Math.cos(a) * 0.25, 0.3, Math.sin(a) * 0.25], v); h.rotation.set(0, a, -PI / 2 + 0.12); g.add(h); } // 주름 팔
  const tm = veilM("#c8a0ff", 0.8);
  for (let i = 0; i < 20; i++) { const a = (i / 20) * PI2, L = 2.6 + (i % 4) * 0.7, ph = i * 0.9; arm(g, anim, 14, 0.035, 0.012, tm, (u, t) => V(Math.cos(a) * (0.95 - u * 0.3) - u * u * 0.9 + Math.sin(t * 1.2 + ph + u * 4) * 0.14 * u, 0.25 - u * L + Math.sin(t * 1.8) * 0.06, Math.sin(a) * (0.95 - u * 0.3) + Math.cos(t * 1.1 + ph + u * 4) * 0.14 * u)); }
  anim.push((t) => { const k = Math.sin(t * 1.8); bell.scale.set(1 + k * 0.07, 1 - k * 0.09, 1 + k * 0.07); bell.position.y = 0.5 + k * 0.05; });
  const babies = new THREE.Group(); for (let i = 0; i < 6; i++) { const b = G([0, 0, 0], M(new THREE.SphereGeometry(0.14, 12, 8, 0, PI2, 0, PI * 0.6), veilM("#ffd0ff", 0.6)), M(sph(0.05, 8, 6), lit("#ffffff"), [0, 0.04, 0])); for (let k = 0; k < 4; k++) b.add(M(cyl(0.008, 0.004, 0.3, 4), lit("#e0c8ff"), [Math.cos(k * 1.57) * 0.08, -0.16, Math.sin(k * 1.57) * 0.08])); b.userData.ph = (i / 6) * PI2; babies.add(b); } g.add(babies);
  anim.push((t) => babies.children.forEach((b, i) => { const a = (b.userData.ph as number) + t * 0.3; b.position.set(Math.cos(a) * 1.9, 0.4 + Math.sin(t * 0.9 + i) * 0.7, Math.sin(a) * 1.9); b.scale.setScalar(1 + Math.sin(t * 2.5 + i) * 0.12); }));
  motes(g, anim, ["#e0c8ff", "#ffffff", "#ff9af0"], 60, [1.8, 2.4, 1.8], [0, 0.18, 0], 0.11, [0, -0.8, 0]);
  return finL(g, anim, 1.3, "#b08aff", "#ffffff", [3.4, 5.0, 3.4], 34);
};

/** 심연대왕오징어: 화살촉 같은 긴 몸과 접시만 한 푸른 눈. 몸에 줄지어 차례로 켜지는 발광점, 꿈틀대는 여덟 팔과 끝이 곤봉 같은 긴 촉수 둘, 뒤로 뿜는 빛나는 먹물 */
const abyssSquid: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = painted((x, W, H) => { vgrad(x, W, H, [[0, "#2a0a26"], [0.6, "#5a1438"], [1, "#8a2a4a"]]); for (let i = 0; i < 200; i++) { x.fillStyle = i % 4 ? "rgba(255,90,140,.5)" : "#4ac8ff"; x.beginPath(); x.arc(rnd(i) * W, rnd(i + 6) * H, 1.5 + rnd(i + 2) * 3, 0, 7); x.fill(); } }, { emissiveIntensity: 0.4 });
  const mantle = M(profileBody(2.6, 0.66, 0.66, 0.72, false, 1.5), skin, [-1.0, 0, 0]); g.add(mantle, M(sph(0.5, 20, 14), skin, [0.42, 0, 0], [0, 0, 0], [0.7, 0.56, 0.56]));
  for (const s of [-1, 1]) { const f = fin([[0, 0], [0.5, 0.42], [0.2, 0.75], [-0.5, 0.42], [-0.6, 0]], phys("#7a2040", { side: THREE.DoubleSide, emissive: C("#ff5a8a"), emissiveIntensity: 0.25 }), 0.03), h = G([-1.85, 0, s * 0.16], f); f.rotation.x = s * PI / 2; g.add(h); sway(anim, h, "x", 0.3, 2.2, s); } // 뒤쪽 마름모 지느러미
  for (const s of [-1, 1]) { const e = G([0.46, 0.02, s * 0.27], M(sph(0.2, 20, 14), phys("#0a1a3a", { roughness: 0.05 })), M(sph(0.5, 18, 12), lit("#4ac8ff"), [0, 0, s * 0.11], [0, 0, 0], [0.3, 0.3, 0.1]), M(sph(0.5, 12, 10), lit("#04060c"), [0, 0, s * 0.155], [0, 0, 0], [0.14, 0.14, 0.05]), spr("#4ac8ff", 0.9, 0.45)); g.add(e); } // 접시만 한 눈
  const dots: THREE.Mesh[] = []; for (const s of [-1, 1]) for (const y of [0.14, -0.1]) for (let i = 0; i < 12; i++) { const d = M(sph(0.035, 8, 6), new THREE.MeshBasicMaterial({ color: "#4ac8ff" }), [0.1 - i * 0.17, y * (1 - i * 0.05), s * (0.31 - i * 0.02)]); d.userData.i = i; dots.push(d); g.add(d); }
  anim.push((t) => dots.forEach((d) => { const k = Math.max(0, Math.sin(d.userData.i * 0.6 - t * 4)); d.scale.setScalar(0.5 + k * 1.2); (d.material as THREE.MeshBasicMaterial).color.setHSL(0.55 - k * 0.12, 1, 0.45 + k * 0.3); })); // 차례로 켜지는 발광점
  const suck = lit("#ff8ab0");
  for (let i = 0; i < 8; i++) { const a = (i / 8) * PI2, ph = i * 1.1, L = 1.5 + (i % 2) * 0.3, at = (u: number, t: number) => V(0.7 + u * L, Math.cos(a) * (0.16 + u * 0.3) + Math.sin(t * 2 + ph + u * 4) * 0.18 * u, Math.sin(a) * (0.16 + u * 0.3) + Math.cos(t * 1.7 + ph + u * 4) * 0.18 * u); arm(g, anim, 14, 0.09, 0.02, skin, at); arm(g, anim, 6, 0.025, 0.012, suck, (u, t) => at(u * 0.9 + 0.05, t).add(V(0, 0, 0)).multiply(V(1, 0.9, 0.9))); }
  for (const s of [-1, 1]) { const club = G([0, 0, 0], M(sph(0.5, 12, 10), skin, [0, 0, 0], [0, 0, 0], [0.5, 0.16, 0.22])); for (let k = 0; k < 6; k++) club.add(M(sph(0.03, 6, 5), lit("#4ac8ff"), [-0.18 + k * 0.07, -0.06, 0])); arm(g, anim, 22, 0.04, 0.028, skin, (u, t) => V(0.7 + u * 3.6, Math.sin(u * 5 - t * 2.2) * 0.3 * u, s * (0.2 + u * 0.7) + Math.cos(u * 4 - t * 1.8) * 0.3 * u), club); }
  for (let i = 0; i < 5; i++) { const ink = spr(i % 2 ? "#4ac8ff" : "#b05aff", 1, 0.4); g.add(ink); anim.push((t) => { const u = (t * 0.25 + i / 5) % 1; ink.position.set(-2.3 - u * 2.4, Math.sin(i * 2.1) * 0.3 * u, Math.cos(i * 1.7) * 0.3 * u); ink.scale.setScalar(0.5 + u * 2.4); (ink.material as THREE.SpriteMaterial).opacity = 0.45 * (1 - u); }); } // 빛나는 먹물
  motes(g, anim, ["#4ac8ff", "#ff5a8a", "#ffffff"], 50, [2.8, 0.9, 0.9], [-1.0, 0, 0], 0.1);
  return finL(g, anim, 1.35, "#4ac8ff", "#ff5a8a", [6.0, 1.6, 1.8], 30);
};

/** 별하늘개복치: 키가 큰 원반 몸 전체가 밤하늘. 위아래로 솟은 긴 지느러미를 번갈아 젓고, 옆구리에 반짝이는 별자리, 몸을 두른 토성 같은 고리와 떠도는 달 */
const galaxyMola: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const sky = painted((x, W, H) => { vgrad(x, W, H, [[0, "#0a0a2a"], [0.5, "#1a1450"], [1, "#3a1a6a"]]); for (let i = 0; i < 9; i++) { const r = x.createRadialGradient(rnd(i) * W, rnd(i + 3) * H, 0, rnd(i) * W, rnd(i + 3) * H, 70 + rnd(i + 5) * 60); r.addColorStop(0, i % 2 ? "rgba(255,90,200,.55)" : "rgba(80,180,255,.55)"); r.addColorStop(1, "rgba(0,0,0,0)"); x.fillStyle = r; x.fillRect(0, 0, W, H); } for (let i = 0; i < 260; i++) { x.fillStyle = "#ffffff"; x.globalAlpha = 0.4 + rnd(i + 1) * 0.6; x.beginPath(); x.arc(rnd(i + 9) * W, rnd(i + 11) * H, rnd(i + 13) * 2.2 + 0.5, 0, 7); x.fill(); } }, { emissiveIntensity: 0.75, roughness: 0.2 });
  const finM = phys("#2a1a6a", { side: THREE.DoubleSide, emissive: C("#7a5aff"), emissiveIntensity: 0.4 });
  g.add(M(sph(0.5, 36, 26), sky, [0, 0, 0], [0, 0, 0], [1.9, 2.1, 0.55]));
  const top = fin([[0.25, 0], [0.1, 0.9], [-0.25, 1.55], [-0.5, 1.2], [-0.55, 0]], finM), bot = fin([[0.25, 0], [0.1, -0.9], [-0.25, -1.55], [-0.5, -1.2], [-0.55, 0]], finM);
  const ht = G([-0.25, 0.92, 0], top), hb = G([-0.25, -0.92, 0], bot); g.add(ht, hb); sway(anim, ht, "x", 0.5, 2); sway(anim, hb, "x", 0.5, 2, PI);
  for (let i = 0; i < 9; i++) { const a = -1.1 + (i / 8) * 2.2; g.add(M(sph(0.5, 12, 8), finM, [-0.93 + Math.cos(a) * 0.08 - 0.06, Math.sin(a) * 0.86, 0], [0, 0, a], [0.4, 0.26, 0.06])); } // 물결 모양 뒤 지느러미
  for (const s of [-1, 1]) { const pf = sideFin(0.34, finM), h = G([0.3, 0.05, s * 0.27], pf); pf.rotation.set(s * 1.3, 0, 0.2); g.add(h); sway(anim, h, "x", 0.5, 6, s); const e = eyeBall(0.13, "#bfd0ff"); e.position.set(0.6, 0.22, s * 0.2); e.rotation.y = -s * 0.5; g.add(e); }
  g.add(M(tor(0.09, 0.035), phys("#c8b8ff"), [0.94, 0.0, 0], [0, PI / 2, 0]));
  const stars: THREE.Mesh[] = []; // 별자리
  for (const s of [-1, 1]) { const pts = [[0.35, 0.5], [0.1, 0.62], [-0.15, 0.4], [-0.05, 0.1], [0.25, -0.05], [0.1, -0.4], [-0.3, -0.5]].map(([x0, y0]) => V(x0, y0, s * 0.28 * Math.sqrt(Math.max(0.02, 1 - (x0 / 0.95) ** 2 - (y0 / 1.05) ** 2)) + s * 0.01)); const ln = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: "#bfd8ff", transparent: true, opacity: 0.8 })); g.add(ln); pts.forEach((p, i) => { const st = M(new THREE.OctahedronGeometry(0.045), new THREE.MeshBasicMaterial({ color: "#ffffff" }), [p.x, p.y, p.z]); st.userData.i = i; stars.push(st); g.add(st); }); }
  anim.push((t) => stars.forEach((s) => s.scale.setScalar(0.7 + Math.max(0, Math.sin(t * 3 + s.userData.i * 1.3)) * 0.9)));
  const ringG = G([0, 0, 0], Object.assign(M(new THREE.RingGeometry(1.35, 1.75, 64), add("#b8a0ff", 0.35), [0, 0, 0], [PI / 2, 0, 0]), { name: "fx" }), Object.assign(M(new THREE.RingGeometry(1.85, 1.95, 64), add("#ffffff", 0.4), [0, 0, 0], [PI / 2, 0, 0]), { name: "fx" })); ringG.rotation.set(0.5, 0, 0.35); g.add(ringG); // 토성 같은 고리
  const moons = new THREE.Group(); [["#fff0c0", 0.14], ["#8ad8ff", 0.09], ["#ff9ad0", 0.11]].forEach(([c, r], i) => { const m = G([0, 0, 0], M(sph(r as number, 14, 10), phys(c as string, { emissive: C(c as string), emissiveIntensity: 0.6 })), spr(c as string, (r as number) * 5, 0.4)); m.userData.ph = i * 2.1; moons.add(m); }); ringG.add(moons);
  anim.push((t) => { ringG.rotation.y = t * 0.15; moons.children.forEach((m, i) => { const a = (m.userData.ph as number) + t * (0.5 + i * 0.2); m.position.set(Math.cos(a) * (1.55 + i * 0.25), 0, Math.sin(a) * (1.55 + i * 0.25)); }); });
  motes(g, anim, ["#ffffff", "#b8a0ff", "#8ad8ff"], 80, [2.2, 1.8, 1.4], [-0.6, -0.2, 0], 0.09);
  return finL(g, anim, 1.35, "#7a5aff", "#ffffff", [3.6, 3.8, 3.4], 36);
};

/** 심연의 눈(신화): 몸이 곧 하나의 거대한 눈. 겹겹이 도는 홍채와 조였다 풀리는 세로 눈동자, 눈을 감싸 여닫히는 발톱 눈꺼풀, 뒤로 뻗은 끝마다 작은 눈이 달린 촉수, 둘레를 떠도는 눈알들과 어둠의 고리 */
const abyssEye: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const flesh = painted((x, W, H) => { vgrad(x, W, H, [[0, "#1a0a38"], [0.6, "#3a1466"], [1, "#12061e"]]); x.strokeStyle = "#b05aff"; for (let i = 0; i < 30; i++) { x.lineWidth = 1 + rnd(i) * 3; x.globalAlpha = 0.5; x.beginPath(); x.moveTo(rnd(i + 1) * W, 0); x.bezierCurveTo(rnd(i + 2) * W, H * 0.4, rnd(i + 3) * W, H * 0.7, rnd(i + 4) * W, H); x.stroke(); } }, { emissiveIntensity: 0.5 });
  g.add(M(sph(1, 40, 30), flesh, [-0.1, 0, 0], [0, 0, 0], [1.05, 1, 1]));
  const eye = G([0.55, 0, 0], M(sph(0.78, 36, 26), phys("#f4f0ff", { roughness: 0.06, emissive: C("#b8a0ff"), emissiveIntensity: 0.35 }), [-0.2, 0, 0]));
  const iris: THREE.Mesh[] = [["#b05aff", 0.6, 0.6], ["#4ae8ff", 0.48, 0.62], ["#ff5ad8", 0.36, 0.64]].map(([c, r, x0], i) => { const d = M(new THREE.RingGeometry((r as number) * 0.62, r as number, 48, 1), new THREE.MeshBasicMaterial({ color: c as string, side: THREE.DoubleSide }), [x0 as number, 0, 0], [0, PI / 2, 0]); for (let k = 0; k < 14; k++) { const a = (k / 14) * PI2; d.add(M(box(0.012, (r as number) * 0.36, 0.004), lit(i % 2 ? "#ffffff" : "#1a0a38"), [Math.cos(a) * (r as number) * 0.81, Math.sin(a) * (r as number) * 0.81, 0.002], [0, 0, a + PI / 2])); } eye.add(d); return d; });
  const pupil = M(sph(0.5, 20, 16), lit("#04020a"), [0.66, 0, 0], [0, 0, 0], [0.1, 0.5, 0.16]); eye.add(pupil, M(sph(0.06, 10, 8), lit("#ffffff"), [0.72, 0.16, 0.12]), spr("#b05aff", 3.4, 0.5));
  g.add(eye);
  anim.push((t) => { iris.forEach((d, i) => { d.rotation.x = t * (0.6 + i * 0.5) * (i % 2 ? -1 : 1); }); const k = 0.5 + 0.5 * Math.sin(t * 1.3); pupil.scale.set(0.1, 0.5, 0.06 + k * 0.22); eye.rotation.set(0, Math.sin(t * 0.7) * 0.25, Math.sin(t * 0.5) * 0.18); }); // 눈이 주위를 둘러본다
  const lash = phys("#1a0a2a", { roughness: 0.3, emissive: C("#b05aff"), emissiveIntensity: 0.35 }), lids: THREE.Group[] = [];
  for (let i = 0; i < 14; i++) { const a = (i / 14) * PI2, h = G([0.35, Math.cos(a) * 0.82, Math.sin(a) * 0.82], tube([V(0, 0, 0), V(0.35, 0.3, 0), V(0.8, 0.26, 0), V(1.15, -0.05, 0)], 0.09, lash, 0.15)); h.rotation.x = a; g.add(h); lids.push(h); } // 발톱 눈꺼풀
  anim.push((t) => { const blink = Math.pow(Math.max(0, Math.sin(t * 0.9)), 14); lids.forEach((h, i) => { h.children[0].rotation.z = 0.25 - blink * 0.75 + Math.sin(t * 1.5 + i) * 0.05; }); });
  const tm = flesh;
  for (let i = 0; i < 12; i++) { const a = (i / 12) * PI2, ph = i * 1.4, L = 2.6 + (i % 3) * 0.6, tip = G([0, 0, 0], M(sph(0.11, 14, 10), phys("#f4f0ff", { emissive: C("#b8a0ff"), emissiveIntensity: 0.5 })), M(sph(0.06, 10, 8), lit(i % 2 ? "#4ae8ff" : "#ff5ad8"), [-0.07, 0, 0]), M(sph(0.03, 8, 6), lit("#04020a"), [-0.11, 0, 0])); arm(g, anim, 18, 0.17, 0.035, tm, (u, t) => V(-0.8 - u * L, Math.cos(a) * (0.5 + u * 0.7) + Math.sin(t * 1.4 + ph + u * 4) * 0.35 * u, Math.sin(a) * (0.5 + u * 0.7) + Math.cos(t * 1.2 + ph + u * 4) * 0.35 * u), tip); } // 끝마다 작은 눈이 달린 촉수
  const minis = new THREE.Group(); for (let i = 0; i < 7; i++) { const e = eyeBall(0.13, ["#b05aff", "#4ae8ff", "#ff5ad8"][i % 3], "slit", 1.2); e.userData.ph = (i / 7) * PI2; minis.add(e); } g.add(minis);
  anim.push((t) => minis.children.forEach((e, i) => { const a = (e.userData.ph as number) + t * 0.45; e.position.set(Math.cos(a) * 2.0 - 0.2, Math.sin(a * 2 + i) * 0.9, Math.sin(a) * 2.0); e.lookAt(e.position.clone().multiplyScalar(2)); e.rotateY(-PI / 2); }));
  const dark = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: "#04020a", transparent: true, opacity: 0.75, depthWrite: false })); dark.scale.set(6.5, 6.5, 1); dark.name = "fx"; dark.position.x = -0.6; g.add(dark); // 뒤의 어둠
  const voids: THREE.Mesh[] = []; for (let i = 0; i < 3; i++) { const r = Object.assign(M(tor(1.5 + i * 0.4, 0.03, PI2, 64), add(i % 2 ? "#4ae8ff" : "#b05aff", 0.8)), { name: "fx" }); g.add(r); voids.push(r); }
  anim.push((t) => voids.forEach((r, i) => { r.rotation.set(t * 0.3 * (i + 1), t * 0.2 * (i % 2 ? -1 : 1), i); r.scale.setScalar(1 + Math.sin(t * 1.2 + i) * 0.06); }));
  const rays = spr("#b05aff", 7, 0.3, raysTex()); g.add(rays); anim.push((t) => { (rays.material as THREE.SpriteMaterial).rotation = -t * 0.15; });
  motes(g, anim, ["#b05aff", "#4ae8ff", "#ff5ad8", "#ffffff"], 110, [3.2, 2.2, 2.6], [-0.5, 0.1, 0], 0.12, [-0.8, 0, 0]);
  return finishMythic(g, anim, 1.5, "#b05aff", "#4ae8ff", [5.6, 3.6, 4.2], 56);
};

// ================================================================ 5 거북이 만
/** 해돋이돌고래: 등은 주황, 배는 분홍과 크림빛으로 번지는 돌고래. 몸을 굽이치며 헤엄치고, 등 뒤에 떠오르는 해와 햇살, 목에 건 꽃목걸이, 꼬리가 남기는 물보라 */
const sunriseDolphin: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [], body = new THREE.Group();
  const skin = painted((x, W, H) => vgrad(x, W, H, [[0, "#ff7a2a"], [0.35, "#ff9a5a"], [0.6, "#ff8aa8"], [0.85, "#fff0d8"], [1, "#ffffff"]]), { emissiveIntensity: 0.3 });
  const finM = phys("#ff8a4a", { side: THREE.DoubleSide, emissive: C("#ff8a4a"), emissiveIntensity: 0.25 });
  body.add(M(profileBody(2.3, 0.62, 0.52, 0.62, false, 0.85), skin), M(sph(0.5, 20, 16), skin, [0.82, 0.07, 0], [0, 0, 0], [0.62, 0.5, 0.44]), M(sph(0.5, 16, 10), skin, [1.2, -0.06, 0], [0, 0, 0], [0.46, 0.13, 0.17])); // 둥근 이마와 부리
  body.add(tube([V(1.4, -0.06, 0.07), V(1.1, -0.1, 0.15), V(0.86, -0.04, 0.2)], 0.012, phys("#c84a2a"), 1), tube([V(1.4, -0.06, -0.07), V(1.1, -0.1, -0.15), V(0.86, -0.04, -0.2)], 0.012, phys("#c84a2a"), 1)); // 웃는 입
  eyesOn(body, 0.055, 0.86, 0.06, 0.2, "#ffe07a");
  const df = fin([[0.3, 0], [0.05, 0.42], [-0.3, 0.5], [-0.12, 0.2], [-0.3, 0]], finM); df.position.set(0, 0.27, 0); body.add(df);
  for (const s of [-1, 1]) { const pf = sideFin(0.52, finM), h = G([0.5, -0.2, s * 0.2], pf); pf.rotation.set(s * 1.1, 0.2, -0.7); body.add(h); sway(anim, h, "x", 0.2, 2.4, s); }
  const tail = G([-1.12, 0, 0], tailFin(0.6, finM, "crescent")); tail.children[0].rotation.x = PI / 2; body.add(tail);
  const FL = ["#ff5a8a", "#ffffff", "#ffe04a", "#ff8a4a"]; for (let i = 0; i < 14; i++) { const a = (i / 14) * PI2, f = anemone(FL[i % 4], 0.07); f.position.set(0.52, Math.cos(a) * 0.3, Math.sin(a) * 0.25); f.rotation.x = a; body.add(f); } // 꽃목걸이
  g.add(body);
  anim.push((t) => { body.rotation.z = Math.sin(t * 2.2) * 0.16; body.position.y = Math.sin(t * 2.2 + 1) * 0.1; tail.rotation.z = Math.sin(t * 2.2 - 1.2) * 0.5; });
  const sunRays = spr("#ffd860", 5.5, 0.45, raysTex()), sun = G([-0.3, 0.9, -0.5], M(sph(0.42, 24, 18), lit("#fff0a0")), spr("#ffb030", 3.2, 0.7), sunRays); sun.name = "fx"; g.add(sun); // 떠오르는 해
  anim.push((t) => { (sunRays.material as THREE.SpriteMaterial).rotation = t * 0.2; sun.position.y = 0.9 + Math.sin(t * 0.8) * 0.08; });
  for (let i = 0; i < 4; i++) { const r = Object.assign(M(tor(0.3, 0.014, PI2, 30), add("#ffffff", 0.7), [-1.3, 0, 0], [0, PI / 2, 0]), { name: "fx" }); g.add(r); anim.push((t) => { const u = (t * 0.7 + i / 4) % 1; r.position.x = -1.3 - u * 1.6; r.scale.setScalar(0.5 + u * 2); (r.material as THREE.MeshBasicMaterial).opacity = 0.7 * (1 - u); }); } // 물보라 고리
  motes(g, anim, ["#ffe07a", "#ff9a5a", "#ffffff", "#ff8aa8"], 60, [2.0, 1.0, 1.0], [-0.7, 0.12, 0], 0.1);
  return finL(g, anim, 1.35, "#ff9a3a", "#ff8aa8", [3.6, 2.4, 2.0], 32);
};

/** 황금투구게: 둥근 금빛 투구 등딱지에 해 무늬가 돋을새김된 투구게. 가시 돋은 배딱지와 길고 곧은 꼬리 가시, 보석 겹눈, 배 밑에서 젓는 다리, 등에서 퍼지는 햇살 고리 */
const goldenHorseshoeCrab: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const shell = painted((x, W, H) => { vgrad(x, W, H, [[0, "#ffe07a"], [0.6, "#e8a820"], [1, "#a86a10"]]); x.strokeStyle = "rgba(120,70,0,.5)"; x.lineWidth = 3; for (let i = 0; i < 24; i++) { x.beginPath(); x.moveTo((i / 24) * W, 0); x.lineTo((i / 24) * W + 20, H); x.stroke(); } }, { metalness: 0.75, roughness: 0.25, emissiveIntensity: 0.3 });
  const gd = gold(), dark = phys("#7a4a10", { metalness: 0.5 });
  g.add(M(dome(0.5, 36, 14), shell, [0.35, 0, 0], [0, 0, 0], [1.9, 0.9, 2.1]), M(tor(0.5, 0.03, PI2, 48), gd, [0.35, 0.01, 0], [PI / 2, 0, 0], [1.9, 2.1, 1]), M(sph(0.5, 24, 10), dark, [0.35, -0.02, 0], [0, 0, 0], [1.8, 0.16, 2.0]));
  g.add(M(dome(0.5, 24, 10), shell, [-0.75, 0, 0], [0, 0, 0], [1.1, 0.55, 1.35])); // 배딱지
  for (const s of [-1, 1]) { for (let i = 0; i < 6; i++) g.add(M(cone(0.045, 0.3, 6), gd, [-0.4 - i * 0.14, 0.03, s * (0.66 - i * 0.06)], [s * 1.2, 0, 0.5])); g.add(M(cone(0.1, 0.5, 6), gd, [-0.25, 0.02, s * 1.0], [s * 1.35, 0, 0.9]), M(sph(0.09, 14, 10), gem("#ff5a3a"), [0.75, 0.3, s * 0.46]), M(tor(0.1, 0.02), gd, [0.75, 0.29, s * 0.46], [PI / 2 - s * 0.5, 0, 0])); } // 옆 가시, 뒤 뿔, 보석 겹눈
  for (let i = 0; i < 3; i++) g.add(tube([V(1.1 - i * 0.1, 0.2 + i * 0.1, 0), V(0.5, 0.42 + i * 0.01, (i - 1) * 0.3), V(-0.2, 0.36, (i - 1) * 0.42)], 0.022, gd, 0.8)); // 등의 능선
  const tail = G([-1.25, 0.05, 0], M(cone(0.07, 1.9, 8), gd, [-0.95, 0, 0], [0, 0, PI / 2])); for (let i = 0; i < 7; i++) tail.add(M(cone(0.025, 0.1, 5), gd, [-0.2 - i * 0.22, 0.06, 0])); g.add(tail); sway(anim, tail, "y", 0.25, 1.6); sway(anim, tail, "z", 0.1, 1.1);
  const sunE = G([0.4, 0.44, 0], M(cyl(0.2, 0.2, 0.03, 24), gd), M(sph(0.13, 16, 12), gem("#ffb030"), [0, 0.03, 0])); for (let i = 0; i < 12; i++) { const a = (i / 12) * PI2; sunE.add(M(cone(0.04, i % 2 ? 0.3 : 0.2, 4), gd, [Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34], [0, -a, -PI / 2], [1, 1, 0.4])); } sunE.rotation.z = -0.2; g.add(sunE); // 등의 해 무늬
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) { const l = tube([V(0, 0, 0), V(0.05, -0.2, s * 0.25), V(0.0, -0.4, s * 0.4)], 0.03, dark, 0.5), h = G([0.7 - i * 0.22, -0.02, s * 0.2], l); g.add(h); sway(anim, h, "z", 0.4, 5, i * 1.2 + (s > 0 ? 0 : PI)); } // 배 밑의 다리
  const halos: THREE.Mesh[] = []; for (let i = 0; i < 3; i++) { const r = Object.assign(M(tor(0.3, 0.014, PI2, 40), add("#ffe07a", 0.8), [0.4, 0.5, 0], [PI / 2, 0, 0]), { name: "fx" }); g.add(r); halos.push(r); }
  anim.push((t) => { halos.forEach((r, i) => { const u = (t * 0.4 + i / 3) % 1; r.scale.setScalar(1 + u * 5); r.position.y = 0.5 + u * 0.5; (r.material as THREE.MeshBasicMaterial).opacity = 0.8 * (1 - u); }); g.rotation.z = Math.sin(t * 1.3) * 0.06; });
  const glowS = spr("#ffcf40", 1.8, 0.55); glowS.position.set(0.4, 0.6, 0); g.add(glowS);
  motes(g, anim, ["#ffe07a", "#ffffff", "#ffb030"], 50, [1.8, 0.8, 1.4], [-0.3, 0.2, 0], 0.1, [0, 0.4, 0]);
  return finL(g, anim, 1.35, "#ffcf40", "#ff9a3a", [4.4, 1.6, 2.8], 32);
};

/** 흰수염바다소: 눈처럼 흰 둥글둥글한 바다소. 넓은 주둥이에서 물결치는 길고 흰 수염, 해초와 꽃으로 엮은 화관, 둥근 노 꼬리, 곁을 따라 헤엄치는 새끼 */
const whiteBeardManatee: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const skin = painted((x, W, H) => { vgrad(x, W, H, [[0, "#e8eef6"], [0.6, "#f8fafc"], [1, "#ffffff"]]); x.fillStyle = "rgba(170,190,210,.35)"; for (let i = 0; i < 40; i++) { x.beginPath(); x.ellipse(rnd(i) * W, rnd(i + 2) * H, 14 + rnd(i + 4) * 20, 5, rnd(i) * 3, 0, 7); x.fill(); } }, { roughness: 0.45, clearcoat: 0.4, emissiveIntensity: 0.3 });
  const baby = (k: number) => { const b = new THREE.Group(); b.add(M(profileBody(2.2 * k, 1.0 * k, 0.95 * k, 0.56, false, 0.6), skin), M(sph(0.5, 20, 16), skin, [0.78 * k, 0.02, 0], [0, 0, 0], [0.8 * k, 0.74 * k, 0.72 * k]), M(sph(0.5, 16, 12), phys("#f0e4e4"), [1.1 * k, -0.1 * k, 0], [0, 0, 0], [0.44 * k, 0.4 * k, 0.56 * k])); for (const s of [-1, 1]) { b.add(M(sph(0.035 * k, 10, 8), phys("#1a1420", { roughness: 0.1 }), [0.95 * k, 0.14 * k, s * 0.27 * k]), M(sph(0.03 * k, 8, 6), phys("#c8a8a8"), [1.3 * k, -0.02 * k, s * 0.09 * k])); const pf = sideFin(0.5 * k, skin), h = G([0.45 * k, -0.3 * k, s * 0.4 * k], pf); pf.rotation.set(s * 1.2, 0.2, -0.8); b.add(h); sway(anim, h, "x", 0.25, 1.6, s); } const tail = G([-1.05 * k, 0, 0], M(sph(0.5, 18, 10), skin, [-0.3 * k, 0, 0], [0, 0, 0], [0.8 * k, 0.1 * k, 0.85 * k])); b.add(tail); sway(anim, tail, "z", 0.3, 1.5, k); return b; };
  const mom = baby(1); g.add(mom);
  for (let i = 0; i < 16; i++) { const a = -1.3 + (i / 15) * 2.6, L = 1.3 + Math.cos(a) * 0.9, v = veil(L, 0.14, C("#ffffff"), 0.6, anim, i * 0.7), h = G([1.12 + Math.cos(a) * 0.12, -0.26, Math.sin(a) * 0.3], v); h.rotation.set(0, -a * 0.5 + PI, -1.25); g.add(h); } // 물결치는 흰 수염
  for (const s of [-1, 1]) for (let i = 0; i < 5; i++) g.add(tube([V(1.25, -0.12, s * (0.14 + i * 0.03)), V(1.45, -0.3 - i * 0.05, s * (0.34 + i * 0.07)), V(1.3, -0.75 - i * 0.1, s * (0.5 + i * 0.08))], 0.014, phys("#ffffff", { emissive: C("#ffffff"), emissiveIntensity: 0.4 }), 0.4));
  const wr = G([0.78, 0.38, 0], M(tor(0.34, 0.03), phys("#3a9a5a", { clearcoat: 0 }), [0, 0, 0], [PI / 2, 0, 0])); for (let i = 0; i < 12; i++) { const a = (i / 12) * PI2; if (i % 2) { const f = anemone(["#ff8ac0", "#ffe04a", "#ffffff"][i % 3], 0.07); f.position.set(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34); wr.add(f); } else wr.add(M(sph(0.5, 8, 5), phys("#4ab860", { clearcoat: 0, side: THREE.DoubleSide }), [Math.cos(a) * 0.38, 0.02, Math.sin(a) * 0.38], [0, -a, 0.5], [0.3, 0.03, 0.1])); } wr.rotation.z = -0.2; g.add(wr); // 해초 화관
  for (let i = 0; i < 9; i++) { const a = -1.0 + (i / 8) * 2.0; g.add(M(sph(0.045, 10, 8), gem(i % 2 ? "#ffd0e8" : "#bfeaff"), [0.36, -0.4 - Math.cos(a) * 0.12, Math.sin(a) * 0.46])); } // 조개 목걸이
  const kid = baby(0.36); g.add(kid);
  anim.push((t) => { kid.position.set(0.2 + Math.cos(t * 0.5) * 0.5, -0.75 + Math.sin(t * 0.9) * 0.12, 0.85 + Math.sin(t * 0.5) * 0.25); kid.rotation.y = Math.sin(t * 0.5) * 0.3; mom.rotation.z = Math.sin(t * 1.5) * 0.05; });
  const halo = Object.assign(M(tor(0.3, 0.016, PI2, 40), add("#ffffff", 0.8), [0.78, 0.9, 0], [PI / 2, 0, 0]), { name: "fx" }); g.add(halo); anim.push((t) => { halo.position.y = 0.9 + Math.sin(t * 1.4) * 0.04; halo.rotation.z = t * 0.5; });
  motes(g, anim, ["#ffffff", "#bfeaff", "#d8ffe8"], 60, [1.8, 1.2, 1.2], [0, 0.22, 0], 0.13);
  return finL(g, anim, 1.4, "#ffffff", "#8affd0", [3.4, 2.2, 2.4], 30);
};

/** 섬거북(신화): 등딱지가 통째로 섬인 거대한 거북. 절벽과 모래 해변, 풀 언덕과 야자수, 오두막과 돌아가는 등대 불빛, 절벽에서 떨어지는 폭포, 봉우리를 두른 구름과 맴도는 갈매기. 이끼 수염의 늙은 얼굴과 느릿한 큰 지느러미 */
const islandTurtle: Maker = () => {
  const g = new THREE.Group(), anim: Anim = [];
  const shellM = painted((x, W, H) => { vgrad(x, W, H, [[0, "#5a7a4a"], [0.5, "#6a6a4a"], [1, "#4a4030"]]); x.strokeStyle = "rgba(30,24,14,.6)"; x.lineWidth = 5; for (let r = 0; r < 5; r++) for (let c = 0; c < 12; c++) { x.beginPath(); for (let k = 0; k < 6; k++) { const a = (k / 6) * PI2; x.lineTo(c * 46 + (r % 2) * 23 + Math.cos(a) * 24, r * 54 + Math.sin(a) * 28); } x.closePath(); x.stroke(); } }, { roughness: 0.7, clearcoat: 0.2, emissiveIntensity: 0.25 });
  const flesh = painted((x, W, H) => { vgrad(x, W, H, [[0, "#7a9a5a"], [1, "#d8d09a"]]); x.fillStyle = "rgba(50,70,30,.4)"; for (let i = 0; i < 120; i++) { x.beginPath(); x.arc(rnd(i) * W, rnd(i + 3) * H, 5 + rnd(i + 5) * 9, 0, 7); x.fill(); } }, { roughness: 0.6, clearcoat: 0.3 });
  const rock = phys("#8a8478", { roughness: 0.95, clearcoat: 0 }), sand = phys("#f4e0a8", { roughness: 0.95, clearcoat: 0 }), grass = phys("#5ab850", { roughness: 0.9, clearcoat: 0 }), wd = wood(), moss = phys("#4a9a4a", { roughness: 1, clearcoat: 0 });
  g.add(M(sph(0.5, 36, 24), shellM, [0, 0, 0], [0, 0, 0], [3.2, 1.3, 2.7]), M(sph(0.5, 28, 14), phys("#d8cc98", { roughness: 0.6 }), [0, -0.22, 0], [0, 0, 0], [3.0, 0.7, 2.5]), M(tor(0.5, 0.05, PI2, 48), phys("#3a3424", { roughness: 0.8 }), [0, -0.05, 0], [PI / 2, 0, 0], [3.2, 2.7, 1.6]));
  for (let i = 0; i < 22; i++) { const a = (i / 22) * PI2; g.add(M(new THREE.DodecahedronGeometry(0.16 + rnd(i) * 0.14), rock, [Math.cos(a) * 1.5, 0.1 + rnd(i + 2) * 0.12, Math.sin(a) * 1.26], [rnd(i) * 3, rnd(i + 1) * 3, 0])); if (i % 3 === 0) { const k = coral(["#ff7a9a", "#ffb86a"][i % 2], 0.26); k.position.set(Math.cos(a) * 1.56, -0.2, Math.sin(a) * 1.3); k.rotation.x = PI; g.add(k); } } // 절벽 가장자리와 밑의 산호
  const head = G([1.75, -0.05, 0], M(sph(0.5, 24, 18), flesh, [0.25, 0.05, 0], [0, 0, 0], [1.0, 0.78, 0.8]), M(cyl(0.26, 0.34, 0.6, 14), flesh, [-0.2, 0, 0], [0, 0, PI / 2]), M(sph(0.5, 14, 10), phys("#e8dca0"), [0.68, -0.08, 0], [0, 0, 0], [0.34, 0.26, 0.5]));
  for (const s of [-1, 1]) { const e = eyeBall(0.1, "#ffe07a"); e.position.set(0.5, 0.2, s * 0.3); e.rotation.y = -s * 0.6; head.add(e, M(sph(0.5, 10, 6), flesh, [0.46, 0.33, s * 0.3], [0, 0, -0.2], [0.34, 0.08, 0.2])); for (let i = 0; i < 4; i++) head.add(M(cyl(0.01, 0.004, 0.5 + i * 0.08, 4), moss, [0.55 - i * 0.05, -0.42, s * (0.1 + i * 0.06)], [0, 0, 0.15])); } // 이끼 수염
  head.add(M(dome(0.5, 14, 6), moss, [0.2, 0.4, 0], [0, 0, 0], [0.7, 0.2, 0.6])); g.add(head); sway(anim, head, "z", 0.08, 0.6);
  const flip = (x0: number, z0: number, len: number, ry: number, ph: number) => { const s = Math.sign(z0), f = fin([[0, 0.25], [len * 0.5, 0.36], [len, 0.1], [len * 0.9, -0.14], [len * 0.4, -0.22], [0, -0.2]], Object.assign(flesh.clone(), { side: THREE.DoubleSide }), 0.08), h = G([x0, -0.22, z0], f); f.rotation.set(PI / 2, 0, 0); h.rotation.y = -s * ry; g.add(h); anim.push((t) => { h.rotation.x = s * Math.sin(t * 0.9 + ph) * 0.4; h.rotation.y = -s * (ry + Math.cos(t * 0.9 + ph) * 0.2); }); };
  flip(1.1, 1.0, 1.8, 1.0, 0); flip(1.1, -1.0, 1.8, 1.0, 0); flip(-1.2, 0.85, 1.0, 2.3, PI); flip(-1.2, -0.85, 1.0, 2.3, PI);
  g.add(M(cone(0.14, 0.6, 8), flesh, [-1.85, -0.15, 0], [0, 0, PI / 2]));
  const isle = G([0, 0.5, 0], M(dome(0.5, 28, 10), sand, [0, 0, 0], [0, 0, 0], [2.7, 0.5, 2.2]), M(dome(0.5, 24, 10), grass, [-0.2, 0.08, 0], [0, 0, 0], [1.9, 0.85, 1.5]), M(cone(0.5, 1.0, 9), rock, [-0.45, 0.6, -0.1], [0, 0.4, 0]), M(cone(0.3, 0.55, 8), rock, [-0.1, 0.5, 0.3], [0, 1, 0]), M(cone(0.16, 0.2, 9), lit("#ffffff"), [-0.45, 1.02, -0.1], [0, 0.4, 0]));
  const palm = (x0: number, z0: number, h: number, lean: number) => { const p = G([x0, 0.16, z0], tube([V(0, 0, 0), V(lean * 0.3, h * 0.5, 0), V(lean, h, 0)], 0.035, wd, 0.75)); for (let i = 0; i < 7; i++) { const a = (i / 7) * PI2; p.add(M(sph(0.5, 8, 5), Object.assign(phys("#3aa84a", { clearcoat: 0 }), { side: THREE.DoubleSide }), [lean + Math.cos(a) * 0.2, h - 0.04, Math.sin(a) * 0.2], [0, -a, -0.5], [0.5, 0.03, 0.14])); } p.add(M(sph(0.04, 8, 6), wood("#5a3a1c"), [lean, h - 0.05, 0.04])); isle.add(p); sway(anim, p, "z", 0.06, 1.1, x0 * 3); };
  palm(0.75, 0.45, 0.7, 0.2); palm(0.95, -0.35, 0.55, -0.15); palm(0.35, 0.7, 0.5, 0.12); palm(-0.9, 0.55, 0.6, -0.2); palm(0.6, -0.65, 0.45, 0.1);
  isle.add(M(box(0.26, 0.16, 0.22), wd, [0.45, 0.32, 0.1]), M(cone(0.24, 0.16, 4), phys("#c8703a", { clearcoat: 0 }), [0.45, 0.48, 0.1], [0, PI / 4, 0]), M(box(0.06, 0.09, 0.01), lit("#ffd24d"), [0.45, 0.31, 0.215])); // 오두막
  const light = G([-0.95, 0.3, -0.45], M(cyl(0.06, 0.09, 0.5, 10), phys("#f4f0e8")), M(cyl(0.062, 0.07, 0.08, 10), phys("#e8402a"), [0, 0.1, 0]), M(cyl(0.07, 0.07, 0.07, 10), lit("#fff0a0"), [0, 0.29, 0]), M(cone(0.09, 0.09, 10), phys("#e8402a"), [0, 0.37, 0])), beam = Object.assign(M(cyl(0.02, 0.4, 2.2, 12, true), add("#fff0a0", 0.3), [1.1, 0.29, 0], [0, 0, -PI / 2]), { name: "fx" }), bh = G([0, 0, 0], beam); light.add(bh); isle.add(light); anim.push((t) => { bh.rotation.y = t * 0.8; }); // 등대
  const fallG = new THREE.PlaneGeometry(0.3, 1.0, 1, 8), fall = Object.assign(M(fallG, add("#bfeaff", 0.6), [-0.6, 0.0, 1.0], [0.15, 0, 0]), { name: "fx" }); isle.add(fall, Object.assign(spr("#ffffff", 0.9, 0.5), { name: "fx" })); isle.children[isle.children.length - 1].position.set(-0.6, -0.55, 1.1); anim.push((t) => { (fall.material as THREE.MeshBasicMaterial).opacity = 0.5 + Math.sin(t * 9) * 0.12; }); // 폭포
  for (let i = 0; i < 10; i++) { const f = anemone(["#ff8ac0", "#ffe04a", "#ffffff"][i % 3], 0.045); f.position.set(-0.5 + rnd(i) * 1.6, 0.34 - rnd(i) * 0.1, -0.5 + rnd(i + 4) * 1.0); isle.add(f); }
  const clouds = new THREE.Group(); for (let i = 0; i < 7; i++) { const c = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: "#ffffff", transparent: true, opacity: 0.7, depthWrite: false })); c.name = "fx"; c.scale.set(0.9, 0.45, 1); c.userData.ph = (i / 7) * PI2; clouds.add(c); } isle.add(clouds);
  const gulls = new THREE.Group(); for (let i = 0; i < 5; i++) { const b = G([0, 0, 0], M(box(0.16, 0.012, 0.04), lit("#ffffff"), [0, 0, 0.07], [0.5, 0, 0]), M(box(0.16, 0.012, 0.04), lit("#ffffff"), [0, 0, -0.07], [-0.5, 0, 0])); b.userData.ph = (i / 5) * PI2; gulls.add(b); } isle.add(gulls);
  anim.push((t) => { clouds.children.forEach((c, i) => { const a = (c.userData.ph as number) + t * 0.12; c.position.set(-0.45 + Math.cos(a) * 0.8, 1.0 + Math.sin(i) * 0.1, -0.1 + Math.sin(a) * 0.7); }); gulls.children.forEach((b, i) => { const a = (b.userData.ph as number) - t * 0.6; b.position.set(Math.cos(a) * 1.3, 1.25 + Math.sin(t + i) * 0.15, Math.sin(a) * 1.1); b.rotation.y = -a; (b.children[0] as THREE.Mesh).rotation.x = 0.5 + Math.sin(t * 6 + i) * 0.4; (b.children[1] as THREE.Mesh).rotation.x = -0.5 - Math.sin(t * 6 + i) * 0.4; }); });
  g.add(isle);
  for (let i = 0; i < 14; i++) { const a = (i / 14) * PI2; g.add(M(cyl(0.03, 0.06, 0.07, 7), phys("#e8e0d0", { clearcoat: 0 }), [Math.cos(a) * 1.3, -0.42, Math.sin(a) * 1.1], [PI, 0, 0])); }
  g.add(Object.assign(M(cyl(1.1, 0.5, 6, 20, true), add("#fff0a0", 0.08), [0, 3.6, 0]), { name: "fx" })); // 섬에 내리는 햇살
  motes(g, anim, ["#ffffff", "#bfffd0", "#fff0a0"], 100, [3.0, 1.6, 2.6], [-0.3, 0.2, 0], 0.13, [0, 0.4, 0]);
  return finishMythic(g, anim, 1.5, "#8affb0", "#ffe07a", [5.6, 3.6, 4.6], 56);
};

export const UW_LEGENDS_B: Record<string, Maker> = {
  진주왕관해마: pearlCrownSeahorse, 황금잉어대왕: goldenKoiKing, 수정날개날치: crystalFlyingFish, "보물지기 미믹": treasureMimic,
  대왕유령해파리: ghostJelly, 심연대왕오징어: abyssSquid, 별하늘개복치: galaxyMola, "심연의 눈": abyssEye,
  해돋이돌고래: sunriseDolphin, 황금투구게: goldenHorseshoeCrab, 흰수염바다소: whiteBeardManatee, 섬거북: islandTurtle,
};
void [dorsalFin, glass, glow, ring, iron, cloth, cone, dome];
