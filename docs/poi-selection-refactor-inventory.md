# selectionPipeline 재작성 전 정리 — 유지 / 교체 / 제거

> 목적: [selectionPipeline.js](../grandma-tour-back/features/poi/selectionPipeline.js)를 뜯기 전에
> **무엇을 살리고 무엇을 버릴지**, 그리고 **뜯으면 무엇이 깨지는지**를 먼저 확정한다.
> 기준 명세: [poi-selection-spec.md](./poi-selection-spec.md)

## 0. 책임 경계 — `selectionPipeline` vs CP-SAT

전제를 바꾸는 결정이라 맨 앞에 둔다.

```
TourAPI 지역 POI 수십 개
        ↓
  selectionPipeline      ← 이 파일의 책임
  운영 거점 4~5개 확정
        ↓
  가이드 배치            ← 별도 단계 (파이프라인 밖)
        ↓
  사용자 설문
        ↓
  CP-SAT                 ← 추천기
  4~5개 중 방문 2~3개 + 순서 결정
```

**`selectionPipeline` 이 답하는 질문**: "이 지역에서 실제로 어떤 4~5곳에 가이드를 상주시킬 것인가"
**CP-SAT 이 답하는 질문**: "이미 가이드가 배치된 거점 중 이 사용자가 어디를 어떤 순서로 갈 것인가"

따라서 아래는 **파이프라인 책임**이다.

- 운영 거점 4~5개 선정 (개수, 선정 기준)
- 거점 후보의 데이터 품질 판정

아래는 **CP-SAT 책임**이므로 파이프라인에서 제거한다.

- 방문 순서 (`visitOrder`)
- 120분 투어 예산 소진 (`tourBudgetMin` greedy)
- 사용자 선호 기반 방문지 압축

> CP-SAT 은 입력을 **이미 존재하는 체험 포인트 집합**으로 전제한다.
> 그 집합을 만드는 것이 파이프라인이며, 이 책임을 CP-SAT 으로 넘기면
> "누가 거점을 정하는가"가 사라진다.

## 0-1. [RESOLVED] 공간 범위 정책 → 이동시간 그래프

기존 §5-1 의 열린 결정. **반경 방식을 버리고 이동시간 기반으로 간다.**

| 후보 | 판정 | 이유 |
|---|---|---|
| (a) 시군구 전체를 후보로 두고 CP-SAT 에 위임 | 기각 | 거점 4~5개를 누가 고르는지가 사라짐 (§0) |
| (b) 반경을 실측 기반으로 확대 (15/25km 등) | 기각 | 임의값 2.5km 를 다른 임의값으로 교체할 뿐. 청송은 중심 위치에 따라 결과가 크게 흔들림 |
| **(c) 이동시간 그래프 기반 후보군 구성** | **채택** | Kakao 로 이미 확보하는 데이터와 직결. "120분 내 연결 가능한 지역 거점"이라는 서비스 요구에 가장 근접 |

**DBSCAN 등 군집 알고리즘은 쓰지 않는다.** `eps`, `minPts` 같은 근거 없는 공간
파라미터를 새로 만들게 되어 2.5km 문제를 이름만 바꿔 반복하는 꼴이 된다.

```
청송 POI 전체 → TourAPI 보강 → 운영 후보만 남김
    → Kakao travel_time[i][j] → 이동시간 그래프
    → 서로 현실적으로 연결되는 POI 집합 탐색 → 거점 4~5개
```

### [RESOLVED] 권역 기준 = **이동시간 15분**

2026-08-13 청송군 실측 → **[poi-selection-observations.md](./poi-selection-observations.md)**

| 근거 | 값 |
|---|---|
| 상한 | **20분에서 청송 전체(47개)가 한 덩어리** → 그 이상은 구분력 0 |
| 하한 | 3분에서 21덩어리로 부서지고 11개 고립 |
| **채택 15분** | 4개 권역, 최대 39개, 이웃 3개 이상 POI 44개 |

제안서의 2.5km 는 40km/h 환산 시 약 4분으로, 틀렸다기보다 **너무 잘게 쪼개** 거점을
정할 수 없는 값이었다.

구현: `REGION_THRESHOLD_MIN` (환경변수 `POI_REGION_THRESHOLD_MIN` 로 조정 가능).
다른 시군구에서 15분이 안 맞을 수 있으므로 STEP 6 은 `byThreshold` 관측표를 계속 낸다.

## 1. 현재 구성요소별 처분

| # | 구성요소 | 처분 | 근거 / 이동처 |
|---|---|---|---|
| 1 | `haversineKm()` | **이동** | `travelTimeService.haversineKm` 에 이미 있음. 중복 제거 |
| 2 | `DEFAULT_DURATION` 맵 | **이동** | `durationResolver.POLICY_DURATION` 으로 옮겨감 |
| 3 | `CONTENT_TYPE_LABEL` 맵 | **유지** | 화면 표시용. 판단에 안 쓰임 |
| 4 | `deriveKeywords()` 정규식 | **제거** | 이름으로 키워드를 추측하던 코드. `keywordMapper`(cat3 기반)로 대체 — **단 `categoryCode2` 응답 확보 전까지 보류** |
| 5 | `keywordsForPoi()` | **제거** | 위와 동일 |
| 6 | `GUIDE_POOL` 가짜 이름 10개 | **분리** | 선정 로직과 무관. 가이드 등록 흐름이 정해질 때까지 파이프라인 밖으로 |
| 7 | STEP 1 수집 | **교체** | `tourApiClient.getLocationPois()` + `poiNormalizer.normalizeList()` |
| 8 | STEP 2 정제 (좌표/중복) | **유지** | 로직 그대로. 단 `poi.lat/lon` → `latitude/longitude` 필드명 변경 |
| 9 | STEP 3 중심좌표 3단 폴백 | **제거** | 중심 반경 방식을 버렸으므로 "중심" 개념 자체가 불필요 (§0-1) |
| 10 | STEP 4 인기도(데이터랩) | **제거** | 존재하지 않는 API. 대표성 지표로 대체 |
| 11 | STEP 4 `durationMin` 부여 | **교체** | `durationResolver.applyDuration()` |
| 12 | STEP 5 반경 필터 (2.5km) | **제거** | §0-1 결정. 이동시간 그래프로 대체 |
| 13 | STEP 5 "후보 부족 시 반경 확대" | **제거** | 반경이 없으면 확대할 대상도 없음 |
| 14 | STEP 6 점수화 4항목 | **제거** | 40/36/20/6 배점에 근거 없음. 인기도 항목은 원천 API 부재 |
| 15 | STEP 7 greedy 다양성 | **보류** | 거점 선정 *기준*이 미확정 (§0-1 OPEN). 기준이 정해질 때까지 삭제도 확정 못 함 |
| 16 | STEP 7 120분 예산 컷 | **제거** | 사용자 단위 제약 → CP-SAT 소관 (§0) |
| 17 | STEP 7 "거점 4~5개 선정" **책임** | **유지 (개수만 수정)** | 파이프라인의 존재 이유 (§0). 2~3개 → 4~5개 |
| 18 | STEP 7 `visitOrder` / `assignedGuide` | **제거** | 순서는 CP-SAT 출력, 가이드 배치는 별도 단계 (§0) |
| 19 | `steps[]` trace 구조 | **유지** | 관리자 화면이 이 형태에 결합돼 있음 (§2 참조) |
| 20 | `GYEONGBUK_SIGUNGU` re-export | **유지** | `controller.js` 가 씀 |

### 파이프라인 밖에서 함께 정리할 것

| 위치 | 처분 | 근거 |
|---|---|---|
| `dataLabClient.js` | **파일 삭제** | 존재하지 않는 API를 향한 클라이언트. `deterministicScore` 난수 포함 |
| `controller.js` 의 `parseUseTime()` | **제거** | `operatingHoursParser` 로 대체. 게다가 `usetime` 만 봐서 4개 타입 중 3개를 못 읽던 코드 |
| `controller.js` 의 `enrichSelected()` | **이동** | 상세 보강을 "선정 후"가 아니라 "선정 전"(STEP 6)으로 옮김 |
| `kakaoClient.js` | **보강** | 429(쿼터 소진)를 다른 에러와 구분 (spec STEP 1) |
| `mockData.js` | **보강** | `cat1/2/3`, `firstimage2` 없음. keywordMapper·대표성 검증에 필요 |

---

## 2. 깨지면 안 되는 계약

### 2-1. 관리자 화면 → `steps[]` trace

[AdminRegionAdd.jsx](../grandma-tour-front/src/pages/AdminRegionAdd.jsx)의 `procMeta()`가
**`step.id` 로 switch 한다.** 아래 7개 id 와 metrics 키를 바꾸면 화면이 조용히 깨진다.
(이 파일은 `feature/admin-region-ui` 브랜치에 있어 현재 브랜치에서는 보이지 않는다.)

| `step.id` | 화면이 읽는 `metrics` 키 |
|---|---|
| `collect` | `rawCount` |
| `clean` | `droppedNoCoord`, `droppedDuplicate`, `after` |
| `center` | (없음) |
| `enrich` | (없음) |
| `cluster` | `radiusKm`, `inRadius` ← §0-1 로 의미가 바뀜. 아래 주의 |
| `score` | `scoredCount` |
| `select` | `selected` |

그 외 step 은 `default` 로 떨어져 `step.title` / `step.summary` 를 그대로 쓴다.

> **결론**: 새로 추가되는 단계(상세 보강, 타당성 검증, 이동시간)는 **새 id 를 쓰면 안전하다**
> — default 분기로 흘러가 `title`/`summary` 가 표시된다.
> 반대로 기존 7개 id 를 없애거나 metrics 키 이름을 바꾸면 `undefined` 가 화면에 뜬다.
> `enrich` 는 이름을 유지하되 내용만 인기도→대표성으로 바꾸는 것이 가장 안전하다.

> **`cluster` 주의**: §0-1 결정으로 이 단계는 "반경 판정"이 아니라 "이동시간 구조 분석"이 된다.
> `step.id` 는 보존해야 화면이 안 깨지지만, `metrics.radiusKm` / `inRadius` 는 더 이상
> 의미 있는 값이 아니다. 화면 쪽을 함께 고치거나, 고치기 전까지는 대응되는 값
> (예: 관측 threshold, 그 안에서 연결된 POI 수)을 같은 키에 담아야 한다. → **[OPEN]**

### 2-2. 관리자 화면 → 선정 결과 POI

화면이 읽는 필드: `name`, `score`, `keywords`, `assignedGuide`, `visitOrder`

> **[OPEN] 이 중 3개가 파이프라인 출력에서 사라진다.**
> `score` (점수화 제거), `assignedGuide` (가이드 배치가 별도 단계), `visitOrder` (CP-SAT 출력).
> 화면에 `undefined` 가 뜬다. 파이프라인을 되돌릴 문제가 아니라 **화면 쪽 대응이 필요한
> 항목**이므로, `feature/admin-region-ui` 와 합류할 때 함께 처리한다.

### 2-3. `repository.commitSelection()` → POI

(`feature/poi-commit` 브랜치) 가 읽는 필드:

```
poi.name  poi.description  poi.addr  poi.image
poi.durationMin  poi.openMin  poi.closeMin
poi.keywords  poi.assignedGuide
```

---

## 3. [RESOLVED] 필드 명명 규칙 충돌 → A. 경계에서 변환

새로 만든 모듈들은 **snake_case** 를 쓴다 (DB 컬럼과 일치):

```
content_id  content_type_id  latitude  longitude
duration_min  open_windows  image_url  address
```

기존 파이프라인·repository·화면은 **camelCase** 다:

```
contentId  lat  lon  durationMin  openMin  closeMin  image  addr
```

단순 이름 문제가 아닌 것이 하나 있다:
**`openMin`/`closeMin`(스칼라 2개) ↔ `open_windows`(구간 배열)** 는 구조가 다르다.
새 파서는 다중 구간(`09:00~12:00, 13:00~18:00`)을 표현할 수 있고, "못 읽음"을 `null` 로 구분한다.
DB 스키마는 `open_min`/`close_min` 스칼라뿐이므로 **어딘가에서 구간을 하나로 줄여야 한다.**

**후보**

- **A. 경계에서 변환 (권장)** — 파이프라인 내부는 snake_case + `open_windows` 유지,
  controller 응답과 repository 저장 직전에만 기존 형태로 변환.
  화면·DB 계약을 건드리지 않아 가장 안전하다.
- **B. 새 모듈을 camelCase 로 되돌림** — 구조 차이(`open_windows`)는 여전히 남아 해결이 안 된다.
- **C. 화면·DB 까지 snake_case 로 통일** — 가장 깔끔하지만 상위 브랜치와 스키마를 함께 고쳐야 한다.

**결정: A.** 파이프라인 내부는 snake_case + `open_windows` 를 그대로 유지하고,
`controller` 응답과 `repository` 저장 **직전에만** 기존 형태로 변환한다.

- 이미 만든 5개 모듈(`poiNormalizer`, `operatingHoursParser`, `durationResolver`,
  `travelTimeService`, `kakaoRouteClient`)을 수정하지 않는다.
- 화면·DB 계약을 건드리지 않는다.
- 변환은 `toLegacyShape()` 한 곳에 모은다 — 나중에 C(전체 통일)로 갈 때 이 함수만 지우면 된다.

### `open_windows` → `open_min`/`close_min` 축약 정책 — **보류**

STEP 1~6 은 `open_windows` 배열을 그대로 들고 다니므로 **지금 정하지 않아도 착수 가능**하다.
`repository.commitSelection()` 을 붙이는 시점에 결정한다.

> 그때 따져야 할 것: 최소 `start`~최대 `end` 로 줄이면 점심 휴게시간이 '영업 중'으로
> 잘못 표시되고, 첫 구간만 쓰면 오후 방문 가능한 곳이 불가능으로 판정된다.
> 세 번째 선택지로 DB 컬럼 자체를 JSONB 배열로 바꾸는 안도 있다(`feature/db-setup` 마이그레이션 필요).

---

## 4. 재작성 후 `selectionPipeline.js` 의 모습

계산을 직접 하지 않고 모듈을 순서대로 호출하는 **orchestrator** 가 된다.

| STEP | 하는 일 | 쓰는 모듈 | 지금 구현 가능? |
|---|---|---|---|
| 1 | 지역 POI 수집 | `tourApiClient.getAreaPois` | ✅ |
| 2 | 정규화 + 중복/품질 확인 | `poiNormalizer.normalizeList` | ✅ |
| 3 | 상세 보강 (운영시간·duration·접근성) | `getDetailCommon/Intro/Images` + `operatingHoursParser` + `durationResolver` | ✅ (키워드·무장애 제외) |
| 4 | 운영 후보 판정 `valid` / `needs_review` / `unavailable` | 파이프라인 자체 로직 | ✅ |
| 5 | travel matrix 생성 | `travelTimeService.buildTravelMatrix` (Kakao → 40km/h fallback) | ✅ |
| 6 | 이동시간 기반 공간 구조 **분석** | 파이프라인 자체 로직 | ✅ **단 판정 없음 — 분포만 trace** |
| 7 | 운영 거점 4~5개 선정 | 파이프라인 자체 로직 | ❌ **선정 기준 미확정** |

**OUTPUT**: POI 4~5개 + provenance + trace

### STEP 6 의 성격

threshold 를 확정하지 않는다. 이 단계의 산출물은 판정이 아니라 **분포 관측치**다.

```
metrics: {
  pairCount, minMin, p25Min, medianMin, p75Min, maxMin,
  provider: { kakao: n, fallback_40kmh: m },
  reachableCountByThreshold: { 15: n, 20: n, 30: n, 45: n, 60: n }
}
```

마지막 키가 핵심이다 — 여러 threshold 를 **동시에 찍어보기만** 하고 어느 것도 코드에
박지 않는다. 이 출력을 보고 "4~5개 조합이 성립하는 구간"을 사람이 판단한다 (§0-1 OPEN).

### 보류 슬롯

| 자리 | 대기 사유 |
|---|---|
| STEP 3 키워드 (`keywordMapper`) | `categoryCode2` 응답 확보 전까지 `keywords: null` 로 통과 |
| STEP 3 무장애 (`withTourApiClient`) | 활용신청 승인 대기. `accessibility.barrier_free: null` 로 통과 |
| STEP 7 선정 기준 | STEP 6 관측 결과 필요 |

## 5. 착수 전 정리돼야 할 것

| # | 항목 | 상태 |
|---|---|---|
| 1 | 공간 범위 정책 (반경 2.5km) | ✅ **해결** → 이동시간 그래프 (§0-1) |
| 2 | 필드 명명 규칙 | ✅ **해결** → A. 경계에서 변환 (§3) |
| 2-1 | `open_windows` 축약 정책 | ⬜ 보류 — DB 저장 붙일 때 (§3) |
| 3 | `keywordMapper` | ✅ **완료** — 5개 카테고리, 4개 시군구 551건 100% 매핑 ([keyword-mapping-facts.md](./keyword-mapping-facts.md)) |
| 3-1 | 쇼핑(`contentTypeId=38`) 수집 여부 | ⬜ **보류** — 넣지 않으면 `시장·지역생활` 이 계속 0건 |
| 3-2 | `AC050100 일반야영장` 폴백 충돌 | ⬜ **보류** — B-2(폴백) vs B-4(미매핑) 상충, 청송 1건 |
| 4 | `withTourApiClient` — 무장애 API 활용신청 필요 | ⬜ 활용신청 대기 |
| 5 | 권역 기준(threshold) | ✅ **15분 확정** ([observations §3](./poi-selection-observations.md)) |
| 5-1 | 거점 선정 기준 (STEP 7) | ✅ **구현 완료** — Pareto 커버리지 분해 ([observations §10](./poi-selection-observations.md)) |
| 5-2 | 거점 간 **최소 이격** 기준 | ⬜ **다음 작업** — 없으면 4개가 같은 장소로 뽑힌다 |
| 6 | 화면 계약 — 사라지는 `score`/`assignedGuide`/`visitOrder` | ⬜ `feature/admin-region-ui` 합류 시 (§2-2) |

> **1·2 가 해결되어 STEP 1~6 재작성에 착수할 수 있다.**
> 3·4 는 자리를 비워둔 채 통과시키고, 5 는 STEP 6 이 돌아야 판단할 수 있으며,
> 2-1·6 은 각각 DB·화면을 붙이는 시점의 문제다.
