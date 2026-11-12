# 수중 맵 "심해 협곡" 구역 모델: 가운데 깊은 골을 사이에 두고 양옆으로 계단처럼 솟는 절벽, 바위 봉우리, 멀리 보이는 아치, 스스로 빛나는 수정.
# 햇빛이 닿지 않는 곳이라 그림자는 없고, 수정이 주변 바위에 비추는 푸른 빛을 꼭짓점 색에 구워 넣는다.
# 사용: blender -b -P deep.py [-- 미리보기.png]
# 출력: client/public/models/underwater/deep.glb, deep.json (discs: 딛고 설 수 있는 절벽 윗면 [x, y, 반지름, 높이])
# 좌표: z=0 이 구역 기준 깊이. 골 바닥은 게임 지형(heightAt)과 같은 식: -9*exp(-(x²+y²)/1100)
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from mapkit import *

ROCK, ROCK2 = (0.20, 0.25, 0.38), (0.15, 0.19, 0.31)
CRYS = ((0.35, 0.62, 1.0), (0.45, 0.80, 1.0), (0.50, 0.52, 1.0))
DISCS = []
floorz = lambda x, y: -9 * math.exp(-(x * x + y * y) / 1100)


def slab(cx, cy, r, z0, z1, n=9):  # 윗면이 평평한 울퉁불퉁한 바위 판
    a0 = R.uniform(0, math.tau)
    rr = [r * R.uniform(0.78, 1.12) for _ in range(n)]
    ring = lambda z, k: [(cx + math.cos(a0 + i / n * math.tau) * rr[i] * k, cy + math.sin(a0 + i / n * math.tau) * rr[i] * k, z) for i in range(n)]
    vs = ring(z0, 1.1) + ring(z1, 1.0) + [(cx, cy, z1)]
    emit(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)] + [(n + i, n + (i + 1) % n, 2 * n) for i in range(n)], jit(ROCK, 0.12))


def ledge(cx, cy, r, top):  # 판을 2~3겹 쌓은 절벽 단. 위로 갈수록 조금씩 들어가 계단처럼 보인다
    layers = 3 if top > 8 else 2
    z = -12.0
    for k in range(layers):
        z1 = top if k == layers - 1 else -12 + (top + 12) * (k + 1) / layers + R.uniform(-0.8, 0.8)
        slab(cx + R.uniform(-1, 1), cy + R.uniform(-1, 1), r * (1.12 - 0.06 * k), z, z1)
        z = z1 - 0.3
    DISCS.append([round(cx, 1), round(cy, 1), round(r * 0.8, 1), round(top, 1)])


def spire(x, y, z, h, r):  # 뾰족한 바위 봉우리
    c = jit(ROCK2, 0.12)
    ox = oy = 0.0
    for k in range(3):
        r0, r1 = r * (1 - 0.3 * k), r * (0.72 - 0.3 * k) if k < 2 else 0.12 * r
        cyl(x + ox, y + oy, z + h * k / 3 - 0.3, r0, r1, h / 3 + 0.3, 6, jit(c, 0.06))
        ox += R.uniform(-0.25, 0.25) * r; oy += R.uniform(-0.25, 0.25) * r


def crystals(x, y, z, s=1.0):  # 빛나는 수정 무리
    col = CRYS[R.randrange(3)]
    GLOW[0] = True
    for i in range(R.randint(3, 5)):
        a, tilt, h, r = R.uniform(0, math.tau), R.uniform(0, 0.45) * (i > 0), R.uniform(0.9, 2.2) * s * (1.4 if i == 0 else 1), R.uniform(0.16, 0.3) * s
        d = Vector((math.cos(a) * math.sin(tilt), math.sin(a) * math.sin(tilt), math.cos(tilt)))
        p0 = Vector((x, y, z - 0.2)) + Vector((math.cos(a), math.sin(a), 0)) * 0.3 * s * (i > 0)
        seg(p0, p0 + d * h * 0.75, r, r * 0.85, 6, col)
        seg(p0 + d * h * 0.75, p0 + d * h, r * 0.85, 0.02, 6, tuple(min(1, c + 0.25) for c in col))
    GLOW[0] = False
    LIGHTS.append(((x, y, z + 1.0 * s), tuple(c ** 2.2 * 0.55 for c in col), 8.0 * s))


# ---- 배치 -------------------------------------------------------------------
# 양옆 절벽: 골에서 멀어질수록 높아지는 4단
for side in (-1, 1):
    for t, (xin, top) in enumerate(((15, 3.5), (27, 9), (41, 16), (56, 25))):
        y = -84 + R.uniform(0, 6)
        while y < 86:
            r = R.uniform(10, 15)
            ledge(side * (xin + r * 0.8 + R.uniform(-2, 2.5)), y, r, top + R.uniform(-1.0, 1.4))
            y += r * R.uniform(1.0, 1.35)

def top_at(x, y):  # 그 자리에서 가장 높은 윗면 (없으면 골 바닥)
    return max([h for cx, cy, r, h in DISCS if (x - cx) ** 2 + (y - cy) ** 2 < r * r], default=floorz(x, y))

# 멀리 골을 가로지르는 바위 아치와 그 뒤를 막는 절벽
for sx in (-10.5, 10.5):
    for k in range(4): rock(sx + R.uniform(-0.6, 0.6), 52 + R.uniform(-0.6, 0.6), floorz(sx, 52) + 1.5 + k * 3.6, 3.6 - k * 0.2, jit(ROCK2, 0.1), flat=0.85)
for i in range(11):
    a = math.pi * i / 10
    rock(math.cos(a) * 10.5, 52 + R.uniform(-0.5, 0.5), 12.5 + math.sin(a) * 6.5, 3.0, jit(ROCK2, 0.1), flat=0.8)
for i in range(7): ledge(-30 + i * 10 + R.uniform(-2, 2), 88 + R.uniform(-2, 2), R.uniform(11, 15), R.uniform(14, 30))

# 바위 봉우리: 절벽 위와 골 바닥
for i in range(34):
    x, y = R.uniform(-70, 70), R.uniform(-80, 84)
    if abs(x) < 7 and abs(y - 10) < 30: continue  # 골 한가운데는 헤엄칠 길로 비운다
    spire(x, y, top_at(x, y), R.uniform(7, 20) * (0.6 if abs(x) < 15 else 1), R.uniform(1.4, 3.0))

# 골 바닥과 절벽 위의 바위
for i in range(70):
    x, y = R.uniform(-66, 66), R.uniform(-82, 84)
    rock(x, y, top_at(x, y) - 0.2, R.uniform(0.6, 2.6), jit(ROCK2, 0.12))

# 빛나는 수정: 절벽 단 가장자리(골 쪽)와 골 바닥
for i in range(95):
    if i < 30:
        x, y = R.uniform(-13, 13), R.uniform(-78, 80)
    else:
        cx, cy, r, h = DISCS[R.randrange(len(DISCS))]
        a = R.uniform(0, math.tau)
        x, y = cx + math.cos(a) * r * 0.8, cy + math.sin(a) * r * 0.8
    crystals(x, y, top_at(x, y), R.uniform(0.7, 1.5) * (1.6 if i % 11 == 0 else 1))

finish("deep", {"discs": DISCS}, sun=False, moss=0.25, cam=((0, -74, 16), (0, 20, 6)))
