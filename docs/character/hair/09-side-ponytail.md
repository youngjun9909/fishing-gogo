# 09 옆 포니테일

공통 규칙: [common-rules.md](common-rules.md). 앞머리·가르마·윤기·색·꼬리 모양은 01(목표 머리)과 같고, **묶음 위치만 옆으로 옮긴 것**이다.

## 형태
- 중앙 가르마, 01과 같은 가는 가닥의 둥근 앞머리, 귀를 반쯤 덮는 옆머리(묶은 쪽의 옆머리는 묶음으로 올라감).
- 묶음 위치: **머리 한쪽 옆, 귀보다 위·뒤쪽**(정수리 옆). 보는 사람 기준 오른쪽으로 통일(이미지에서 모델의 왼쪽 머리, 확정은 아님 — 게임 쪽 좌우 규칙 **미확인**).
- 꼬리: 짧고 통통, 어깨 위에서 끝, 끝이 가늘게 갈라지며 바깥으로 살짝 말림. 몸 앞으로 흘러내리지 않고 어깨 옆으로.

## 프롬프트
**스타일 문장 (한국어)**
```
중앙 가르마, 눈썹 바로 위에서 끝나는 가는 가닥의 둥근 앞머리, 머리 한쪽(오른쪽)에서 귀보다 위·뒤쪽에 묶은 짧고 통통한 옆 포니테일(어깨 높이에서 끝나고 끝이 가늘게 갈라지며 살짝 바깥으로 말림). 반대쪽 옆머리는 귀를 반쯤 덮고 턱선까지. 머리끈 없이 머리카락이 묶음을 감싼 모양.
```
**Style sentence (English)**
```
Center part, rounded bangs of fine strands ending just above the eyebrows, a short plump side ponytail tied on one side (viewer's right) above and behind the ear (ends at shoulder height, tip splitting into fine strands and curling slightly outward). The opposite side lock half-covers the ear down to jaw line. No hair tie; hair wraps around the base.
```
조립: 스타일 문장 + [블록 A] + [블록 B] (+ [블록 C]).

| 시점 | 한국어 | English |
|---|---|---|
| 정면 | 정면. 한쪽으로 꼬리가 내려옴 | Front view. Tail drops on one side |
| 측면 | 정확히 옆(꼬리가 보이는 쪽). 묶음 위치와 꼬리 곡선 | Exact side view from the tail side. Base position and tail curve |
| 뒤 | 뒤. 비대칭 위치 확인 | Back view. Check the asymmetric position |

## Tripo 입력 조건
- common-rules.md 4절.
- **좌우가 비대칭**이라 정면·측면(꼬리 쪽)·뒤를 모두 넣는 것이 좋음. 한 장만 넣으면 꼬리 위치가 틀어질 수 있음(미확인).
- 반대 방향 버전은 좌우 반전으로 만들 수 있으나(게임에서 거울 반전) 텍스처가 대칭이어야 문제 없음.

## 하지 말 것
- 공통 6절 전부.
- 꼬리가 어깨 아래·가슴 앞으로 흘러내리게 하지 않기(옷과 겹침).
- 묶음을 귀 아래로 내리지 않기(그건 낮은 옆 묶음으로 다른 스타일).
- 리본·머리끈 금지.

## TODO(치수)
## 치수 (master-sheet.md 기준)
- 묶음: 귀(z 0.66~0.95, x 0.20~0.21)보다 위·뒤. 거리 수치 **미확인**.
- 꼬리 끝: 어깨선 z 약 0.52~0.56 위. T자세 팔(z 0.51~0.58)과 겹치지 않을 것.
