import {createServer} from "node:http";
import {mkdir} from "node:fs/promises";
import {DATA_DIR,DISCORD_TOKEN,PORT} from "./config.js";
import {buildClient,registerCommands} from "./discord.js";
import {closeMetadata} from "./metadata.js";
import {logger} from "./logger.js";
await mkdir(DATA_DIR,{recursive:true});await registerCommands();const client=buildClient();await client.login(DISCORD_TOKEN);
const server=createServer((req,res)=>{if(req.url==="/"||req.url==="/health"){res.writeHead(200,{"content-type":"application/json"});res.end(JSON.stringify({ok:true,service:"iphone-metadata-bot"}));return;}res.writeHead(404);res.end();});
server.listen(PORT,"0.0.0.0",()=>logger.info({port:PORT},"health server listening"));
async function shutdown(signal:string){logger.info({signal},"shutting down");client.destroy();await closeMetadata();server.close();process.exit(0);}
process.once("SIGINT",()=>void shutdown("SIGINT"));process.once("SIGTERM",()=>void shutdown("SIGTERM"));
