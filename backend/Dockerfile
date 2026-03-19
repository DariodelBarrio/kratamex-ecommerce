FROM node:20-alpine

# argon2 requiere compilación nativa: python3, make y g++
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Crear directorios de uploads con permisos correctos
RUN mkdir -p src/uploads src/avatars && chown -R node:node /app

# No correr como root
USER node

EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3001/api/productos || exit 1

CMD ["npm", "start"]
