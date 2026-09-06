export const congestionService = {
  getCongestion: async () => {
    return {
      level: 'normal',
      message: '혼잡도 정보 없음'
    };
  }
};
