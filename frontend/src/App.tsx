import { FormEvent, PointerEvent, useEffect, useMemo, useRef, useState } from 'react';
import { placeApi, type KakaoPlace } from './api/placeApi';
import { recommendationApi } from './api/recommendationApi';
import type {
  PreferenceTag,
  RecommendedCourse,
  RecommendationResponse,
  SwipeFeedback,
  TransportMode
} from './types/recommendation';

type View = 'start' | 'setup' | 'taste' | 'loading' | 'course' | 'map';
type Theme = 'neon' | 'coral' | 'sand' | 'blue';
type LocationState = 'idle' | 'loading' | 'ready' | 'error';
type NextMode = 'scheduled' | 'free';

type SelectedPlace = {
  id: string;
  name: string;
  address: string;
  roadAddress: string;
  lat: number;
  lng: number;
};

type CurrentLocation = {
  latitude: number;
  longitude: number;
};

type RouteLeg = {
  from: string;
  to: string;
  minutes: number;
};

declare global {
  interface Window {
    maplibregl?: any;
  }
}

const THEMES: Theme[] = ['neon', 'coral', 'sand', 'blue'];
const THEME_LABELS: Record<Theme, string> = {
  neon: '다크 네온',
  coral: '코랄 웜',
  sand: '샌드 오렌지',
  blue: '일렉트릭 블루'
};

const CATEGORY_LABELS: Record<PreferenceTag, string> = {
  cafe: '카페·디저트',
  food: '맛집·먹거리',
  nature: '산책·자연',
  culture: '전시·문화',
  history: '역사·전통',
  activity: '체험·놀거리'
};

const CATEGORY_IMAGES: Record<PreferenceTag, string> = {
  cafe: 'https://images.unsplash.com/photo-1497935586351-b67a49e012bf?q=80&w=900&auto=format&fit=crop',
  food: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=900&auto=format&fit=crop',
  nature: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=900&auto=format&fit=crop',
  culture: 'https://images.unsplash.com/photo-1518998053901-5348d3961a04?q=80&w=900&auto=format&fit=crop',
  history: 'https://images.unsplash.com/photo-1467269204594-9661b134dd2b?q=80&w=900&auto=format&fit=crop',
  activity: 'https://images.unsplash.com/photo-1527529482837-4698179dc6ce?q=80&w=900&auto=format&fit=crop'
};

const SWIPE_CARDS: Array<{ id: string; tag: PreferenceTag; title: string; where: string; image: string }> = [
  { id: 'cafe-1', tag: 'cafe', title: '자리 잡고 앉아\n커피 한 잔', where: '카페·디저트', image: CATEGORY_IMAGES.cafe },
  { id: 'food-1', tag: 'food', title: '짧은 시간에\n맛있는 한 끼', where: '맛집·먹거리', image: CATEGORY_IMAGES.food },
  { id: 'nature-1', tag: 'nature', title: '나무 그늘 아래\n천천히 걷기', where: '산책·자연', image: CATEGORY_IMAGES.nature },
  { id: 'culture-1', tag: 'culture', title: '조용한 전시장\n한 바퀴', where: '전시·문화', image: CATEGORY_IMAGES.culture },
  { id: 'history-1', tag: 'history', title: '동네의 이야기를\n가볍게 둘러보기', where: '역사·전통', image: CATEGORY_IMAGES.history },
  { id: 'activity-1', tag: 'activity', title: '잠깐 즐기는\n체험 코스', where: '체험·놀거리', image: CATEGORY_IMAGES.activity }
];

const pad = (value: number) => String(value).padStart(2, '0');
const toTimeInput = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;
const addMinutes = (date: Date, minutes: number) => new Date(date.getTime() + minutes * 60_000);
const validTransportModes: TransportMode[] = ['walk', 'car'];
const isTransportMode = (value: TransportMode | null): value is TransportMode => {
  return value !== null && validTransportModes.includes(value);
};
const hasFiniteCoordinates = (location: { latitude: number; longitude: number } | null) => {
  return Boolean(location && Number.isFinite(location.latitude) && Number.isFinite(location.longitude));
};
const hasFinitePlaceCoordinates = (place: { lat: number; lng: number } | null) => {
  return Boolean(place && Number.isFinite(place.lat) && Number.isFinite(place.lng));
};
const durationText = (minutes: number) => {
  if (minutes >= 60) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h}시간 ${m}분` : `${h}시간`;
  }
  return `${minutes}분`;
};
const nowLabel = () => toTimeInput(new Date());

const toSelectedPlace = (item: KakaoPlace): SelectedPlace | null => {
  const lat = item.lat;
  const lng = item.lng;
  if (typeof lat !== 'number' || typeof lng !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  return {
    id: item.id,
    name: item.name,
    address: item.address,
    roadAddress: item.roadAddress,
    lat,
    lng
  };
};

const getCourse = (response: RecommendationResponse | null): RecommendedCourse | null => {
  return response?.data.mainCourse || null;
};

function App() {
  const [theme, setTheme] = useState<Theme>('neon');
  const [view, setView] = useState<View>('start');
  const [nextMode, setNextMode] = useState<NextMode>('scheduled');
  const [locationState, setLocationState] = useState<LocationState>('idle');
  const [locationError, setLocationError] = useState('');
  const [currentLocation, setCurrentLocation] = useState<CurrentLocation | null>(null);
  const [deadline, setDeadline] = useState(() => toTimeInput(addMinutes(new Date(), 180)));
  const [freeMin, setFreeMin] = useState(120);
  const [selectedPlace, setSelectedPlace] = useState<SelectedPlace | null>(null);
  const [placeModalOpen, setPlaceModalOpen] = useState(false);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeResults, setPlaceResults] = useState<SelectedPlace[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [placeError, setPlaceError] = useState('');
  const [transportMode, setTransportMode] = useState<TransportMode | null>(null);
  const [peopleCount, setPeopleCount] = useState<number | null>(null);
  const [cardIndex, setCardIndex] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragStart = useRef({ x: 0 });
  const [swipeFeedbacks, setSwipeFeedbacks] = useState<SwipeFeedback[]>([]);
  const [response, setResponse] = useState<RecommendationResponse | null>(null);
  const [requestError, setRequestError] = useState('');
  const [clock, setClock] = useState(nowLabel());
  const [activeLeg, setActiveLeg] = useState(0);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any[]>([]);
  const routeRequestRef = useRef(0);

  const mainCourse = getCourse(response);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    const timer = window.setInterval(() => setClock(nowLabel()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (locationState === 'idle') requestCurrentLocation();
  }, [locationState]);

  useEffect(() => {
    if (!placeModalOpen || placeQuery.trim().length < 2) {
      setPlaceResults([]);
      setPlaceError('');
      return;
    }

    const timer = window.setTimeout(async () => {
      setPlaceSearching(true);
      setPlaceError('');
      try {
        const result = await placeApi.getPlaces(placeQuery.trim(), currentLocation || undefined);
        setPlaceResults(result.items.map(toSelectedPlace).filter((item): item is SelectedPlace => Boolean(item)));
      } catch (error) {
        setPlaceError(error instanceof Error ? error.message : '장소 검색에 실패했습니다.');
        setPlaceResults([]);
      } finally {
        setPlaceSearching(false);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [placeModalOpen, placeQuery, currentLocation]);

  const setupValidation = useMemo(() => {
    const hasCurrentLocation = hasFiniteCoordinates(currentLocation);
    const hasDestination = nextMode === 'free' || hasFinitePlaceCoordinates(selectedPlace);
    const hasDeadline = nextMode === 'free' || deadline.trim().length > 0;
    const hasFreeMinutes = nextMode === 'scheduled' || (Number.isFinite(freeMin) && freeMin > 0);
    const hasTransport = isTransportMode(transportMode);
    const hasPeople = Number.isInteger(peopleCount) && Number(peopleCount) > 0;

    return {
      hasCurrentLocation,
      hasDestination,
      hasDeadline,
      hasFreeMinutes,
      hasTransport,
      hasPeople
    };
  }, [currentLocation, deadline, freeMin, nextMode, peopleCount, selectedPlace, transportMode]);

  const gate = useMemo(() => {
    const missing: string[] = [];
    if (!setupValidation.hasCurrentLocation) missing.push('현재 위치');
    if (!setupValidation.hasDestination) missing.push('다음 장소');
    if (!setupValidation.hasDeadline) missing.push('복귀 시각');
    if (!setupValidation.hasFreeMinutes) missing.push('비는 시간');
    if (!setupValidation.hasTransport) missing.push('이동수단');
    if (!setupValidation.hasPeople) missing.push('인원');
    return missing;
  }, [setupValidation]);

  const canProceed = gate.length === 0;

  const coursePoints = useMemo(() => {
    if (!mainCourse) return [];
    return [
      {
        label: '현재 위치',
        lat: mainCourse.route.currentLocation.latitude,
        lng: mainCourse.route.currentLocation.longitude
      },
      ...mainCourse.stops.map((stop) => ({ label: stop.name, lat: stop.latitude, lng: stop.longitude })),
      {
        label: mainCourse.route.nextSchedule.placeName || mainCourse.route.nextSchedule.name,
        lat: mainCourse.route.nextSchedule.latitude,
        lng: mainCourse.route.nextSchedule.longitude
      }
    ];
  }, [mainCourse]);

  const routeLegs = useMemo<RouteLeg[]>(() => {
    if (!mainCourse) return [];
    const names = [
      mainCourse.route.currentLocation.placeName || '현재 위치',
      ...mainCourse.stops.map((stop) => stop.name),
      mainCourse.route.nextSchedule.placeName || mainCourse.route.nextSchedule.name
    ];
    const minutes = [...mainCourse.stops.map((stop) => stop.travelMinutesFromPrevious), mainCourse.route.finalTravelMinutes];
    return minutes.map((minute, index) => ({ from: names[index], to: names[index + 1], minutes: minute }));
  }, [mainCourse]);

  useEffect(() => {
    if (view !== 'map' || !mainCourse) return;
    void renderMap();
  }, [view, mainCourse, theme, activeLeg]);

  const requestCurrentLocation = () => {
    if (!navigator.geolocation) {
      setLocationState('error');
      setLocationError('이 브라우저에서는 위치 확인을 사용할 수 없습니다.');
      return;
    }

    setLocationState('loading');
    setLocationError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        });
        setLocationState('ready');
      },
      (error) => {
        setLocationState('error');
        setLocationError(error.message || '위치 권한이 필요합니다.');
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 }
    );
  };

  const resolveDeadline = () => {
    if (nextMode === 'free') return addMinutes(new Date(), freeMin).toISOString();
    return deadline;
  };

  const requestRecommendation = async (feedbacks: SwipeFeedback[]) => {
    if (!currentLocation || !transportMode || !peopleCount) return;

    const nextScheduleLocation = nextMode === 'scheduled' && selectedPlace
      ? selectedPlace
      : {
          id: 'current-location',
          name: '현재 위치',
          address: '',
          roadAddress: '',
          lat: currentLocation.latitude,
          lng: currentLocation.longitude
        };
    const nextScheduleTime = resolveDeadline();

    setView('loading');
    setRequestError('');
    setResponse(null);

    try {
      const result = await recommendationApi.getRecommendation({
        currentLatitude: currentLocation.latitude,
        currentLongitude: currentLocation.longitude,
        nextScheduleTime,
        nextScheduleLatitude: nextScheduleLocation.lat,
        nextScheduleLongitude: nextScheduleLocation.lng,
        peopleCount,
        transportMode,
        swipeFeedbacks: feedbacks,
        currentTime: new Date().toISOString(),
        nextSchedule: {
          name: nextScheduleLocation.name,
          time: nextScheduleTime,
          latitude: nextScheduleLocation.lat,
          longitude: nextScheduleLocation.lng,
          address: nextScheduleLocation.roadAddress || nextScheduleLocation.address,
          placeName: nextScheduleLocation.name
        }
      });

      setResponse(result);
      setView('course');
    } catch (error) {
      setRequestError(error instanceof Error ? error.message : '추천 요청에 실패했습니다.');
      setView('course');
    }
  };

  const resetTaste = () => {
    setCardIndex(0);
    setSwipeFeedbacks([]);
    setDragX(0);
  };

  const handleSetupSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!canProceed) return;
    resetTaste();
    setView('taste');
  };

  const commitSwipe = (action: 'like' | 'dislike') => {
    const card = SWIPE_CARDS[cardIndex];
    if (!card) return;
    const nextFeedbacks: SwipeFeedback[] = [...swipeFeedbacks, { cardId: card.id, action, tags: [card.tag] }];
    setSwipeFeedbacks(nextFeedbacks);
    setDragX(action === 'like' ? 520 : -520);
    window.setTimeout(() => {
      setDragX(0);
      setCardIndex((index) => index + 1);
      if (cardIndex >= SWIPE_CARDS.length - 1) void requestRecommendation(nextFeedbacks);
    }, 220);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    setDragging(true);
    dragStart.current = { x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragX(event.clientX - dragStart.current.x);
  };

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    if (!dragging) return;
    setDragging(false);
    try {
      event.currentTarget.releasePointerCapture(event.pointerId);
    } catch {
      // Pointer capture may already be released by the browser.
    }
    if (Math.abs(dragX) > 90) commitSwipe(dragX > 0 ? 'like' : 'dislike');
    else setDragX(0);
  };

  const loadMapLibre = async () => {
    if (window.maplibregl) return window.maplibregl;

    if (!document.querySelector('link[data-maplibre]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.css';
      link.dataset.maplibre = 'true';
      document.head.appendChild(link);
    }

    await new Promise<void>((resolve, reject) => {
      const existing = document.querySelector('script[data-maplibre]') as HTMLScriptElement | null;
      if (existing) {
        existing.addEventListener('load', () => resolve(), { once: true });
        existing.addEventListener('error', () => reject(new Error('MapLibre load failed')), { once: true });
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/maplibre-gl/4.7.1/maplibre-gl.js';
      script.dataset.maplibre = 'true';
      script.onload = () => resolve();
      script.onerror = () => reject(new Error('MapLibre load failed'));
      document.head.appendChild(script);
    });

    return window.maplibregl;
  };

  const fetchRoute = async (points: Array<{ lng: number; lat: number }>) => {
    const profile = transportMode === 'car' ? 'car' : 'foot';
    const host = transportMode === 'car' ? 'https://router.project-osrm.org' : 'https://routing.openstreetmap.de/routed-foot';
    const coords = points.map((point) => `${point.lng},${point.lat}`).join(';');
    const res = await fetch(`${host}/route/v1/${profile}/${coords}?overview=full&geometries=geojson&steps=false`);
    const json = await res.json();
    if (json.code !== 'Ok' || !json.routes?.[0]?.geometry?.coordinates) throw new Error('route failed');
    return json.routes[0].geometry.coordinates;
  };

  const renderMap = async () => {
    if (!mainCourse || coursePoints.length < 2) return;

    const maplibregl = await loadMapLibre().catch(() => null);
    if (!maplibregl) return;

    const style = theme === 'neon'
      ? 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'
      : 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json';

    if (!mapRef.current) {
      mapRef.current = new maplibregl.Map({
        container: 'mapgl',
        style,
        center: [coursePoints[0].lng, coursePoints[0].lat],
        zoom: 13,
        attributionControl: { compact: true }
      });
    } else {
      mapRef.current.setStyle(style);
    }

    const map = mapRef.current;
    const requestId = ++routeRequestRef.current;

    map.once('style.load', async () => {
      if (requestId !== routeRequestRef.current) return;
      markerRef.current.forEach((marker) => marker.remove());
      markerRef.current = [];

      coursePoints.forEach((point, index) => {
        const marker = document.createElement('div');
        marker.className = 'mk-wrap';
        marker.innerHTML = `<div class="mk ${index === 0 ? 'mk-start' : index === coursePoints.length - 1 ? 'mk-end' : 'mk-stop'}">${index > 0 && index < coursePoints.length - 1 ? index : ''}</div><span class="mk-label">${point.label}</span>`;
        markerRef.current.push(new maplibregl.Marker({ element: marker, anchor: 'top' }).setLngLat([point.lng, point.lat]).addTo(map));
      });

      const bounds = new maplibregl.LngLatBounds();
      coursePoints.forEach((point) => bounds.extend([point.lng, point.lat]));
      map.fitBounds(bounds, { padding: { top: 160, right: 48, bottom: 320, left: 48 }, maxZoom: 15, duration: 500 });

      let coordinates = coursePoints.map((point) => [point.lng, point.lat]);
      let engine = 'OSM · MapLibre · 직선 (라우팅 실패)';
      try {
        coordinates = await fetchRoute(coursePoints);
        engine = transportMode === 'car' ? 'OSM · MapLibre · OSRM 차량 경로' : 'OSM · MapLibre · OSRM 도보 경로';
      } catch {
        // Markers and straight fallback remain visible when routing fails.
      }

      const data = { type: 'Feature', geometry: { type: 'LineString', coordinates } };
      if (map.getSource('route-line')) map.getSource('route-line').setData(data);
      else map.addSource('route-line', { type: 'geojson', data });
      if (map.getLayer('route-line')) map.removeLayer('route-line');
      map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route-line',
        layout: { 'line-cap': 'round', 'line-join': 'round' },
        paint: { 'line-color': getComputedStyle(document.documentElement).getPropertyValue('--accent').trim(), 'line-width': 5 }
      });

      const engineEl = document.getElementById('map-engine');
      if (engineEl) engineEl.textContent = engine;
    });
  };

  const renderSetup = () => (
    <form className="view is-active" onSubmit={handleSetupSubmit}>
      <div className="navbar">
        <button className="btn-icon" type="button" onClick={() => setView('start')} aria-label="뒤로">‹</button>
      </div>
      <div className="view-body pad">
        <h2 className="t-head setup-title">일정 입력</h2>
        <div className="tabs">
          <button type="button" className={`tab ${nextMode === 'scheduled' ? 'active' : ''}`} onClick={() => setNextMode('scheduled')}>다음 일정 있음</button>
          <button type="button" className={`tab ${nextMode === 'free' ? 'active' : ''}`} onClick={() => setNextMode('free')}>일정 없음</button>
        </div>

        <div className="input-group">
          <span className="input-label">현재 위치</span>
          <button type="button" className="location-box" onClick={requestCurrentLocation}>
            <span className="pin-icon">⌖</span>
            <span className="loc-copy">
              <strong>{locationState === 'ready' ? '현재 위치 확인 완료' : locationState === 'loading' ? '현재 위치 확인 중' : '위치 권한이 필요합니다'}</strong>
              <small>{locationState === 'ready' && currentLocation ? `${currentLocation.latitude.toFixed(5)}, ${currentLocation.longitude.toFixed(5)}` : locationError || '브라우저 위치 권한으로 확인합니다'}</small>
            </span>
          </button>
        </div>

        {nextMode === 'scheduled' ? (
          <>
            <div className="input-group">
              <span className="input-label">복귀 시각</span>
              <input className="time-btn num" type="time" value={deadline} onChange={(event) => setDeadline(event.target.value)} />
            </div>
            <div className="input-group">
              <span className="input-label">복귀 장소</span>
              <button type="button" className="location-box" onClick={() => setPlaceModalOpen(true)}>
                <span className="pin-icon">⌁</span>
                <span className="loc-copy">
                  <strong>{selectedPlace?.name || '장소를 검색해주세요'}</strong>
                  <small>{selectedPlace ? selectedPlace.roadAddress || selectedPlace.address : 'Kakao Local 검색으로 좌표를 가져옵니다'}</small>
                </span>
                <span className="caret">›</span>
              </button>
            </div>
          </>
        ) : (
          <div className="input-group">
            <span className="input-label">얼마나 놀까요?</span>
            <p className="t-desc">현재 시각 기준으로 내부 deadline을 계산합니다</p>
            <div className="free-grid">
              {[60, 120, 180, 240, 300].map((minutes) => (
                <button key={minutes} type="button" className={`free-btn ${freeMin === minutes ? 'active' : ''}`} onClick={() => setFreeMin(minutes)}>
                  {durationText(minutes)}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="input-group">
          <span className="input-label">이동수단</span>
          <p className="t-desc">동선을 어떻게 계산할지 정합니다</p>
          <div className="mode-row">
            <button type="button" className={`mode-btn ${transportMode === 'walk' ? 'active' : ''}`} onClick={() => setTransportMode('walk')}>걷기</button>
            <button type="button" className={`mode-btn ${transportMode === 'car' ? 'active' : ''}`} onClick={() => setTransportMode('car')}>차량</button>
          </div>
        </div>

        <div className="input-group">
          <span className="input-label">인원</span>
          <p className="t-desc">함께할 인원을 선택해주세요</p>
          <div className="selector-row">
            {[1, 2, 3, 4, 5].map((count) => (
              <button key={count} type="button" className={`circle-btn ${peopleCount === count ? 'active' : ''}`} onClick={() => setPeopleCount(count)}>
                {count}
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="bottom-bar">
        <span className={`gate-hint ${canProceed ? 'ready' : ''}`}>{canProceed ? '준비됐습니다' : `${gate.join(' · ')} 을(를) 확인해주세요`}</span>
        <button type="submit" className="btn-main" disabled={!canProceed}>관심사 고르기</button>
      </div>
    </form>
  );

  const renderTaste = () => {
    const visible = SWIPE_CARDS.slice(cardIndex, cardIndex + 3);
    const current = SWIPE_CARDS[cardIndex];
    return (
      <section className="view is-active">
        <div className="navbar">
          <button className="btn-icon" type="button" onClick={() => setView('setup')} aria-label="뒤로">‹</button>
          <span className="taste-count">{Math.min(cardIndex + 1, SWIPE_CARDS.length)} / {SWIPE_CARDS.length}</span>
        </div>
        <div className="view-body pad deck-body">
          <h2 className="t-title taste-title">관심 가는 곳을<br />골라주세요</h2>
          <p className="t-desc">카드를 좌우로 넘겨 취향을 알려주세요</p>
          <div className="deck-container">
            {cardIndex === 0 ? (
              <div className="deck-coach">
                <b>좌우로 밀어보세요</b>
                <span>왼쪽은 싫어요, 오른쪽은 좋아요</span>
              </div>
            ) : null}
            {[...visible].reverse().map((card, reverseIndex) => {
              const position = visible.length - reverseIndex - 1;
              const isTop = card.id === current?.id;
              const transform = isTop
                ? `translate(${dragX}px, ${Math.abs(dragX) * 0.08}px) rotate(${dragX * 0.04}deg)`
                : `translateY(${position * 12}px) scale(${1 - position * 0.05})`;
              return (
                <article
                  key={card.id}
                  className={`swipe-card ${dragging && isTop ? 'dragging' : ''}`}
                  style={{ zIndex: 20 - position, transform, opacity: position > 2 ? 0 : 1 }}
                  onPointerDown={isTop ? onPointerDown : undefined}
                  onPointerMove={isTop ? onPointerMove : undefined}
                  onPointerUp={isTop ? onPointerUp : undefined}
                  onPointerCancel={isTop ? onPointerUp : undefined}
                >
                  <span className="stamp stamp-yes" style={{ opacity: isTop && dragX > 20 ? Math.min(1, (dragX - 20) / 70) : 0 }}>좋아요</span>
                  <span className="stamp stamp-no" style={{ opacity: isTop && dragX < -20 ? Math.min(1, (-dragX - 20) / 70) : 0 }}>싫어요</span>
                  <div className="card-img" style={{ backgroundImage: `url(${card.image})` }} />
                  <div className="card-info">
                    <h3 className="t-title card-title">{card.title}</h3>
                    <p className="t-desc">{card.where}</p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
        <div className="swipe-actions">
          <button type="button" className="swipe-action dislike" onClick={() => commitSwipe('dislike')}>싫어요</button>
          <button type="button" className="swipe-action like" onClick={() => commitSwipe('like')}>좋아요</button>
        </div>
      </section>
    );
  };

  const renderLoading = () => (
    <section className="view is-active center-view">
      <div className="spinner" />
      <h2 className="t-title">추천 코스를 계산하고 있어요</h2>
      <p className="t-desc">백엔드 추천 엔진이 이동시간과 deadline을 확인하는 중입니다.</p>
    </section>
  );

  const renderCourse = () => {
    if (requestError) {
      return (
        <section className="view is-active">
          <div className="view-body pad center-copy">
            <h2 className="t-head">추천 코스를 불러오지 못했어요.</h2>
            <p className="t-desc">다시 시도해주세요.</p>
            <p className="error-text">{requestError}</p>
          </div>
          <div className="bottom-bar">
            <button className="btn-main" type="button" onClick={() => requestRecommendation(swipeFeedbacks)}>다시 시도</button>
            <button className="btn-ghost" type="button" onClick={() => setView('setup')}>조건 수정</button>
          </div>
        </section>
      );
    }

    if (!mainCourse) {
      return (
        <section className="view is-active">
          <div className="view-body pad center-copy">
            <h2 className="t-head">추천 코스</h2>
            <p className="t-desc big-empty">현재 조건에서는 안전하게 추천할 수 있는 코스가 없습니다.</p>
            <p className="t-desc">{response?.message || '조건을 변경해 다시 시도해주세요.'}</p>
          </div>
          <div className="bottom-bar">
            <button className="btn-main" type="button" onClick={() => setView('setup')}>조건 변경</button>
          </div>
        </section>
      );
    }

    const slack = mainCourse.route.slackMinutes;
    const requestTime = response?.data.request?.currentTime || Date.now();
    return (
      <section className="view is-active">
        <div className="navbar">
          <button className="btn-icon" type="button" onClick={() => setView('taste')} aria-label="뒤로">‹</button>
        </div>
        <div className="view-body pad">
          <h2 className="t-head course-title">추천 코스</h2>
          <p className={`course-verdict ${slack <= 0 ? 'warn' : ''}`}>
            {slack > 0 ? `복귀까지 ${durationText(slack)} 여유가 있습니다.` : '복귀 여유가 거의 없습니다.'}
          </p>
          <div className="timeline">
            <div className="tl-node">
              <div className="tl-dot start">⌖</div>
              <div className="tl-content">
                <div className="t-sub">현재 위치</div>
                <div className="t-desc num">{new Date(requestTime).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: false })} 출발</div>
              </div>
            </div>
            {mainCourse.stops.map((stop) => (
              <div key={stop.placeId}>
                <div className="tl-leg">↘ <span className="num">{stop.travelMinutesFromPrevious}분 이동</span></div>
                <div className="tl-node">
                  <div className="tl-dot">{stop.order}</div>
                  <div className="tl-content">
                    <div className="place-card">
                      {stop.imageUrl ? <img src={stop.imageUrl} className="place-img" alt="" /> : <div className="place-img placeholder">{CATEGORY_LABELS[stop.categoryTags[0]] || 'PLACE'}</div>}
                      <div>
                        <div className="t-sub place-name">{stop.name}</div>
                        <div className="t-desc num"><strong>{stop.arrivalTimeLabel}</strong> 도착 · {stop.stayMinutes}분 머무름</div>
                        {stop.address ? <div className="t-desc address">{stop.address}</div> : null}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            <div className="tl-leg">↘ <span className="num">{mainCourse.route.finalTravelMinutes}분 이동</span></div>
            <div className="tl-node end-node">
              <div className="tl-dot end">⚑</div>
              <div className="tl-content">
                <div className="t-sub">{mainCourse.route.nextSchedule.placeName || mainCourse.route.nextSchedule.name}</div>
                <div className="t-desc num">{mainCourse.route.estimatedArrivalAtNextScheduleLabel} 도착 · 일정 {mainCourse.route.nextScheduleTimeLabel}</div>
              </div>
            </div>
          </div>
          {response?.data.alternatives?.length ? <p className="t-desc alt-note">대안 코스 {response.data.alternatives.length}개를 함께 받았습니다. 현재 화면은 주 추천 코스를 우선 표시합니다.</p> : null}
        </div>
        <div className="bottom-bar summary-bar">
          <div className="summary-row">
            <span>이동 {durationText(mainCourse.route.totalTravelMinutes)}</span>
            <span>체류 {durationText(mainCourse.route.totalStayMinutes)}</span>
            <span>도착 {mainCourse.route.estimatedArrivalAtNextScheduleLabel}</span>
          </div>
          <button className="btn-main" type="button" disabled={!mainCourse.stops.length} onClick={() => setView('map')}>이 코스로 출발</button>
        </div>
      </section>
    );
  };

  const renderMapView = () => {
    if (!mainCourse) return renderCourse();
    const active = routeLegs[activeLeg];
    return (
      <section className="view is-active map-view">
        <div className="mapgl" id="mapgl" />
        <div className="map-engine" id="map-engine">MapLibre 준비 중</div>
        <button className="btn-icon map-back" type="button" onClick={() => setView('course')} aria-label="뒤로">‹</button>
        <div className="nav-card">
          <div className="nav-top">
            <span className="nav-step num">{Math.min(activeLeg + 1, routeLegs.length)} / {routeLegs.length}</span>
            <span className="nav-eta num">{active ? `${active.minutes}분` : ''}</span>
          </div>
          <p className="nav-head">{active?.to || '코스 안내'}</p>
          <p className="nav-sub">{active ? `${active.from}에서 ${active.to}까지 ${transportMode === 'car' ? '차량' : '도보'} 이동` : '실제 좌표 기준 marker를 표시합니다.'}</p>
          <div className="nav-btns">
            <button className="nav-btn" disabled={activeLeg === 0} onClick={() => setActiveLeg((value) => Math.max(0, value - 1))}>이전</button>
            <button className="nav-btn primary" disabled={activeLeg >= routeLegs.length - 1} onClick={() => setActiveLeg((value) => Math.min(routeLegs.length - 1, value + 1))}>다음</button>
          </div>
        </div>
        <div className="sheet open">
          <div className="pad">
            <h2 className="t-head sheet-title">코스 안내</h2>
            <p className="t-desc">{mainCourse.stops.length}곳 · {durationText(mainCourse.route.totalCourseMinutes)} · 여유 {durationText(Math.max(0, mainCourse.route.slackMinutes))}</p>
          </div>
          <div className="steplist">
            <div className="step-row"><span className="step-icon start">⌖</span><div><div className="t-sub">현재 위치 출발</div></div></div>
            {mainCourse.stops.map((stop, index) => (
              <div key={stop.placeId}>
                <button className={`step-row pickable ${activeLeg === index ? 'in-leg' : ''}`} onClick={() => setActiveLeg(index)}>
                  <span className="step-icon muted">↘</span>
                  <div><div className="t-sub">{index + 1}구간 · {stop.travelMinutesFromPrevious}분 {transportMode === 'car' ? '차량' : '도보'}</div></div>
                </button>
                <div className="step-row">
                  <span className="step-icon active">{stop.order}</span>
                  <div><div className="t-sub">{stop.name}</div><div className="t-desc num">{stop.arrivalTimeLabel} 도착 · {stop.stayMinutes}분 머무름</div></div>
                </div>
              </div>
            ))}
            <button className={`step-row pickable ${activeLeg === routeLegs.length - 1 ? 'in-leg' : ''}`} onClick={() => setActiveLeg(routeLegs.length - 1)}>
              <span className="step-icon muted">↘</span>
              <div><div className="t-sub">마지막 구간 · {mainCourse.route.finalTravelMinutes}분 {transportMode === 'car' ? '차량' : '도보'}</div></div>
            </button>
            <div className="step-row"><span className="step-icon end">⚑</span><div><div className="t-sub">{mainCourse.route.nextSchedule.placeName || mainCourse.route.nextSchedule.name}</div><div className="t-desc num">{mainCourse.route.estimatedArrivalAtNextScheduleLabel} 도착</div></div></div>
          </div>
        </div>
      </section>
    );
  };

  return (
    <div className="stage">
      <div className="theme-toggle" role="group" aria-label="색상 모드">
        {THEMES.map((item) => (
          <button key={item} className={`tt-btn ${theme === item ? 'active' : ''}`} onClick={() => setTheme(item)}>
            <span className={`dot ${item}`} /> {THEME_LABELS[item]}
          </button>
        ))}
      </div>
      <main className="device">
        <div className="statusbar">
          <span className="num">{clock}</span>
          <div className="sb-icons"><span>▰</span><span>▱</span></div>
        </div>

        {view === 'start' ? (
          <section className="view is-active">
            <div className="hero-view">
              <div className="hero-bg" />
              <svg className="hero-graphic hg-neon" viewBox="0 0 390 400" fill="none" aria-hidden="true">
                <path d="M 40,280 Q 100,120 200,220 T 350,170" stroke="var(--line)" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                <path d="M 40,280 Q 100,120 200,220 T 260,200" stroke="var(--accent)" strokeWidth="3" strokeDasharray="6 6" fill="none" />
                <circle cx="40" cy="280" r="6" fill="var(--accent)" stroke="var(--bg)" strokeWidth="3" />
                <circle cx="200" cy="220" r="6" fill="var(--accent)" stroke="var(--bg)" strokeWidth="3" />
                <circle cx="260" cy="200" r="8" fill="transparent" stroke="var(--accent)" strokeWidth="2" />
                <circle cx="260" cy="200" r="4" fill="var(--accent)" />
              </svg>
              <div className="hero-text">
                <h1 className="t-head">비어 있는 시간을<br />알려주세요</h1>
                <p className="t-desc">그 안에 다녀올 수 있는 곳만 추려서 코스로 묶어 드립니다.</p>
                <button className="btn-text-start" type="button" onClick={() => setView('setup')}>let&apos;s start ››</button>
              </div>
            </div>
          </section>
        ) : null}
        {view === 'setup' ? renderSetup() : null}
        {view === 'taste' ? renderTaste() : null}
        {view === 'loading' ? renderLoading() : null}
        {view === 'course' ? renderCourse() : null}
        {view === 'map' ? renderMapView() : null}

        {placeModalOpen ? (
          <div className="modal open">
            <button className="dimmer" type="button" onClick={() => setPlaceModalOpen(false)} aria-label="닫기" />
            <div className="modal-sheet">
              <div className="sheet-grab" />
              <div className="pad">
                <h2 className="t-title">복귀 장소</h2>
                <div className="search-box">
                  <span>⌕</span>
                  <input value={placeQuery} onChange={(event) => setPlaceQuery(event.target.value)} placeholder="복귀할 장소 검색" autoFocus />
                </div>
              </div>
              <div className="view-body pad modal-list">
                {placeSearching ? <p className="t-desc center">검색 중...</p> : null}
                {placeError ? <p className="error-text">{placeError}</p> : null}
                {!placeSearching && placeQuery.trim().length < 2 ? <p className="t-desc center">두 글자 이상 입력해주세요.</p> : null}
                {!placeSearching && placeQuery.trim().length >= 2 && !placeResults.length && !placeError ? <p className="t-desc center">검색 결과가 없습니다.</p> : null}
                {placeResults.map((place) => (
                  <button
                    key={place.id}
                    type="button"
                    className="cand-card"
                    onClick={() => {
                      setSelectedPlace(place);
                      setPlaceModalOpen(false);
                      setPlaceQuery('');
                    }}
                  >
                    <div className="cand-thumb">⌁</div>
                    <div>
                      <div className="t-sub">{place.name}</div>
                      <div className="t-desc">{place.roadAddress || place.address}</div>
                    </div>
                    <span className="cand-add-btn">›</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </main>
      <p className="tt-hint">design5 기반 UI · 실제 백엔드 추천 API 연결</p>
    </div>
  );
}

export default App;
