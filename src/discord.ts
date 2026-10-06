import {ActionRowBuilder,AttachmentBuilder,ChatInputCommandInteraction,Client,EmbedBuilder,Events,REST,Routes,SlashCommandBuilder,StringSelectMenuBuilder,StringSelectMenuInteraction} from "discord.js";
import {CLIENT_ID,DISCORD_TOKEN,GUILD_ID,FOUNDER_ID} from "./config.js";
import {getModel,IPHONE_MODELS} from "./models.js";
import {processImage} from "./image.js";
import {logger} from "./logger.js";

const SELECT_ID="iphone-model-select";
const pending=new Map<string,{url:string;name:string}>();
const credits=new Map<string,number>();
const getCredits=(id:string)=>credits.get(id)??10;

const commands=[
new SlashCommandBuilder().setName("image").setDescription("Apply iPhone metadata to a photo").addAttachmentOption(o=>o.setName("photo").setDescription("Photo to process").setRequired(true)),
new SlashCommandBuilder().setName("models").setDescription("List supported iPhone profiles"),
new SlashCommandBuilder().setName("credits").setDescription("Show your credits"),
new SlashCommandBuilder().setName("help").setDescription("Show bot help"),
new SlashCommandBuilder().setName("addcredits").setDescription("Add credits to a user").addUserOption(o=>o.setName("user").setDescription("User").setRequired(true)).addIntegerOption(o=>o.setName("amount").setDescription("Amount").setMinValue(1).setRequired(true))
];

function modelMenu(){return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(new StringSelectMenuBuilder().setCustomId(SELECT_ID).setPlaceholder("Choose an iPhone model").addOptions(IPHONE_MODELS.map(m=>({label:m.label,value:m.key,description:m.megapixels+" MP - metadata only"}))));}

export async function registerCommands(){
const rest=new REST({version:"10"}).setToken(DISCORD_TOKEN);
const body=commands.map(x=>x.toJSON());
if(GUILD_ID)await rest.put(Routes.applicationGuildCommands(CLIENT_ID,GUILD_ID),{body});else await rest.put(Routes.applicationCommands(CLIENT_ID),{body});
logger.info({commands:body.length},"slash commands synced");
}

export function buildClient(){
const client=new Client({intents:[]});
client.once(Events.ClientReady,r=>logger.info({user:r.user.tag},"bot ready"));
client.on(Events.InteractionCreate,async i=>{
try{if(i.isChatInputCommand())await handleCommand(i);else if(i.isStringSelectMenu()&&i.customId===SELECT_ID)await handleSelection(i);}
catch(error){logger.error({err:error},"interaction failed");if(i.isRepliable()&&!i.replied&&!i.deferred)await i.reply({content:"❌ Something went wrong.",ephemeral:true}).catch(()=>undefined);}
});
return client;
}

async function handleCommand(i:ChatInputCommandInteraction){
if(i.commandName==="image"){
const a=i.options.getAttachment("photo",true);
if(!/^image\//i.test(a.contentType??"")){await i.reply({content:"❌ Please upload an image.",ephemeral:true});return;}
pending.set(i.user.id,{url:a.url,name:a.name});
await i.reply({content:"📷 "+a.name+"\nChoose the iPhone profile. Only metadata will be changed - the image pixels are not resized or AI-generated.",components:[modelMenu()],ephemeral:true});
return;
}
if(i.commandName==="models"){await i.reply({embeds:[new EmbedBuilder().setTitle("iPhone profiles").setDescription(IPHONE_MODELS.map(m=>"**"+m.label+"** - "+m.megapixels+" MP").join("\n"))],ephemeral:true});return;}
if(i.commandName==="credits"){await i.reply({content:"💳 You have **"+getCredits(i.user.id)+"** credits.",ephemeral:true});return;}
if(i.commandName==="addcredits"){
if(FOUNDER_ID&&i.user.id!==FOUNDER_ID){await i.reply({content:"❌ Founder only.",ephemeral:true});return;}
const user=i.options.getUser("user",true);const amount=i.options.getInteger("amount",true);
credits.set(user.id,getCredits(user.id)+amount);await i.reply({content:"✅ Added **"+amount+"** credits to "+user.tag+"."});return;
}
await i.reply({content:"**iPhone Metadata Bot**\n\n/image - apply a selected iPhone metadata profile to a photo.\n/models - list iPhone profiles.\n/credits - view credits.",ephemeral:true});
}

async function handleSelection(i:StringSelectMenuInteraction){
const model=getModel(i.values[0]);const source=pending.get(i.user.id);
if(!model||!source){await i.update({content:"❌ This selection expired. Run /image again.",components:[]});return;}
const balance=getCredits(i.user.id);
if(balance<1){await i.update({content:"❌ You don't have enough credits.",components:[]});return;}

await i.update({content:"⏳ Applying **"+model.label+"** metadata…",components:[]});
credits.set(i.user.id,balance-1);pending.delete(i.user.id);

try{
const result=await processImage(source.url,source.name,model,i.user.id);
// No image extension on purpose: Discord otherwise renders image attachments inline.
// The bytes are still the real modified JPEG/PNG/etc. file and can be downloaded.
const fileName="IMG_"+model.key+"_metadata";
await i.followUp({
content:"✅ **Modified image file** — "+model.label+" metadata applied and verified.\n📎 Download the attachment below.",
files:[new AttachmentBuilder(result.buffer,{name:fileName})]
});
await result.cleanup();
}catch(error){
credits.set(i.user.id,balance);
await i.followUp({content:"❌ Metadata processing failed: "+(error instanceof Error?error.message:"unknown error")+"\n💳 Your credit was refunded.",ephemeral:true});
}
}
