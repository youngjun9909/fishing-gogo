# 수중 맵 "알록달록 산호 숲" 구역 모델: 모래 길 양옆으로 판처럼 쌓인 바위 더미와 아치, 그 위를 덮은 색색의 산호·통 해면·해초.
# 산호와 해초도 이 모델에 들어 있다("coral_" 메시, 색이 선명하고 해초는 물결에 흔들린다).
# 사용: blender -b -P coral.py [-- 미리보기.png]
# 출력: client/public/models/underwater/coral.glb, coral.json (discs: 딛고 설 수 있는 바위 윗면 [x, y, 반지름, 높이])
# 좌표: z=0 이 모래 바닥. 시작 지점은 (-6, -14) 쯤에서 +y 를 본다
import sys, os
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from mapkit import *

path_x = lambda y: 6 * math.sin(y / 18)  # 가운데를 구불구불 지나는 모래 길
off_path = lambda x, y: abs(x - path_x(y))
ARCHES = [(path_x(38), 38, 0.1, 13, 8.5), (-36, 20, 1.0, 9, 6), (32, -28, -0.7, 9, 6), (-24, -44, 0.4, 8, 5.5)]
WAYS = ((-175, -95), (175, 95), (0, -205), (205, -115), (-175, 135))  # 다른 구역으로 가는 길의 방향 (게임 underwater.ts 의 PATHS 와 맞춘다): 아틀란티스, 난파선, 심해, 거북이 만, 보물 동굴
spots = []  # 바위 더미 (x, y, 반지름, 높이)

# 길 양옆의 바위 더미: 길에서 멀수록 높다
for i in range(400):
    if len(spots) >= 78: break
    a, d = R.uniform(0, math.tau), 62 * R.random() ** 0.6
    x, y, r = math.cos(a) * d, math.sin(a) * d, R.uniform(3, 8)
    if off_path(x, y) < 7 + r or math.hypot(x - 6, y + 8) < 9 + r: continue  # 길과 시작 지점 옆(신화 탈것 자리)은 비운다
    if any(math.hypot(x - ax, y - ay) < w + r for ax, ay, _, w, _ in ARCHES): continue
    if d > 30 and near_way(x, y, WAYS, r + 6): continue  # 다른 구역으로 가는 길은 비운다
    if any(math.hypot(x - sx, y - sy) < (r + sr) * 0.75 for sx, sy, sr, _ in spots): continue
    spots.append((x, y, r, min(9, 0.8 + (off_path(x, y) - 7) * 0.13 + R.uniform(0, 2.5))))
# 처마처럼 튀어나온 큰 바위 (길 쪽으로 기운다)
for x, y, r, top in ((27, 8, 8, 12), (-25, 46, 7, 10), (24, 52, 7, 11)):
    spots.append((x, y, r, top))
for x, y, r, top in spots:
    stack(x, y, r, top, lean=((path_x(y) - x) * 0.3, 0) if top > 9.5 else (0, 0))
for a in ARCHES: arch(*a)
# 멀리 둘러선 큰 바위 (안개 속 윤곽)
for i in range(16):
    a = i / 16 * math.tau + R.uniform(-0.1, 0.1)
    d = R.uniform(70, 82)
    if near_way(math.cos(a) * d, math.sin(a) * d, WAYS, 24): continue  # 다른 구역으로 가는 길은 열어 둔다
    stack(math.cos(a) * d, math.sin(a) * d, R.uniform(9, 14), R.uniform(8, 17), disc=False, z0=-4)

# 바위 위와 둘레의 산호
for x, y, r, top in spots:
    for k in range(int(5 + r * 1.6)):  # 위
        a, d = R.uniform(0, math.tau), r * R.uniform(0, 0.75)
        px, py = x + math.cos(a) * d, y + math.sin(a) * d
        z = top_at(px, py)
        if z > 0: reef_life(px, py, z)
    for k in range(int(6 + r * 1.8)):  # 둘레 모래
        a, d = R.uniform(0, math.tau), r * R.uniform(1.2, 1.55)
        px, py = x + math.cos(a) * d, y + math.sin(a) * d
        if off_path(px, py) > 3.5: reef_life(px, py, top_at(px, py), 1.15)
for ax, ay, rot, w, h in ARCHES:  # 아치 위와 발치
    for k in range(7):
        t = R.uniform(-0.8, 0.8) * w
        px, py = ax + math.cos(rot) * t, ay + math.sin(rot) * t
        if k % 2: branch_coral(px, py, h + 1.7, R.uniform(0.8, 1.4))
        else: seagrass(px, py, h + 1.7, 1.1)
    for sx in (-1, 1):
        for k in range(3): reef_life(ax + math.cos(rot) * sx * (w / 2 + 4) + R.uniform(-2, 2), ay + math.sin(rot) * sx * (w / 2 + 4) + R.uniform(-2, 2), 0, 1.3)

# 모래 길: 넓적한 돌, 불가사리, 길가의 해초
for i in range(110):
    y = R.uniform(-64, 64)
    x = path_x(y) + R.uniform(-8, 8)
    if top_at(x, y) > 0: continue
    k = R.random()
    if k < 0.45: slab(x, y, R.uniform(0.5, 1.6), R.uniform(0.4, 1.2), -0.3, R.uniform(0.1, 0.4), jit(GREY, 0.12), n=6)
    elif k < 0.65: starfish(x, y, 0.12, R.uniform(0.5, 0.9))
    elif abs(x - path_x(y)) > 3: seagrass(x, y, 0, R.uniform(0.7, 1.2))
for x, y, r, top in spots:  # 바위 위의 불가사리
    if R.random() < 0.4: starfish(x + R.uniform(-1, 1), y + R.uniform(-1, 1), top + 0.08, R.uniform(0.5, 0.8))

finish("coral", {"discs": DISCS}, sun=True, moss=0.3, amin=0.42, shade=(0.44, 0.52, 0.66), cam=((-6, -20, 5), (2, 30, 4)))
