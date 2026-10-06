FROM node:24-bookworm
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends imagemagick libimage-exiftool-perl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build
RUN exiftool -ver && convert -version && node --version
EXPOSE 10000
CMD ["node","dist/index.js"]