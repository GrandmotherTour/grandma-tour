import dotenv from 'dotenv';

dotenv.config();

type ApiName = 'kakao' | 'tour' | 'seoul' | 'weather';

const requireEnv = (name: string, fallbackName?: string) => {
  const value = process.env[name] || (fallbackName ? process.env[fallbackName] : '');
  if (!value) throw new Error(`Missing .env value: ${fallbackName ? `${name} or ${fallbackName}` : name}`);
  return value;
};

const buildRequest = (name: ApiName): { url: string; headers?: HeadersInit } => {
  if (name === 'kakao') {
    const url = new URL('https://dapi.kakao.com/v2/local/search/keyword.json');
    url.searchParams.set('query', '\uAC15\uB0A8\uC5ED \uB9DB\uC9D1');
    url.searchParams.set('size', '3');
    return {
      url: url.toString(),
      headers: { Authorization: `KakaoAK ${requireEnv('KAKAO_REST_API_KEY')}` }
    };
  }

  if (name === 'tour') {
    const url = new URL('https://apis.data.go.kr/B551011/KorService2/locationBasedList2');
    url.searchParams.set('serviceKey', requireEnv('TOURAPI_SERVICE_KEY'));
    url.searchParams.set('MobileOS', 'ETC');
    url.searchParams.set('MobileApp', 'jaturip');
    url.searchParams.set('_type', 'json');
    url.searchParams.set('mapX', '127.0276');
    url.searchParams.set('mapY', '37.4979');
    url.searchParams.set('radius', '1000');
    url.searchParams.set('numOfRows', '3');
    return { url: url.toString() };
  }

  if (name === 'seoul') {
    return {
      url: `http://openapi.seoul.go.kr:8088/${requireEnv('SEOUL_DATA_API_KEY')}/json/citydata/1/1/${encodeURIComponent('\uAC15\uB0A8\uC5ED')}`
    };
  }

  const url = new URL('https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst');
  url.searchParams.set('serviceKey', requireEnv('WEATHER_API_KEY', 'WEATHER_KR_API_KEY'));
  url.searchParams.set('pageNo', '1');
  url.searchParams.set('numOfRows', '10');
  url.searchParams.set('dataType', 'JSON');
  url.searchParams.set('base_date', '20260902');
  url.searchParams.set('base_time', '0500');
  url.searchParams.set('nx', '61');
  url.searchParams.set('ny', '126');
  return { url: url.toString() };
};

const keysOf = (value: unknown) => {
  return typeof value === 'object' && value !== null ? Object.keys(value) : [];
};

const inspect = async (api: ApiName) => {
  const request = buildRequest(api);
  const response = await fetch(request.url, { headers: request.headers });
  const body = await response.json();

  if (api === 'kakao') {
    return {
      api,
      status: response.status,
      topLevelKeys: keysOf(body),
      documentKeys: keysOf(body.documents?.[0]),
      metaKeys: keysOf(body.meta)
    };
  }

  if (api === 'tour') {
    const item = body.response?.body?.items?.item?.[0];
    return {
      api,
      status: response.status,
      topLevelKeys: keysOf(body),
      responseKeys: keysOf(body.response),
      bodyKeys: keysOf(body.response?.body),
      itemKeys: keysOf(item)
    };
  }

  if (api === 'seoul') {
    const cityData = body.CITYDATA;
    return {
      api,
      status: response.status,
      topLevelKeys: keysOf(body),
      cityDataKeys: keysOf(cityData),
      populationKeys: keysOf(cityData?.LIVE_PPLTN_STTS?.[0]),
      roadAverageKeys: keysOf(cityData?.ROAD_TRAFFIC_STTS?.AVG_ROAD_DATA),
      eventKeys: keysOf(cityData?.EVENT_STTS?.[0])
    };
  }

  const item = body.response?.body?.items?.item?.[0];
  return {
    api,
    status: response.status,
    topLevelKeys: keysOf(body),
    responseKeys: keysOf(body.response),
    bodyKeys: keysOf(body.response?.body),
    itemKeys: keysOf(item)
  };
};

const main = async () => {
  const apis: ApiName[] = ['kakao', 'tour', 'weather', 'seoul'];
  const result = [];

  for (const api of apis) {
    result.push(await inspect(api));
  }

  console.log(JSON.stringify(result, null, 2));
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
