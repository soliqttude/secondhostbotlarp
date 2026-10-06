# iPhone Metadata Discord Bot

Upload a photo, select an iPhone profile, and receive the same image with the selected camera metadata applied.

No AI generation, resizing, cropping, or image recreation.

## Render deployment

Build command:
`npm install`

Start command:
`npm start`

Environment variables:
- `DISCORD_TOKEN` — bot token
- `CLIENT_ID` — Discord application ID
- `GUILD_ID` — optional, recommended for instant command registration
- `FOUNDER_ID` — optional founder/admin Discord ID
- `PORT` — Render provides this automatically

The included Dockerfile installs ExifTool automatically.

## Commands

`/image` — upload a photo and select an iPhone profile
`/models` — list profiles
`/credits` — view credits
`/help` — help
`/addcredits` — founder-only credit command

The MP value is part of the selected metadata profile. The source image is not resized to that megapixel count.
