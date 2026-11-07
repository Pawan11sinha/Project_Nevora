// RS1: mode=seed stores a file and user; mode=check verifies both after stop/start.
import { env,rec,results,guard,L2 } from './lib.mjs';
import { createHash } from 'node:crypto'; import { writeFileSync } from 'node:fs';
const mode=process.argv[2], run=process.env.RUN||'1';
const e=env(); const A=e.API_URL,S=e.SECRET_KEY||e.SERVICE_ROLE_KEY,P=e.PUBLISHABLE_KEY||e.ANON_KEY;
const svc={apikey:S,authorization:`Bearer ${S}`}; const f=(p,o={})=>fetch(guard(A+p),o);
const b=`level2-keep-${run}`, em=`level2-keep-${run}@example.test`, pw='Level2-Keep-'+run+'-Aa1!';
const data=Buffer.from('level2 sample persistence data '+run); const sha=x=>createHash('sha256').update(x).digest('hex');
if(mode==='seed'){
 let r=await f('/storage/v1/bucket',{method:'POST',headers:{...svc,'content-type':'application/json'},body:JSON.stringify({id:b,name:b,public:false})}); const c=r.status; await r.text();
 r=await f(`/storage/v1/object/${b}/keep.bin`,{method:'POST',headers:{...svc,'content-type':'application/octet-stream'},body:data}); const u=r.status; await r.text();
 r=await f('/auth/v1/admin/users',{method:'POST',headers:{...svc,'content-type':'application/json'},body:JSON.stringify({email:em,password:pw,email_confirm:true})}); const a=r.status; await r.text();
 rec('RS1a','seed file and user before stop',c===200&&u===200&&a===200,`bucket=${c} upload=${u} user=${a}`);
} else {
 let r=await f(`/storage/v1/object/${b}/keep.bin`,{headers:svc}); const x=Buffer.from(await r.arrayBuffer()); const g=r.status;
 r=await f('/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:P,'content-type':'application/json'},body:JSON.stringify({email:em,password:pw})}); const l=r.status; await r.text();
 rec('RS1','file and user survive stop and start',g===200&&sha(x)===sha(data)&&l===200,`file=${g} same=${sha(x)===sha(data)} login=${l}`);
}
writeFileSync(`${L2}/evidence/persist-${mode}-run${run}.json`,JSON.stringify(results,null,1));
process.exit(results.every(x=>x.pass)?0:1);
