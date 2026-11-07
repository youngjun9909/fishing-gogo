# 08 곱슬

공통 규칙: [common-rules.md](common-rules.md). 색·윤기는 01과 같다. 형태는 **새로 설계**한다.

## 형태
- 가르마 없음(또는 불분명). 앞머리는 이마 위쪽만 덮는 짧은 곱슬 덩어리.
- 머리 전체가 **둥글고 큰 컬 덩어리**들로 이루어져 머리통보다 크게 부풀음(구름 같은 실루엣). 길이는 턱선~목덜미 위.
- 컬은 **큼직한 나선 덩어리 8~12개**로 단순화. 아주 작은 컬을 많이 그리지 않음.
- 귀는 컬에 대부분 가려짐.

## 프롬프트
**스타일 문장 (한국어)**
```
머리 전체가 크고 둥근 컬 덩어리들로 부풀어 구름처럼 둥근 실루엣을 이루는 곱슬머리. 이마 위쪽만 덮는 짧은 컬 앞머리, 길이는 턱선~목덜미 위. 큼직한 나선 컬 덩어리 8~12개로 단순하게 표현하고 작은 컬을 많이 그리지 않음. 귀는 컬에 대부분 가려짐. 묶음과 장식 없음.
```
**Style sentence (English)**
```
Curly hair made of big round curl clumps that puff out into a cloud-like round silhouette. Short curly bangs covering only the upper forehead, length from jaw line to above the nape. Simplified into 8-12 chunky spiral curl masses, no tiny curls. Ears mostly hidden by curls. No ties or accessories.
```
조립: 스타일 문장 + [블록 A] + [블록 B] (+ [블록 C]).

| 시점 | 한국어 | English |
|---|---|---|
| 정면 | 정면. 둥근 구름 실루엣 | Front view. Round cloud silhouette |
| 측면 | 정확히 옆. 머리통 뒤로 부푼 정도 | Exact side view. How far it puffs behind the head |
| 뒤 | 뒤. 컬 덩어리 배치 | Back view. Layout of curl masses |

## Tripo 입력 조건
- common-rules.md 4절.
- 컬이 **서로 붙은 덩어리**여야 3D에서 하나의 껍질로 나옴. 컬 사이에 구멍이 뚫려 보이는 그림은 피함.
- 부풀음이 너무 크면 치비 몸(어깨)과 겹침. 어깨선 안쪽으로 부풀음 한계를 둠.
- 곱슬 질감은 그림에서 덩어리 모양으로만 표현하고, 텍스처로는 단순한 회색조 결(5절) 유지.

## 하지 말 것
- 공통 6절 전부.
- 아프로처럼 지나치게 크게 부풀리지 않기(머리 폭의 약 1.5배 이내를 목표, 눈대중·확정 아님).
- 가느다란 스프링 모양 컬 금지(3D에서 끊김).
- 컬마다 하이라이트 점을 넣지 않기(색 변경 마스크 방해).

## TODO(치수)
## 치수 (master-sheet.md 기준)
- 머리 반폭 0.18~0.20, 귀 끝 반폭 0.21 기준. 부풀음 최대 폭 수치는 **미확인**(임시: 머리 폭의 1.5배 이내).
- 아래쪽 끝은 목 위(z 0.62 이상)~어깨선(z 0.52~0.56) 위. 팔과 겹치지 않을 것.
