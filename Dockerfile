FROM ghost:6-alpine

WORKDIR /var/lib/ghost

RUN mkdir -p content/adapters/storage/ghost-cos

COPY package.json package-lock.json content/adapters/storage/ghost-cos/
COPY index.js content/adapters/storage/ghost-cos/

RUN cd content/adapters/storage/ghost-cos \
    && npm install --production --no-audit --no-fund --loglevel=error \
    && rm -rf /root/.npm /tmp/*

EXPOSE 2368

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD node -e "require('net').createConnection(2368,'localhost').on('connect',()=>{process.exit(0)}).on('error',()=>process.exit(1))"