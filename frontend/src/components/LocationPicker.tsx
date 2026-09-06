import { MouseEvent, useEffect, useRef, useState } from 'react';
import type { TripLocation } from '../types/recommendation';

declare global {
  interface Window {
    kakao?: any;
  }
}

type LocationPickerProps = {
  value: TripLocation | null;
  onChange: (location: TripLocation) => void;
};

const DEFAULT_CENTER = {
  latitude: 36.3504,
  longitude: 127.3845
};

const KAKAO_MAP_KEY = import.meta.env.VITE_KAKAO_MAP_API_KEY || import.meta.env.VITE_KAKAO_JS_KEY || '';

const loadKakaoMap = () => new Promise<void>((resolve, reject) => {
  if (!KAKAO_MAP_KEY) {
    reject(new Error('Kakao map key is not configured.'));
    return;
  }

  if (window.kakao?.maps) {
    window.kakao.maps.load(resolve);
    return;
  }

  const script = document.createElement('script');
  script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_MAP_KEY}&autoload=false&libraries=services`;
  script.async = true;
  script.onload = () => window.kakao?.maps?.load(resolve);
  script.onerror = () => reject(new Error('Kakao map script failed to load.'));
  document.head.appendChild(script);
});

const createMapClickLocation = (event: MouseEvent<HTMLDivElement>): TripLocation => {
  const rect = event.currentTarget.getBoundingClientRect();
  const xRatio = (event.clientX - rect.left) / rect.width - 0.5;
  const yRatio = (event.clientY - rect.top) / rect.height - 0.5;
  const latitude = DEFAULT_CENTER.latitude - yRatio * 0.08;
  const longitude = DEFAULT_CENTER.longitude + xRatio * 0.08;

  return {
    latitude: Number(latitude.toFixed(6)),
    longitude: Number(longitude.toFixed(6)),
    address: '지도에서 선택한 위치',
    placeName: '선택한 현재 위치'
  };
};

const LocationPicker = ({ value, onChange }: LocationPickerProps) => {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');
  const [kakaoReady, setKakaoReady] = useState(false);

  useEffect(() => {
    if (!open || !mapRef.current) return;

    let marker: any = null;

    loadKakaoMap()
      .then(() => {
        const center = new window.kakao.maps.LatLng(
          value?.latitude || DEFAULT_CENTER.latitude,
          value?.longitude || DEFAULT_CENTER.longitude
        );
        const map = new window.kakao.maps.Map(mapRef.current, {
          center,
          level: 4
        });
        const geocoder = new window.kakao.maps.services.Geocoder();

        setKakaoReady(true);
        marker = new window.kakao.maps.Marker({ position: center, map });

        window.kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
          const latLng = mouseEvent.latLng;
          const latitude = Number(latLng.getLat().toFixed(6));
          const longitude = Number(latLng.getLng().toFixed(6));

          marker.setPosition(latLng);
          geocoder.coord2Address(longitude, latitude, (result: any[], status: string) => {
            const address = status === window.kakao.maps.services.Status.OK
              ? result[0]?.road_address?.address_name || result[0]?.address?.address_name || '지도에서 선택한 위치'
              : '지도에서 선택한 위치';

            onChange({
              latitude,
              longitude,
              address,
              placeName: '선택한 현재 위치'
            });
            setOpen(false);
          });
        });
      })
      .catch(() => {
        setKakaoReady(false);
      });

    return () => {
      marker = null;
    };
  }, [open, onChange, value?.latitude, value?.longitude]);

  const useBrowserLocation = () => {
    setError('');

    if (!navigator.geolocation) {
      setError('이 브라우저에서는 현재 위치를 사용할 수 없습니다.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        onChange({
          latitude: Number(position.coords.latitude.toFixed(6)),
          longitude: Number(position.coords.longitude.toFixed(6)),
          address: '브라우저 현재 위치',
          placeName: '내 현재 위치'
        });
        setOpen(false);
      },
      () => setError('현재 위치 권한을 허용하거나 지도에서 위치를 선택해주세요.'),
      { enableHighAccuracy: true, timeout: 8_000 }
    );
  };

  const selectFromFallbackMap = (event: MouseEvent<HTMLDivElement>) => {
    if (kakaoReady) return;
    onChange(createMapClickLocation(event));
    setOpen(false);
  };

  return (
    <>
      <button type="button" className="location-button" onClick={() => setOpen(true)}>
        <span>현재 위치</span>
        <strong>{value ? value.placeName : '지도에서 현재 위치 선택'}</strong>
        {value ? <small>{value.latitude}, {value.longitude}</small> : null}
      </button>

      {open ? (
        <div className="location-modal" role="dialog" aria-modal="true">
          <div className="location-panel">
            <div>
              <h2>현재 위치 선택</h2>
              <p>지도를 눌러 출발 위치를 지정하거나 브라우저 현재 위치를 사용할 수 있습니다.</p>
            </div>
            <button type="button" className="primary-button" onClick={useBrowserLocation}>
              내 현재 위치 사용
            </button>
            <div
              ref={mapRef}
              className="map-picker"
              role="button"
              tabIndex={0}
              onClick={selectFromFallbackMap}
              aria-label="지도에서 현재 위치 선택"
            />
            {!KAKAO_MAP_KEY ? <p>지도 키가 없으면 간이 지도 선택을 사용합니다.</p> : null}
            {error ? <p className="field-error">{error}</p> : null}
            <button type="button" className="secondary-button" onClick={() => setOpen(false)}>
              닫기
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
};

export default LocationPicker;
