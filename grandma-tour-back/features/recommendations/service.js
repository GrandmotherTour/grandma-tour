// repository로 데이터 가져오고 알고리즘 실행

const path = require("path");
const { spawn } = require("child_process");
const recommendationRepository = require("./repository");
const tourApi = require("../poi/tourApiClient");

function toTourApiDate(value) {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}${month}${day}`;
}

async function getRecommendations(surveyId, topN = 3) {
  const input = await recommendationRepository.loadRecommendationInput(
    surveyId,
    "taxi"
  );

  let festivals = [];

  if (
    input.survey.include_festival &&
    input.survey.travel_date &&
    input.region?.l_dong_regn_cd &&
    input.region?.l_dong_signgu_cd
  ) {
    const travelDate = toTourApiDate(input.survey.travel_date);

    if (travelDate) {
      festivals = await tourApi.getFestivals({
        eventStartDate: travelDate,
        eventEndDate: travelDate,
        lDongRegnCd: input.region.l_dong_regn_cd,
        lDongSignguCd: input.region.l_dong_signgu_cd,
      });
    }
  }

  const payload = {
    ...input,
    festivals,
    topN,
  };
  
  return runCpSat(payload);
}

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
          new Error(`CP-SAT process failed with code ${code}: ${stderr}`)
        );
      }

      try {
        resolve(JSON.parse(stdout));
      } catch (error) {
        reject(
          new Error(`Failed to parse CP-SAT output: ${stdout}\n${error.message}`)
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
