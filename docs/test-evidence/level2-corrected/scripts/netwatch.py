# Samples every stack and CLI process once a second. Records any non-loopback TCP peer with PID and service.
import re,subprocess,sys,time
out=open(sys.argv[1],'a',buffering=1)
def svc(pid):
    c=subprocess.run(['ps','-o','command=','-p',pid],capture_output=True,text=True).stdout
    m=re.search(r'slim-services/([^/]+)/',c)
    return m.group(1) if m else ('cli-host' if 'cli-darwin-arm64' in c else 'other')
while True:
    p=subprocess.run(['pgrep','-f','supabase-home|cli-darwin-arm64/bin/supabase'],capture_output=True,text=True).stdout.split()
    if p:
        l=subprocess.run(['lsof','-nP','-a','-p',','.join(p),'-iTCP'],capture_output=True,text=True).stdout.splitlines()[1:]
        for x in l:
            f=x.split()
            if '->' not in x: continue
            peer=f[8].split('->')[1]
            if peer.startswith('127.') or peer.startswith('[::1]'): continue
            out.write(f"{time.strftime('%H:%M:%S')} pid={f[1]} service={svc(f[1])} cmd={f[0]} {f[8]} {f[-1]}\n")
    time.sleep(1)
