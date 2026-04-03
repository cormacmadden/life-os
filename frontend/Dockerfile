FROM node:20

WORKDIR /app

COPY frontend/package*.json ./

RUN npm install

COPY frontend ./

EXPOSE 3000

ENV NEXT_PUBLIC_LOCAL_BACKEND_URL=http://192.168.1.214:8080
ENV NEXT_PUBLIC_PROD_BACKEND_URL=http://192.168.1.214:8080
ENV NODE_ENV=development

CMD ["npm", "run", "dev"]