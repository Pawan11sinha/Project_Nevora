import { env,rec,results,sleep,guard,L2 } from './lib.mjs';
import { createHash } from 'node:crypto'; import { writeFileSync,readFileSync } from 'node:fs';
const e=env(); const A=e.API_URL, S=e.SECRET_KEY||e.SERVICE_ROLE_KEY, P=e.PUBLISHABLE_KEY||e.ANON_KEY;
const svc={apikey:S,authorization:`Bearer ${S}`};
const sha=b=>createHash('sha256').update(b).digest('hex');
const f=(p,o={})=>fetch(guard(A+p),o);
const run=process.env.RUN||'1'; const b=`level2-private-${run}`;
// Generated 1x1 PNG, synthetic only.
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==','base64');
let r=await f('/storage/v1/bucket',{method:'POST',headers:{...svc,'content-type':'application/json'},body:JSON.stringify({id:b,name:b,public:false,file_size_limit:1048576,allowed_mime_types:['image/png']})});
rec('ST1','create private bucket, 1 MB limit, PNG only',r.status===200,`create=${r.status}`);
r=await f(`/storage/v1/bucket/${b}`,{headers:svc}); const bj=await r.json();
rec('ST1b','bucket settings stored',r.status===200&&bj.public===false&&bj.file_size_limit===1048576&&JSON.stringify(bj.allowed_mime_types)==='["image/png"]',`public=${bj.public} limit=${bj.file_size_limit}`);
r=await f(`/storage/v1/object/${b}/a.png`,{method:'POST',headers:{...svc,'content-type':'image/png'},body:png}); const up=r.status;
r=await f(`/storage/v1/object/${b}/a.png`,{headers:svc}); const dl=Buffer.from(await r.arrayBuffer());
rec('ST2','upload then authorised download, same SHA-256',up===200&&r.status===200&&sha(dl)===sha(png),`upload=${up} download=${r.status} same=${sha(dl)===sha(png)}`);
const leak=b2=>b2.length>0&&sha(b2)===sha(png);
r=await f(`/storage/v1/object/${b}/a.png`); let x=Buffer.from(await r.arrayBuffer());
const s1=r.status,l1=leak(x);
r=await f(`/storage/v1/object/${b}/a.png`,{headers:{apikey:P,authorization:`Bearer ${P}`}}); x=Buffer.from(await r.arrayBuffer());
const s2=r.status,l2=leak(x);
r=await f(`/storage/v1/object/public/${b}/a.png`); x=Buffer.from(await r.arrayBuffer());
const s3=r.status,l3=leak(x);
rec('ST3a','no key, publishable key and public URL all denied',r&&!l1&&!l2&&!l3&&s1>=400&&s2>=400&&s3>=400,`nokey=${s1} publishable=${s2} public=${s3} bytes_leaked=${l1||l2||l3}`);
// ST3b: real signed-in user with no storage policy
const em=`level2-storage-${run}@example.test`;
const ADM={...svc,'content-type':'application/json'};
r=await f('/auth/v1/admin/users',{method:'POST',headers:ADM,body:JSON.stringify({email:em,password:'Level2-Probe-'+run+'-Aa1!',email_confirm:true})}); const cu=r.status; const uid=(await r.json()).id;
r=await f('/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:P,'content-type':'application/json'},body:JSON.stringify({email:em,password:'Level2-Probe-'+run+'-Aa1!'})}); const tok=(await r.json()).access_token;
const uh={apikey:P,authorization:`Bearer ${tok}`};
r=await f(`/storage/v1/object/${b}/a.png`,{headers:uh}); x=Buffer.from(await r.arrayBuffer()); const g=r.status,lg=leak(x);
r=await f(`/storage/v1/object/${b}/u.png`,{method:'POST',headers:{...uh,'content-type':'image/png'},body:png}); const wr=r.status;
rec('ST3b','signed-in user with no policy cannot read or write',cu===200&&!!tok&&g>=400&&!lg&&wr>=400,`create_user=${cu} read=${g} write=${wr} bytes_leaked=${lg}`);
await f(`/auth/v1/admin/users/${uid}`,{method:'DELETE',headers:svc});
// ST4 signed URL
r=await f(`/storage/v1/object/sign/${b}/a.png`,{method:'POST',headers:{...svc,'content-type':'application/json'},body:JSON.stringify({expiresIn:4})}); const sj=await r.json(); const sg=r.status;
const su=sj.signedURL||sj.signedUrl||''; const path=su.startsWith('http')?new URL(su).pathname+new URL(su).search:(su.startsWith('/storage/')?su:'/storage/v1'+su);
r=await f(path); x=Buffer.from(await r.arrayBuffer()); const b4=r.status,ok4=sha(x)===sha(png);
await sleep(7000);
r=await f(path); x=Buffer.from(await r.arrayBuffer()); const a4=r.status,la=leak(x);
rec('ST4','signed URL works, then denied after expiry',sg===200&&b4===200&&ok4&&a4>=400&&!la,`sign=${sg} before=${b4} same=${ok4} after=${a4} bytes_after=${la}`);
// ST5 rejects
r=await f(`/storage/v1/object/${b}/wrong.txt`,{method:'POST',headers:{...svc,'content-type':'text/plain'},body:'not an image'}); const wt=r.status;
const big=Buffer.alloc(2*1024*1024,1);
r=await f(`/storage/v1/object/${b}/big.png`,{method:'POST',headers:{...svc,'content-type':'image/png'},body:big}); const bg=r.status;
r=await f(`/storage/v1/object/list/${b}`,{method:'POST',headers:{...svc,'content-type':'application/json'},body:JSON.stringify({prefix:''})}); const names=(await r.json()).map(o=>o.name).sort();
rec('ST5','wrong type and 2 MB file rejected, nothing stored',wt>=400&&bg>=400&&JSON.stringify(names)==='["a.png"]',`wrong_type=${wt} oversize=${bg} objects=${names.join(',')}`);
// ST6 delete
r=await f(`/storage/v1/object/${b}/a.png`,{method:'DELETE',headers:svc}); const d1=r.status;
r=await f(`/storage/v1/object/${b}/a.png`,{headers:svc}); await r.arrayBuffer(); const gone=r.status;
r=await f(`/storage/v1/bucket/${b}`,{method:'DELETE',headers:svc}); const d2=r.status;
r=await f(`/storage/v1/bucket/${b}`,{headers:svc}); await r.arrayBuffer(); const bgone=r.status;
rec('ST6','object and bucket deleted',d1===200&&gone>=400&&d2===200&&bgone>=400,`delete_object=${d1} read_after=${gone} delete_bucket=${d2} bucket_after=${bgone}`);
// ST7 version evidence, no conclusion in code
r=await f('/storage/v1/version'); const v=await r.text();
console.log(`INFO ST7 /storage/v1/version status=${r.status} body=${v.slice(0,40)}`);
r=await f('/storage/v1/status'); console.log(`INFO ST7 /storage/v1/status status=${r.status}`);
writeFileSync(`${L2}/evidence/storage-run${run}.json`,JSON.stringify(results,null,1));
process.exit(results.every(x=>x.pass)?0:1);
