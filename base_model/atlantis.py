# 수중 맵 "아틀란티스 유적" 구역 모델을 코드로 짓는다. 음영(틈새 그늘)과 이끼 색을 꼭짓점 색에 구워 넣어 게임에서는 계산이 필요 없다.
# 사용: blender -b -P atlantis.py [-- 미리보기.png]
# 출력: client/public/models/underwater/atlantis.glb (칸별로 나눈 메시), atlantis.json (바닥 높이: 헤엄칠 때 바닥 판정)
# 좌표: x 오른쪽, y 뒤쪽(대신전 방향), z 위. 광장 바닥이 z=0.
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from mapkit import *

# 층: [x0, y0, x1, y1, 높이]. 앞에 있는 것이 우선
T3 = (-26, 40, 26, 62, 8.4)
T2 = (-40, 26, 40, 60, 5.2)
T0 = (-28, -30, 28, 18, 0.0)
T1 = (-52, -48, 52, 60, 2.4)
LEVELS = [T3, T2, T0, T1]


def level(x, y):
    for x0, y0, x1, y1, h in LEVELS:
        if x0 <= x <= x1 and y0 <= y <= y1:
            return h
    return -0.3

def column(x, y, z0, h, r=0.5, broken=False):
    c = jit(STONE)
    box(x, y, z0, r * 3, r * 3, r * 0.5, c)
    cyl(x, y, z0 + r * 0.5, r * 1.3, r * 1.15, r * 0.4, 8, c, cap=False)
    z, hh = z0 + r * 0.9, h - r * 2.0
    if broken: hh *= R.uniform(0.2, 0.75)
    nd = max(1, round(hh / 2.2))
    for i in range(nd):
        cyl(x, y, z, r * (1 - 0.12 * i / nd), r * (1 - 0.12 * (i + 1) / nd) * 0.97, hh / nd, 8, jit(c, 0.04), cap=broken and i == nd - 1)
        z += hh / nd
    if not broken:
        cyl(x, y, z, r * 0.88, r * 1.35, r * 0.5, 8, c, cap=False)
        box(x, y, z + r * 0.5, r * 3, r * 3, r * 0.6, c)


def wall(x0, y0, x1, y1, zb, zt, th=0.8, course=0.8):  # 돌 블록을 줄줄이 쌓은 옹벽
    L = math.hypot(x1 - x0, y1 - y0)
    dx, dy = (x1 - x0) / L, (y1 - y0) / L
    rot = math.atan2(dy, dx)
    nc = max(1, round((zt - zb) / course))
    ch = (zt - zb) / nc
    for k in range(nc):
        s = 0.0
        first = True
        while s < L - 0.01:
            ln = min(L - s, R.uniform(1.6, 2.6) * (0.5 if first and k % 2 else 1))
            first = False
            m = s + ln / 2
            box(x0 + dx * m, y0 + dy * m, zb + k * ch, ln - 0.04, th + R.uniform(0, 0.14), ch - 0.03, jit(STONE, 0.09), rot)
            s += ln
    s = 0.0
    while s < L - 0.01:  # 맨 위 덮개돌
        ln = min(L - s, 6.0)
        box(x0 + dx * (s + ln / 2), y0 + dy * (s + ln / 2), zt, ln - 0.05, th + 0.35, 0.25, jit(PALE, 0.04), rot)
        s += ln


def slabs(x0, y0, x1, y1, z, size=2.2):  # 바닥 포석
    emit([(x0, y0, z - 0.05), (x1, y0, z - 0.05), (x1, y1, z - 0.05), (x0, y1, z - 0.05)], [(0, 1, 2, 3)], tuple(c * 0.8 for c in PALE), orient=False)
    nx, ny = max(1, round((x1 - x0) / size)), max(1, round((y1 - y0) / size))
    wx, wy = (x1 - x0) / nx, (y1 - y0) / ny
    for i in range(nx):
        for j in range(ny):
            a, b, zz = x0 + i * wx + 0.03, y0 + j * wy + 0.03, z + R.uniform(0, 0.06)
            k = min(1.0, max(0.0, noise.noise(Vector((a * 0.07, b * 0.07, z))) * 2.2 + 0.25))  # 모래가 덮인 얼룩
            c = jit(tuple(PALE[q] + (SAND[q] - PALE[q]) * k for q in range(3)), 0.07)
            emit([(a, b, zz), (a + wx - 0.06, b, zz), (a + wx - 0.06, b + wy - 0.06, zz), (a, b + wy - 0.06, zz)], [(0, 1, 2, 3)], c, orient=False)


def stairs(cx, cy, z0, z1, width, dx, dy, run=0.42):  # (cx,cy)가 위쪽 끝, (dx,dy) 방향으로 내려간다
    n = max(2, round((z1 - z0) / 0.3) - 1)
    rise = (z1 - z0) / (n + 1)
    rot = math.atan2(dy, dx)
    c = jit(PALE, 0.03)
    for i in range(n):
        m = (i + 0.5) * run
        box(cx + dx * m, cy + dy * m, z0 - 0.3, run, width, z1 - (i + 1) * rise - z0 + 0.3, jit(c, 0.03), rot)
    L = n * run
    for sgn in (-1, 1):  # 양옆 난간벽과 끝 받침돌
        ox, oy = -dy * sgn * (width / 2 + 0.6), dx * sgn * (width / 2 + 0.6)
        box(cx + dx * L * 0.25 + ox, cy + dy * L * 0.25 + oy, z0 - 0.3, L * 0.5, 1.2, z1 - z0 + 0.8, jit(STONE), rot)
        box(cx + dx * L * 0.75 + ox, cy + dy * L * 0.75 + oy, z0 - 0.3, L * 0.5, 1.2, (z1 - z0) * 0.5 + 0.8, jit(STONE), rot)
        box(cx + dx * (L + 0.7) + ox, cy + dy * (L + 0.7) + oy, z0 - 0.3, 1.5, 1.5, 1.7, jit(STONE), rot)
        box(cx + dx * (L + 0.7) + ox, cy + dy * (L + 0.7) + oy, z0 + 1.4, 1.0, 1.0, 1.3, jit(PALE), rot, top=0.3)


def balustrade(x0, y0, x1, y1, z):
    L = math.hypot(x1 - x0, y1 - y0)
    dx, dy = (x1 - x0) / L, (y1 - y0) / L
    rot = math.atan2(dy, dx)
    c = jit(PALE, 0.03)
    mx, my = (x0 + x1) / 2, (y0 + y1) / 2
    box(mx, my, z, L, 0.34, 0.14, c, rot)
    box(mx, my, z + 0.92, L, 0.36, 0.16, c, rot)
    for i in range(int(L / 4) + 2):
        s = min(L, i * 4.0)
        box(x0 + dx * s, y0 + dy * s, z, 0.5, 0.5, 1.25, c, rot)
    for i in range(int(L / 0.75)):
        s = (i + 0.5) * 0.75
        cyl(x0 + dx * s, y0 + dy * s, z + 0.14, 0.11, 0.07, 0.78, 5, c, cap=False)


def temple(x, y, z, w, d, h, ncol, r, rot=0.0, steps=3):  # 정면이 -y
    with at(x, y, z, rot):
        for k in range(steps):
            box(0, 0, k * 0.4, w + 3 - k * 0.9, d + 3 - k * 0.9, 0.4, jit(PALE, 0.04))
        z1 = steps * 0.4
        mbox(0, d * 0.12, z1, w * 0.62, d * 0.62, h, jit(STONE, 0.03))
        box(0, d * 0.12 - d * 0.31 - 0.1, z1, w * 0.16, 0.3, h * 0.62, DOOR)
        ex, ey = w / 2 - r * 1.6, d / 2 - r * 1.6
        for i in range(ncol):
            column(-ex + 2 * ex * i / (ncol - 1), -ey, z1, h, r)
        ns = max(2, round(2 * ey / (2 * ex / (ncol - 1))))
        for j in range(1, ns + 1):
            for sx in (-ex, ex):
                column(sx, -ey + 2 * ey * j / ns, z1, h, r)
        box(0, 0, z1 + h, w + 0.3, d + 0.3, h * 0.13, jit(STONE, 0.03))
        box(0, 0, z1 + h * 1.13, w + 1.1, d + 1.1, 0.28, jit(PALE, 0.03))
        gable(0, 0, z1 + h * 1.13 + 0.28, w + 1.1, d + 1.1, w * 0.2, jit(STONE, 0.03))
        box(0, -d / 2 - 0.5, z1 + h * 1.13 + 0.28 + w * 0.2 - 0.3, 0.7, 0.7, 1.3, jit(PALE), top=0.2)


def tholos(x, y, z, s=1.0, ruined=False):
    with at(x, y, z, 0, s):
        for k in range(3):
            cyl(0, 0, k * 0.4, 10 - k * 0.7, 10 - k * 0.7, 0.4, 20, jit(PALE, 0.04))
        z1 = 1.2
        for i in range(12):
            a = i / 12 * math.tau + 0.13
            gone = ruined and i % 5 in (1, 2)
            if gone and i % 5 == 2: continue
            column(math.cos(a) * 7.5, math.sin(a) * 7.5, z1, 7, 0.5, broken=ruined and (gone or i % 3 == 0))
        if ruined:
            cyl(0, 0, z1, 4.6, 4.4, 2.6, 14, jit(STONE))
            return
        cyl(0, 0, z1, 4.8, 4.8, 7, 16, jit(STONE, 0.03), cap=False)
        cyl(0, 0, z1 + 7, 8.3, 8.3, 0.9, 20, jit(STONE, 0.03))
        cyl(0, 0, z1 + 7.9, 8.7, 8.7, 0.25, 20, jit(PALE, 0.03))
        cyl(0, 0, z1 + 8.15, 7.2, 7.2, 0.9, 20, jit(STONE, 0.03))
        dome(0, 0, z1 + 9.05, 7.0, 16, 5, jit(PALE, 0.02), squash=0.82)
        for i in range(16):  # 돔의 갈빗대
            a = i / 16 * math.tau
            prev = None
            for k in range(6):
                b = k / 5 * math.pi / 2 * 0.92
                p = (math.cos(a) * 7.2 * math.cos(b), math.sin(a) * 7.2 * math.cos(b), z1 + 9.05 + 7.2 * math.sin(b) * 0.82)
                if prev: seg(prev, p, 0.11, 0.11, 4, STONE)
                prev = p
        zt = z1 + 9.05 + 7.0 * 0.82 - 0.25
        cyl(0, 0, zt, 1.5, 1.5, 0.3, 10, jit(STONE))
        for i in range(6):
            a = i / 6 * math.tau
            cyl(math.cos(a) * 1.1, math.sin(a) * 1.1, zt + 0.3, 0.16, 0.14, 1.5, 6, STONE, cap=False)
        cyl(0, 0, zt + 1.8, 1.6, 1.6, 0.25, 10, jit(STONE))
        dome(0, 0, zt + 2.05, 1.35, 10, 3, jit(PALE))
        seg((0, 0, zt + 3.2), (0, 0, zt + 4.6), 0.14, 0.03, 5, PALE)


def shrine(x, y, z, s=3.0, h=4.0, ruined=False):
    box(x, y, z, s + 2, s + 2, 0.4, jit(PALE, 0.04))
    for i, (dx, dy) in enumerate(((-1, -1), (1, -1), (1, 1), (-1, 1))):
        column(x + dx * s / 2, y + dy * s / 2, z + 0.4, h, 0.32, broken=ruined and i != 0)
    if ruined: return
    box(x, y, z + 0.4 + h, s + 1.4, s + 1.4, 0.5, jit(STONE))
    box(x, y, z + 0.9 + h, s + 1.0, s + 1.0, 1.5, jit(PALE, 0.04), top=0.1)


def statue(x, y, z, rot, s):  # 삼지창을 든 바다의 신 (정면이 -y)
    with at(x, y, z, rot, s):
        box(0, 0, 0, 3.6, 3.6, 0.6, jit(PALE)); mbox(0, 0, 0.6, 2.9, 2.9, 3.2, jit(STONE)); box(0, 0, 3.8, 3.4, 3.4, 0.5, jit(PALE))
    with at(x, y, z + 4.3 * s, rot, s):
        c = BRONZE
        cyl(0, 0, 0, 1.2, 0.85, 3.6, 8, c, cap=False)
        seg((0, 0, 3.5), (0, 0.05, 5.6), 0.82, 1.22, 8, c)
        box(0, 0, 5.5, 3.1, 1.0, 0.7, c, top=0.85)
        cyl(0, 0, 6.1, 0.36, 0.33, 0.5, 6, c, cap=False)
        rock(0, 0, 7.05, 0.62, c, flat=1.1)
        seg((0, -0.5, 6.85), (0, -0.62, 6.0), 0.5, 0.12, 6, c)  # 수염
        cyl(0, 0, 7.5, 0.6, 0.66, 0.22, 8, c)
        for i in range(5):
            a = i / 5 * math.tau
            seg((math.cos(a) * 0.5, math.sin(a) * 0.5, 7.7), (math.cos(a) * 0.62, math.sin(a) * 0.62, 8.15), 0.1, 0.02, 4, c)
        seg((-1.5, 0, 6.0), (-2.3, -0.3, 5.2), 0.33, 0.28, 6, c); seg((-2.3, -0.3, 5.2), (-2.4, -0.9, 5.95), 0.27, 0.22, 6, c)
        seg((1.5, 0, 6.0), (1.95, -0.2, 4.9), 0.33, 0.28, 6, c); seg((1.95, -0.2, 4.9), (1.5, -0.8, 4.3), 0.27, 0.22, 6, c)
        tx, ty = -2.4, -0.95  # 삼지창
        seg((tx, ty, 0.1), (tx, ty, 9.5), 0.11, 0.11, 6, c)
        seg((tx - 0.75, ty, 9.5), (tx + 0.75, ty, 9.5), 0.12, 0.12, 5, c)
        for o in (-0.75, 0, 0.75):
            seg((tx + o, ty, 9.5), (tx + o, ty, 10.9 + (0.3 if o == 0 else 0)), 0.13, 0.02, 5, c)


# ---- 배치 -------------------------------------------------------------------
Z0, Z1, Z2, Z3 = 0.0, 2.4, 5.2, 8.4
slabs(-28, -30, 28, 18, Z0)
for r in ((-52, -48, 52, -30), (-52, -30, -28, 26), (28, -30, 52, 26), (-52, 26, -40, 60), (40, 26, 52, 60), (-28, 18, 28, 26)): slabs(*r, Z1)
for r in ((-40, 26, 40, 40), (-40, 40, -26, 60), (26, 40, 40, 60)): slabs(*r, Z2)
slabs(-26, 40, 26, 62, Z3)

# 옹벽
for a in ((-28, -30, 28, -30), (28, -30, 28, 18), (28, 18, -28, 18), (-28, 18, -28, -30)): wall(*a, -0.4, Z1)
for a in ((-52, -48, 52, -48), (52, -48, 52, 60), (52, 60, -52, 60), (-52, 60, -52, -48)): wall(*a, -1.6, Z1, th=1.1, course=1.3)
for a in ((-40, 26, 40, 26), (-40, 26, -40, 60), (40, 26, 40, 60)): wall(*a, Z1, Z2)
for a in ((-26, 40, 26, 40), (-26, 40, -26, 62), (26, 40, 26, 62)): wall(*a, Z2, Z3)
wall(-40, 60.4, 40, 60.4, Z1, Z2, th=1.0, course=1.4)
wall(-26, 62.3, 26, 62.3, Z1, Z3, th=1.0, course=1.5)

# 계단
stairs(0, 18, Z0, Z1, 14, 0, -1)
stairs(0, -30, Z0, Z1, 9, 0, 1)
stairs(-28, -8, Z0, Z1, 7, 1, 0)
stairs(28, -8, Z0, Z1, 7, -1, 0)
stairs(0, 26, Z1, Z2, 18, 0, -1)
stairs(0, 40, Z2, Z3, 16, 0, -1)
stairs(0, -48, -0.3, Z1, 10, 0, -1)
stairs(-52, 8, -0.3, Z1, 8, -1, 0)
stairs(52, 8, -0.3, Z1, 8, 1, 0)

# 대신전: 가운데 큰 신전, 그 뒤 높은 단 위의 윗신전, 양옆 작은 신전
temple(0, 50, Z3, 22, 13, 8.5, 8, 0.62)
mbox(0, 57.6, Z3, 15, 8, 14, jit(STONE, 0.03)); box(0, 57.6, Z3 + 14, 16, 9, 0.5, jit(PALE))
for k in range(4): box(0, 57.6, Z3 + 3 + k * 3, 15.3, 8.3, 0.3, jit(PALE, 0.03))
temple(0, 57.6, Z3 + 14.5, 13, 7, 5, 6, 0.42, steps=1)
temple(-19, 52, Z3, 9, 10, 6, 4, 0.45)
temple(19, 52, Z3, 9, 10, 6, 4, 0.45)
for sx in (-11, 11):  # 대계단 앞 오벨리스크
    box(sx, 34, Z2, 2.2, 2.2, 1.2, jit(STONE)); box(sx, 34, Z2 + 1.2, 1.4, 1.4, 7, jit(PALE), top=0.6); box(sx, 34, Z2 + 8.2, 0.84, 0.84, 1.1, jit(PALE), top=0.05)

# 돔 신전(왼쪽), 무너진 원형 신전과 작은 돔 정자(오른쪽), 2층 좌우의 신전
tholos(-41, 0, Z1)
tholos(41, -8, Z1, 0.72, ruined=True)
tholos(41, 14, Z1, 0.5)
temple(-33, 44, Z2, 8, 9, 5, 4, 0.4, rot=-0.5)
temple(33, 46, Z2, 8, 9, 5, 4, 0.4, rot=0.5)

# 광장: 석상, 가운데 단과 오벨리스크, 받침 위 기둥
statue(-19, -3, Z0, 0.5, 1.25)
cyl(0, -5, Z0, 6, 6, 0.4, 8, jit(PALE)); cyl(0, -5, Z0 + 0.4, 4.4, 4.4, 0.4, 8, jit(STONE))
box(0, -5, Z0 + 0.8, 1.7, 1.7, 7.5, jit(PALE), top=0.55); box(0, -5, Z0 + 8.3, 0.93, 0.93, 1.2, jit(PALE), top=0.05)
for i, (px, py) in enumerate(((-14, -20), (14, -20), (14, 9), (-10, 11), (20, -4))):
    box(px, py, Z0, 2.4, 2.4, 1.0, jit(STONE)); column(px, py, Z0 + 1.0, 6.5, 0.5, broken=i % 2 == 1)

# 열주: 광장 둘레와 2층 앞
def colonnade(pts, z, h=6.0, r=0.48):
    prev = None
    for (x, y) in pts:
        br = R.random() < 0.3
        column(x, y, z, h, r, broken=br)
        if prev and not br and not prev[2] and R.random() < 0.75:  # 온전한 기둥 둘은 들보로 잇는다
            mx, my = (x + prev[0]) / 2, (y + prev[1]) / 2
            box(mx, my, z + h, math.hypot(x - prev[0], y - prev[1]) + 1.2, 1.2, 0.8, jit(STONE), math.atan2(y - prev[1], x - prev[0]))
        prev = (x, y, br)
colonnade([(31, y) for y in range(-27, -11, 5)], Z1); colonnade([(31, y) for y in range(-2, 18, 5)], Z1)
colonnade([(-31, y) for y in range(-27, -13, 5)], Z1)
colonnade([(x, -33) for x in range(-25, -6, 6)], Z1); colonnade([(x, -33) for x in range(7, 26, 6)], Z1)
colonnade([(x, 28.5) for x in range(-38, -11, 6)], Z2, 5); colonnade([(x, 28.5) for x in range(14, 39, 6)], Z2, 5)
colonnade([(x, 21.5) for x in range(-26, -9, 5)], Z1, 5); colonnade([(x, 21.5) for x in range(11, 27, 5)], Z1, 5)

# 난간
for a in ((-28, -29.2, -6, -29.2), (6, -29.2, 28, -29.2), (27.2, -30, 27.2, -13), (27.2, -3, 27.2, 18), (-27.2, -30, -27.2, -13), (-27.2, -3, -27.2, 18), (-28, 17.2, -9, 17.2), (9, 17.2, 28, 17.2)): balustrade(*a, Z1)
for a in ((-40, 26.8, -11, 26.8), (11, 26.8, 40, 26.8)): balustrade(*a, Z2)
for a in ((-26, 40.8, -10, 40.8), (10, 40.8, 26, 40.8)): balustrade(*a, Z3)

# 작은 사당
for i, (sx, sy) in enumerate(((-20, -40), (21, -41), (46, -24), (-46, 34), (46, 38), (-44, -30), (-22, 33), (23, 33), (46, 52), (-46, 52))):
    shrine(sx, sy, level(sx, sy), ruined=i % 3 == 2)

# 작은 집들: 테라스 가장자리와 뒤쪽에 다닥다닥 (지붕이 무너진 것도 섞는다)
def house(x, y, w, d, h, rot):
    z = level(x, y)
    with at(x, y, z, rot):
        box(0, 0, 0, w + 0.8, d + 0.8, 0.3, jit(PALE, 0.04))
        mbox(0, 0, 0.3, w, d, h, jit(STONE, 0.05))
        box(0, -d / 2 - 0.05, 0.3, w * 0.28, 0.25, h * 0.6, DOOR)
        if R.random() < 0.7:
            box(0, 0, 0.3 + h, w + 0.5, d + 0.5, 0.25, jit(PALE, 0.03)); gable(0, 0, 0.55 + h, w + 0.5, d + 0.5, w * 0.22, jit(STONE, 0.04))
        for sx in (-w / 2 + 0.4, w / 2 - 0.4):
            column(sx, -d / 2 - 1.1, 0.3, h * 0.9, 0.28, broken=R.random() < 0.35)
for hx, hy, rot in ((-47, -40, 1.57), (-47, -20, 1.57), (-46, 14, 1.57), (47, -38, -1.57), (47, 26, -1.57), (-36, -42, 0), (36, -42, 0), (-12, -41, 0), (12, -41, 0),
                    (-35, 54, 0), (35, 55, 0), (-46, 44, 1.57), (46, 45, -1.57), (-20, 23, 0), (20, 23, 0), (-36, 20, 3.14), (36, 22, 3.14)):
    house(hx, hy, R.uniform(4.5, 6.5), R.uniform(4, 5.5), R.uniform(3, 4.6), rot + R.uniform(-0.12, 0.12))

# 정문: 앞쪽 계단 위의 문
for sx in (-6.5, 6.5): mbox(sx, -44, Z1, 2.4, 2.4, 8, jit(STONE))
box(0, -44, Z1 + 8, 17, 2.8, 1.5, jit(STONE)); box(0, -44, Z1 + 9.5, 18, 3.4, 0.3, jit(PALE)); gable(0, -44, Z1 + 9.8, 18, 3.4, 3.2, jit(STONE))

# 흩어진 돌 조각과 쓰러진 기둥 토막
for i in range(70):
    x, y = R.uniform(-50, 50), R.uniform(-46, 38)
    z = level(x, y)
    if i % 3 == 0:
        a, ln, r = R.uniform(0, math.tau), R.uniform(1.2, 3.2), R.uniform(0.38, 0.55)
        seg((x, y, z + r), (x + math.cos(a) * ln, y + math.sin(a) * ln, z + r), r, r * 0.95, 8, jit(STONE))
    else:
        box(x, y, z - 0.1, R.uniform(0.5, 1.7), R.uniform(0.5, 1.4), R.uniform(0.3, 0.9), jit(STONE, 0.1), R.uniform(0, 3))

# 바깥 테두리: 바위와 무너진 벽·굵은 기둥 (밖에서 들어올 때 보이는 앞 풍경)
for i in range(80):
    a = R.uniform(0, math.tau)
    x, y = math.cos(a) * R.uniform(57, 70), 6 + math.sin(a) * R.uniform(60, 74)
    if abs(x) < 9 and y < 0: continue  # 정문 앞은 비운다
    rock(x, y, -0.8, R.uniform(1.6, 6.0), jit(DARK, 0.1))
for i in range(40):
    x, y = R.uniform(-50, 50), R.uniform(-46, 58)
    rock(x, y, level(x, y), R.uniform(0.3, 0.9), jit(DARK, 0.1))
for i in range(14):  # 뒤쪽 양옆의 높은 바위 봉우리
    sx = (-1 if i % 2 else 1) * R.uniform(58, 76)
    rock(sx, R.uniform(30, 84), -1, R.uniform(6, 10), jit(DARK, 0.1), flat=R.uniform(1.3, 2.2))
mbox(-58, -54, -1, 7, 5.5, 8, jit(STONE), 0.2); mbox(-59, -53, 7, 5, 4.5, 5, jit(STONE), 0.35); box(-60, -53, 12, 3, 3.5, 3.5, jit(STONE), 0.1, top=0.8)
z = -1.0
for k in range(4):
    cyl(56 + R.uniform(-0.3, 0.3), -56 + R.uniform(-0.3, 0.3), z, 2.6 - k * 0.1, 2.5 - k * 0.1, 2.6, 10, jit(STONE), cap=True); z += 2.6

finish("atlantis", {"levels": [list(l) for l in LEVELS]})
