import { Client, Events, GatewayIntentBits } from "discord.js";
import { BOT_TOKEN } from "./config.js";
import { registerDiscordHandlers } from "./discord.js";
import { logger } from "./logger.js";

export function buildBot(): Client {
  if (!BOT_TOKEN) throw new Error("DISCORD_TOKEN is not set");
  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
  });
  client.once(Events.ClientReady, (ready) => {
    logger.info({ username: ready.user.username, id: ready.user.id }, "bot ready");
  });
  registerDiscordHandlers(client);
  return client;
}
