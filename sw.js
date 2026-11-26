/* Modo aplicativo do BioFicha: guarda o site no aparelho para ele abrir sem internet.
   - Páginas, estilos e scripts do site: tenta a internet primeiro (para pegar sempre a versão nova) e,
     sem conexão, usa a cópia guardada.
   - Fotos dos exercícios: usa a cópia guardada e só busca na internet o que ainda não tem.
   - Fontes e o SDK do Firebase (gstatic): usa a cópia e atualiza por trás.
   - Chamadas ao banco e ao login do Firebase não passam por aqui; o próprio Firebase cuida do modo sem internet. */
const VERSAO = 'bioficha-v1';
const BASE = [
  './', 'index.html', 'manifest.webmanifest', 'css/estilo.css',
  'js/exercicios.js', 'js/musculos.js', 'js/calculos.js', 'js/treino.js', 'js/firebase-config.js', 'js/acompanhamento.js', 'js/conta.js', 'js/app.js',
  'img/icone-192.png', 'img/icone-512.png'
];

self.addEventListener('install', ev => {
  ev.waitUntil(caches.open(VERSAO).then(c => c.addAll(BASE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', ev => {
  ev.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSAO).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

const guardar = (pedido, resposta) => {
  if (resposta && (resposta.ok || resposta.type === 'opaque')) { const copia = resposta.clone(); caches.open(VERSAO).then(c => c.put(pedido, copia)); }
  return resposta;
};
const redePrimeiro = pedido => fetch(pedido).then(r => guardar(pedido, r)).catch(() => caches.match(pedido, { ignoreSearch: true }).then(r => r || caches.match('index.html')));
const copiaPrimeiro = pedido => caches.match(pedido).then(r => r || fetch(pedido).then(x => guardar(pedido, x)));
const copiaEAtualiza = pedido => caches.match(pedido).then(r => { const rede = fetch(pedido).then(x => guardar(pedido, x)).catch(() => r); return r || rede; });

self.addEventListener('fetch', ev => {
  const pedido = ev.request;
  if (pedido.method !== 'GET') return;
  const url = new URL(pedido.url);
  if (url.origin === self.location.origin) {
    if (url.pathname.startsWith('/__/')) return;                       // páginas internas do Firebase (links de senha)
    ev.respondWith(url.pathname.includes('/img/') ? copiaPrimeiro(pedido) : redePrimeiro(pedido));
  } else if (url.hostname === 'www.gstatic.com' || url.hostname === 'fonts.gstatic.com' || url.hostname === 'fonts.googleapis.com') {
    ev.respondWith(copiaEAtualiza(pedido));
  }
});
