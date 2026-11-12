# 수중 맵 "난파선 지대" 구역 모델: 기울어 가라앉은 범선 두 척(널빤지 선체, 뚫린 구멍, 난간, 돛대, 찢어진 돛, 망루, 밧줄),
# 닻이 걸린 바위, 흩어진 널빤지와 쇠사슬, 둘레의 바위. 햇빛 그림자와 이끼를 꼭짓점 색에 구워 넣는다.
# 사용: blender -b -P wreck.py [-- 미리보기.png]
# 출력: client/public/models/underwater/wreck.glb, wreck.json
# 좌표: z=0 이 모래 바닥
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from mapkit import *
from mathutils import Matrix

WOOD, WOOD2, DECK = (0.36, 0.26, 0.19), (0.27, 0.20, 0.16), (0.42, 0.33, 0.24)
INSIDE = (0.07, 0.07, 0.09)
CLOTH, ROCKT, RUST = (0.74, 0.73, 0.62), (0.30, 0.40, 0.42), (0.50, 0.30, 0.22)


def rope(p0, p1, sag=1.0, r=0.05):  # 늘어진 밧줄
    a, b = Vector(p0), Vector(p1)
    prev = a
    for k in range(1, 6):
        t = k / 5
        p = a.lerp(b, t) - Vector((0, 0, sag * 4 * t * (1 - t)))
        seg(prev, p, r, r, 3, WOOD2)
        prev = p


def ship(L, B, D, masts, holes, seed, broken=False):
    """배 한 척을 원점에 짓는다 (x: 고물→이물, 용골이 z=0). masts: (위치 0~1, 높이). holes: (옆 -1/1, 위치, 높이 0~1, 크기)"""
    rs = random.Random(seed)
    NS, NR = 18, 7
    half = lambda s: B / 2 * (0.72 + 0.28 * math.sin(s / 0.45 * math.pi / 2)) if s < 0.45 else B / 2 * math.cos((s - 0.45) / 0.55 * math.pi / 2) ** 0.7 + 0.12
    keel = lambda s: 2.4 * max(0, (s - 0.8) / 0.2) ** 2 + 0.8 * max(0, (0.12 - s) / 0.12)
    extra = lambda s: 2.0 if s < 0.27 else 1.1 if s > 0.8 else 0.0  # 고물과 이물의 높은 갑판
    top = lambda s: D * (1 + 0.3 * (2 * s - 1) ** 2)  # 뱃전 높이

    def P(s, t, side):  # 선체 겉면의 점. t: 0 용골 ~ 1 뱃전 (1보다 크면 높은 갑판의 벽)
        tt = min(t, 1.0)
        z = keel(s) + (top(s) - keel(s)) * (0.6 * tt ** 1.5 + 0.4 * tt)
        return Vector(((s - 0.5) * L + 2.6 * tt * max(0, (s - 0.8) / 0.2), side * half(s) * math.sin(tt * math.pi / 2) ** 0.55, z))

    def PT(s, t, side):  # 높은 갑판까지 포함한 점: t=1.2 가 높은 갑판의 윗단
        p = P(s, min(t, 1.0), side)
        if t > 1: p.z += extra(s) * (t - 1) / 0.2
        return p

    holed = lambda side, s, t: any(sd == side and math.hypot((s - hs) * L, (t - ht) * D) < hr * (0.7 + 0.6 * rs.random()) for sd, hs, ht, hr in holes)
    # 선체: 널빤지 한 줄씩 색을 달리해 띠가 보이게 한다
    for side in (-1, 1):
        for r in range(NR + 1):  # 마지막 줄은 높은 갑판의 벽
            c = jit(WOOD if r % 2 else WOOD2, 0.1)
            t0, t1 = (r / NR, (r + 1) / NR) if r < NR else (1.0, 1.2)
            for i in range(NS):
                s0, s1 = i / NS, (i + 1) / NS
                if r == NR and not (extra(s0) and extra(s1)): continue
                if holed(side, (s0 + s1) / 2, (t0 + t1) / 2): continue
                q = [PT(s0, t0, side), PT(s1, t0, side), PT(s1, t1, side), PT(s0, t1, side)]
                emit([tuple(p) for p in q], [(0, 1, 2, 3) if side < 0 else (3, 2, 1, 0)], c, orient=False)
                # 안쪽 면: 어두운 색으로 한 겹 더 (구멍으로 들여다보면 캄캄한 선창이 보인다)
                emit([(p.x, p.y - side * 0.22, p.z) for p in q], [(3, 2, 1, 0) if side < 0 else (0, 1, 2, 3)], INSIDE, orient=False)
    for r in range(NR + 1):  # 고물 판
        t0, t1 = (r / NR, (r + 1) / NR) if r < NR else (1.0, 1.2)
        emit([tuple(PT(0, t0, -1)), tuple(PT(0, t0, 1)), tuple(PT(0, t1, 1)), tuple(PT(0, t1, -1))], [(0, 1, 2, 3)], jit(WOOD2, 0.1), orient=False)
    # 갑판: 길이 방향 널빤지 6줄. 군데군데 빠져 있다
    def deck_pt(s, u):  # u: -1 왼쪽 ~ 1 오른쪽
        t = 0.8 if not extra(s) else 1.2
        p = PT(s, t, 1)
        return Vector((p.x, u * abs(p.y) * 0.97, p.z - (0.0 if extra(s) else 0.05)))
    for k in range(6):
        c = jit(DECK, 0.1)
        for i in range(NS):
            s0, s1 = i / NS + 0.001, (i + 1) / NS - 0.001
            if bool(extra(s0)) != bool(extra(s1)) or rs.random() < (0.22 if broken else 0.07): continue
            u0, u1 = -1 + k / 3, -1 + (k + 1) / 3
            emit([tuple(deck_pt(s0, u0)), tuple(deck_pt(s1, u0)), tuple(deck_pt(s1, u1)), tuple(deck_pt(s0, u1))], [(0, 1, 2, 3)], c, orient=False)
    for s in (0.27, 0.8):  # 높은 갑판 앞뒤의 벽과 문
        a, b = deck_pt(s + (0.002 if s > 0.5 else -0.002), -1), deck_pt(s + (0.002 if s > 0.5 else -0.002), 1)
        lo = deck_pt(s + (-0.002 if s > 0.5 else 0.002), 0).z
        emit([(a.x, a.y, lo), (b.x, b.y, lo), (b.x, b.y, b.z), (a.x, a.y, a.z)], [(0, 1, 2, 3)], jit(WOOD, 0.08), orient=False)
        box(a.x + (0.06 if s < 0.5 else -0.06), 0, lo, 0.12, 1.1, (a.z - lo) * 0.8, DOOR)
    # 대포 구멍
    for side in (-1, 1):
        for s in (0.34, 0.44, 0.54, 0.64, 0.72):
            if holed(side, s, 0.55): continue
            a, b, c, d = P(s - 0.012, 0.48, side), P(s + 0.012, 0.48, side), P(s + 0.012, 0.62, side), P(s - 0.012, 0.62, side)
            emit([(p.x, p.y + side * 0.07, p.z) for p in (a, b, c, d)], [(0, 1, 2, 3)], DOOR, orient=False)
    # 난간
    for side in (-1, 1):
        prev = None
        for i in range(NS + 1):
            s = i / NS
            p = PT(s, 1.2 if extra(s) else 1.0, side)
            q = p + Vector((0, 0, 1.0))
            gone = rs.random() < (0.45 if broken else 0.2)
            if not gone: seg(p, q, 0.09, 0.08, 4, jit(WOOD, 0.1))
            if prev and not gone and not prev[1] and abs(prev[0].z - q.z) < 1.2: seg(prev[0], q, 0.07, 0.07, 4, jit(WOOD, 0.1))
            prev = (q, gone)
    # 이물 기둥과 앞으로 뻗은 돛대
    bow = PT(1, 1.2, 1); bow.y = 0
    seg(P(1, 0, 1) * Vector((1, 0, 1)), bow + Vector((0.4, 0, 1.0)), 0.36, 0.28, 6, jit(WOOD2))
    tip = bow + Vector((0.93, 0, 0.36)) * (L * 0.26)
    seg(bow + Vector((-1.5, 0, 0.2)), tip, 0.32, 0.16, 6, jit(WOOD))
    # 돛대, 가로대, 망루, 찢어진 돛, 밧줄
    tops = []
    for mi, (ms, mh) in enumerate(masts):
        base = deck_pt(ms, 0)
        lean = Vector((rs.uniform(-0.06, 0.06), rs.uniform(-0.05, 0.05), 1)).normalized()
        mt = base + lean * mh
        seg(base - Vector((0, 0, 1)), base + lean * mh * 0.6, 0.42, 0.32, 7, jit(WOOD, 0.06))
        seg(base + lean * mh * 0.58, mt, 0.26, 0.14, 6, jit(WOOD, 0.06))
        tops.append(mt)
        if mh > 12:  # 망루
            c = base + lean * mh * 0.6
            cyl(c.x, c.y, c.z, 1.0, 1.4, 0.25, 9, jit(WOOD2)); cyl(c.x, c.y, c.z + 0.25, 1.4, 1.45, 0.75, 9, jit(WOOD), cap=False)
        for f, w in ((0.5, 0.62), (0.82, 0.42)):  # 가로대와 돛
            if f * mh < 5: continue
            yc = base + lean * mh * f
            w *= B * 1.5
            tilt = rs.uniform(-0.12, 0.12)
            ya, yb = yc + Vector((0, -w / 2, -tilt * w / 2)), yc + Vector((0, w / 2, tilt * w / 2))
            seg(ya, yb, 0.16, 0.13, 5, jit(WOOD2))
            if broken and rs.random() < 0.5: continue
            nx, ny, sh = 9, 6, mh * 0.33
            cut = [rs.uniform(0.55, 1.0) for _ in range(nx + 1)]  # 아래쪽이 들쭉날쭉 찢어졌다
            g = lambda i, j: tuple(ya.lerp(yb, 0.05 + 0.9 * i / nx) + Vector((0.5 * math.sin(j / ny * 2.5) + 0.25 * math.sin(i * 1.3), 0, -0.15 - sh * cut[i] * j / ny)))
            vs = [g(i, j) for i in range(nx + 1) for j in range(ny + 1)]
            fs = [(i * (ny + 1) + j, (i + 1) * (ny + 1) + j, (i + 1) * (ny + 1) + j + 1, i * (ny + 1) + j + 1) for i in range(nx) for j in range(ny) if rs.random() > 0.05 + 0.14 * j / ny]
            emit(vs, fs, jit(CLOTH, 0.05), orient=False)
        for side in (-1, 1):  # 돛대 꼭대기에서 뱃전으로 내려오는 줄사다리
            a0, a1 = PT(ms - 0.035, 1.0, side), PT(ms + 0.035, 1.0, side)
            up = base + lean * mh * 0.6
            rope(a0, up, 0.3); rope(a1, up, 0.3)
            for k in range(1, 7): seg(a0.lerp(up, k / 8), a1.lerp(up, k / 8), 0.035, 0.035, 3, WOOD2)
    for a, b in zip(tops, tops[1:]): rope(a, b, 1.6)
    if tops: rope(tops[-1], tip, 1.2); rope(tops[0], PT(0.02, 1.2, 1) * Vector((1, 0, 1)) + Vector((0, 0, 1)), 1.0)


def place(build, x, y, z, yaw, roll, pitch=0.0):  # 지은 것을 기울여 제자리에 놓는다
    start = len(V)
    build()
    M = Matrix.Translation((x, y, z)) @ Matrix.Rotation(yaw, 4, "Z") @ Matrix.Rotation(pitch, 4, "Y") @ Matrix.Rotation(roll, 4, "X")
    for i in range(start, len(V)): V[i] = tuple(M @ Vector(V[i]))


def anchor():  # 닻
    seg((0, 0, 0), (0, 0, 3.6), 0.17, 0.14, 6, RUST)
    seg((-1.0, 0, 3.2), (1.0, 0, 3.2), 0.12, 0.12, 5, RUST)
    for k in range(8):
        a, b = k / 8 * math.tau, (k + 1) / 8 * math.tau
        seg((math.cos(a) * 0.4, 0, 4.0 + math.sin(a) * 0.4), (math.cos(b) * 0.4, 0, 4.0 + math.sin(b) * 0.4), 0.08, 0.08, 4, RUST)
    for sd in (-1, 1):
        pts = [(0, 0, 0.1), (sd * 0.8, 0, 0.15), (sd * 1.4, 0, 0.6), (sd * 1.7, 0, 1.3)]
        for a, b in zip(pts, pts[1:]): seg(a, b, 0.16, 0.14, 5, RUST)
        box(sd * 1.72, 0, 1.0, 0.5, 0.12, 0.8, RUST, top=0.3)


# ---- 배치 -------------------------------------------------------------------
# 큰 배: 이물이 오른쪽 앞을 향하고 뒤로 조금 기울었다. 옆구리에 큰 구멍
place(lambda: ship(40, 9.5, 6.5, [(0.3, 13), (0.52, 21), (0.74, 16)], [(-1, 0.42, 0.45, 3.2), (-1, 0.62, 0.3, 2.2), (1, 0.3, 0.5, 2.6), (-1, 0.2, 0.8, 1.8)], 3), 2, 18, -1.5, -0.33, 0.2)
# 작은 배: 왼쪽 뒤에 더 심하게 부서진 채
place(lambda: ship(30, 7.5, 5.2, [(0.36, 15), (0.66, 7)], [(-1, 0.5, 0.5, 3.4), (-1, 0.3, 0.3, 2.4), (1, 0.6, 0.5, 3.0), (1, 0.4, 0.8, 2.2), (-1, 0.75, 0.7, 2.0)], 9, broken=True), -30, 46, -1.4, 0.35, -0.3, 0.05)
place(lambda: seg((0, 0, 0), (13, 0, 0), 0.36, 0.2, 6, jit(WOOD)), -22, 30, 0.4, 0.9, 0, -0.05)  # 쓰러진 돛대

# 닻이 걸린 바위, 널빤지, 쇠사슬
rock(15, -5, 0.2, 3.0, jit(ROCKT, 0.08), flat=0.8)
place(anchor, 15.5, -7.6, 0.2, 0.5, 0.35)
for i in range(18):
    x, y = R.uniform(-30, 34), R.uniform(-22, 40)
    place(lambda: box(0, 0, 0, R.uniform(1.8, 3.4), 0.45, 0.13, jit(WOOD, 0.12)), x, y, 0.02, R.uniform(0, 3.1), R.uniform(-0.08, 0.08))
for k in range(16):
    place(lambda: box(0, 0, 0, 0.42, 0.2, 0.12, RUST), 9.0 + k * 0.4 + math.sin(k * 0.7) * 0.3, -9.5 - k * 0.12, 0.02, 0.2 + (k % 2) * 1.2, 0)

# 동굴로 내려가는 구덩이: 어두운 수직굴과 둘레의 바위. 게임 지형도 같은 자리가 꺼져 있다 (underwater.ts 의 PIT 와 맞춘다)
PX, PY, PR = -16, 2, 5.6
n = 10
ring = lambda z, r: [(PX + math.cos(i / n * math.tau) * r * (1 + 0.12 * math.sin(i * 2.3)), PY + math.sin(i / n * math.tau) * r * (1 + 0.12 * math.sin(i * 2.3)), z) for i in range(n)]
for z0, z1, r0, r1 in ((0.7, -4.0, PR, PR * 0.9), (-4.0, -9.5, PR * 0.9, PR * 0.8)):  # 안쪽을 보는 벽
    emit(ring(z0, r0) + ring(z1, r1), [((i + 1) % n, i, n + i, n + (i + 1) % n) for i in range(n)], jit((0.16, 0.20, 0.21), 0.1), orient=False)
emit(ring(-9.5, PR * 0.8), [tuple(range(n))], (0.02, 0.03, 0.04), orient=False)  # 캄캄한 바닥
for i in range(16):
    a = i / 16 * math.tau + R.uniform(-0.1, 0.1)
    rock(PX + math.cos(a) * (PR + 1.2), PY + math.sin(a) * (PR + 1.2), R.uniform(-0.2, 0.5), R.uniform(1.3, 2.6), jit(ROCKT, 0.12), flat=R.uniform(0.7, 1.2))
place(lambda: box(0, 0, 0, 5.5, 0.5, 0.16, jit(WOOD, 0.1)), PX - 3, PY - 5.2, 1.2, 0.5, 0.2)  # 구덩이 위에 걸친 널빤지

# 바위: 배 둘레의 작은 바위, 바깥의 큰 바위, 뒤쪽 양옆의 바위 벽
for i in range(70):
    a, r = R.uniform(0, math.tau), R.uniform(8, 48)
    rock(math.cos(a) * r, 14 + math.sin(a) * r, -0.3, R.uniform(0.5, 2.2), jit(ROCKT, 0.12))
for i in range(46):
    a, r = R.uniform(0, math.tau), R.uniform(52, 74)
    rock(math.cos(a) * r, 14 + math.sin(a) * r, -0.8, R.uniform(2.5, 6.5), jit(ROCKT, 0.12), flat=R.uniform(0.6, 1.1))
for i in range(18):
    sx = (-1 if i % 2 else 1) * R.uniform(50, 72)
    rock(sx, R.uniform(10, 76), -1, R.uniform(7, 11), jit(ROCKT, 0.1), flat=R.uniform(1.2, 1.9))

finish("wreck", {"doubleSided": True}, sun=True, moss=1.5, cam=((30, -34, 9), (0, 16, 6)))
