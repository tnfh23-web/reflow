// Read-only checks against the configured Supabase project. No account creation or media upload.
import fs from 'node:fs/promises';
const lines = (await fs.readFile(new URL('../cloud/.dev.vars', import.meta.url), 'utf8')).split(/\r?\n/);
const config = Object.fromEntries(lines.filter(line => line && !line.startsWith('#')).map(line => {const index=line.indexOf('='); return [line.slice(0,index),line.slice(index+1)];}));
if (!config.SUPABASE_URL?.startsWith('https://') || !config.SUPABASE_PUBLISHABLE_KEY?.startsWith('sb_publishable_')) throw new Error('공개 Supabase 프로젝트 설정이 필요합니다.');
const results=[];
for(const table of ['reflow_samples','reflow_references','reflow_projects','reflow_capture_jobs']) {
  const response=await fetch(`${config.SUPABASE_URL}/rest/v1/${table}?select=id&limit=1`,{
    headers:{apikey:config.SUPABASE_PUBLISHABLE_KEY},signal:AbortSignal.timeout(15000)});
  const data=await response.json().catch(()=>null);
  const ok=table==='reflow_samples'?response.status===200&&Array.isArray(data):[401,403].includes(response.status);
  results.push({table,status:response.status,expected:table==='reflow_samples'?'public samples readable':'anonymous access denied',ok});
}
console.log(JSON.stringify(results,null,2));
if(results.some(result=>!result.ok))process.exitCode=1;
