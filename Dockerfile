FROM node:24-bookworm

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends libheif-examples libimage-exiftool-perl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN exiftool -ver && heif-enc -v

EXPOSE 10000

CMD ["npm","start"]
