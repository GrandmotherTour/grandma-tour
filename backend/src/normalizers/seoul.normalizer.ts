import type { SeoulContext } from '../types/normalized';
import { asRecord, getNumber, getString, normalizeIsoLikeDateTime } from './utils';

const congestionMap: Record<string, SeoulContext['congestionLevel']> = {
  '여유': 'relaxed',
  '보통': 'normal',
  '약간 붐빔': 'crowded',
  '붐빔': 'veryCrowded'
};

const trafficMap: Record<string, NonNullable<SeoulContext['roadTraffic']>['trafficLevel']> = {
  '원활': 'smooth',
  '서행': 'slow',
  '정체': 'congested'
};

export const normalizeSeoulContext = (rawResponse: unknown, options: { includeRawSource?: boolean } = {}): SeoulContext => {
  const root = asRecord(rawResponse);
  const cityData = asRecord(root.CITYDATA ?? asRecord(root.body).CITYDATA);
  const populationStatus = Array.isArray(cityData.LIVE_PPLTN_STTS)
    ? asRecord(cityData.LIVE_PPLTN_STTS[0])
    : {};
  const roadTrafficRoot = asRecord(cityData.ROAD_TRAFFIC_STTS);
  const averageRoadData = asRecord(roadTrafficRoot.AVG_ROAD_DATA);
  const eventRows = Array.isArray(cityData.EVENT_STTS) ? cityData.EVENT_STTS.map(asRecord) : [];
  const congestionText = getString(populationStatus, 'AREA_CONGEST_LVL');
  const trafficText = getString(averageRoadData, 'ROAD_TRAFFIC_IDX');

  return {
    areaName: getString(cityData, 'AREA_NM') || getString(populationStatus, 'AREA_NM'),
    congestionLevel: congestionText ? congestionMap[congestionText] || 'unknown' : 'unknown',
    roadTraffic: {
      averageSpeed: getNumber(averageRoadData, 'ROAD_TRAFFIC_SPD'),
      trafficLevel: trafficText ? trafficMap[trafficText] || 'unknown' : 'unknown'
    },
    events: eventRows
      .map((event) => ({
        name: getString(event, 'EVENT_NM') || getString(event, 'TITLE') || '',
        startTime: normalizeIsoLikeDateTime(getString(event, 'EVENT_STRTDATE') || getString(event, 'START_TIME')),
        endTime: normalizeIsoLikeDateTime(getString(event, 'EVENT_END_DATE') || getString(event, 'END_TIME')),
        location: getString(event, 'EVENT_PLACE') || getString(event, 'PLACE')
      }))
      .filter((event) => event.name !== ''),
    observedAt: normalizeIsoLikeDateTime(
      getString(populationStatus, 'PPLTN_TIME') ||
      getString(averageRoadData, 'ROAD_TRAFFIC_TIME')
    ),
    rawSource: options.includeRawSource ? rawResponse : undefined
  };
};
