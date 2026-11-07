# Runs one approved SQL statement on the throwaway stack only. Refuses any other target. Never prints the password.
import glob,json,os,subprocess,sys,urllib.parse
S=os.environ['S']; ST='<repo>/store'
o=subprocess.run(['npm','run','-s','supabase','--','--workdir',S+'/project','status','--output-format','json'],capture_output=True,text=True,cwd=ST)
s=json.loads(o.stdout); u=urllib.parse.urlparse(s['env']['DB_URL'])
ep=s['endpoints']['database.sql']
if s['identity']['project_root'].replace('/private','')!=(S+'/project').replace('/private',''): sys.exit('REFUSED project root mismatch')
if u.hostname!='127.0.0.1' or ep['address']!='127.0.0.1' or u.port!=ep['port'] or s['runtime']!='native': sys.exit('REFUSED target mismatch')
db=sys.argv[3] if len(sys.argv)>3 else 'postgres'
if db not in('postgres','level2_restore'): sys.exit('REFUSED database name')
psql=glob.glob(ST+'/.supabase-home/cache/stack/slim-services/postgres/*/darwin-arm64/*/bin/psql')[0]
env=dict(os.environ,PGPASSWORD=urllib.parse.unquote(u.password),PGHOST='127.0.0.1',PGPORT=str(u.port),PGUSER=u.username,PGDATABASE=db,PGCONNECT_TIMEOUT='5',PSQLRC='/dev/null')
sql=sys.argv[2]; a=[psql,'-X','-v','ON_ERROR_STOP=1','-A','-t']
if sql.startswith('@'): a+=['-f',sql[1:]]
else: a+=['-c',sql]
r=subprocess.run(a,capture_output=True,text=True,env=env)
line=f"--- [{sys.argv[1]}] target=127.0.0.1:{u.port}/{db} exit={r.returncode}\n$ {sql}\n{r.stdout}{r.stderr}"
open(f"{S}/evidence/sql-log.txt",'a').write(line); print(line,end=''); sys.exit(r.returncode)
