import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {cleanAgents,cleanLore,cleanKb,install} from "../scripts/remove-retired-admin.mjs";
const root=new URL("../",import.meta.url);
test("removes the named admin without removing other support contacts or current tone rules",()=>{
 const s="NEUTRAL DIRECT ANSWERS - PRIORITY\n"+fs.readFileSync(new URL("AGENTS.md",root),"utf8");
 const result=cleanAgents(s);
 assert.doesNotMatch(result,/@?twoe(?:17)?\b|\be17\b/i);
 assert.ok(result.startsWith("NEUTRAL DIRECT ANSWERS - PRIORITY"));
 for(const v of ["@TegridySupportBot","@ImLou29","@TofferTimez","Telegram COA Lookup Override"])assert.ok(result.includes(v));
 assert.equal(cleanAgents(result),result);
});
test("removes complete personality section, team mentions, and the single-letter alias example",()=>{
 const s=fs.readFileSync(new URL("LORE.md",root),"utf8"),result=cleanLore(s);
 assert.doesNotMatch(result,/@?twoe(?:17)?\b|\be17\b|Web issue\? E may know/i);
 assert.match(result,/## Lou/);assert.match(result,/## Toffer/);
 assert.equal(cleanLore(result),result);
});
test("KB edit preserves facts and removes only the retired contact and keyword",()=>{
 const s={version:42,articles:[{keywords:["twoe17","toffer","E17"],content:"Contact @ImLou29 or @twoe17. COA 99.5%, https://lab.example/report; @TegridySupportBot is currently OUT OF SERVICE."}]};
 const r=cleanKb(s);assert.deepEqual(r.articles[0].keywords,["toffer"]);
 assert.equal(r.articles[0].content,"Contact @ImLou29. COA 99.5%, https://lab.example/report; @TegridySupportBot is currently OUT OF SERVICE.");
 assert.equal(s.articles[0].keywords.length,3);
});
test("installer backs up originals and is idempotent",()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),"retired-admin-test-"));
 try{
  for(const name of ["AGENTS.md","LORE.md","knowledge_base.json"])fs.copyFileSync(new URL(name,root),path.join(dir,name));
  const original=fs.readFileSync(path.join(dir,"AGENTS.md"),"utf8");
  install(dir);
  const dirs=fs.readdirSync(path.join(dir,"backups"));assert.equal(dirs.length,1);
  assert.equal(fs.readFileSync(path.join(dir,"backups",dirs[0],"AGENTS.md"),"utf8"),original);
  const after=fs.readFileSync(path.join(dir,"AGENTS.md"),"utf8");install(dir);
  assert.equal(fs.readdirSync(path.join(dir,"backups")).length,1);
  assert.equal(fs.readFileSync(path.join(dir,"AGENTS.md"),"utf8"),after);
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
});
