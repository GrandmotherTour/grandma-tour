export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('ko-KR').format(value) + '원';
};
