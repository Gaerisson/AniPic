FROM node:24-bookworm-slim AS build
# CPU inference is bundled; avoid downloading optional CUDA libraries at build time.
ENV ONNXRUNTIME_NODE_INSTALL=skip
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY index.html vite.config.mjs ./
COPY src ./src
COPY shared ./shared
COPY public ./public
COPY video ./video
COPY scripts/build-video.mjs scripts/video-browser.mjs ./scripts/
RUN npm run build && npm run video:build && VIDEO_BROWSER_INSTALL_DIR=/opt/remotion-browser npm run video:browser && npm prune --omit=dev

FROM node:24-bookworm-slim
ARG VCS_REF=unknown
LABEL org.opencontainers.image.title="AniPic" \
      org.opencontainers.image.version="3.15.0" \
      org.opencontainers.image.revision=$VCS_REF \
      org.opencontainers.image.source="https://github.com/Gaerisson/AniPic" \
      org.opencontainers.image.authors="Gaerisson"
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3000 DB_DIR=/data MEDIA_DIR=/media CACHE_DIR=/cache BACKUP_DIR=/backups
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends libnss3 libdbus-1-3 libatk1.0-0 libgbm-dev libasound2 libxrandr2 libxkbcommon-dev libxfixes3 libxcomposite1 libxdamage1 libatk-bridge2.0-0 libpango-1.0-0 libcairo2 libcups2 fonts-dejavu-core fonts-noto-color-emoji && rm -rf /var/lib/apt/lists/*
COPY --from=build --chown=node:node /app/node_modules ./node_modules
COPY --from=build --chown=node:node /app/dist ./dist
COPY --from=build --chown=node:node /app/video-bundle ./video-bundle
COPY --from=build --chown=node:node /app/browser-path.txt ./browser-path.txt
COPY --from=build --chown=node:node /opt/remotion-browser /opt/remotion-browser
COPY --chown=node:node package.json package-lock.json ./
COPY --chown=node:node THIRD_PARTY_NOTICES.txt ./
COPY --chown=node:node COPYING LICENSE.md THIRD_PARTY_NOTICES.md ./
COPY --chown=node:node licenses ./licenses
COPY --chown=node:node server ./server
COPY --chown=node:node shared ./shared
COPY --chown=node:node scripts ./scripts
COPY --chown=node:node video ./video
RUN mkdir -p /data /media /cache /backups && chown node:node /data /media /cache /backups
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server/index.mjs"]
