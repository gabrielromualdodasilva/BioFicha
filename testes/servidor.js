// Servidor estático mínimo para testar o modo nuvem em http://localhost.
// uso: node servidor.js <porta> <pasta do site> [arquivo que substitui /js/firebase-config.js]
const http = require('http'), fs = require('fs'), path = require('path');
const [, , porta, raiz, configTeste] = process.argv;
const TIPOS = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.jpg': 'image/jpeg', '.png': 'image/png', '.json': 'application/json' };
http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/') p = '/index.html';
  let arq = path.join(raiz, p);
  if (!arq.startsWith(path.resolve(raiz))) { res.writeHead(403); return res.end(); }
  if (configTeste && p === '/js/firebase-config.js') arq = configTeste;
  fs.readFile(arq, (e, dados) => {
    if (e) { res.writeHead(404); return res.end('nao achei'); }
    res.writeHead(200, { 'Content-Type': TIPOS[path.extname(arq)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(dados);
  });
}).listen(parseInt(porta, 10), '127.0.0.1', () => console.log('servindo em http://localhost:' + porta));
