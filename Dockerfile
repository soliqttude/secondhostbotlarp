FROM node:24-bookworm
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends libimage-exiftool-perl && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN exiftool -ver && node --version
EXPOSE 10000
CMD ["npm","start"]
