'use strict';
/* Interface do site.
   Aberto como arquivo (ou em ?demo), os dados ficam no próprio navegador (localStorage).
   No endereço publicado no Firebase, cada pessoa entra com a sua conta e os dados ficam no Firestore (ver "Nuvem"). */

const DEMO = /[?&]demo\b/.test(location.search);
const CHAVE = DEMO ? 'fichaAcademia.demo' : 'fichaAcademia.v1';
const LETRAS = 'ABCDEFG';
const TODOS_EQUIP = Object.keys(EQUIPAMENTOS).filter(k => k !== 'corpo');

const CFG = typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey ? FIREBASE_CONFIG : null;
const NUVEM = !DEMO && !!CFG && /^https?:$/.test(location.protocol) &&
  [CFG.projectId + '.web.app', CFG.projectId + '.firebaseapp.com', 'localhost', '127.0.0.1']
    .concat(typeof FIREBASE_ENDERECOS !== 'undefined' ? FIREBASE_ENDERECOS : []).includes(location.hostname);
// fase: local | carregando | login | baixando | pronto | falha
const nuvem = { fase: NUVEM ? 'carregando' : 'local', usuario: null, modo: 'entrar', erro: '', aviso: '', ocupado: false, pendente: false, ref: null, parar: null, timer: null };

// Link de convite (#convite=...): traz o e-mail e a senha provisória da pessoa convidada.
// É lido uma vez e sai da barra de endereço na hora, para não ficar no histórico nem ser copiado sem querer.
const b64url = s => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
let conviteLink = null;
if (NUVEM) {
  const m = /^#convite=([\w-]+)$/.exec(location.hash);
  if (m) {
    try {
      const d = JSON.parse(decodeURIComponent(escape(atob(m[1].replace(/-/g, '+').replace(/_/g, '/')))));
      if (d && typeof d.e === 'string' && typeof d.c === 'string') conviteLink = { e: d.e.toLowerCase(), c: d.c };
    } catch (e) { /* link incompleto: segue para a tela de entrada */ }
    history.replaceState(null, '', location.pathname);
  }
}

const estadoVazio = () => ({ modelo: 2, perfil: null, ficha: null, medidas: [], sessoes: [], sessao: null, diario: [], planoDesde: null });
// Modelo 2 (bioimpedância no padrão Omron): músculo esquelético em % do peso, em vez de massa muscular em kg,
// gordura abdominal de 1 a 30, e sem água corporal, idade metabólica e massa óssea.
function migrar(d) {
  if (!d || d.modelo >= 2) return d || {};
  const converter = (o, peso, vazio) => {
    if (!o) return;
    const m = num(o.musculo), p = num(peso), pct = m !== null && p ? Math.round(m / p * 1000) / 10 : null;
    if (o.musculo != null && o.musculo !== '') o.musculo = pct !== null && pct >= 5 && pct <= 60 ? pct : vazio;   // massa total (acima de 60%) não vira músculo esquelético
    const v = num(o.visceral); if (v !== null && v > 30) o.visceral = vazio;
    delete o.agua; delete o.idadeMet; delete o.ossea;
  };
  if (d.perfil) converter(d.perfil.bio, d.perfil.peso, '');
  (d.medidas || []).forEach(x => converter(x, x.peso, null));
  d.modelo = 2;
  return d;
}
const abrirDados = d => Object.assign(estadoVazio(), migrar(d));
let estado = carregar();
const ui = { passo: 1, rascunho: null, editando: false, erros: {}, dia: null, filtro: { busca: '', grupo: 'todos', equip: 'todos', soIndicados: true } };

function carregar() {
  try {
    if (DEMO) return dadosDemo();
    if (NUVEM) return estadoVazio();                      // os dados chegam da conta, depois do login
    return abrirDados(JSON.parse(localStorage.getItem(CHAVE)));
  } catch (e) { return estadoVazio(); }
}
function salvar() {
  if (NUVEM) return salvarNuvem();
  try { localStorage.setItem(CHAVE, JSON.stringify(estado)); }
  catch (e) { toast('Não consegui salvar os dados neste navegador.'); }
}

/* ───────── Utilidades ───────── */
const $ = (s, r) => (r || document).querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const n1 = (v, casas) => Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas == null ? 1 : casas, maximumFractionDigits: casas == null ? 1 : casas });
const n0 = v => Math.round(v).toLocaleString('pt-BR');
const hojeISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const dataBR = iso => { const [a, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}/${a}`; };
const dataCurta = iso => { const [, m, d] = String(iso).slice(0, 10).split('-'); return `${d}/${m}`; };

const IC = {
  painel: 'M3 11l9-8 9 8M5 10v10h14V10', ficha: 'M9 4h6v3H9zM8 5H5v16h14V5h-3M9 12h6M9 16h6',
  exercicios: 'M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10', alimentacao: 'M7 3v8a2 2 0 0 0 4 0V3M9 3v18M17 21V3c-3 2-3 7 0 9',
  evolucao: 'M4 20V4M4 20h16M7 15l4-4 3 3 5-6', perfil: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21c0-4 4-6 8-6s8 2 8 6',
  check: 'M5 12l5 5 9-10', mais: 'M12 5v14M5 12h14', x: 'M6 6l12 12M18 6L6 18', trocar: 'M4 8h13l-3-3M20 16H7l3 3',
  cima: 'M6 14l6-6 6 6', baixo: 'M6 10l6 6 6-6', lixo: 'M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13', play: 'M8 5l11 7-11 7z',
  video: 'M4 6h11v12H4zM15 10l5-3v10l-5-3', alerta: 'M12 4l9 16H3zM12 10v4M12 17v.5',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8v.5', imprimir: 'M7 8V4h10v4M7 17H5V9h14v8h-2M7 14h10v6H7z',
  raio: 'M13 3L5 13h6l-1 8 8-10h-6z'
};
const ic = (nome, cls) => `<svg class="ic ${cls || ''}" viewBox="0 0 24 24" aria-hidden="true"><path d="${IC[nome]}"/></svg>`;

function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast._t); toast._t = setTimeout(() => { t.hidden = true; }, 2800);
}

const analise = () => analisar(estado.perfil);
const exDe = id => EX_POR_ID[id];
const img = (id, n) => `img/exercicios/${id}/${n}.jpg`;
function anim(id, auto) {
  return `<div class="anim ${auto ? 'auto' : ''}"><img src="${img(id, 0)}" alt="" loading="lazy">` +
    (auto ? `<img class="f2" src="${img(id, 1)}" alt="" loading="lazy">` : `<img class="f2" data-src="${img(id, 1)}" alt="">`) + '</div>';
}
const diasCom = exId => (estado.ficha ? estado.ficha.dias.filter(d => d.itens.some(i => i.ex === exId)).map(d => d.id) : []);
// Treinos concluídos desde segunda-feira
function treinosDaSemana() {
  const d = new Date(hojeISO() + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const segunda = d.toISOString().slice(0, 10);
  return new Set((estado.sessoes || []).filter(s => s.data >= segunda).map(s => s.dia));
}
const diaAtual = () => { const ds = estado.ficha.dias; return ds.find(d => d.id === ui.dia) || ds[0]; };

/* ───────── Dados de exemplo (index.html?demo) ───────── */
function dadosDemo() {
  const perfil = {
    nome: 'Visitante', sexo: 'M', nascimento: '1994-05-10', altura: 178, peso: 88.4, objetivo: 'auto', nivel: 1, dias: 4,
    rotina: 'sedentaria', enfase: 'equilibrado', equip: TODOS_EQUIP.slice(), restricoes: [], dieta: 'tradicional', refeicoes: 4,
    bio: { gordura: 25.6, visceral: 10, musculo: 35.8, tmb: 1845 }
  };
  const medidas = [
    { data: '2026-08-20', peso: 92.0, gordura: 27.5, visceral: 11, musculo: 34.6, tmb: 1880 },
    { data: '2026-09-18', peso: 90.6, gordura: 26.9, visceral: 11, musculo: 35.0, tmb: 1868 },
    { data: '2026-10-22', peso: 89.3, gordura: 26.1, visceral: 10, musculo: 35.5, tmb: 1855 },
    { data: '2026-11-24', peso: 88.4, gordura: 25.6, visceral: 10, musculo: 35.8, tmb: 1845 }
  ];
  const a = analisar(perfil);
  return { modelo: 2, diario: [], planoDesde: '2026-10-25', perfil, ficha: gerarFicha(perfil, a.objetivo), medidas, sessoes: sessoesDemo(), sessao: null };
}

// Treinos de exemplo: dez semanas, de 2 a 4 dias por semana, sempre nos mesmos dias para o exemplo não mudar a cada visita
function sessoesDemo() {
  const d0 = new Date(); d0.setHours(12, 0, 0, 0);
  const iso = d => new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10), hoje = iso(d0);
  const segunda = new Date(d0); segunda.setDate(segunda.getDate() - ((segunda.getDay() + 6) % 7));
  const padroes = [[0, 2], [0, 2, 4], [1, 3, 4], [0, 1, 3, 4], [0, 2, 4], [1, 4], [0, 1, 3, 4], [0, 2, 3, 5], [0, 1, 3, 4], [0, 2]];
  const treinos = [['A', 'Superiores A'], ['B', 'Inferiores A'], ['C', 'Superiores B'], ['D', 'Inferiores B']], lista = [];
  padroes.forEach((dias, s) => dias.forEach(k => {
    const d = new Date(segunda); d.setDate(d.getDate() - (9 - s) * 7 + k);
    if (iso(d) > hoje) return;
    const t = treinos[lista.length % 4], total = 18 + (lista.length % 3) * 2;
    lista.push({ data: iso(d), dia: t[0], titulo: t[1], feitas: total - (lista.length % 5 === 0 ? 2 : 0), total, minutos: 46 + (lista.length * 7) % 19 });
  }));
  return lista;
}

/* ───────── Roteamento e moldura ───────── */
const ROTAS = [
  ['painel', 'Painel'], ['ficha', 'Minha ficha'], ['exercicios', 'Exercícios'],
  ['alimentacao', 'Alimentação'], ['evolucao', 'Evolução'], ['perfil', 'Perfil']
];
// "pessoas" (convites) não fica no menu: só o administrador chega nela, pelo Perfil
const rotaAtual = () => { const r = location.hash.replace(/^#\/?/, ''); return ROTAS.some(x => x[0] === r) || (r === 'pessoas' && ehAdmin()) ? r : 'painel'; };

function render() {
  const app = $('#app');
  if (NUVEM && nuvem.fase !== 'pronto') {
    app.className = 'app sem-nav';
    app.innerHTML = viewEntrada();
    return;
  }
  const rota = rotaAtual();
  if (rota === 'pessoas' && !estado.perfil) {             // o administrador pode convidar antes de fazer o próprio cadastro
    app.className = 'app sem-nav';
    app.innerHTML = `<div class="cadastro">${viewPessoas()}</div>`;
    return;
  }
  if (!estado.perfil || ui.editando) {
    app.className = 'app sem-nav';
    app.innerHTML = viewCadastro() + (NUVEM && !estado.perfil ? `<p class="conta-rodape mini suave">Conectado como ${esc(emailConta())}. <button class="link" data-acao="sair">Sair</button>${ehAdmin() ? ' · <a href="#/pessoas">Painel do administrador</a>' : ''}</p>` : '');
    return;
  }
  app.className = 'app';
  app.innerHTML = `
    <nav class="lateral" aria-label="Seções">
      <div class="logo"><span class="logo-marca">${ic('exercicios')}</span>BioFicha</div>
      ${ROTAS.map(([r, nome]) => `<a class="nav-item ${r === rota || (r === 'perfil' && rota === 'pessoas') ? 'ativo' : ''}" href="#/${r}">${ic(r)}<span>${r === 'ficha' ? '<span class="so-largo">Minha </span>ficha' : r === 'alimentacao' ? '<span class="so-largo">Alimentação</span><span class="so-estreito">Dieta</span>' : nome}</span></a>`).join('')}
      <div class="rodape mini suave" id="situacao">${DEMO ? 'Modo demonstração: dados de exemplo.' : NUVEM ? textoSituacao() : 'Seus dados ficam salvos só neste navegador.'}</div>
    </nav>
    <main class="conteudo" id="conteudo">${VIEWS[rota]()}</main>`;
}
window.addEventListener('hashchange', () => { if (rotaAtual() === 'pessoas') { ui.convites = undefined; ui.usuarios = undefined; } render(); window.scrollTo(0, 0); });

/* ───────── Nuvem: conta e dados no Firebase (Auth + Firestore) ─────────
   Cada pessoa tem um único documento, usuarios/<id da conta>, com o mesmo conteúdo que o modo local guarda no navegador.
   O acesso é por convite: o administrador grava convites/<e-mail> e só quem tem convite (e e-mail confirmado) lê e grava
   o próprio documento. Quem decide isso são as regras do banco (firestore.rules); a tela só acompanha. */
const SDK = 'https://www.gstatic.com/firebasejs/10.14.1/firebase-';
const ADMINS = typeof FIREBASE_ADMINS !== 'undefined' ? FIREBASE_ADMINS : [];
const ehAdmin = () => NUVEM && !!nuvem.usuario && ADMINS.includes(nuvem.usuario.uid);
const EMAIL_OK = /^\S+@\S+\.\S+$/;
let fb = null;                                            // SDK do Firebase, baixado só no modo nuvem
const emailConta = () => (nuvem.usuario && (nuvem.usuario.email || nuvem.usuario.displayName)) || '';
const ERROS_CONTA = {
  'auth/invalid-credential': 'E-mail ou senha incorretos.', 'auth/wrong-password': 'E-mail ou senha incorretos.',
  'auth/user-not-found': 'E-mail ou senha incorretos.', 'auth/invalid-email': 'Confira o e-mail digitado.',
  'auth/missing-password': 'Digite a senha.', 'auth/weak-password': 'A senha precisa ter pelo menos 6 caracteres.',
  'auth/email-already-in-use': 'Já existe uma conta com este e-mail. Use "Entrar".',
  'auth/too-many-requests': 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.',
  'auth/network-request-failed': 'Sem conexão com a internet.',
  'auth/operation-not-allowed': 'Esta forma de entrar não está ativada.',
  'auth/unauthorized-domain': 'Este endereço não está autorizado para login.',
  'auth/account-exists-with-different-credential': 'Este e-mail já tem conta com outra forma de entrar.'
};

async function iniciarNuvem() {
  try {
    const [app, auth, fs] = await Promise.all([import(SDK + 'app.js'), import(SDK + 'auth.js'), import(SDK + 'firestore.js')]);
    const inst = app.initializeApp(CFG);
    let db;
    // Cópia local do Firestore: o que for marcado sem internet (no meio do treino) sobe quando a conexão voltar
    try { db = fs.initializeFirestore(inst, { localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() }) }); }
    catch (e) { db = fs.getFirestore(inst); }
    fb = { app, auth, fs, db, inst, au: auth.getAuth(inst) };
    fb.au.languageCode = 'pt-BR';
    auth.onAuthStateChanged(fb.au, u => {
      const c = conviteLink; conviteLink = null;
      // Chegou por um link de convite e não está conectado com essa conta: entra com a senha provisória do link
      if (c && (!u || (u.email || '').toLowerCase() !== c.e)) return entrarPeloConvite(c);
      aoMudarUsuario(u);
    }, falhaNuvem);
  } catch (e) { falhaNuvem(e); }
}
async function entrarPeloConvite(c) {
  nuvem.email = c.e;
  try {
    sessionStorage.setItem('bioficha.criarSenha', '1');
    await fb.auth.signInWithEmailAndPassword(fb.au, c.e, c.c);       // dá certo: o Firebase avisa de novo e aoMudarUsuario abre a conta
  } catch (e) {
    sessionStorage.removeItem('bioficha.criarSenha');
    nuvem.erro = ['auth/invalid-credential', 'auth/wrong-password', 'auth/user-not-found'].includes(e.code)
      ? 'Este link de convite já foi usado ou não vale mais. Entre com seu e-mail e senha, ou peça um novo convite.'
      : ERROS_CONTA[e.code] || 'Não consegui abrir o convite. Tente de novo.';
    aoMudarUsuario(fb.au.currentUser);
  }
}
function falhaNuvem(e) {
  if (nuvem.saindo) return;
  console.warn('nuvem', e);
  nuvem.fase = 'falha';
  nuvem.erro = navigator.onLine ? 'Não consegui conectar à sua conta. Tente de novo em instantes.' : 'Sem conexão com a internet. Conecte-se e tente de novo.';
  render();
}
function aoMudarUsuario(u) {
  if (nuvem.parar) { nuvem.parar(); nuvem.parar = null; }
  const vez = nuvem.vez = (nuvem.vez || 0) + 1;            // respostas atrasadas de uma abertura anterior são ignoradas
  nuvem.usuario = u; nuvem.ocupado = false; nuvem.pendente = false;
  // Ao sair, a página é recarregada logo em seguida: não mostra o formulário de login nesse intervalo
  if (!u) { estado = estadoVazio(); nuvem.ref = null; nuvem.fase = nuvem.saindo ? 'carregando' : 'login'; return render(); }
  nuvem.fase = 'baixando'; nuvem.erro = ''; nuvem.aviso = ''; render();
  nuvem.ref = fb.fs.doc(fb.db, 'usuarios', u.uid);
  let primeira = true;
  nuvem.parar = fb.fs.onSnapshot(nuvem.ref, { includeMetadataChanges: true }, snap => {
    const m = snap.metadata;
    nuvem.pendente = m.hasPendingWrites;
    if (primeira) {
      // Sem internet e sem cópia neste aparelho: espera o servidor, para não abrir um cadastro novo por cima dos dados da conta
      if (!snap.exists() && m.fromCache) return;
      primeira = false;
      if (snap.exists()) estado = abrirDados(snap.data());
      nuvem.reconferiu = false;
      conferirConvite(u).then(precisaSenha => {
        if (vez !== nuvem.vez || nuvem.fase !== 'baixando') return;
        nuvem.fase = precisaSenha ? 'criar-senha' : 'pronto'; render();
      });
      return;
    }
    if (!m.hasPendingWrites && !m.fromCache) {
      if (!snap.exists()) {
        if (estado.perfil && !nuvem.timer) { estado = estadoVazio(); ui.rascunho = null; ui.editando = false; ui.passo = 1; render(); }   // apagado em outro aparelho
      } else if ((snap.data().atualizadoEm || 0) > (estado.atualizadoEm || 0)) {
        estado = abrirDados(snap.data()); render(); toast('Dados atualizados de outro aparelho.');
      }
    }
    atualizarSituacao();
  }, async e => {
    if (!e || e.code !== 'permission-denied') return falhaNuvem(e);
    // O banco recusou: falta confirmar o e-mail ou a conta não tem convite (ou o convite foi retirado)
    nuvem.parar = null; nuvem.ref = null; estado = estadoVazio();
    let fase = u.emailVerified || ehAdmin() ? 'sem-convite' : 'confirmar';
    if (fase === 'confirmar' && u.email) {
      // Acesso removido pelo administrador: confirmar o e-mail não adiantaria
      try { const s = await fb.fs.getDoc(fb.fs.doc(fb.db, 'convites', u.email.toLowerCase())); if (s.exists() && s.data().removido) fase = 'sem-convite'; }
      catch (e2) { /* sem convite legível: fica valendo a confirmação do e-mail */ }
    }
    if (vez !== nuvem.vez) return;
    nuvem.fase = fase;
    nuvem.erro = !nuvem.reconferiu ? '' : nuvem.fase === 'confirmar'
      ? 'O e-mail ainda não aparece como confirmado. Abra o link que chegou na sua caixa de entrada e tente de novo.'
      : 'Ainda não há convite para esta conta.';
    nuvem.reconferiu = false; nuvem.ocupado = false;
    render();
  });
}
// Antes de abrir a tela, olha o convite da pessoa. Responde se ela ainda precisa criar a própria senha
// (entrou pelo link do convite e continua com a senha provisória) e marca no convite quando ela entrou.
async function conferirConvite(u) {
  const pelaSessao = sessionStorage.getItem('bioficha.criarSenha') === '1';
  if (ehAdmin() || !u.email) return pelaSessao;
  try {
    const r = fb.fs.doc(fb.db, 'convites', u.email.toLowerCase()), s = await fb.fs.getDoc(r);
    if (!s.exists()) return pelaSessao;
    const d = s.data();
    // Quem já confirmou o e-mail (criou a senha pelo link enviado por e-mail) não usa mais a senha provisória
    const dispensa = u.emailVerified;
    const precisa = !!d.chave && !dispensa;
    const muda = {};
    if (d.chave && dispensa) muda.chave = fb.fs.deleteField();
    if (!d.entrouEm && !precisa) muda.entrouEm = Date.now();
    if (Object.keys(muda).length) fb.fs.updateDoc(r, muda).catch(() => {});
    if (!precisa) sessionStorage.removeItem('bioficha.criarSenha');
    return precisa;
  } catch (e) { return pelaSessao; }
}
async function salvarSenhaNova() {
  const campo = $('#n-senha'), senha = campo ? campo.value : '', u = fb.au.currentUser;
  nuvem.erro = ''; nuvem.aviso = '';
  if (senha.length < 6) { nuvem.erro = 'Escolha uma senha com pelo menos 6 caracteres.'; render(); const c = $('#n-senha'); if (c) c.focus(); return; }
  nuvem.ocupado = true; render();
  try {
    await fb.auth.updatePassword(u, senha);
    sessionStorage.removeItem('bioficha.criarSenha');
    if (!ehAdmin() && u.email) {
      await fb.fs.updateDoc(fb.fs.doc(fb.db, 'convites', u.email.toLowerCase()), { chave: fb.fs.deleteField(), entrouEm: Date.now() }).catch(() => {});
    }
    nuvem.ocupado = false; nuvem.fase = 'pronto'; render(); toast('Senha criada. Bom treino!');
  } catch (e) {
    console.warn('senha', e);
    nuvem.ocupado = false;
    nuvem.erro = e.code === 'auth/requires-recent-login' ? 'Por segurança, abra de novo o link do convite e crie a senha em seguida.'
      : ERROS_CONTA[e.code] || 'Não consegui salvar a senha. Tente de novo.';
    render();
  }
}
// Atualiza a situação da conta (e-mail confirmado, convite) e tenta abrir os dados de novo
async function reconferirConta() {
  const u = fb.au.currentUser; if (!u) return;
  nuvem.ocupado = true; nuvem.erro = ''; nuvem.aviso = ''; render();
  try { await fb.auth.reload(u); await fb.auth.getIdToken(u, true); }
  catch (e) { nuvem.ocupado = false; nuvem.erro = ERROS_CONTA[e.code] || 'Não consegui conferir agora. Tente de novo.'; return render(); }
  nuvem.reconferiu = true;
  aoMudarUsuario(fb.au.currentUser);
}
function salvarNuvem() {
  if (!nuvem.ref) return;
  estado.atualizadoEm = Date.now();
  clearTimeout(nuvem.timer);
  nuvem.timer = setTimeout(enviarNuvem, 700);              // junta toques seguidos (séries, cargas) em uma gravação só
  atualizarSituacao();
}
function enviarNuvem() {
  clearTimeout(nuvem.timer); nuvem.timer = null;
  if (!nuvem.ref) return;
  // "conta" identifica de quem é o documento para o painel do administrador
  fb.fs.setDoc(nuvem.ref, Object.assign(JSON.parse(JSON.stringify(estado)), { conta: { email: emailConta() } }))
    .catch(e => { console.warn('salvar', e); toast('Não consegui salvar na sua conta. Tente de novo.'); });
}
function textoSituacao() {
  if (!navigator.onLine) return 'Sem conexão. O que você mudar sobe para a sua conta quando a internet voltar.';
  return nuvem.pendente || nuvem.timer ? 'Salvando na sua conta…' : 'Salvo na sua conta.';
}
function atualizarSituacao() { const s = $('#situacao'); if (s && NUVEM) s.textContent = textoSituacao(); }
if (NUVEM) {
  ['online', 'offline'].forEach(t => window.addEventListener(t, () => { nuvem.fase === 'pronto' ? atualizarSituacao() : render(); }));
  // Ao fechar ou trocar de aba, grava na hora o que estava esperando
  window.addEventListener('pagehide', () => { if (nuvem.timer) enviarNuvem(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden && nuvem.timer) enviarNuvem(); });
}

function viewEntrada() {
  const f = nuvem.fase, modo = nuvem.modo;
  const logo = `<div class="logo"><span class="logo-marca">${ic('exercicios')}</span>BioFicha</div>`;
  if (f === 'falha') return `<div class="cadastro conta">${logo}<h1>Sem acesso à conta</h1><p class="aviso">${esc(nuvem.erro)}</p>
    <div class="acoes"><button class="btn primario" data-acao="recarregar">Tentar de novo</button></div></div>`;
  const trava = nuvem.ocupado ? 'disabled' : '';
  const recados = `${nuvem.erro ? `<p class="aviso erro" role="alert">${esc(nuvem.erro)}</p>` : ''}${nuvem.aviso ? `<p class="aviso" role="status">${esc(nuvem.aviso)}</p>` : ''}`;
  const conectado = `<p class="mini suave quebra-email">Conectado como ${esc(emailConta())}. <button class="link" data-acao="sair">Sair</button></p>`;
  if (f === 'confirmar') return `<div class="cadastro conta">${logo}<h1>Confirme seu e-mail</h1>
    <p class="suave quebra-email">Para proteger seus dados, precisamos confirmar que <b>${esc(emailConta())}</b> é seu. Peça o link, abra o e-mail que chegar e depois volte aqui.</p>
    ${recados}
    <button class="btn primario grande largo" data-acao="enviar-confirmacao" ${trava}>Enviar link de confirmação</button>
    <button class="btn grande largo" data-acao="reconferir" ${trava}>${nuvem.ocupado ? 'Aguarde…' : 'Já confirmei'}</button>${conectado}</div>`;
  if (f === 'sem-convite') return `<div class="cadastro conta">${logo}<h1>Acesso por convite</h1>
    <p class="suave quebra-email">A conta <b>${esc(emailConta())}</b> não está com o acesso liberado no BioFicha. Peça o convite a quem administra o site, usando este mesmo e-mail.</p>
    ${recados}
    <button class="btn primario grande largo" data-acao="reconferir" ${trava}>${nuvem.ocupado ? 'Aguarde…' : 'Tentar de novo'}</button>${conectado}</div>`;
  if (f === 'criar-senha') return `<div class="cadastro conta">${logo}<h1>Crie sua senha</h1>
    <p class="suave quebra-email">Bem-vindo ao BioFicha. Escolha a senha que você vai usar para entrar com o e-mail <b>${esc(emailConta())}</b>.</p>
    <p class="mini suave">Quem administra o BioFicha acompanha o progresso de quem usa o site: medições, treinos e alimentação.</p>
    <form id="form-senha" class="pilha" novalidate>
      <label class="campo"><span>Nova senha</span><input class="entrada" id="n-senha" type="password" autocomplete="new-password"><small>Pelo menos 6 caracteres.</small></label>
      ${recados}
      <button class="btn primario grande largo" type="submit" ${trava}>${nuvem.ocupado ? 'Aguarde…' : 'Salvar senha e entrar'}</button>
    </form>${conectado}</div>`;
  if (f !== 'login') return `<div class="cadastro conta">${logo}<p class="suave" role="status">${f === 'baixando' ? 'Carregando seus dados…' : 'Carregando…'}</p>
    ${navigator.onLine ? '' : '<p class="aviso">Sem conexão com a internet. Assim que ela voltar, seus dados aparecem.</p>'}
    ${f === 'baixando' ? conectado : ''}</div>`;
  const titulo = { entrar: 'Entrar', recuperar: 'Criar ou trocar a senha' }[modo];
  const texto = {
    entrar: 'O acesso é por convite. Se você recebeu um link de convite, abra o link para criar sua senha. Se já criou, entre aqui.',
    recuperar: 'Digite o e-mail do seu convite. Você recebe um link para criar ou trocar a senha (olhe também a caixa de spam).'
  }[modo];
  return `<div class="cadastro conta">${logo}
    <h1>${titulo}</h1><p class="suave">${texto}</p>
    <form id="form-conta" class="pilha" novalidate>
      <label class="campo"><span>E-mail</span><input class="entrada" id="c-email" type="email" inputmode="email" autocomplete="email" value="${esc(nuvem.email || '')}" placeholder="voce@exemplo.com"></label>
      ${modo === 'recuperar' ? '' : '<label class="campo"><span>Senha</span><input class="entrada" id="c-senha" type="password" autocomplete="current-password"></label>'}
      ${recados}
      <button class="btn primario grande largo" type="submit" ${trava}>${nuvem.ocupado ? 'Aguarde…' : { entrar: 'Entrar', recuperar: 'Enviar link' }[modo]}</button>
    </form>
    <p class="pequeno suave conta-links">${modo === 'entrar'
      ? 'Esqueceu a senha? <button class="link" data-acao="modo-conta" data-valor="recuperar">Receber link por e-mail</button>'
      : '<button class="link" data-acao="modo-conta" data-valor="entrar">Voltar para entrar</button>'}</p></div>`;
}
async function enviarConta() {
  const email = ($('#c-email').value || '').trim(), senha = $('#c-senha') ? $('#c-senha').value : '';
  const modo = nuvem.modo;
  let foco = '';
  nuvem.email = email; nuvem.erro = ''; nuvem.aviso = '';
  if (!EMAIL_OK.test(email)) { nuvem.erro = 'Confira o e-mail digitado.'; foco = '#c-email'; }
  else if (modo === 'entrar' && !senha) { nuvem.erro = 'Digite a senha.'; foco = '#c-senha'; }
  if (nuvem.erro) { render(); const c = $(foco); if (c) c.focus(); return; }
  nuvem.ocupado = true; render();
  try {
    if (modo === 'entrar') { await fb.auth.signInWithEmailAndPassword(fb.au, email, senha); return; }   // quem troca de tela é aoMudarUsuario
    await enviarLinkSenha(email);
    nuvem.modo = 'entrar';
    nuvem.aviso = 'Se este e-mail tiver sido convidado, o link para criar a senha já foi enviado. Olhe também a caixa de spam.';
  } catch (e) { nuvem.erro = ERROS_CONTA[e.code] || 'Não consegui concluir. Tente de novo.'; }
  nuvem.ocupado = false;
  if (nuvem.fase === 'login') render();
}

// Os e-mails do Firebase trazem um botão para voltar ao site: tenta o endereço em uso, depois o padrão do projeto;
// se o projeto recusar os dois, o e-mail vai sem o botão.
async function comRetorno(enviar) {
  const padrao = 'https://' + CFG.projectId + '.web.app/', aqui = location.origin + '/';
  for (const url of (location.protocol === 'https:' && aqui !== padrao ? [aqui, padrao] : [padrao])) {
    try { return await enviar({ url }); }
    catch (e) { if (e.code !== 'auth/unauthorized-continue-uri') throw e; }
  }
  await enviar(undefined);
}
const enviarLinkSenha = email => comRetorno(o => fb.auth.sendPasswordResetEmail(fb.au, email, o));

/* ───────── Pessoas: convites (só o administrador) ───────── */
async function carregarConvites() {
  ui.convites = null;                                     // null = carregando
  try {
    const q = await fb.fs.getDocs(fb.fs.collection(fb.db, 'convites'));
    ui.convites = q.docs.map(d => d.data()).sort((a, b) => (b.criadoEm || 0) - (a.criadoEm || 0));
  } catch (e) { console.warn('convites', e); ui.convites = []; toast('Não consegui carregar a lista de convidados.'); }
  if (rotaAtual() === 'pessoas') render();
}
/* ───────── Painel do administrador: acompanhamento dos usuários ─────────
   O administrador lê (não altera) os dados de cada pessoa para acompanhar o progresso. As regras do banco
   liberam só a leitura, e o site avisa os convidados disso no Perfil e na criação da senha. */
async function carregarUsuarios() {
  ui.usuarios = null;                                     // null = carregando
  try {
    const q = await fb.fs.getDocs(fb.fs.collection(fb.db, 'usuarios'));
    ui.usuarios = q.docs.map(d => Object.assign(abrirDados(d.data()), { uid: d.id })).filter(u => u.perfil);
  } catch (e) { console.warn('usuarios', e); ui.usuarios = []; toast('Não consegui carregar os usuários.'); }
  if (rotaAtual() === 'pessoas') render();
}
const haQuanto = ms => { if (!ms) return 'sem registro'; const d = diasEntre(new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 10), hojeISO()); return d <= 0 ? 'hoje' : d === 1 ? 'ontem' : `há ${d} dias`; };
// Números de acompanhamento de uma pessoa
function resumoUsuario(u) {
  const hoje = hojeISO(), ms = u.medidas || [], ss = u.sessoes || [], ultima = ms[ms.length - 1], primeira = ms[0];
  const convite = (ui.convites || []).find(c => c.uid === u.uid || (u.conta && c.email === u.conta.email));
  const diasDiario = new Set((u.diario || []).filter(x => x.data > dataMenos(hoje, 7)).map(x => x.data)).size;
  return {
    nome: u.perfil.nome || (convite && convite.nome) || '', email: (u.conta && u.conta.email) || (convite && convite.email) || '',
    atividade: haQuanto(u.atualizadoEm), parado: !u.atualizadoEm || Date.now() - u.atualizadoEm > 7 * 86400000,
    treinos7: ss.filter(s => s.data > dataMenos(hoje, 7)).length, meta: parseInt(u.perfil.dias, 10) || 0,
    treinos28: ss.filter(s => s.data > dataMenos(hoje, 28)).length,
    ultima, diasMedida: ultima ? diasEntre(ultima.data, hoje) : null,
    variacaoPeso: ultima && primeira && ultima !== primeira ? ultima.peso - primeira.peso : null, desde: primeira ? primeira.data : null,
    variacaoGordura: ultima && primeira && ultima !== primeira && ultima.gordura != null && primeira.gordura != null ? ultima.gordura - primeira.gordura : null,
    diasDiario, removido: !!(convite && convite.removido)
  };
}
const comSinal = (v, casas) => (Math.abs(v) < 0.05 ? '0' : (v > 0 ? '+' : '−') + n1(Math.abs(v), casas));
function secaoUsuarios() {
  if (ui.usuarios === undefined) carregarUsuarios();
  const lista = ui.usuarios;
  if (lista === null || lista === undefined) return '<div class="card"><h2>Usuários</h2><p class="suave">Carregando…</p></div>';
  if (!lista.length) return '<div class="card"><h2>Usuários</h2><p class="suave">Ninguém fez o cadastro ainda. Quem você convidar aparece aqui depois de preencher os dados.</p></div>';
  const rs = lista.map(u => ({ u, r: resumoUsuario(u) })).sort((a, b) => (b.u.atualizadoEm || 0) - (a.u.atualizadoEm || 0));
  const ativos = rs.filter(x => !x.r.parado).length, emDia = rs.filter(x => x.r.meta && x.r.treinos7 >= x.r.meta).length, medidos = rs.filter(x => x.r.diasMedida !== null && x.r.diasMedida < 8).length;
  const linhas = rs.map(({ u, r }) => `<tr>
      <td><b>${esc(r.nome || r.email || 'Sem nome')}</b>${r.nome && r.email ? `<br><span class="suave mini">${esc(r.email)}</span>` : ''}${u.uid === nuvem.usuario.uid ? ' ' + selo('info', 'Você') : ''}${r.removido ? ' ' + selo('alerta', 'Acesso removido') : ''}</td>
      <td>${selo(r.parado ? 'atencao' : 'bom', r.atividade)}</td>
      <td>${r.treinos7} de ${r.meta || '–'}<br><span class="suave mini">${r.treinos28} em 28 dias</span></td>
      <td>${r.ultima ? `${n1(r.ultima.peso)} kg${r.ultima.gordura != null ? ' · ' + n1(r.ultima.gordura) + '%' : ''}<br><span class="mini ${r.diasMedida >= 8 ? 'texto-atencao' : 'suave'}">${r.diasMedida === 0 ? 'hoje' : r.diasMedida === 1 ? 'ontem' : 'há ' + r.diasMedida + ' dias'}</span>` : '–'}</td>
      <td>${r.variacaoPeso === null ? '–' : `${comSinal(r.variacaoPeso)} kg${r.variacaoGordura === null ? '' : `<br><span class="suave mini">gordura ${comSinal(r.variacaoGordura)} pts</span>`}`}</td>
      <td>${r.diasDiario} de 7 dias</td>
      <td class="acoes-linha"><button class="btn" data-acao="ver-usuario" data-valor="${esc(u.uid)}">Ver</button></td></tr>`).join('');
  return `<div class="card"><div class="cabecalho" style="margin-bottom:12px"><div><h2>Usuários</h2><p class="suave pequeno">Quem já fez o cadastro, do mais recente para o mais parado. Você vê os dados, mas não altera.</p></div>
      <div class="acoes"><button class="btn" data-acao="recarregar-usuarios">Atualizar</button></div></div>
    <div class="tiles" style="margin-bottom:16px">
      ${tile('Usuários', rs.length, '', '<span class="mini suave">com cadastro feito</span>')}
      ${tile('Ativos na semana', ativos, '', `<span class="mini suave">de ${rs.length}</span>`)}
      ${tile('Meta de treinos batida', emDia, '', '<span class="mini suave">nos últimos 7 dias</span>')}
      ${tile('Medição em dia', medidos, '', '<span class="mini suave">nos últimos 7 dias</span>')}
    </div>
    <div class="rolagem-x"><table class="tabela quebra usuarios"><tr><th>Pessoa</th><th>Último uso</th><th>Treinos na semana</th><th>Última medição</th><th>Desde o início</th><th>Diário</th><th></th></tr>${linhas}</table></div></div>`;
}
function modalUsuario(uid) {
  const u = (ui.usuarios || []).find(x => x.uid === uid); if (!u) return;
  const r = resumoUsuario(u), p = u.perfil, a = analisar(p), pl = planoAlimentar(p, a), hoje = hojeISO();
  const v = x => (x == null ? '–' : n1(x));
  const diario = (() => {                                  // médias dos últimos 7 dias com registro
    const porDia = {}; (u.diario || []).filter(x => x.data > dataMenos(hoje, 7)).forEach(x => { porDia[x.data] = (porDia[x.data] || 0) + (x.kcal || 0); });
    const ds = Object.keys(porDia); return ds.length ? { dias: ds.length, kcal: Math.round(ds.reduce((t, d) => t + porDia[d], 0) / ds.length) } : null;
  })();
  const semana = analiseDaSemana(u);
  abrirModal(`${topoModal(esc(r.nome || r.email || 'Usuário'))}<div class="miolo solto">
    <p class="suave pequeno">${esc(r.email)}${r.email ? ' · ' : ''}${a.idade} anos · ${n0(a.alturaCm)} cm · objetivo: ${OBJETIVOS[a.objetivo].nome.toLowerCase()} · ${NIVEIS[p.nivel].toLowerCase()} · último uso ${r.atividade}</p>
    <div class="tiles" style="margin-top:14px">
      ${tile('Peso', n1(a.peso), 'kg', r.variacaoPeso === null ? '' : `<span class="mini suave">${comSinal(r.variacaoPeso)} kg desde ${dataBR(r.desde)}</span>`)}
      ${tile('Gordura corporal' + (a.gorduraMedida ? '' : ' (est.)'), n1(a.gordura), '%', selo(a.gorduraClasse.nivel, a.gorduraClasse.rotulo))}
      ${a.visceral !== null ? tile('Gordura abdominal', n0(a.visceral), 'nível', selo(a.visceralClasse.nivel, a.visceralClasse.rotulo)) : ''}
      ${a.musculo !== null ? tile('Músculo esquelético', n1(a.musculo), '%', selo(a.musculoClasse.nivel, a.musculoClasse.rotulo)) : ''}
      ${tile('IMC', n1(a.imc), '', selo(a.imcClasse.nivel, a.imcClasse.rotulo))}
      ${tile('Treinos', r.treinos7 + ' de ' + (r.meta || '–'), '', `<span class="mini suave">na semana · ${r.treinos28} em 28 dias</span>`)}
    </div>
    <h3 style="margin-top:20px">Medições</h3>
    <div class="rolagem-x"><table class="tabela"><tr><th>Data</th><th>Peso (kg)</th><th>Gordura (%)</th><th>Abdominal</th><th>Músculo (%)</th><th>Repouso (kcal)</th></tr>
      ${(u.medidas || []).slice(-8).reverse().map(m => `<tr><td>${dataBR(m.data)}</td><td>${v(m.peso)}</td><td>${v(m.gordura)}</td><td>${m.visceral == null ? '–' : n0(m.visceral)}</td><td>${v(m.musculo)}</td><td>${m.tmb == null ? '–' : n0(m.tmb)}</td></tr>`).join('') || '<tr><td colspan="6" class="suave">Sem medições.</td></tr>'}</table></div>
    <h3 style="margin-top:20px">Treinos concluídos</h3>
    <div class="rolagem-x"><table class="tabela"><tr><th>Data</th><th>Treino</th><th>Séries</th><th>Duração</th></tr>
      ${(u.sessoes || []).slice(-8).reverse().map(s => `<tr><td>${dataBR(s.data)}</td><td>${esc('Treino ' + s.dia + (s.titulo ? ' · ' + s.titulo : ''))}</td><td>${s.feitas} de ${s.total}</td><td>${s.minutos ? s.minutos + ' min' : '–'}</td></tr>`).join('') || '<tr><td colspan="4" class="suave">Nenhum treino concluído.</td></tr>'}</table></div>
    <h3 style="margin-top:20px">Alimentação</h3>
    <p>Meta de ${n0(pl.kcal)} kcal e ${n0(pl.proteina)} g de proteína${pl.ajustado ? ', reestruturada em ' + dataBR(p.planoAjuste.desde) : ''}. ${diario ? `Nos últimos 7 dias registrou ${diario.dias} ${diario.dias === 1 ? 'dia' : 'dias'}, com média de ${n0(diario.kcal)} kcal.` : 'Sem registros no diário nos últimos 7 dias.'}</p>
    <h3 style="margin-top:20px">Análise da semana</h3><p>${esc(semana.resumo)}</p><div class="meta-semana"><span class="mini">Meta da semana</span><b>${esc(semana.meta)}</b></div></div>`);
}

// Endereço e texto do convite. O link leva o e-mail e a senha provisória; só existe enquanto a pessoa não criou a própria senha.
const linkConvite = p => location.origin + '/#convite=' + b64url(JSON.stringify({ e: p.email, c: p.chave }));
const textoConvite = p => `${p.nome ? 'Oi, ' + p.nome.split(' ')[0] + '!' : 'Oi!'} Te convidei para o BioFicha, o app de treino e alimentação. ` +
  `Abra este link, crie sua senha e pronto:\n${linkConvite(p)}\n\nO link é só seu. Depois é só entrar com o e-mail ${p.email} e a senha que você criar.`;
async function copiar(texto) {
  try { await navigator.clipboard.writeText(texto); return true; }
  catch (e) {                                              // navegador sem permissão para a área de transferência
    const t = document.createElement('textarea');
    t.value = texto; t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* sem cópia automática */ }
    t.remove(); return ok;
  }
}
function viewPessoas() {
  if (ui.convites === undefined) carregarConvites();
  if (!ui.convite) ui.convite = { email: '', nome: '', erro: '', ocupado: false };
  const c = ui.convite, lista = ui.convites;
  const dia = ms => dataBR(new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString());
  const situacao = p => (p.removido ? selo('alerta', 'Acesso removido')
    : p.entrouEm ? selo('bom', 'Entrou em ' + dia(p.entrouEm))
    : p.chave ? selo('atencao', 'Falta abrir o link')
    : selo('info', 'Convidado em ' + dia(p.criadoEm || Date.now())));
  const botoes = p => (p.removido
    ? `<button class="btn" data-acao="devolver-acesso" data-valor="${esc(p.email)}">Devolver acesso</button>
       <button class="btn perigo" data-acao="excluir-convite" data-valor="${esc(p.email)}">Excluir</button>`
    : `${p.chave ? `<button class="btn primario" data-acao="copiar-convite" data-valor="${esc(p.email)}">Copiar convite</button>` : ''}
       <button class="btn" data-acao="reenviar-convite" data-valor="${esc(p.email)}">Enviar e-mail</button>
       <button class="btn perigo" data-acao="remover-convite" data-valor="${esc(p.email)}">Remover</button>`);
  const linhas = (lista || []).map(p => `<tr>
      <td><b>${esc(p.nome || p.email)}</b>${p.nome ? `<br><span class="suave">${esc(p.email)}</span>` : ''}</td>
      <td>${situacao(p)}</td>
      <td class="acoes-linha">${botoes(p)}</td></tr>`).join('');
  const novo = ui.conviteNovo && (lista || []).find(p => p.email === ui.conviteNovo && p.chave && !p.removido);
  return `
    <div class="cabecalho"><div><h1>Administração</h1><p class="suave">Acompanhe quem usa o BioFicha e escolha quem entra. Só você vê esta tela.</p></div>
      <div class="acoes"><a class="btn" href="#/${estado.perfil ? 'perfil' : ''}">${estado.perfil ? 'Voltar ao Perfil' : 'Voltar ao cadastro'}</a></div></div>
    <div class="pilha">
      ${secaoUsuarios()}
      <div class="card"><h2>Convidar</h2>
        <form id="form-convite" class="convite" novalidate>
          <label class="campo"><span>E-mail da pessoa</span><input class="entrada" id="cv-email" type="email" inputmode="email" autocomplete="off" value="${esc(c.email)}" placeholder="pessoa@exemplo.com"></label>
          <label class="campo"><span>Nome (opcional)</span><input class="entrada" id="cv-nome" type="text" autocomplete="off" maxlength="60" value="${esc(c.nome)}"></label>
          <button class="btn primario" type="submit" ${c.ocupado ? 'disabled' : ''}>${c.ocupado ? 'Criando…' : 'Criar convite'}</button>
        </form>
        ${c.erro ? `<p class="aviso erro" role="alert" style="margin-top:12px">${esc(c.erro)}</p>` : ''}
        <p class="mini suave" style="margin-top:12px">O convite vira um link pessoal. Você copia e manda para a pessoa (WhatsApp, por exemplo); ela abre, cria a senha e entra. Um e-mail automático também é enviado, mas ele costuma cair no spam.</p></div>
      ${novo ? `<div class="card destaque" id="convite-novo"><h2>Convite pronto para ${esc(novo.nome || novo.email)}</h2>
        <p class="pequeno">Mande esta mensagem para a pessoa. O link é pessoal: quem abrir entra na conta dela.</p>
        <textarea class="entrada mensagem-convite" id="msg-convite" readonly rows="6">${esc(textoConvite(novo))}</textarea>
        <div class="acoes" style="margin-top:12px"><button class="btn primario" data-acao="copiar-convite" data-valor="${esc(novo.email)}">Copiar convite</button></div></div>` : ''}
      <div class="card"><h2>Convidados</h2>
        ${lista === null || lista === undefined ? '<p class="suave">Carregando…</p>'
          : !lista.length ? '<p class="suave">Ninguém foi convidado ainda.</p>'
          : `<div class="rolagem-x"><table class="tabela quebra convidados"><tbody>${linhas}</tbody></table></div>
             <p class="mini suave" style="margin-top:12px">"Copiar convite" aparece até a pessoa criar a senha dela. Remover tira o acesso na hora e guarda os dados; "Devolver acesso" traz tudo de volta.</p>`}</div>
    </div>`;
}
// Cria a conta do convidado numa segunda ligação com o Firebase, só em memória:
// criar na ligação principal trocaria o usuário conectado (o administrador) pelo convidado.
// Devolve o id da conta e a senha provisória que vai no link; ou nada, se o e-mail já tinha conta.
async function criarContaConvidada(email) {
  const sec = fb.app.initializeApp(CFG, 'convite-' + Date.now());
  try {
    const a2 = fb.auth.initializeAuth(sec, { persistence: fb.auth.inMemoryPersistence });
    const chave = b64url(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(24))));
    const r = await fb.auth.createUserWithEmailAndPassword(a2, email, chave);
    const uid = r.user.uid;
    await fb.auth.signOut(a2);
    return { uid, chave };
  } catch (e) { if (e.code !== 'auth/email-already-in-use') throw e; return null; }
  finally { fb.app.deleteApp(sec).catch(() => {}); }
}
async function enviarConvite() {
  const c = ui.convite, email = (c.email || '').trim().toLowerCase(), nome = (c.nome || '').trim().slice(0, 60);
  c.erro = '';
  if (!EMAIL_OK.test(email)) c.erro = 'Confira o e-mail digitado.';
  else if (!navigator.onLine) c.erro = 'Sem conexão com a internet.';
  if (c.erro) { render(); const i = $('#cv-email'); if (i) i.focus(); return; }
  c.ocupado = true; render();
  try {
    const ref = fb.fs.doc(fb.db, 'convites', email);
    await fb.fs.setDoc(ref, { email, nome, criadoEm: Date.now(), removido: false }, { merge: true });
    const conta = await criarContaConvidada(email);
    if (conta) await fb.fs.updateDoc(ref, conta);
    // O e-mail automático é um extra: se falhar ou cair no spam, o link copiado resolve
    let comEmail = true;
    try { await enviarLinkSenha(email); } catch (e) { console.warn('e-mail do convite', e); comEmail = false; }
    ui.convite = null; ui.conviteNovo = email;
    toast(conta ? 'Convite criado. Copie e mande para a pessoa.'
      : comEmail ? 'Este e-mail já tinha conta: acesso liberado e e-mail enviado.' : 'Este e-mail já tinha conta: acesso liberado.');
    await carregarConvites();
  } catch (e) {
    console.warn('convite', e);
    c.ocupado = false; c.erro = ERROS_CONTA[e.code] || 'Não consegui criar o convite. Tente de novo.';
    render();
  }
}
async function sairDaConta() {
  const tinha = !!nuvem.timer || nuvem.pendente;
  if (nuvem.timer) enviarNuvem();
  if (tinha && !navigator.onLine) {
    if (!confirm('Há alterações que ainda não subiram para a sua conta por falta de internet.\n\nSe sair agora, elas se perdem. Sair mesmo assim?')) return;
  } else if (tinha) await Promise.race([fb.fs.waitForPendingWrites(fb.db), new Promise(r => setTimeout(r, 4000))]);
  nuvem.saindo = true;
  try {
    if (nuvem.parar) { nuvem.parar(); nuvem.parar = null; }
    await fb.auth.signOut(fb.au);
    await fb.fs.terminate(fb.db);
    await fb.fs.clearIndexedDbPersistence(fb.db);          // não deixa dados de saúde guardados neste aparelho
  } catch (e) { console.warn('sair', e); }
  history.replaceState(null, '', location.pathname);
  location.reload();
}

/* ───────── Cadastro ───────── */
function rascunhoNovo() {
  return {
    nome: '', sexo: 'M', nascimento: '', altura: '', peso: '', objetivo: 'auto', nivel: 1, dias: 3, rotina: 'sedentaria', enfase: 'equilibrado',
    equip: TODOS_EQUIP.slice(), restricoes: [], dieta: 'tradicional', refeicoes: 4,
    bio: { gordura: '', visceral: '', musculo: '', tmb: '' }
  };
}
function campo(rotulo, chave, o) {
  o = o || {};
  const r = ui.rascunho;
  const valor = chave.startsWith('bio.') ? r.bio[chave.slice(4)] : r[chave];
  const erro = ui.erros[chave];
  const entrada = `<input class="entrada ${erro ? 'invalida' : ''}" data-r="${chave}" type="${o.tipo || 'text'}" ${o.tipo === 'date' ? '' : `inputmode="${o.modo || 'decimal'}"`} value="${esc(valor)}" placeholder="${esc(o.exemplo || '')}" ${o.max ? `max="${o.max}"` : ''} autocomplete="off">`;
  return `<label class="campo"><span>${rotulo}</span>${o.un ? `<div class="com-unidade">${entrada}<i>${o.un}</i></div>` : entrada}
    ${erro ? `<small class="erro">${erro}</small>` : o.ajuda ? `<small>${o.ajuda}</small>` : ''}</label>`;
}
const opcao = (chave, valor, titulo, texto) => `<button type="button" class="opcao ${String(ui.rascunho[chave]) === String(valor) ? 'ativo' : ''}" data-acao="escolher" data-campo="${chave}" data-valor="${valor}"><b>${titulo}</b>${texto ? `<span>${texto}</span>` : ''}</button>`;
const chipR = (chave, valor, texto) => `<button type="button" class="chip ${String(ui.rascunho[chave]) === String(valor) ? 'ativo' : ''}" data-acao="escolher" data-campo="${chave}" data-valor="${valor}">${texto}</button>`;
const marcar = (chave, valor, texto) => `<button type="button" class="marcar ${ui.rascunho[chave].includes(valor) ? 'ativo' : ''}" data-acao="alternar" data-campo="${chave}" data-valor="${valor}"><span class="caixa">${ic('check', 'p')}</span>${texto}</button>`;

function viewCadastro() {
  if (!ui.rascunho) ui.rascunho = estado.perfil ? JSON.parse(JSON.stringify(estado.perfil)) : rascunhoNovo();
  const r = ui.rascunho, p = ui.passo;
  const pesoR = num(r.peso), alturaR = num(r.altura), imcRascunho = pesoR && alturaR ? pesoR / Math.pow(alturaR / 100, 2) : null;
  const titulos = ['Sobre você', 'Bioimpedância', 'Objetivo e rotina', 'Equipamentos e cuidados'];
  let corpo = '';
  if (p === 1) {
    corpo = `
      <p class="suave">Esses dados são a base de todos os cálculos: gasto calórico, composição corporal e cargas de treino.</p>
      <div class="bloco"><div class="grade-campos">
        ${campo('Como quer ser chamado?', 'nome', { modo: 'text', exemplo: 'Seu nome' })}
        ${campo('Data de nascimento', 'nascimento', { tipo: 'date', max: hojeISO() })}
      </div></div>
      <div class="bloco"><h3>Sexo biológico</h3><div class="chips">${chipR('sexo', 'M', 'Masculino')}${chipR('sexo', 'F', 'Feminino')}</div>
        <small class="suave">Usado nas fórmulas de metabolismo e nas faixas de referência de gordura.</small></div>
      <div class="bloco"><div class="grade-campos">
        ${campo('Altura', 'altura', { un: 'cm', exemplo: '175', modo: 'numeric' })}
        ${campo('Peso atual', 'peso', { un: 'kg', exemplo: '80,5' })}
      </div></div>`;
  } else if (p === 2) {
    corpo = `
      <p class="suave">Copie os números que a balança de bioimpedância mostra (a ordem é a mesma das balanças Omron). Tudo aqui é opcional: preencha o que tiver e deixe o resto em branco.</p>
      <div class="bloco"><div class="grade-campos">
        ${campo('Gordura corporal', 'bio.gordura', { un: '%', exemplo: '22,5', ajuda: 'O dado mais importante da medição.' })}
        ${campo('Gordura abdominal (visceral)', 'bio.visceral', { un: 'nível', exemplo: '8', modo: 'numeric', ajuda: 'Nível de 1 a 30 mostrado pela balança.' })}
        ${campo('Músculo esquelético', 'bio.musculo', { un: '%', exemplo: '34,0', ajuda: 'Percentual do peso, como aparece na balança.' })}
        ${campo('Metabolismo em repouso', 'bio.tmb', { un: 'kcal', exemplo: '1750', modo: 'numeric', ajuda: 'Se não tiver, eu calculo.' })}
        <label class="campo"><span>IMC</span><div class="com-unidade"><input class="entrada calculado" value="${imcRascunho === null ? '–' : n1(imcRascunho)}" readonly tabindex="-1" aria-describedby="imc-ajuda"><i>kg/m²</i></div>
          <small id="imc-ajuda">Calculado com o peso e a altura do passo anterior. É o mesmo número da balança.</small></label>
      </div></div>`;
  } else if (p === 3) {
    const a = analisar(r);
    corpo = `
      <div class="bloco"><h3>Qual é o seu objetivo?</h3><div class="opcoes">
        ${opcao('objetivo', 'auto', 'Recomendado para mim', `Pelos seus números: ${OBJETIVOS[a.objetivoRecomendado].nome.toLowerCase()}`)}
        ${Object.keys(OBJETIVOS).map(k => opcao('objetivo', k, OBJETIVOS[k].nome, OBJETIVOS[k].resumo)).join('')}
      </div><small class="suave">${esc(a.motivoObjetivo)}</small></div>
      <div class="bloco"><h3>Experiência com musculação</h3><div class="opcoes">
        ${opcao('nivel', 1, 'Iniciante', 'Nunca treinei ou treino há menos de 6 meses')}
        ${opcao('nivel', 2, 'Intermediário', 'Treino com regularidade há 6 meses a 2 anos')}
        ${opcao('nivel', 3, 'Avançado', 'Mais de 2 anos de treino consistente')}
      </div></div>
      <div class="bloco"><h3>Quantos dias por semana você consegue treinar?</h3><div class="chips">
        ${[2, 3, 4, 5, 6].map(d => chipR('dias', d, d + ' dias')).join('')}</div>
        <small class="suave">${descreverDivisao(r)}.</small></div>
      <div class="bloco"><h3>Como é o seu dia fora do treino?</h3>
        <select class="entrada" data-r="rotina">${Object.keys(ROTINAS).map(k => `<option value="${k}" ${r.rotina === k ? 'selected' : ''}>${ROTINAS[k].nome}</option>`).join('')}</select></div>
      <div class="bloco"><h3>Quer dar ênfase a alguma região?</h3><div class="chips">
        ${chipR('enfase', 'equilibrado', 'Corpo equilibrado')}${chipR('enfase', 'gluteos', 'Pernas e glúteos')}${chipR('enfase', 'superiores', 'Tronco e braços')}</div></div>`;
  } else {
    corpo = `
      <div class="bloco"><h3>Onde você treina?</h3><div class="chips">
        <button type="button" class="chip" data-acao="local" data-valor="academia">Academia completa</button>
        <button type="button" class="chip" data-acao="local" data-valor="casa">Em casa com halteres</button>
        <button type="button" class="chip" data-acao="local" data-valor="corpo">Só peso do corpo</button></div>
        <small class="suave">Marque o que você tem à disposição. Só entram na ficha exercícios que você consegue fazer.</small>
        <div class="opcoes">${TODOS_EQUIP.map(k => marcar('equip', k, EQUIPAMENTOS[k])).join('')}</div></div>
      <div class="bloco"><h3>Tem dor ou lesão em alguma região?</h3>
        <div class="opcoes">${Object.keys(RESTRICOES).map(k => marcar('restricoes', k, RESTRICOES[k])).join('')}</div>
        <small class="suave">Exercícios que sobrecarregam a região marcada ficam fora da ficha e aparecem com aviso na biblioteca.</small></div>
      <div class="bloco"><h3>Alimentação</h3><div class="chips">${chipR('dieta', 'tradicional', 'Como de tudo')}${chipR('dieta', 'vegetariana', 'Vegetariana')}</div>
        <div class="chips">${[3, 4, 5, 6].map(d => chipR('refeicoes', d, d + ' refeições por dia')).join('')}</div></div>`;
  }
  return `<div class="cadastro">
    <div class="logo"><span class="logo-marca">${ic('exercicios')}</span>BioFicha</div>
    <p class="suave pequeno">${estado.perfil ? 'Editar cadastro' : 'Cadastro'} · passo ${p} de 4</p>
    <h1>${titulos[p - 1]}</h1>
    <div class="passos">${[1, 2, 3, 4].map(i => `<i class="${i <= p ? 'feito' : ''}"></i>`).join('')}</div>
    ${corpo}
    <div class="rodape-passos">
      ${p > 1 ? '<button class="btn" data-acao="passo" data-valor="-1">Voltar</button>' : estado.perfil ? '<button class="btn" data-acao="cancelar-edicao">Cancelar</button>' : '<span></span>'}
      <button class="btn primario grande" data-acao="passo" data-valor="1">${p < 4 ? 'Continuar' : estado.perfil ? 'Salvar alterações' : 'Montar meu plano'}</button>
    </div></div>`;
}

function validarPasso(p) {
  const r = ui.rascunho, e = {};
  const faixa = (chave, min, max, msg, obrig) => {
    const bruto = chave.startsWith('bio.') ? r.bio[chave.slice(4)] : r[chave];
    const v = num(bruto);
    if (bruto === '' || bruto == null) { if (obrig) e[chave] = 'Preencha este campo.'; return; }
    if (v === null || v < min || v > max) e[chave] = msg;
  };
  if (p === 1) {
    const idade = calcularIdade(r.nascimento);
    if (!r.nascimento) e.nascimento = 'Informe sua data de nascimento.';
    else if (idade === null || idade < 12 || idade > 100) e.nascimento = 'Confira a data: a idade precisa estar entre 12 e 100 anos.';
    faixa('altura', 120, 230, 'Informe a altura em centímetros, entre 120 e 230.', true);
    faixa('peso', 30, 300, 'Informe o peso em kg, entre 30 e 300.', true);
  }
  if (p === 2) {
    faixa('bio.gordura', 3, 65, 'A gordura corporal costuma ficar entre 3% e 65%.');
    faixa('bio.visceral', 1, 30, 'O nível de gordura abdominal vai de 1 a 30.');
    faixa('bio.musculo', 5, 60, 'O músculo esquelético é um percentual do peso, entre 5% e 60%.');
    faixa('bio.tmb', 800, 4000, 'O metabolismo em repouso costuma ficar entre 800 e 4000 kcal.');
  }
  ui.erros = e;
  return !Object.keys(e).length;
}

function concluirCadastro() {
  const r = ui.rascunho, antigo = estado.perfil;
  ['altura', 'peso'].forEach(k => { r[k] = num(r[k]); });
  ['nivel', 'dias', 'refeicoes'].forEach(k => { r[k] = parseInt(r[k], 10); });
  Object.keys(r.bio).forEach(k => { const v = num(r.bio[k]); r.bio[k] = v === null ? '' : v; });
  r.nome = String(r.nome || '').trim();
  if (antigo && r.planoAjuste && antigo.objetivo !== r.objetivo) { delete r.planoAjuste; estado.planoDesde = hojeISO(); }   // objetivo novo, metas novas
  estado.perfil = r;
  const a = analise();
  const mudouTreino = !antigo || ['nivel', 'dias', 'enfase', 'objetivo'].some(k => antigo[k] !== r[k]) ||
    JSON.stringify([antigo.equip, antigo.restricoes]) !== JSON.stringify([r.equip, r.restricoes]);
  if (!antigo) {
    estado.ficha = gerarFicha(r, a.objetivo);
    estado.medidas = [medidaDoPerfil(r, hojeISO())];
    estado.planoDesde = hojeISO();
  } else {
    const ultima = estado.medidas[estado.medidas.length - 1];
    const nova = medidaDoPerfil(r, hojeISO());
    if (!ultima || CAMPOS_MEDIDA.some(k => ultima[k] !== nova[k])) registrarMedida(nova);
    if (mudouTreino && confirm('Seu perfil de treino mudou. Quer que eu monte uma nova ficha recomendada?\n\nA ficha atual será substituída.'))
      estado.ficha = gerarFicha(r, a.objetivo);
  }
  ui.editando = false; ui.rascunho = null; ui.passo = 1; ui.dia = null;
  salvar();
  location.hash = '#/painel';
  render(); window.scrollTo(0, 0);
  toast(antigo ? 'Cadastro atualizado.' : 'Plano montado. Bom treino!');
}
const CAMPOS_MEDIDA = ['peso', 'gordura', 'visceral', 'musculo', 'tmb'];
function medidaDoPerfil(p, data) {
  const v = k => { const x = num(p.bio[k]); return x === null ? null : x; };
  return { data, peso: num(p.peso), gordura: v('gordura'), visceral: v('visceral'), musculo: v('musculo'), tmb: v('tmb') };
}
function registrarMedida(m) {
  estado.medidas = estado.medidas.filter(x => x.data !== m.data).concat([m]).sort((a, b) => a.data.localeCompare(b.data));
}

/* ───────── Painel ───────── */
const selo = (classe, texto) => `<span class="selo ${classe}">${esc(texto)}</span>`;
function tile(rot, val, un, sub) {
  return `<div class="tile"><span class="rot">${rot}</span><span class="val">${val}${un ? ` <small>${un}</small>` : ''}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</div>`;
}
function escalaGordura(a) {
  const fs = a.faixas, idx = fs.indexOf(a.gorduraClasse);
  const ini = idx === 0 ? 0 : fs[idx - 1].ate, fim = fs[idx].ate;
  const dentro = Math.min(1, Math.max(0, (a.gordura - ini) / (fim - ini)));
  const pos = (idx + dentro) / fs.length * 100;
  return `<div class="escala"><div class="trilho">${fs.map((f, i) => `<div class="zona ${i === idx ? 'atual' : ''}"></div>`).join('')}
      <span class="pino" style="left:${Math.min(96, Math.max(4, pos)).toFixed(1)}%">${n1(a.gordura)}%</span></div>
    <div class="nomes">${fs.map((f, i) => `<span><b>${f.rotulo}</b>${i === 0 ? 'até ' + f.ate + '%' : i === fs.length - 1 ? fs[i - 1].ate + '% ou mais' : fs[i - 1].ate + '–' + f.ate + '%'}</span>`).join('')}</div></div>`;
}
function proximoDia() {
  const ds = estado.ficha.dias;
  const ult = estado.sessoes[estado.sessoes.length - 1];
  if (estado.sessao) return ds.find(d => d.id === estado.sessao.dia) || ds[0];
  const i = ult ? ds.findIndex(d => d.id === ult.dia) : -1;
  return ds[(i + 1) % ds.length];
}

function viewPainel() {
  const p = estado.perfil, a = analise(), plano = planoAlimentar(p, a);
  const pctMagra = 100 - a.gordura;
  const prox = estado.ficha && estado.ficha.dias.length ? proximoDia() : null;
  const escolhido = OBJETIVOS[p.objetivo] ? p.objetivo : null;
  const semana = estado.sessoes.filter(s => (Date.now() - new Date(s.data + 'T12:00:00')) / 864e5 < 7).length;
  const iconePonto = { bom: 'check', atencao: 'alerta', alerta: 'alerta', info: 'info' };
  return `
    <div class="cabecalho"><div><h1>Olá${p.nome ? ', ' + esc(p.nome.split(' ')[0]) : ''}</h1>
      <p class="suave">${a.idade} anos · ${n0(a.alturaCm)} cm · ${n1(a.peso)} kg · objetivo: ${OBJETIVOS[a.objetivo].nome.toLowerCase()}</p></div>
      <div class="acoes"><a class="btn" href="#/evolucao">${ic('mais', 'p')}Nova medição</a></div></div>

    <div class="tres">
      <div class="card destaque">
        <p class="pequeno suave">${escolhido && escolhido !== a.objetivoRecomendado ? 'Recomendação pelos seus números' : 'Seu plano'}</p>
        <h2 style="font-size:22px;margin:2px 0 8px">${OBJETIVOS[a.objetivoRecomendado].nome}</h2>
        <p>${esc(a.motivoObjetivo)}</p>
        ${escolhido && escolhido !== a.objetivoRecomendado ? `<p class="pequeno" style="margin-top:10px">Você escolheu <b>${OBJETIVOS[escolhido].nome.toLowerCase()}</b>, e o plano segue a sua escolha. <button class="btn" style="margin-top:8px" data-acao="usar-recomendado">Usar o recomendado</button></p>` : ''}
      </div>
      <div class="card">
        <p class="pequeno suave">${estado.sessao ? 'Treino em andamento' : 'Próximo treino'} · ${semana} ${semana === 1 ? 'treino' : 'treinos'} nos últimos 7 dias</p>
        ${prox ? `<h2 style="font-size:22px;margin:2px 0 4px">${esc(prox.nome)} · ${esc(prox.titulo || '')}</h2>
          <p class="suave">${prox.itens.length} exercícios${prox.foco ? ' · ' + esc(prox.foco) : ''}</p>
          <div class="acoes" style="margin-top:14px"><button class="btn primario" data-acao="ir-treino" data-valor="${prox.id}">${ic('play', 'p')}${estado.sessao ? 'Continuar treino' : 'Iniciar treino'}</button>
          <span class="pequeno suave">Meta de hoje: ${n0(plano.kcal)} kcal · ${plano.proteina} g de proteína</span></div>`
        : '<p class="suave">Sua ficha está vazia. Monte uma em Minha ficha.</p>'}
      </div>
      ${cartaoSemana()}
    </div>

    <div class="secao"><h2>Seus números</h2>
      <div class="tiles equilibrado" style="--colunas:${Math.ceil((5 + (a.visceral !== null ? 1 : 0) + (a.musculo !== null ? 1 : 0)) / 2)}">
        ${tile('Gordura corporal' + (a.gorduraMedida ? '' : ' (estimada)'), n1(a.gordura), '%', selo(a.gorduraClasse.nivel, a.gorduraClasse.rotulo))}
        ${a.visceral !== null ? tile('Gordura abdominal', n0(a.visceral), 'nível', selo(a.visceralClasse.nivel, a.visceralClasse.rotulo)) : ''}
        ${a.musculo !== null ? tile('Músculo esquelético', n1(a.musculo), '%', selo(a.musculoClasse.nivel, a.musculoClasse.rotulo)) : ''}
        ${tile('Metabolismo em repouso', n0(a.tmb), 'kcal', `<span class="mini suave">${a.tmbFonte}</span>`)}
        ${tile('IMC', n1(a.imc), '', selo(a.imcClasse.nivel, a.imcClasse.rotulo))}
        ${tile('Massa magra', n1(a.massaMagra), 'kg', `<span class="mini suave">FFMI ${n1(a.ffmi)}</span>`)}
        ${tile('Gasto diário', n0(a.gastoDiario), 'kcal', `<span class="mini suave">com ${a.dias} treinos por semana</span>`)}
      </div>
    </div>

    ${secaoFrequencia()}

    <div class="secao duas">
      <div class="card"><h2>Composição corporal</h2>
        <div class="composicao" role="img" aria-label="Massa magra ${n1(pctMagra)}%, gordura ${n1(a.gordura)}%">
          <div class="magra" style="width:${pctMagra}%">${n0(pctMagra)}%</div>
          <div class="gorda" style="width:${a.gordura}%">${a.gordura >= 12 ? n0(a.gordura) + '%' : ''}</div></div>
        <div class="legenda"><span><i style="background:var(--dado-magra)"></i>Massa magra · ${n1(a.massaMagra)} kg</span><span><i style="background:var(--dado-gordura)"></i>Gordura · ${n1(a.massaGorda)} kg</span></div>
        <h3 style="margin-top:22px">Onde você está na faixa de gordura</h3>
        ${escalaGordura(a)}
        <p class="mini suave" style="margin-top:12px">Faixas de referência para ${a.sexo === 'F' ? 'mulheres' : 'homens'} de ${a.idade < 40 ? 'até 39' : a.idade < 60 ? '40 a 59' : '60 ou mais'} anos, as mesmas das balanças Omron.</p>
      </div>
      <div class="card"><h2>O que seus números dizem</h2>
        <ul class="pontos">${a.pontos.map(x => `<li class="${x.tipo}"><span class="marca-p">${ic(iconePonto[x.tipo], 'p')}</span><span>${esc(x.texto)}</span></li>`).join('')}</ul>
      </div>
    </div>
    <p class="aviso secao">Este site dá orientações gerais com base em fórmulas reconhecidas. Ele não substitui avaliação de médico, nutricionista ou profissional de educação física, principalmente se você tem alguma condição de saúde, lesão ou está grávida.</p>`;
}

/* ───────── Ficha ───────── */
function viewFicha() {
  const f = estado.ficha, p = estado.perfil;
  if (!f || !f.dias.length) {
    return `<div class="cabecalho"><div><h1>Minha ficha</h1></div></div>
      <div class="vazio"><p>Você ainda não tem treinos.</p><div class="acoes" style="justify-content:center;margin-top:14px">
      <button class="btn primario" data-acao="gerar-ficha">Montar ficha recomendada</button><button class="btn" data-acao="novo-dia">Criar treino vazio</button></div></div>`;
  }
  const dia = diaAtual(), s = estado.sessao && estado.sessao.dia === dia.id ? estado.sessao : null;
  const outroEmCurso = estado.sessao && !s;
  const total = dia.itens.reduce((t, i) => t + (parseInt(i.series, 10) || 1), 0);
  const feitas = s ? dia.itens.reduce((t, i) => t + Math.min(s.feitas[i.ex] || 0, parseInt(i.series, 10) || 1), 0) : 0;
  const exFeitos = s ? dia.itens.filter(i => (s.feitas[i.ex] || 0) >= (parseInt(i.series, 10) || 1)).length : 0;
  const naSemana = treinosDaSemana();

  const itens = dia.itens.map((it, idx) => {
    const ex = exDe(it.ex); if (!ex) return '';
    const nSeries = parseInt(it.series, 10) || 1, ok = s ? (s.feitas[it.ex] || 0) : 0;
    const av = avaliarExercicio(ex, p);
    const cardio = ex.padrao === 'cardio';
    return `<div class="item ${s && ok >= nSeries ? 'feito' : ''}">
      <button class="abre" data-acao="ver" data-valor="${ex.id}" aria-label="Ver ${esc(ex.nome)}">${anim(ex.id, true)}</button>
      <div class="info">
        <button class="nome" data-acao="ver" data-valor="${ex.id}">${esc(ex.nome)}</button>
        <div class="acoes mini suave" style="gap:6px"><span>${GRUPOS[ex.grupo]}</span>${av.status === 'atencao' || av.status === 'sem_equip' ? selo(av.status === 'atencao' ? 'atencao' : '', av.rotulo) : ''}</div>
        ${s ? `<div class="series">${Array.from({ length: nSeries }, (_, i) => `<button class="serie ${i < ok ? 'feita' : ''}" data-acao="serie" data-ex="${ex.id}" data-valor="${i + 1}" aria-label="Série ${i + 1}${i < ok ? ' feita' : ''}">${i < ok ? ic('check', 'p') : i + 1}</button>`).join('')}
            <span class="pequeno suave">${esc(it.reps)}${cardio ? '' : ' reps'}${it.descanso ? ' · descanso ' + it.descanso + ' s' : ''}</span></div>
          <button class="btn concluir-ex ${ok >= nSeries ? 'feito' : ''}" data-acao="concluir-ex" data-ex="${ex.id}">${ic('check', 'p')}${ok >= nSeries ? 'Concluído' : 'Concluir exercício'}</button>` : ''}
        <div class="param">
          ${s ? '' : `<label>Séries<input data-item="${idx}" data-prop="series" inputmode="numeric" value="${esc(it.series)}" aria-label="Séries"></label>
          <label>${cardio ? 'Tempo' : 'Repetições'}<input class="largo" data-item="${idx}" data-prop="reps" value="${esc(it.reps)}" aria-label="Repetições"></label>
          ${cardio ? '' : `<label>Descanso (s)<input data-item="${idx}" data-prop="descanso" inputmode="numeric" value="${esc(it.descanso)}" aria-label="Descanso em segundos"></label>`}`}
          ${cardio ? '' : `<label>Carga (kg)<input data-item="${idx}" data-prop="carga" inputmode="decimal" value="${esc(it.carga)}" placeholder="–" aria-label="Carga em kg"></label>`}
        </div>
      </div>
      <div class="lado">
        <button class="btn icone" data-acao="trocar" data-valor="${idx}" title="Trocar por outro exercício" aria-label="Trocar exercício">${ic('trocar')}</button>
        <button class="btn icone" data-acao="mover" data-valor="${idx}" data-dir="-1" title="Subir" aria-label="Subir" ${idx === 0 ? 'disabled' : ''}>${ic('cima')}</button>
        <button class="btn icone" data-acao="mover" data-valor="${idx}" data-dir="1" title="Descer" aria-label="Descer" ${idx === dia.itens.length - 1 ? 'disabled' : ''}>${ic('baixo')}</button>
        <button class="btn icone" data-acao="remover" data-valor="${idx}" title="Remover da ficha" aria-label="Remover">${ic('lixo')}</button>
      </div></div>`;
  }).join('');

  const impressao = f.dias.map(d => `<h2>${esc(d.nome)}${d.titulo ? ' · ' + esc(d.titulo) : ''}</h2>
    <table><tr><th>Exercício</th><th>Séries</th><th>Repetições</th><th>Descanso</th><th>Carga</th></tr>
    ${d.itens.map(i => { const e = exDe(i.ex); return e ? `<tr><td>${esc(e.nome)}</td><td>${esc(i.series)}</td><td>${esc(i.reps)}</td><td>${i.descanso ? esc(i.descanso) + ' s' : ''}</td><td>${esc(i.carga)}</td></tr>` : ''; }).join('')}</table>`).join('');

  return `
    <div class="cabecalho"><div><h1>Minha ficha</h1><p class="suave">${f.dias.length} ${f.dias.length === 1 ? 'treino' : 'treinos'} · objetivo: ${OBJETIVOS[analise().objetivo].nome.toLowerCase()}</p></div>
      <div class="acoes"><button class="btn" data-acao="gerar-ficha">${ic('raio', 'p')}Montar ficha recomendada</button>
      <button class="btn" data-acao="imprimir">${ic('imprimir', 'p')}Imprimir</button></div></div>
    <div class="abas">${f.dias.map(d => `<button class="aba ${d.id === dia.id ? 'ativo' : ''} ${naSemana.has(d.id) ? 'feita' : ''}" data-acao="dia" data-valor="${d.id}"><b>${esc(d.nome)}${naSemana.has(d.id) ? ic('check', 'p') : ''}</b><span>${naSemana.has(d.id) ? 'Feito esta semana' : esc(d.titulo || d.itens.length + ' exercícios')}</span></button>`).join('')}
      ${f.dias.length < 7 ? `<button class="aba" data-acao="novo-dia"><b>${ic('mais', 'p')}</b><span>Novo treino</span></button>` : ''}</div>
    <div class="dia-tela">
      ${s ? `<div class="treinando"><div class="cabecalho" style="margin:0"><div><h2>${esc(dia.nome)} em andamento</h2><p class="suave pequeno">${exFeitos} de ${dia.itens.length} exercícios · ${feitas} de ${total} séries. Toque na série ao terminar, ou conclua o exercício inteiro.</p></div>
          <div class="acoes"><button class="btn" data-acao="cancelar-treino">Cancelar</button><button class="btn primario ${exFeitos === dia.itens.length ? 'pronto' : ''}" data-acao="concluir-treino">${ic('check', 'p')}Concluir treino</button></div></div>
          <div class="progresso"><i style="width:${total ? feitas / total * 100 : 0}%"></i></div></div>`
      : `<div class="cabecalho" style="margin-bottom:14px"><div><h2>${esc(dia.titulo || dia.nome)}</h2>${dia.foco ? `<p class="suave pequeno">${esc(dia.foco)}</p>` : ''}</div>
          <div class="acoes"><button class="btn perigo" data-acao="excluir-dia">Excluir treino</button>
          <button class="btn primario" data-acao="iniciar-treino" ${dia.itens.length && !outroEmCurso ? '' : 'disabled'}>${ic('play', 'p')}Iniciar treino</button></div></div>
          ${outroEmCurso ? '<p class="aviso" style="margin-bottom:12px">Há outro treino em andamento. Conclua ou cancele antes de iniciar este.</p>' : ''}`}
      <div class="pilha" style="gap:10px">${itens || '<div class="vazio">Nenhum exercício neste treino ainda.</div>'}</div>
      ${s ? '' : `<div class="acoes" style="margin-top:14px"><a class="btn" href="#/exercicios">${ic('mais', 'p')}Adicionar exercícios da biblioteca</a></div>
      <p class="aviso" style="margin-top:18px">Escolha uma carga com a qual você termine cada série sentindo que ainda faria 1 ou 2 repetições. Quando passar do topo da faixa de repetições em todas as séries, aumente a carga.</p>`}
    </div>
    <div class="so-impressao"><h1>Ficha de treino${p.nome ? ' · ' + esc(p.nome) : ''}</h1>${impressao}</div>`;
}

/* ───────── Biblioteca de exercícios ───────── */
const ROTULO_CURTO = { indicado: 'Indicado', atencao: 'Atenção', avancado: 'Avançado', sem_equip: 'Sem equipamento' };
function exerciciosFiltrados() {
  const f = ui.filtro, p = estado.perfil;
  const semAcento = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const busca = semAcento(f.busca.trim());
  return EXERCICIOS.map(ex => ({ ex, av: avaliarExercicio(ex, p) })).filter(({ ex, av }) =>
    (f.grupo === 'todos' || (f.grupo === 'ficha' ? diasCom(ex.id).length : ex.grupo === f.grupo)) &&
    (f.equip === 'todos' || ex.equip === f.equip) &&
    (!f.soIndicados || av.status === 'indicado' || f.grupo === 'ficha') &&
    (!busca || semAcento(ex.nome + ' ' + GRUPOS[ex.grupo]).includes(busca)));
}
function gradeExercicios() {
  const lista = exerciciosFiltrados();
  if (!lista.length) return '<div class="vazio">Nenhum exercício com esses filtros. Tente desligar "Só indicados para mim" ou limpar a busca.</div>';
  return `<p class="pequeno suave" style="margin-bottom:10px">${lista.length} ${lista.length === 1 ? 'exercício' : 'exercícios'}</p><div class="grade">` + lista.map(({ ex, av }) => {
    const dias = diasCom(ex.id);
    return `<div class="ex-card ${dias.length ? 'na-ficha' : ''}">
      <button class="abre" data-acao="ver" data-valor="${ex.id}" aria-label="Ver ${esc(ex.nome)}">${anim(ex.id, false)}
        <div class="corpo"><span class="nome">${esc(ex.nome)}</span><span class="mini suave">${GRUPOS[ex.grupo]} · ${EQUIPAMENTOS[ex.equip]}</span></div></button>
      <div class="pe">${selo(av.status, ROTULO_CURTO[av.status])}
        <button class="flag ${dias.length ? 'ativo' : ''}" data-acao="flag" data-valor="${ex.id}" aria-label="${dias.length ? 'Na ficha' : 'Adicionar à ficha'}"><span class="caixa">${ic('check', 'p')}</span>${dias.length ? (dias.length === 1 ? 'Treino ' : '') + dias.join(', ') : 'Ficha'}</button></div></div>`;
  }).join('') + '</div>';
}
function viewExercicios() {
  const f = ui.filtro;
  const chip = (v, t) => `<button class="chip ${f.grupo === v ? 'ativo' : ''}" data-acao="filtro-grupo" data-valor="${v}">${t}</button>`;
  return `
    <div class="cabecalho"><div><h1>Exercícios</h1><p class="suave">Marque a caixa para colocar o exercício na sua ficha. Clique na foto para ver a execução.</p></div></div>
    <div class="filtros">
      <div class="linha-filtros">
        <input class="entrada" id="busca" type="search" placeholder="Buscar exercício…" value="${esc(f.busca)}" aria-label="Buscar exercício">
        <select class="entrada" id="filtro-equip" aria-label="Equipamento"><option value="todos">Todos os equipamentos</option>
          ${Object.keys(EQUIPAMENTOS).map(k => `<option value="${k}" ${f.equip === k ? 'selected' : ''}>${EQUIPAMENTOS[k]}</option>`).join('')}</select>
        <button class="flag ${f.soIndicados ? 'ativo' : ''}" data-acao="filtro-indicados"><span class="caixa">${ic('check', 'p')}</span>Só indicados para mim</button>
      </div>
      <div class="chips rolar">${chip('todos', 'Todos')}${chip('ficha', 'Na minha ficha')}${Object.keys(GRUPOS).map(k => chip(k, GRUPOS[k])).join('')}</div>
    </div>
    <div id="grade">${gradeExercicios()}</div>`;
}

/* ───────── Janelas ───────── */
function abrirModal(html, estreito) {
  const m = $('#modal');
  m.innerHTML = `<div class="fundo-modal" data-acao="fechar-modal"><div class="modal ${estreito ? 'estreito' : ''}" role="dialog" aria-modal="true">${html}</div></div>`;
  m.hidden = false; document.body.style.overflow = 'hidden';
}
function fecharModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; document.body.style.overflow = ''; ui.modalEx = null; }
const topoModal = titulo => `<header><h2 style="font-size:20px">${titulo}</h2><button class="btn icone" data-acao="fechar-modal" data-forcar="1" aria-label="Fechar">${ic('x')}</button></header>`;
const chipsDias = exId => `<div class="chips">${estado.ficha.dias.map(d => `<button class="flag ${d.itens.some(i => i.ex === exId) ? 'ativo' : ''}" data-acao="flag-dia" data-ex="${exId}" data-valor="${d.id}"><span class="caixa">${ic('check', 'p')}</span>${esc(d.nome)}</button>`).join('')}</div>`;

function modalExercicio(id) {
  const ex = exDe(id), av = avaliarExercicio(ex, estado.perfil), mus = MUSCULOS[id] || [[], []];
  ui.modalEx = id;
  const video = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(ex.nome + ' execução correta');
  abrirModal(`${topoModal(esc(ex.nome))}
    <div class="miolo">
      ${anim(id, true)}
      <div class="chips">${selo('', GRUPOS[ex.grupo])}${selo('', EQUIPAMENTOS[ex.equip])}${selo('', NIVEIS[ex.nivel])}${selo('', ex.tipo === 'C' ? 'Multiarticular' : 'Isolado')}</div>
      <div class="status-ex ${av.status}"><b>${av.rotulo}</b><span>${esc(av.motivo)}</span></div>
      <div><h3>Como fazer</h3><p style="margin-top:4px">${esc(ex.como)}</p><p class="suave" style="margin-top:6px"><b>Dica:</b> ${esc(ex.dica)}</p></div>
      ${mus[0].length ? `<div><h3>Músculos trabalhados</h3><p style="margin-top:4px">${mus[0].join(', ')}${mus[1].length ? `<span class="suave"> · auxiliares: ${mus[1].join(', ').toLowerCase()}</span>` : ''}</p></div>` : ''}
      <div><a class="btn" href="${video}" target="_blank" rel="noopener">${ic('video', 'p')}Ver vídeos da execução no YouTube</a></div>
      ${estado.ficha && estado.ficha.dias.length ? `<div><h3 style="margin-bottom:8px">Na minha ficha</h3>${chipsDias(id)}</div>` : ''}
    </div>`);
}
function modalDias(id) {
  ui.modalEx = null;
  abrirModal(`${topoModal('Em quais treinos?')}<div class="miolo"><p class="suave">${esc(exDe(id).nome)}</p>${chipsDias(id)}
    <button class="btn primario" data-acao="fechar-modal" data-forcar="1">Pronto</button></div>`, true);
  ui.modalDias = id;
}
function modalTrocar(idx) {
  const dia = diaAtual(), atual = dia.itens[idx];
  const alts = alternativas(atual.ex, estado.perfil, new Set(dia.itens.map(i => i.ex)));
  abrirModal(`${topoModal('Trocar exercício')}<div class="miolo"><p class="suave">Opções que trabalham o mesmo movimento de <b>${esc(exDe(atual.ex).nome)}</b>.</p>
    ${alts.length ? alts.map(({ ex, av }) => `<button class="alt" data-acao="trocar-por" data-valor="${ex.id}" data-idx="${idx}">${anim(ex.id, true)}<span><b>${esc(ex.nome)}</b><br><span class="mini suave">${EQUIPAMENTOS[ex.equip]}</span><br>${selo(av.status, av.rotulo)}</span></button>`).join('')
      : '<div class="vazio">Não há outra opção compatível com seus equipamentos para este movimento.</div>'}</div>`);
}

/* ───────── Alimentação ───────── */
function viewAlimentacao() {
  const p = estado.perfil, a = analise(), pl = planoAlimentar(p, a);
  const pct = g => Math.round(g / pl.kcal * 100);
  const ajusteTxt = pl.ajuste === 0 ? 'igual ao seu gasto diário, para manter o peso'
    : `${n0(Math.abs(pl.diferenca))} kcal ${pl.diferenca < 0 ? 'abaixo' : 'acima'} do seu gasto diário de ${n0(a.gastoDiario)} kcal`;
  const ritmo = Math.abs(pl.kgSemana) < 0.05 ? 'Peso estável.' : `Ritmo esperado: cerca de ${n1(Math.abs(pl.kgSemana))} kg ${pl.kgSemana < 0 ? 'a menos' : 'a mais'} por semana.`;
  const grupo = (tit, sub, itens) => itens.length ? `<div class="grupo-ali"><div class="tit">${tit}<small>${sub}</small></div><ul>${itens.map((t, i) => `<li class="${i ? 'ou' : ''}">${esc(t)}</li>`).join('')}</ul></div>` : '';
  const ref = r => `<div class="card refeicao"><h3>${r.nome}</h3>
    <p class="alvo mini suave">≈ ${n0(r.alvo.kcal)} kcal · ${n0(r.alvo.p)} g proteína · ${n0(r.alvo.c)} g carboidrato · ${n0(r.alvo.g)} g gordura</p>
    ${grupo('Proteína', 'escolha uma', r.prot)}${grupo('Carboidrato', 'escolha um', r.carb)}${grupo('Gordura boa', 'escolha uma', r.gord)}
    ${r.fixos.length || r.salada ? `<div class="grupo-ali"><div class="tit">Acompanha</div><ul>${r.fixos.map(t => `<li>${esc(t)}</li>`).join('')}${r.salada ? '<li>Salada e legumes à vontade</li>' : ''}</ul></div>` : ''}</div>`;
  return `
    <div class="cabecalho"><div><h1>Alimentação</h1><p class="suave">Plano para ${OBJETIVOS[pl.objetivo].nome.toLowerCase()}, ${pl.ajustado ? 'reestruturado em ' + dataBR(p.planoAjuste.desde) : 'calculado com o seu metabolismo e a sua rotina'}.</p></div></div>
    <div class="duas">
      <div class="card destaque"><p class="pequeno suave">Meta diária</p><p class="heroi">${n0(pl.kcal)} <small>kcal</small></p>
        <p style="margin-top:10px">${ajusteTxt.charAt(0).toUpperCase() + ajusteTxt.slice(1)}. ${ritmo}</p></div>
      <div class="tiles" style="grid-template-columns:repeat(auto-fit,minmax(130px,1fr))">
        ${tile('Proteína', pl.proteina, 'g', `<span class="mini suave">${pct(pl.proteina * 4)}% das calorias</span>`)}
        ${tile('Carboidrato', pl.carbo, 'g', `<span class="mini suave">${pct(pl.carbo * 4)}% das calorias</span>`)}
        ${tile('Gordura', pl.gordura, 'g', `<span class="mini suave">${pct(pl.gordura * 9)}% das calorias</span>`)}
        ${tile('Água', n1(pl.agua), 'L', '<span class="mini suave">mais 500 ml em dia de treino</span>')}
        ${tile('Fibras', pl.fibra, 'g', '<span class="mini suave">frutas, legumes e grãos</span>')}
      </div>
    </div>
    <div class="secao">${cartaoReestruturar()}</div>
    ${secaoDiario(pl)}
    <div class="secao">
      <div class="cabecalho" style="margin-bottom:12px"><h2>Refeições do dia</h2>
        <div class="acoes"><div class="chips">${[3, 4, 5, 6].map(n => `<button class="chip ${pl.refeicoes.length === n ? 'ativo' : ''}" data-acao="perfil-set" data-campo="refeicoes" data-valor="${n}">${n}</button>`).join('')}</div>
        <div class="chips"><button class="chip ${pl.veg ? '' : 'ativo'}" data-acao="perfil-set" data-campo="dieta" data-valor="tradicional">Como de tudo</button><button class="chip ${pl.veg ? 'ativo' : ''}" data-acao="perfil-set" data-campo="dieta" data-valor="vegetariana">Vegetariana</button></div></div></div>
      <div class="refeicoes">${pl.refeicoes.map(ref).join('')}</div>
      <p class="aviso" style="margin-top:14px">As quantidades são aproximadas e consideram o alimento já pronto (cozido ou grelhado), exceto aveia, goma de tapioca e proteína de soja. Em cada grupo, escolha uma opção: todas entregam mais ou menos o mesmo. Sem whey? Troque cada dose por 100 g de frango desfiado, 90 g de atum ou 3 ovos.</p>
    </div>
    <div class="secao duas">
      <div class="card"><h2>Para dar certo</h2><ul class="lista">${pl.dicas.map(d => `<li>${esc(d)}</li>`).join('')}</ul></div>
      <div class="card"><h2>Como os números foram calculados</h2><ul class="lista">
        <li>Metabolismo em repouso de ${n0(a.tmb)} kcal, ${a.tmbFonte}.</li>
        <li>Gasto diário de ${n0(a.gastoDiario)} kcal, considerando sua rotina e ${a.dias} treinos por semana.</li>
        <li>Proteína: ${n1(pl.protKg)} g por kg ${a.gorduraAlta ? `de peso de referência (${n1(pl.pesoRef)} kg, seu peso com gordura na faixa saudável)` : 'de peso corporal'}.</li>
        <li>Carboidrato completa as calorias depois da proteína e da gordura.</li></ul></div>
    </div>
    <p class="aviso secao">Orientação geral, não é prescrição de dieta. Se você tem diabetes, doença renal, alergias alimentares ou outra condição de saúde, procure um nutricionista antes de seguir.</p>`;
}

/* ───────── Evolução ───────── */
const GRAF_W = 340;
function passoLimpo(intervalo, n) {
  const bruto = intervalo / n, pot = Math.pow(10, Math.floor(Math.log10(bruto))), f = bruto / pot;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * pot;
}
function grafico(titulo, pontos, un, casas) {
  if (pontos.length < 2) {
    return `<div class="card"><h2>${titulo}</h2>${pontos.length ? `<p class="heroi" style="font-size:34px">${n1(pontos[0].v, casas)} <small>${un}</small></p>` : ''}
      <p class="suave pequeno" style="margin-top:6px">${pontos.length ? 'Registre mais uma medição para ver a evolução.' : 'Sem dados ainda.'}</p></div>`;
  }
  const W = GRAF_W, H = 190, m = { t: 14, r: 60, b: 26, l: 36 }, sep = un === '%' ? '' : ' ';
  const vs = pontos.map(p => p.v);
  let min = Math.min(...vs), max = Math.max(...vs);
  const passo = passoLimpo((max - min) || 1, 3);
  min = Math.floor(min / passo) * passo; max = Math.ceil(max / passo) * passo;
  if (min === max) max = min + passo;
  const ts = pontos.map(p => new Date(p.data + 'T12:00:00').getTime()), t0 = ts[0], t1 = ts[ts.length - 1];
  const x = i => m.l + (t1 === t0 ? 0.5 : (ts[i] - t0) / (t1 - t0)) * (W - m.l - m.r);
  const y = v => m.t + (1 - (v - min) / (max - min)) * (H - m.t - m.b);
  const dec = passo < 1 ? 1 : 0;
  let grade = '';
  for (let v = min; v <= max + passo / 1000; v += passo)
    grade += `<line class="grade-l" x1="${m.l}" x2="${W - m.r}" y1="${y(v)}" y2="${y(v)}"/><text class="eixo" x="${m.l - 8}" y="${y(v) + 4}" text-anchor="end">${n1(v, dec)}</text>`;
  const linha = pontos.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');
  const ult = pontos.length - 1, dif = pontos[ult].v - pontos[0].v;
  const dados = pontos.map((p, i) => ({ x: +x(i).toFixed(1), y: +y(p.v).toFixed(1), t: `${dataBR(p.data)} · ${n1(p.v, casas)}${sep}${un}` }));
  return `<div class="card"><h2 style="margin-bottom:2px">${titulo}</h2>
    <p class="pequeno suave" style="margin-bottom:8px">${Math.abs(dif) < 0.05 ? 'Sem mudança' : (dif > 0 ? '+' : '−') + n1(Math.abs(dif), casas) + (un === '%' ? ' pontos' : ' ' + un)} desde ${dataBR(pontos[0].data)}</p>
    <div class="grafico"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${titulo}: de ${n1(pontos[0].v, casas)} para ${n1(pontos[ult].v, casas)} ${un}" data-pontos='${JSON.stringify(dados)}'>
      ${grade}
      <text class="eixo" x="${m.l}" y="${H - 6}">${dataCurta(pontos[0].data)}</text><text class="eixo" x="${W - m.r}" y="${H - 6}" text-anchor="end">${dataCurta(pontos[ult].data)}</text>
      <line class="guia" y1="${m.t}" y2="${H - m.b}" x1="0" x2="0" visibility="hidden"/>
      <path class="serie-l" d="${linha}"/>
      ${pontos.map((p, i) => `<circle class="pt" cx="${x(i).toFixed(1)}" cy="${y(p.v).toFixed(1)}" r="${i === ult ? 5 : 4}"/>`).join('')}
      <text class="rotulo-fim" x="${x(ult) + 10}" y="${y(pontos[ult].v) + 4}">${n1(pontos[ult].v, casas)}${sep}${un}</text>
    </svg><div class="dica-graf" hidden></div></div></div>`;
}

function viewEvolucao() {
  const ms = estado.medidas, p = estado.perfil;
  const serie = k => ms.filter(x => x[k] != null).map(x => ({ data: x.data, v: x[k] }));
  const magra = ms.filter(x => x.gordura != null && x.peso != null).map(x => ({ data: x.data, v: x.peso * (1 - x.gordura / 100) }));
  const v = x => (x == null ? '–' : n1(x));
  const c = (rot, id, un, ex) => `<label class="campo"><span>${rot}</span><div class="com-unidade"><input class="entrada" id="m-${id}" inputmode="decimal" placeholder="${ex}"><i>${un}</i></div></label>`;
  return `
    <div class="cabecalho"><div><h1>Evolução</h1><p class="suave">Lance o peso e a bioimpedância toda semana. A análise e o plano se refazem com os números novos.</p></div></div>
    ${cartaoAnalise()}
    <div class="graficos secao">${grafico('Peso', serie('peso'), 'kg', 1)}${grafico('Gordura corporal', serie('gordura'), '%', 1)}${serie('musculo').length ? grafico('Músculo esquelético', serie('musculo'), '%', 1) : ''}${grafico('Massa magra', magra, 'kg', 1)}</div>

    <div class="secao card"><h2>Registrar nova medição</h2>
      <div class="grade-campos">
        <label class="campo"><span>Data</span><input class="entrada" id="m-data" type="date" value="${hojeISO()}" max="${hojeISO()}"></label>
        ${c('Peso', 'peso', 'kg', n1(p.peso))}${c('Gordura corporal', 'gordura', '%', 'opcional')}${c('Gordura abdominal', 'visceral', 'nível', 'opcional')}${c('Músculo esquelético', 'musculo', '%', 'opcional')}${c('Metabolismo em repouso', 'tmb', 'kcal', 'opcional')}
      </div>
      <div class="acoes" style="margin-top:16px"><button class="btn primario" data-acao="salvar-medida">Salvar medição</button></div>
    </div>

    <div class="secao"><h2>Histórico de medições</h2>
      <div class="card rolagem-x">${ms.length ? `<table class="tabela"><tr><th>Data</th><th>Peso (kg)</th><th>Gordura (%)</th><th>Abdominal (nível)</th><th>Músculo (%)</th><th>Repouso (kcal)</th><th>IMC</th><th>Massa magra (kg)</th><th></th></tr>
        ${ms.slice().reverse().map(x => `<tr><td>${dataBR(x.data)}</td><td>${v(x.peso)}</td><td>${v(x.gordura)}</td><td>${x.visceral == null ? '–' : n0(x.visceral)}</td><td>${v(x.musculo)}</td><td>${x.tmb == null ? '–' : n0(x.tmb)}</td><td>${x.peso != null && num(p.altura) ? n1(x.peso / Math.pow(num(p.altura) / 100, 2)) : '–'}</td><td>${x.gordura != null ? n1(x.peso * (1 - x.gordura / 100)) : '–'}</td>
          <td><button class="btn icone" data-acao="apagar-medida" data-valor="${x.data}" aria-label="Apagar medição de ${dataBR(x.data)}" title="Apagar">${ic('lixo', 'p')}</button></td></tr>`).join('')}</table>` : '<p class="suave">Nenhuma medição registrada.</p>'}</div>
    </div>

    <div class="secao"><h2>Treinos concluídos</h2>
      <div class="card rolagem-x">${estado.sessoes.length ? `<table class="tabela"><tr><th>Data</th><th>Treino</th><th>Séries feitas</th><th>Duração</th></tr>
        ${estado.sessoes.slice(-12).reverse().map(s => `<tr><td>${dataBR(s.data)}</td><td>${esc('Treino ' + s.dia + (s.titulo ? ' · ' + s.titulo : ''))}</td><td>${s.feitas} de ${s.total}</td><td>${s.minutos ? s.minutos + ' min' : '–'}</td></tr>`).join('')}</table>`
        : '<p class="suave">Quando você concluir um treino em Minha ficha, ele aparece aqui.</p>'}</div>
    </div>`;
}

/* ───────── Perfil ───────── */
function viewPerfil() {
  const p = estado.perfil, a = analise();
  const linha = (r, v) => `<tr><td class="suave">${r}</td><td><b>${v}</b></td></tr>`;
  const lista = (arr, mapa, vazio) => (arr.length ? arr.map(k => mapa[k]).join(', ') : vazio);
  return `
    <div class="cabecalho"><div><h1>Perfil</h1><p class="suave">Seus dados de cadastro e as opções de cópia de segurança.</p></div>
      <div class="acoes"><button class="btn primario" data-acao="editar-cadastro">Editar cadastro</button></div></div>
    <div class="duas">
      <div class="card"><h2>Cadastro</h2><table class="tabela quebra">
        ${linha('Nome', esc(p.nome || '–'))}${linha('Sexo', p.sexo === 'F' ? 'Feminino' : 'Masculino')}${linha('Idade', a.idade + ' anos')}
        ${linha('Altura', n0(p.altura) + ' cm')}${linha('Peso', n1(p.peso) + ' kg')}
        ${linha('Objetivo', OBJETIVOS[a.objetivo].nome + (OBJETIVOS[p.objetivo] ? '' : ' (recomendado)'))}
        ${linha('Nível', NIVEIS[p.nivel])}${linha('Treinos por semana', p.dias)}
        ${linha('Equipamentos', lista(p.equip, EQUIPAMENTOS, 'Só peso do corpo'))}${linha('Cuidados', lista(p.restricoes, RESTRICOES, 'Nenhum'))}</table></div>
      <div class="pilha">
        ${NUVEM ? `<div class="card"><h2>Conta</h2><p class="suave pequeno quebra-email">Conectado como <b>${esc(emailConta())}</b>. Seus dados ficam guardados na sua conta e aparecem em qualquer aparelho em que você entrar.${ehAdmin() ? '' : ' Quem administra o BioFicha acompanha o seu progresso: medições, treinos e alimentação.'}</p>
          <div class="acoes" style="margin-top:12px"><button class="btn" data-acao="sair">Sair</button></div></div>` : ''}
        ${ehAdmin() ? `<div class="card"><h2>Administração</h2><p class="suave pequeno">Acompanhe o progresso de quem usa o BioFicha e escolha quem entra: você cria o convite e manda o link para a pessoa criar a senha.</p>
          <div class="acoes" style="margin-top:12px"><a class="btn primario" href="#/pessoas">Abrir painel do administrador</a></div></div>` : ''}
        <div class="card"><h2>Cópia de segurança</h2><p class="suave pequeno">${NUVEM
          ? 'Baixe uma cópia dos seus dados em arquivo, ou restaure aqui uma cópia feita em outro lugar (por exemplo, no site aberto direto do computador).'
          : 'Os dados ficam salvos só neste navegador. Baixe uma cópia para não perder nada ou para levar a outro computador.'}</p>
          <div class="acoes" style="margin-top:12px"><button class="btn" data-acao="exportar">Baixar cópia</button>
          <label class="btn">Restaurar cópia<input type="file" id="importar" accept="application/json,.json" hidden></label></div></div>
        <div class="card"><h2>Apagar tudo</h2><p class="suave pequeno">Remove cadastro, ficha, medições e histórico ${NUVEM ? 'da sua conta, em todos os aparelhos' : 'deste navegador'}.</p>
          <div class="acoes" style="margin-top:12px"><button class="btn perigo" data-acao="apagar-tudo">Apagar todos os dados</button></div></div>
        <p class="mini suave">Fotos dos exercícios: free-exercise-db (domínio público).</p>
      </div>
    </div>`;
}

const VIEWS = { painel: viewPainel, ficha: viewFicha, exercicios: viewExercicios, alimentacao: viewAlimentacao, evolucao: viewEvolucao, perfil: viewPerfil, pessoas: viewPessoas };

/* ───────── Cronômetro de descanso ───────── */
const crono = { fim: 0, id: null };
function iniciarDescanso(seg) {
  if (!seg) return;
  crono.fim = Date.now() + seg * 1000;
  clearInterval(crono.id); crono.id = setInterval(tique, 250); tique();
}
function pararDescanso() { clearInterval(crono.id); crono.id = null; $('#cronometro').hidden = true; }
function tique() {
  const resta = Math.ceil((crono.fim - Date.now()) / 1000), el = $('#cronometro');
  if (resta <= 0) { pararDescanso(); apito(); toast('Descanso encerrado. Próxima série!'); return; }
  el.hidden = false;
  $('.tempo', el).textContent = Math.floor(resta / 60) + ':' + String(resta % 60).padStart(2, '0');
}
function apito() {
  try {
    const C = window.AudioContext || window.webkitAudioContext, ctx = new C(), o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.2, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    o.start(); o.stop(ctx.currentTime + 0.6);
    if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  } catch (e) { /* sem áudio disponível */ }
}

/* ───────── Ações ───────── */
function alternarNoDia(exId, diaId) {
  const dia = estado.ficha.dias.find(d => d.id === diaId); if (!dia) return;
  const i = dia.itens.findIndex(x => x.ex === exId);
  if (i >= 0) dia.itens.splice(i, 1);
  else dia.itens.push(novoItem(exDe(exId), analise().objetivo, parseInt(estado.perfil.nivel, 10) || 1));
  salvar();
}
function novoDia() {
  if (!estado.ficha) estado.ficha = { dias: [], geradaEm: new Date().toISOString() };
  const usadas = estado.ficha.dias.map(d => d.id), letra = LETRAS.split('').find(l => !usadas.includes(l));
  if (!letra) return;
  estado.ficha.dias.push({ id: letra, nome: 'Treino ' + letra, titulo: '', foco: '', itens: [] });
  ui.dia = letra; salvar();
}

const ACOES = {
  // Cadastro
  escolher(el) { const v = el.dataset.valor; ui.rascunho[el.dataset.campo] = /^\d+$/.test(v) ? parseInt(v, 10) : v; render(); },
  alternar(el) { const arr = ui.rascunho[el.dataset.campo], v = el.dataset.valor, i = arr.indexOf(v); i >= 0 ? arr.splice(i, 1) : arr.push(v); render(); },
  local(el) { ui.rascunho.equip = { academia: TODOS_EQUIP.slice(), casa: ['halteres', 'elastico'], corpo: [] }[el.dataset.valor]; render(); },
  passo(el) {
    const d = parseInt(el.dataset.valor, 10);
    if (d > 0 && !validarPasso(ui.passo)) { render(); const inv = $('.invalida'); if (inv) inv.focus(); return; }
    ui.erros = {};
    if (d > 0 && ui.passo === 4) return concluirCadastro();
    ui.passo = Math.max(1, ui.passo + d); render(); window.scrollTo(0, 0);
  },
  'editar-cadastro'() { ui.editando = true; ui.rascunho = null; ui.passo = 1; render(); window.scrollTo(0, 0); },
  'cancelar-edicao'() { ui.editando = false; ui.rascunho = null; ui.erros = {}; render(); },
  'usar-recomendado'() { estado.perfil.objetivo = 'auto'; salvar(); render(); toast('Plano ajustado para o objetivo recomendado.'); },
  'perfil-set'(el) { const v = el.dataset.valor; estado.perfil[el.dataset.campo] = /^\d+$/.test(v) ? parseInt(v, 10) : v; salvar(); render(); },

  // Ficha
  dia(el) { ui.dia = el.dataset.valor; render(); },
  'ir-treino'(el) { ui.dia = el.dataset.valor; if (!estado.sessao) ACOES['iniciar-treino'](); location.hash = '#/ficha'; },
  'gerar-ficha'() {
    if (estado.ficha && estado.ficha.dias.some(d => d.itens.length) && !confirm('Montar uma nova ficha recomendada?\n\nA ficha atual, com as cargas anotadas, será substituída.')) return;
    estado.ficha = gerarFicha(estado.perfil, analise().objetivo); estado.sessao = null; ui.dia = null; salvar(); render(); toast('Ficha montada para o seu perfil.');
  },
  'novo-dia'() { novoDia(); render(); },
  'excluir-dia'() {
    const dia = diaAtual();
    if (dia.itens.length && !confirm(`Excluir o ${dia.nome} com ${dia.itens.length} exercícios?`)) return;
    estado.ficha.dias = estado.ficha.dias.filter(d => d !== dia); ui.dia = null; salvar(); render();
  },
  remover(el) { diaAtual().itens.splice(parseInt(el.dataset.valor, 10), 1); salvar(); render(); },
  mover(el) {
    const itens = diaAtual().itens, i = parseInt(el.dataset.valor, 10), j = i + parseInt(el.dataset.dir, 10);
    if (j < 0 || j >= itens.length) return;
    [itens[i], itens[j]] = [itens[j], itens[i]]; salvar(); render();
  },
  trocar(el) { modalTrocar(parseInt(el.dataset.valor, 10)); },
  'trocar-por'(el) {
    const dia = diaAtual(), idx = parseInt(el.dataset.idx, 10), ex = exDe(el.dataset.valor);
    dia.itens[idx] = novoItem(ex, analise().objetivo, parseInt(estado.perfil.nivel, 10) || 1);
    salvar(); fecharModal(); render(); toast('Exercício trocado.');
  },
  imprimir() { window.print(); },
  'iniciar-treino'() {
    const dia = diaAtual(); if (!dia.itens.length || estado.sessao) return;
    estado.sessao = { dia: dia.id, inicio: Date.now(), feitas: {} }; salvar(); render();
  },
  serie(el) {
    const s = estado.sessao, ex = el.dataset.ex, n = parseInt(el.dataset.valor, 10); if (!s) return;
    const antes = s.feitas[ex] || 0;
    s.feitas[ex] = antes === n ? n - 1 : n;               // tocar de novo na última série desfaz
    salvar(); render();
    const item = diaAtual().itens.find(i => i.ex === ex);
    if (s.feitas[ex] > antes && item) iniciarDescanso(parseInt(item.descanso, 10) || 0);
  },
  // Conclui (ou desfaz) o exercício inteiro de uma vez, sem tocar série por série
  'concluir-ex'(el) {
    const s = estado.sessao, dia = diaAtual(), item = dia.itens.find(i => i.ex === el.dataset.ex); if (!s || !item) return;
    const n = parseInt(item.series, 10) || 1, completo = (s.feitas[item.ex] || 0) >= n;
    s.feitas[item.ex] = completo ? 0 : n;
    salvar(); render();
    if (!completo) {
      const faltam = dia.itens.filter(i => (s.feitas[i.ex] || 0) < (parseInt(i.series, 10) || 1)).length;
      toast(faltam ? `Exercício concluído. ${faltam === 1 ? 'Falta 1' : 'Faltam ' + faltam}.` : 'Todos os exercícios feitos. Toque em Concluir treino.');
    }
  },
  'cancelar-treino'() { if (!confirm('Cancelar o treino em andamento? As séries marcadas serão descartadas.')) return; estado.sessao = null; pararDescanso(); salvar(); render(); },
  'concluir-treino'() {
    const s = estado.sessao, dia = estado.ficha.dias.find(d => d.id === s.dia); if (!dia) { estado.sessao = null; salvar(); return render(); }
    const total = dia.itens.reduce((t, i) => t + (parseInt(i.series, 10) || 1), 0);
    const feitas = dia.itens.reduce((t, i) => t + Math.min(s.feitas[i.ex] || 0, parseInt(i.series, 10) || 1), 0);
    if (feitas < total && !confirm(`Você marcou ${feitas} de ${total} séries. Concluir mesmo assim?`)) return;
    estado.sessoes.push({ data: hojeISO(), dia: dia.id, titulo: dia.titulo || '', feitas, total, minutos: Math.max(1, Math.round((Date.now() - s.inicio) / 60000)) });
    estado.sessao = null; pararDescanso(); salvar(); render(); toast('Treino concluído e registrado. Bom trabalho!');
  },

  // Biblioteca e janelas
  ver(el) { modalExercicio(el.dataset.valor); },
  flag(el) {
    const id = el.dataset.valor;
    if (!estado.ficha || !estado.ficha.dias.length) novoDia();
    const dias = estado.ficha.dias;
    if (dias.length === 1) { alternarNoDia(id, dias[0].id); atualizarGrade(); return; }
    modalDias(id);
  },
  'flag-dia'(el) {
    alternarNoDia(el.dataset.ex, el.dataset.valor);
    const reabrir = ui.modalEx, dias = ui.modalDias;
    if (rotaAtual() === 'exercicios') atualizarGrade(); else render();
    if (reabrir) modalExercicio(reabrir); else if (dias) modalDias(dias);
  },
  'fechar-modal'(el, ev) { if (el.dataset.forcar || ev.target === el) { ui.modalDias = null; fecharModal(); } },
  'filtro-grupo'(el) { ui.filtro.grupo = el.dataset.valor; render(); },
  'filtro-indicados'() { ui.filtro.soIndicados = !ui.filtro.soIndicados; render(); },

  // Evolução e perfil
  'salvar-medida'() {
    const g = id => num($('#m-' + id).value), data = $('#m-data').value, peso = g('peso');
    if (!data || data > hojeISO()) return toast('Informe uma data válida, até hoje.');
    if (peso === null || peso < 30 || peso > 300) return toast('Informe o peso em kg, entre 30 e 300.');
    const m = { data, peso, gordura: g('gordura'), visceral: g('visceral'), musculo: g('musculo'), tmb: g('tmb') };
    if (m.gordura !== null && (m.gordura < 3 || m.gordura > 65)) return toast('A gordura corporal costuma ficar entre 3% e 65%.');
    if (m.visceral !== null && (m.visceral < 1 || m.visceral > 30)) return toast('O nível de gordura abdominal vai de 1 a 30.');
    if (m.musculo !== null && (m.musculo < 5 || m.musculo > 60)) return toast('O músculo esquelético é um percentual do peso, entre 5% e 60%.');
    if (m.tmb !== null && (m.tmb < 800 || m.tmb > 4000)) return toast('O metabolismo em repouso costuma ficar entre 800 e 4000 kcal.');
    registrarMedida(m);
    if (estado.medidas[estado.medidas.length - 1].data === data) {     // medição mais recente atualiza o perfil
      estado.perfil.peso = peso;
      ['gordura', 'visceral', 'musculo', 'tmb'].forEach(k => { if (m[k] !== null) estado.perfil.bio[k] = m[k]; });
    }
    salvar(); render(); toast('Medição salva. Análise e plano atualizados.');
  },
  'apagar-medida'(el) {
    if (!confirm('Apagar a medição de ' + dataBR(el.dataset.valor) + '?')) return;
    estado.medidas = estado.medidas.filter(x => x.data !== el.dataset.valor); salvar(); render();
  },
  exportar() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(estado, null, 2)], { type: 'application/json' }));
    a.download = `bioficha-${hojeISO()}.json`; a.click(); URL.revokeObjectURL(a.href);
  },
  'apagar-tudo'() {
    if (!confirm(`Apagar cadastro, ficha, medições e histórico ${NUVEM ? 'da sua conta, em todos os aparelhos' : 'deste navegador'}?\n\nIsso não pode ser desfeito. Se quiser guardar, baixe uma cópia antes.`)) return;
    if (NUVEM) {
      clearTimeout(nuvem.timer); nuvem.timer = null;
      fb.fs.deleteDoc(nuvem.ref).catch(e => { console.warn('apagar', e); toast('Não consegui apagar os dados da conta. Tente de novo.'); });
    } else localStorage.removeItem(CHAVE);
    estado = estadoVazio(); ui.rascunho = null; ui.passo = 1; location.hash = ''; render();
  },
  // Conta (modo nuvem)
  'modo-conta'(el) { nuvem.modo = el.dataset.valor; nuvem.erro = ''; nuvem.aviso = ''; render(); const c = $('#c-email'); if (c) c.focus(); },
  sair() { sairDaConta(); },
  reconferir() { if (!nuvem.ocupado) reconferirConta(); },
  async 'enviar-confirmacao'() {
    nuvem.erro = ''; nuvem.aviso = ''; nuvem.ocupado = true; render();
    try {
      await comRetorno(o => fb.auth.sendEmailVerification(fb.au.currentUser, o));
      nuvem.aviso = 'Link enviado para ' + emailConta() + '. Olhe também a caixa de spam.';
    } catch (e) { console.warn('confirmacao', e); nuvem.erro = ERROS_CONTA[e.code] || 'Não consegui enviar o link. Tente de novo.'; }
    nuvem.ocupado = false; render();
  },
  // Administração
  'ver-usuario'(el) { modalUsuario(el.dataset.valor); },
  'recarregar-usuarios'() { carregarUsuarios(); render(); },
  async 'copiar-convite'(el) {
    const p = (ui.convites || []).find(x => x.email === el.dataset.valor);
    if (!p || !p.chave) return toast('Este convite não tem mais link: a pessoa já criou a senha.');
    if (await copiar(textoConvite(p))) toast('Convite copiado. Cole no WhatsApp ou onde preferir.');
    else { ui.conviteNovo = p.email; render(); const t = $('#msg-convite'); if (t) { t.focus(); t.select(); } toast('Selecione o texto e copie.'); }
  },
  async 'reenviar-convite'(el) {
    const email = el.dataset.valor;
    try { await enviarLinkSenha(email); toast('E-mail enviado para ' + email + '. Avise para olhar o spam.'); }
    catch (e) { console.warn('reenviar', e); toast(ERROS_CONTA[e.code] || 'Não consegui enviar o e-mail.'); }
  },
  async 'remover-convite'(el) {
    const email = el.dataset.valor;
    if (!confirm('Remover o acesso de ' + email + '?\n\nA pessoa deixa de conseguir entrar na hora. Os dados dela ficam guardados.')) return;
    try { await fb.fs.updateDoc(fb.fs.doc(fb.db, 'convites', email), { removido: true }); toast('Acesso removido.'); await carregarConvites(); }
    catch (e) { console.warn('remover', e); toast('Não consegui remover o acesso. Tente de novo.'); }
  },
  async 'devolver-acesso'(el) {
    try { await fb.fs.updateDoc(fb.fs.doc(fb.db, 'convites', el.dataset.valor), { removido: false }); toast('Acesso devolvido.'); await carregarConvites(); }
    catch (e) { console.warn('devolver', e); toast('Não consegui devolver o acesso. Tente de novo.'); }
  },
  async 'excluir-convite'(el) {
    const email = el.dataset.valor;
    if (!confirm('Excluir o convite de ' + email + '?\n\nSe você convidar este e-mail de novo, a pessoa vai precisar confirmar o e-mail para voltar a entrar.')) return;
    try { await fb.fs.deleteDoc(fb.fs.doc(fb.db, 'convites', email)); toast('Convite excluído.'); await carregarConvites(); }
    catch (e) { console.warn('excluir', e); toast('Não consegui excluir o convite. Tente de novo.'); }
  },
  recarregar() { location.reload(); },
  'crono-mais'() { crono.fim += 15000; tique(); },
  'crono-pular'() { pararDescanso(); }
};

Object.assign(ACOES, ACOES_ACOMPANHAMENTO);

function atualizarGrade() { const g = $('#grade'); if (g) g.innerHTML = gradeExercicios(); else render(); }

document.addEventListener('click', ev => {
  const el = ev.target.closest('[data-acao]');
  if (el && ACOES[el.dataset.acao]) ACOES[el.dataset.acao](el, ev);
});
document.addEventListener('input', ev => {
  const t = ev.target;
  if (t.dataset.r && ui.rascunho) {
    const k = t.dataset.r;
    if (k.startsWith('bio.')) ui.rascunho.bio[k.slice(4)] = t.value; else ui.rascunho[k] = t.value;
  } else if (t.id === 'busca') { ui.filtro.busca = t.value; atualizarGrade(); }
  else if (t.id === 'c-email') nuvem.email = t.value;
  else if (campoDiario(t)) { /* guardado no rascunho do diário */ }
  else if ((t.id === 'cv-email' || t.id === 'cv-nome') && ui.convite) ui.convite[t.id.slice(3)] = t.value;
});
document.addEventListener('submit', ev => {
  if (ev.target.id === 'form-conta') { ev.preventDefault(); if (!nuvem.ocupado) enviarConta(); }
  if (ev.target.id === 'form-senha') { ev.preventDefault(); if (!nuvem.ocupado) salvarSenhaNova(); }
  if (ev.target.id === 'form-convite') { ev.preventDefault(); if (ehAdmin() && !ui.convite.ocupado) enviarConvite(); }
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'filtro-equip') { ui.filtro.equip = t.value; atualizarGrade(); }
  else if (t.id === 'd-data' || t.id === 'd-refeicao' || t.id === 'd-un') { campoDiario(t); rascunhoDiario().erro = ''; render(); }
  else if (t.dataset.item != null) {
    const it = diaAtual().itens[parseInt(t.dataset.item, 10)], prop = t.dataset.prop;
    if (!it) return;
    if (prop === 'series') it.series = Math.min(10, Math.max(1, parseInt(t.value, 10) || 1));
    else if (prop === 'descanso') it.descanso = Math.min(600, Math.max(0, parseInt(t.value, 10) || 0));
    else it[prop] = t.value.trim();
    t.value = it[prop]; salvar();
  } else if (t.id === 'importar' && t.files[0]) {
    const leitor = new FileReader();
    leitor.onload = () => {
      try {
        const d = JSON.parse(leitor.result);
        if (!d || !d.perfil || !d.perfil.peso) throw new Error('formato');
        if (!confirm(`Restaurar esta cópia? Os dados atuais ${NUVEM ? 'da sua conta' : 'deste navegador'} serão substituídos.`)) return;
        estado = abrirDados(d); salvar(); render(); toast('Cópia restaurada.');
      } catch (e) { toast('Este arquivo não é uma cópia válida do BioFicha.'); }
    };
    leitor.readAsText(t.files[0]);
  }
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && !$('#modal').hidden) { ui.modalDias = null; fecharModal(); }
  if (ev.key === 'Enter' && ev.target.dataset && ev.target.dataset.r) { const b = $('[data-acao="passo"][data-valor="1"]'); if (b) b.click(); }
});
// Na biblioteca, a segunda foto só carrega quando o cursor passa sobre o cartão
document.addEventListener('mouseover', ev => {
  const a = ev.target.closest && ev.target.closest('.ex-card .anim:not(.rodando)');
  if (!a) return;
  const f2 = $('.f2', a); if (f2 && f2.dataset.src) { f2.src = f2.dataset.src; a.classList.add('rodando'); }
});
// Dica flutuante dos gráficos
document.addEventListener('pointermove', ev => {
  const svg = ev.target.closest && ev.target.closest('.grafico svg');
  document.querySelectorAll('.dica-graf').forEach(d => { if (!svg || d.parentNode !== svg.parentNode) { d.hidden = true; const g = $('.guia', d.parentNode); if (g) g.setAttribute('visibility', 'hidden'); } });
  if (!svg) return;
  const pts = JSON.parse(svg.dataset.pontos), r = svg.getBoundingClientRect(), escala = GRAF_W / r.width;
  const px = (ev.clientX - r.left) * escala;
  const p = pts.reduce((m, q) => (Math.abs(q.x - px) < Math.abs(m.x - px) ? q : m));
  const dica = $('.dica-graf', svg.parentNode), guia = $('.guia', svg);
  dica.textContent = p.t; dica.hidden = false;
  dica.style.left = Math.min(r.width - 70, Math.max(70, p.x / escala)) + 'px'; dica.style.top = p.y / escala + 'px';
  guia.setAttribute('x1', p.x); guia.setAttribute('x2', p.x); guia.setAttribute('visibility', 'visible');
});

window.addEventListener('error', ev => {
  const c = $('#app');
  if (c && !$('.erro-app')) c.insertAdjacentHTML('afterbegin', `<div class="erro-app">Algo deu errado ao montar a página: ${esc(ev.message)}</div>`);
});

render();
if (NUVEM) iniciarNuvem();
