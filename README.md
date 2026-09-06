# Jaturip

Jaturip은 다음 일정 전까지 남는 시간 안에서 안전하게 다녀올 수 있는 짧은 코스를 추천하는 서비스입니다.

현재 프론트엔드는 팀 디자인 파일인 `design5.html`의 모바일 UI 흐름을 `frontend/` React + TypeScript + Vite 앱으로 통합한 상태입니다. 별도 프론트 프로젝트를 추가하지 않고 기존 `frontend/`만 실제 서비스 프론트로 사용합니다.

## Project Structure

```text
jaturip/
  frontend/   React + TypeScript + Vite, design5 기반 실제 프론트
  backend/    Express + TypeScript 추천 API
  database/   MySQL schema and seed files
  docs/       API and recommendation notes
  design5.html
```

## Connected User Flow

```text
현재 위치/다음 일정/인원/이동수단
-> 6개 PreferenceTag swipe
-> POST /api/recommendation
-> backend recommendation engine
-> 추천 코스
-> timeline/map
```

프론트가 자체 추천 알고리즘으로 코스를 만들지 않습니다. 추천 장소, 이동시간, 체류시간, 도착시각, slack, 대안 코스 데이터는 백엔드 응답을 기준으로 렌더링합니다.

## Frontend

현재 구현:

- `design5.html` 기반 start, setup, taste, loading, course, map 화면
- 브라우저 Geolocation API로 실제 현재 위치 확인
- `/api/places`를 통한 다음 일정 장소 검색
- `walk`, `car` 이동수단 UI
- 1~5명 인원 선택
- 다음 일정 있음 모드
- 일정 없음 모드: `현재 시각 + freeMin`을 deadline으로 변환하고 현재 위치를 복귀 지점으로 사용
- 6개 PreferenceTag swipe
- 오른쪽 swipe는 `like`, 왼쪽 swipe는 `dislike`로 `swipeFeedbacks`에 기록
- 추천 요청 중 loading 화면
- API 실패 화면과 재시도
- 빈 추천 결과 empty state
- 추천 결과 timeline
- 실제 응답 좌표 기반 MapLibre marker와 OSRM route fallback

PreferenceTag:

```text
cafe     -> 카페·디저트
food     -> 맛집·먹거리
nature   -> 산책·자연
culture  -> 전시·문화
history  -> 역사·전통
activity -> 체험·놀거리
```

제거/비활성화한 mock 동작:

- `design5.html`의 `CARDS` 중 백엔드에 없는 `book`, `market`, `art` tag 직접 사용 제거
- `PLACES`, `DESTS`, `HERE`, `COORD`, `DEST_COORD` 기반 추천 결과 생성 제거
- 프론트 자체 `schedule()` / `buildCourse()` 기반 코스 생성 제거
- API 실패 시 mock course fallback 없음
- 장소 추가/삭제는 백엔드 재계산 API가 아직 없어서 실제 기능처럼 노출하지 않음

## Backend APIs

### Health

```text
GET /api/health
```

### Place Search

```text
GET /api/places?query=DCC&latitude=36.362&longitude=127.384
```

Kakao REST API key는 백엔드에서만 사용합니다. 프론트에는 노출하지 않습니다.

응답 shape:

```json
{
  "success": true,
  "query": "DCC",
  "items": [
    {
      "id": "7831234",
      "name": "대전컨벤션센터",
      "address": "대전 유성구 도룡동 4-19",
      "roadAddress": "대전 유성구 엑스포로 107",
      "lat": 36.37523136950924,
      "lng": 127.39166507016067
    }
  ]
}
```

### Recommendation

```text
POST /api/recommendation
```

프론트는 Vite proxy를 통해 상대경로 `/api/recommendation`으로 호출합니다.

실제 요청 shape:

```json
{
  "currentLatitude": 36.362,
  "currentLongitude": 127.384,
  "nextScheduleTime": "2026-09-06T12:27:06.519Z",
  "nextScheduleLatitude": 36.3748,
  "nextScheduleLongitude": 127.3878,
  "peopleCount": 2,
  "transportMode": "walk",
  "swipeFeedbacks": [
    { "cardId": "cafe-1", "action": "like", "tags": ["cafe"] },
    { "cardId": "culture-1", "action": "dislike", "tags": ["culture"] }
  ],
  "nextSchedule": {
    "name": "DCC",
    "time": "2026-09-06T12:27:06.519Z",
    "latitude": 36.3748,
    "longitude": 127.3878,
    "placeName": "DCC"
  }
}
```

응답은 `data.mainCourse`, `data.courses`, `data.alternatives`를 포함합니다. 추천이 없으면 `success: true`, `status: "no_recommendation"`, `mainCourse: null`로 내려오며 프론트는 가짜 장소를 만들지 않습니다.

## Environment Variables

백엔드에서 사용하는 환경변수 이름:

```text
PORT
NODE_ENV
DB_HOST
DB_PORT
DB_USERNAME
DB_PASSWORD
DB_NAME
KAKAO_REST_API_KEY
KAKAO_REST_KEY
KAKAO_JS_API_KEY
TOURAPI_SERVICE_KEY
DATA_GO_KR_KEY
WEATHER_API_KEY
WEATHER_KR_API_KEY
SEOUL_DATA_API_KEY
SEOUL_API_KEY
```

API key 값은 소스와 README에 기록하지 않습니다.

## Local Setup

Backend:

```powershell
cd backend
npm.cmd install
npm.cmd run dev
```

Frontend:

```powershell
cd frontend
npm.cmd install
npm.cmd run dev
```

URLs:

```text
Backend  http://localhost:4000
Frontend http://localhost:5173/
```

## Test Commands

Build:

```powershell
cd backend
npm.cmd run build

cd ..\frontend
npm.cmd run build
```

Health:

```powershell
Invoke-RestMethod http://localhost:4000/api/health
Invoke-RestMethod http://localhost:5173/api/health
```

Place search:

```powershell
Invoke-RestMethod "http://localhost:5173/api/places?query=DCC&latitude=36.362&longitude=127.384"
```

Recommendation smoke test:

```powershell
$deadline=(Get-Date).AddHours(4).ToString('o')
$body=@{
  currentLatitude=36.362
  currentLongitude=127.384
  nextScheduleTime=$deadline
  nextScheduleLatitude=36.3748
  nextScheduleLongitude=127.3878
  peopleCount=2
  transportMode='walk'
  swipeFeedbacks=@(
    @{cardId='cafe-1';action='like';tags=@('cafe')},
    @{cardId='food-1';action='like';tags=@('food')},
    @{cardId='nature-1';action='dislike';tags=@('nature')}
  )
  nextSchedule=@{name='DCC';time=$deadline;latitude=36.3748;longitude=127.3878;placeName='DCC'}
} | ConvertTo-Json -Depth 8
Invoke-RestMethod "http://localhost:5173/api/recommendation" -Method Post -ContentType "application/json" -Body $body
```

## Verified In This Update

```text
backend build: success
frontend build: success
GET http://localhost:4000/api/health: 200
GET http://localhost:5173/api/health: 200 through Vite proxy
GET /api/places?query=DCC...: success, normalized Kakao place data returned
POST /api/recommendation through Vite proxy: success, status ok, 2 stops, alternatives returned
POST /api/recommendation with 5 minute deadline: success, status no_recommendation, no mock fallback
GET http://localhost:5173/: 200
```

Browser automation note:

```text
Playwright is not installed in frontend/node_modules.
The in-app browser connector was unavailable in this session, so visual click-through automation and Network tab inspection were not executed here.
```

## Current Limitations

- MapLibre and OSRM route rendering are loaded at runtime from CDN/public routing services. If those fail, markers and a straight-line fallback remain.
- 장소 추가/삭제 재계산은 백엔드 API가 없어서 이번 UI에서는 실제 기능으로 노출하지 않습니다.
- 대안 코스는 백엔드 응답을 보존하지만 현재 화면에서는 주 추천 코스를 우선 표시합니다.
