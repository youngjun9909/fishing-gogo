# 02 양갈래

공통 규칙: [common-rules.md](common-rules.md). 앞머리·가르마·윤기·색은 01(목표 머리)과 같다.

## 형태
- 중앙 가르마, 01과 같은 가는 가닥의 둥근 앞머리.
- 귀 높이보다 약간 위, 머리 양옆 뒤쪽에서 두 갈래로 묶음. 좌우 대칭.
- 각 갈래: 짧고 통통, 어깨선에서 끝, 끝이 살짝 바깥으로 말림.
- 옆머리(귀 앞 머리)는 01처럼 귀를 반쯤 가리고 턱선까지.

## 프롬프트
**스타일 문장 (한국어)**
```
중앙 가르마, 눈썹 바로 위에서 끝나는 가는 가닥의 둥근 앞머리, 귀를 반쯤 덮는 옆머리, 머리 양옆 뒤쪽 귀 위 높이에서 묶은 좌우 대칭 양갈래(각 갈래는 짧고 통통하며 어깨선에서 끝나고 끝이 살짝 바깥으로 말림). 머리끈 없이 머리카락이 묶음을 감싼 모양.
```
**Style sentence (English)**
```
Center part, rounded bangs of fine strands ending just above the eyebrows, side locks half-covering the ears, symmetrical twin tails tied at the back sides slightly above ear level (each short and plump, ending at shoulder line, tips curling slightly outward). No hair ties; hair wraps around the bases.
```
조립: 스타일 문장 + [블록 A] + [블록 B] (+ [블록 C]).

| 시점 | 한국어 | English |
|---|---|---|
| 정면 | 정면. 양쪽 갈래가 얼굴 좌우로 같은 길이로 보임 | Front view. Both tails visible at equal length on each side |
| 측면 | 정확히 옆. 갈래가 귀 뒤에서 내려오는 위치 | Exact side view. Tail drops from behind the ear |
| 뒤 | 뒤. 두 묶음 위치가 좌우 대칭 | Back view. Both bases symmetric |

## Tripo 입력 조건
- common-rules.md 4절.
- **좌우 대칭**이 중요. 대칭이 깨진 그림은 다시 생성하거나 절반을 복사해 대칭화(사진 편집기).
- 갈래가 어깨 위에서 끝나게. 갈래와 얼굴 옆 사이가 막히지 않고 비어 보이게(목 쪽 공간 확보).

## 하지 말 것
- 공통 6절 전부.
- 갈래를 허리까지 길게, 가늘게 만들지 않기.
- 리본·방울 금지.
- 비대칭(한쪽만 높거나 길게) 금지.

## TODO(치수)
## 치수 (master-sheet.md 기준)
- 묶음 위치: 귀(z 0.66~0.95, x ±0.20~0.21)보다 위·뒤. 수치 **미확인**.
- 갈래 끝: 어깨선 z 약 0.52~0.56 위, 팔(z 0.51~0.58)과 겹치지 않을 것.
