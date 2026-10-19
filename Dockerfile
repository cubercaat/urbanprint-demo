# 3D UrbanPrint: do'kon + admin panel. Tashqi paket kerak emas.
FROM node:22-alpine
WORKDIR /app
COPY index.html admin.html ./
COPY assets ./assets
COPY data ./data
COPY server ./server
ENV PORT=3000 DATA_DIR=/data TRUST_PROXY=1
EXPOSE 3000
VOLUME ["/data"]
CMD ["node", "server/server.js"]
