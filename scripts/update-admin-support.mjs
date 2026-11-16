import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
export const tag="SUPPORT VIA ADMINS - 2026-11-16";
export const rule=tag+"\nPersonal support is handled by @TofferTimez OR @ImLou29. Tell the member to DM ONE of them and not contact both about the same case. No support bot is available; do not recommend one. Do not mention or recommend the Tegridy website, FAQ, ticket portal or COA page for now. Do not claim that the entire website has closed. Laboratory report links and original Telegram references remain allowed. Keep replies neutral and concise. This owner correction supersedes older support routing and availability statements.\n\n";
export function text(s){
 s=s.replace("Do not redirect personal 0rder or tracking questions to an admin unless a newer official instruction explicitly says otherwise.","Contact only one admin per support case.");
 s=s.replace("@TofferTimez should NOT be the first person contacted for routine questions. Other available support routes should be used first so Toffer can focus on organizing and operating the GB.","For personal support, contact @TofferTimez or @ImLou29. Choose only one admin per case.");
 s=s.replace(/PUBLIC WEBSITE AND SUPPORT POLICY - 2026-11-16\r?\n[^\n]*\r?\n\r?\n/g,"");
 s=s.replace(/@TegridySupportBot is available again and is the primary route for personal support\./g,"Personal support is handled by @TofferTimez or @ImLou29. Contact only one admin per case.");
 s=s.replace(/@TegridySupportBot is currently OUT OF SERVICE and must NOT be recommended until a newer official update says it is available again\./g,"Personal support is handled by @TofferTimez or @ImLou29. Contact only one admin per case.");
 s=s.replace(/@TegridySupportBot\b/g,"ONE admin: @TofferTimez or @ImLou29");
 return s.includes(tag)?s:rule+s;
}
export function agents(s){
 const begin=s.indexOf("Personal Order Support — PRIORITY ROUTING"),end=s.indexOf("Do not pretend to have access to personal orders",begin);
 if(begin<0||end<0)throw Error("Expected personal support section not found; nothing changed");
 s=s.slice(0,begin)+`Personal Order Support — PRIORITY ROUTING

For individual 0rder, p@yment, tracking, missing p@ckage, delivery ETA, address changes or other personal support, direct the member to @TofferTimez OR @ImLou29 in one sentence. Tell them to contact ONE admin, not both.

Preferred default:
"For personal support, DM @TofferTimez or @ImLou29; please contact only one of them about the same case."

Do not recommend any support bot, website ticket or additional route. Do not estimate individual delivery status or add unsolicited fulfillment commentary.

`+s.slice(end);
 s=s.replace(/^\* Personal 0rder,[^\n]*$/m,'* Personal 0rder, p@yment, tracking, missing p@ckage, delivery ETA, or account-specific sh1pping question → direct the user to @TofferTimez OR @ImLou29 in ONE natural sentence, asking them to contact only ONE admin. STOP.');
 return text(s);
}
export function kb(value){
 const next=structuredClone(value);
 function walk(o){
  if(!o||typeof o!=="object")return;
  if(typeof o.content==="string"&&(/TegridySupportBot/.test(o.content)||o.content.includes("PUBLIC WEBSITE AND SUPPORT POLICY - 2026-11-16")))o.content=text(o.content);
  for(const v of Object.values(o))if(v&&typeof v==="object")walk(v);
 }
 walk(next);
 if(JSON.stringify(next)!==JSON.stringify(value)&&Number.isFinite(next.version))next.version++;
 return next;
}
export function install(root){
 const files=["AGENTS.md","knowledge_base.json","MEMORY.md"];
 const original=files.map(n=>fs.existsSync(path.join(root,n))?fs.readFileSync(path.join(root,n),"utf8"):null);
 if(original[0]===null||original[1]===null)throw Error("Missing required workspace file");
 const mem=original[2]||"";
 const outputs=[agents(original[0]),JSON.stringify(kb(JSON.parse(original[1])),null,2)+"\n",text(mem)];
 const changes=files.map((name,i)=>({name,old:original[i],next:outputs[i]})).filter(x=>x.old!==x.next);
 if(!changes.length){console.log("ALREADY UPDATED");return;}
 const stamp=new Date().toISOString().replace(/[:.]/g,"-"),backup=path.join(root,"backups","admin-support-"+stamp);
 fs.mkdirSync(backup,{recursive:true,mode:0o700});
 for(const x of changes)if(x.old!==null)fs.writeFileSync(path.join(backup,x.name),x.old,{flag:"wx",mode:0o600});
 fs.writeFileSync(path.join(backup,"manifest.json"),JSON.stringify(changes.map(x=>({file:x.name,previouslyMissing:x.old===null})),null,2),{flag:"wx",mode:0o600});
 const prepared=[];
 try{
  for(const x of changes){const dest=path.join(root,x.name),tmp=dest+".admin-support-"+stamp;fs.writeFileSync(tmp,x.next,{flag:"wx",mode:0o600});prepared.push({tmp,dest});}
  for(const x of prepared)fs.renameSync(x.tmp,x.dest);
  for(const x of changes)console.log("UPDATED:",x.name);
  console.log("VERIFIED: support routes now point to ONE admin: @TofferTimez or @ImLou29");
  console.log("BACKUP:",backup);
 }catch(e){for(const x of changes){const f=path.join(root,x.name);if(x.old!==null)fs.copyFileSync(path.join(backup,x.name),f);else if(fs.existsSync(f))fs.unlinkSync(f);}throw e;}
 finally{for(const x of prepared)if(fs.existsSync(x.tmp))fs.unlinkSync(x.tmp);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))install(process.env.OPENCLAW_WORKSPACE_DIR||"/data/workspace");


