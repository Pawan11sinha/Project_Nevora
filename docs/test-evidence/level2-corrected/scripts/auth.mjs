import { env,rec,results,sleep,guard,L2 } from './lib.mjs';
import { createHmac } from 'node:crypto'; import { writeFileSync } from 'node:fs';
const e=env(); const A=e.API_URL,P=e.PUBLISHABLE_KEY||e.ANON_KEY,M=e.MAILPIT_URL;
const run=process.env.RUN||'1'; const em=`level2-customer-${run}@example.test`;
const pw='Level2-Customer-'+run+'-Aa1!', pw2='Level2-Changed-'+run+'-Bb2!';
const j={apikey:P,'content-type':'application/json'};
const f=(p,o={})=>fetch(guard(A+p),o);
const post=(p,b,h=j)=>f(p,{method:'POST',headers:h,body:JSON.stringify(b)});
const login=(e2,p2)=>post('/auth/v1/token?grant_type=password',{email:e2,password:p2});
const claim=t=>JSON.parse(Buffer.from(t.split('.')[1],'base64url').toString());
async function mail(to,match){
 for(let i=0;i<20;i++){
  const r=await fetch(guard(`${M}/api/v1/search?query=${encodeURIComponent('to:"'+to+'"')}`)); const l=await r.json();
  for(const m of l.messages||[]){const d=await (await fetch(guard(`${M}/api/v1/message/${m.ID}`))).json(); const t=(d.Text||'')+(d.HTML||''); if(match(t,d)) return t;}
  await sleep(500);
 } return null;
}
const linkFrom=t=>{const m=t.match(/https?:\/\/[^\s"'<>]*\/auth\/v1\/verify[^\s"'<>]*/); return m?m[0].replace(/&amp;/g,'&'):null;};
let r=await post('/auth/v1/signup',{email:em,password:pw}); let b=await r.json();
rec('AU1','signup creates unconfirmed user with no session',r.status===200&&!b.access_token&&!b.session&&!b.confirmed_at&&!b.email_confirmed_at,`status=${r.status} has_session=${!!(b.access_token||b.session)}`);
r=await login(em,pw); b=await r.json();
rec('AU2','login before confirming is rejected',r.status>=400&&!b.access_token,`status=${r.status} code=${b.error_code||b.code||''}`);
const ct=await mail(em,t=>/verify/.test(t)); const link=ct&&linkFrom(ct);
let cst=0; if(link){const c=await fetch(guard(link),{redirect:'manual'}); cst=c.status;}
r=await login(em,pw); b=await r.json(); let rt=b.refresh_token,at=b.access_token;
rec('AU3','mail captured in Mailpit, link confirms, login gives aal1',!!link&&cst>=200&&cst<400&&r.status===200&&claim(at).aal==='aal1',`mail=${!!link} confirm=${cst} login=${r.status} aal=${at?claim(at).aal:''}`);
r=await login(em,pw+'x'); await r.text();
rec('AU4','wrong password rejected',r.status>=400,`status=${r.status}`);
const ref=t=>post('/auth/v1/token?grant_type=refresh_token',{refresh_token:t});
r=await ref(rt); b=await r.json(); const newRt=b.refresh_token, s1=r.status;
await sleep(11000);
r=await ref(rt); const oldb=await r.json(), s2=r.status;
rec('AU5','parent of unused active token: reuse after 11 s returns the current token (documented exception)',s1===200&&!!newRt&&newRt!==rt&&s2===200&&oldb.refresh_token===newRt,`new=${s1} parent_reuse=${s2} returned_current=${oldb.refresh_token===newRt}`);
// reuse detection can revoke the family, so sign in afresh
// Corrected reuse tests. Separate sessions, because the immediate check can itself rotate the token.
const chain=async()=>{let q=await login(em,pw);let d=await q.json();const access=d.access_token,t0=d.refresh_token;q=await ref(t0);d=await q.json();const t1=d.refresh_token;q=await ref(t1);d=await q.json();const t2=d.refresh_token;await sleep(11000);q=await ref(t0);d=await q.json();return{t2,access,status:q.status,code:d.error_code||d.code||'',leaked:!!d.access_token};};
{ const c=await chain();
  rec('AU5b','older token, once its child has rotated, rejected after 11 s',c.status===400&&c.code==='refresh_token_already_used'&&!c.leaked,`status=${c.status} code=${c.code}`);
  const q=await ref(c.t2); const d=await q.json();
  console.log(`INFO AU5c-immediate newest token straight after detection: status=${q.status} new_session_token=${!!d.access_token}`);
}
{ const c=await chain();
  await sleep(11000);
  const q=await ref(c.t2); const d=await q.json();
  rec('AU5c','newest token rejected 11 s after detection (documented session termination)',c.status===400&&q.status>=400&&!d.access_token,`detect=${c.status} newest_after_11s=${q.status} code=${d.error_code||d.code||''}`);
  const u=await f('/auth/v1/user',{headers:{apikey:P,authorization:`Bearer ${c.access}`}}); await u.text();
  console.log(`INFO AU5d access token issued before detection, getUser after detection: status=${u.status}`);
}
r=await login(em,pw); b=await r.json(); at=b.access_token; rt=b.refresh_token; const lg=r.status;
const uh=t=>({apikey:P,authorization:`Bearer ${t}`});
r=await f('/auth/v1/logout',{method:'POST',headers:uh(at)}); const lo=r.status;
r=await ref(rt); const rb=await r.json(), s3=r.status;
r=await f('/auth/v1/user',{headers:uh(at)}); await r.text(); const atAfter=r.status;
rec('AU6','logout revokes refresh token',lg===200&&lo===204&&s3>=400&&!rb.access_token,`logout=${lo} refresh_after=${s3} access_token_after_logout=${atAfter} (recorded)`);
r=await post('/auth/v1/recover',{email:em}); const rc=r.status;
const rmail=await mail(em,t=>/type=recovery/.test(t)); const rl=rmail&&linkFrom(rmail); let rtok=null,rec1=0;
if(rl){const c=await fetch(guard(rl),{redirect:'manual'}); rec1=c.status; const loc=c.headers.get('location')||''; const h=new URLSearchParams(loc.split('#')[1]||''); rtok=h.get('access_token');}
let up=0; if(rtok){r=await f('/auth/v1/user',{method:'PUT',headers:{...uh(rtok),'content-type':'application/json'},body:JSON.stringify({password:pw2})}); up=r.status; await r.text();}
r=await login(em,pw); await r.text(); const oldp=r.status;
r=await login(em,pw2); b=await r.json(); const newp=r.status; at=b.access_token;
rec('AU7','reset via Mailpit: new password works, old fails',rc===200&&!!rl&&up===200&&oldp>=400&&newp===200,`recover=${rc} mail=${!!rl} link=${rec1} update=${up} old=${oldp} new=${newp}`);
// AU8 TOTP. Secret stays in memory and is never printed.
const b32=s=>{const a='ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';let bits='';for(const c of s.replace(/=+$/,''))bits+=a.indexOf(c).toString(2).padStart(5,'0');const o=[];for(let i=0;i+8<=bits.length;i+=8)o.push(parseInt(bits.slice(i,i+8),2));return Buffer.from(o);};
const totp=(sec,t=Date.now())=>{const c=Buffer.alloc(8);c.writeBigUInt64BE(BigInt(Math.floor(t/30000)));const h=createHmac('sha1',b32(sec)).update(c).digest();const o=h[19]&15;return String((h.readUInt32BE(o)&0x7fffffff)%1000000).padStart(6,'0');};
const ah=()=>({...uh(at),'content-type':'application/json'});
r=await f('/auth/v1/factors',{method:'POST',headers:ah(),body:JSON.stringify({factor_type:'totp',friendly_name:'level2'})}); b=await r.json(); const en=r.status,fid=b.id,sec=b.totp?.secret;
r=await f(`/auth/v1/factors/${fid}/challenge`,{method:'POST',headers:ah(),body:'{}'}); let cb=await r.json(); const ch1=r.status;
const code=totp(sec); const wrong=String((Number(code)+1)%1000000).padStart(6,'0');
r=await f(`/auth/v1/factors/${fid}/verify`,{method:'POST',headers:ah(),body:JSON.stringify({challenge_id:cb.id,code:wrong})}); const wb=await r.json(); const wr=r.status;
r=await f(`/auth/v1/factors/${fid}/challenge`,{method:'POST',headers:ah(),body:'{}'}); cb=await r.json();
r=await f(`/auth/v1/factors/${fid}/verify`,{method:'POST',headers:ah(),body:JSON.stringify({challenge_id:cb.id,code:totp(sec)})}); const vb=await r.json(); const vr=r.status;
const aal=vb.access_token?claim(vb.access_token).aal:'';
rec('AU8','TOTP: wrong code rejected, right code gives aal2',en===200&&ch1===200&&wr>=400&&!wb.access_token&&vr===200&&aal==='aal2',`enrol=${en} challenge=${ch1} wrong=${wr} right=${vr} aal=${aal}`);
r=await ref(vb.refresh_token); const rb2=await r.json(); const raal=rb2.access_token?claim(rb2.access_token).aal:'';
rec('AU10','aal2 survives a token refresh',r.status===200&&raal==='aal2',`refresh=${r.status} aal=${raal}`);
r=await post('/auth/v1/signup',{}); const an=await r.json();
rec('AU9','anonymous sign-in rejected',r.status>=400&&!an.access_token,`status=${r.status} code=${an.error_code||an.code||''}`);
writeFileSync(`${L2}/evidence/auth-run${run}.json`,JSON.stringify(results,null,1));
process.exit(results.every(x=>x.pass)?0:1);
