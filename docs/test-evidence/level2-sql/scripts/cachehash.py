# Content hash of the whole CLI cache. .lock files are listed separately because the CLI touches them on every start.
import hashlib,os,sys
root='.supabase-home/cache'; rows=[]; locks=0
for r,d,fs in os.walk(root):
    for f in fs:
        p=os.path.join(r,f)
        if os.path.islink(p): rows.append(f"L {os.readlink(p)} {p}"); continue
        if p.endswith('.lock'): locks+=1; continue
        h=hashlib.sha256()
        with open(p,'rb') as o:
            for b in iter(lambda:o.read(1<<20),b''): h.update(b)
        rows.append(f"{h.hexdigest()} {p}")
rows.sort(); open(sys.argv[1],'w').write('\n'.join(rows)+'\n'); print('files',len(rows),'locks',locks)
