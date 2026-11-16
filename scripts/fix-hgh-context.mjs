import fs from "node:fs";
import path from "node:path";
const marker="HGH LABORATORY ATTRIBUTION - 2026-11-16";
const clarification="HGH LABORATORY ATTRIBUTION - 2026-11-16\nLobster HGH/SuperH principal Janoshik reports are available as links in the Telegram catalogue: EU/UK 11iu report 245776; EU/UK 24iu report 245809; US 11iu report 246794; US 24iu report 246773. These are four report/presentation/region entries, not evidence of four distinct manufacturing batches. Do not claim measured purity, quantity, assay scope or completion of every promised test from link availability alone.\nFor HGH, do not transfer BTLabs full/custom COA work from SS-31, 5-Amino, GHK, RT10 or TR30. HGH reports here are from Janoshik. The November 4 pending-US-HGH statement is historical and superseded by the available US report links. Do not append a current pending/full-package warning unless a newer source explicitly identifies pending work for this same product, GB, region and test.\n";
const oldPending="Pending work includes BTLabs full COAs/custom-COA work, additional Jano mass/purity and full-batch H11/H24 testing, Vanguard full H.C.G. testing, and small-l@b exploratory R3ta/t1rz testing.";
const newPending="Historical November 4 pending work for non-HGH products included BTLabs full COAs/custom-COA work, additional Jano mass/purity, Vanguard full H.C.G. testing, and small-l@b exploratory R3ta/t1rz testing. This historical snapshot does not establish current HGH pending work; use the product-specific HGH clarification above.";
const oldUS="- Jano COAs for U.S. H11 and H24 batches.";
const newUS="- Historical November 4 item, superseded: U.S. H11/H24 Jano reports were pending then. The US principal report links 246794 (11iu) and 246773 (24iu) are now available in the Telegram catalogue.";
function transformArticle(s){s=s.split(oldPending).join(newPending).split(oldUS).join(newUS);return s.includes(marker)?s:clarification+"\n"+s;}
function transformAgents(s){
 if(s.includes(marker))return s;
 const anchor="Telegram COA Lookup Override";if(s.split(anchor).length!==2)throw Error("Expected COA instruction section exactly once; nothing changed");
 return s.replace(anchor,anchor+"\n\n"+marker+"\nKeep laboratory assignments and pending work specific to product, GB, region and test. For Lobster HGH/SuperH, do not transfer BTLabs work for other products into HGH answers. Report count, strength and region do not establish manufacturing batch count. Link availability does not prove measured results or completion of every promised assay. Do not add historical pending-testing caveats to a simple COA-link answer; only discuss current pending work when directly relevant and explicitly supported for the requested product.");
}
function transformKb(value){
 const d=JSON.parse(JSON.stringify(value));let main=0;
 function walk(o){if(!o||typeof o!=="object")return;if(typeof o.content==="string"&&["Lobster GB - Testing and COAs","COA Retest & Investigation Reference - November 2026"].includes(o.title)){o.content=transformArticle(o.content);if(o.title==="Lobster GB - Testing and COAs")main++;}for(const v of Object.values(o))if(v&&typeof v==="object")walk(v);}
 walk(d);if(main!==1)throw Error("Expected one Lobster testing article; nothing changed");if(JSON.stringify(d)!==JSON.stringify(value)&&Number.isFinite(d.version))d.version++;return d;
}
const root=process.env.OPENCLAW_WORKSPACE_DIR||"/data/workspace";
const names=["AGENTS.md","knowledge_base.json"];
const originals=names.map(n=>fs.readFileSync(path.join(root,n),"utf8"));
const outputs=[transformAgents(originals[0]),JSON.stringify(transformKb(JSON.parse(originals[1])),null,2)+"\n"];
const changes=names.map((n,i)=>({name:n,old:originals[i],next:outputs[i]})).filter(x=>x.old!==x.next);
if(!changes.length){console.log("ALREADY CORRECTED");process.exit(0);}
const stamp=new Date().toISOString().replace(/[:.]/g,"-");
const backup=path.join(root,"backups","hgh-context-"+stamp);
fs.mkdirSync(backup,{recursive:true,mode:0o700});
for(const x of changes)fs.writeFileSync(path.join(backup,x.name),x.old,{flag:"wx",mode:0o600});
const temps=[];
try{
 for(const x of changes){const dest=path.join(root,x.name),tmp=dest+".hgh-context-"+stamp;fs.writeFileSync(tmp,x.next,{flag:"wx",mode:0o600});temps.push({dest,tmp});}
 for(const x of temps)fs.renameSync(x.tmp,x.dest);
 for(const x of changes)console.log("UPDATED:",x.name);
 console.log("VERIFIED: HGH attribution and historical pending context corrected");
 console.log("BACKUP:",backup);
}catch(e){for(const x of changes)fs.copyFileSync(path.join(backup,x.name),path.join(root,x.name));throw e;}
finally{for(const x of temps)if(fs.existsSync(x.tmp))fs.unlinkSync(x.tmp);}
