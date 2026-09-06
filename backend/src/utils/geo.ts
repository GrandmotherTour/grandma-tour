export const clampLatitude = (latitude: number, min = 33, max = 43) => {
  return Math.min(Math.max(latitude, min), max);
};

export const clampLongitude = (longitude: number, min = 124, max = 132) => {
  return Math.min(Math.max(longitude, min), max);
};
