FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --legacy-peer-deps

COPY src ./src
COPY public ./public
COPY index.html ./
COPY tsconfig.json ./
COPY tsconfig.node.json ./
COPY vite.config.ts ./

RUN chown -R node:node /app

# No correr como root
USER node

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]
