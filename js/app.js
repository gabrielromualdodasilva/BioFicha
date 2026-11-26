'use strict';
/* Interface do site. Os dados ficam salvos no próprio navegador (localStorage). */

const DEMO = /[?&]demo\b/.test(location.search);
const CHAVE = DEMO ? 'fichaAcademia.demo' : 'fichaAcademia.v1';
const LETRAS = 'ABCDEFG';
const TODOS_EQUIP = Object.keys(EQUIPAMENTOS).filter(k => k !== 'corpo');

const estadoVazio = () => ({ perfil: null, ficha: null, medidas: [], sessoes: [], sessao: null });
let estado = carregar();
const ui = { passo: 1, rascunho: null, editando: false, erros: {}, dia: null, filtro: { busca: '', grupo: 'todos', equip: 'todos', soIndicados: true } };

function carregar() {
  try {
    if (DEMO) return dadosDemo();
    return Object.assign(estadoVazio(), JSON.parse(localStorage.getItem(CHAVE)) || {});
  } catch (e) { return estadoVazio(); }
}
function salvar() {
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
const diaAtual = () => { const ds = estado.ficha.dias; return ds.find(d => d.id === ui.dia) || ds[0]; };

/* ───────── Dados de exemplo (index.html?demo) ───────── */
function dadosDemo() {
  const perfil = {
    nome: 'Visitante', sexo: 'M', nascimento: '1994-05-10', altura: 178, peso: 88.4, objetivo: 'auto', nivel: 1, dias: 4,
    rotina: 'sedentaria', enfase: 'equilibrado', equip: TODOS_EQUIP.slice(), restricoes: [], dieta: 'tradicional', refeicoes: 4,
    bio: { gordura: 25.6, musculo: 35.8, agua: 53.1, visceral: 10, tmb: '', idadeMet: 36, ossea: 3.3 }
  };
  const medidas = [
    { data: '2026-08-20', peso: 92.0, gordura: 27.5, musculo: 36.0, agua: 52.0, visceral: 11 },
    { data: '2026-09-18', peso: 90.6, gordura: 26.9, musculo: 35.9, agua: 52.4, visceral: 11 },
    { data: '2026-10-22', peso: 89.3, gordura: 26.1, musculo: 35.9, agua: 52.8, visceral: 10 },
    { data: '2026-11-24', peso: 88.4, gordura: 25.6, musculo: 35.8, agua: 53.1, visceral: 10 }
  ];
  const a = analisar(perfil);
  return { perfil, ficha: gerarFicha(perfil, a.objetivo), medidas, sessoes: [{ data: '2026-11-23', dia: 'A', titulo: 'Superiores A', feitas: 18, total: 18, minutos: 52 }], sessao: null };
}

/* ───────── Roteamento e moldura ───────── */
const ROTAS = [
  ['painel', 'Painel'], ['ficha', 'Minha ficha'], ['exercicios', 'Exercícios'],
  ['alimentacao', 'Alimentação'], ['evolucao', 'Evolução'], ['perfil', 'Perfil']
];
const rotaAtual = () => { const r = location.hash.replace(/^#\/?/, ''); return ROTAS.some(x => x[0] === r) ? r : 'painel'; };

function render() {
  const app = $('#app');
  if (!estado.perfil || ui.editando) {
    app.className = 'app sem-nav';
    app.innerHTML = viewCadastro();
    return;
  }
  const rota = rotaAtual();
  app.className = 'app';
  app.innerHTML = `
    <nav class="lateral" aria-label="Seções">
      <div class="logo"><span class="logo-marca">${ic('exercicios')}</span>BioFicha</div>
      ${ROTAS.map(([r, nome]) => `<a class="nav-item ${r === rota ? 'ativo' : ''}" href="#/${r}">${ic(r)}<span>${r === 'ficha' ? '<span class="so-largo">Minha </span>' : ''}${r === 'ficha' ? 'ficha' : nome}</span></a>`).join('')}
      <div class="rodape mini suave">${DEMO ? 'Modo demonstração: dados de exemplo.' : 'Seus dados ficam salvos só neste navegador.'}</div>
    </nav>
    <main class="conteudo" id="conteudo">${VIEWS[rota]()}</main>`;
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

/* ───────── Cadastro ───────── */
function rascunhoNovo() {
  return {
    nome: '', sexo: 'M', nascimento: '', altura: '', peso: '', objetivo: 'auto', nivel: 1, dias: 3, rotina: 'sedentaria', enfase: 'equilibrado',
    equip: TODOS_EQUIP.slice(), restricoes: [], dieta: 'tradicional', refeicoes: 4,
    bio: { gordura: '', musculo: '', agua: '', visceral: '', tmb: '', idadeMet: '', ossea: '' }
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
      <p class="suave">Copie os valores do laudo ou da balança de bioimpedância. Tudo aqui é opcional: preencha o que tiver e deixe o resto em branco.</p>
      <div class="bloco"><div class="grade-campos">
        ${campo('Percentual de gordura', 'bio.gordura', { un: '%', exemplo: '22,5', ajuda: 'O dado mais importante do exame.' })}
        ${campo('Massa muscular', 'bio.musculo', { un: 'kg', exemplo: '34,0', ajuda: 'Massa muscular (esquelética ou total).' })}
        ${campo('Água corporal', 'bio.agua', { un: '%', exemplo: '55' })}
        ${campo('Gordura visceral', 'bio.visceral', { un: 'nível', exemplo: '8', modo: 'numeric', ajuda: 'Número de 1 a 59 informado pela balança.' })}
        ${campo('Metabolismo basal', 'bio.tmb', { un: 'kcal', exemplo: '1750', modo: 'numeric', ajuda: 'Se não tiver, eu calculo.' })}
        ${campo('Idade metabólica', 'bio.idadeMet', { un: 'anos', exemplo: '30', modo: 'numeric' })}
        ${campo('Massa óssea', 'bio.ossea', { un: 'kg', exemplo: '3,2' })}
      </div></div>
      <p class="aviso" style="margin-top:20px">Não fez bioimpedância? Pode avançar. Eu estimo a gordura pelo IMC e pela idade, e você atualiza depois em Evolução.</p>`;
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
    faixa('bio.gordura', 3, 65, 'O percentual de gordura costuma ficar entre 3 e 65.');
    faixa('bio.musculo', 10, num(r.peso) || 150, 'A massa muscular precisa ser menor que o seu peso.');
    faixa('bio.agua', 30, 80, 'A água corporal costuma ficar entre 30% e 80%.');
    faixa('bio.visceral', 1, 59, 'O nível de gordura visceral vai de 1 a 59.');
    faixa('bio.tmb', 800, 4000, 'O metabolismo basal costuma ficar entre 800 e 4000 kcal.');
    faixa('bio.idadeMet', 10, 100, 'Informe uma idade entre 10 e 100.');
    faixa('bio.ossea', 1, 6, 'A massa óssea costuma ficar entre 1 e 6 kg.');
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
  estado.perfil = r;
  const a = analise();
  const mudouTreino = !antigo || ['nivel', 'dias', 'enfase', 'objetivo'].some(k => antigo[k] !== r[k]) ||
    JSON.stringify([antigo.equip, antigo.restricoes]) !== JSON.stringify([r.equip, r.restricoes]);
  if (!antigo) {
    estado.ficha = gerarFicha(r, a.objetivo);
    estado.medidas = [medidaDoPerfil(r, hojeISO())];
  } else {
    const ultima = estado.medidas[estado.medidas.length - 1];
    const nova = medidaDoPerfil(r, hojeISO());
    if (!ultima || ['peso', 'gordura', 'musculo', 'agua', 'visceral'].some(k => ultima[k] !== nova[k])) registrarMedida(nova);
    if (mudouTreino && confirm('Seu perfil de treino mudou. Quer que eu monte uma nova ficha recomendada?\n\nA ficha atual será substituída.'))
      estado.ficha = gerarFicha(r, a.objetivo);
  }
  ui.editando = false; ui.rascunho = null; ui.passo = 1; ui.dia = null;
  salvar();
  location.hash = '#/painel';
  render(); window.scrollTo(0, 0);
  toast(antigo ? 'Cadastro atualizado.' : 'Plano montado. Bom treino!');
}
function medidaDoPerfil(p, data) {
  const v = k => { const x = num(p.bio[k]); return x === null ? null : x; };
  return { data, peso: num(p.peso), gordura: v('gordura'), musculo: v('musculo'), agua: v('agua'), visceral: v('visceral') };
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

    <div class="duas">
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
    </div>

    <div class="secao"><h2>Seus números</h2>
      <div class="tiles">
        ${tile('IMC', n1(a.imc), '', selo(a.imcClasse.nivel, a.imcClasse.rotulo))}
        ${tile('Gordura corporal' + (a.gorduraMedida ? '' : ' (estimada)'), n1(a.gordura), '%', selo(a.gorduraClasse.nivel, a.gorduraClasse.rotulo))}
        ${tile('Massa magra', n1(a.massaMagra), 'kg', `<span class="mini suave">FFMI ${n1(a.ffmi)}</span>`)}
        ${tile('Metabolismo basal', n0(a.tmb), 'kcal', `<span class="mini suave">${a.tmbFonte}</span>`)}
        ${tile('Gasto diário', n0(a.gastoDiario), 'kcal', `<span class="mini suave">com ${a.dias} treinos por semana</span>`)}
        ${a.visceral !== null ? tile('Gordura visceral', n0(a.visceral), 'nível', selo(a.visceralClasse.nivel, a.visceralClasse.rotulo)) : ''}
        ${a.agua !== null ? tile('Água corporal', n1(a.agua), '%', selo(a.aguaClasse.nivel, a.aguaClasse.rotulo)) : ''}
        ${a.musculo !== null ? tile('Massa muscular', n1(a.musculo), 'kg', a.musculoClasse ? selo(a.musculoClasse.nivel, a.musculoClasse.rotulo) : `<span class="mini suave">${n0(a.musculoPct)}% do peso</span>`) : ''}
      </div>
    </div>

    <div class="secao duas">
      <div class="card"><h2>Composição corporal</h2>
        <div class="composicao" role="img" aria-label="Massa magra ${n1(pctMagra)}%, gordura ${n1(a.gordura)}%">
          <div class="magra" style="width:${pctMagra}%">${n0(pctMagra)}%</div>
          <div class="gorda" style="width:${a.gordura}%">${a.gordura >= 12 ? n0(a.gordura) + '%' : ''}</div></div>
        <div class="legenda"><span><i style="background:var(--dado-magra)"></i>Massa magra · ${n1(a.massaMagra)} kg</span><span><i style="background:var(--dado-gordura)"></i>Gordura · ${n1(a.massaGorda)} kg</span></div>
        <h3 style="margin-top:22px">Onde você está na faixa de gordura</h3>
        ${escalaGordura(a)}
        <p class="mini suave" style="margin-top:12px">Faixas de referência para ${a.sexo === 'F' ? 'mulheres' : 'homens'} adultos.</p>
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
            <span class="pequeno suave">${esc(it.reps)}${cardio ? '' : ' reps'}${it.descanso ? ' · descanso ' + it.descanso + ' s' : ''}</span></div>` : ''}
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
    <div class="abas">${f.dias.map(d => `<button class="aba ${d.id === dia.id ? 'ativo' : ''}" data-acao="dia" data-valor="${d.id}"><b>${esc(d.nome)}</b><span>${esc(d.titulo || d.itens.length + ' exercícios')}</span></button>`).join('')}
      ${f.dias.length < 7 ? `<button class="aba" data-acao="novo-dia"><b>${ic('mais', 'p')}</b><span>Novo treino</span></button>` : ''}</div>
    <div class="dia-tela">
      ${s ? `<div class="treinando"><div class="cabecalho" style="margin:0"><div><h2>${esc(dia.nome)} em andamento</h2><p class="suave pequeno">${feitas} de ${total} séries · toque no número da série ao terminar</p></div>
          <div class="acoes"><button class="btn" data-acao="cancelar-treino">Cancelar</button><button class="btn primario" data-acao="concluir-treino">${ic('check', 'p')}Concluir treino</button></div></div>
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
    <div class="cabecalho"><div><h1>Alimentação</h1><p class="suave">Plano para ${OBJETIVOS[pl.objetivo].nome.toLowerCase()}, calculado com o seu metabolismo e a sua rotina.</p></div></div>
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
        <li>Metabolismo basal de ${n0(a.tmb)} kcal, ${a.tmbFonte}.</li>
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
    <div class="cabecalho"><div><h1>Evolução</h1><p class="suave">Registre peso e bioimpedância a cada 3 ou 4 semanas. O plano se recalcula com os números novos.</p></div></div>
    <div class="graficos">${grafico('Peso', serie('peso'), 'kg', 1)}${grafico('Gordura corporal', serie('gordura'), '%', 1)}${grafico('Massa magra', magra, 'kg', 1)}</div>

    <div class="secao card"><h2>Registrar nova medição</h2>
      <div class="grade-campos">
        <label class="campo"><span>Data</span><input class="entrada" id="m-data" type="date" value="${hojeISO()}" max="${hojeISO()}"></label>
        ${c('Peso', 'peso', 'kg', n1(p.peso))}${c('Gordura', 'gordura', '%', 'opcional')}${c('Massa muscular', 'musculo', 'kg', 'opcional')}${c('Água', 'agua', '%', 'opcional')}${c('Gordura visceral', 'visceral', 'nível', 'opcional')}
      </div>
      <div class="acoes" style="margin-top:16px"><button class="btn primario" data-acao="salvar-medida">Salvar medição</button></div>
    </div>

    <div class="secao"><h2>Histórico de medições</h2>
      <div class="card rolagem-x">${ms.length ? `<table class="tabela"><tr><th>Data</th><th>Peso (kg)</th><th>Gordura (%)</th><th>Massa magra (kg)</th><th>Músculo (kg)</th><th>Água (%)</th><th>Visceral</th><th></th></tr>
        ${ms.slice().reverse().map(x => `<tr><td>${dataBR(x.data)}</td><td>${v(x.peso)}</td><td>${v(x.gordura)}</td><td>${x.gordura != null ? n1(x.peso * (1 - x.gordura / 100)) : '–'}</td><td>${v(x.musculo)}</td><td>${v(x.agua)}</td><td>${x.visceral == null ? '–' : n0(x.visceral)}</td>
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
      <div class="card"><h2>Cadastro</h2><table class="tabela">
        ${linha('Nome', esc(p.nome || '–'))}${linha('Sexo', p.sexo === 'F' ? 'Feminino' : 'Masculino')}${linha('Idade', a.idade + ' anos')}
        ${linha('Altura', n0(p.altura) + ' cm')}${linha('Peso', n1(p.peso) + ' kg')}
        ${linha('Objetivo', OBJETIVOS[a.objetivo].nome + (OBJETIVOS[p.objetivo] ? '' : ' (recomendado)'))}
        ${linha('Nível', NIVEIS[p.nivel])}${linha('Treinos por semana', p.dias)}
        ${linha('Equipamentos', lista(p.equip, EQUIPAMENTOS, 'Só peso do corpo'))}${linha('Cuidados', lista(p.restricoes, RESTRICOES, 'Nenhum'))}</table></div>
      <div class="pilha">
        <div class="card"><h2>Cópia de segurança</h2><p class="suave pequeno">Os dados ficam salvos só neste navegador. Baixe uma cópia para não perder nada ou para levar a outro computador.</p>
          <div class="acoes" style="margin-top:12px"><button class="btn" data-acao="exportar">Baixar cópia</button>
          <label class="btn">Restaurar cópia<input type="file" id="importar" accept="application/json,.json" hidden></label></div></div>
        <div class="card"><h2>Apagar tudo</h2><p class="suave pequeno">Remove cadastro, ficha, medições e histórico deste navegador.</p>
          <div class="acoes" style="margin-top:12px"><button class="btn perigo" data-acao="apagar-tudo">Apagar todos os dados</button></div></div>
        <p class="mini suave">Fotos dos exercícios: free-exercise-db (domínio público).</p>
      </div>
    </div>`;
}

const VIEWS = { painel: viewPainel, ficha: viewFicha, exercicios: viewExercicios, alimentacao: viewAlimentacao, evolucao: viewEvolucao, perfil: viewPerfil };

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
    const m = { data, peso, gordura: g('gordura'), musculo: g('musculo'), agua: g('agua'), visceral: g('visceral') };
    if (m.gordura !== null && (m.gordura < 3 || m.gordura > 65)) return toast('O percentual de gordura costuma ficar entre 3 e 65.');
    registrarMedida(m);
    if (estado.medidas[estado.medidas.length - 1].data === data) {     // medição mais recente atualiza o perfil
      estado.perfil.peso = peso;
      ['gordura', 'musculo', 'agua', 'visceral'].forEach(k => { if (m[k] !== null) estado.perfil.bio[k] = m[k]; });
    }
    salvar(); render(); toast('Medição salva. Plano recalculado.');
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
    if (!confirm('Apagar cadastro, ficha, medições e histórico deste navegador?\n\nIsso não pode ser desfeito. Se quiser guardar, baixe uma cópia antes.')) return;
    localStorage.removeItem(CHAVE); estado = estadoVazio(); ui.rascunho = null; ui.passo = 1; location.hash = ''; render();
  },
  'crono-mais'() { crono.fim += 15000; tique(); },
  'crono-pular'() { pararDescanso(); }
};

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
});
document.addEventListener('change', ev => {
  const t = ev.target;
  if (t.id === 'filtro-equip') { ui.filtro.equip = t.value; atualizarGrade(); }
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
        if (!confirm('Restaurar esta cópia? Os dados atuais deste navegador serão substituídos.')) return;
        estado = Object.assign(estadoVazio(), d); salvar(); render(); toast('Cópia restaurada.');
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
