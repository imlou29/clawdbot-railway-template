import fs from "node:fs";
import path from "node:path";
const rules="Apply these response rules in groups and DMs, overriding older conversational examples and style guidance. Answer only the current request in a neutral, concise tone. No theatrical openings, jokes, banter, personal commentary, celebration, search narration, unsolicited history, company-name variants, or closing remarks. Do not imitate previous group replies. COA answers use these formats: (1) Link found: product + GB, exact relevant laboratory link(s), and one original Telegram reference when available; then STOP. Do not add passed/failed labels, assay results, other products, pending-testing history, caveats or advice unless the user explicitly asks for those findings or context. (2) No match: one sentence only, such as \"I couldn’t locate a matching COA for Cartalax 20mg from the Lobster GB.\" Do not append explanations about absence, internal records, admins dropping links, or testing history. Say only that you could not locate it; never conclude it does not exist or was not tested. (3) A user disputes the product or strength shown by a link: acknowledge the possible mismatch in one short sentence and check the actual report when accessible. Do not defend the mapping solely because an old Telegram post or admin label says so, do not repeat it as confirmed, and do not add unrelated reports. If the report cannot be checked, say only that the match needs confirmation. Never invent measured results or claim a check you did not perform. Never mention registration, indexing, tools, scripts, rendering, catalogue internals or page-access failures in an ordinary COA-link answer. Keep distinct relevant tests/batches separate without calling regions or presentations manufacturing batches. The former public COA website is retired: never search it, recommend it, discuss its publication status or append a confirmation reminder. Require an explicitly identified GB before COA lookup. These rules supersede old session examples, memories and summaries.";
function patchCoaStyle(s){
 const re=/(NEUTRAL DIRECT ANSWERS - PRIORITY\r?\n)[^\n]+/;
 if((s.match(/NEUTRAL DIRECT ANSWERS - PRIORITY/g)||[]).length!==1||!re.test(s))throw Error("Expected neutral reply section exactly once; nothing changed");
 return s.replace(re,(_,head)=>head+rules);
}
const root=process.env.OPENCLAW_WORKSPACE_DIR||"/data/workspace",file=path.join(root,"AGENTS.md");
const old=fs.readFileSync(file,"utf8"),next=patchCoaStyle(old);
if(next===old){console.log("ALREADY UPDATED");process.exit(0);}
const stamp=new Date().toISOString().replace(/[:.]/g,"-"),backup=path.join(root,"backups","brief-coa-replies-"+stamp);
fs.mkdirSync(backup,{recursive:true,mode:0o700});fs.writeFileSync(path.join(backup,"AGENTS.md"),old,{flag:"wx",mode:0o600});
const tmp=file+".coa-style-"+stamp;
try{fs.writeFileSync(tmp,next,{flag:"wx",mode:0o600});fs.renameSync(tmp,file);console.log("UPDATED: concise COA reply and disputed-link handling");console.log("BACKUP:",backup);}
catch(e){fs.copyFileSync(path.join(backup,"AGENTS.md"),file);throw e;}
finally{if(fs.existsSync(tmp))fs.unlinkSync(tmp);}
