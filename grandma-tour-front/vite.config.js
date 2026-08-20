import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // OS 환경변수(도커 compose 의 environment)와 .env 파일을 함께 읽는다.
  // 같은 키가 양쪽에 있으면 OS 환경변수가 이긴다.
  const env = loadEnv(mode, process.cwd())

  return {
    plugins: [react()],
    server: {
      host: true,
      // 프론트 코드는 항상 상대경로 /api 로 부른다. 백엔드 주소를 화면에 박지 않기 위해서다.
      // 도커에서는 서비스 이름(backend), 로컬에서는 localhost 를 본다.
      proxy: {
        '/api': {
          target: env.VITE_API_TARGET || 'http://localhost:3000',
          changeOrigin: true,
        },
      },
    },
  }
})
