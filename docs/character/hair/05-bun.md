# 05 똥머리 (올림 번)

공통 규칙: [common-rules.md](common-rules.md). 앞머리·가르마·윤기·색은 01(목표 머리)과 같다.

## 형태
- 중앙 가르마, 01과 같은 둥근 시스루 앞머리.
- 옆머리는 귀를 반쯤 가리고 턱선까지(01과 같음). 뒷머리는 모두 위로 올려 정수리 바로 뒤에 **둥근 공 모양 번** 하나.
- 번 크기: 머리 폭의 약 1/3~1/2(눈대중, 정확하지 않음). 표면에 둥글게 감긴 결 몇 줄만.

## 프롬프트
**스타일 문장 (한국어)**
```
중앙 가르마, 눈썹 바로 위에서 끝나는 가는 가닥의 둥근 앞머리, 귀를 반쯤 덮고 턱선까지 내려오는 옆머리, 나머지 머리를 모두 올려 정수리 바로 뒤에 묶은 둥근 공 모양 똥머리 하나(머리카락이 둥글게 감겨 있고 감긴 결 두세 줄이 보임). 머리끈과 장식 없음.
```
**Style sentence (English)**
```
Center part, rounded bangs of fine strands ending just above the eyebrows, side locks half-covering the ears down to jaw line, all remaining hair gathered into a single round ball-shaped bun right behind the crown (hair coiled with two or three visible wrap lines). No ties or accessories.
```
조립: 스타일 문장 + [블록 A] + [블록 B] (+ [블록 C]).

| 시점 | 한국어 | English |
|---|---|---|
| 정면 | 정면. 번 윗부분이 머리 위로 둥글게 보임 | Front view. Top of the bun rounds above the head |
| 측면 | 정확히 옆. 번 위치와 크기 | Exact side view. Bun position and size |
| 뒤 | 뒤. 번과 목덜미 쪽 머리 끝선(깔끔하게 올림) | Back view. Bun and neat nape hairline |

## Tripo 입력 조건
- common-rules.md 4절.
- 번은 **거의 구**라 3D 변환이 쉽다. 감긴 결은 얕게(깊은 홈은 구멍으로 나올 수 있음).
- 번이 머리통에 붙는 부분이 분리되어 떠 보이지 않게 측면 이미지에서 접촉이 분명해야 함.

## 하지 말 것
- 공통 6절 전부.
- 번을 너무 크거나 높게(머리 전체보다 커 보이게) 하지 않기.
- 번에 비녀·리본·머리망 그리지 않기.
- 목덜미에 잔머리를 흘리지 않기(3D에서 노이즈).

## TODO(치수)
## 치수 (master-sheet.md 기준)
- 번 지름 수치는 **미확인**. 머리 폭 0.36~0.40의 1/3~1/2(눈대중)를 임시 기준으로.
- 번 안쪽이 두피와 1~2cm 간격. 목덜미 쪽은 z 0.62 위에서 깔끔히 올림.
