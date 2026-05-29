FROM ghost:6-alpine

WORKDIR /var/lib/ghost

RUN mkdir -p current/core/server/adapters/storage/ghost-cos \
    && chown -R node:node current/core/server/adapters/storage/ghost-cos

COPY --chown=node:node package.json package-lock.json current/core/server/adapters/storage/ghost-cos/
COPY --chown=node:node index.js current/core/server/adapters/storage/ghost-cos/

RUN cd current/core/server/adapters/storage/ghost-cos \
    && npm install --production --no-audit --no-fund --loglevel=error \
    && rm -rf /home/node/.npm /tmp/* || true

EXPOSE 2368

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('net').createConnection(2368,'localhost').on('connect',()=>{process.exit(0)}).on('error',()=>process.exit(1))"
