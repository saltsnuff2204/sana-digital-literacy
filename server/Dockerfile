FROM node:24-alpine
WORKDIR /app
COPY server/server.mjs ./server/server.mjs
COPY dist ./dist
RUN mkdir -p /app/server/data && chown -R node:node /app
USER node
ENV HOST=0.0.0.0 PORT=8787
EXPOSE 8787
VOLUME ["/app/server/data"]
CMD ["node", "server/server.mjs"]
