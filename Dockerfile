# youngsili-dashboard — 프로덕션 이미지 (멀티스테이지: CRA 빌드 → nginx 정적 서빙)
# 클라우드 중립(KT클라우드 이전 대비): 표준 node/nginx 이미지만 사용.
#
# 빌드:  docker build -t youngsili-dashboard --build-arg REACT_APP_SERVER_URL=https://youngsili-server-production.up.railway.app .
# 실행:  docker run -p 8080:80 youngsili-dashboard

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY tsconfig.json ./
COPY public ./public
COPY src ./src
# CRA는 빌드 시점에 REACT_APP_* 를 정적으로 박아넣는다 — 서버 주소는 빌드 인자로.
ARG REACT_APP_SERVER_URL=https://youngsili-server-production.up.railway.app
ENV REACT_APP_SERVER_URL=$REACT_APP_SERVER_URL
ENV CI=false
RUN npx react-scripts build

FROM nginx:1.27-alpine
COPY --from=build /app/build /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
