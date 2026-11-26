'use strict';
/* Acompanhamento com IA: análise semanal da bioimpedância, diário do que a pessoa comeu (com cálculo de
   calorias) e reestruturação das metas de alimentação depois de um mês.
   A IA roda no servidor (functions/index.js); aqui ficam as telas e a montagem dos dados enviados.
   O que vai para a IA são números e textos de treino e alimentação, sem nome nem e-mail.
   Este arquivo é carregado antes de app.js e usa as funções dele só na hora em que é chamado. */

const REFEICOES_DIARIO = ['Café da manhã', 'Almoço', 'Lanche', 'Jantar', 'Ceia', 'Outro'];
const DIAS_PARA_REESTRUTURAR = 28;

const dataMenos = (iso, dias) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - dias); return d.toISOString().slice(0, 10); };
const diasEntre = (de, ate) => Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 86400000);
const arred = (v, casas) => { const f = Math.pow(10, casas || 0); return Math.round(v * f) / f; };
const iaDisponivel = () => NUVEM && nuvem.fase === 'pronto';

/* ───────── Chamada ao servidor ───────── */
async function chamarIA(tipo, dados) {
  if (!iaDisponivel() || !fb) throw Object.assign(new Error('local'), { code: 'local' });
  if (!fb.fn) {
    fb.fnMod = await import(SDK + 'functions.js');
    fb.fn = fb.fnMod.getFunctions(fb.inst, 'southamerica-east1');
  }
  const resposta = await fb.fnMod.httpsCallable(fb.fn, 'ia', { timeout: 175000 })({ tipo, dados });
  return resposta.data.saida;
}
function erroIA(e) {
  const c = String((e && e.code) || '');
  console.warn('ia', e);
  if (c === 'local') return 'A IA funciona no site publicado, com a sua conta conectada.';
  if (!navigator.onLine) return 'Sem conexão com a internet.';
  if (c === 'functions/not-found') return 'A IA ainda não foi ativada neste site.';
  if (c === 'functions/deadline-exceeded') return 'A IA demorou demais para responder. Tente de novo.';
  // Erros que o servidor já explica em português
  const explicado = /^functions\/(resource-exhausted|failed-precondition|permission-denied|unauthenticated|invalid-argument|unavailable|internal)$/.test(c);
  if (explicado && e.message && !/^internal$/i.test(e.message)) return e.message;
  return 'Não consegui falar com a IA agora. Tente de novo em instantes.';
}
const avisoIALocal = () => (iaDisponivel() ? '' : '<p class="aviso">A IA funciona no site publicado, com a sua conta conectada. Aqui, aberto direto do computador, ela fica desligada.</p>');

/* ───────── Diário: contas ───────── */
const diarioDoDia = data => (estado.diario || []).filter(x => x.data === data);
const somaDiario = lista => lista.reduce((t, x) => ({ kcal: t.kcal + (x.kcal || 0), p: t.p + (x.p || 0), c: t.c + (x.c || 0), g: t.g + (x.g || 0) }), { kcal: 0, p: 0, c: 0, g: 0 });
// Médias dos dias que têm registro, entre duas datas (inclusive)
function resumoDiario(de, ate) {
  const porDia = {};
  (estado.diario || []).filter(x => x.data >= de && x.data <= ate).forEach(x => { (porDia[x.data] = porDia[x.data] || []).push(x); });
  const dias = Object.keys(porDia).sort();
  if (!dias.length) return { dias: 0 };
  const totais = dias.map(d => somaDiario(porDia[d]));
  const media = k => arred(totais.reduce((t, x) => t + x[k], 0) / dias.length, k === 'kcal' ? 0 : 1);
  return { dias: dias.length, kcalMedia: media('kcal'), proteinaMedia: media('p'), carboMedia: media('c'), gorduraMedia: media('g') };
}
// Gasto diário real: o que a pessoa comeu, corrigido pelo que o peso fez no período (1 kg ≈ 7700 kcal)
function gastoReal(de, ate) {
  const r = resumoDiario(de, ate);
  const pesos = (estado.medidas || []).filter(m => m.data >= de && m.data <= ate && m.peso != null);
  if (r.dias < 10 || pesos.length < 2) return null;
  const dias = diasEntre(pesos[0].data, pesos[pesos.length - 1].data);
  if (dias < 14) return null;
  const variacao = pesos[pesos.length - 1].peso - pesos[0].peso;
  return { kcal: Math.round(r.kcalMedia - variacao * 7700 / dias), diasDeDiario: r.dias, diasEntrePesagens: dias, variacaoPesoKg: arred(variacao, 1) };
}

/* ───────── Dados enviados à IA ───────── */
function retratoParaIA() {
  const p = estado.perfil, a = analise(), pl = planoAlimentar(p, a), hoje = hojeISO();
  const sessoes = estado.sessoes || [];
  return {
    hoje,
    pessoa: {
      sexo: a.sexo === 'F' ? 'feminino' : 'masculino', idade: a.idade, alturaCm: a.alturaCm,
      objetivo: OBJETIVOS[a.objetivo].nome, nivelDeTreino: NIVEIS[p.nivel], treinosPorSemanaPlanejados: a.dias,
      rotinaForaDoTreino: (ROTINAS[p.rotina] || ROTINAS.sedentaria).nome || p.rotina,
      cuidados: (p.restricoes || []).map(k => RESTRICOES[k]), alimentacao: p.dieta === 'vegetariana' ? 'vegetariana' : 'come de tudo'
    },
    numerosAtuais: {
      pesoKg: a.peso, imc: arred(a.imc, 1), imcClasse: a.imcClasse.rotulo,
      gorduraCorporalPct: arred(a.gordura, 1), gorduraMedidaNaBalanca: a.gorduraMedida, gorduraClasse: a.gorduraClasse.rotulo,
      gorduraFaixaNormalPct: [a.faixas[0].ate, arred(a.faixas[1].ate - 0.1, 1)],
      gorduraAbdominalNivel: a.visceral, gorduraAbdominalClasse: a.visceralClasse ? a.visceralClasse.rotulo : null, gorduraAbdominalNormal: 'até 9',
      musculoEsqueleticoPct: a.musculo, musculoClasse: a.musculoClasse ? a.musculoClasse.rotulo : null,
      musculoFaixaNormalPct: a.musculoClasse ? [a.musculoClasse.faixaNormal[0], arred(a.musculoClasse.faixaNormal[1] - 0.1, 1)] : null,
      massaMagraKg: arred(a.massaMagra, 1), metabolismoRepousoKcal: Math.round(a.tmb), gastoDiarioEstimadoKcal: Math.round(a.gastoDiario)
    },
    medicoes: (estado.medidas || []).slice(-10).map(m => ({ data: m.data, pesoKg: m.peso, gorduraPct: m.gordura, gorduraAbdominal: m.visceral, musculoPct: m.musculo, repousoKcal: m.tmb })),
    treino: {
      concluidosUltimos7Dias: sessoes.filter(s => s.data > dataMenos(hoje, 7)).length,
      concluidosUltimos28Dias: sessoes.filter(s => s.data > dataMenos(hoje, 28)).length,
      ultimos: sessoes.slice(-6).map(s => ({ data: s.data, treino: s.titulo || s.dia, seriesFeitas: s.feitas, seriesPlanejadas: s.total, minutos: s.minutos }))
    },
    metaAlimentar: { kcal: pl.kcal, proteinaG: pl.proteina, carboG: pl.carbo, gorduraG: pl.gordura, reestruturadaEm: p.planoAjuste ? p.planoAjuste.desde : null },
    pesoReferencia: arred(pl.pesoRef, 1)
  };
}
function dadosAnalise() {
  const hoje = hojeISO(), d = retratoParaIA(), anterior = (estado.analises || []).slice(-1)[0];
  d.diarioAlimentar = { ultimos7Dias: resumoDiario(dataMenos(hoje, 6), hoje), ultimos28Dias: resumoDiario(dataMenos(hoje, 27), hoje) };
  d.analiseAnterior = anterior && anterior.data !== hoje ? { data: anterior.data, metaDaSemana: anterior.meta_semana } : null;
  return d;
}
const inicioDoPlano = () => estado.planoDesde || (estado.medidas[0] && estado.medidas[0].data) || hojeISO();
function dadosReestruturar() {
  const hoje = hojeISO(), de = inicioDoPlano(), d = retratoParaIA();
  d.periodo = { inicioDoPlanoAtual: de, dias: diasEntre(de, hoje) };
  d.diarioAlimentarNoPeriodo = resumoDiario(de, hoje);
  d.gastoReal = gastoReal(de, hoje);
  // últimas refeições registradas, para a IA sugerir trocas concretas
  d.exemplosDoDiario = (estado.diario || []).filter(x => x.data >= de).slice(-30).map(x => ({ data: x.data, refeicao: x.refeicao, oQue: x.texto.slice(0, 160), kcal: x.kcal, proteinaG: x.p }));
  return d;
}

/* ───────── Análise semanal ───────── */
async function gerarAnalise() {
  if (ui.iaOcupada) return;
  ui.iaOcupada = 'analise'; ui.iaErro = ''; render();
  try {
    const saida = await chamarIA('analise', dadosAnalise()), hoje = hojeISO();
    estado.analises = (estado.analises || []).filter(x => x.data !== hoje).concat([Object.assign({ data: hoje }, saida)]).slice(-20);
    salvar(); toast('Análise da semana pronta.');
  } catch (e) { ui.iaErro = erroIA(e); }
  ui.iaOcupada = ''; render();
}
const ICONE_DESTAQUE = { bom: 'check', atencao: 'alerta', alerta: 'alerta', info: 'info' };
function corpoAnalise(x) {
  const lista = (titulo, itens) => (itens && itens.length ? `<div><h3>${titulo}</h3><ul class="lista">${itens.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : '');
  return `<p class="resumo-ia">${esc(x.resumo)}</p>
    <ul class="pontos">${(x.destaques || []).map(d => `<li class="${esc(d.tipo)}"><span class="marca-p">${ic(ICONE_DESTAQUE[d.tipo] || 'info', 'p')}</span><span>${esc(d.texto)}</span></li>`).join('')}</ul>
    <div class="duas ia-colunas">${lista('Treino', x.treino)}${lista('Alimentação', x.alimentacao)}</div>
    ${x.meta_semana ? `<div class="meta-semana"><span class="mini">Meta da semana</span><b>${esc(x.meta_semana)}</b></div>` : ''}`;
}
// Quantos dias faz da última medição; null se não há medição
const diasDaUltimaMedida = () => { const m = (estado.medidas || []).slice(-1)[0]; return m ? diasEntre(m.data, hojeISO()) : null; };
function cartaoAnalise() {
  const lista = estado.analises || [], ultima = lista[lista.length - 1], ocupada = ui.iaOcupada === 'analise';
  const dias = diasDaUltimaMedida();
  const lembrete = dias === null ? 'Lance a sua primeira medição abaixo.'
    : dias >= 7 ? `Faz ${dias} dias da última medição. Lance a bioimpedância desta semana e peça a análise.`
    : `Última medição há ${dias === 0 ? 'menos de um dia' : dias === 1 ? '1 dia' : dias + ' dias'}. A próxima é em ${7 - dias} ${7 - dias === 1 ? 'dia' : 'dias'}.`;
  const anteriores = lista.slice(0, -1).reverse();
  return `<div class="card ia"><div class="cabecalho" style="margin-bottom:12px"><div><span class="selo-ia">${ic('raio', 'p')}Análise de IA</span>
        <h2 style="margin-top:8px">${ultima ? 'Análise de ' + dataBR(ultima.data) : 'Análise da semana'}</h2><p class="suave pequeno">${lembrete}</p></div>
      <div class="acoes"><button class="btn primario" data-acao="gerar-analise" ${ocupada || !estado.medidas.length ? 'disabled' : ''}>${ic('raio', 'p')}${ocupada ? 'Analisando…' : ultima ? 'Atualizar análise' : 'Gerar análise'}</button></div></div>
    ${ocupada ? '<p class="suave" role="status">A IA está lendo suas medições, seus treinos e sua alimentação. Leva até um minuto.</p>' : ''}
    ${ui.iaErro && !ocupada ? `<p class="aviso erro" role="alert">${esc(ui.iaErro)}</p>` : ''}
    ${ultima ? corpoAnalise(ultima) : `<p class="suave">Toda semana, depois de lançar a bioimpedância, a IA compara com as medições anteriores, olha os treinos concluídos e o que você registrou de alimentação, e diz o que ajustar.</p>${avisoIALocal()}`}
    ${anteriores.length ? `<details class="anteriores"><summary>Análises anteriores (${anteriores.length})</summary>${anteriores.map(x => `<div class="anterior"><h3>${dataBR(x.data)}</h3>${corpoAnalise(x)}</div>`).join('')}</details>` : ''}
    <p class="mini suave" style="margin-top:14px">A IA recebe seus números, treinos e registros de alimentação, sem nome nem e-mail. É orientação geral, não substitui médico ou nutricionista.</p></div>`;
}
// Resumo no Painel
function cartaoSemana() {
  const dias = diasDaUltimaMedida(), ultima = (estado.analises || []).slice(-1)[0];
  const atrasada = dias === null || dias >= 7;
  return `<div class="card ${atrasada ? 'chamada' : ''}"><span class="selo-ia">${ic('raio', 'p')}Semana</span>
    <h2 style="margin:8px 0 4px">${atrasada ? 'Hora da medição da semana' : ultima ? 'Meta da semana' : 'Medição em dia'}</h2>
    <p class="${atrasada ? '' : 'suave'}">${atrasada ? (dias === null ? 'Lance a bioimpedância para começar o acompanhamento.' : `Faz ${dias} dias da última. Lance a bioimpedância e receba a análise de IA.`)
      : ultima ? esc(ultima.meta_semana) : `Próxima medição em ${7 - dias} ${7 - dias === 1 ? 'dia' : 'dias'}.`}</p>
    <div class="acoes" style="margin-top:12px"><a class="btn ${atrasada ? 'primario' : ''}" href="#/evolucao">${atrasada ? 'Lançar medição' : 'Ver análise'}</a></div></div>`;
}

/* ───────── Diário alimentar ───────── */
function rascunhoDiario() {
  if (!ui.diario) ui.diario = { data: hojeISO(), refeicao: 'Almoço', texto: '', erro: '', manual: false, nome: '', kcal: '', p: '' };
  return ui.diario;
}
async function calcularRefeicao() {
  const d = rascunhoDiario(), texto = d.texto.trim();
  d.erro = '';
  if (!d.data || d.data > hojeISO()) d.erro = 'Escolha uma data até hoje.';
  else if (texto.length < 3) d.erro = 'Escreva o que você comeu.';
  else if (texto.length > 1500) d.erro = 'Texto longo demais. Registre uma refeição por vez.';
  if (d.erro) { render(); return; }
  ui.iaOcupada = 'refeicao'; render();
  try {
    const s = await chamarIA('refeicao', { refeicao: d.refeicao, texto });
    const itens = (s.itens || []).map(i => ({ nome: String(i.alimento).slice(0, 80), qtd: String(i.quantidade).slice(0, 80), kcal: Math.max(0, Math.round(i.kcal)), p: Math.max(0, arred(i.proteina, 1)), c: Math.max(0, arred(i.carbo, 1)), g: Math.max(0, arred(i.gordura, 1)) }));
    if (!itens.length) d.erro = s.observacao || 'Não encontrei alimentos nesse texto.';
    else {
      registrarNoDiario({ data: d.data, refeicao: d.refeicao, texto, itens, obs: String(s.observacao || '').slice(0, 300), fonte: 'ia' });
      d.texto = ''; toast('Refeição registrada.');
    }
  } catch (e) { d.erro = erroIA(e); }
  ui.iaOcupada = ''; render();
}
function registrarNoDiario(x) {
  const t = somaDiario(x.itens);
  estado.diario = (estado.diario || []).concat([Object.assign({ id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), kcal: Math.round(t.kcal), p: arred(t.p, 1), c: arred(t.c, 1), g: arred(t.g, 1) }, x)])
    .filter(e => e.data >= dataMenos(hojeISO(), 200))             // guarda cerca de seis meses
    .sort((a, b) => a.data.localeCompare(b.data));
  salvar();
}
function salvarManual() {
  const d = rascunhoDiario(), kcal = num(d.kcal), p = num(d.p), nome = d.nome.trim();
  d.erro = '';
  if (!d.data || d.data > hojeISO()) d.erro = 'Escolha uma data até hoje.';
  else if (!nome) d.erro = 'Escreva o que você comeu.';
  else if (kcal === null || kcal < 0 || kcal > 5000) d.erro = 'Informe as calorias, entre 0 e 5000.';
  else if (p !== null && (p < 0 || p > 400)) d.erro = 'A proteína precisa estar entre 0 e 400 g.';
  if (d.erro) { render(); return; }
  registrarNoDiario({ data: d.data, refeicao: d.refeicao, texto: nome.slice(0, 200), itens: [{ nome: nome.slice(0, 80), qtd: '', kcal: Math.round(kcal), p: p || 0, c: 0, g: 0 }], obs: '', fonte: 'manual' });
  d.nome = ''; d.kcal = ''; d.p = ''; render(); toast('Refeição registrada.');
}
function barraMeta(rotulo, valor, meta, un) {
  const pct = meta ? Math.min(100, valor / meta * 100) : 0, passou = meta && valor > meta * 1.05;
  return `<div class="barra-meta"><div class="linha-meta"><span>${rotulo}</span><span><b>${n0(valor)}</b> de ${n0(meta)} ${un}</span></div>
    <div class="progresso ${passou ? 'passou' : ''}" role="img" aria-label="${rotulo}: ${n0(valor)} de ${n0(meta)} ${un}"><i style="width:${pct.toFixed(0)}%"></i></div></div>`;
}
function secaoDiario(pl) {
  const d = rascunhoDiario(), hoje = hojeISO(), doDia = diarioDoDia(d.data), t = somaDiario(doDia), ocupada = ui.iaOcupada === 'refeicao';
  const semana = Array.from({ length: 7 }, (_, i) => dataMenos(hoje, i)).map(data => ({ data, t: somaDiario(diarioDoDia(data)), n: diarioDoDia(data).length }));
  const resto = pl.kcal - t.kcal;
  const entrada = x => `<div class="entrada-diario"><div class="topo-entrada"><div><b>${esc(x.refeicao)}</b> <span class="suave">· ${n0(x.kcal)} kcal · ${n0(x.p)} g de proteína</span></div>
      <button class="btn icone" data-acao="diario-apagar" data-valor="${esc(x.id)}" aria-label="Apagar ${esc(x.refeicao)}" title="Apagar">${ic('lixo', 'p')}</button></div>
    ${x.fonte === 'ia' ? `<table class="tabela itens-diario"><tbody>${x.itens.map(i => `<tr><td>${esc(i.nome)}<br><span class="suave mini">${esc(i.qtd)}</span></td><td>${n0(i.kcal)} kcal</td><td class="so-largo">P ${n0(i.p)} · C ${n0(i.c)} · G ${n0(i.g)}</td></tr>`).join('')}</tbody></table>
      ${x.obs ? `<p class="mini suave">${esc(x.obs)}</p>` : ''}` : `<p class="suave pequeno">${esc(x.texto)}</p>`}</div>`;
  return `<div class="secao" id="diario"><div class="cabecalho" style="margin-bottom:12px"><div><h2>O que eu comi</h2><p class="suave pequeno">Escreva do seu jeito e a IA calcula calorias e macros. Em um mês, esses registros servem para reestruturar o plano.</p></div></div>
    <div class="duas">
      <div class="card"><div class="grade-campos diario-topo">
          <label class="campo"><span>Dia</span><input class="entrada" id="d-data" type="date" value="${esc(d.data)}" max="${hoje}"></label>
          <label class="campo"><span>Refeição</span><select class="entrada" id="d-refeicao">${REFEICOES_DIARIO.map(r => `<option ${r === d.refeicao ? 'selected' : ''}>${r}</option>`).join('')}</select></label></div>
        ${d.manual ? `<div class="grade-campos" style="margin-top:14px">
            <label class="campo"><span>O que foi</span><input class="entrada" id="d-nome" value="${esc(d.nome)}" maxlength="200" placeholder="Prato feito do restaurante"></label>
            <label class="campo"><span>Calorias</span><div class="com-unidade"><input class="entrada" id="d-kcal" inputmode="numeric" value="${esc(d.kcal)}" placeholder="650"><i>kcal</i></div></label>
            <label class="campo"><span>Proteína (opcional)</span><div class="com-unidade"><input class="entrada" id="d-p" inputmode="decimal" value="${esc(d.p)}" placeholder="35"><i>g</i></div></label></div>`
          : `<label class="campo" style="margin-top:14px"><span>O que você comeu</span>
            <textarea class="entrada" id="d-texto" rows="4" maxlength="1500" placeholder="Ex.: 2 colheres de arroz, 1 concha de feijão, 1 bife grelhado médio, salada com azeite e 1 copo de suco de laranja">${esc(d.texto)}</textarea></label>`}
        ${d.erro ? `<p class="aviso erro" role="alert" style="margin-top:12px">${esc(d.erro)}</p>` : ''}
        <div class="acoes" style="margin-top:14px">
          ${d.manual ? '<button class="btn primario" data-acao="diario-manual-salvar">Registrar</button>'
            : `<button class="btn primario" data-acao="diario-calcular" ${ocupada ? 'disabled' : ''}>${ic('raio', 'p')}${ocupada ? 'Calculando…' : 'Calcular calorias'}</button>`}
          <button class="link" data-acao="diario-modo">${d.manual ? 'Deixar a IA calcular' : 'Já sei as calorias: digitar'}</button></div>
        ${d.manual ? '' : avisoIALocal()}</div>
      <div class="card"><h2>${d.data === hoje ? 'Hoje' : dataBR(d.data)}</h2>
        ${barraMeta('Calorias', t.kcal, pl.kcal, 'kcal')}${barraMeta('Proteína', t.p, pl.proteina, 'g')}
        <p class="suave pequeno" style="margin-top:10px">${!doDia.length ? 'Nada registrado neste dia.' : resto >= 0 ? `Faltam ${n0(resto)} kcal para a meta.` : `Passou ${n0(-resto)} kcal da meta.`} ${doDia.length ? `Carboidrato ${n0(t.c)} g · gordura ${n0(t.g)} g.` : ''}</p>
        <div class="pilha entradas-diario">${doDia.map(entrada).join('')}</div></div>
    </div>
    <div class="card rolagem-x" style="margin-top:16px"><h2>Últimos 7 dias</h2><table class="tabela"><tr><th>Dia</th><th>Calorias</th><th>Meta</th><th>Diferença</th><th>Proteína</th></tr>
      ${semana.map(x => `<tr><td>${x.data === hoje ? 'Hoje' : dataBR(x.data)}</td><td>${x.n ? n0(x.t.kcal) + ' kcal' : '–'}</td><td>${n0(pl.kcal)} kcal</td><td>${x.n ? (x.t.kcal - pl.kcal > 0 ? '+' : '−') + n0(Math.abs(x.t.kcal - pl.kcal)) : '–'}</td><td>${x.n ? n0(x.t.p) + ' g' : '–'}</td></tr>`).join('')}</table></div>
  </div>`;
}

/* ───────── Reestruturar a alimentação ───────── */
// Mantém a proposta da IA dentro de limites seguros e faz as contas fecharem
function ajustarProposta(s, a, pl) {
  const piso = a.sexo === 'F' ? 1200 : 1500, ref = pl.pesoRef || a.peso;
  const entre = (v, min, max) => Math.min(max, Math.max(min, v));
  let kcal = entre(Math.round((num(s.kcal) || pl.kcal) / 10) * 10, Math.max(piso, pl.kcal - 400), Math.max(piso, Math.min(pl.kcal + 400, Math.round(a.gastoDiario * 1.25))));
  const proteina = Math.round(entre(num(s.proteina) || pl.proteina, ref * 1.4, ref * 2.4));
  let gordura = Math.round(entre(num(s.gordura) || pl.gordura, ref * 0.5, ref * 1.2));
  let carbo = Math.round((kcal - proteina * 4 - gordura * 9) / 4);
  if (carbo < 50) { carbo = 50; gordura = Math.max(Math.round(ref * 0.5), Math.round((kcal - proteina * 4 - carbo * 4) / 9)); }
  kcal = Math.max(piso, Math.round((proteina * 4 + carbo * 4 + gordura * 9) / 10) * 10);
  return { kcal, proteina, carbo, gordura, resumo: String(s.resumo || '').slice(0, 900), mudancas: (s.mudancas || []).slice(0, 6).map(t => String(t).slice(0, 400)), cuidados: (s.cuidados || []).slice(0, 3).map(t => String(t).slice(0, 400)) };
}
async function pedirReestruturacao() {
  if (ui.iaOcupada) return;
  const dias = diasEntre(inicioDoPlano(), hojeISO());
  if (dias < DIAS_PARA_REESTRUTURAR && !confirm(`O plano atual tem ${dias} ${dias === 1 ? 'dia' : 'dias'}. O ideal é esperar ${DIAS_PARA_REESTRUTURAR} dias para o corpo mostrar o resultado antes de mudar.\n\nReestruturar agora mesmo assim?`)) return;
  ui.iaOcupada = 'reestruturar'; ui.iaErroPlano = ''; render();
  try {
    const p = estado.perfil, a = analise(), pl = planoAlimentar(p, a);
    ui.proposta = { atual: { kcal: pl.kcal, proteina: pl.proteina, carbo: pl.carbo, gordura: pl.gordura }, nova: ajustarProposta(await chamarIA('reestruturar', dadosReestruturar()), a, pl), real: gastoReal(inicioDoPlano(), hojeISO()) };
    ui.iaOcupada = ''; render(); modalProposta();
  } catch (e) { ui.iaErroPlano = erroIA(e); ui.iaOcupada = ''; render(); }
}
function modalProposta() {
  const x = ui.proposta; if (!x) return;
  const linha = (rot, k, un) => { const d = x.nova[k] - x.atual[k]; return `<tr><td>${rot}</td><td>${n0(x.atual[k])} ${un}</td><td><b>${n0(x.nova[k])} ${un}</b></td><td>${d === 0 ? 'igual' : (d > 0 ? '+' : '−') + n0(Math.abs(d)) + ' ' + un}</td></tr>`; };
  abrirModal(`${topoModal('Novo plano proposto')}<div class="miolo solto">
    <p>${esc(x.nova.resumo)}</p>
    <div class="rolagem-x" style="margin-top:14px"><table class="tabela"><tr><th></th><th>Hoje</th><th>Proposto</th><th>Mudança</th></tr>
      ${linha('Calorias', 'kcal', 'kcal')}${linha('Proteína', 'proteina', 'g')}${linha('Carboidrato', 'carbo', 'g')}${linha('Gordura', 'gordura', 'g')}</table></div>
    ${x.real ? `<p class="aviso" style="margin-top:14px">Pelo que você registrou em ${x.real.diasDeDiario} dias e pela variação de ${n1(Math.abs(x.real.variacaoPesoKg))} kg ${x.real.variacaoPesoKg > 0 ? 'a mais' : 'a menos'} em ${x.real.diasEntrePesagens} dias, seu gasto real é de cerca de ${n0(x.real.kcal)} kcal por dia.</p>`
      : '<p class="aviso" style="margin-top:14px">Sem pelo menos 10 dias de diário e duas pesagens com 14 dias de intervalo, o gasto real não pôde ser calculado; a proposta usa a estimativa por fórmula e as medições.</p>'}
    ${x.nova.mudancas.length ? `<h3 style="margin-top:16px">O que mudar no dia a dia</h3><ul class="lista">${x.nova.mudancas.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${x.nova.cuidados.length ? `<h3 style="margin-top:16px">Atenção</h3><ul class="lista">${x.nova.cuidados.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <div class="acoes" style="margin-top:20px;justify-content:flex-end"><button class="btn" data-acao="proposta-descartar">Manter o plano atual</button><button class="btn primario" data-acao="proposta-aplicar">Aplicar novo plano</button></div></div>`);
}
function cartaoReestruturar() {
  const p = estado.perfil, de = inicioDoPlano(), dias = diasEntre(de, hojeISO()), falta = DIAS_PARA_REESTRUTURAR - dias, pronto = falta <= 0;
  const ocupada = ui.iaOcupada === 'reestruturar', r = resumoDiario(de, hojeISO());
  return `<div class="card ${pronto ? 'chamada' : ''}"><span class="selo-ia">${ic('raio', 'p')}Reestruturar com IA</span>
    <h2 style="margin:8px 0 4px">${pronto ? 'Hora de reestruturar a alimentação' : 'Reestruturação da alimentação'}</h2>
    <p class="${pronto ? '' : 'suave'}">${pronto ? `O plano atual tem ${dias} dias. A IA olha suas medições e o que você comeu e propõe as novas metas.`
      : `Disponível em ${falta} ${falta === 1 ? 'dia' : 'dias'}: o plano precisa de ${DIAS_PARA_REESTRUTURAR} dias para mostrar resultado. Você está no dia ${dias}.`}</p>
    <p class="mini suave" style="margin-top:6px">${r.dias ? `${r.dias} ${r.dias === 1 ? 'dia registrado' : 'dias registrados'} no diário desde ${dataBR(de)}, média de ${n0(r.kcalMedia)} kcal.` : 'Nenhuma refeição registrada neste período. Com o diário preenchido, o ajuste fica mais preciso.'}</p>
    ${p.planoAjuste ? `<p class="aviso" style="margin-top:12px">Plano reestruturado em ${dataBR(p.planoAjuste.desde)}. ${esc(p.planoAjuste.resumo || '')} <button class="link" data-acao="plano-automatico">Voltar ao cálculo automático</button></p>` : ''}
    ${ui.iaErroPlano && !ocupada ? `<p class="aviso erro" role="alert" style="margin-top:12px">${esc(ui.iaErroPlano)}</p>` : ''}
    <div class="acoes" style="margin-top:12px"><button class="btn ${pronto ? 'primario' : ''}" data-acao="reestruturar" ${ocupada ? 'disabled' : ''}>${ic('raio', 'p')}${ocupada ? 'Analisando o mês…' : pronto ? 'Reestruturar alimentação' : 'Reestruturar agora'}</button></div>
    ${avisoIALocal()}</div>`;
}

/* ───────── Ações (entram no mapa de ações de app.js) ───────── */
const ACOES_IA = {
  'gerar-analise'() { gerarAnalise(); },
  'diario-calcular'() { if (!ui.iaOcupada) calcularRefeicao(); },
  'diario-manual-salvar'() { salvarManual(); },
  'diario-modo'() { const d = rascunhoDiario(); d.manual = !d.manual; d.erro = ''; render(); },
  'diario-apagar'(el) { estado.diario = (estado.diario || []).filter(x => x.id !== el.dataset.valor); salvar(); render(); },
  reestruturar() { pedirReestruturacao(); },
  'proposta-descartar'() { ui.proposta = null; fecharModal(); },
  'proposta-aplicar'() {
    const x = ui.proposta; if (!x) return;
    estado.perfil.planoAjuste = { kcal: x.nova.kcal, proteina: x.nova.proteina, carbo: x.nova.carbo, gordura: x.nova.gordura, desde: hojeISO(), resumo: x.nova.resumo, mudancas: x.nova.mudancas };
    estado.planoDesde = hojeISO(); ui.proposta = null;
    salvar(); fecharModal(); render(); toast('Novo plano aplicado.');
  },
  'plano-automatico'() {
    if (!confirm('Voltar às metas calculadas pelo site, sem o ajuste da IA?')) return;
    delete estado.perfil.planoAjuste; salvar(); render(); toast('Metas voltaram ao cálculo automático.');
  }
};
// Campos do diário: guardam o que está sendo digitado para sobreviver às atualizações de tela
function campoDiario(t) {
  const mapa = { 'd-texto': 'texto', 'd-nome': 'nome', 'd-kcal': 'kcal', 'd-p': 'p', 'd-data': 'data', 'd-refeicao': 'refeicao' };
  if (!mapa[t.id]) return false;
  rascunhoDiario()[mapa[t.id]] = t.value;
  return true;
}
