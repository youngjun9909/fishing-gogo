# 남자 머리카락 4종 배치 기록 (남자 마네킹 기준)

> 사용자가 Blender에서 직접 맞춘 값(2026-11-07). 파일: `base_model/hair_male_fit.blend`. 원본 Tripo: `short brown hair 3d model.glb`(4개가 한 메시, 2×2).
> 위치는 마네킹 원점 기준 상대값(m). 회전은 모두 0.

| 물체 | 스타일 | x | y | z | 크기 |
|---|---|---|---|---|---|
| `Hair_M1_wavy` | 복실한 웨이브 펌 | 0.0326 | -0.0474 | 0.8916 | 0.9575 |
| `Hair_M2_sidepart` | 가르마 | -0.0161 | -0.0691 | 0.8896 | 1.0864 |
| `Hair_M3_bangs` | 덮은 앞머리 | 0.0068 | -0.0036 | 0.8724 | 0.9692 |
| `Hair_M4_messy` | 헝클머리 | 0.0034 | -0.0444 | 0.9026 | 1.0761 |

(2026-11-07 두 번째 맞춤 반영. 파일 `base_model/hair_male_fit_color.blend`. 뒤통수 껍질(뒷머리만 칠함)과 뒤쪽 가닥은 각 머리카락 물체에 합쳐져 있다.)

- 게임 파일: `client/public/models/hair_m1_wavy.glb` ~ `hair_m4_messy.glb`(마네킹 좌표로 위치를 구워 내보냄, 텍스처 2048). `character.ts`의 `HAIR_FILES_M`이 읽고, 성별이 남자일 때 `hair % 4` 번째를 쓴다.
- 색은 갈색 한 가지(머리색 선택으로 바뀌지 않음).
- 스크립트: `base_model/make_male_hair_fit.py`(분할·초기 배치), `export_male_hair.py`(내보내기).
