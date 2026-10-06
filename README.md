# Discord Bot — Railway Deployment

Discord version of the former Telegram Bot Builders project.

## What it does

- Discord slash commands
- iPhone EXIF metadata processing
- JPEG/PNG → HEIC conversion
- SQLite users, credits, plans, history, logs and feedback
- User / moderator / admin / founder permissions
- Single-image and batch image processing
- Processing queue and duplicate protection
- Analytics and system health
- Persistent SQLite storage

## Railway

Set these variables:

- `DISCORD_TOKEN` — Discord bot token
- `CLIENT_ID` — Discord application/client ID
- `FOUNDER_ID` — Discord user ID of the founder
- `GUILD_ID` — optional; when set, slash commands sync to that guild immediately
- `SUPPORT_CONTACT` — optional support text

Persist the Railway volume at `/app/data`.

The image pipeline also needs `libheif`, `libvips`, and `exiftool`; Nixpacks installs them automatically.

## Commands

User:
`/start` `/help` `/image` `/batch` `/credits` `/models` `/plan` `/stats` `/history` `/feedback`

Moderator:
`/userinfo` `/ban` `/unban` `/topmodels` `/logs`

Admin:
`/setcredits` `/addcredits` `/takecredits` `/setplan` `/analytics` `/serverstats` `/topusers` `/clearlogs`

Founder:
`/setrole` `/maintenance` `/lockbot` `/unlockbot` `/panicmode` `/killqueue` `/resetpipeline` `/systemhealth` `/backupdb`

## Local

Requires Node 24.

```bash
npm install
export DISCORD_TOKEN=...
export CLIENT_ID=...
export FOUNDER_ID=...
npm run dev
```
