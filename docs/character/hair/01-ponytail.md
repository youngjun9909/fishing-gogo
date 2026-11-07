# 01 포니테일 (목표 머리)

공통 규칙: [common-rules.md](common-rules.md). 이 스타일이 **목표 이미지의 머리 그대로**다. 다른 스타일의 기준이므로 가장 먼저 만들고 그림체를 확정한다.

## 형태
- 중앙 가르마, 이마 전체를 덮는 가는 가닥의 둥근 시스루 앞머리(눈썹 바로 위에서 끝남).
- 옆머리: 귀를 반쯤 가리며 턱선까지, 끝이 바깥으로 살짝 말림.
- 정수리 바로 뒤 높은 위치에 짧고 통통한 포니테일(묶음은 머리카락이 감싸는 둥근 덩어리, 꼬리는 위로 솟았다 한쪽 뒤로 휘어 어깨 높이까지, 끝은 가늘게 갈라짐).
- 자세한 관찰은 common-rules.md 1절 참고.

## 프롬프트
**스타일 문장 (한국어)**
```
중앙 가르마, 눈썹 바로 위에서 끝나는 가는 가닥의 둥근 앞머리, 귀를 반쯤 덮고 턱선까지 내려오는 옆머리(끝이 바깥으로 살짝 말림), 정수리 바로 뒤 높은 위치의 짧고 통통한 포니테일(꼬리는 위로 솟았다가 한쪽 뒤로 휘어 어깨 높이에서 끝, 끝은 가늘게 갈라짐). 머리끈 없이 머리카락이 묶음을 감싼 모양.
```
**Style sentence (English)**
```
Center part, rounded bangs of fine strands ending just above the eyebrows, side locks half-covering the ears down to jaw line with tips curling slightly outward, a short plump high ponytail right behind the crown (rises then curves to one side, ends at shoulder height, tip split into fine strands). No hair tie; hair wraps around the base.
```
**조립 순서**: 스타일 문장 + [블록 A] + [블록 B] (+ 지원 시 [블록 C]). 블록은 common-rules.md 3절.

**시점별 추가 문구**
| 시점 | 한국어 | English |
|---|---|---|
| 정면 | 정면에서 본 모습. 앞머리 가르마와 포니테일 윗부분이 머리 위로 보임 | Front view. Part line and top of the ponytail visible above the head |
| 측면 | 정확히 옆(왼쪽을 향함). 포니테일 위치와 꼬리 휘어짐이 보임 | Exact side view facing left. Ponytail position and curve visible |
| 뒤 | 뒤에서 본 모습. 묶음 부분과 꼬리 전체가 보임 | Back view. Ponytail base and full tail visible |

## Tripo 입력 조건
- common-rules.md 4절 + 이 스타일 특이사항:
- 꼬리가 몸통(등)과 겹치지 않도록 어깨선 위에서 끝낼 것. 꼬리 끝 가닥은 3~4갈래 정도만(너무 가늘면 3D에서 끊김).
- 묶음 부분이 머리통과 만나는 곳이 잘 보이는 뒤/측면 이미지를 함께 넣을 것.

## 하지 말 것 (공통 + 이 스타일)
- 공통 6절 전부.
- 머리끈·리본 그리지 않기. 꼬리를 허리까지 길게 만들지 않기.
- 앞머리를 굵은 깃털 모양으로 뾰족하게 만들지 않기(h11의 문제점).
- 포니테일을 머리 아래쪽(목덜미)에 두지 않기(그건 낮은 포니테일이라 다른 스타일).

## TODO(치수)
## 치수 (master-sheet.md 기준)
- 앞머리 끝선: 눈썹 위, 시작선 z 약 0.84~0.88 이상 (눈썹 위치 미확인, 그림 보고 맞춤).
- 꼬리 끝: 어깨선 z 약 0.52~0.56 위. 팔 높이(z 0.51~0.58)·등과 겹치지 않을 것.
- 묶음 높이·꼬리 굵기 수치: **미확인**(마스터 시트에 없음). 머리 높이 0.39, 폭 0.36~0.40과의 비율로 그림에서 판단.
