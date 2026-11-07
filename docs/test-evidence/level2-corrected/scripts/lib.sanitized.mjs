// Local-only helpers. Results print status codes and booleans, never tokens or keys.
import { execFileSync } from 'node:child_process';
const ST='<repo>/store';
export const L2=process.env.L2;
export function env(){
  const o=execFileSync('npm',['run','-s','supabase','--','--workdir',L2+'/project','status','--output-format','json'],{cwd:ST,encoding:'utf8',stdio:['ignore','pipe','ignore']});
  const s=JSON.parse(o); const e=s.env||s;
  const u=new URL(e.API_URL); if(u.hostname!=='127.0.0.1') throw new Error('non-local API_URL refused');
  return e;
}
export const results=[];
export function rec(id,desc,pass,detail=''){results.push({id,desc,pass,detail});console.log(`${pass?'PASS':'FAIL'} ${id} ${desc}${detail?' | '+detail:''}`);}
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export function guard(url){const u=new URL(url); if(u.hostname!=='127.0.0.1') throw new Error('non-local URL refused'); return url;}
