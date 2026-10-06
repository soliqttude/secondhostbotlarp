FROM node:24-bookworm

# Render native Node runtimes do not include libheif/heif-enc.
# This Docker image supplies the OS-level HEIC encoder required by /image.

ENV NODE_ENV=production

RUN apt-get update \
    && apt-get install -y --no-install-recommends libheif-examples libimage-exiftool-perl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN exiftool -ver && heif-enc -v && node --version

EXPOSE 10000

CMD ["npm","start"]
