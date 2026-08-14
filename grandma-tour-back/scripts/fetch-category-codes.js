#!/usr/bin/env node
// TourAPI 분류 코드표를 받아 features/poi/data/categoryCodes.json 에 고정한다.
//
// 왜 고정하는가: 코드표는 거의 변하지 않는데 매 파이프라인 실행마다 조회하면
// 쿼터를 40회 이상 태운다. 갱신이 필요할 때만 이 스크립트를 돌린다.
//
//   node -r dotenv/config grandma-tour-back/scripts/fetch-category-codes.js
//
// 두 체계를 모두 받는다.
//   구 분류  cat1/cat2/cat3        ← categoryCode2 (3단 순회)
//   신 분류  lclsSystm1/2/3        ← lclsSystmCode2 (lclsSystmListYn=Y 로 1단계당 한 번)

const path = require("path");
const fs = require("fs");
const tourApi = require("../features/poi/tourApiClient");

const OUT_PATH = path.join(__dirname, "..", "features", "poi", "data", "categoryCodes.json");
const BASE_URL =
  process.env.TOUR_API_BASE_URL || "http://apis.data.go.kr/B551011/KorService2";

function serviceKey() {
  const raw = process.env.TOUR_API_KEY || "";
  return /%[0-9A-Fa-f]{2}/.test(raw) ? raw : encodeURIComponent(raw);
}

// lclsSystmCode2 는 tourApiClient 에 래퍼가 없어 직접 부른다.
// 이 스크립트 전용이므로 클라이언트를 늘리지 않았다.
async function fetchLcls(params = "") {
  const url =
    `${BASE_URL}/lclsSystmCode2?serviceKey=${serviceKey()}` +
    `&MobileOS=ETC&MobileApp=GrandmaTour&_type=json&numOfRows=1000&pageNo=1${params}`;
  const json = JSON.parse(await (await fetch(url)).text());
  const code = json?.response?.header?.resultCode ?? json?.resultCode;
  if (code && code !== "0000" && code !== "00") {
    throw new Error(`lclsSystmCode2 오류 [${code}] ${json?.resultMsg || ""}`);
  }
  const item = json?.response?.body?.items?.item;
  return Array.isArray(item) ? item : item ? [item] : [];
}

async function main() {
  if (tourApi.isMockMode()) {
    throw new Error(
      "mock 모드에서는 코드표를 받을 수 없습니다. POI_SOURCE_MODE=live 와 TOUR_API_KEY 를 설정하세요."
    );
  }

  // ── 신 분류 ──
  // lclsSystmListYn=Y 를 주면 1~3단계가 이름까지 평면으로 한 번에 온다.
  const lclsSystm3 = {};
  const level1 = await fetchLcls("");
  for (const top of level1) {
    for (const row of await fetchLcls(`&lclsSystmListYn=Y&lclsSystm1=${top.code}`)) {
      lclsSystm3[row.lclsSystm3Cd] = {
        l1: row.lclsSystm1Cd,
        l1Name: row.lclsSystm1Nm,
        l2: row.lclsSystm2Cd,
        l2Name: row.lclsSystm2Nm,
        name: row.lclsSystm3Nm,
      };
    }
  }

  // ── 구 분류 ──
  const cat3 = {};
  const cat1List = await tourApi.getCategoryCodes({});
  for (const c1 of cat1List) {
    for (const c2 of await tourApi.getCategoryCodes({ cat1: c1.code })) {
      for (const c of await tourApi.getCategoryCodes({ cat1: c1.code, cat2: c2.code })) {
        cat3[c.code] = {
          cat1: c1.code,
          cat1Name: c1.name,
          cat2: c2.code,
          cat2Name: c2.name,
          name: c.name,
        };
      }
    }
  }

  const payload = {
    _meta: {
      source: "TourAPI KorService2 categoryCode2 / lclsSystmCode2",
      fetchedAt: new Date().toISOString().slice(0, 10),
      note: "실호출로 받아 고정한 코드표. 재생성: grandma-tour-back/scripts/fetch-category-codes.js",
    },
    cat3,
    lclsSystm3,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(payload, null, 1));
  console.log(
    `저장: ${OUT_PATH}\n  cat3 ${Object.keys(cat3).length}종 · lclsSystm3 ${
      Object.keys(lclsSystm3).length
    }종`
  );
}

main().catch((err) => {
  console.error("실패:", err.message);
  process.exit(1);
});
