FROM node:20-alpine AS builder

WORKDIR /app

COPY frontend/package*.json ./

RUN npm ci

COPY frontend ./

# Allow backend URLs to be injected at build time (required for NEXT_PUBLIC_* vars)
ARG NEXT_PUBLIC_LOCAL_BACKEND_URL
ARG NEXT_PUBLIC_PROD_BACKEND_URL
ENV NEXT_PUBLIC_LOCAL_BACKEND_URL=$NEXT_PUBLIC_LOCAL_BACKEND_URL
ENV NEXT_PUBLIC_PROD_BACKEND_URL=$NEXT_PUBLIC_PROD_BACKEND_URL

RUN npm run build

FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./package.json

EXPOSE 3000

CMD ["npm", "start"]
