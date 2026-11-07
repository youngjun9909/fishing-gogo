# 03 단발

공통 규칙: [common-rules.md](common-rules.md). 앞머리·가르마·윤기·색은 01(목표 머리)과 같다.

## 형태
- 중앙 가르마, 01과 같은 둥근 시스루 앞머리.
- 머리 전체가 턱선 높이에서 **둥글게 안쪽으로 말려 끊어지는** 단발. 뒤는 목덜미 위.
- 귀는 반쯤 가려지거나 살짝 보임. 머리 윗부분은 둥글게 부풀음.
- 묶음 없음 — 가장 단순한 형태(3D 변환이 쉬움, 시험 생성용으로 좋음).

## 프롬프트
**스타일 문장 (한국어)**
```
중앙 가르마, 눈썹 바로 위에서 끝나는 가는 가닥의 둥근 앞머리, 머리 전체가 턱선 높이에서 안쪽으로 둥글게 말려 끝나는 단발 보브 헤어. 뒤는 목덜미 위에서 끝남. 머리 윗부분은 둥글게 부풀어 있고, 묶음과 장식은 없음.
```
**Style sentence (English)**
```
Center part, rounded bangs of fine strands ending just above the eyebrows, a chin-length bob with ends curling softly inward all around, back ending above the nape. Rounded volume on top, no ties or accessories.
```
조립: 스타일 문장 + [블록 A] + [블록 B] (+ [블록 C]).

| 시점 | 한국어 | English |
|---|---|---|
| 정면 | 정면. 양옆 머리가 턱선에서 안으로 말림 | Front view. Both sides curl inward at jaw line |
| 측면 | 정확히 옆. 귀 옆선과 뒤 끝선 | Exact side view. Ear-side outline and back hem |
| 뒤 | 뒤. 뒷머리 끝선이 둥글고 매끈함 | Back view. Smooth rounded back hem |

## Tripo 입력 조건
- common-rules.md 4절.
- 머리가 목과 맞닿는 부분(끝선)이 몸 쪽과 겹치지 않도록 목덜미 위에서 끝낼 것.
- 안쪽으로 말린 끝 아래에 빈 공간이 있어 3D에서 얇은 껍질로 나올 수 있음 → 결과 확인 시 끝선 두께 점검(미확인).

## 하지 말 것
- 공통 6절 전부.
- 어깨에 닿게 길게 만들지 않기(그건 04).
- 끝을 바깥으로 뻗치게 하지 않기(01·02와 구분되도록 안으로 말림 유지).
- 층을 너무 많이 내지 않기(단순한 덩어리).

## TODO(치수)
## 치수 (master-sheet.md 기준)
- 머리 z 0.61~1.0, 목 z 0.58~0.62. 끝선은 목 위(z 약 0.62 이상)에서 끝날 것. 턱선 정확한 높이 **미확인**.
- 안쪽 말림 부분도 두피·목과 1~2cm 이상 간격.
