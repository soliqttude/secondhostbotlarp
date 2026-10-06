import { REST, Routes } from "discord.js";
import { buildBot } from "./bot.js";
import { BOT_TOKEN, CLIENT_ID, GUILD_ID } from "./config.js";
import { logger } from "./logger.js";
import { writeLog } from "./logs.js";
import { commandDefinitions } from "./discord.js";

async function main() {
  if (!BOT_TOKEN) throw new Error("DISCORD_TOKEN is not set");
  if (!CLIENT_ID) throw new Error("CLIENT_ID is not set");

  const bot = buildBot();

  process.once("SIGINT", () => bot.destroy());
  process.once("SIGTERM", () => bot.destroy());

  process.on("unhandledRejection", (reason) => {
    logger.error({ reason }, "unhandledRejection");
    writeLog({ type: "error", action: "unhandledRejection", meta: { reason: String(reason) } });
  });
  process.on("uncaughtException", (err) => {
    logger.error({ err }, "uncaughtException");
    writeLog({ type: "error", action: "uncaughtException", meta: { message: err.message } });
  });

  const rest = new REST({ version: "10" }).setToken(BOT_TOKEN);
  const route = GUILD_ID
    ? Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID)
    : Routes.applicationCommands(CLIENT_ID);

  await rest.put(route, { body: commandDefinitions });
  logger.info({ guild: GUILD_ID || "global", commands: commandDefinitions.length }, "slash commands synced");

  await bot.login(BOT_TOKEN);
}

main().catch((err) => {
  logger.error({ err }, "fatal");
  process.exit(1);
});
