FROM node:20-slim

WORKDIR /app

# Copiem doar package.json
COPY package*.json ./

# Instalăm dependințele cu flag-uri de compatibilitate
RUN npm install

# Copiem restul
COPY . .

# Setăm explicit host-ul pentru Vite
ENV HOST=0.0.0.0

EXPOSE 5173

# Comanda de start
CMD ["npm", "run", "dev", "--", "--host"]