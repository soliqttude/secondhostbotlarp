const required=(name:string)=>{const value=process.env[name]?.trim();if(!value)throw new Error(`Missing required environment variable: ${name}`);return value;};
export const DISCORD_TOKEN=required("DISCORD_TOKEN");
export const CLIENT_ID=required("CLIENT_ID");
export const GUILD_ID=process.env.GUILD_ID?.trim()||undefined;
export const FOUNDER_ID=process.env.FOUNDER_ID?.trim()||undefined;
export const PORT=Number(process.env.PORT??10000);
export const DATA_DIR=process.env.DATA_DIR?.trim()||"/tmp/iphone-meta-bot";
