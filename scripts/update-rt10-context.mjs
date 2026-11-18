import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import assert from "node:assert/strict";
const marker = "CURRENT LOBSTER RT10/TR30 REPORT CONTEXT - 2026-11-17";
const note = "CURRENT LOBSTER RT10/TR30 REPORT CONTEXT - 2026-11-17\nA publisher-supplied BTLabs report page for Lobster Retatrutide 10mg (RT10), report COA262261-001, dated 11 November 2026, is associated with https://t.me/c/4350769620/210/96585. A BTLabs Tirzepatide 30mg (TR30) report page, COA262261-002, of the same date is associated with https://t.me/c/4350769620/210/96589. Do not say no BTLabs report has been posted or that these published reports are still pending. Availability of other pages, additional certificates, custom certificates or other assays must be checked separately in the current catalogue; these two supplied page-1 images do not establish four complete RT10 reports.\nEach supplied image is page 1 of 2. RT10 shows HPLC purity 99.8% and HPLC potency 11.3mg (113.1%); TR30 shows HPLC purity 99.6% and HPLC potency 34.4mg (114.7%). Their printed potency specification is 90-110% of the nominal quantity. Both displayed potency values exceed the printed upper bound. Do not label either report an overall pass, claim purity failed, or invent the missing page's conclusion. Reported mass 59.3mg/76.3mg includes excipients and is not active-peptide quantity. The visible testing purpose excludes particulate matter, microbial contamination and endotoxins; do not infer those tests or sterility passed from this page.\nJanoshik report 247522 was labelled RT10 in an older Telegram caption, but a member disputed its strength. Its RT10 identity has not been independently confirmed here. Do not count it as a confirmed RT10 pass, assert the alleged swap as fact, or resolve the dispute using that caption alone. RT30 report 247521 is separate.\nFor ordinary link requests, respond only with relevant report links and Telegram references. Discuss numerical findings or testing history only when asked. Never conclude the whole batch is good/bad or tally passes versus failures as proof. Retrieve current catalogue evidence for every request; these notes do not establish a complete inventory.\n\nHISTORICAL TESTING NOTES BELOW\nThe older testing status and pending statements below describe their original dated announcements. They must not be repeated as current status without fresh, product-specific evidence.\n";
const gate = "Before answering every COA request, run a fresh Telegram catalogue lookup for the requested product and explicit GB; never answer from an earlier reply or KB testing snapshot alone. Search using the product/strength alias without adding words such as all, available, COA or a laboratory name that could hide other matching reports. Inspect every returned candidate, including admin-supplied images and PDFs. Never claim all/every/complete when results are truncated or coverage is incomplete. A published report and its test scope supersede an older pending statement only for that same report/test; do not infer that all promised testing is complete. ";
export function transformAgents(s) {
  if (s.includes(gate)) return s;
  const anchor = "COA answers use these formats:";
  if (s.split(anchor).length !== 2) throw Error("Expected one neutral COA instruction paragraph; nothing changed");
  return s.replace(anchor, gate + anchor);
}
export function transformKb(value) {
  const d = JSON.parse(JSON.stringify(value)); let found = 0, changed = false;
  function walk(o) {
    if (!o || typeof o !== "object") return;
    if (typeof o.content === "string" && ["Lobster GB - Testing and COAs", "COA Retest & Investigation Reference - November 2026"].includes(o.title)) {
      if (o.title === "Lobster GB - Testing and COAs") found++;
      if (!o.content.includes(marker)) { o.content = note + "\n" + o.content; changed = true; }
    }
    for (const v of Object.values(o)) if (v && typeof v === "object") walk(v);
  }
  walk(d);
  if (found !== 1) throw Error("Expected one Lobster testing article; nothing changed");
  if (changed && Number.isFinite(d.version)) d.version++;
  return d;
}
export function applyWorkspace(root) {
  const originals = new Map();
  for (const name of ["AGENTS.md", "knowledge_base.json"]) originals.set(name, fs.readFileSync(path.join(root,name),"utf8"));
  const next = new Map([
    ["AGENTS.md", transformAgents(originals.get("AGENTS.md"))],
    ["knowledge_base.json", JSON.stringify(transformKb(JSON.parse(originals.get("knowledge_base.json"))),null,2)+"\n"]
  ]);
  const memory = path.join(root,"MEMORY.md");
  if (fs.existsSync(memory)) {
    const old = fs.readFileSync(memory,"utf8"); originals.set("MEMORY.md",old);
    next.set("MEMORY.md",old.includes(marker)?old:note+"\n"+old);
  }
  const changes = [...next].filter(([name,value])=>value!==originals.get(name));
  if (!changes.length) { console.log("ALREADY CORRECTED"); return; }
  const stamp = new Date().toISOString().replace(/[:.]/g,"-");
  const backup = path.join(root,"backups","rt10-report-context-"+stamp);
  fs.mkdirSync(backup,{recursive:true,mode:0o700});
  for (const [name] of changes) fs.writeFileSync(path.join(backup,name),originals.get(name),{flag:"wx",mode:0o600});
  const temps=[];
  try {
    for (const [name,value] of changes) {
      const dest=path.join(root,name),tmp=dest+".rt10-"+stamp;
      fs.writeFileSync(tmp,value,{flag:"wx",mode:0o600}); temps.push({dest,tmp});
    }
    for (const entry of temps) fs.renameSync(entry.tmp,entry.dest);
    for (const [name] of changes) console.log("UPDATED:",name);
    console.log("VERIFIED: fresh COA lookup required; published BTLabs pages separated from historical pending work and overall pass claims");
    console.log("BACKUP:",backup);
  } catch(e) {
    for (const [name] of changes) fs.copyFileSync(path.join(backup,name),path.join(root,name));
    throw e;
  } finally { for (const entry of temps) if(fs.existsSync(entry.tmp)) fs.unlinkSync(entry.tmp); }
}
function selfTest() {
  const oldAgents="Existing support instructions\nCOA answers use these formats: unchanged formats\nOther content";
  const value={version:123,articles:[{title:"Lobster GB - Testing and COAs",content:"Old pending context"},{title:"COA Retest & Investigation Reference - November 2026",content:"Separate investigation"},{title:"Other",content:"Keep support and rules"}]};
  const updated=transformKb(value);
  assert.equal(updated.version,124);
  assert.deepEqual(transformKb(updated),updated);
  assert.equal(value.articles[0].content,"Old pending context");
  assert.deepEqual(updated.articles[2],value.articles[2]);
  assert.equal(updated.articles[0].content,note+"\nOld pending context");
  assert.equal(transformAgents(transformAgents(oldAgents)),transformAgents(oldAgents));
  assert.ok(transformAgents(oldAgents).endsWith("Other content"));
  assert.throws(()=>transformKb({articles:[]}));
  assert.throws(()=>transformAgents("Missing neutral section"));
  const root=fs.mkdtempSync(path.join(os.tmpdir(),"tegridy-rt10-test-"));
  try {
    fs.writeFileSync(path.join(root,"AGENTS.md"),oldAgents);
    fs.writeFileSync(path.join(root,"knowledge_base.json"),JSON.stringify(value));
    fs.writeFileSync(path.join(root,"MEMORY.md"),"Existing memories");
    applyWorkspace(root);
    const backups=fs.readdirSync(path.join(root,"backups"));
    assert.equal(backups.length,1);
    assert.equal(fs.readFileSync(path.join(root,"backups",backups[0],"AGENTS.md"),"utf8"),oldAgents);
    assert.equal(JSON.parse(fs.readFileSync(path.join(root,"knowledge_base.json"),"utf8")).version,124);
    assert.ok(fs.readFileSync(path.join(root,"MEMORY.md"),"utf8").endsWith("Existing memories"));
    applyWorkspace(root);
    assert.equal(fs.readdirSync(path.join(root,"backups")).length,1);
  } finally { fs.rmSync(root,{recursive:true,force:true}); }
  console.log("SELF TEST PASSED");
}
if(process.argv.includes("--self-test")) selfTest();
else applyWorkspace(process.env.OPENCLAW_WORKSPACE_DIR||"/data/workspace");
