'use strict';
/* BioFicha · avatar vivo (o mesmo do Planejamento Financeiro, adaptado aos treinos)
   - Cada pessoa monta o seu; ele fica em perfil.avatar, junto com os outros dados da conta.
   - Vivo: pisca, respira, segue o ponteiro com os olhos e reage aos treinos da semana (feliz, neutro, triste).
   - Palco: o avatar grande, em camadas com profundidade, que inclina com o ponteiro e fala sobre a semana (voz opcional).
   - Montador do avatar (tela "Seu avatar") e boas-vindas de quem acabou de fazer o cadastro.
   Carregado antes de app.js; usa as funções dele só na hora em que é chamado. */

/* ───────── Humor pelos treinos ─────────
   Feliz: treinou hoje, bateu a meta da semana ou está no ritmo dela. Triste: 7 dias ou mais sem treinar.
   Neutro: um pouco atrás da meta (ou ainda sem nenhum treino). */
function humorDoTreino(e) {
  e = e || estado;
  if (!e || !e.perfil || !(e.sessoes || []).some(s => s.data <= hojeISO())) return 'neutro';
  const f = frequenciaDeTreino(e);
  if (f.diasSemTreinar >= 7) return 'triste';
  const decorridos = (new Date(hojeISO() + 'T12:00:00').getDay() + 6) % 7 + 1;     // segunda = 1 … domingo = 7
  return f.diasSemTreinar === 0 || f.atual.n >= f.meta || f.atual.n >= Math.round(f.meta * decorridos / 7) ? 'feliz' : 'neutro';
}
const humorAtual = () => humorDoTreino(estado);
const TEXTO_HUMOR = 'No dia a dia ele reage aos seus treinos: feliz quando você treinou hoje ou está em dia com a meta da semana, neutro quando está um pouco atrás, triste depois de 7 dias sem treinar.';

/* ───────── Avatar de cada pessoa ───────── */
const primeiroNome = nome => String(nome || '').trim().split(/\s+/)[0] || '';
// Quem ainda não montou: o avatar padrão, de homem ou de mulher conforme o cadastro
const avatarPadrao = p => AVATAR.trocarTipo(AVATAR.PADRAO, p && p.sexo === 'F' ? 'feminino' : 'masculino');
function meuAvatar(t, opc) {
  const p = estado.perfil;
  return AVATAR.svg(p && p.avatar ? p.avatar : avatarPadrao(p), Object.assign({ tamanho: t, titulo: p && p.nome ? p.nome : 'Seu avatar' }, opc));
}
// Na lista do administrador (ou do profissional): o avatar da pessoa, ou as iniciais se ela ainda não montou
function avatarDeUsuario(u, t, opc) {
  const p = (u && u.perfil) || {};
  return p.avatar ? AVATAR.svg(p.avatar, Object.assign({ tamanho: t, titulo: p.nome || 'Avatar' }, opc))
    : AVATAR.iniciais(p.nome || (u && u.conta && u.conta.email) || '?', t);
}
const rotuloPapel = () => (DEMO ? 'Exemplo' : !NUVEM ? 'Neste navegador' : ehAdmin() ? 'Administrador' : ehProfissional() ? 'Profissional' : 'Aluno');

/* ───────── O que o avatar fala: frases tiradas dos próprios dados ───────── */
function falasDaSemana() {
  const p = estado.perfil;
  if (!p) return ['Oi! Vamos montar seu plano?'];
  const nome = primeiroNome(p.nome), hoje = hojeISO(), f = frequenciaDeTreino(), humor = humorAtual(), falas = [];
  const decorridos = (new Date(hoje + 'T12:00:00').getDay() + 6) % 7 + 1, faltam = Math.max(0, f.meta - f.atual.n);
  if (!f.total) falas.push(`Oi${nome ? ', ' + nome : ''}! Vamos começar? Conclua o primeiro treino e eu comemoro com você.`);
  else if (humor === 'triste') falas.push(`${nome ? nome + ', já' : 'Já'} faz ${f.diasSemTreinar} dias sem treinar. Que tal um treino leve hoje?`);
  else if (f.diasSemTreinar === 0) falas.push(`${nome ? 'Boa, ' + nome + '!' : 'Boa!'} Você treinou hoje. ${f.atual.n >= f.meta ? 'E a meta da semana está batida!' : `Já ${f.atual.n === 1 ? 'é 1 dia' : 'são ' + f.atual.n + ' dias'} de ${f.meta} na semana.`}`);
  else if (humor === 'feliz') falas.push(`Oi${nome ? ', ' + nome : ''}! Semana em dia: ${f.atual.n} de ${f.meta} treinos.`);
  else falas.push(`${nome ? nome + ', esta' : 'Esta'} semana ${f.atual.n === 1 ? 'foi 1 treino' : 'foram ' + f.atual.n + ' treinos'} de ${f.meta}. ${faltam <= 8 - decorridos ? 'Ainda dá para bater a meta!' : 'Cada treino conta.'}`);
  const prox = estado.ficha && estado.ficha.dias.length ? proximoDia() : null;
  if (estado.sessao) falas.push('Tem um treino em andamento. Bora terminar?');
  else if (prox && prox.itens.length) falas.push(`O próximo é o ${prox.nome}${prox.titulo ? ' · ' + prox.titulo : ''}, com ${prox.itens.length} exercícios.`);
  const b = balancoEnergia();
  if (b.porTreino) falas.push(`Seus treinos gastam em média ${n0(b.porTreino)} kcal cada.`);
  if (b.treinos7) falas.push(`Nos últimos 7 dias, os treinos queimaram ${n0(b.treinoSemana)} kcal.`);
  const pl = planoAlimentar(p, analise()), comeu = Math.round(somaDiario(diarioDoDia(hoje)).kcal);
  falas.push(comeu ? `Hoje você já anotou ${n0(comeu)} kcal da meta de ${n0(pl.kcal)}.${comeu < pl.kcal ? ` Faltam ${n0(pl.kcal - comeu)}.` : ''}`
    : `Sua meta de hoje é ${n0(pl.kcal)} kcal e ${pl.proteina} g de proteína. Anote as refeições no diário.`);
  if (b.validos >= 3 && b.saldoMedio) falas.push(`Nos dias com diário completo, você comeu em média ${n0(Math.abs(b.saldoMedio))} kcal ${b.saldoMedio < 0 ? 'a menos' : 'a mais'} do que gastou.`);
  const ms = (estado.medidas || []).filter(m => m.gordura != null);
  if (ms.length >= 2) {
    const m1 = ms[ms.length - 2], m2 = ms[ms.length - 1], d = m2.gordura - m1.gordura;
    if (Math.abs(d) >= 0.1) falas.push(`Na última bioimpedância, a gordura corporal ${d < 0 ? 'caiu' : 'subiu'} de ${n1(m1.gordura)}% para ${n1(m2.gordura)}%.`);
  }
  const dm = diasDaUltimaMedida();
  if (dm !== null && dm >= 7) falas.push(`A última medição foi há ${dm} dias. Que tal lançar a bioimpedância desta semana?`);
  if (f.sequencia >= 2) falas.push(`Você bateu a meta ${f.sequencia} semanas seguidas!`);
  falas.push(humor === 'triste' ? 'Recomeçar faz parte. Um treino curto hoje já conta.' : humor === 'feliz' ? 'Continue assim: constância vale mais que intensidade.' : 'Um treino de 30 minutos já faz diferença. Bora?');
  return falas.map(x => x.charAt(0).toUpperCase() + x.slice(1));
}
let falaHeroi = 0;
function falaDoHeroi() { const f = falasDaSemana(); return f[falaHeroi % f.length]; }

// Mexe a boca do avatar dentro de "cont" por alguns milissegundos (enquanto fala)
const semMovimento = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
function mexerBoca(cont, ms) {
  if (!cont || semMovimento()) return;
  cont._falaFim = Date.now() + ms;
  if (cont._falando) return;
  cont._falando = true; cont.classList.add('falando');
  const passo = () => {
    if (!cont.isConnected || Date.now() > cont._falaFim) { cont._falando = false; cont.classList.remove('falando', 'boca-ab'); return; }
    cont.classList.toggle('boca-ab');
    cont.style.setProperty('--abertura', (0.45 + Math.random() * 0.55).toFixed(2));
    setTimeout(passo, 85 + Math.random() * 120);
  };
  passo();
}
// Chamado depois de cada desenho da tela: guarda o humor (para o pulinho quando ele muda) e acerta o olhar
function depoisDeDesenhar() {
  if (estado.perfil) ui.humorAnterior = humorAtual();
  olhar();
}
// O balão do Painel só aparece quando a pessoa toca no avatar: cada toque traz a frase seguinte, e ele some sozinho
let falouAgora = false, relogioBalao = null;
function falarHeroi() {
  const el = document.getElementById('fala-heroi');
  if (!el) return;
  if (!el.hidden && falouAgora) falaHeroi++;
  el.textContent = falaDoHeroi();
  el.hidden = false; falouAgora = true;
  el.classList.remove('troca'); void el.offsetWidth; el.classList.add('troca');
  mexerBoca(el.parentElement, 1500);
  clearTimeout(relogioBalao);
  relogioBalao = setTimeout(() => { if (el.isConnected) el.hidden = true; falouAgora = false; falaHeroi++; }, 9000);
}

/* Olhos (e, nos avatares grandes, a cabeça) acompanham o ponteiro */
let ponteiro = null, quadroOlhar = 0;
function olhar() {
  quadroOlhar = 0;
  if (!ponteiro) return;
  for (const av of document.querySelectorAll('.avatar.vivo')) {
    const r = av.getBoundingClientRect();
    if (!r.width) continue;
    const dx = ponteiro[0] - (r.left + r.width / 2), dy = ponteiro[1] - (r.top + r.height * 0.46), d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 240);
    av.style.setProperty('--px', (dx / d * 2.6 * k).toFixed(2) + 'px');
    av.style.setProperty('--py', (dy / d * 2 * k).toFixed(2) + 'px');
    if (r.width >= 110) av.style.setProperty('--giro', (Math.max(-1, Math.min(1, dx / 700)) * 6).toFixed(2) + 'deg');
  }
}
document.addEventListener('pointermove', ev => { ponteiro = [ev.clientX, ev.clientY]; if (!quadroOlhar) quadroOlhar = requestAnimationFrame(olhar); }, { passive: true });

/* ───────── Palco: o avatar grande, em camadas, que fala sobre a semana ───────── */
const temVoz = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
let vozLigada = false;
try { vozLigada = localStorage.getItem('bf.voz') === 'ligada'; } catch (e) { /* sem armazenamento: começa desligada */ }
function vozPortugues() {
  const vs = speechSynthesis.getVoices().filter(v => /^pt/i.test(v.lang));
  return vs.find(v => /BR/i.test(v.lang) && /natural|online/i.test(v.name)) || vs.find(v => /BR/i.test(v.lang)) || vs[0] || null;
}
if (temVoz) speechSynthesis.getVoices();
function abrirPalco() {
  ui.palco = true; ui.falaPalco = 0;
  const humor = humorAtual(), p = estado.perfil, av = p && p.avatar ? p.avatar : avatarPadrao(p);
  const camada = c => `<div class="camada ${c}">${AVATAR.svg(av, { tamanho: 400, vivo: true, humor, classe: 'no-palco' })}</div>`;
  const el = $('#palco');
  el.innerHTML = `<div class="palco-fundo humor-${humor}" data-acao="fechar-palco-fundo">
      <button class="palco-fechar" data-acao="fechar-palco" aria-label="Fechar">${ic('x')}</button>
      ${temVoz ? `<button class="palco-som" data-acao="voz" aria-pressed="${vozLigada}">${ic(vozLigada ? 'som' : 'mudo', 'p')}<span>${vozLigada ? 'Voz ligada' : 'Voz desligada'}</span></button>` : ''}
      <div class="palco" role="dialog" aria-modal="true" aria-label="Seu avatar">
        <div class="flutua"><button class="avatar3d" id="avatar3d" data-acao="proxima-fala" aria-label="Ouvir a próxima frase">${['c-fundo', 'c-corpo', 'c-cabeca'].map(camada).join('')}</button></div>
        <div class="palco-sombra"></div>
        <p class="palco-fala" id="palco-fala" aria-live="polite"></p>
        <p class="palco-dica">Toque no avatar para ouvir mais · <a href="#/avatar" data-acao="fechar-palco">${p && p.avatar ? 'editar avatar' : 'montar meu avatar'}</a></p>
      </div></div>`;
  el.hidden = false; document.body.style.overflow = 'hidden';
  falarNoPalco();
  $('#avatar3d').focus({ preventScroll: true });
}
function fecharPalco() {
  if (!ui.palco) return;
  ui.palco = false;
  if (temVoz) speechSynthesis.cancel();
  const el = $('#palco'); el.hidden = true; el.innerHTML = '';
  document.body.style.overflow = '';
}
function falarNoPalco() {
  const f = falasDaSemana(), texto = f[ui.falaPalco % f.length], el = $('#palco-fala'), cena = $('#avatar3d');
  if (!el) return;
  el.textContent = texto; el.classList.remove('troca'); void el.offsetWidth; el.classList.add('troca');
  if (temVoz) speechSynthesis.cancel();
  if (vozLigada && temVoz) {
    const u = new SpeechSynthesisUtterance(texto);
    u.lang = 'pt-BR'; u.rate = 1.03;
    const v = vozPortugues(); if (v) u.voice = v;
    u.onstart = () => mexerBoca(cena, 60000);
    u.onend = u.onerror = () => { if (cena) cena._falaFim = 0; };
    speechSynthesis.speak(u);
  } else mexerBoca(cena, Math.min(5200, Math.max(1300, texto.length * 55)));
}
// Inclina o avatar do palco conforme o ponteiro: cada camada está a uma profundidade diferente
document.getElementById('palco').addEventListener('pointermove', ev => {
  const a = document.getElementById('avatar3d');
  if (!a || semMovimento()) return;
  const x = ev.clientX / innerWidth, y = ev.clientY / innerHeight;
  a.style.setProperty('--ry', ((x - 0.5) * 24).toFixed(1) + 'deg');
  a.style.setProperty('--rx', ((0.5 - y) * 18).toFixed(1) + 'deg');
});
document.addEventListener('keydown', ev => { if (ev.key === 'Escape' && ui.palco) fecharPalco(); });

/* ───────── Destaque da semana no Painel, com o avatar que fala ───────── */
function heroiSemana() {
  const f = frequenciaDeTreino(), humor = humorAtual(), b = balancoEnergia(), pl = planoAlimentar(estado.perfil, analise());
  const faltam = Math.max(0, f.meta - f.atual.n), pct = Math.min(100, Math.round(f.atual.n / f.meta * 100));
  const ultimo = !f.total ? 'nenhum ainda' : f.diasSemTreinar === 0 ? 'hoje' : f.diasSemTreinar === 1 ? 'ontem' : 'há ' + f.diasSemTreinar + ' dias';
  const marca = f.atual.n >= f.meta ? `${ic('check', 'p')}meta batida` : f.diasSemTreinar >= 7 ? `${f.diasSemTreinar} dias sem treinar` : f.diasSemTreinar === 0 ? `${ic('check', 'p')}treinou hoje` : '';
  return `<section class="destaque-semana humor-${humor}" aria-label="Sua semana">
    <div class="hs-info">
      <div class="hs-topo"><span>Treinos da semana</span>${marca ? `<span class="hs-selo">${marca}</span>` : ''}</div>
      <div class="hs-valor">${f.atual.n} <small>de ${f.meta} dias</small></div>
      <div class="hs-linha"><span>Gasto nos treinos (7 dias)<b>${n0(b.treinoSemana)} kcal</b></span><span>Meta de hoje<b>${n0(pl.kcal)} kcal</b></span><span>Último treino<b>${ultimo}</b></span></div>
      <div class="hs-medidor" role="img" aria-label="${f.atual.n} de ${f.meta} dias de treino na semana"><span style="width:${pct}%"></span></div>
      <p class="hs-nota">${f.atual.n >= f.meta ? 'Meta da semana batida. Mandou bem!' : `Faltam ${faltam} ${faltam === 1 ? 'dia' : 'dias'} de treino para a meta da semana`}</p>
    </div>
    <div class="hs-avatar">
      <span class="balao-fala" id="fala-heroi" role="status" aria-live="polite" hidden></span>
      <button class="hs-avatar-btn" data-acao="falar-heroi" aria-label="Ouvir o que o avatar tem a dizer sobre a semana">${meuAvatar(176, { vivo: true, humor, classe: 'grande' + (ui.humorAnterior && ui.humorAnterior !== humor ? ' mudou' : '') })}</button>
      <button class="hs-ampliar" data-acao="abrir-palco" aria-label="Abrir o avatar em tela cheia" title="Tela cheia">${ic('ampliar', 'p')}</button>
    </div></section>`;
}
// Tela de entrada: três avatares de exemplo, um de cada humor (sempre os mesmos, pelo sorteio com semente fixa)
function trioDeAvatares() {
  let s = 7; const sorteio = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  return `<div class="marca-avatares">${[['feliz', 'Treinou hoje'], ['neutro', 'Um pouco atrás'], ['triste', '7 dias parado']].map(([h, n], i) => {
    const a = AVATAR.aleatorio(sorteio, ['masculino', 'feminino', 'masculino'][i]); a.acessorio = ['nenhum', 'brinco', 'quadrado'][i]; a.fundo = [2, 3, 4][i];
    return `<figure>${AVATAR.svg(a, { tamanho: 72, vivo: true, humor: h })}<figcaption>${n}</figcaption></figure>`;
  }).join('')}</div>`;
}
// Cartão do Perfil que leva ao montador
function cartaoAvatar() {
  const p = estado.perfil;
  return `<div class="card cartao-avatar">${meuAvatar(72, { vivo: true, humor: humorAtual() })}
    <div><h2>Seu avatar</h2><p class="suave pequeno">${p.avatar ? 'Mude rosto, cabelo, roupa e o que mais quiser.' : 'Monte o seu: ele reage aos seus treinos da semana.'}</p>
      <a class="btn" href="#/avatar" style="margin-top:10px">${ic('editar', 'p')}${p.avatar ? 'Editar avatar' : 'Montar avatar'}</a></div></div>`;
}

/* ───────── Montador de avatar ───────── */
function iniciarRascunhoAvatar() {
  const p = estado.perfil || {};
  ui.rascunhoAvatar = { nome: p.nome || '', avatar: p.avatar ? Object.assign({}, AVATAR.normalizar(p.avatar)) : AVATAR.aleatorio(null, p.sexo === 'F' ? 'feminino' : 'masculino') };
}
function htmlMontador() {
  if (!ui.rascunhoAvatar) iniciarRascunhoAvatar();
  const r = ui.rascunhoAvatar, g = ui.grupoAvatar || 'rosto', h = ui.humorPrevia || '';
  return `<div class="montador">
    <div class="montador-palco">
      <div class="montador-avatar">${AVATAR.svg(r.avatar, { tamanho: 220, vivo: true, humor: h || undefined, classe: 'grande', titulo: 'Prévia do avatar' })}</div>
      <div class="humores" role="group" aria-label="Ver o avatar com cada humor">${[['', 'Como montei'], ['feliz', 'Feliz'], ['neutro', 'Neutro'], ['triste', 'Triste']].map(([v, n]) =>
        `<button type="button" class="humor-btn ${h === v ? 'ativo' : ''}" data-acao="av-humor" data-valor="${v}" aria-pressed="${h === v}">${n}</button>`).join('')}</div>
      <p class="mini suave centro">${TEXTO_HUMOR}</p>
      <button type="button" class="btn" data-acao="av-sortear">${ic('dado', 'p')}Sortear um novo</button>
    </div>
    <div class="montador-opcoes">
      <div class="generos" role="group" aria-label="Homem ou mulher">${[['masculino', 'Homem'], ['feminino', 'Mulher']].map(([v, n]) => `<button type="button" class="genero ${r.avatar.tipo === v ? 'ativo' : ''}" data-acao="av-tipo" data-valor="${v}" aria-pressed="${r.avatar.tipo === v}">${AVATAR.svg(r.avatar.tipo === v ? r.avatar : AVATAR.trocarTipo(r.avatar, v), { tamanho: 56, titulo: n })}<span>${n}</span></button>`).join('')}</div>
      <label class="campo"><span>Como quer ser chamado</span><input class="entrada" id="av-nome" maxlength="40" autocomplete="nickname" value="${esc(r.nome)}" placeholder="Seu nome ou apelido"></label>
      <div class="subabas montador-abas" role="tablist" aria-label="Partes do avatar">${AVATAR.GRUPOS.map(([k, n]) => `<button type="button" role="tab" class="subaba ${k === g ? 'ativo' : ''}" aria-selected="${k === g}" data-acao="av-grupo" data-valor="${k}">${n}</button>`).join('')}</div>
      ${AVATAR.PARTES.filter(p => p.grupo === g && (!p.so || p.so === r.avatar.tipo)).map(p => `<div class="mt-parte"><h3>${p.nome}</h3><div class="mt-opcoes ${p.cores ? 'cores' : ''}">${p.cores
        ? (p.ordem || p.cores.map((_, i) => i)).map(i => `<button type="button" class="mt-cor ${r.avatar[p.id] === i ? 'ativo' : ''}" style="--c:${p.cores[i]}" data-acao="av-opcao" data-parte="${p.id}" data-valor="${i}" aria-label="${p.nomes ? p.nomes[i] : p.nome + ', opção ' + (i + 1)}" title="${p.nomes ? p.nomes[i] : ''}" aria-pressed="${r.avatar[p.id] === i}"></button>`).join('')
        : AVATAR.opcoesPara(p, r.avatar.tipo).map(([v, n]) => `<button type="button" class="mt-opcao ${r.avatar[p.id] === v ? 'ativo' : ''}" data-acao="av-opcao" data-parte="${p.id}" data-valor="${v}" aria-pressed="${r.avatar[p.id] === v}">${AVATAR.svg(Object.assign({}, r.avatar, { [p.id]: v }), { tamanho: 58, recorte: p.recorte, titulo: n })}<span>${n}</span></button>`).join('')
      }</div></div>`).join('')}
    </div></div>`;
}
document.addEventListener('input', ev => { if (ev.target.id === 'av-nome' && ui.rascunhoAvatar) ui.rascunhoAvatar.nome = ev.target.value; });
// Tela "Seu avatar". Logo depois do primeiro cadastro, vira as boas-vindas ("Monte seu avatar")
function viewAvatar() {
  if (!ui.rascunhoAvatar) iniciarRascunhoAvatar();
  const bv = !!ui.boasVindas, botao = `${ic('check', 'p')}${bv ? 'Pronto, ver meu plano' : 'Salvar avatar'}`;
  return `<div class="cabecalho"><div><h1>${bv ? 'Monte seu avatar' : 'Seu avatar'}</h1>
      <p class="suave">${bv ? 'Ele vai acompanhar seus treinos e reagir à sua semana.' : 'Mude rosto, cabelo, roupa e o que mais quiser.'}${NUVEM && !ehAdmin() ? ' É assim que quem acompanha você vê o seu perfil.' : ''}</p></div>
      <div class="acoes"><button class="btn primario" data-acao="salvar-avatar">${botao}</button></div></div>
    <section class="card">${htmlMontador()}</section>
    <div class="acoes salvar-avatar-fim"><button class="btn primario grande" data-acao="salvar-avatar">${botao}</button></div>
    ${bv ? `<p class="suave pequeno centro">${ic('editar', 'p')} Dá para mudar o avatar quando quiser: é só tocar nele, no canto da tela, ou ir em Perfil.</p>` : ''}`;
}
// O montador redesenha só a si mesmo (a tela de trás e o que foi digitado no nome continuam)
function redesenharMontador() {
  const m = $('.montador');
  if (!m) return render();
  const foco = document.activeElement && document.activeElement.dataset ? [document.activeElement.dataset.acao, document.activeElement.dataset.parte, document.activeElement.dataset.valor] : null;
  m.outerHTML = htmlMontador();
  if (foco && foco[0]) {
    const alvo = document.querySelector(`.montador [data-acao="${foco[0]}"]${foco[1] ? `[data-parte="${foco[1]}"]` : ''}${foco[2] !== undefined ? `[data-valor="${foco[2]}"]` : ''}`);
    if (alvo) alvo.focus({ preventScroll: true });
  }
  olhar();
}

const ACOES_AVATAR = {
  'abrir-palco'() { abrirPalco(); },
  'falar-heroi'() { falarHeroi(); },
  'fechar-palco'(el, ev) { if (ev) ev.preventDefault(); fecharPalco(); if (el.getAttribute('href')) location.hash = el.getAttribute('href'); },
  'fechar-palco-fundo'(el, ev) { if (ev.target === el) fecharPalco(); },
  'proxima-fala'() { ui.falaPalco = (ui.falaPalco || 0) + 1; falarNoPalco(); },
  voz(el) {
    vozLigada = !vozLigada;
    try { localStorage.setItem('bf.voz', vozLigada ? 'ligada' : 'desligada'); } catch (e) { /* vale só nesta visita */ }
    el.setAttribute('aria-pressed', String(vozLigada));
    el.innerHTML = `${ic(vozLigada ? 'som' : 'mudo', 'p')}<span>${vozLigada ? 'Voz ligada' : 'Voz desligada'}</span>`;
    falarNoPalco();
  },
  'av-opcao'(el) {
    const p = AVATAR.PARTES.find(x => x.id === el.dataset.parte);
    if (!p || !ui.rascunhoAvatar) return;
    ui.rascunhoAvatar.avatar[p.id] = p.cores ? parseInt(el.dataset.valor, 10) : el.dataset.valor;
    redesenharMontador();
  },
  'av-grupo'(el) { ui.grupoAvatar = el.dataset.valor; redesenharMontador(); },
  'av-tipo'(el) { if (!ui.rascunhoAvatar) iniciarRascunhoAvatar(); ui.rascunhoAvatar.avatar = AVATAR.trocarTipo(ui.rascunhoAvatar.avatar, el.dataset.valor); redesenharMontador(); },
  'av-humor'(el) { ui.humorPrevia = el.dataset.valor || null; redesenharMontador(); },
  'av-sortear'() { if (!ui.rascunhoAvatar) iniciarRascunhoAvatar(); ui.rascunhoAvatar.avatar = AVATAR.aleatorio(null, ui.rascunhoAvatar.avatar.tipo); redesenharMontador(); },   // sorteia mantendo homem ou mulher
  'salvar-avatar'() {
    if (!ui.rascunhoAvatar) iniciarRascunhoAvatar();
    const nome = String(ui.rascunhoAvatar.nome || '').trim();
    if (!nome) { toast('Escreva como quer ser chamado.'); const c = $('#av-nome'); if (c) c.focus(); return; }
    estado.perfil.nome = nome.slice(0, 40);
    estado.perfil.avatar = AVATAR.normalizar(ui.rascunhoAvatar.avatar);
    const bv = ui.boasVindas;
    ui.rascunhoAvatar = null; ui.humorPrevia = null; ui.boasVindas = false;
    salvar();
    if (bv) { location.hash = '#/painel'; toast(`Pronto, ${primeiroNome(nome)}! Toque no avatar para ouvir como está a sua semana.`); return; }
    render(); toast('Avatar salvo.');
  }
};
