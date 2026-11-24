import http from 'node:http';
import {createReadStream} from 'node:fs';
import {stat} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../dist/', import.meta.url));
const port = Number(process.env.PORT || 5190);
const types = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json','.svg':'image/svg+xml','.png':'image/png','.jpg':'image/jpeg','.woff':'font/woff','.ttf':'font/ttf','.wasm':'application/wasm','.md':'text/plain; charset=utf-8','.txt':'text/plain; charset=utf-8'};
http.createServer(async (req,res) => {
  try {
    if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405).end(); return; }
    const requested = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    const file = path.resolve(root, '.' + requested + (requested.endsWith('/') ? 'index.html' : ''));
    if (!file.startsWith(root)) { res.writeHead(403).end(); return; }
    const info = await stat(file);
    if (!info.isFile()) { res.writeHead(404).end(); return; }
    res.writeHead(200, {'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Content-Length':info.size, 'Cache-Control':'no-cache'});
    if (req.method === 'HEAD') res.end();
    else createReadStream(file).on('error',()=>res.destroy()).pipe(res);
  } catch { res.writeHead(404).end('Not found'); }
}).listen(port,'127.0.0.1',()=>console.log(`Phosphor UI: http://127.0.0.1:${port}/workbench.html`));
