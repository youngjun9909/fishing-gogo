# 수중 맵 "해적 보물 동굴" 구역 모델: 가운데 큰 방과 둘레의 작은 방 여섯이 아치로 이어진 동굴. 방 사이에 남은 바위가 굵은 기둥과 벽이 된다.
# 빛은 천장 구멍(가운데 방 구멍으로 올라가면 난파선 지대로 이동)과 바깥으로 난 굴 두 곳으로만 들어온다.
# 구멍에서 멀수록 어두워지는 그늘과 보물의 금빛을 꼭짓점 색에 구워 넣는다.
# 사용: blender -b -P cave.py [-- 미리보기.png]
# 출력: client/public/models/underwater/cave.glb, cave.json (holes: 천장 구멍 [x, y, 반지름, 천장 높이], 첫째(가운데 방)로 올라가면 난파선 지대로 간다)
# 좌표: z=0 이 동굴 바닥
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from mapkit import *

ROCKC, FLOOR = (0.40, 0.45, 0.43), (0.50, 0.50, 0.44)
RING = [(math.cos(math.radians(-90 + 60 * k)) * 50, math.sin(math.radians(-90 + 60 * k)) * 50) for k in range(6)]
ROOMS = [(0, 0, 31.0, 26.0)] + [(x, y, 25.0 + (k % 3) * 1.6, 19.0 + (k % 2) * 3.0) for k, (x, y) in enumerate(RING)]  # (x, y, 반지름, 높이)
TUNNELS = [(RING[0], (0, -1)), (RING[1], (math.cos(-0.66), math.sin(-0.66)))]  # 바깥으로 난 굴: (시작 방, 방향). 아틀란티스 쪽과 산호 숲 쪽
MOUTH = 92.0  # 굴 입구까지의 거리 (구역 중심에서)
PILLARS = [(15, 10, 3.6), (-16, 9, 4.0), (-11, -17, 3.4), (16, -14, 3.8), (RING[3][0] + 6, RING[3][1] + 2, 3.0), (RING[5][0] - 2, RING[5][1] + 6, 3.0)]  # 방 안에 선 기둥 (x, y, 굵기)
HOLES = [(0, 0, 8.5), (RING[2][0], RING[2][1], 7.0), (RING[4][0], RING[4][1], 6.5), (RING[5][0], RING[5][1], 6.0)]  # 천장 구멍
# 보물 상자와 금화 더미 자리 (게임의 소품 배치와 같은 곳). 주변 바닥과 바위에 금빛이 번진다
GOLD = [(-14, -10), (40, 26), (-44, 26), (4, 52), (42, -26)]
SHAFT = 16.0  # 가운데 방 천장 구멍 위로 솟은 굴(난파선 지대의 구덩이로 이어진다)의 높이


def seg_d(x, y, a, d, ln):  # 굴(선분)까지의 거리
    t = min(ln, max(0, (x - a[0]) * d[0] + (y - a[1]) * d[1]))
    return math.hypot(x - a[0] - d[0] * t, y - a[1] - d[1] * t)


def field(x, y, grow, lift):  # 방과 굴을 합친 천장 높이 (grow, lift 만큼 키우면 바깥 겉면)
    c = 0.0
    for rx, ry, r, h in ROOMS:
        q = math.hypot(x - rx, y - ry) / (r + grow)
        if q < 1: c = max(c, (h + lift) * (1 - q * q) ** 0.45)
    for a, d in TUNNELS:
        q = seg_d(x, y, a, d, 60) / (11.0 + grow)
        if q < 1: c = max(c, (13.0 + lift) * (1 - q * q) ** 0.5)
    return c


def ceil_z(x, y):  # 동굴 안 천장 높이. 바위 속이면 None
    c = field(x, y, 0, 0)
    for px, py, pr in PILLARS:  # 기둥: 천장이 기둥 쪽으로 내려오며 붙는다
        d = math.hypot(x - px, y - py)
        if d < pr: return None
        if d < pr + 7: c *= ((d - pr) / 7) ** 0.55
    if c > 0: c += noise.noise(Vector((x * 0.1, y * 0.1, 3.0))) * 1.9
    return c if c > 0.8 else None


def removed(x, y):  # 뚫린 곳: 천장 구멍과 굴 입구 바깥
    if any(math.hypot(x - hx, y - hy) < hr for hx, hy, hr in HOLES): return True
    return any(x * d[0] + y * d[1] > MOUTH and abs(-x * d[1] + y * d[0] - (-a[0] * d[1] + a[1] * d[0])) < 28 for a, d in TUNNELS)


# ---- 동굴 껍데기: 안쪽 천장·벽과 바깥 겉면, 뚫린 곳의 테두리 ----------------------------------
G, N = 2.6, 52
pt = {}
for i in range(-N, N + 1):
    for j in range(-N, N + 1):
        x, y = i * G + noise.noise(Vector((i * 0.9, j * 0.9, 7))) * 0.45, j * G + noise.noise(Vector((i * 0.9, j * 0.9, 11))) * 0.45
        ci = ceil_z(x, y)
        o = field(x, y, 9.0, 5.0)
        pt[(i, j)] = (x, y, ci if ci is not None else -1.0, o + (noise.noise(Vector((x * 0.12, y * 0.12, 0))) * 1.3 if o > 0 else -1.0))
cell = lambda i, j: [pt[(i, j)], pt[(i + 1, j)], pt[(i + 1, j + 1)], pt[(i, j + 1)]]
keep = {}
for i in range(-N, N):
    for j in range(-N, N):
        c = cell(i, j)
        keep[(i, j)] = any(p[3] > 0 for p in c) and not removed(sum(p[0] for p in c) / 4, sum(p[1] for p in c) / 4)
vs, fs = [], []
def quad(a, b, c, d):
    fs.append(tuple(range(len(vs), len(vs) + 4))); vs.extend((a, b, c, d))
for (i, j), k in keep.items():
    if not k: continue
    c = cell(i, j)
    if any(p[2] > 0 for p in c): quad(*[(p[0], p[1], p[2]) for p in (c[0], c[3], c[2], c[1])])  # 천장·벽 (아래를 본다)
    quad(*[(p[0], p[1], p[3]) for p in c])  # 겉면 (위를 본다)
    for (di, dj), (a, b) in (((1, 0), (1, 2)), ((-1, 0), (3, 0)), ((0, 1), (2, 3)), ((0, -1), (0, 1))):  # 뚫린 칸과 맞닿은 변: 두께가 보이는 테두리
        n = (i + di, j + dj)
        if n in keep and not keep[n] and removed((pt[n][0] + pt[(n[0] + 1, n[1] + 1)][0]) / 2, (pt[n][1] + pt[(n[0] + 1, n[1] + 1)][1]) / 2):
            quad((c[a][0], c[a][1], c[a][2]), (c[b][0], c[b][1], c[b][2]), (c[b][0], c[b][1], c[b][3]), (c[a][0], c[a][1], c[a][3]))
# 같은 자리의 꼭짓점은 하나로 (그늘과 빛이 면 사이에서 부드럽게 이어지게)
uniq, remap = {}, []
for v in vs:
    key = (round(v[0], 3), round(v[1], 3), round(v[2], 3))
    remap.append(uniq.setdefault(key, len(uniq)))
emit(list(uniq.keys()), [tuple(remap[i] for i in f) for f in fs], ROCKC, orient=False)

# 가운데 방 천장 구멍 위의 굴: 위로 갈수록 좁아지고 꼭대기는 바위로 막혀 어둡다. 이 굴을 타고 오르면 난파선 지대의 구덩이로 나온다
hx, hy, hr = HOLES[0]
TOP0 = field(hx, hy, 9.0, 5.0)  # 구멍 자리의 겉면 높이
z0 = ROOMS[0][3] - 3
cyl(hx, hy, z0, hr + 1.2, hr - 3.0, TOP0 + SHAFT - z0, 12, jit(ROCKC, 0.05))  # 안쪽 벽(양면이라 안에서 보인다)과 막힌 꼭대기
cyl(hx, hy, TOP0 - 8, hr + 9, hr + 1.0, SHAFT + 8.5, 10, jit(ROCKC, 0.08))  # 바깥에서 보이는 바위 굴뚝
for k in range(26):  # 굴 벽에 튀어나온 바위(밋밋한 통이 되지 않게)
    a, zz = R.uniform(0, math.tau), R.uniform(z0 + 2, TOP0 + SHAFT - 2)
    rr = hr + 1.2 - (zz - z0) / (TOP0 + SHAFT - z0) * 4.2
    rock(hx + math.cos(a) * rr, hy + math.sin(a) * rr, zz, R.uniform(1.2, 2.4), jit(ROCKC, 0.12), flat=R.uniform(0.6, 1.0))
for k in range(9):  # 굴뚝 밑동을 감싼 바위
    a = k / 9 * math.tau + R.uniform(0, 0.5)
    rock(hx + math.cos(a) * (hr + 8), hy + math.sin(a) * (hr + 8), TOP0 - 3, R.uniform(3, 5), jit(ROCKC, 0.12), flat=0.7)

# 바닥
idx, vs, fs = {}, [], []
def fv(i, j):
    if (i, j) not in idx:
        idx[(i, j)] = len(vs); vs.append((pt[(i, j)][0], pt[(i, j)][1], 0.12 + noise.noise(Vector((i * 0.7, j * 0.7, 0))) * 0.06))
    return idx[(i, j)]
for i in range(-N, N):
    for j in range(-N, N):
        if any(pt[(i + a, j + b)][2] > 0 for a in (-1, 0, 1, 2) for b in (-1, 0, 1, 2) if (i + a, j + b) in pt):
            fs.append((fv(i, j), fv(i + 1, j), fv(i + 1, j + 1), fv(i, j + 1)))
emit(vs, fs, FLOOR, orient=False)

# ---- 안쪽 꾸밈 -----------------------------------------------------------------
free = lambda x, y: all(math.hypot(x - gx, y - gy) > 6.5 for gx, gy in GOLD) and all(math.hypot(x - hx, y - hy) > hr for hx, hy, hr in HOLES)
def spot(lo, hi):  # 천장 높이가 lo~hi 인 자리 (낮은 곳 = 벽 가까이)
    for _ in range(200):
        x, y = R.uniform(-88, 88), R.uniform(-88, 88)
        c = ceil_z(x, y)
        if c is not None and lo <= c <= hi and free(x, y) and not removed(x, y): return x, y, c
    return None

for i in range(220):  # 바닥에 박힌 넓적한 돌 (포장된 바닥처럼)
    s = spot(4, 99)
    if s: cyl(s[0], s[1], 0.0, R.uniform(1.2, 3.4), R.uniform(1.0, 2.8), R.uniform(0.2, 0.5), R.randint(5, 7), jit(FLOOR, 0.1))
for i in range(140):  # 벽 밑에 쌓인 바위
    s = spot(0.8, 6)
    if s: rock(s[0], s[1], R.uniform(-0.3, 0.8), R.uniform(1.6, 4.6), jit(ROCKC, 0.12), flat=R.uniform(0.6, 1.0))
for i in range(20):  # 벽에 붙은 계단식 바위 단
    s = spot(3.0, 8)
    if not s: continue
    for k in range(3):
        cyl(s[0] + R.uniform(-0.9, 0.9) * k, s[1] + R.uniform(-0.9, 0.9) * k, -0.2 + k * 1.2, 6.6 - k * 1.6, 6.0 - k * 1.6, 1.45, 7, jit(ROCKC, 0.1))
for i in range(90):  # 종유석
    s = spot(9, 99)
    if s: seg((s[0], s[1], s[2] + 1.6), (s[0] + R.uniform(-0.3, 0.3), s[1] + R.uniform(-0.3, 0.3), s[2] - R.uniform(1.6, 6.0)), R.uniform(0.5, 1.3), 0.06, 6, jit(ROCKC, 0.1))
for i in range(34):  # 석순
    s = spot(8, 99)
    if s: seg((s[0], s[1], -0.3), (s[0] + R.uniform(-0.3, 0.3), s[1] + R.uniform(-0.3, 0.3), R.uniform(1.5, 4.5)), R.uniform(0.6, 1.4), 0.07, 6, jit(ROCKC, 0.1))
for px, py, pr in PILLARS:  # 기둥: 몸통과 밑동을 감싼 바위
    c = jit(ROCKC, 0.08)
    cyl(px, py, -0.3, pr * 1.45, pr * 0.95, 9.0, 7, c, cap=False)
    cyl(px, py, 8.6, pr * 0.95, pr * 1.15, 24.0, 7, jit(c, 0.05), cap=False)
    for k in range(5):
        a = k / 5 * math.tau + R.uniform(0, 1)
        rock(px + math.cos(a) * pr * 1.5, py + math.sin(a) * pr * 1.5, 0.0, R.uniform(1.2, 2.4), jit(ROCKC, 0.12))

# 빛: 보물의 금빛과 천장 구멍 아래의 푸른 빛
for x, y in GOLD: LIGHTS.append(((x, y, 1.2), (1.0, 0.62, 0.16), 17.0))
for x, y, r in HOLES: LIGHTS.append(((x, y, 0.5), (0.10, 0.32, 0.58), r + 22))

finish("cave", {"holes": [[round(x, 1), round(y, 1), r, round(field(x, y, 0, 0), 1)] for x, y, r in HOLES], "doubleSided": True, "gate": round(TOP0 + SHAFT * 0.5, 1)},  # gate: 이 높이까지 굴을 오르면 난파선 지대로 넘어간다
       sun=False, moss=0.6, ao_dist=80.0, amin=0.22, shade=(0.16, 0.26, 0.38), cam=((-4, -22, 5), (8, 36, 9)))
