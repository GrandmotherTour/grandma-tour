// repository로 데이터 가져오고 알고리즘 실행

const path = require("path");
const { spawn } = require("child_process");
const recommendationRepository = require("./repository");

async function getRecommendations(surveyId, topN = 3) {
  const input = await recommendationRepository.loadRecommendationInput(
    surveyId,
    "taxi"
  );

  const payload = {
    ...input,
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
