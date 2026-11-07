import json,subprocess,sys,os
L2=os.environ["L2"]
o=subprocess.run(["npm","run","-s","supabase","--","--workdir",L2+"/project","status","--output-format","json"],capture_output=True,text=True,cwd="<repo>/store")
s=json.loads(o.stdout)
print("exit",o.returncode,"lifecycle",s["lifecycle"],"readiness",s["readiness"],"drift",s["config_drift"]["status"],"id",s["identity"]["id"][:8])
for m in s["services"]:
    print(" ",m["service"],m.get("state"),m.get("health"),m.get("version") or m.get("image") or "")
