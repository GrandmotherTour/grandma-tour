# Jaturip Backend API / Recommendation Notes

## 현재까지 개발/수정 진행 요약

이 문서는 현재 JATURIP 프로젝트에서 백엔드 실행 환경, 추천 API 연결, React 프론트엔드 웹앱, 테스트 자동화까지 반영된 내용을 파트별로 정리합니다.

### 1. 실행 환경 정리

Windows PowerShell에서 기존 `npm run dev` 실행 시 `npm.ps1` 실행 정책 문제와 `tsx watch`의 `uv_os_get_passwd returned ENOMEM` 오류가 발생했습니다.

이를 피하기 위해 시스템 Node를 직접 교체하지 않고, 프로젝트 내부에 portable Node LTS를 설치해 이 프로젝트의 실행 스크립트가 고정 버전을 사용하도록 정리했습니다.

| 항목 | 내용 |
| --- | --- |
| 사용 Node | `v22.22.0` |
| 설치 위치 | `.tools/node-v22.22.0-win-x64/` |
| 백엔드 실행 | `npm.cmd run dev` |
| 백엔드 빌드 | `npm.cmd run build` |
| 버전 확인 | `npm.cmd run node:version` |

백엔드 `package.json` scripts:

```json
{
  "dev": ".\\.tools\\node-v22.22.0-win-x64\\node.exe scripts/dev-runner.cjs",
  "build": ".\\.tools\\node-v22.22.0-win-x64\\node.exe .\\node_modules\\typescript\\bin\\tsc",
  "start": ".\\.tools\\node-v22.22.0-win-x64\\node.exe dist/server.js",
  "node:version": ".\\.tools\\node-v22.22.0-win-x64\\node.exe --version"
}
```

### 2. 백엔드 Dev Runner

`tsx watch`가 현재 Windows 환경에서 정상 동작하지 않아, TypeScript를 빌드한 뒤 컴파일된 서버를 실행하는 개발용 runner를 추가했습니다.

| 파일 | 역할 |
| --- | --- |
| `scripts/dev-runner.cjs` | `tsc` 빌드 후 `dist/server.js` 실행 |
| `src/server.ts` | Express 앱을 `PORT=4000`에서 실행 |
| `.gitignore` | `.tools/`, `node_modules/`, `dist/`, `.env` 제외 |

현재 백엔드는 아래 주소에서 실행됩니다.

```text
http://localhost:4000
```

헬스 체크:

```text
GET /api/health
```

정상 응답:

```json
{
  "status": "ok",
  "service": "jaturip-backend",
  "message": "Service is healthy"
}
```

### 3. 추천 API Route 연결

기존 `POST /api/recommendation` 라우트는 요청 본문을 그대로 echo하는 stub 상태였습니다.

현재는 기존 `recommendationService.buildRecommendation()`을 호출하도록 연결했습니다.

| 파일 | 변경 내용 |
| --- | --- |
| `src/routes/recommendation.routes.ts` | `recommendationService.buildRecommendation(req.body)` 호출 |
| `src/routes/recommendation.routes.ts` | async 오류를 `next(error)`로 넘기도록 처리 |
| `src/services/recommendation.service.ts` | 기존 추천 엔진 입력 변환 로직 사용 |

추천 API endpoint:

```text
POST /api/recommendation
```

현재 백엔드가 기대하는 주요 payload:

```js
{
  currentLatitude,
  currentLongitude,
  nextScheduleTime,
  nextScheduleLatitude,
  nextScheduleLongitude,
  peopleCount,
  transportMode,
  swipeFeedbacks
}
```

`swipeFeedbacks`는 백엔드 타입에 맞춰 아래 구조를 사용합니다.

```js
{
  cardId,
  action,
  tags
}
```

### 4. React Frontend 생성

기존 frontend 폴더가 없어 `frontend/` 아래에 React + Vite + JavaScript 기반 웹앱을 새로 추가했습니다.

| 항목 | 내용 |
| --- | --- |
| Framework | React |
| Bundler | Vite |
| Language | JavaScript |
| Routing | React Router |
| Styling | 일반 CSS |
| State | React Context + `useState` |

Frontend scripts:

```json
{
  "dev": "..\\.tools\\node-v22.22.0-win-x64\\node.exe scripts\\dev-preview.cjs",
  "build": "..\\.tools\\node-v22.22.0-win-x64\\node.exe .\\node_modules\\vite\\bin\\vite.js build --configLoader native",
  "preview": "..\\.tools\\node-v22.22.0-win-x64\\node.exe .\\node_modules\\vite\\bin\\vite.js preview --configLoader native --host 0.0.0.0 --port 5173",
  "test:interactions": "..\\.tools\\node-v22.22.0-win-x64\\node.exe scripts\\interaction-test.cjs"
}
```

현재 프론트는 아래 주소에서 실행됩니다.

```text
http://localhost:5173
```

주의: 현재 Windows sandbox 환경에서는 Vite raw dev optimizer가 상위 디렉터리 접근 오류를 내기 때문에, `frontend`의 `npm.cmd run dev`는 build 후 Vite preview를 실행하는 방식으로 구성했습니다.

### 5. Frontend 폴더 구조

```text
frontend/
├─ index.html
├─ package.json
├─ package-lock.json
├─ scripts/
│  ├─ dev-preview.cjs
│  └─ interaction-test.cjs
└─ src/
   ├─ App.jsx
   ├─ main.jsx
   ├─ api/
   │  └─ recommendationApi.js
   ├─ components/
   │  ├─ AlternativeCourseCard.jsx
   │  ├─ AppHeader.jsx
   │  ├─ AvailableTimeSelector.jsx
   │  ├─ CourseMap.jsx
   │  ├─ CourseSummary.jsx
   │  ├─ CourseTimeline.jsx
   │  ├─ LoadingOverlay.jsx
   │  ├─ LocationInput.jsx
   │  ├─ PeopleCounter.jsx
   │  ├─ SwipeActions.jsx
   │  ├─ SwipeCard.jsx
   │  ├─ TimeSelector.jsx
   │  └─ TransportSelector.jsx
   ├─ context/
   │  └─ JaturipContext.jsx
   ├─ mocks/
   │  └─ recommendationMock.js
   ├─ pages/
   │  ├─ InputPage.jsx
   │  ├─ PreferencePage.jsx
   │  └─ ResultPage.jsx
   ├─ styles/
   │  └─ global.css
   └─ utils/
      ├─ preferences.js
      └─ time.js
```

### 6. 사용자 Flow 구현

로그인, 회원가입, 마이페이지 없이 일회성 추천 flow만 구현했습니다.

```text
Input Page
→ Preference Swipe Page
→ Loading
→ Recommendation Result Page
```

React Router 구조:

| Route | Page | 역할 |
| --- | --- | --- |
| `/` | `InputPage` | 추천 조건 입력 |
| `/preference` | `PreferencePage` | 취향 카드 평가 |
| `/result` | `ResultPage` | 추천 결과 확인 |

### 7. Input Page

첫 화면에서 아래 값을 실제 입력 가능한 UI로 받습니다.

| 입력 항목 | 구현 방식 | 내부 state |
| --- | --- | --- |
| 현재 위치 | 텍스트 입력 + 임시 좌표 입력 | `{ name, lat, lng }` |
| 다음 일정 장소 | 텍스트 입력 + 임시 좌표 입력 | `{ name, lat, lng }` |
| 다음 일정 시간 | `input type="time"` | `nextScheduleTime` |
| 코스 할애 시간 | preset 버튼 + range | `availableMinutes` |
| 인원수 | `- / +` 버튼 | `peopleCount` |
| 이동방법 | 도보/차량 선택 카드 | `walk` / `car` |

필수값 validation:

```text
currentLocation
nextScheduleLocation
nextScheduleTime
availableMinutes
peopleCount
transportMode
```

누락 시 각 입력 영역 아래에 오류 메시지를 표시합니다.

### 8. Preference Swipe Page

취향 태그는 6개로 고정했습니다.

```text
cafe
food
nature
culture
history
activity
```

화면 표시:

| Tag | Label |
| --- | --- |
| `cafe` | 카페·디저트 |
| `food` | 맛집·먹거리 |
| `nature` | 산책·자연 |
| `culture` | 전시·문화 |
| `history` | 역사·전통 |
| `activity` | 체험·놀거리 |

Interaction:

| 동작 | 처리 |
| --- | --- |
| 좋아요 | `like = +1` |
| 싫어요 | `dislike = -1` |
| Skip | `skip = 0` |
| 좌우 swipe | threshold 기준 좋아요/싫어요 처리 |
| 버튼 fallback | swipe가 안 되는 환경에서도 동일 처리 |

외부 이미지 URL은 테스트 환경에서 차단될 수 있어, 현재는 CSS gradient 기반 visual placeholder를 사용합니다.

### 9. Swipe 결과 및 Preference Weight

`JaturipContext`에서 아래 구조로 관리합니다.

```js
{
  cafe: {
    likeCount: 0,
    dislikeCount: 0,
    skipCount: 0,
    exposureCount: 0
  }
}
```

계산식:

```text
preferenceWeight =
(likeCount - dislikeCount)
/
(exposureCount + 1)
```

계산 위치:

| 파일 | 역할 |
| --- | --- |
| `src/utils/preferences.js` | tag 정의, empty result 생성, weight 계산 |
| `src/context/JaturipContext.jsx` | swipe 결과와 계산된 weight 보관 |
| `src/pages/PreferencePage.jsx` | 마지막 swipe 직후 최신 snapshot으로 추천 요청 |

### 10. Recommendation API / Mock Fallback

프론트 추천 요청은 API 모듈 하나로 분리했습니다.

| 파일 | 역할 |
| --- | --- |
| `src/api/recommendationApi.js` | 백엔드 payload 변환 및 `POST /api/recommendation` 호출 |
| `src/mocks/recommendationMock.js` | 백엔드가 코스를 반환하지 않을 때만 mock course 생성 |

실제 API 호출은 항상 먼저 수행합니다.

```text
POST http://localhost:4000/api/recommendation
```

현재 백엔드 추천 API가 후보 데이터를 받지 못해 `recommendations`가 비어 있으면, 프론트는 service flow 검증을 위해 mock fallback을 사용합니다.

API 실패 시:

```text
추천 코스를 불러오지 못했어요.
잠시 후 다시 시도해주세요.
```

`다시 시도` 버튼으로 동일 요청을 재시도합니다.

### 11. Result Page

결과 화면은 desktop과 mobile 레이아웃을 분리했습니다.

Desktop:

```text
추천 코스
├─ MAP placeholder
└─ COURSE TIMELINE

추천 이유 / Summary / 대안 코스
```

Mobile:

```text
MAP
→ COURSE
→ 추천 이유
→ 대안 코스
```

현재 Kakao Map 프론트 코드가 없어서 `CourseMap`은 빈 박스 대신 코스 point 이름과 순서를 marker 형태로 보여주는 placeholder UI를 구현했습니다.

결과 화면에 표시하는 핵심 정보:

```text
총 코스 소요시간
이동시간
체류시간
남은 slackMinutes
다음 일정 예상 도착시간
PreferenceTag
추천 이유
대안 코스
```

대안 코스의 `이 코스 보기` 버튼은 실제로 현재 main course를 교체합니다.

### 12. CSS / Responsive

CSS는 `frontend/src/styles/global.css`에 정리했습니다.

CSS variable:

```css
:root {
  --color-primary: #1f7a68;
  --color-primary-dark: #15584c;
  --color-background: #f5f8f6;
  --color-surface: #ffffff;
  --color-surface-soft: #edf5f1;
  --color-text: #17211d;
  --color-muted: #6b7772;
  --color-border: #d8e2dd;
  --color-success: #1f8f5f;
  --color-danger: #c44d4d;
}
```

반응형 기준:

| Width | 처리 |
| --- | --- |
| Desktop 1440px | map + timeline 2단 |
| Tablet 768px | 주요 grid 1단 전환 |
| Mobile 390px | 세로 배치, 큰 터치 버튼, 가로 스크롤 방지 |

버튼/선택 UI 상태:

```text
default
hover
active
disabled
selected
```

### 13. 테스트 자동화

실제 Chrome headless를 제어하기 위해 `playwright-core`를 dev dependency로 추가했습니다.

| 파일 | 역할 |
| --- | --- |
| `frontend/scripts/interaction-test.cjs` | 실제 UI 클릭/입력/스와이프/라우팅 테스트 |

실행:

```powershell
cd frontend
..\.tools\node-v22.22.0-win-x64\npm.cmd run test:interactions
```

검증한 시나리오:

```text
1. 앱 실행
2. 필수 입력 validation 표시
3. 현재 위치 입력
4. 다음 일정 장소 입력
5. 다음 일정 시간 선택
6. 코스 할애 시간 선택
7. 인원수 +/- 버튼 동작
8. 도보/차량 선택
9. 다음 버튼 클릭
10. Preference Page 이동
11. 6개 카테고리 좋아요/싫어요/Skip 동작
12. swipe gesture 및 버튼 fallback 동작
13. preferenceWeight 계산 흐름 반영
14. 추천 요청 발생
15. Loading UI 표시
16. Recommendation Result 표시
17. 대안 코스 선택 버튼 동작
18. 다시 추천받기 버튼 동작
19. 조건 수정 버튼 동작
20. 입력 state 유지
21. 새로고침 시 치명적 오류 없음
22. 모바일 390px에서 가로 스크롤 없음
23. API 실패 error UI 표시
24. API 실패 상태에서 다시 시도 버튼 동작
```

최종 테스트 결과:

```text
desktop-1440: app opened
desktop-1440: validation shown
desktop-1440: inputs and selectors changed
desktop-1440: moved to preference
desktop-1440: preference buttons and swipe gesture completed
desktop-1440: result summary visible
desktop-1440: alternative course selected
desktop-1440: retry recommendation clicked
desktop-1440: edit conditions retained input state
desktop-1440: reload did not crash
mobile-390: app opened
mobile-390: validation shown
mobile-390: inputs and selectors changed
mobile-390: moved to preference
mobile-390: preference buttons and swipe gesture completed
mobile-390: result summary visible
mobile-390: alternative course selected
mobile-390: retry recommendation clicked
mobile-390: edit conditions retained input state
mobile-390: reload did not crash
mobile-390: no horizontal scroll
api-error: error state visible
api-error: retry button handled failed request
```

### 14. 현재 한계 및 다음 작업

아직 실제 연동되지 않은 부분:

```text
Kakao 장소 검색 자동완성
Kakao Map 실제 지도 marker
백엔드 후보 수집 API와 실데이터 기반 추천
최종 Figma 디자인 적용
```

추후 Figma 디자인 적용 시 주로 교체할 파일:

| 영역 | 교체/수정 파일 |
| --- | --- |
| 전체 visual style | `frontend/src/styles/global.css` |
| 입력 화면 layout | `frontend/src/pages/InputPage.jsx` 및 입력 components |
| 취향 카드 디자인 | `frontend/src/components/SwipeCard.jsx`, `SwipeActions.jsx` |
| 결과 화면 layout | `frontend/src/pages/ResultPage.jsx` |
| 지도 UI | `frontend/src/components/CourseMap.jsx` |
| Timeline UI | `frontend/src/components/CourseTimeline.jsx` |

비즈니스 로직은 아래 파일들에 분리되어 있으므로 디자인 교체 시 유지하기 쉽습니다.

```text
frontend/src/context/JaturipContext.jsx
frontend/src/api/recommendationApi.js
frontend/src/utils/preferences.js
frontend/src/utils/time.js
frontend/src/mocks/recommendationMock.js
```

### 15. 실행 명령어

백엔드:

```powershell
npm.cmd run dev
```

프론트:

```powershell
cd frontend
..\.tools\node-v22.22.0-win-x64\npm.cmd run dev
```

빌드:

```powershell
npm.cmd run build

cd frontend
..\.tools\node-v22.22.0-win-x64\npm.cmd run build
```

Interaction test:

```powershell
cd frontend
..\.tools\node-v22.22.0-win-x64\npm.cmd run test:interactions
```

## 현재 반영된 알고리즘 변경 요약

이번 작업에서는 기존에 정한 `Deadline-first`, `역산 스케줄러`, `adjustedTravelTime`, `policyStayTime`, 동적 point 개수 산정 구조를 유지하면서 MVP 추천 알고리즘의 실제 코드 구조를 정리했습니다.

### 핵심 변경사항

| 항목 | 반영 내용 |
| --- | --- |
| `PreferenceTag` 축소 | 사용자 취향 tag를 `cafe`, `food`, `nature`, `culture`, `history`, `activity` 6개로 통일 |
| `Category normalizer` 추가 | Kakao/TourAPI 원본 category를 추천 알고리즘에서 직접 쓰지 않고 6개 `PreferenceTag`로 변환 |
| Swipe 기반 선호도 계산 | 임의 weight 대신 swipe 행동으로 `preferenceWeight` 계산 |
| 반복 dislike 처리 | dislike 1회는 penalty만 주고, 반복 dislike일 때만 `strongReject`로 처리 |
| `Beam Search` 구현 | 모든 조합을 전수 탐색하지 않고 상위 partial course만 유지하며 확장 |
| `Deadline-first` 강화 | deadline을 만족하지 못하는 course/branch는 scoring 전에 제거 |
| Weight/Multiplier 분리 | 최종 ranking용 `Weight`와 이동시간 보정용 `Multiplier`를 구분 |
| Policy 파일 분리 | weight, multiplier, threshold, `beamWidth`, stay time 값을 `policy.ts`에서 관리 |
| 테스트 스크립트 추가 | deadline-safe, deadline-rejected, strongReject 시나리오 확인 |

### 현재 구현된 파일 역할

| 파일 | 역할 |
| --- | --- |
| `src/recommendation/policy.ts` | `courseScoreWeights`, `travelAdjustmentPolicy`, `preferencePolicy`, `courseSearchPolicy`, `stayTimePolicy` 관리 |
| `src/recommendation/normalizer.ts` | Kakao/TourAPI/manual 후보를 6개 `PreferenceTag`로 normalize |
| `src/recommendation/preferenceScorer.ts` | swipe 결과로 `preferenceWeight`, `strongRejectTags` 계산 |
| `src/recommendation/candidateCollector.ts` | 후보 장소 수집 및 normalize |
| `src/recommendation/feasibilityFilter.ts` | `strongReject` category 후보 제거 |
| `src/recommendation/travelTime.ts` | `baseTravelTime`, `adjustedTravelTime` 계산 |
| `src/recommendation/stayTimePolicy.ts` | 후보 tag 기반 `policyStayTime` 계산 |
| `src/recommendation/reverseScheduler.ts` | `nextScheduleTime` 기준 역산 스케줄링 |
| `src/recommendation/routeBuilder.ts` | `Beam Search`로 가능한 course combination 생성 |
| `src/recommendation/scorer.ts` | `deadlineSafetyScore`, `preferenceMatchScore` 등 최종 score 계산 |
| `src/recommendation/recommendationEngine.ts` | 전체 추천 흐름 orchestration |
| `src/services/recommendation.service.ts` | API payload를 추천 엔진 입력으로 변환 |
| `src/scripts/testRecommendationAlgorithm.ts` | 알고리즘 시나리오 테스트 |

### 최종 추천 흐름

```text
사용자 입력
→ Swipe Preference Scorer
→ Candidate Collector
→ Category Normalizer
→ Hard Filter
→ Travel Time Estimator / Adjuster
→ Stay Time Policy
→ Beam Search
→ Reverse Scheduler
→ Deadline-first Filtering
→ Course Scoring
→ Ranking
→ 최적 코스 + 대안 코스 반환
```

### 6개 PreferenceTag 매핑

| PreferenceTag | 사용자 화면 표현 | 대표 매핑 |
| --- | --- | --- |
| `cafe` | 카페·디저트 | 카페, 베이커리, 전통찻집 |
| `food` | 맛집·먹거리 | 음식점, 맛집, 지역 먹거리 |
| `nature` | 산책·자연 | 공원, 한강, 산책로, 자연 관광지 |
| `culture` | 전시·문화 | 미술관, 박물관, 전시관, 공연장 |
| `history` | 역사·전통 | 궁궐, 사찰, 유적, 한옥, 전통문화 |
| `activity` | 체험·놀거리 | 공방, 체험, 레포츠, 놀거리 |

`shopping`, `sightseeing`, `event` 등 기존 확장 tag는 추천 알고리즘에서 직접 쓰지 않고 `Category normalizer`에서 위 6개 tag 중 하나로 임시 매핑합니다.

### Preference weight 계산

사용자 취향 weight는 요청마다 swipe 결과로 계산하고 DB에 저장하지 않습니다.

```text
like = +1
skip = 0
dislike = -1

preferenceWeight =
(likeCount - dislikeCount)
/
(exposureCount + 1)
```

반복 dislike 정책:

```ts
const preferencePolicy = {
  strongRejectMinExposure: 3,
  strongRejectRatio: 0.8
};
```

### Beam Search와 Deadline-first 연결

`Beam Search`는 point를 하나 추가할 때마다 즉시 아래 조건을 검사합니다.

```text
courseUsedMinutes > usableMinutes
=> branch 종료

minimumSlackMinutes < 0
=> branch 종료

deadlineSafe = false
=> branch 종료

strongReject category 포함
=> 후보 제거
```

즉, course를 끝까지 만든 뒤 검사하는 방식이 아니라 partial course 단계에서 deadline 불가능 branch를 바로 제거합니다.

### Weight와 Multiplier 관리 위치

모든 MVP 정책값은 `src/recommendation/policy.ts`에서 관리합니다.

`Weight`는 최종 추천 ranking에서 각 score의 중요도를 의미합니다.

```ts
const courseScoreWeights = {
  deadlineSafety: 0.40,
  preferenceMatch: 0.25,
  routeEfficiency: 0.15,
  context: 0.10,
  groupSuitability: 0.05,
  dataQuality: 0.05
};
```

`Multiplier`는 이동시간을 보수적으로 보정하는 값입니다.

```text
adjustedTravelTime =
baseTravelTime
* congestionMultiplier
* weatherMultiplier
* peopleMultiplier
* transportRiskMultiplier
```

### 추후 튜닝해야 하는 정책값

아래 값들은 확정값이 아니라 MVP 초기 policy 값입니다.

| 정책값 | 위치 |
| --- | --- |
| `beamWidth` | `courseSearchPolicy.beamWidth` |
| `strongRejectMinExposure` | `preferencePolicy.strongRejectMinExposure` |
| `strongRejectRatio` | `preferencePolicy.strongRejectRatio` |
| `arrivalBufferMinutes` | `deadlinePolicy.arrivalBufferMinutes` |
| `minimumSafeSlackMinutes` | `deadlinePolicy.minimumSafeSlackMinutes` |
| `targetSlackMinutes` | `deadlinePolicy.targetSlackMinutes` |
| `stayTimePolicy` | `stayTimePolicy` |
| score weight | `courseScoreWeights` |
| 이동시간 multiplier | `travelAdjustmentPolicy` |

### 테스트 결과

검증 명령:

```powershell
npm.cmd run build
npx.cmd tsx src/scripts/testRecommendationAlgorithm.ts
```

확인한 결과:

| 시나리오 | 결과 |
| --- | --- |
| `deadline-safe nearby schedule` | deadline-safe course 생성, `성수 카페` 1위 |
| `deadline-rejected far schedule` | 다음 일정이 도보로 너무 멀어 추천 코스 없음 |
| `strong-reject culture category` | `culture`가 `strongRejectTags`에 포함되고 문화 후보 제거 |

## Open API 접근 확인

2026-09-02 기준, `.env`에 있는 인증키로 실제 호출을 확인했습니다.

| API | Env key | 인증 방식 | 접근 결과 |
| --- | --- | --- | --- |
| Kakao Local API | `KAKAO_REST_API_KEY` | `Authorization: KakaoAK {key}` header | 정상, HTTP 200 |
| Korea TourAPI | `TOURAPI_SERVICE_KEY` | `serviceKey` query parameter | 정상, HTTP 200, `resultCode: 0000` |
| Seoul Real-time City Data | `SEOUL_DATA_API_KEY` | URL path에 key 포함 | 정상, HTTP 200, `RESULT.CODE: INFO-000` |
| Korea Weather API | `WEATHER_KR_API_KEY` | `serviceKey` query parameter | 정상, HTTP 200, `resultCode: 00` |

참고: 현재 `.env`에는 `WEATHER_KR_API_KEY`가 있고, `src/config/env.ts`는 `WEATHER_API_KEY`를 읽고 있습니다. 날씨 API를 실제 서비스 코드에서 사용할 때는 env 이름을 통일하거나 둘 다 읽도록 처리해야 합니다.

## API 데이터 정규화 계층

외부 API마다 응답 JSON 구조가 다르기 때문에 추천 알고리즘은 원본 API 필드를 직접 읽지 않습니다. 모든 외부 응답은 API별 normalizer를 거쳐 JATURIP 내부 공통 구조로 변환됩니다.

```text
각 외부 API의 서로 다른 JSON 구조
        ↓
API별 Normalizer
        ↓
JATURIP 내부 공통 데이터 구조
        ↓
추천 알고리즘
```

### 실제 확인한 API 응답 필드

`src/scripts/inspectApiResponseFields.ts`로 실제 API를 호출해서 확인한 필드입니다. API key는 출력하지 않습니다.

| API | 확인한 주요 필드 |
| --- | --- |
| Kakao Local | `address_name`, `category_group_code`, `category_group_name`, `category_name`, `distance`, `id`, `phone`, `place_name`, `place_url`, `road_address_name`, `x`, `y` |
| TourAPI | `addr1`, `addr2`, `zipcode`, `areacode`, `cat1`, `cat2`, `cat3`, `contentid`, `contenttypeid`, `createdtime`, `dist`, `firstimage`, `firstimage2`, `mapx`, `mapy`, `modifiedtime`, `sigungucode`, `tel`, `title`, `lclsSystm1`, `lclsSystm2`, `lclsSystm3` |
| Weather API | `baseDate`, `baseTime`, `category`, `fcstDate`, `fcstTime`, `fcstValue`, `nx`, `ny` |
| Seoul city data | `AREA_NM`, `AREA_CD`, `LIVE_PPLTN_STTS`, `ROAD_TRAFFIC_STTS`, `PRK_STTS`, `SUB_STTS`, `BUS_STN_STTS`, `WEATHER_STTS`, `CHARGER_STTS`, `EVENT_STTS`, `LIVE_CMRCL_STTS` |

서울시 세부 필드는 `LIVE_PPLTN_STTS[0]`에서 `AREA_CONGEST_LVL`, `AREA_PPLTN_MIN`, `AREA_PPLTN_MAX`, `PPLTN_TIME`, `FCST_PPLTN`을 확인했고, `ROAD_TRAFFIC_STTS.AVG_ROAD_DATA`에서 `ROAD_TRAFFIC_IDX`, `ROAD_TRAFFIC_SPD`, `ROAD_TRAFFIC_TIME`을 확인했습니다.

### JaturipPlace 구조

장소 후보는 `JaturipPlace`로 통일합니다.

```ts
type JaturipPlace = {
  id: string;
  source: 'kakao' | 'tourApi';
  sourceId: string;
  name: string;
  category: PreferenceTag | 'unmapped';
  originalCategory?: {
    main?: string | null;
    middle?: string | null;
    detail?: string | null;
    raw?: string | null;
  };
  lat: number | null;
  lng: number | null;
  address?: string | null;
  roadAddress?: string | null;
  imageUrl?: string | null;
  detailUrl?: string | null;
  phone?: string | null;
  indoorOutdoor?: 'indoor' | 'outdoor' | 'mixed' | 'unknown';
  policyStayTime?: number;
  dataQuality?: {
    hasCoordinates: boolean;
    hasAddress: boolean;
    hasImage: boolean;
    hasCategory: boolean;
    hasDetailUrl: boolean;
  };
  rawSource?: unknown;
};
```

좌표가 잘못되었거나 없으면 `NaN`을 만들지 않고 `lat: null`, `lng: null`로 처리합니다. 좌표가 없는 후보는 이후 hard filter에서 제거할 수 있습니다.

### API별 Place 변환

Kakao Local 변환:

| Kakao field | JATURIP field |
| --- | --- |
| `id` | `sourceId`, `id: kakao:{id}` |
| `place_name` | `name` |
| `category_group_code`, `category_group_name`, `category_name` | `originalCategory`, `category` |
| `y` | `lat` |
| `x` | `lng` |
| `address_name` | `address` |
| `road_address_name` | `roadAddress` |
| `place_url` | `detailUrl` |
| `phone` | `phone` |
| 없음 | `imageUrl: null` |

TourAPI 변환:

| TourAPI field | JATURIP field |
| --- | --- |
| `contentid` | `sourceId`, `id: tourApi:{contentid}` |
| `title` | `name` |
| `contenttypeid`, `cat1`, `cat2`, `cat3` | `originalCategory`, `category` |
| `mapy` | `lat` |
| `mapx` | `lng` |
| `addr1`, `addr2` | `address` |
| 없음 | `roadAddress: null` |
| `firstimage`, `firstimage2` | `imageUrl` |
| 없음 | `detailUrl: null` |
| `tel` | `phone` |

### WeatherContext 구조

날씨는 장소가 아니므로 `JaturipPlace`에 넣지 않고 `WeatherContext`로 분리합니다.

```ts
type WeatherContext = {
  temperature?: number | null;
  precipitationProbability?: number | null;
  precipitationType?: 'none' | 'rain' | 'snow' | 'rainSnow' | 'unknown';
  precipitationAmount?: number | null;
  skyCondition?: 'clear' | 'cloudy' | 'overcast' | 'unknown';
  windSpeed?: number | null;
  observedAt?: string | null;
  rawSource?: unknown;
};
```

Weather API 변환:

| Weather category | JATURIP field |
| --- | --- |
| `TMP` | `temperature` |
| `POP` | `precipitationProbability` |
| `PTY` | `precipitationType` |
| `PCP` | `precipitationAmount` |
| `SKY` | `skyCondition` |
| `WSD` | `windSpeed` |
| `fcstDate`, `fcstTime` | `observedAt` |

### SeoulContext 구조

서울시 데이터도 장소가 아니므로 `SeoulContext`로 분리합니다.

```ts
type SeoulContext = {
  areaName?: string | null;
  congestionLevel?: 'relaxed' | 'normal' | 'crowded' | 'veryCrowded' | 'unknown';
  roadTraffic?: {
    averageSpeed?: number | null;
    trafficLevel?: 'smooth' | 'slow' | 'congested' | 'unknown';
  };
  events?: Array<{
    name: string;
    startTime?: string | null;
    endTime?: string | null;
    location?: string | null;
  }>;
  observedAt?: string | null;
  rawSource?: unknown;
};
```

Seoul city data 변환:

| Seoul field | JATURIP field |
| --- | --- |
| `CITYDATA.AREA_NM` | `areaName` |
| `LIVE_PPLTN_STTS[0].AREA_CONGEST_LVL` | `congestionLevel` |
| `ROAD_TRAFFIC_STTS.AVG_ROAD_DATA.ROAD_TRAFFIC_SPD` | `roadTraffic.averageSpeed` |
| `ROAD_TRAFFIC_STTS.AVG_ROAD_DATA.ROAD_TRAFFIC_IDX` | `roadTraffic.trafficLevel` |
| `EVENT_STTS` | `events` |
| `PPLTN_TIME` 또는 `ROAD_TRAFFIC_TIME` | `observedAt` |

### Category Normalizer

카테고리 매핑 규칙은 `src/normalizers/category.normalizer.ts` 한 곳에서 관리합니다.

| 원본 분류 | PreferenceTag |
| --- | --- |
| 카페, 커피, 디저트, 베이커리, 전통찻집 | `cafe` |
| 음식점, 맛집, 한식, 중식, 일식, 양식, 먹거리 | `food` |
| 공원, 한강, 산책, 자연, 숲, 수목원, 둘레길 | `nature` |
| 미술관, 박물관, 전시, 공연, 극장, 문화시설, 갤러리 | `culture` |
| 궁궐, 사찰, 절, 유적, 한옥, 전통, 문화재, 역사 | `history` |
| 체험, 공방, 레포츠, 스포츠, 놀이, 테마파크 | `activity` |
| 시장, 쇼핑, 상점 | 기본 `culture`, 전통시장 성격이면 `history` |

명확히 매핑되지 않는 카테고리는 억지 분류하지 않고 `unmapped`로 둡니다. `unmapped` 후보는 추천 알고리즘에 들어가기 전에 제거할 수 있습니다.

### 중복 장소 처리

TourAPI와 Kakao에서 같은 장소가 동시에 내려올 수 있으므로 `src/candidates/duplicateDetector.ts`에서 중복 제거와 병합을 처리합니다.

판단 기준:

```text
normalized name이 유사함
+
좌표 거리가 duplicatePolicy.coordinateThresholdMeters 이하
```

현재 threshold:

```ts
const duplicatePolicy = {
  coordinateThresholdMeters: 50
};
```

병합 우선순위:

| 데이터 | 우선 사용 |
| --- | --- |
| 주소/전화번호/detail URL | Kakao 우선 |
| 이미지 | TourAPI 우선, Kakao에 이미지가 없기 때문 |
| category | `unmapped`가 아닌 값 우선 |
| rawSource | 개발 디버깅용으로만 선택 보존 |

확실히 같은 장소라고 판단되는 경우만 병합하고, 애매한 경우는 병합하지 않습니다.

### Context Enricher

Normalizer는 데이터 구조 통일만 담당합니다. Weather/Seoul context를 장소 후보와 결합하는 작업은 `src/candidates/contextEnricher.ts`에서 처리합니다.

```ts
type EnrichedCandidate = {
  place: JaturipPlace;
  context: {
    weather?: WeatherContext;
    seoul?: SeoulContext;
  };
};
```

이후 추천 알고리즘에서는 API 원본 JSON이 아니라 `JaturipPlace`, `WeatherContext`, `SeoulContext` 기반 후보만 사용합니다.

### 정규화 계층 파일 역할

| 파일 | 역할 |
| --- | --- |
| `src/types/normalized.ts` | `JaturipPlace`, `WeatherContext`, `SeoulContext`, `EnrichedCandidate` 타입 |
| `src/normalizers/utils.ts` | 안전한 string/number/date parsing |
| `src/normalizers/category.normalizer.ts` | API category를 6개 `PreferenceTag` 또는 `unmapped`로 변환 |
| `src/normalizers/kakao.normalizer.ts` | Kakao Local item을 `JaturipPlace`로 변환 |
| `src/normalizers/tourApi.normalizer.ts` | TourAPI item을 `JaturipPlace`로 변환 |
| `src/normalizers/weather.normalizer.ts` | Weather API response를 `WeatherContext`로 변환 |
| `src/normalizers/seoul.normalizer.ts` | Seoul city data response를 `SeoulContext`로 변환 |
| `src/normalizers/placeQuality.ts` | `dataQuality` 계산 |
| `src/candidates/duplicateDetector.ts` | TourAPI/Kakao 중복 장소 제거 및 병합 |
| `src/candidates/contextEnricher.ts` | `JaturipPlace`와 context 결합 |
| `src/recommendation/candidateCollector.ts` | normalizer, duplicate remover, context enricher를 추천 후보 수집에 연결 |

### 정규화 테스트

실행 명령:

```powershell
npx.cmd tsx src/scripts/testNormalizers.ts
```

테스트 확인 항목:

| 항목 | 결과 |
| --- | --- |
| Kakao `place_name` → `name` | 정상 |
| Kakao `y`, `x` → `lat`, `lng` number 변환 | 정상 |
| Kakao `FD6` → `food` | 정상 |
| Kakao 이미지 없음 → `imageUrl: null` | 정상 |
| TourAPI `title` → `name` | 정상 |
| TourAPI `mapy`, `mapx` → `lat`, `lng` number 변환 | 정상 |
| TourAPI `contenttypeid=39`, `cat1=A05` → `food` | 정상 |
| 잘못된 좌표 → `lat: null`, `lng: null` | 정상 |
| Kakao/TourAPI 중복 장소 병합 | 정상 |
| Weather `TMP`, `POP`, `PTY`, `PCP`, `SKY`, `WSD` 변환 | 정상 |
| Seoul 혼잡도/도로정체 변환 | 정상 |

### 미확인 또는 미지원 항목

아래 항목은 현재 실제 응답에서 안정적으로 확인되지 않았거나 API 자체가 제공하지 않아 구현하지 않았습니다.

| 항목 | 상태 |
| --- | --- |
| Kakao 이미지 | Kakao Local 응답에 없음, `imageUrl: null` |
| TourAPI detail URL | 현재 확인 응답에 없음, `detailUrl: null` |
| 장소별 실제 평균 체류시간 | 외부 API에서 제공하지 않음, `policyStayTime` 사용 |
| 장소별 실시간 수용 인원 | 현재 API에서 장소 단위로 제공하지 않음 |
| 정확한 가격/예산 정보 | 현재 API에서 제공하지 않음 |
| 영업시간/예약 가능 여부 | 현재 확인한 응답에는 없음 |
| Seoul `EVENT_STTS` 세부 event field | 강남역 호출 결과가 빈 배열이라 field 미확인 |

## API별 가져올 수 있는 데이터

### Kakao Local API

정확한 장소 검색, 음식점/카페/상점 분류, 좌표, 전화번호, Kakao 장소 URL을 얻는 데 가장 적합합니다.

예시:

```text
GET https://dapi.kakao.com/v2/local/search/keyword.json
Authorization: KakaoAK {KAKAO_REST_API_KEY}
```

`documents` 주요 필드:

| Field | 의미 | 추천에서의 활용 |
| --- | --- | --- |
| `place_name` | 장소명 | 카드/코스 제목 |
| `category_group_code` | 대분류 코드, 예: `FD6` | 주요 취향 카테고리 매핑 |
| `category_group_name` | 대분류명 | 사용자에게 보여줄 분류명 |
| `category_name` | 전체 카테고리 경로 | 세부 취향 매칭 |
| `address_name` | 지번 주소 | 장소 정보 |
| `road_address_name` | 도로명 주소 | 장소 정보 |
| `x`, `y` | 경도, 위도 | 거리 계산, 경로 계산 |
| `phone` | 전화번호 | 장소 상세 정보 |
| `place_url` | Kakao 장소 페이지 | 상세 링크 |
| `distance` | 좌표 검색 시 거리 | 근거리 우선순위 |

Kakao 주요 category code:

| Code | 의미 | 내부 카테고리 |
| --- | --- | --- |
| `FD6` | 음식점 | `food` |
| `CE7` | 카페 | `cafe` |
| `CT1` | 문화시설 | `culture` |
| `AT4` | 관광명소 | category text에 따라 `nature`, `history`, `culture`, `activity` |
| `AD5` | 숙박 | 추천 취향 tag로 직접 사용하지 않음 |
| `MT1` | 대형마트 | 임시 `culture`, 추후 정책 조정 가능 |
| `CS2` | 편의점 | 보조 데이터 |
| `PK6` | 주차장 | 차량 이동 보조 데이터 |
| `SW8` | 지하철역 | 이동 보조 데이터 |

### Korea TourAPI

관광지, 문화시설, 레포츠, 음식점, 쇼핑, 축제/행사, 이미지 정보를 얻는 데 적합합니다.

예시:

```text
GET https://apis.data.go.kr/B551011/KorService2/locationBasedList2
```

`response.body.items.item` 주요 필드:

| Field | 의미 | 추천에서의 활용 |
| --- | --- | --- |
| `title` | 장소명 | 카드/코스 제목 |
| `contentid` | TourAPI 콘텐츠 ID | 외부 ID |
| `contenttypeid` | 콘텐츠 타입 | 주요 장소 유형 매핑 |
| `cat1`, `cat2`, `cat3` | 관광 카테고리 계층 | 세부 취향 매칭 |
| `lclsSystm1`, `lclsSystm2`, `lclsSystm3` | 신규 분류 체계 | 세부 취향 매칭 |
| `addr1`, `addr2`, `zipcode` | 주소 | 장소 정보 |
| `mapx`, `mapy` | 경도, 위도 | 거리 계산, 경로 계산 |
| `dist` | 요청 좌표 기준 거리 | 근거리 우선순위 |
| `firstimage`, `firstimage2` | 이미지 URL | swipe card / 장소 카드 이미지 |
| `tel` | 전화번호 | 장소 상세 정보 |
| `areacode`, `sigungucode` | 지역 코드 | 지역 필터링 |
| `createdtime`, `modifiedtime` | 데이터 생성/수정 시각 | freshness 확인 |

TourAPI 주요 `contenttypeid`:

| Code | 의미 | 내부 카테고리 |
| --- | --- | --- |
| `12` | 관광지 | 기본 `nature`, text에 따라 `history`/`culture` |
| `14` | 문화시설 | `culture` |
| `15` | 축제/행사 | 기본 `activity`, 전시/공연 성격이면 `culture` |
| `28` | 레포츠 | `activity` |
| `32` | 숙박 | 추천 취향 tag로 직접 사용하지 않음 |
| `38` | 쇼핑 | 임시 `culture`, 전통시장 성격이면 `history` |
| `39` | 음식점 | `food` |

TourAPI 주요 `cat1`:

| Code | 의미 | 내부 카테고리 |
| --- | --- | --- |
| `A01` | 자연 | `nature` |
| `A02` | 인문/관광 | 기본 `nature`, text에 따라 `history`/`culture` |
| `A03` | 레포츠 | `activity` |
| `A04` | 쇼핑 | 임시 `culture`, 전통시장 성격이면 `history` |
| `A05` | 음식 | `food` |

### Seoul Real-time City Data

서울 주요 지역의 실시간 혼잡도, 도로 교통, 행사, 상권, 날씨성 데이터를 얻는 데 적합합니다. 추천에서는 장소 자체보다 현재 상황을 보정하는 데 사용합니다.

예시:

```text
GET http://openapi.seoul.go.kr:8088/{SEOUL_DATA_API_KEY}/json/citydata/1/1/강남역
```

`CITYDATA` 주요 필드:

| Field | 의미 | 추천에서의 활용 |
| --- | --- | --- |
| `AREA_NM`, `AREA_CD` | 지역명/지역 코드 | 지역 매칭 |
| `LIVE_PPLTN_STTS` | 실시간 인구/혼잡도 | 조용한 곳/활기찬 곳 선호 반영 |
| `AREA_CONGEST_LVL` | 혼잡도 수준 | `contextScore`, `adjustedTravelTime`, deadline risk |
| `AREA_PPLTN_MIN`, `AREA_PPLTN_MAX` | 예상 인구 범위 | 혼잡도 점수 |
| `FCST_PPLTN` | 시간대별 혼잡도 예측 | 다음 일정 시간 고려 |
| `ROAD_TRAFFIC_STTS` | 도로 속도/정체 정보 | 차량 이동 시간 penalty |
| `PRK_STTS` | 주차장 정보 | 차량 이동 보조 데이터 |
| `SUB_STTS` | 지하철 정보 | 이동 보조 데이터 |
| `BUS_STN_STTS` | 버스 정류장 정보 | 이동 보조 데이터 |
| `EVENT_STTS` | 행사 정보 | `activity` 또는 `culture` 후보 보강 |
| `LIVE_CMRCL_STTS` | 상권 활성도 | 음식/쇼핑/활기 선호 보정 |
| `CHARGER_STTS` | 전기차 충전소 정보 | 차량 보조 데이터 |
| `WEATHER_STTS` | 지역 날씨 정보 | 날씨 보정 |

혼잡도 값 활용:

| 값 | 의미 | 추천 점수 활용 |
| --- | --- | --- |
| `여유` | 한산함 | 이동시간 보정 낮음, context risk 낮음 |
| `보통` | 보통 | neutral |
| `약간 붐빔` | 약간 혼잡 | `adjustedTravelTime` 증가, context risk 증가 |
| `붐빔` | 혼잡 | `adjustedTravelTime` 크게 증가, deadline risk 증가 |

### Korea Weather API

날씨에 따라 실내/실외 코스를 보정하는 데 사용합니다.

예시:

```text
GET https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst
```

주요 필드:

| Field | 의미 | 추천에서의 활용 |
| --- | --- | --- |
| `baseDate`, `baseTime` | 예보 발표 시각 | 디버깅/freshness |
| `fcstDate`, `fcstTime` | 예보 대상 시각 | 다음 일정 시간대 매칭 |
| `category` | 날씨 항목 코드 | 날씨 점수 계산 |
| `fcstValue` | 예보 값 | 날씨 점수 계산 |
| `nx`, `ny` | 격자 좌표 | 위치 매칭 |

주요 날씨 category code:

| Code | 의미 | 추천 활용 |
| --- | --- | --- |
| `TMP` | 기온 | 이동/체류 쾌적도 |
| `SKY` | 하늘 상태 | contextScore 보정 |
| `PTY` | 강수 형태 | 비/눈 필터링 |
| `POP` | 강수 확률 | 이동시간/weather risk 보정 |
| `PCP` | 강수량 | 이동시간/weather risk 보정 |
| `WSD` | 풍속 | 이동 쾌적도 |
| `REH` | 습도 | 쾌적도 |
| `SNO` | 적설량 | 이동 penalty |

## 사용자 취향 카테고리

외부 API의 category code를 사용자에게 직접 보여주면 UX가 복잡해집니다. 서비스 내부에서는 API 카테고리를 반드시 `Category normalizer`를 거쳐 6개 `PreferenceTag`로 정규화해서 사용합니다.

```text
TourAPI / Kakao original category
        ↓
Category normalizer
        ↓
PreferenceTag
        ↓
추천 알고리즘
```

추천 알고리즘 내부에서는 TourAPI `cat1`, `cat2`, `cat3`, `contenttypeid`, Kakao `category_group_code`를 직접 비교하지 않습니다.

### 6개 PreferenceTag

| App category | 의미 | 외부 API 매핑 |
| --- | --- | --- |
| `cafe` | 카페, 디저트 | Kakao `CE7`, Kakao `category_name` |
| `food` | 음식점, 식사, 지역 먹거리 | Kakao `FD6`, TourAPI `contenttypeid=39`, `cat1=A05` |
| `nature` | 공원, 산책, 자연 | TourAPI `cat1=A01`, Kakao category text |
| `culture` | 전시, 박물관, 공연, 문화시설 | Kakao `CT1`, TourAPI `contenttypeid=14` |
| `history` | 궁궐, 사찰, 유적, 한옥, 전통문화 | category text 기반 |
| `activity` | 체험, 레포츠, 활동 | TourAPI `contenttypeid=28`, `cat1=A03` |

사용자 화면 표현:

| PreferenceTag | 화면 표시 |
| --- | --- |
| `cafe` | 카페·디저트 |
| `food` | 맛집·먹거리 |
| `nature` | 산책·자연 |
| `culture` | 전시·문화 |
| `history` | 역사·전통 |
| `activity` | 체험·놀거리 |

기존에 사용하던 `shopping`, `sightseeing`, `event`, `stay`, `quiet`, `lively`, `indoor`, `outdoor`, `nearby` 등은 사용자 취향 tag로 직접 쓰지 않습니다. 필요한 경우 `Category normalizer` 또는 context scoring에서 6개 tag나 별도 context score로 흡수합니다.

임시 normalize 기준:

| 원본 분류 | PreferenceTag |
| --- | --- |
| 카페, 베이커리, 전통찻집 | `cafe` |
| 음식점, 맛집, 지역 먹거리 | `food` |
| 공원, 한강, 산책로, 자연 관광지 | `nature` |
| 미술관, 박물관, 전시관, 공연장 | `culture` |
| 궁궐, 사찰, 유적, 한옥, 전통문화 | `history` |
| 공방, 체험, 레포츠, 놀거리 | `activity` |
| 시장, 쇼핑 | 기본 `culture`, 전통시장 성격이면 `history` |
| 축제, 행사, 팝업 | 기본 `activity`, 전시/공연 성격이면 `culture` |
| 관광명소 | 자연 중심이면 `nature`, 역사/전통이면 `history`, 전시/문화면 `culture` |

## Preference Model

사용자의 취향은 고정값으로 임의 설정하지 않습니다. swipe 행동을 기반으로 현재 추천 요청 안에서만 `preferenceWeight`를 계산합니다. 이 값은 DB에 저장하지 않습니다.

```ts
type PreferenceTag =
  | 'cafe'
  | 'food'
  | 'nature'
  | 'culture'
  | 'history'
  | 'activity';

type UserPreferenceWeights = Record<PreferenceTag, number>;
```

Swipe action 값:

```text
like = +1
skip = 0
dislike = -1
```

MVP preferenceWeight 공식:

```text
preferenceWeight =
(likeCount - dislikeCount)
/
(exposureCount + 1)
```

`+1`은 swipe 한 번만으로 특정 카테고리 선호도가 과하게 결정되는 것을 막기 위한 smoothing 값입니다.

예시:

```text
카페 카드 1개 노출, like 1
(1 - 0) / (1 + 1) = 0.5

카페 카드 2개 노출, like 2
(2 - 0) / (2 + 1) = 0.67

카페 카드 3개 노출, like 2, dislike 1
(2 - 1) / (3 + 1) = 0.25
```

결과 예시:

```json
{
  "cafe": 0.67,
  "food": 0.25,
  "nature": 0.5,
  "culture": -0.25,
  "history": 0,
  "activity": 0.33
}
```

반복 dislike 처리:

```ts
const preferencePolicy = {
  strongRejectMinExposure: 3,
  strongRejectRatio: 0.8
};
```

카테고리 카드 1개를 dislike했다고 해당 카테고리를 바로 제거하지 않습니다. `exposureCount >= strongRejectMinExposure`이고 dislike 비율이 `strongRejectRatio` 이상일 때만 `strongReject`로 판단합니다. `strongReject` tag는 Candidate Hard Filter 단계에서 제거할 수 있습니다.

장소별 `preferenceScore`는 장소가 가진 `PreferenceTag`의 사용자 `preferenceWeight`로 계산합니다. 여러 tag를 가진 장소는 평균을 기본 aggregation rule로 사용하며, 이 rule은 `preferencePolicy.multiTagAggregation`에서 관리합니다.

코스 전체의 `preferenceMatchScore`는 포함된 point들의 `preferenceScore` 평균을 0~1 범위로 normalize해서 사용합니다.

## 서비스 추천 알고리즘 설계

Jaturip의 핵심 기능은 사용자의 현위치에서 다음 일정까지 남는 시간 동안 최적의 맞춤 코스를 짜주는 것입니다. 코스는 현재 위치 근처에서 시작하고, 남는 시간을 효율적으로 사용하며, 마지막에는 다음 일정으로 자연스럽게 이어질 수 있어야 합니다.

### 전체 flow

1. 사용자에게 필수 조건을 먼저 입력받습니다.
2. swipe card 형식으로 취향 카테고리를 보여줍니다.
3. 좋아요/싫어요 결과를 `PreferenceTag` weight로 변환합니다.
4. 현재 위치, 다음 일정, 이동방법, 남은 시간을 기준으로 후보 장소를 수집합니다.
5. 시간, 반경, 이동방법, 다음 일정 방향을 기준으로 불가능한 후보를 제거합니다.
6. 여러 개의 course combination을 생성합니다.
7. 가장 높은 점수의 코스를 추천하고, 대안 코스도 함께 제공합니다.

### 필수 입력값

아래 네 가지는 추천 시작 전에 반드시 필요합니다.

| 입력 | Field | 필요한 이유 |
| --- | --- | --- |
| 현재 위치 | `currentLatitude`, `currentLongitude` | 코스 시작점과 후보 검색 중심점 |
| 다음 일정 | `nextScheduleTime`, 가능하면 다음 일정 위치 | 사용 가능한 시간과 최종 도착 방향 결정 |
| 인원수 | `peopleCount` | 혼자/커플/그룹에 맞는 장소 우선순위 판단 |
| 이동방법 | `transportMode: walk/car` | 반경, 이동 시간, 교통/주차 penalty 결정 |

추천 request shape:

```ts
type TransportMode = 'walk' | 'car';

type CourseRequest = {
  currentLatitude: number;
  currentLongitude: number;
  nextScheduleTime: string;
  nextScheduleName?: string;
  nextScheduleLatitude?: number;
  nextScheduleLongitude?: number;
  peopleCount: number;
  transportMode: TransportMode;
};
```

### 추가로 있으면 좋은 정보

서비스는 필수 입력만으로도 동작할 수 있지만, 아래 데이터가 있으면 추천 품질이 좋아집니다.

| 추가 정보 | 필요한 이유 | 없을 때 처리 |
| --- | --- | --- |
| 다음 일정 좌표 | 마지막 코스를 다음 일정 방향으로 최적화 가능 | 현재 위치 주변 중심으로 추천하고 이동거리 짧은 코스 선호 |
| 현재 시각 | 남은 시간 계산 정확도 향상 | server time 사용 |
| 예산 | 비싼 활동/식당 필터링 가능 | 예산 조건 없이 추천 |
| 여행 스타일 | 혼자/데이트/친구/가족 추천 구분 | `peopleCount`만으로 약하게 추정 |
| 강한 비선호 | 반드시 피해야 할 카테고리 제거 | swipe dislike만 사용 |

### Swipe card 취향 파악

사용자에게는 API code가 아니라 이해하기 쉬운 카드형 카테고리를 보여줍니다. 각 카드는 내부적으로 여러 `PreferenceTag`에 연결됩니다.

추천 card set:

| Swipe card | 연결되는 tag | 싫어요 의미 |
| --- | --- | --- |
| 카페·디저트 | `cafe` | 카페 중심 코스 선호 낮음 |
| 맛집·먹거리 | `food` | 식사 중심 코스 선호 낮음 |
| 산책·자연 | `nature` | 산책/자연 코스 선호 낮음 |
| 전시·문화 | `culture` | 전시/공연/문화시설 선호 낮음 |
| 역사·전통 | `history` | 역사/전통 장소 선호 낮음 |
| 체험·놀거리 | `activity` | 활동적인 코스 선호 낮음 |

Swipe 점수화:

```text
like:    +1
skip:     0
dislike: -1
```

카테고리별 `preferenceWeight`는 `Preference Model` 섹션의 `(likeCount - dislikeCount) / (exposureCount + 1)` 공식을 사용합니다. 싫어요 1회는 hard filter가 아니라 weight 하락으로 처리하고, 반복 dislike일 때만 `strongReject` 후보로 봅니다.

### 코스 포인트 개수 산정 방식

코스 포인트 개수는 사용자가 직접 지정하지 않고, 서버가 남은 시간 안에서 가능한 만큼 동적으로 계산합니다. 단순히 "2시간이면 2개, 5시간이면 3개"처럼 고정하지 않고, 각 후보 코스의 `adjustedTravelTime + policyStayTime + bufferTime`을 누적해서 실제로 들어갈 수 있는 point 수를 정합니다.

기본 계산:

```text
usableMinutes =
  remainingMinutes
  - arrivalBuffer
  - globalSafetyBuffer

courseUsedMinutes =
  sum(adjustedTravelTime between points)
  + sum(policyStayTime at points)
  + sum(pointBufferTime)

courseUsedMinutes <= usableMinutes
=> 가능한 코스
```

포인트 개수는 아래 방식으로 결정합니다.

1. 먼저 취향과 반경에 맞는 후보 point를 충분히 수집합니다.
2. 후보 point마다 `policyStayTime`을 부여합니다.
3. point 간 `adjustedTravelTime`을 계산합니다.
4. 1개 point 코스부터 시작해서 가능한 조합을 확장합니다.
5. 새 point를 추가했을 때 `courseUsedMinutes`가 `usableMinutes`를 넘으면 해당 조합은 중단합니다.
6. 가능한 조합 중에서 점수가 가장 높은 코스를 추천합니다.

즉, 포인트 수는 시간 구간으로 미리 고정하는 값이 아니라 결과입니다.

```text
pointCount = 가능한 course combination의 결과값
```

시간대별로는 hard rule이 아니라 탐색 가이드만 둡니다.

| 남은 시간 | 탐색 가이드 | 실제 결정 |
| --- | --- | --- |
| 2시간 이하 | 1~2개 point 우선 탐색 | 이동/체류시간이 맞으면 2개, 아니면 1개 |
| 2~3시간 | 2개 point 우선 탐색 | 가까운 point 조합이면 3개도 가능 |
| 3~5시간 | 2~4개 point 탐색 | `usableMinutes` 안에 들어오는 만큼 |
| 6시간 이상 | 3개 이상 탐색 | 피로도와 동선 효율을 고려해 제한 |

긴 시간이 남아도 point를 무조건 많이 넣으면 안 됩니다. stop 수가 늘어날수록 이동 지연, 대기, 피로도, 다음 일정 리스크가 커지므로 `tooManyStopsRisk`를 함께 적용합니다.

### Beam Search 기반 Course Combination Search

MVP에서는 모든 가능한 장소 조합을 brute force로 전수 탐색하지 않습니다. 후보 장소 수가 늘어나면 조합 수가 급격히 커지기 때문입니다. 대신 `Beam Search`를 사용해서 각 단계에서 가능성이 높은 partial course 일부만 유지하면서 확장합니다.

기본 흐름:

```text
현재 위치

↓ 후보 point 추가

A
B
C
D
E

↓ partial course 평가

상위 beamWidth개만 유지

↓ 각 partial course에 다음 point 추가

A -> F
A -> G
C -> H
C -> I
E -> J

↓ deadline / usableMinutes 검사

다시 상위 beamWidth개만 유지

↓ 반복
```

`beamWidth`는 하드코딩하지 않고 `courseSearchPolicy.beamWidth`에서 관리합니다.

```ts
const courseSearchPolicy = {
  beamWidth: 5
};
```

새 point를 추가할 때 즉시 제거하는 조건:

```text
courseUsedMinutes > usableMinutes
=> branch 종료

역산 계산 결과 nextSchedule deadline을 만족할 수 없음
=> branch 종료

minimumSlack < 0
=> branch 종료

strongReject category 포함
=> 후보 제거
```

남은 시간에 따라 `maxDepth`를 제한할 수는 있습니다. 다만 이 값은 추천 장소 수를 고정하는 규칙이 아니라 탐색 비용 제한값입니다.

```text
짧은 시간 => 최대 2~3 point까지만 탐색
긴 시간 => maxDepth 증가
```

### 반경 전략

검색 반경은 이동방법과 남은 시간에 따라 달라져야 합니다.

| 조건 | 초기 반경 | 확장 한도 |
| --- | --- | --- |
| 도보, 2시간 이하 | 500m ~ 1.2km | 1.5km |
| 도보, 3~5시간 | 1km ~ 2km | 3km |
| 차량, 2시간 이하 | 2km ~ 4km | 6km |
| 차량, 3~5시간 | 4km ~ 8km | 12km |
| 차량, 6시간 이상 | 8km ~ 15km | 25km |

다음 일정 좌표가 있다면 현재 위치 주변만 검색하지 않고, 현재 위치에서 다음 일정으로 가는 방향 또는 중간 corridor도 함께 고려합니다.

### 후보 장소 수집

| API | 역할 |
| --- | --- |
| Kakao Local | 음식점, 카페, 쇼핑, 일반 장소, 정확한 좌표 |
| TourAPI | 관광지, 문화시설, 레포츠, 이미지 있는 장소 |
| Seoul city data | 혼잡도, 행사, 도로 교통, 상권 활성도 |
| Weather API | 실내/실외 적합도, 비/눈/더위 penalty |

### 후보 필터링 기준

아래 조건에 해당하면 scoring 전에 제거합니다.

- 좌표가 없는 장소
- 다음 일정 전까지 도착하기 어려운 장소
- 선택한 이동방법 기준으로 너무 먼 장소
- 날씨가 나쁜데 실외 중심인 장소
- 사용자가 반복적으로 싫어한 카테고리
- 주차장/지하철/편의점처럼 코스 목적지가 아니라 보조 데이터에 가까운 장소

### Course generation algorithm

1. `remainingMinutes = nextScheduleTime - currentTime`을 계산합니다.
2. `transportMode`와 남은 시간 기준으로 검색 반경을 정합니다.
3. swipe 결과로 6개 `PreferenceTag`별 `preferenceWeight`를 계산합니다.
4. Kakao Local과 TourAPI에서 후보 장소를 수집합니다.
5. `Category normalizer`로 API 원본 카테고리를 6개 `PreferenceTag`로 변환합니다.
6. `strongReject` 후보, 좌표 없음, 이동방법상 너무 먼 후보를 먼저 제거합니다.
7. Seoul city data와 Weather API로 후보의 상황 데이터를 보강합니다.
8. 후보별 `policyStayTime`과 point 간 `adjustedTravelTime`을 계산합니다.
9. `Beam Search`로 1개 point부터 partial course를 만들고 점진적으로 확장합니다.
10. point를 추가할 때마다 `usableMinutes`, 역산 deadline, `minimumSlack`을 즉시 검사합니다.
11. deadline을 만족하는 코스만 scoring하고 ranking합니다.
12. 최고 점수 코스와 2~3개의 대안 코스를 반환합니다.

### 역산 스케줄러 방식

이 서비스에서 가장 중요한 조건은 사용자가 다음 일정에 무리 없이 도착하는 것입니다. 따라서 코스는 현재 시각에서 앞으로 더하는 방식보다, `nextScheduleTime`을 기준으로 뒤에서부터 역산하는 방식이 더 적합합니다.

기본 개념:

```text
nextScheduleTime
- arrivalBuffer
- travelTimeFromLastPointToSchedule
= latestLeaveTimeFromLastPoint

latestLeaveTimeFromLastPoint
- stayTimeAtLastPoint
- travelTimeFromPreviousPointToLastPoint
= latestLeaveTimeFromPreviousPoint
```

이 계산을 마지막 point부터 첫 번째 point까지 반복합니다. 중간에 어떤 point의 `latestArrivalTime`이 현재 시각보다 이르면 해당 course combination은 불가능한 코스로 제거합니다.

필수 시간 요소:

| 요소 | 의미 | 추천 기본값 |
| --- | --- | --- |
| `currentTime` | 추천을 시작하는 현재 시각 | server time 또는 client time |
| `nextScheduleTime` | 다음 일정 시작 시각 | 사용자 필수 입력 |
| `arrivalBuffer` | 다음 일정 전에 여유 있게 도착하기 위한 buffer | 도보 10~15분, 차량 15~25분 |
| `travelTime` | point 간 기본 이동 시간 | 거리와 이동방법 기준 계산 |
| `adjustedTravelTime` | 혼잡도, 날씨, 인원수를 반영한 보정 이동 시간 | 역산 스케줄러에서 실제 사용 |
| `policyStayTime` | 각 point에서 머무는 시간 | 우리가 정한 운영 정책값 |
| `slackTime` | 전체 코스에서 남는 여유 시간 | 많을수록 안정적 |

역산 결과로 각 point마다 아래 값을 가져야 합니다.

| Field | 의미 |
| --- | --- |
| `latestArrivalTime` | 이 point에 늦어도 도착해야 하는 시각 |
| `latestLeaveTime` | 이 point에서 늦어도 출발해야 하는 시각 |
| `estimatedArrivalTime` | 실제 예상 도착 시각 |
| `estimatedLeaveTime` | 실제 예상 출발 시각 |
| `slackMinutes` | 예상 일정과 latest schedule 사이의 여유 시간 |

### 이동시간 보정 알고리즘

도보/차량 이동시간은 단순 거리만으로 계산하면 안 됩니다. 실제 서비스에서는 서울시 혼잡도, 도로 교통, 날씨, 인원수를 모두 반영한 `adjustedTravelTime`을 역산 스케줄러에 넣어야 합니다.

기본 계산식:

```text
baseTravelTime = 이동방법별 기본 이동시간

adjustedTravelTime =
  baseTravelTime *
  congestionMultiplier *
  weatherMultiplier *
  peopleMultiplier *
  transportRiskMultiplier
```

`adjustedTravelTime`은 모든 point 간 이동에 적용합니다.

```text
현재 위치 -> Point A
Point A -> Point B
Point B -> 다음 일정
```

#### Base travel time

MVP에서는 외부 route API가 안정화되기 전까지 거리 기반 추정으로 시작할 수 있습니다.

| 이동방법 | 기본 계산 |
| --- | --- |
| `walk` | 거리 km / 4.2kmh * 60 |
| `car` | 거리 km / 예상 평균속도 * 60 |

차량 평균속도는 서울시 `ROAD_TRAFFIC_STTS`가 있으면 해당 도로 속도를 우선 사용하고, 없으면 보수적으로 18~25kmh를 사용합니다.

#### Congestion multiplier

서울시 `AREA_CONGEST_LVL`은 도보 이동과 장소 체류 모두에 영향을 줍니다. 사람이 많은 지역은 걷는 속도가 느려지고, 입장/대기/이동 지연이 생길 수 있습니다.

도보 기준:

| `AREA_CONGEST_LVL` | Multiplier | 의미 |
| --- | --- | --- |
| `여유` | 1.00 | 보정 없음 |
| `보통` | 1.05 | 약간의 신호/보행 지연 |
| `약간 붐빔` | 1.15 | 보행 속도 저하 |
| `붐빔` | 1.30 | 보행/대기 지연 크게 반영 |

차량 기준:

| 교통/혼잡 상태 | Multiplier | 의미 |
| --- | --- | --- |
| 원활 | 1.00 | 보정 없음 |
| 서행 | 1.20 | 차량 이동 지연 |
| 정체 | 1.45 | 큰 지연 |
| 정보 없음 + 도심 | 1.20 | 보수적 기본값 |

차량은 `AREA_CONGEST_LVL`보다 `ROAD_TRAFFIC_STTS.AVG_ROAD_DATA.ROAD_TRAFFIC_IDX`를 우선합니다. 도로 정보가 없을 때만 지역 혼잡도를 보조 신호로 사용합니다.

#### Weather multiplier

날씨는 특히 도보와 실외 코스에 큰 영향을 줍니다.

도보 기준:

| 조건 | Multiplier |
| --- | --- |
| 맑음/흐림, 강수 없음 | 1.00 |
| `POP` 40~60 또는 약한 비 예보 | 1.10 |
| `PTY` 비/눈 또는 `PCP` 존재 | 1.25 |
| 폭우/눈/강풍 수준 | 1.40 |

차량 기준:

| 조건 | Multiplier |
| --- | --- |
| 강수 없음 | 1.00 |
| 약한 비 | 1.08 |
| 비/눈 | 1.18 |
| 폭우/눈/강풍 수준 | 1.30 |

날씨가 나쁘면 이동시간만 늘리는 것이 아니라 실외 이동이 긴 `nature` 후보에도 별도 penalty를 줍니다. 반대로 `cafe`, `culture`, `history`처럼 실내 비중이 높은 후보는 상대적으로 안정적인 코스로 볼 수 있습니다.

#### People multiplier

인원수가 많아질수록 이동과 의사결정이 느려지고, 입장/대기 리스크도 커집니다.

| `peopleCount` | Multiplier | 설명 |
| --- | --- | --- |
| 1명 | 1.00 | 보정 없음 |
| 2명 | 1.03 | 거의 보정 없음 |
| 3~4명 | 1.08 | 이동/대기 약간 증가 |
| 5명 이상 | 1.15 | 그룹 이동, 자리 확보 리스크 |

인원수는 이동시간뿐 아니라 장소 점수에도 반영합니다. 작은 카페, 혼잡한 맛집, 대기 많은 장소는 5명 이상에서 penalty를 줘야 합니다.

#### Transport risk multiplier

이동방법별로 예측 불확실성을 다르게 둡니다.

| 이동방법 | 조건 | Multiplier |
| --- | --- | --- |
| `walk` | 경로가 짧고 날씨 양호 | 1.00 |
| `walk` | 1.5km 이상 걷는 구간 | 1.10 |
| `car` | 주차 정보 없음 | 1.10 |
| `car` | 다음 일정 지역이 혼잡 | 1.15 |
| `car` | 정체 + 주차 정보 없음 | 1.25 |

#### Adjusted travel time 예시

```text
baseTravelTime = 20분
transportMode = walk
AREA_CONGEST_LVL = 약간 붐빔 => 1.15
weather = 비 예보 => 1.25
peopleCount = 4 => 1.08
transportRisk = 긴 도보 구간 없음 => 1.00

adjustedTravelTime =
  20 * 1.15 * 1.25 * 1.08 * 1.00
  = 31.05분
```

이 경우 역산 스케줄러에는 20분이 아니라 약 32분을 넣어야 합니다.

### Deadline-first filtering

역산 스케줄러에서는 점수를 계산하기 전에 deadline을 만족하지 못하는 코스를 먼저 제거합니다. 취향 점수가 아무리 높아도 다음 일정에 늦을 위험이 크면 추천하면 안 됩니다.

Hard filter:

```text
estimatedArrivalAtNextSchedule > nextScheduleTime - arrivalBuffer
=> reject

totalCourseMinutes(adjustedTravelTime 기준) > remainingMinutes - arrivalBuffer
=> reject

min(slackMinutes) < 0
=> reject
```

Risk filter:

```text
0 <= min(slackMinutes) < minimumSafeSlack
=> keep only if no better safe course exists
```

추천 `minimumSafeSlack`:

| 이동방법 | 기본값 | 이유 |
| --- | --- | --- |
| `walk` | 10분 | 길 찾기, 신호, 입장 지연 고려 |
| `car` | 20분 | 교통, 주차, 승하차 지연 고려 |

### 역산 기반 가중치 계산

기존 점수식은 취향 점수와 동선 점수를 균형 있게 섞지만, 이 서비스에서는 deadline 안정성이 가장 큰 비중을 가져야 합니다. 따라서 `deadlineSafetyScore`를 가장 높은 weight로 둡니다.

추천 scoring:

```text
courseScore =
  deadlineSafetyScore * 0.40 +
  preferenceMatchScore * 0.25 +
  routeEfficiencyScore * 0.15 +
  contextScore * 0.10 +
  groupSuitabilityScore * 0.05 +
  dataQualityScore * 0.05
```

각 score 의미:

| Score | 의미 |
| --- | --- |
| `deadlineSafetyScore` | 다음 일정에 늦지 않을 안정성 |
| `preferenceMatchScore` | swipe 좋아요/싫어요와 코스 tag가 얼마나 잘 맞는지 |
| `routeEfficiencyScore` | `adjustedTravelTime` 기준 동선이 효율적인지, 다음 일정 방향과 맞는지 |
| `contextScore` | 날씨, 혼잡도, 행사, 도로 교통이 장소 선택에 적합한지 |
| `groupSuitabilityScore` | `peopleCount`에 맞는 장소인지 |
| `dataQualityScore` | 이미지, 주소, 좌표, 카테고리, 상세 URL 품질 |

`deadlineSafetyScore` 계산 예시:

```text
minimumSlack = course 안에서 가장 작은 slackMinutes
targetSlack = transportMode가 walk면 20분, car면 35분

deadlineSafetyScore = clamp(minimumSlack / targetSlack, 0, 1)
```

예시:

| 이동방법 | `minimumSlack` | `targetSlack` | `deadlineSafetyScore` |
| --- | --- | --- | --- |
| `walk` | 5분 | 20분 | 0.25 |
| `walk` | 20분 | 20분 | 1.0 |
| `car` | 15분 | 35분 | 0.43 |
| `car` | 35분 | 35분 | 1.0 |

차량 이동은 교통 변동성이 크기 때문에 `targetSlack`을 더 크게 잡습니다.

### Risk penalty

deadline은 단순히 시간 안에 들어오는지만 보면 부족합니다. 혼잡도, 날씨, 차량 정체처럼 실제 지연 가능성이 있는 요소는 risk penalty로 반영합니다.

```text
riskPenalty =
  trafficDelayRisk +
  weatherDelayRisk +
  congestionDelayRisk +
  tooManyStopsRisk

adjustedDeadlineSafetyScore =
  clamp(deadlineSafetyScore - riskPenalty, 0, 1)
```

추천 penalty:

| Risk | 조건 | Penalty |
| --- | --- | --- |
| `trafficDelayRisk` | `transportMode=car`이고 도로 정체 | 0.10~0.25 |
| `weatherDelayRisk` | 비/눈 + 도보 이동 또는 실외 장소 | 0.10~0.20 |
| `congestionDelayRisk` | 방문 지역 `AREA_CONGEST_LVL=붐빔` | 0.05~0.15 |
| `peopleDelayRisk` | `peopleCount >= 5`이고 혼잡 지역/작은 장소 | 0.05~0.15 |
| `tooManyStopsRisk` | 남은 시간 대비 stop 수가 많음 | 0.05~0.20 |

최종적으로는 기존 `deadlineSafetyScore` 대신 `adjustedDeadlineSafetyScore`를 courseScore에 넣습니다.

```text
courseScore =
  adjustedDeadlineSafetyScore * 0.40 +
  preferenceMatchScore * 0.25 +
  routeEfficiencyScore * 0.15 +
  contextScore * 0.10 +
  groupSuitabilityScore * 0.05 +
  dataQualityScore * 0.05
```

### 역산 스케줄러 예시

조건:

```text
currentTime = 14:00
nextScheduleTime = 17:00
transportMode = walk
arrivalBuffer = 15분
```

다음 일정에는 늦어도 16:45까지 도착해야 합니다.

```text
17:00 nextScheduleTime
- 15분 arrivalBuffer
= 16:45 latestArrivalAtNextSchedule
```

2개 point 코스 예시:

```text
Point B -> 다음 일정 이동 20분
Point B 체류 40분
Point A -> Point B 이동 15분
Point A 체류 50분
현재 위치 -> Point A 이동 10분
```

역산:

```text
16:45 다음 일정 도착 deadline
- 20분 B에서 다음 일정 이동
= 16:25 B 출발 deadline
- 40분 B 체류
= 15:45 B 도착 deadline
- 15분 A에서 B 이동
= 15:30 A 출발 deadline
- 50분 A 체류
= 14:40 A 도착 deadline
- 10분 현재 위치에서 A 이동
= 14:30 출발 가능 deadline
```

현재 시각이 14:00이면 slack이 30분이므로 가능한 코스입니다. 현재 시각이 14:35라면 첫 point부터 일정이 밀리므로 이 코스는 제거하거나 stop 수를 줄여야 합니다.

### Policy stay time

카테고리별 체류시간은 외부 평균값을 그대로 쓰지 않고, 우리가 서비스 정책값으로 정한 `policyStayTime`을 사용합니다. 이 값은 "실제 평균 체류시간"이 아니라 추천 알고리즘이 코스를 만들 때 사용하는 운영 기준값입니다.

이 방식을 쓰는 이유:

- 외부 API만으로는 장소별 실제 체류시간을 안정적으로 알기 어렵습니다.
- 평균값은 사용자 상황과 서비스 UX에 맞지 않을 수 있습니다.
- MVP에서는 예측 정확도보다 다음 일정에 늦지 않는 안정성이 더 중요합니다.
- 운영하면서 로그를 보고 정책값을 조정하는 편이 더 현실적입니다.

초기 `policyStayTime` 예시:

| Category | `policyStayTime` | 조정 방향 |
| --- | --- | --- |
| `cafe` | 40분 | 짧은 코스에서 30분까지 축소 가능 |
| `food` | 60분 | 식사 시간대에는 70분까지 증가 |
| `nature` | 45분 | 산책 코스는 이동시간과 합쳐서 관리 |
| `culture` | 75분 | 전시/공연 성격에 따라 증가 |
| `history` | 60분 | 궁궐/유적 규모에 따라 증가 |
| `activity` | 90분 | 예약/체험형은 길게 설정 |

`policyStayTime`은 고정 상수가 아니라 설정값으로 관리합니다.

```ts
type StayTimePolicy = {
  defaultMinutes: number;
  minMinutes: number;
  maxMinutes: number;
};

type StayTimePolicyMap = Record<PreferenceTag, StayTimePolicy>;
```

예시:

```json
{
  "cafe": { "defaultMinutes": 40, "minMinutes": 30, "maxMinutes": 50 },
  "food": { "defaultMinutes": 60, "minMinutes": 50, "maxMinutes": 75 },
  "activity": { "defaultMinutes": 90, "minMinutes": 70, "maxMinutes": 120 }
}
```

조정 규칙:

| 조건 | 조정 |
| --- | --- |
| 남은 시간이 부족함 | `minMinutes` 쪽으로 줄임 |
| slack이 충분함 | `defaultMinutes` 유지 |
| 사용자가 해당 카테고리를 강하게 선호 | `maxMinutes` 쪽으로 늘릴 수 있음 |
| 다음 일정 리스크가 큼 | `minMinutes` 사용 |
| 인원수가 많음 | 체류시간보다 이동/대기 buffer를 늘림 |

중요한 점은 체류시간을 늘려서 코스를 풍성하게 만드는 것보다, 다음 일정 도착 안정성을 우선하는 것입니다. 따라서 `policyStayTime`을 줄여도 코스 만족도가 크게 떨어지지 않는 카테고리부터 압축합니다.

압축 우선순위:

```text
cafe -> nature -> history -> food -> culture -> activity
```

`activity`는 성격상 체류시간을 임의로 줄이면 경험이 깨질 수 있으므로, 시간이 부족하면 시간을 줄이기보다 해당 point를 제거하는 편이 낫습니다.

### Scoring formula 요약

최종 scoring은 deadline 안정성을 가장 우선합니다.

```text
courseScore =
  adjustedDeadlineSafetyScore * 0.40 +
  preferenceMatchScore * 0.25 +
  routeEfficiencyScore * 0.15 +
  contextScore * 0.10 +
  groupSuitabilityScore * 0.05 +
  dataQualityScore * 0.05
```

취향이 잘 맞는 코스라도 `deadlineSafetyScore`가 낮으면 추천 순위가 크게 내려가야 합니다. `adjustedDeadlineSafetyScore`가 0이면 해당 코스는 추천 후보에서 제거하는 것이 맞습니다.

### Weight와 Multiplier 관리

`Weight`와 `Multiplier`는 서로 다른 개념입니다.

`Weight`는 최종 추천 순위에서 어떤 score를 얼마나 중요하게 볼지 정하는 값입니다.

```ts
const courseScoreWeights = {
  deadlineSafety: 0.40,
  preferenceMatch: 0.25,
  routeEfficiency: 0.15,
  context: 0.10,
  groupSuitability: 0.05,
  dataQuality: 0.05
};
```

`Multiplier`는 실제 예상 이동시간을 보수적으로 보정하는 값입니다.

```text
adjustedTravelTime =
baseTravelTime
* congestionMultiplier
* weatherMultiplier
* peopleMultiplier
* transportRiskMultiplier
```

두 값 모두 확정된 과학적 수치가 아니라 MVP 초기 policy 값입니다. 알고리즘 함수 내부에 `1.15`, `0.40` 같은 magic number를 직접 쓰지 않고 [src/recommendation/policy.ts](src/recommendation/policy.ts) 한 곳에서 관리합니다.

추후 튜닝 예시:

| 문제 상황 | 조정 방향 |
| --- | --- |
| 안전성을 너무 강조해서 항상 가까운 장소만 추천됨 | `preferenceMatch` 또는 `routeEfficiency` weight 조정 |
| 취향은 맞지만 deadline 여유가 너무 적음 | `deadlineSafety` weight 또는 buffer 정책 강화 |
| 비가 조금만 와도 이동시간이 지나치게 증가함 | weather multiplier 완화 |
| 차량 코스가 주차 리스크를 과소평가함 | transport risk multiplier 강화 |

### 이동방법별 규칙

`walk`일 때:

- 장소 간 거리가 짧은 compact course를 우선합니다.
- 비/눈/강수확률이 높으면 실외 이동과 실외 장소에 penalty를 줍니다.
- 날씨가 나쁘면 실외 이동이 긴 `nature`에 penalty를 주고 `cafe`, `culture`, `history`를 상대적으로 우선합니다.
- 시간이 남아도 stop이 너무 많으면 피로도가 높아지므로 penalty를 줍니다.

`car`일 때:

- 도보보다 넓은 반경을 허용합니다.
- Seoul road traffic 데이터를 사용할 수 있으면 정체 구간에 penalty를 줍니다.
- 주차 관련 데이터가 추가되면 주차 가능 장소를 boost합니다.
- 취향 점수가 조금 높더라도 동선이 크게 돌아가면 penalty를 줍니다.

### 구현에 더 필요한 것들

추천 알고리즘을 실제로 구현하려면 backend에 아래 모듈이 필요합니다.

| 필요한 모듈 | 목적 |
| --- | --- |
| Category normalizer | Kakao/TourAPI 카테고리를 내부 `PreferenceTag`로 변환 |
| Travel time estimator | 도보/차량 기준 point 간 이동시간 계산 |
| Travel time adjuster | 혼잡도, 날씨, 인원수, 교통 리스크를 반영해 `adjustedTravelTime` 계산 |
| Stay time policy manager | 카테고리별 `policyStayTime` 설정과 조정 |
| Remaining time calculator | 다음 일정 시간까지 남은 시간 계산 |
| Swipe preference scorer | swipe 결과를 preference weight로 변환 |
| Candidate collector | Kakao/TourAPI 후보 장소 수집 및 병합 |
| Context enricher | 날씨, 혼잡도, 교통, 행사 데이터 보강 |
| Course combination builder | `usableMinutes` 안에서 가능한 multi-point course 조합 생성 |
| Course scorer | 개별 장소가 아니라 전체 course 기준으로 ranking |
| Explanation generator | 추천 이유 생성 |
| Cache layer | 같은 지역/시간대 외부 API 반복 호출 방지 |

### 현재 코드 파일 역할

현재 구현된 추천 알고리즘 관련 파일 역할은 아래와 같습니다.

| 파일 | 역할 |
| --- | --- |
| `src/recommendation/policy.ts` | weight, multiplier, threshold, `beamWidth`, stay time policy 관리 |
| `src/recommendation/normalizer.ts` | Kakao/TourAPI/manual category를 6개 `PreferenceTag`로 변환 |
| `src/recommendation/preferenceScorer.ts` | swipe 결과로 `preferenceWeight`, `strongReject` 계산 |
| `src/recommendation/candidateCollector.ts` | Kakao/TourAPI/manual 후보 수집 및 normalize |
| `src/recommendation/feasibilityFilter.ts` | `strongReject` 후보 제거 |
| `src/recommendation/travelTime.ts` | `baseTravelTime`, `adjustedTravelTime` 계산 |
| `src/recommendation/stayTimePolicy.ts` | `policyStayTime` 계산 |
| `src/recommendation/reverseScheduler.ts` | `nextScheduleTime` 기준 역산 스케줄링 |
| `src/recommendation/routeBuilder.ts` | Beam Search 기반 course combination 생성 |
| `src/recommendation/scorer.ts` | course score와 score breakdown 계산 |
| `src/recommendation/recommendationEngine.ts` | 전체 추천 알고리즘 orchestration |
| `src/services/recommendation.service.ts` | API payload를 추천 엔진 입력으로 변환 |

### 최종 추천 알고리즘 실행 순서

```text
[사용자 입력]
currentLocation
nextScheduleLocation
nextScheduleTime
peopleCount
transportMode
swipe results

        ↓

[Swipe Preference Scorer]
6개 PreferenceTag별 preferenceWeight 계산
strongReject tag 계산

        ↓

[Candidate Collector]
Kakao Local
TourAPI
manual candidates

        ↓

[Category Normalizer]
API 원본 category
→ 6개 PreferenceTag

        ↓

[Context Enricher]
Weather
Seoul congestion / traffic

        ↓

[Hard Filter]
좌표 없음
이동방법상 너무 멂
strongReject
상황상 방문 불가능

        ↓

[Travel Time]
baseTravelTime
→ adjustedTravelTime

        ↓

[Stay Time Policy]
policyStayTime 적용

        ↓

[Beam Search]
1 point partial course 생성
→ point 추가
→ usableMinutes 검사
→ 역산 스케줄러 실행
→ deadline 불가능 branch 즉시 제거
→ partial course 평가
→ 상위 beamWidth개만 유지
→ 다음 point 확장 반복

        ↓

[Deadline-first Filtering]
다음 일정에 늦는 코스 제거
slack < 0 제거

        ↓

[Course Scoring]
deadlineSafetyScore
preferenceMatchScore
routeEfficiencyScore
contextScore
groupSuitabilityScore
dataQualityScore

        ↓

[Ranking]
최종 courseScore 순 정렬

        ↓

[결과]
최적 코스 1개
대안 코스 2~3개
추천 이유
```

### MVP 범위

첫 번째 동작 버전은 아래 범위로 제한하는 것이 현실적입니다.

1. 필수 입력: 현재 위치, 다음 일정 시간, 인원수, 이동방법
2. Swipe card: 8~10개 카테고리 카드
3. 후보 API: Kakao Local + TourAPI
4. 상황 API: Weather 먼저 적용, Seoul congestion은 다음 단계
5. 코스 크기: 포인트 개수 고정 없이 `adjustedTravelTime + policyStayTime + bufferTime` 기준으로 동적 산정
6. 결과: 최적 코스 1개 + 대안 코스 2~3개 + 추천 이유

초기 MVP에서는 정확한 가격, 영업시간, 예약 가능 여부, 실시간 수용 인원까지 해결하려고 하지 않습니다. 해당 데이터는 신뢰할 수 있는 API가 확보된 뒤 추가하는 것이 좋습니다.

## 알고리즘 테스트 시나리오

아래 명령으로 현재 추천 알고리즘의 MVP 동작을 확인할 수 있습니다.

```powershell
npx.cmd tsx src/scripts/testRecommendationAlgorithm.ts
```

현재 테스트 시나리오:

| 시나리오 | 목적 | 결과 |
| --- | --- | --- |
| `deadline-safe nearby schedule` | 다음 일정이 가까울 때 deadline-safe course가 생성되는지 확인 | 성수 카페, 공방 체험, 서울숲 후보가 ranking됨 |
| `deadline-rejected far schedule` | 다음 일정이 도보로 너무 먼 경우 deadline-first filter가 동작하는지 확인 | 추천 코스 없음 |
| `strong-reject culture category` | 같은 카테고리 반복 dislike 시 `strongReject`가 동작하는지 확인 | `culture`가 `strongRejectTags`에 포함되고 문화 후보가 제거됨 |

확인된 preference weight 예시:

```json
{
  "cafe": 0.67,
  "food": 0,
  "nature": 0.5,
  "culture": -0.5,
  "history": 0,
  "activity": 0
}
```

확인된 deadline-safe 결과 예시:

```text
1위: 성수 카페
pointCount: 1
minimumSlackMinutes: 86
totalCourseMinutes: 94
score: 0.8998
```

## Postman Troubleshooting

공공데이터 API에서 아래 응답이 나오면 인증키가 틀렸다는 뜻보다 `serviceKey` parameter가 서버에 전달되지 않았다는 뜻입니다.

```xml
<errMsg>SERVICE_KEY_IS_NULL</errMsg>
<returnAuthMsg>서비스 접근거부</returnAuthMsg>
<returnReasonCode>20</returnReasonCode>
```

확인할 것:

- query parameter 이름은 정확히 `serviceKey`여야 합니다.
- 공공데이터 API key는 `Authorization` header에 넣지 않습니다.
- Postman variable을 쓴다면 실제 값이 비어 있지 않은지 확인합니다.
- key에 `%2B`, `%2F`, `%3D` 같은 문자가 있으면 double encoding을 조심합니다.
- 안 되면 `?serviceKey=...`가 포함된 전체 URL을 직접 붙여서 테스트합니다.

Kakao API는 예외적으로 `Authorization: KakaoAK {key}` header를 사용합니다.
