FROM node:24-alpine AS source

ARG EVOLUTION_VERSION=2.3.7
WORKDIR /tmp

RUN apk update && apk add --no-cache curl tar
RUN curl -fsSL "https://codeload.github.com/EvolutionAPI/evolution-api/tar.gz/refs/tags/${EVOLUTION_VERSION}" \
  -o /tmp/evolution.tar.gz \
  && mkdir -p /src \
  && tar -xzf /tmp/evolution.tar.gz -C /src --strip-components=1

FROM node:24-alpine AS builder

RUN apk update && apk add --no-cache git ffmpeg wget curl bash openssl dos2unix
WORKDIR /evolution

COPY --from=source /src/package*.json ./
COPY --from=source /src/tsconfig.json ./
COPY --from=source /src/tsup.config.ts ./

RUN npm ci --silent

COPY --from=source /src/src ./src
COPY --from=source /src/public ./public
COPY --from=source /src/prisma ./prisma
COPY --from=source /src/manager ./manager
COPY --from=source /src/.env.example ./.env
COPY --from=source /src/runWithProvider.js ./
COPY --from=source /src/Docker ./Docker

RUN chmod +x ./Docker/scripts/* && dos2unix ./Docker/scripts/*
RUN ./Docker/scripts/generate_database.sh
RUN npm run build

FROM node:24-alpine AS final

RUN apk update && apk add --no-cache tzdata ffmpeg bash openssl
ENV TZ=America/Sao_Paulo
ENV DOCKER_ENV=true

WORKDIR /evolution

COPY --from=builder /evolution/package.json ./package.json
COPY --from=builder /evolution/package-lock.json ./package-lock.json
COPY --from=builder /evolution/node_modules ./node_modules
COPY --from=builder /evolution/dist ./dist
COPY --from=builder /evolution/prisma ./prisma
COPY --from=builder /evolution/manager ./manager
COPY --from=builder /evolution/public ./public
COPY --from=builder /evolution/.env ./.env
COPY --from=builder /evolution/Docker ./Docker
COPY --from=builder /evolution/runWithProvider.js ./runWithProvider.js
COPY --from=builder /evolution/tsup.config.ts ./tsup.config.ts

COPY deploy/evolution/railway/start-evolution.sh /usr/local/bin/start-evolution.sh
RUN chmod +x /usr/local/bin/start-evolution.sh

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/start-evolution.sh"]
