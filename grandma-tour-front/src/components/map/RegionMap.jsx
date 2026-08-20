import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
} from 'react-leaflet'

import 'leaflet/dist/leaflet.css'

function RegionMap({ onSelectRegion }) {
  // 아직 실제 지역을 정하지 않았으므로 임시 위치
  const testPosition = [36.5, 127.8]

  return (
    <MapContainer
      center={testPosition}
      zoom={8}
      scrollWheelZoom={true}
      className="region-map"
    >
      <TileLayer
        attribution="&copy; OpenStreetMap contributors"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <CircleMarker
        center={testPosition}
        radius={10}
        eventHandlers={{
          click: () => onSelectRegion('테스트 지역'),
        }}
      >
        <Popup>
          <div>
            <strong>테스트 지역</strong>

            <p>
              할매투어 지역 설명이
              <br />
              들어갈 예정입니다.
            </p>
          </div>
        </Popup>
      </CircleMarker>
    </MapContainer>
  )
}

export default RegionMap