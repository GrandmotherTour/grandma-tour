import type { WeatherContext } from '../types/normalized';
import { asRecord, getNumber, getString } from './utils';

const precipitationTypeMap: Record<string, WeatherContext['precipitationType']> = {
  '0': 'none',
  '1': 'rain',
  '2': 'rainSnow',
  '3': 'snow',
  '4': 'rain'
};

const skyConditionMap: Record<string, WeatherContext['skyCondition']> = {
  '1': 'clear',
  '3': 'cloudy',
  '4': 'overcast'
};

const parsePrecipitationAmount = (value: string | null) => {
  if (!value || value === '강수없음') {
    return 0;
  }

  const matched = value.match(/[\d.]+/);
  return matched ? Number(matched[0]) : null;
};

const buildObservedAt = (item: Record<string, unknown>) => {
  const fcstDate = getString(item, 'fcstDate');
  const fcstTime = getString(item, 'fcstTime');

  if (!fcstDate || !fcstTime || fcstDate.length !== 8 || fcstTime.length < 4) {
    return null;
  }

  return `${fcstDate.slice(0, 4)}-${fcstDate.slice(4, 6)}-${fcstDate.slice(6, 8)}T${fcstTime.slice(0, 2)}:${fcstTime.slice(2, 4)}:00+09:00`;
};

export const normalizeWeatherContext = (rawResponse: unknown, options: { includeRawSource?: boolean } = {}): WeatherContext => {
  const response = asRecord(rawResponse);
  const body = asRecord(response.body ?? asRecord(response.response).body);
  const itemsWrapper = asRecord(body.items);
  const items = Array.isArray(itemsWrapper.item) ? itemsWrapper.item.map(asRecord) : [];
  const valuesByCategory = new Map<string, Record<string, unknown>>();

  for (const item of items) {
    const category = getString(item, 'category');
    if (category && !valuesByCategory.has(category)) {
      valuesByCategory.set(category, item);
    }
  }

  const tmp = valuesByCategory.get('TMP');
  const pop = valuesByCategory.get('POP');
  const pty = valuesByCategory.get('PTY');
  const pcp = valuesByCategory.get('PCP');
  const sky = valuesByCategory.get('SKY');
  const wsd = valuesByCategory.get('WSD');
  const observedSource = tmp || pop || pty || pcp || sky || wsd;

  return {
    temperature: tmp ? getNumber(tmp, 'fcstValue') : null,
    precipitationProbability: pop ? getNumber(pop, 'fcstValue') : null,
    precipitationType: pty ? precipitationTypeMap[getString(pty, 'fcstValue') || ''] || 'unknown' : 'unknown',
    precipitationAmount: pcp ? parsePrecipitationAmount(getString(pcp, 'fcstValue')) : null,
    skyCondition: sky ? skyConditionMap[getString(sky, 'fcstValue') || ''] || 'unknown' : 'unknown',
    windSpeed: wsd ? getNumber(wsd, 'fcstValue') : null,
    observedAt: observedSource ? buildObservedAt(observedSource) : null,
    rawSource: options.includeRawSource ? rawResponse : undefined
  };
};
