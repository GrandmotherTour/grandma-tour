export function formatMinutes(minutes) {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}시간 ${rest}분` : `${hours}시간`;
}

export function addMinutesToTime(time, minutes) {
  const [hours, mins] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, mins || 0, 0, 0);
  date.setMinutes(date.getMinutes() + minutes);
  return date.toTimeString().slice(0, 5);
}

export function toIsoToday(time) {
  const [hours, mins] = time.split(':').map(Number);
  const date = new Date();
  date.setHours(hours || 0, mins || 0, 0, 0);
  return date.toISOString();
}
