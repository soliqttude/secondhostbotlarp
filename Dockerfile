FROM node:24-bookworm

# Render Docker runtime with HEIC/HEVC encoding support.
# Bookworm's base libheif is older and does not ship the x265 plugin;
# Bookworm Backports provides matching libheif + libheif-plugin-x265 packages.

ENV NODE_ENV=production

RUN printf '%s\n' \
      'deb http://deb.debian.org/debian bookworm-backports main' \
      > /etc/apt/sources.list.d/backports.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends \
      libimage-exiftool-perl \
    && apt-get install -y --no-install-recommends -t bookworm-backports \
      libheif-examples \
      libheif-plugin-x265 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install --omit=dev

COPY . .

RUN exiftool -ver \
    && heif-enc -v \
    && heif-enc --help \
    && node --version

EXPOSE 10000

CMD ["npm","start"]
