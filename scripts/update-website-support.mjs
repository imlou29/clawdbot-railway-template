import fs from "node:fs";
import path from "node:path";
import {fileURLToPath} from "node:url";
export const tag="PUBLIC WEBSITE AND SUPPORT POLICY - 2026-11-16";
export const rule=tag+"\nFor now, do not mention, link, recommend, or direct members to the Tegridy website, its FAQ, ticket portal or COA page, even when older knowledge or memories mention them. This is a response policy; do not claim that the entire website has closed. Direct personal support requests to @TegridySupportBot in one neutral sentence. The previous out-of-service notice is superseded by the owner confirmation that the bot is available again. Do not offer website tickets or unsolicited admin contacts as alternatives. Refer to official announcements in Telegram for general updates only when relevant. Exact laboratory report links and original Telegram references remain allowed. Preserve the explicit-GB requirement and concise reply rules.\n\n";
export function agents(s){
 s=s.replace("If the user still needs help, the support bot cannot resolve the issue, or human intervention is appropriate, they may also contact @TofferTimez, or @ImLou29.","Do not add unsolicited admin referrals or alternative support routes.");
 s=s.replace('"For personal 0rder or tracking help, try @TegridySupportBot first 👍 If needed, you can also reach out to @TofferTimez, or @ImLou29."','"Please contact @TegridySupportBot for personal 0rder or tracking help."');
 return s.includes(tag)?s:rule+s;
}
export function support(s){
 if(s.startsWith(rule))s=s.slice(rule.length);
 s=s.replace(/@TegridySupportBot is currently OUT OF SERVICE and must NOT be recommended until a newer official update says it is available again\./g,"@TegridySupportBot is available again and is the primary route for personal support.");
 s=s.replace(/submit a ticket at peptegridy\.com,? or DM either @ImLou29 or @TofferTimez/g,"contact @TegridySupportBot");
 s=s.replace("Please don’t contact both admins or open a ticket and DM at the same time.","Please do not open duplicate support requests or contact multiple support routes at once.");
 s=s.replace("@TofferTimez is one of the two allowed one-admin DM routes for personal support. Do not also DM @ImLou29 or submit a website ticket about the same issue at the same time.","Use @TegridySupportBot for personal support. Do not open duplicate requests or DM multiple admins about the same issue.");
 s=s.replace("submit one support ticket on the website","contact @TegridySupportBot");
 s=s.replace("This product-specific website-ticket instruction remains in effect. After submitting that ticket,","This product-specific support instruction remains in effect. After contacting support,");
 s=s.replace("For general questions, members may contact @ImLou29 or or ask in the main chat.","For general questions, members may ask in the main chat.");
 s=s.replace("SUPPORT ROUTING UPDATE — NOVEMBER 4, 2026","SUPPORT ROUTING UPDATE — NOVEMBER 16, 2026");
 if(/OUT OF SERVICE|peptegridy\.com|website.ticket|ticket on the website/i.test(s))throw Error("Unrecognized old support route; nothing changed");
 return s.includes(tag)?s:rule+s;
}
export function kb(value){
 let found=0;
 function walk(o){
  if(!o||typeof o!=="object")return;
  if(o.title==="YuanTai GB - Support, Messages & Latest Information"&&typeof o.content==="string"){o.content=support(o.content);found++;}
  else if(typeof o.content==="string"&&/website|peptegridy\.com/i.test(o.content)&&!o.content.includes(tag))o.content=rule+o.content;
  for(const v of Object.values(o))if(v&&typeof v==="object")walk(v);
 }
 const next=structuredClone(value);walk(next);
 if(found!==1)throw Error("Expected exactly one support article; nothing changed");
 if(JSON.stringify(next)!==JSON.stringify(value)&&Number.isFinite(next.version))next.version++;
 return next;
}
export function install(root){
 const files=["AGENTS.md","knowledge_base.json","MEMORY.md"];
 const original=files.map(n=>fs.existsSync(path.join(root,n))?fs.readFileSync(path.join(root,n),"utf8"):null);
 if(original[0]===null||original[1]===null)throw Error("Missing required workspace file");
 const mem=original[2]||"";
 const outputs=[agents(original[0]),JSON.stringify(kb(JSON.parse(original[1])),null,2)+"\n",mem.includes(tag)?mem:rule+mem];
 const changes=files.map((name,i)=>({name,old:original[i],next:outputs[i]})).filter(x=>x.old!==x.next);
 if(!changes.length){console.log("ALREADY UPDATED");return;}
 const stamp=new Date().toISOString().replace(/[:.]/g,"-"),backup=path.join(root,"backups","website-support-"+stamp);
 fs.mkdirSync(backup,{recursive:true,mode:0o700});
 for(const x of changes)if(x.old!==null)fs.writeFileSync(path.join(backup,x.name),x.old,{flag:"wx",mode:0o600});
 fs.writeFileSync(path.join(backup,"manifest.json"),JSON.stringify(changes.map(x=>({file:x.name,previouslyMissing:x.old===null})),null,2),{flag:"wx",mode:0o600});
 const prepared=[];
 try{
  for(const x of changes){const dest=path.join(root,x.name),tmp=dest+".website-support-"+stamp;fs.writeFileSync(tmp,x.next,{flag:"wx",mode:0o600});prepared.push({tmp,dest});}
  for(const x of prepared)fs.renameSync(x.tmp,x.dest);
  for(const x of changes)console.log("UPDATED:",x.name);
  console.log("VERIFIED: current support article has no outage notice or website-ticket route");
  console.log("BACKUP:",backup);
 }catch(e){for(const x of changes){const f=path.join(root,x.name);if(x.old!==null)fs.copyFileSync(path.join(backup,x.name),f);else if(fs.existsSync(f))fs.unlinkSync(f);}throw e;}
 finally{for(const x of prepared)if(fs.existsSync(x.tmp))fs.unlinkSync(x.tmp);}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))install(process.env.OPENCLAW_WORKSPACE_DIR||"/data/workspace");

