FROM node:20-alpine

WORKDIR /app

# 레이어 캐시 최적화: package 파일 우선 복사
COPY package.json package-lock.json* ./

# 의존성 설치 및 찌꺼기 삭제 (Clean build)
RUN npm install && npm cache clean --force

# 나머지 소스 복사
COPY . .

# package.json에 정의된 start 명령어(nodemon) 실행
CMD ["npm", "start"]
