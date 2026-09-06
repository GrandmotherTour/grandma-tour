import dotenv from 'dotenv';

dotenv.config();

type ApiName = 'kakao' | 'tour' | 'seoul' | 'weather';

const apiName = (process.argv[2] || 'tour') as ApiName;

const requireEnv = (name: string, fallbackName?: string) => {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : '');

  if (!value) {
    const names = fallbackName ? `${name} or ${fallbackName}` : name;
    throw new Error(`Missing .env value: ${names}`);
  }

  return value;
};

const buildRequest = (name: ApiName): { url: string; headers?: HeadersInit } => {
  switch (name) {
    case 'kakao': {
      const key = requireEnv('KAKAO_REST_API_KEY');
      const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
      url.searchParams.set('query', '\uAC15\uB0A8\uC5ED \uB9DB\uC9D1');
      url.searchParams.set('size', '3');

      return {
        url: url.toString(),
        headers: { Authorization: `KakaoAK ${key}` }
      };
    }

    case 'tour': {
      const key = requireEnv('TOURAPI_SERVICE_KEY');
      const url = new URL('https://apis.data.go.kr/B551011/KorService2/locationBasedList2');
      url.searchParams.set('serviceKey', key);
      url.searchParams.set('MobileOS', 'ETC');
      url.searchParams.set('MobileApp', 'jaturip');
      url.searchParams.set('_type', 'json');
      url.searchParams.set('mapX', '127.0276');
      url.searchParams.set('mapY', '37.4979');
      url.searchParams.set('radius', '1000');
      url.searchParams.set('numOfRows', '3');

      return { url: url.toString() };
    }

    case 'seoul': {
      const key = requireEnv('SEOUL_DATA_API_KEY');
      const areaName = encodeURIComponent('\uAC15\uB0A8\uC5ED');
      const url = `http://openapi.seoul.go.kr:8088/${key}/json/citydata/1/1/${areaName}`;

      return { url };
    }

    case 'weather': {
      const key = requireEnv('WEATHER_API_KEY', 'WEATHER_KR_API_KEY');
      const url = new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst');
      url.searchParams.set('serviceKey', key);
      url.searchParams.set('pageNo', '1');
      url.searchParams.set('numOfRows', '10');
      url.searchParams.set('dataType', 'JSON');
      url.searchParams.set('base_date', '20260902');
      url.searchParams.set('base_time', '0500');
      url.searchParams.set('nx', '61');
      url.searchParams.set('ny', '126');

      return { url: url.toString() };
    }

    default:
      throw new Error(`Unknown API: ${name}. Use kakao, tour, seoul, or weather.`);
  }
};

const main = async () => {
  const request = buildRequest(apiName);
  const response = await fetch(request.url, { headers: request.headers });
  const contentType = response.headers.get('content-type') || '';
  const body = contentType.includes('application/json')
    ? await response.json()
    : await response.text();

  console.log(JSON.stringify({
    api: apiName,
    status: response.status,
    ok: response.ok,
    body
  }, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
