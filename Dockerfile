FROM node:20-alpine
RUN apk add --no-cache openssl

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

RUN npx prisma generate
RUN npm run build && test -s dist/index.js

EXPOSE 3002

CMD ["sh", "-c", "npx prisma migrate deploy && npm run start"]