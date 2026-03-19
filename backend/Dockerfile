FROM node:20-alpine

# argon2 requiere compilación nativa: python3, make y g++
RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 3001

CMD ["npm", "start"]
