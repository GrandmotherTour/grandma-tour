FROM node:20-alpine

WORKDIR /app

# 의존성 파일 먼저 복사
COPY package.json package-lock.json ./

# package-lock 기준으로 정확하게 설치
RUN npm ci

# 소스코드 복사
COPY . .

EXPOSE 5173




# Vite 개발 서버
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0"]