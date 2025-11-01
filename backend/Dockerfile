# Construção da imagem do backend (CommonJS)
FROM node:18-alpine AS base
WORKDIR /app

# Instala dependências de build (se necessário para módulos nativos)
RUN apk add --no-cache python3 make g++

# Copia manifestos primeiro para melhor cache
COPY package*.json ./

# Instala dependências
RUN npm ci --legacy-peer-deps

# Copia fontes
COPY tsconfig.json ./
COPY src ./src

# Compila TypeScript
RUN npm run build

# Runtime leve
FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

# Copia apenas o necessário
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/dist ./dist
COPY package*.json ./

EXPOSE 3001
CMD ["node", "dist/server.js"]
