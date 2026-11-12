# 수중 맵 구역 모델을 코드로 짓는 공용 도구: 도형(상자·원기둥·바위 등)을 쌓고, 음영을 꼭짓점 색에 구워 GLB로 내보낸다.
# 구역별 스크립트(atlantis.py, deep.py)가 불러 쓴다. 좌표: x 오른쪽, y 뒤쪽, z 위.
import bpy, math, random, json, sys, os
from mathutils import Vector, noise
from mathutils.bvhtree import BVHTree

R = random.Random(7)
V, F, C, A, W = [], [], [], [], []  # 꼭짓점, 면, 꼭짓점 색(sRGB), 표식(1 돌 쌓은 줄눈을 그릴 큰 벽, 2 스스로 빛나는 것, 3 산호·해초처럼 색이 선명한 것), 물결에 흔들리는 정도(0~1)
MASON, GLOW, VIVID = [False], [False], [False]
SWAY = [None]  # (밑동 높이, 키): 켜 두면 그 사이 꼭짓점이 위로 갈수록 많이 흔들린다 (해초)
LIGHTS = []  # 빛나는 것이 주변 돌에 비추는 빛: (위치, 색, 닿는 거리)
XF = [(0, 0, 0, 0, 1)]  # 놓을 위치, 방향, 크기
STONE, PALE, DARK = (0.66, 0.73, 0.80), (0.75, 0.80, 0.85), (0.46, 0.54, 0.62)
SAND = (0.80, 0.78, 0.68)
DOOR, BRONZE, MOSS = (0.22, 0.30, 0.42), (0.52, 0.70, 0.70), (0.36, 0.62, 0.56)


def jit(c, a=0.07):
    k = 1 + R.uniform(-a, a)
    return (min(1, c[0] * k * R.uniform(0.98, 1.02)), min(1, c[1] * k), min(1, c[2] * k * R.uniform(0.98, 1.02)))


class at:
    def __init__(self, x, y, z, rot=0.0, s=1.0): self.t = (x, y, z, rot, s)
    def __enter__(self): XF.append(self.t)
    def __exit__(self, *a): XF.pop()


def emit(vs, fs, col, orient=True):
    if orient:  # 면이 덩어리 바깥을 향하게 맞춘다
        c = sum((Vector(v) for v in vs), Vector()) / len(vs)
        out = []
        for f in fs:
            p = [Vector(vs[i]) for i in f]
            n = (p[1] - p[0]).cross(p[2] - p[0])
            out.append(f if n.dot(sum(p, Vector()) / len(p) - c) >= 0 else f[::-1])
        fs = out
    tx, ty, tz, rot, s = XF[-1]
    cr, sr = math.cos(rot), math.sin(rot)
    b = len(V)
    for x, y, z in vs:
        x *= s; y *= s; z *= s
        V.append((tx + x * cr - y * sr, ty + x * sr + y * cr, tz + z))
        C.append(col)
        A.append(2 if GLOW[0] else 3 if VIVID[0] else 1 if MASON[0] else 0)
        W.append(0.0 if SWAY[0] is None else min(1.0, max(0.0, (tz + z - SWAY[0][0]) / SWAY[0][1])))
    F.extend(tuple(b + i for i in f) for f in fs)


def box(cx, cy, z0, sx, sy, sz, col, rot=0.0, top=1.0):
    cr, sr = math.cos(rot), math.sin(rot)
    vs = []
    for zz, t in ((z0, 1.0), (z0 + sz, top)):
        for dx, dy in ((-1, -1), (1, -1), (1, 1), (-1, 1)):
            x, y = dx * sx / 2 * t, dy * sy / 2 * t
            vs.append((cx + x * cr - y * sr, cy + x * sr + y * cr, zz))
    emit(vs, [(4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)], col)  # 바닥 면은 안 만든다


def mbox(*a, **k):  # 줄눈을 그릴 큰 벽
    MASON[0] = True
    box(*a, **k)
    MASON[0] = False


def cyl(cx, cy, z0, r0, r1, h, n, col, cap=True):
    vs = [(cx + math.cos(i / n * math.tau) * r, cy + math.sin(i / n * math.tau) * r, z) for z, r in ((z0, r0), (z0 + h, r1)) for i in range(n)]
    fs = [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)]
    if cap: fs.append(tuple(range(n, 2 * n)))
    emit(vs, fs, col)


def seg(p0, p1, r0, r1, n, col):
    a, b = Vector(p0), Vector(p1)
    d = (b - a).normalized()
    u = d.cross(Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))).normalized()
    w = d.cross(u)
    vs = [tuple(p + (u * math.cos(i / n * math.tau) + w * math.sin(i / n * math.tau)) * r) for p, r in ((a, r0), (b, r1)) for i in range(n)]
    emit(vs, [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)] + [tuple(range(n)), tuple(range(n, 2 * n))], col)


def dome(cx, cy, z0, r, n, rings, col, squash=1.0):
    vs = []
    for k in range(rings):
        a = k / rings * math.pi / 2
        vs += [(cx + math.cos(i / n * math.tau) * r * math.cos(a), cy + math.sin(i / n * math.tau) * r * math.cos(a), z0 + r * math.sin(a) * squash) for i in range(n)]
    vs.append((cx, cy, z0 + r * squash))
    fs = [(k * n + i, k * n + (i + 1) % n, (k + 1) * n + (i + 1) % n, (k + 1) * n + i) for k in range(rings - 1) for i in range(n)]
    fs += [((rings - 1) * n + i, (rings - 1) * n + (i + 1) % n, rings * n) for i in range(n)]
    emit(vs, fs, col)


def gable(cx, cy, z0, w, d, h, col):  # 삼각 지붕 (정면이 -y)
    vs = [(cx - w / 2, cy - d / 2, z0), (cx + w / 2, cy - d / 2, z0), (cx + w / 2, cy + d / 2, z0), (cx - w / 2, cy + d / 2, z0), (cx, cy - d / 2, z0 + h), (cx, cy + d / 2, z0 + h)]
    emit(vs, [(0, 1, 4), (2, 3, 5), (1, 2, 5, 4), (3, 0, 4, 5)], col)


ICO = None
def rock(cx, cy, cz, r, col, flat=0.6):
    global ICO
    if ICO is None:
        t = (1 + 5 ** 0.5) / 2
        v = [Vector(p).normalized() for p in ((-1, t, 0), (1, t, 0), (-1, -t, 0), (1, -t, 0), (0, -1, t), (0, 1, t), (0, -1, -t), (0, 1, -t), (t, 0, -1), (t, 0, 1), (-t, 0, -1), (-t, 0, 1))]
        f = [(0, 11, 5), (0, 5, 1), (0, 1, 7), (0, 7, 10), (0, 10, 11), (1, 5, 9), (5, 11, 4), (11, 10, 2), (10, 7, 6), (7, 1, 8), (3, 9, 4), (3, 4, 2), (3, 2, 6), (3, 6, 8), (3, 8, 9), (4, 9, 5), (2, 4, 11), (6, 2, 10), (8, 6, 7), (9, 8, 1)]
        mid, f2 = {}, []
        def m(a, b):
            k = (min(a, b), max(a, b))
            if k not in mid: v.append(((v[a] + v[b]) / 2).normalized()); mid[k] = len(v) - 1
            return mid[k]
        for a, b, c in f:
            ab, bc, ca = m(a, b), m(b, c), m(c, a)
            f2 += [(a, ab, ca), (b, bc, ab), (c, ca, bc), (ab, bc, ca)]
        ICO = (v, f2)
    sx, sy = r * R.uniform(0.8, 1.3), r * R.uniform(0.8, 1.3)
    vs = [(cx + p.x * sx * k, cy + p.y * sy * k, cz + p.z * r * flat * k) for p in ICO[0] for k in (R.uniform(0.78, 1.15),)]
    emit(vs, ICO[1], col)


# ---- 산호초 (산호 숲, 거북이 만) ---------------------------------------------------
CORALS = ((1.0, 0.45, 0.12), (0.93, 0.26, 0.20), (0.52, 0.32, 0.88), (0.96, 0.42, 0.66), (1.0, 0.80, 0.16), (0.16, 0.42, 0.96), (0.80, 0.32, 0.78), (0.98, 0.60, 0.30))
GREENS = ((0.26, 0.72, 0.26), (0.46, 0.80, 0.22), (0.16, 0.60, 0.36), (0.36, 0.78, 0.40))
GREY, GREYTOP = (0.52, 0.51, 0.52), (0.78, 0.75, 0.66)
DISCS = []  # 딛고 설 수 있는 바위 윗면 [x, y, 반지름, 높이]


def slab(cx, cy, rx, ry, z0, z1, col, top=None, rot=0.0, n=8):  # 윗면이 평평한 울퉁불퉁한 바위 판 (윗면은 밝게)
    a0 = R.uniform(0, math.tau)
    rr = [R.uniform(0.8, 1.12) for _ in range(n)]
    cr, sr = math.cos(rot), math.sin(rot)
    def ring(z, k):
        out = []
        for i in range(n):
            x, y = math.cos(a0 + i / n * math.tau) * rr[i] * rx * k, math.sin(a0 + i / n * math.tau) * rr[i] * ry * k
            out.append((cx + x * cr - y * sr, cy + x * sr + y * cr, z + R.uniform(-0.06, 0.06)))
        return out
    lo, hi = ring(z0, 1.08), ring(z1, 1.0)
    emit(lo + hi + [(cx, cy, z0)], [(i, (i + 1) % n, n + (i + 1) % n, n + i) for i in range(n)] + [(i, (i + 1) % n, 2 * n) for i in range(n)], col)
    emit(hi + [(cx, cy, z1 + 0.05)], [(i, (i + 1) % n, n) for i in range(n)], top or jit(GREYTOP, 0.06), orient=False)


def stack(cx, cy, r, top, lean=(0, 0), disc=True, z0=-0.5):  # 판을 여러 겹 쌓은 바위 더미. lean: 위로 갈수록 밀리는 방향(처마처럼 튀어나온다)
    layers = max(1, min(5, int(top / 1.8) + 1))
    z, col = z0, jit(GREY, 0.1)
    for k in range(layers):
        z1 = top * (k + 1) / layers + (R.uniform(-0.25, 0.25) if k < layers - 1 else 0)
        t = k / max(1, layers - 1)
        x, y, rk = cx + lean[0] * t + R.uniform(-0.5, 0.5), cy + lean[1] * t + R.uniform(-0.5, 0.5), r * (1.0 - 0.3 * t) * R.uniform(0.9, 1.08)
        slab(x, y, rk, rk * R.uniform(0.8, 1.0), z, z1, jit(col, 0.06), rot=R.uniform(0, 3))
        if disc and math.hypot(x - cx, y - cy) < r * 0.5: DISCS.append([round(x, 1), round(y, 1), round(rk * 0.8, 1), round(z1, 1)])
        z = z1 - 0.15


def arch(cx, cy, rot, w, h):  # 헤엄쳐 지나는 바위 아치: 양쪽 기둥(판 쌓기)과 위를 가로지르는 긴 판
    with at(cx, cy, 0, rot):
        for sx in (-1, 1):
            z = -0.5
            for k in range(4):
                z1 = h * (k + 1) / 4
                slab(sx * (w / 2 + 1.2 - k * 0.25) + R.uniform(-0.3, 0.3), R.uniform(-0.4, 0.4), w * 0.24, w * 0.22, z, z1, jit(GREY, 0.1))
                z = z1 - 0.15
        slab(-w * 0.22, 0, w * 0.5, w * 0.22, h - 0.3, h + 1.6, jit(GREY, 0.1))
        slab(w * 0.24, 0.3, w * 0.5, w * 0.24, h - 0.1, h + 1.9, jit(GREY, 0.1))
        slab(0, -0.2, w * 0.42, w * 0.2, h + 1.4, h + 2.8, jit(GREY, 0.1))


def near_way(x, y, ways, m):  # 다른 구역으로 가는 길(구역 중심에서 뻗는 방향들) 위인지: 길에서 m 안쪽이면 True. 그 자리는 바위를 놓지 않고 비운다
    for wx, wy in ways:
        L = math.hypot(wx, wy)
        if x * wx + y * wy > 0 and abs(-x * wy + y * wx) / L < m: return True
    return False


def top_at(x, y):  # 그 자리에서 가장 높은 바위 윗면 (없으면 모래 바닥 0)
    return max([h for cx, cy, r, h in DISCS if (x - cx) ** 2 + (y - cy) ** 2 < r * r], default=0.0)


def _br(p, d, ln, r, depth, col):
    q = p + d * ln
    seg(p, q, r, r * 0.74, 5, col)
    if depth == 0: return
    for k in range(2):
        nd = (d + Vector((R.uniform(-1, 1), R.uniform(-1, 1), R.uniform(-0.2, 0.7))) * 0.85).normalized()
        if nd.z < 0.15: nd.z = 0.15; nd.normalize()
        _br(q - d * r * 0.4, nd, ln * R.uniform(0.62, 0.85), r * 0.74, depth - 1, col)


def branch_coral(x, y, z, s, col=None):  # 가지 산호
    VIVID[0] = True
    col = col or jit(CORALS[R.randrange(len(CORALS))], 0.08)
    for k in range(R.randint(1, 2)):
        d = Vector((R.uniform(-0.35, 0.35), R.uniform(-0.35, 0.35), 1)).normalized()
        _br(Vector((x + R.uniform(-0.2, 0.2) * s * k, y + R.uniform(-0.2, 0.2) * s * k, z - 0.25)), d, 0.85 * s, 0.22 * s, 3 if s > 1.1 else 2, col)
    VIVID[0] = False


def tube_sponge(x, y, z, s, col=None):  # 속이 빈 육각 통 해면 무리
    VIVID[0] = True
    col = col or jit(CORALS[R.randrange(len(CORALS))], 0.08)
    dark = tuple(c * 0.42 for c in col)
    for k in range(R.randint(2, 5)):
        a, d = R.uniform(0, math.tau), (0.0 if k == 0 else R.uniform(0.45, 0.8) * s)
        px, py, h, r = x + math.cos(a) * d, y + math.sin(a) * d, R.uniform(0.7, 1.5) * s * (1.25 if k == 0 else 1), R.uniform(0.26, 0.4) * s
        ring = lambda rr, zz: [(px + math.cos(i / 6 * math.tau) * rr, py + math.sin(i / 6 * math.tau) * rr, zz) for i in range(6)]
        q = lambda o0, o1: [(o0 + i, o0 + (i + 1) % 6, o1 + (i + 1) % 6, o1 + i) for i in range(6)]
        emit(ring(r * 0.8, z - 0.25) + ring(r, z + h) + ring(r * 0.66, z + h), q(0, 6) + q(6, 12), jit(col, 0.05), orient=False)
        emit(ring(r * 0.66, z + h) + ring(r * 0.5, z + h * 0.45), q(0, 6) + [tuple(range(6, 12))], dark, orient=False)
    VIVID[0] = False


def seagrass(x, y, z, s):  # 넓적한 잎이 모인 해초. 위쪽일수록 물결에 흔들린다
    VIVID[0] = True
    SWAY[0] = (z, 2.2 * s)
    col = GREENS[R.randrange(len(GREENS))]
    for k in range(R.randint(4, 7)):
        a = R.uniform(0, math.tau)
        d, h, w = Vector((math.cos(a), math.sin(a), 0)), R.uniform(0.7, 2.2) * s, R.uniform(0.16, 0.26) * s
        side, lean = Vector((-d.y, d.x, 0)), R.uniform(0.1, 0.45)
        b = Vector((x, y, z - 0.2)) + d * R.uniform(0.05, 0.4) * s
        pts = []
        for t, wk in ((0, 0.8), (0.5, 1.0), (1.0, 0.0)):
            c = b + Vector((0, 0, h * t)) + d * (lean * h * t * t)
            pts += [tuple(c - side * w * wk), tuple(c + d * w * 0.5 * wk), tuple(c + side * w * wk)] if wk else [tuple(c)]
        emit(pts, [(0, 1, 4, 3), (1, 2, 5, 4), (3, 4, 6), (4, 5, 6)], jit(col, 0.12), orient=False)
    SWAY[0] = None
    VIVID[0] = False


def starfish(x, y, z, s, col=None):
    VIVID[0] = True
    a0 = R.uniform(0, math.tau)
    vs = [(x + math.cos(a0 + i / 10 * math.tau) * s * (1.0 if i % 2 == 0 else 0.38), y + math.sin(a0 + i / 10 * math.tau) * s * (1.0 if i % 2 == 0 else 0.38), z + 0.04) for i in range(10)] + [(x, y, z + 0.22 * s)]
    emit(vs, [(i, (i + 1) % 10, 10) for i in range(10)], col or jit(CORALS[R.randrange(2)], 0.1), orient=False)
    VIVID[0] = False


def reef_life(x, y, z, s=1.0):  # 그 자리에 산호·해면·해초 가운데 하나
    k = R.random()
    if k < 0.40: branch_coral(x, y, z, R.uniform(1.0, 2.1) * s)
    elif k < 0.62: tube_sponge(x, y, z, R.uniform(1.0, 2.0) * s)
    else: seagrass(x, y, z, R.uniform(0.8, 1.5) * s)


def finish(name, info, sun=True, moss=1.0, cam=((-8, -78, 30), (0, 14, 4)), ao_dist=7.0, amin=0.3, shade=(0.30, 0.45, 0.70)):
    """음영을 굽고 칸별로 나눠 client/public/models/underwater/<name>.glb 와 <name>.json(info)으로 내보낸다.
    ao_dist: 그늘을 재는 거리(동굴처럼 막힌 곳은 길게 잡아 구멍에서 멀수록 어두워지게), amin: 가장 어두운 곳의 밝기, shade: 그늘 색"""
    print("꼭짓점", len(V), "면", len(F))
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    me = bpy.data.meshes.new("all")
    me.from_pydata(V, [], F)
    ob = bpy.data.objects.new("all", me)
    scene.collection.objects.link(ob)
    me.materials.append(bpy.data.materials.new("m"))
    me.color_attributes.active_color = me.color_attributes.new("AO", "FLOAT_COLOR", "POINT")
    bpy.context.view_layer.objects.active = ob
    ob.select_set(True)
    scene.render.engine = "CYCLES"
    scene.cycles.device = "CPU"
    scene.cycles.samples = 48
    scene.world = bpy.data.worlds.new("w")
    scene.world.light_settings.distance = ao_dist
    scene.render.bake.target = "VERTEX_COLORS"
    bpy.ops.object.bake(type="AO")  # 틈새 그늘
    ao = [0.0] * (len(V) * 4)
    me.color_attributes["AO"].data.foreach_get("color", ao)

    # 햇빛 그림자: 꼭짓점마다 해 쪽으로 광선을 몇 개 쏴서 가려진 정도를 잰다 (가장자리가 부드럽게 번진다). 해가 안 닿는 구역은 건너뛴다
    lit = [1.0] * len(V)
    if sun:
        bvh = BVHTree.FromPolygons(V, F)
        S = Vector((-0.38, -0.42, 0.82)).normalized()
        su = S.cross(Vector((0, 0, 1))).normalized(); sv = S.cross(su)
        rays = [(S + su * a + sv * b).normalized() for a, b in ((0, 0), (0.07, 0), (-0.07, 0), (0, 0.07), (0, -0.07), (0.05, 0.05), (-0.05, -0.05))]
        me.update()
        for i, v in enumerate(V):
            o = Vector(v) + me.vertices[i].normal * 0.08
            lit[i] = sum(1 for d in rays if bvh.ray_cast(o + d * 0.03, d, 150.0)[0] is None) / len(rays)

    # 최종 색: 돌 색 + 이끼 얼룩, 그늘은 회색이 아니라 푸른 쪽으로. 빛나는 것 주변 돌에는 그 빛을 더한다
    final = []
    sd = (0.50, 0.64, 0.90)  # 그림자 색
    for i, (v, c) in enumerate(zip(V, C)):
        if A[i] == 2:
            final.append(tuple(x ** 2.2 for x in c) + (1.0,))
            continue
        a = (amin + (1 - amin) * min(1.0, ao[i * 4] * 1.15)) ** 1.2
        k = (min(1.0, max(0.0, noise.noise(Vector(v) * 0.11) * 1.6 + 0.12)) * 0.4 + (1 - a) * 0.25) * moss
        if c is DOOR or c is BRONZE: k *= 0.4
        if A[i] == 3: k, a = 0.0, 0.45 + 0.55 * a  # 산호·해초: 이끼 없이, 그늘도 옅게
        sh = [shade[j] + (1 - shade[j]) * a for j in range(3)]
        rgb = [((c[j] + (MOSS[j] - c[j]) * k) * sh[j] * (sd[j] + (1 - sd[j]) * lit[i])) ** 2.2 for j in range(3)]
        for (lx, ly, lz), lc, lr in LIGHTS:
            d2 = (v[0] - lx) ** 2 + (v[1] - ly) ** 2 + (v[2] - lz) ** 2
            if d2 < lr * lr:
                w = (1 - d2 ** 0.5 / lr) ** 2 * (0.5 + 0.5 * a)
                for j in range(3): rgb[j] += lc[j] * w
        final.append(tuple(rgb) + (1.0 - W[i] if A[i] == 3 else 0.0 if A[i] == 1 else 1.0,))  # 알파: 산호·해초는 1-흔들림, 줄눈 벽은 0

    # 칸별로 나눠 내보내기 (화면 밖 칸은 그리지 않게). 빛나는 것은 "glow_" 메시로 따로
    bpy.data.objects.remove(ob)
    CELL = 47.0
    cells = {}
    for f in F:
        cx = sum(V[i][0] for i in f) / len(f); cy = sum(V[i][1] for i in f) / len(f)
        cells.setdefault(("glow" if A[f[0]] == 2 else "coral" if A[f[0]] == 3 else "rock", int((cx + 235) // CELL), int((cy + 235) // CELL)), []).append(f)
    objs = []
    for key, fs in cells.items():
        remap, vs, cs, nf = {}, [], [], []
        for f in fs:
            for i in f:
                if i not in remap: remap[i] = len(vs); vs.append(V[i]); cs.append(final[i])
            nf.append(tuple(remap[i] for i in f))
        m = bpy.data.meshes.new("%s_%d_%d" % key)
        m.from_pydata(vs, [], nf)
        col = m.color_attributes.new("Col", "FLOAT_COLOR", "POINT")
        col.data.foreach_set("color", [x for c in cs for x in c])
        m.color_attributes.active_color = col
        m.color_attributes.render_color_index = 0
        o = bpy.data.objects.new(m.name, m)
        scene.collection.objects.link(o)
        o.select_set(True)
        objs.append(o)
    out = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "client", "public", "models", "underwater")
    os.makedirs(out, exist_ok=True)
    bpy.ops.export_scene.gltf(filepath=os.path.join(out, name + ".glb"), export_format="GLB", use_selection=True, export_normals=False, export_texcoords=False,
                              export_materials="NONE", export_vertex_color="ACTIVE", export_active_vertex_color_when_no_material=True, export_yup=True)
    with open(os.path.join(out, name + ".json"), "w") as fp:
        json.dump(info, fp)
    print("내보냄", sum(len(o.data.polygons) for o in objs), "면,", len(objs), "칸")

    if "--" in sys.argv and sys.argv[sys.argv.index("--") + 1:]:  # 미리보기 그림 (선택)
        c = bpy.data.objects.new("cam", bpy.data.cameras.new("cam"))
        scene.collection.objects.link(c)
        c.location = cam[0]
        c.rotation_euler = (Vector(cam[1]) - c.location).to_track_quat("-Z", "Y").to_euler()
        c.data.lens = 26
        scene.camera = c
        scene.render.engine = "BLENDER_WORKBENCH"
        scene.display.shading.light = "STUDIO"
        scene.display.shading.color_type = "VERTEX"
        scene.display.shading.show_cavity = False
        scene.world.color = (0.05, 0.25, 0.5)
        scene.render.resolution_x, scene.render.resolution_y = 1200, 800
        scene.render.filepath = sys.argv[sys.argv.index("--") + 1]
        bpy.ops.render.render(write_still=True)
