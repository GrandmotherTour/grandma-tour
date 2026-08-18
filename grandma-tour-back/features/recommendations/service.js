// repository로 데이터 가져오고 알고리즘 실행

const path = require("path");
const { spawn } = require("child_process");

const recommendationRepository = require("./repository");
const tourApi = require("../poi/tourApiClient");
const { parseOperatingHours } = require("../poi/operatingHoursParser");
const { resolveDuration } = require("../poi/durationResolver");


/**
 * DB의 여행 날짜를 TourAPI 형식(YYYYMMDD)으로 변환
 *
 * 예:
 * 2026-11-05 -> 20261105
 */
function toTourApiDate(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}


/**
 * 추천 결과 생성
 */
async function getRecommendations(surveyId, topN = 3) {
  const input = await recommendationRepository.loadRecommendationInput(
    surveyId,
    "taxi"
  );

  let festivals = [];

  // ─────────────────────────────────────────────
  // 축제 포함 여부 확인
  // ─────────────────────────────────────────────
  //
  // 다음 조건을 모두 만족할 때만 축제 API를 호출한다.
  //
  // 1. 사용자가 축제 포함에 동의함
  // 2. 여행 날짜가 존재함
  // 3. 지역 법정동 코드가 존재함
  //
  if (
    input.survey.include_festival &&
    input.survey.travel_date &&
    input.region?.l_dong_regn_cd &&
    input.region?.l_dong_signgu_cd
  ) {
    const travelDate = toTourApiDate(input.survey.travel_date);

    if (travelDate) {
      // ─────────────────────────────────────────
      // 1. 여행 날짜에 열리는 축제 검색
      // ─────────────────────────────────────────
      festivals = await tourApi.getFestivals({
        eventStartDate: travelDate,
        eventEndDate: travelDate,
        lDongRegnCd: input.region.l_dong_regn_cd,
        lDongSignguCd: input.region.l_dong_signgu_cd,
      });

      // ─────────────────────────────────────────
      // 2. 각 축제의 detailIntro 조회
      // ─────────────────────────────────────────
      festivals = await Promise.all(
        festivals.map(async (festival) => {
          const intro = await tourApi.getDetailIntro(
            festival.contentid,
            Number(festival.contenttypeid)
          );

          return {
            ...festival,
            intro,
          };
        })
      );

      // ─────────────────────────────────────────
      // 3. CP-SAT에서 사용하기 쉬운 형태로 정규화
      // ─────────────────────────────────────────
      festivals = festivals.map((festival) => {
        const useTimeRaw = festival.intro?.playtime || null;

        // "08:00~20:30" → [{ start: 480, end: 1230 }]
        const hours = parseOperatingHours(useTimeRaw);

        // 일반 POI와 동일한 체류시간 결정 정책 사용
        const duration = resolveDuration({
          content_type_id: 15,
          raw: {
            intro: festival.intro || {},
            common: festival,
          },
        });

        return {
          contentId: festival.contentid,
          name: festival.title,

          latitude: festival.mapy
            ? Number(festival.mapy)
            : null,

          longitude: festival.mapx
            ? Number(festival.mapx)
            : null,

          eventStartDate: festival.eventstartdate,
          eventEndDate: festival.eventenddate,

          durationMin: duration.value,
          durationSource: duration.source,

          useTimeRaw,
          openWindows: hours.windows,
          hoursSource: hours.source,

          useFeeRaw:
            festival.intro?.usetimefestival || null,

          eventPlace:
            festival.intro?.eventplace || null,

          // 일반 가이드 POI와 구분
          pointType: "festival",

          // 축제에는 별도 가이드를 붙이지 않음
          guideRequired: false,
        };
      });
    }
  }

  // 지금 단계에서 축제가 제대로 잡히는지 확인하기 위한 로그
  console.log(
    "[recommendations] festivals:",
    JSON.stringify(festivals, null, 2)
  );

  // Python CP-SAT에 전달
  const payload = {
    ...input,
    festivals,
    topN,
  };

  return runCpSat(payload);
}


/**
 * Python CP-SAT 실행
 */
function runCpSat(payload) {
  return new Promise((resolve, reject) => {
    const pythonBin = process.env.PYTHON_BIN || "python3";
    const scriptPath = path.join(__dirname, "recommender.py");

    const child = spawn(pythonBin, [scriptPath], {
      stdio: ["pipe", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    child.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    child.on("error", reject);

    child.on("close", (code) => {
      if (code !== 0) {
        return reject(
          new Error(
            `CP-SAT process failed with code ${code}: ${stderr}`
          )
        );
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(
            `Failed to parse CP-SAT output: ${stdout}\n${error.message}`
          )
        );
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}


module.exports = {
  getRecommendations,
};