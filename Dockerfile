FROM node:22-alpine
WORKDIR /app
COPY package.json README.md ./
COPY server ./server
COPY public ./public
COPY scripts ./scripts
COPY docs ./docs
RUN mkdir -p /app/data /app/backups && chown -R node:node /app
USER node
ENV NODE_ENV=production PORT=3000 HOST=0.0.0.0 FUELGUARD_DB=/app/data/fuelguard.db BACKUP_DIR=/app/backups FUELGUARD_SEED=minimo
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/salud || exit 1
CMD ["node", "server/index.js"]
