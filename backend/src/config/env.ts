import dotenv from 'dotenv';

dotenv.config();

export const env = {
  PORT: Number(process.env.PORT || 4000),
  NODE_ENV: process.env.NODE_ENV || 'development',
  DB_HOST: process.env.DB_HOST || 'localhost',
  DB_PORT: Number(process.env.DB_PORT || 3306),
  DB_USERNAME: process.env.DB_USERNAME || 'root',
  DB_PASSWORD: process.env.DB_PASSWORD || '',
  DB_NAME: process.env.DB_NAME || 'jaturip',
  KAKAO_REST_API_KEY: process.env.KAKAO_REST_API_KEY || process.env.KAKAO_REST_KEY || '',
  KAKAO_JS_API_KEY: process.env.KAKAO_JS_API_KEY || '',
  TOURAPI_SERVICE_KEY: process.env.TOURAPI_SERVICE_KEY || process.env.DATA_GO_KR_KEY || '',
  WEATHER_API_KEY: process.env.WEATHER_API_KEY || process.env.WEATHER_KR_API_KEY || '',
  SEOUL_DATA_API_KEY: process.env.SEOUL_DATA_API_KEY || process.env.SEOUL_API_KEY || ''
};
