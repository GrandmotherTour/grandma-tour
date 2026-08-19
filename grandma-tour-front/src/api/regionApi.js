import { apiGet } from './client.js'

export function getRegions() {
  return apiGet('/regions')
}

export function getRegionById(id) {
  return apiGet(`/regions/${id}`)
}

export function getRegionPoints(id) {
  return apiGet(`/regions/${id}/points`)
}

export function getRegionPointById(regionId, pointId) {
  return apiGet(`/regions/${regionId}/points/${pointId}`)
}