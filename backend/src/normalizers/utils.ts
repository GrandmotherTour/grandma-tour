export const asRecord = (value: unknown): Record<string, unknown> => {
  return typeof value === 'object' && value !== null ? value as Record<string, unknown> : {};
};

export const getString = (record: Record<string, unknown>, key: string): string | null => {
  const value = record[key];
  return typeof value === 'string' && value.trim() !== '' ? value : null;
};

export const getNumber = (record: Record<string, unknown>, key: string): number | null => {
  const value = record[key];

  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
};

export const hasText = (value: string | null | undefined, patterns: string[]) => {
  if (!value) {
    return false;
  }

  return patterns.some((pattern) => value.includes(pattern));
};

export const normalizeIsoLikeDateTime = (value: string | null): string | null => {
  if (!value) {
    return null;
  }

  const trimmed = value.trim();
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(trimmed)) {
    return `${trimmed.replace(' ', 'T')}:00+09:00`;
  }

  if (/^\d{8} \d{4}$/.test(trimmed)) {
    const [date, time] = trimmed.split(' ');
    return `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}T${time.slice(0, 2)}:${time.slice(2, 4)}:00+09:00`;
  }

  return trimmed;
};
