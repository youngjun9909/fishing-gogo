# 수중 맵 "거북이 모래 만" 구역 모델: 환하고 넓은 모래밭에 바위 아치 하나, 무너진 옛 기둥과 작은 신전, 돌계단, 낮은 바위와 짧은 해초.
# 산호 숲과 달리 비어 보일 만큼 탁 트인 곳이라 가운데는 넓게 비운다.
# 사용: blender -b -P turtle.py [-- 미리보기.png]
# 출력: client/public/models/underwater/turtle.glb, turtle.json (discs: 딛고 설 수 있는 윗면 [x, y, 반지름, 높이])
# 좌표: z=0 이 모래 바닥. 들어오면 가운데에서 +y 를 본다
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from mapkit import *

RUIN = (0.62, 0.72, 0.74)
WAYS = ((-205, 115), (-30, 210))  # 다른 구역으로 가는 길의 방향 (게임 underwater.ts 의 PATHS 와 맞춘다): 산호 숲, 난파선


def column(x, y, h, r=0.75, broken=False):  # 옛 기둥: 받침, 몸통(북 모양 토막), 머리
    c = jit(RUIN, 0.06)
    box(x, y, -0.4, r * 3, r * 3, 0.8, c)
    n = max(1, int(h / 1.5))
    for k in range(n):
        cyl(x + R.uniform(-0.04, 0.04), y + R.uniform(-0.04, 0.04), 0.4 + k * h / n, r * (1 - 0.12 * k / n), r * (1 - 0.12 * (k + 1) / n), h / n - 0.06, 10, jit(c, 0.05))
    if not broken: box(x, y, 0.4 + h, r * 2.6, r * 2.6, 0.5, c)
    return 0.9 + h


def temple(x, y, rot):  # 기둥 셋과 그 위에 걸친 들보, 낮은 단
    with at(x, y, 0, rot):
        mbox(0, 0, -0.4, 13, 6, 1.0, jit(RUIN, 0.05))
        mbox(0, 0, 0.6, 11, 4.4, 0.5, jit(RUIN, 0.05))
        for cx in (-3.6, 0, 3.6): top = column(cx, 0, 5.0)
        with at(0, 0, 0.7): pass
        box(-1.8, 0, 6.6, 6.2, 2.0, 0.9, jit(RUIN, 0.05))
        box(2.6, 0.1, 6.6, 4.0, 2.0, 0.9, jit(RUIN, 0.05), rot=0.04)
    DISCS.append([x, y, 3.0, 1.1])


def steps(x, y, rot, w=14, n=4):  # 넓은 돌계단 단
    with at(x, y, 0, rot):
        for k in range(n):
            mbox(0, k * 1.6, -0.4, w - k * 0.6, 9 - k * 1.6 * 1.0, 0.4 + (k + 1) * 0.7, jit(RUIN, 0.05))
    DISCS.append([x - math.sin(rot) * 3, y + math.cos(rot) * 3, 3.5, n * 0.7])


def wall(x, y, rot, w, h):  # 무너진 벽: 높이가 들쭉날쭉한 돌덩이 줄
    with at(x, y, 0, rot):
        for k in range(int(w / 1.6)):
            mbox(-w / 2 + k * 1.6 + 0.8, R.uniform(-0.1, 0.1), -0.4, 1.56, 1.3, 0.4 + h * R.uniform(0.35, 1.0), jit(RUIN, 0.07))


# ---- 배치 -------------------------------------------------------------------
arch(-30, 30, 0.5, 11, 7.5)  # 왼쪽의 큰 바위 아치
stack(-44, 24, 7, 8.5); stack(-40, 38, 5, 4)
column(-13, 40, 6.5)  # 홀로 선 기둥
temple(5, 50, -0.08)
wall(30, 46, 0.2, 9, 4.5); column(38, 42, 3.0, broken=True)
steps(36, 6, -1.35)
# 여기저기 흩어진 옛 기둥과 쓰러진 토막
for i in range(14):
    a, d = R.uniform(0, math.tau), R.uniform(26, 60)
    x, y = math.cos(a) * d, math.sin(a) * d
    if top_at(x, y) > 0 or math.hypot(x - 36, y - 6) < 12 or math.hypot(x - 5, y - 50) < 10: continue
    if i % 3 == 0:
        p = Vector((x, y, 0.5))
        dv = Vector((math.cos(a * 3), math.sin(a * 3), 0))
        seg(p, p + dv * R.uniform(2.5, 4.5), 0.7, 0.64, 10, jit(RUIN, 0.06))  # 쓰러진 기둥
    else: column(x, y, R.uniform(1.5, 5.5), broken=i % 3 == 1)

# 낮고 넓적한 바위와 그 곁의 해초·해면
rocks = []
for i in range(300):
    if len(rocks) >= 46: break
    a, d = R.uniform(0, math.tau), 64 * R.random() ** 0.5
    x, y, r = math.cos(a) * d, math.sin(a) * d, R.uniform(1.2, 4.5)
    if d < 12 or (d > 30 and near_way(x, y, WAYS, r + 6)) or top_at(x, y) > 0 or any(math.hypot(x - rx, y - ry) < r + rr + 2 for rx, ry, rr in rocks): continue
    if math.hypot(x - 36, y - 6) < 12 or math.hypot(x - 5, y - 50) < 10 or math.hypot(x + 30, y - 30) < 9: continue
    rocks.append((x, y, r))
    stack(x, y, r, R.uniform(0.5, 2.2) if r > 2.2 else R.uniform(0.3, 0.8))
    for k in range(int(2 + r)):
        b, e = R.uniform(0, math.tau), r * R.uniform(1.15, 1.6)
        px, py = x + math.cos(b) * e, y + math.sin(b) * e
        if R.random() < 0.3: tube_sponge(px, py, top_at(px, py), R.uniform(0.9, 1.5), jit(CORALS[R.choice((3, 4, 6, 0))], 0.08))
        elif R.random() < 0.25: branch_coral(px, py, top_at(px, py), R.uniform(0.7, 1.1))
        else: seagrass(px, py, top_at(px, py), R.uniform(0.8, 1.4))
    if r > 2.5 and R.random() < 0.5: tube_sponge(x, y, top_at(x, y), 1.1)
# 멀리 둘러선 바위 (안개 속 윤곽). 산호 숲보다 낮다
for i in range(14):
    a = i / 14 * math.tau + R.uniform(-0.15, 0.15)
    d = R.uniform(72, 84)
    if near_way(math.cos(a) * d, math.sin(a) * d, WAYS, 24): continue  # 다른 구역으로 가는 길은 열어 둔다
    stack(math.cos(a) * d, math.sin(a) * d, R.uniform(8, 13), R.uniform(4, 10), disc=False, z0=-4)

# 모래밭: 짧은 해초 무더기가 군데군데, 불가사리, 조약돌
for i in range(70):  # 해초 밭 (한 곳에 여러 포기)
    a, d = R.uniform(0, math.tau), 66 * R.random() ** 0.5
    x, y = math.cos(a) * d, math.sin(a) * d
    for k in range(R.randint(3, 7)):
        px, py = x + R.uniform(-2.5, 2.5), y + R.uniform(-2.5, 2.5)
        if top_at(px, py) == 0 and math.hypot(px - 36, py - 6) > 9 and math.hypot(px - 5, py - 50) > 7.5: seagrass(px, py, 0, R.uniform(0.5, 1.0))
for i in range(60):
    a, d = R.uniform(0, math.tau), 62 * R.random() ** 0.5
    x, y = math.cos(a) * d, math.sin(a) * d
    if top_at(x, y) > 0: continue
    if i % 3 == 0: starfish(x, y, 0.12, R.uniform(0.5, 0.9), jit(CORALS[R.choice((0, 1, 2))], 0.1))
    else: slab(x, y, R.uniform(0.25, 0.9), R.uniform(0.2, 0.7), -0.3, R.uniform(0.08, 0.3), jit(GREY, 0.12), n=6)

finish("turtle", {"discs": DISCS}, sun=True, moss=0.4, amin=0.42, shade=(0.44, 0.52, 0.66), cam=((0, -14, 4), (0, 30, 3)))
