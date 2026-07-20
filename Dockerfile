FROM node:18-alpine

# Instalar herramientas básicas por si sqlite3 las necesita para compilar (aunque suele descargar precompilados)
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm install --omit=dev

COPY . .

EXPOSE 3000

ENV PORT=3000
ENV NODE_ENV=production

CMD ["npm", "start"]
