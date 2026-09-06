import { removeDuplicatePlaces } from '../candidates/duplicateDetector';
import { normalizeKakaoPlace } from '../normalizers/kakao.normalizer';
import { normalizeSeoulContext } from '../normalizers/seoul.normalizer';
import { normalizeTourApiPlace } from '../normalizers/tourApi.normalizer';
import { normalizeWeatherContext } from '../normalizers/weather.normalizer';

const assert = (condition: unknown, message: string) => {
  if (!condition) {
    throw new Error(message);
  }
};

const kakaoRaw = {
  id: '22716674',
  place_name: '노랑저고리 강남점',
  category_group_code: 'FD6',
  category_group_name: '음식점',
  category_name: '음식점 > 한식 > 한정식',
  phone: '02-534-5300',
  address_name: '서울 서초구 서초동 1316-29',
  road_address_name: '서울 서초구 서초대로73길 9',
  x: '127.0253484614826',
  y: '37.49829326602763',
  place_url: 'http://place.map.kakao.com/22716674'
};

const tourRaw = {
  contentid: '581825',
  contenttypeid: '39',
  title: '노랑저고리',
  addr1: '서울특별시 서초구 서초대로73길 9 (서초동)',
  addr2: '5층',
  mapx: '127.0252436924',
  mapy: '37.4983602268',
  firstimage: '',
  firstimage2: '',
  cat1: 'A05',
  cat2: 'A0502',
  cat3: 'A05020100',
  tel: ''
};

const invalidTourRaw = {
  contentid: 'bad',
  title: '좌표 없는 장소',
  mapx: undefined,
  mapy: 'not-a-number',
  cat1: undefined
};

const weatherRaw = {
  response: {
    body: {
      items: {
        item: [
          { fcstDate: '20260902', fcstTime: '0600', category: 'TMP', fcstValue: '23' },
          { fcstDate: '20260902', fcstTime: '0600', category: 'PTY', fcstValue: '0' },
          { fcstDate: '20260902', fcstTime: '0600', category: 'POP', fcstValue: '30' },
          { fcstDate: '20260902', fcstTime: '0600', category: 'WSD', fcstValue: '0.1' },
          { fcstDate: '20260902', fcstTime: '0600', category: 'PCP', fcstValue: '강수없음' },
          { fcstDate: '20260902', fcstTime: '0600', category: 'SKY', fcstValue: '4' }
        ]
      }
    }
  }
};

const seoulRaw = {
  CITYDATA: {
    AREA_NM: '강남역',
    LIVE_PPLTN_STTS: [
      {
        AREA_CONGEST_LVL: '약간 붐빔',
        PPLTN_TIME: '2026-09-02 15:10'
      }
    ],
    ROAD_TRAFFIC_STTS: {
      AVG_ROAD_DATA: {
        ROAD_TRAFFIC_IDX: '정체',
        ROAD_TRAFFIC_SPD: 13,
        ROAD_TRAFFIC_TIME: '2026-09-02 15:40'
      }
    },
    EVENT_STTS: []
  }
};

const main = () => {
  const kakao = normalizeKakaoPlace(kakaoRaw);
  assert(kakao?.name === '노랑저고리 강남점', 'Kakao name normalization failed');
  assert(kakao?.lat === 37.49829326602763, 'Kakao lat number conversion failed');
  assert(kakao?.lng === 127.0253484614826, 'Kakao lng number conversion failed');
  assert(kakao?.category === 'food', 'Kakao category normalization failed');
  assert(kakao?.imageUrl === null, 'Kakao missing image should be null');

  const tour = normalizeTourApiPlace(tourRaw);
  assert(tour?.name === '노랑저고리', 'TourAPI name normalization failed');
  assert(tour?.lat === 37.4983602268, 'TourAPI lat number conversion failed');
  assert(tour?.lng === 127.0252436924, 'TourAPI lng number conversion failed');
  assert(tour?.category === 'food', 'TourAPI category normalization failed');
  assert(tour?.imageUrl === null, 'TourAPI empty image should be null');

  const invalid = normalizeTourApiPlace(invalidTourRaw);
  assert(invalid?.lat === null && invalid.lng === null, 'Invalid coordinates should become null');
  assert(invalid?.dataQuality?.hasCoordinates === false, 'Invalid coordinate quality failed');

  const merged = removeDuplicatePlaces([kakao!, tour!]);
  assert(merged.length === 1, 'Duplicate place merge failed');
  assert(merged[0].detailUrl === kakao?.detailUrl, 'Merged place should keep Kakao detail URL');

  const weather = normalizeWeatherContext(weatherRaw);
  assert(weather.temperature === 23, 'Weather temperature normalization failed');
  assert(weather.precipitationProbability === 30, 'Weather POP normalization failed');
  assert(weather.precipitationType === 'none', 'Weather PTY normalization failed');
  assert(weather.skyCondition === 'overcast', 'Weather SKY normalization failed');

  const seoul = normalizeSeoulContext(seoulRaw);
  assert(seoul.areaName === '강남역', 'Seoul area name normalization failed');
  assert(seoul.congestionLevel === 'crowded', 'Seoul congestion normalization failed');
  assert(seoul.roadTraffic?.trafficLevel === 'congested', 'Seoul traffic normalization failed');

  console.log(JSON.stringify({
    ok: true,
    normalized: {
      kakao,
      tour,
      weather,
      seoul,
      mergedCount: merged.length
    }
  }, null, 2));
};

main();
