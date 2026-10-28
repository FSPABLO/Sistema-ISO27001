# syntax=docker/dockerfile:1
# Sistema de auditoría ISO/IEC 27001:2022 para Oracle.
# Node.js 24 + Oracle Instant Client (Basic Light) para node-oracledb en modo Thick.
# El modo Thick es obligatorio porque el modo Thin no soporta el cifrado de red nativo de Oracle.

FROM node:24-bookworm-slim AS base
ARG TARGETARCH
# URL de Instant Client: por defecto la última versión publicada para la arquitectura de la imagen
ARG IC_URL=""
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends libaio1 unzip curl ca-certificates; \
    case "${TARGETARCH:-arm64}" in \
      arm64) zip=instantclient-basiclite-linux-arm64.zip ;; \
      amd64) zip=instantclient-basiclite-linuxx64.zip ;; \
      *) echo "Arquitectura no soportada: ${TARGETARCH}"; exit 1 ;; \
    esac; \
    curl -fsSL -o /tmp/ic.zip "${IC_URL:-https://download.oracle.com/otn_software/linux/instantclient/$zip}"; \
    mkdir -p /opt/oracle; unzip -q /tmp/ic.zip -d /opt/oracle; rm /tmp/ic.zip; \
    ln -s /opt/oracle/instantclient_* /opt/oracle/instantclient; \
    echo /opt/oracle/instantclient > /etc/ld.so.conf.d/oracle-instantclient.conf; ldconfig; \
    apt-get purge -y unzip curl; apt-get autoremove -y; rm -rf /var/lib/apt/lists/*
ENV ORACLE_LIB_DIR=/opt/oracle/instantclient \
    NODE_ENV=production \
    TZ=UTC
WORKDIR /app

# Dependencias nativas (better-sqlite3) por si no hay binario precompilado
FROM base AS compilacion
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund
RUN mkdir /pruebas && cp package.json package-lock.json /pruebas/ && cd /pruebas && npm ci --include=dev --no-audit --no-fund

# Imagen para pruebas automáticas: docker build --target pruebas -t iso27001-pruebas . && docker run --rm iso27001-pruebas
FROM base AS pruebas
ENV NODE_ENV=test
COPY --from=compilacion /pruebas/node_modules ./node_modules
COPY . .
CMD ["npm", "test"]

FROM base AS final
COPY --from=compilacion /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src
COPY public ./public
COPY sql ./sql
RUN mkdir -p /app/datos && chown node:node /app/datos
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:3000/api/auth/csrf').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "src/server.js"]
