# 옷 도면 문서 (퐁당)

캐릭터는 "치비 기본 몸 1개 + 머리카락 + 얼굴 + 옷"을 갈아 끼우는 구조다.
이 폴더는 **옷**만 다룬다. 글 설계서이며, 그림은 사용자가 이미지 생성 AI로 만든다.

| 문서 | 내용 |
|---|---|
| [base-outfit.md](base-outfit.md) | 기본 옷(노란 스웨터, 회색 바지, 노란 운동화) 구조 정리 |
| [top.md](top.md) | 상의: 프롬프트, 구도, Tripo 조건, 하지 말 것 |
| [bottom.md](bottom.md) | 하의: 같은 항목 |
| [shoes.md](shoes.md) | 신발: 같은 항목 |
| [outfit-types.md](outfit-types.md) | 비옷·한복·멜빵바지 규격, 색 변경 방식(회색조 마스크) |
| [game-integration.md](game-integration.md) | 기본 몸 뼈대에 붙이는 조건(숨기기, 가중치, 폴리곤) |

## 확인한 것 / 못 한 것

- 확인함: 목표 이미지 `goal_model/귀여운 치비 캐릭터 정면과 측면 시트.png`, `ref/hair_iter/final_front.png`, `final_q3.png`, `shared/src/items.ts`, `client/src/three/character.ts`의 옷 색 지정 부분.
- 반영함: `docs/character/master-sheet.md`(2026-11-06) 3·4·7절 치수. 시트에 없는 값은 미확인으로 남겼다.
- 기준 몸: `base_model/female/female_base.glb`, `male/male_base.glb`(남녀 마네킹, Mixamo 뼈 65개, 각 약 3만 삼각형). 옷은 남녀 공용을 목표로 한다.
- 미확인: Tripo 현재 요금제/입력 규칙의 세부(이미지 1장 vs 다중 뷰 입력 지원 여부 등). 사용 전에 Tripo 화면에서 직접 확인할 것.

## 사용자가 해야 할 일 (요약)

1. 미확인 치수(목 둘레, 소매통, 발 폭, 밑창 두께 등)는 디자인으로 정하거나 몸을 재서 알려준다.
2. 상의 → 하의 → 신발 순서로 각 문서의 프롬프트를 이미지 AI에 넣어 그림을 만든다.
3. 그림이 각 문서의 "합격 체크리스트"를 통과하면 Tripo에 넣는다.
4. 결과 GLB를 받아 알려주면 [game-integration.md](game-integration.md) 조건으로 점검한다.
