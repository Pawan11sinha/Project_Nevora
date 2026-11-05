// Finer probe around realistic page weights. First one request at a time, so tail can report
// clean CPU per level. Then sustained load at each level.
// Usage: DEPLOY_TEST_TOKEN=... node cpu-probe-fine.mjs <base-url>
const base = process.argv[2].replace(/\/$/, "");
const headers = { "x-test-token": process.env.DEPLOY_TEST_TOKEN };
const hit = async (n) => {
  try {
    const r = await fetch(`${base}/api/cpu-probe?n=${n}`, { headers });
    const b = await r.text();
    return { status: r.status, limit: /exceeded resource limits|error code: 1102/i.test(b) };
  } catch { return { status: 0, limit: false }; }
};
const levels = [1e6, 2e6, 3e6, 4e6, 6e6, 8e6];
for (const n of levels) {
  let failed = 0;
  for (let i = 0; i < 40; i++) {
    if ((await hit(n)).status !== 200) failed++;
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  console.log(`paced n=${n.toExponential(0)} sent=40 failed=${failed}`);
}
await new Promise((resolve) => setTimeout(resolve, 30000));
for (const n of levels) {
  let next = 0, failed = 0, limit = 0;
  await Promise.all(Array.from({ length: 5 }, async () => {
    while (next++ < 300) { const r = await hit(n); if (r.status !== 200) failed++; if (r.limit) limit++; }
  }));
  console.log(`sustained n=${n.toExponential(0)} sent=300 failed=${failed} limitErrors=${limit}`);
  await new Promise((resolve) => setTimeout(resolve, 20000));
}
