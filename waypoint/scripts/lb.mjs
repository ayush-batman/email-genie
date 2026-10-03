// Tiny round-robin load balancer for local multi-instance testing: node scripts/lb.mjs 3000 3001 3002
import http from "node:http";
const [port, ...targets] = process.argv.slice(2).map(Number);
let i = 0;
http.createServer((req, res) => {
  const target = targets[i++ % targets.length];
  const up = http.request({ host: "127.0.0.1", port: target, path: req.url, method: req.method, headers: { ...req.headers, "x-served-by": String(target) } }, (r) => {
    res.writeHead(r.statusCode ?? 502, { ...r.headers, "x-upstream": String(target) });
    r.pipe(res);
  });
  up.on("error", () => { res.writeHead(502); res.end("upstream down"); });
  req.pipe(up);
}).listen(port, () => console.log(`lb :${port} → ${targets.join(", ")}`));
