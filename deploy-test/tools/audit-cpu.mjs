// Local CPU indicator: workerd process CPU per request. NOT a production measurement.
import { execSync } from "node:child_process";
const base = process.argv[2].replace(/\/$/, "");
const N = Number(process.argv[3] ?? 200);
// Every workerd process belonging to this copy, never another workerd on the machine.
const match = process.env.WORKERD_MATCH;
if (!match) throw new Error("Set WORKERD_MATCH to a path unique to this copy");
const pids = () => execSync(`pgrep -f ${JSON.stringify(match + ".*workerd")}`).toString().trim().split("\n").join(",");
const cpu = () => execSync(`ps -o time= -p ${pids()}`).toString().trim().split("\n").reduce((sum, t) => {
  const [m, s] = t.trim().split(":"); return sum + Number(m) * 60 + Number(s);
}, 0);
const rss = () => execSync(`ps -o rss= -p ${pids()}`).toString().trim().split("\n").reduce((a, b) => a + Number(b), 0) / 1024;
console.log("path".padEnd(26), "requests", "cpu ms/request", "wall ms/request");
for (const [p, h] of [["/api/health"], ["/sample/product-400.svg"], ["/"], ["/c/earrings"], ["/p/sample-1"], ["/p/sample-40"], ["/ssr"], ["/login"], ["/account", { cookie: "sb-127-auth-token=forged" }], ["/no-such"]]) {
  const start = cpu(); const t = performance.now();
  for (let i = 0; i < N; i++) { const r = await fetch(base + p, { redirect: "manual", headers: h }); await r.arrayBuffer(); }
  const wall = (performance.now() - t) / N; const used = ((cpu() - start) * 1000) / N;
  console.log(p.padEnd(26), String(N).padStart(8), used.toFixed(2).padStart(14), wall.toFixed(2).padStart(15));
}
console.log(`workerd resident memory after load: ${rss().toFixed(0)} MB`);
