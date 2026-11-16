import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const helper = fs.readFileSync(new URL('../skills/tegridy-coa-lookup/scripts/coa-lookup.mjs', import.meta.url),'utf8');
function run(args, prefix, env={}) {
 const p=spawnSync(process.execPath,['--input-type=module','-e',prefix+'\n'+helper,'--','coa-lookup.mjs',...args],{encoding:'utf8',env:{...process.env,COA_CATALOG_URL:'https://catalog.example',COA_API_TOKEN:'test-token',...env}});
 return {code:p.status,data:JSON.parse(p.stdout),err:p.stderr};
}
test('missing GB stops before network access',()=>{
 const r=run(['--query','RT30'],'globalThis.fetch=()=>{throw Error("unexpected fetch")};');
 assert.equal(r.code,0); assert.equal(r.data.status,'needs_gb');
});
test('product and GB query authenticated catalogue and return evidence',()=>{
 const r=run(['--query','RT30','--gb','YuanTai'],`globalThis.fetch=async (url,options)=>{
 if(url.origin!=='https://catalog.example'||url.pathname!=='/v1/coas/search'||url.searchParams.get('q')!=='RT30'||url.searchParams.get('gb')!=='YuanTai'||options.headers.Authorization!=='Bearer test-token'||options.redirect!=='error') throw Error('bad request');
 return {ok:true,text:async()=>JSON.stringify({status:'candidates',results:[{report_link:'https://chromate.org/verify?c=example'}]})};
};`);
 assert.equal(r.code,0); assert.equal(r.data.status,'candidates'); assert.equal(r.data.results.length,1);
});
test('unavailable catalogue does not fall back to website or expose credentials',()=>{
 const r=run(['--query','RT30','--gb','YuanTai'],'globalThis.fetch=async()=>{throw Error("test-token")};');
 assert.equal(r.code,1); assert.deepEqual(r.data,{status:'catalog_unavailable',results:[]}); assert.equal(r.err,'');
});
test('packaged instructions use Telegram with required GB and no website recommendation',()=>{
 const agents=fs.readFileSync(new URL('../AGENTS.md',import.meta.url),'utf8');
 const skill=fs.readFileSync(new URL('../skills/tegridy-coa-lookup/SKILL.md',import.meta.url),'utf8');
 assert.match(agents,/Telegram COA Lookup Override/);
 assert.doesNotMatch(agents,/Live COA Lookup Override|plus the required live-page confirmation reminder/);
 assert.match(skill,/current user message must explicitly identify the GB/);
 assert.match(skill,/Do not recommend peptegridy.com/);
 assert.doesNotMatch(helper,/www.peptegridy.com|liveDataAgeSeconds/);
});
