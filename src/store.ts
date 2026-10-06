import {mkdir,readFile,writeFile} from "node:fs/promises";
import path from "node:path";
import {DATA_DIR} from "./config.js";

type UserRecord={credits:number;plan:"free"|"pro"|"unlimited";processed:number;lastUsedAt?:string};
type StoreData={users:Record<string,UserRecord>};
const file=path.join(DATA_DIR,"data.json");
let data:StoreData={users:{}};
let loaded=false;
let queue=Promise.resolve();

export async function initStore(){await mkdir(DATA_DIR,{recursive:true});try{data=JSON.parse(await readFile(file,"utf8")) as StoreData;}catch{data={users:{}};await persist();}loaded=true;}
function ensureLoaded(){if(!loaded)throw new Error("store not initialized");}
async function persist(){const tmp=file+".tmp";await writeFile(tmp,JSON.stringify(data,null,2));await writeFile(file,JSON.stringify(data,null,2));}
async function mutate(fn:()=>void){ensureLoaded();fn();queue=queue.then(persist);await queue;}
export function getUser(id:string):UserRecord{ensureLoaded();return data.users[id]??{credits:10,plan:"free",processed:0};}
export async function ensureUser(id:string){if(!data.users[id])await mutate(()=>{data.users[id]={credits:10,plan:"free",processed:0};});return data.users[id];}
export async function consumeCredit(id:string){let ok=false;await mutate(()=>{const u=data.users[id]??(data.users[id]={credits:10,plan:"free",processed:0});if(u.credits<1)return;u.credits--;u.processed++;u.lastUsedAt=new Date().toISOString();ok=true;});return ok;}
export async function refundCredit(id:string){await mutate(()=>{const u=data.users[id]??(data.users[id]={credits:10,plan:"free",processed:0});u.credits++;});}
export async function addCredits(id:string,amount:number){await mutate(()=>{const u=data.users[id]??(data.users[id]={credits:10,plan:"free",processed:0});u.credits=Math.max(0,u.credits+amount);});}
export async function setCredits(id:string,amount:number){await mutate(()=>{const u=data.users[id]??(data.users[id]={credits:10,plan:"free",processed:0});u.credits=Math.max(0,Math.floor(amount));});}
export async function setPlan(id:string,plan:UserRecord["plan"]){await mutate(()=>{const u=data.users[id]??(data.users[id]={credits:10,plan:"free",processed:0});u.plan=plan;});}
export async function stats(){ensureLoaded();return Object.values(data.users).reduce((a,u)=>({users:a.users+1,credits:a.credits+u.credits,processed:a.processed+u.processed}),{users:0,credits:0,processed:0});}
