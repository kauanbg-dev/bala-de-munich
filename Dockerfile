FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY . .
ENV HOST=0.0.0.0
ENV NODE_ENV=production
EXPOSE 8765
CMD ["node", "scripts/serve.mjs"]
