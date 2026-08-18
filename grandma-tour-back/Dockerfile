FROM node:20-bookworm-slim

WORKDIR /app

# Python (3.11) + pip 설치 
RUN apt-get update \
    && apt-get install -y --no-install-recommends python3 python3-pip \
    && rm -rf /var/lib/apt/lists/*

# OR-Tools 설치
RUN pip3 install --break-system-packages ortools

# Node 의존성 설치
COPY package.json package-lock.json* ./
RUN npm install && npm cache clean --force

# 소스 복사
COPY . .

CMD ["npm", "start"]