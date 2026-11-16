import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {fileURLToPath} from "node:url";
const retired = /@?twoe(?:17)?\b|\be17\b/i;
const neutral = "NEUTRAL DIRECT ANSWERS - PRIORITY\nApply these response rules in groups and DMs, overriding older conversational examples and style guidance. Answer only the current request in a neutral, concise tone. No theatrical openings, jokes, banter, personal commentary, celebration, search narration, unsolicited history, company-name variants, or closing remarks. Do not imitate the tone of previous group replies. For a simple COA request, give only the product and GB, the exact matching laboratory link(s), and the original Telegram reference when available. Default to one short sentence plus links. Keep genuinely distinct relevant tests or batches, but omit unrelated reports. Never mention registration, indexing, tools, scripts, rendering, catalogue internals, or inability to open a laboratory page unless the user specifically requests report findings that cannot be verified. Never invent measured results. The former public COA website is retired: never search it, recommend it, discuss its publication status, or add a live-page confirmation reminder. Require an explicitly identified GB before COA lookup. These rules supersede old session examples, memories, and summaries.\n\n";
export function cleanAgents(text) {
  const result = text.replace(/^\* Twoe \(@twoe17\) — HE \/ HIM\r?\n/gm,"")
    .replace(/@twoe17,\s*/gi,"");
  return result.includes("NEUTRAL DIRECT ANSWERS - PRIORITY") ? result : neutral+result;
}
export function cleanLore(text) {
  const next = text.replace(/## Twoe\r?\n[\s\S]*?(?=# ADMIN TEAM DYNAMIC)/,"")
    .replace("Lou, Toffer, and Twoe are a team.","Lou and Toffer are a team.")
    .replace(/^\*\*Twoe:\*\*[^\n]*\r?\n/gm,"")
    .replace("All three:","Both:")
    .replace(/Good:\r?\n"Web issue\? E may know\.[\s\S]*?avoiding all of us\."\r?\n\r?\n/,"");
  return next;
}
export function cleanKb(value) {
  if (Array.isArray(value)) return value.filter(v=>!(typeof v==="string"&&/^@?(?:twoe(?:17)?|e17)$/i.test(v.trim()))).map(cleanKb);
  if(value && typeof value==="object") return Object.fromEntries(Object.entries(value).map(([k,v])=>[k,cleanKb(v)]));
  if(typeof value==="string") return value.replace(/@twoe17,\s*/gi,"").replace(/\s+or\s+@twoe17\b/gi,"");
  return value;
}
export function install(root) {
  const names=["AGENTS.md","LORE.md","knowledge_base.json"];
  const original=names.map(n=>fs.readFileSync(path.join(root,n),"utf8"));
  const kb=JSON.parse(original[2]), cleaned=cleanKb(kb);
  if(JSON.stringify(cleaned)!==JSON.stringify(kb)&&Number.isFinite(cleaned.version))cleaned.version++;
  const output=[cleanAgents(original[0]),cleanLore(original[1]),JSON.stringify(cleaned,null,2)+"\n"];
  const changes=names.map((n,i)=>({name:n,old:original[i],next:output[i]})).filter(x=>x.old!==x.next);
  for(const x of changes)if(retired.test(x.next))throw Error("Unrecognized remaining reference in "+x.name+"; nothing changed");
  if(!changes.length){console.log("ALREADY CLEAN");return;}
  const stamp=new Date().toISOString().replace(/[:.]/g,"-");
  const backup=path.join(root,"backups","retired-admin-"+stamp);
  fs.mkdirSync(backup,{recursive:true,mode:0o700});
  for(const x of changes)fs.writeFileSync(path.join(backup,x.name),x.old,{flag:"wx",mode:0o600});
  fs.writeFileSync(path.join(backup,"manifest.json"),JSON.stringify(changes.map(x=>({file:x.name,sha256:crypto.createHash("sha256").update(x.old).digest("hex")})),null,2),{flag:"wx",mode:0o600});
  const prepared=[];
  try{
    for(const x of changes){const dest=path.join(root,x.name),tmp=dest+".retired-admin-"+stamp;fs.writeFileSync(tmp,x.next,{flag:"wx",mode:0o600});prepared.push({tmp,dest});}
    for(const x of prepared)fs.renameSync(x.tmp,x.dest);
    for(const x of changes)console.log("UPDATED:",x.name);
    console.log("VERIFIED: no retired-admin references in AGENTS.md, LORE.md or knowledge_base.json");
    console.log("BACKUP:",backup);
  }catch(e){
    for(const x of changes)fs.copyFileSync(path.join(backup,x.name),path.join(root,x.name));
    throw e;
  }finally{for(const x of prepared)if(fs.existsSync(x.tmp))fs.unlinkSync(x.tmp);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))install(process.env.OPENCLAW_WORKSPACE_DIR||"/data/workspace");

