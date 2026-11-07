# 07 짧은 소년 머리

공통 규칙: [common-rules.md](common-rules.md). 색·윤기는 01과 같다. 앞머리는 **새로 설계**한다(목표 머리의 앞머리를 그대로 쓰지 않음).

## 형태
- 옆 가르마(가르마가 눈썹 위쪽 한쪽으로 치우침), 앞머리는 이마 중간까지만 짧게 내려옴.
- 옆·뒤는 귀 위로 짧게 올라가 **귀가 완전히 보임**. 뒷머리는 목덜미 위에서 짧게 끝남.
- 머리 윗부분은 둥글게, 윤곽은 짧고 덩어리감 있게(투블록 같은 복잡한 면 나눔은 하지 않음). 가닥 표현은 굵은 덩어리 3~4개.

## 프롬프트
**스타일 문장 (한국어)**
```
옆 가르마, 이마 중간까지 짧게 내려오는 앞머리, 귀가 완전히 보이도록 옆과 뒤를 짧게 친 소년 머리. 머리 윗부분은 둥글게 부풀고 굵은 덩어리 서너 개로 단순하게 표현. 뒷머리는 목덜미 위에서 짧게 끝남. 묶음과 장식 없음.
```
**Style sentence (English)**
```
Side part, short bangs reaching mid-forehead, a short boyish cut with sides and back trimmed so the ears are fully visible. Rounded volume on top, simplified into three or four chunky locks. Back ends short above the nape. No ties or accessories.
```
조립: 스타일 문장 + [블록 A] + [블록 B] (+ [블록 C]).

| 시점 | 한국어 | English |
|---|---|---|
| 정면 | 정면. 앞머리 길이와 가르마 위치 | Front view. Bang length and part position |
| 측면 | 정확히 옆. 귀가 드러난 옆머리선 | Exact side view. Hairline exposing the ear |
| 뒤 | 뒤. 짧은 뒷머리선 | Back view. Short back hairline |

## Tripo 입력 조건
- common-rules.md 4절.
- **마네킹 머리에 귀가 있는지**가 중요하다. 귀가 보이는 스타일이라 마네킹 머리에 귀 모양이 있으면 귀가 머리카락과 합쳐질 수 있음. 마네킹 머리는 귀 없는 구로 두고, 귀 위치는 마스터 시트(TODO)의 귀 위치와 맞춰 헤어 쪽 오프닝(비워 둘 곳)만 표시. 이를 3D에서 어떻게 처리할지는 Blender 단계에서 결정(**미확인**).
- 짧은 머리라 머리카락 껍질이 얇음. 두께가 너무 얇으면 3D에서 뚫릴 수 있어 두께감 있는 덩어리로.

## 하지 말 것
- 공통 6절 전부.
- 앞머리를 눈을 덮게 길게 하지 않기(눈 표정 가림).
- 목표 머리의 시스루 앞머리를 가져오지 않기(스타일 구분).
- 뾰족한 가시 머리 금지.

## TODO(치수)
## 치수 (master-sheet.md 기준)
- 귀: z 0.66~0.95, x ±0.20~0.21. 머리카락이 귀 위로 올라가 귀가 드러남.
- 시작선: 눈썹 위, z 약 0.84~0.88 이상(눈썹 위치 미확인). 가르마 위치 수치 **미확인**.
