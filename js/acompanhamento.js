'use strict';
/* Acompanhamento: análise da semana, diário do que a pessoa comeu (com cálculo de calorias pela tabela de
   alimentos) e reestruturação das metas de alimentação depois de um mês. Tudo é calculado aqui, por regras
   e fórmulas; nada é enviado para fora do site.
   Este arquivo é carregado antes de app.js e usa as funções dele só na hora em que é chamado. */

const REFEICOES_DIARIO = ['Café da manhã', 'Almoço', 'Lanche', 'Jantar', 'Ceia', 'Outro'];
const DIAS_PARA_REESTRUTURAR = 28;

const dataMenos = (iso, dias) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - dias); return d.toISOString().slice(0, 10); };
const diasEntre = (de, ate) => Math.round((new Date(ate + 'T12:00:00') - new Date(de + 'T12:00:00')) / 86400000);
const arred = (v, casas) => { const f = Math.pow(10, casas || 0); return Math.round(v * f) / f; };
const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/* ───────── Tabela de alimentos do diário ─────────
   Valores por 100 g (ou 100 ml) do alimento pronto para consumo, da tabela TACO (4ª edição) e, onde ela não cobre,
   da TBCA/USP ou da USDA. Conferidos nas fontes em novembro de 2026; itens genéricos (bolo, castanhas, salada) são médias. [nome, kcal, proteína, carboidrato, gordura, porção caseira, gramas da porção, outras palavras de busca] */
const TABELA_ALIMENTOS = [
  // Arroz, feijão, massas e raízes
  ['Arroz branco cozido', 128, 2.5, 28.1, 0.2, 'colher de servir', 45, ''],
  ['Arroz integral cozido', 124, 2.6, 25.8, 1.0, 'colher de servir', 45, ''],
  ['Feijão carioca cozido', 76, 4.8, 13.6, 0.5, 'concha', 100, ''],
  ['Feijão preto cozido', 77, 4.5, 14.0, 0.5, 'concha', 100, ''],
  ['Macarrão cozido', 158, 5.8, 30.9, 0.9, 'pegador', 110, 'massa espaguete'],
  ['Batata cozida', 52, 1.2, 11.9, 0, 'unidade média', 130, 'batata inglesa'],
  ['Batata-doce cozida', 77, 0.6, 18.4, 0.1, 'fatia grossa', 70, ''],
  ['Batata frita', 267, 5.0, 35.6, 13.1, 'porção pequena', 100, 'fritas'],
  ['Purê de batata', 110, 2.0, 15.0, 4.5, 'colher de servir', 60, 'pure'],
  ['Mandioca cozida', 125, 0.6, 30.1, 0.3, 'pedaço', 100, 'aipim macaxeira'],
  ['Mandioca frita', 300, 1.4, 50.3, 11.2, 'porção pequena', 100, 'aipim macaxeira frito'],
  ['Cuscuz de milho', 113, 2.2, 25.3, 0.7, 'fatia', 135, ''],
  ['Tapioca pronta, sem recheio', 289, 0, 71.9, 0, 'unidade média', 50, 'beiju goma'],
  ['Aveia em flocos', 394, 13.9, 66.6, 8.5, 'colher de sopa', 15, ''],
  ['Granola', 420, 9.0, 65.0, 14.0, 'colher de sopa', 15, ''],
  ['Farofa', 406, 2.1, 80.3, 9.1, 'colher de sopa', 15, 'farinha'],
  // Pães e biscoitos
  ['Pão francês', 300, 8.0, 58.6, 3.1, 'unidade', 50, 'pao de sal pãozinho'],
  ['Pão de forma', 253, 9.4, 49.9, 3.7, 'fatia', 25, 'pao integral'],
  ['Pão de queijo', 363, 5.1, 34.2, 24.6, 'unidade média', 40, ''],
  ['Bolo simples', 330, 5.5, 52.0, 11.0, 'fatia', 60, ''],
  ['Biscoito de água e sal', 432, 10.1, 68.7, 14.4, 'unidade', 6, 'cream cracker bolacha'],
  ['Biscoito recheado', 472, 6.4, 70.5, 19.6, 'unidade', 13, 'bolacha'],
  // Carnes, aves, peixes e ovos
  ['Peito de frango grelhado', 159, 32.0, 0, 2.5, 'filé médio', 120, 'file de frango'],
  ['Sobrecoxa de frango assada', 230, 26.0, 0, 13.0, 'unidade', 100, 'coxa'],
  ['Frango empanado frito', 284, 25.5, 15.5, 13.5, 'filé', 100, 'milanesa'],
  ['Bife grelhado', 241, 31.9, 0, 11.6, 'bife médio', 100, 'alcatra contrafilé carne'],
  ['Carne moída refogada', 212, 26.7, 0, 10.9, 'colher de servir', 45, 'acém'],
  ['Carne assada ou cozida', 215, 27.0, 0, 11.0, 'pedaço', 100, 'músculo acém panela'],
  ['Picanha grelhada', 289, 26.0, 0, 20.0, 'fatia', 80, 'churrasco'],
  ['Linguiça grelhada', 296, 23.2, 0, 21.9, 'gomo', 60, 'calabresa'],
  ['Bisteca de porco grelhada', 280, 28.9, 0, 17.4, 'bisteca', 100, 'carne suína'],
  ['Lombo de porco assado', 210, 35.7, 0, 6.4, 'fatia', 80, 'carne suína'],
  ['Hambúrguer bovino', 210, 13.2, 11.3, 12.4, 'unidade', 80, 'hamburguer'],
  ['Salsicha', 257, 11.0, 3.0, 22.0, 'unidade', 50, 'hot dog'],
  ['Peixe grelhado (tilápia)', 128, 26.0, 0, 2.7, 'filé', 120, 'file de peixe'],
  ['Peixe frito', 220, 24.0, 6.0, 11.0, 'filé', 120, ''],
  ['Salmão grelhado', 229, 23.9, 0, 14.0, 'posta', 120, ''],
  ['Atum em água', 116, 26.0, 0, 1.0, 'lata', 120, 'enlatado'],
  ['Sardinha em óleo', 285, 15.9, 0, 24.0, 'lata', 85, 'enlatada'],
  ['Ovo cozido', 146, 13.3, 0.6, 9.5, 'unidade', 50, ''],
  ['Ovo frito ou mexido', 240, 15.6, 1.2, 18.6, 'unidade', 50, 'omelete'],
  ['Presunto', 94, 14.0, 2.0, 3.0, 'fatia', 15, ''],
  ['Peito de peru', 105, 17.0, 3.0, 2.5, 'fatia', 15, ''],
  ['Mortadela', 269, 12.0, 5.8, 21.6, 'fatia', 15, ''],
  // Leite e derivados
  ['Leite integral', 61, 3.2, 4.7, 3.3, 'copo', 200, ''],
  ['Leite desnatado', 35, 3.4, 5.0, 0.2, 'copo', 200, ''],
  ['Iogurte natural', 51, 4.1, 1.9, 3.0, 'pote', 170, ''],
  ['Iogurte natural desnatado', 41, 3.8, 5.8, 0.3, 'pote', 170, ''],
  ['Iogurte de fruta', 85, 2.7, 14.0, 2.0, 'pote', 170, 'adoçado'],
  ['Queijo muçarela', 330, 22.6, 3.0, 25.2, 'fatia', 20, 'mussarela'],
  ['Queijo minas frescal', 264, 17.4, 3.2, 20.2, 'fatia', 30, 'branco'],
  ['Queijo cottage', 98, 11.0, 3.4, 4.3, 'colher de sopa', 30, ''],
  ['Requeijão', 257, 9.6, 2.4, 23.4, 'colher de sopa', 30, ''],
  ['Manteiga', 726, 0.4, 0.1, 82.4, 'ponta de faca', 5, ''],
  ['Margarina', 596, 0, 0, 67.0, 'ponta de faca', 5, ''],
  ['Whey protein', 400, 80.0, 8.0, 6.0, 'dose', 30, 'proteína em pó suplemento'],
  // Frutas e vegetais
  ['Banana', 98, 1.3, 26.0, 0.1, 'unidade', 80, ''],
  ['Maçã', 56, 0.3, 15.2, 0, 'unidade', 130, 'maca'],
  ['Laranja', 45, 1.0, 11.5, 0.1, 'unidade', 140, ''],
  ['Mamão', 40, 0.5, 10.4, 0.1, 'fatia', 150, ''],
  ['Abacaxi', 48, 0.9, 12.3, 0.1, 'fatia', 80, ''],
  ['Manga', 64, 0.4, 16.7, 0.3, 'unidade pequena', 200, ''],
  ['Melancia', 33, 0.9, 8.1, 0, 'fatia', 200, ''],
  ['Uva', 53, 0.7, 13.6, 0.2, 'cacho pequeno', 100, ''],
  ['Morango', 30, 0.9, 6.8, 0.3, '10 unidades', 120, ''],
  ['Abacate', 96, 1.2, 6.0, 8.4, 'colher de sopa', 30, ''],
  ['Salada de folhas e tomate', 18, 1.1, 3.5, 0.2, 'prato', 100, 'alface'],
  ['Legumes cozidos', 30, 2.0, 6.0, 0.3, 'colher de servir', 50, 'cenoura brócolis abobrinha chuchu'],
  // Gorduras e oleaginosas
  ['Azeite de oliva', 884, 0, 0, 100, 'colher de sopa', 12, ''],
  ['Óleo de cozinha', 884, 0, 0, 100, 'colher de sopa', 12, 'soja'],
  ['Castanhas', 600, 16.0, 20.0, 52.0, 'punhado', 30, 'caju pará nozes'],
  ['Amendoim', 544, 27.2, 20.3, 43.9, 'punhado', 30, ''],
  ['Pasta de amendoim', 590, 25.0, 20.0, 50.0, 'colher de sopa', 15, ''],
  // Açúcar, doces e bebidas
  ['Açúcar', 387, 0, 99.5, 0, 'colher de chá', 5, 'acucar'],
  ['Achocolatado em pó', 401, 4.2, 91.0, 2.2, 'colher de sopa', 15, 'nescau toddy'],
  ['Chocolate ao leite', 540, 7.2, 59.6, 30.3, 'barra pequena', 25, ''],
  ['Doce de leite', 306, 5.5, 59.5, 6.0, 'colher de sopa', 20, ''],
  ['Sorvete', 200, 3.5, 24.0, 11.0, 'bola', 60, ''],
  ['Açaí adoçado', 110, 0.7, 21.5, 3.7, 'tigela', 300, 'acai'],
  ['Café sem açúcar', 2, 0.1, 0.3, 0, 'xícara', 50, 'cafe'],
  ['Suco de laranja natural', 42, 0.7, 9.5, 0.1, 'copo', 200, ''],
  ['Suco de caixinha', 50, 0, 12.0, 0, 'copo', 200, 'néctar'],
  ['Refrigerante', 39, 0, 10.0, 0, 'lata', 350, 'coca guaraná'],
  ['Refrigerante zero', 0, 0, 0, 0, 'lata', 350, 'diet'],
  ['Cerveja', 41, 0.6, 3.3, 0, 'lata', 350, ''],
  ['Vinho', 85, 0.1, 2.6, 0, 'taça', 150, ''],
  // Lanches prontos
  ['Pizza de muçarela', 260, 11.0, 30.0, 11.0, 'fatia', 120, 'mussarela'],
  ['Sanduíche x-burger', 265, 13.0, 24.0, 13.0, 'unidade', 150, 'hambúrguer lanche'],
  ['Coxinha', 283, 9.6, 34.5, 11.8, 'unidade', 110, 'salgado'],
  ['Pastel de carne', 388, 10.1, 43.8, 20.1, 'unidade', 80, 'salgado'],
  ['Misto-quente', 281, 13.7, 22.5, 15.4, 'unidade', 110, 'sanduíche queijo presunto']
].map(([nome, kcal, p, c, g, porcao, gramas, extras], i) => ({ id: 'a' + i, nome, kcal, p, c, g, porcao, gramas, busca: semAcento(nome + ' ' + extras) }));
const ALIMENTO_POR_ID = Object.fromEntries(TABELA_ALIMENTOS.map(a => [a.id, a]));

function buscarAlimentos(texto) {
  const termos = semAcento(texto).split(/\s+/).filter(Boolean);
  if (!termos.length) return [];
  return TABELA_ALIMENTOS.filter(a => termos.every(t => a.busca.includes(t)))
    .sort((a, b) => (semAcento(a.nome).startsWith(termos[0]) ? 0 : 1) - (semAcento(b.nome).startsWith(termos[0]) ? 0 : 1)).slice(0, 8);
}
// Calorias e macros de uma quantidade do alimento
function calcularItem(al, gramas) {
  const f = gramas / 100;
  return { nome: al.nome, qtd: '', gramas: Math.round(gramas), kcal: Math.round(al.kcal * f), p: arred(al.p * f, 1), c: arred(al.c * f, 1), g: arred(al.g * f, 1) };
}

/* ───────── Diário: contas ───────── */
const diarioDoDia = (data, e) => ((e || estado).diario || []).filter(x => x.data === data);
const somaDiario = lista => lista.reduce((t, x) => ({ kcal: t.kcal + (x.kcal || 0), p: t.p + (x.p || 0), c: t.c + (x.c || 0), g: t.g + (x.g || 0) }), { kcal: 0, p: 0, c: 0, g: 0 });
// Médias dos dias que têm registro, entre duas datas (inclusive)
function resumoDiario(de, ate, e) {
  const porDia = {};
  ((e || estado).diario || []).filter(x => x.data >= de && x.data <= ate).forEach(x => { (porDia[x.data] = porDia[x.data] || []).push(x); });
  const dias = Object.keys(porDia).sort();
  if (!dias.length) return { dias: 0 };
  const totais = dias.map(d => somaDiario(porDia[d]));
  const media = (k, lista) => arred(lista.reduce((t, x) => t + x[k], 0) / lista.length, k === 'kcal' ? 0 : 1);
  const fds = dias.map((d, i) => ({ d, i })).filter(x => [0, 6].includes(new Date(x.d + 'T12:00:00').getDay()));
  const semana = dias.map((d, i) => ({ d, i })).filter(x => ![0, 6].includes(new Date(x.d + 'T12:00:00').getDay()));
  return {
    dias: dias.length, kcalMedia: media('kcal', totais), proteinaMedia: media('p', totais), carboMedia: media('c', totais), gorduraMedia: media('g', totais),
    kcalFimDeSemana: fds.length >= 2 ? media('kcal', fds.map(x => totais[x.i])) : null, kcalDiasUteis: semana.length >= 2 ? media('kcal', semana.map(x => totais[x.i])) : null
  };
}
// Gasto diário real: o que a pessoa comeu, corrigido pelo que o peso fez no período (1 kg ≈ 7700 kcal)
function gastoReal(de, ate, e) {
  const r = resumoDiario(de, ate, e);
  const pesos = ((e || estado).medidas || []).filter(m => m.data >= de && m.data <= ate && m.peso != null);
  if (r.dias < 10 || pesos.length < 2) return null;
  const dias = diasEntre(pesos[0].data, pesos[pesos.length - 1].data);
  if (dias < 14) return null;
  const variacao = pesos[pesos.length - 1].peso - pesos[0].peso;
  return { kcal: Math.round(r.kcalMedia - variacao * 7700 / dias), diasDeDiario: r.dias, diasEntrePesagens: dias, variacaoPesoKg: arred(variacao, 1) };
}

/* ───────── Análise da semana ─────────
   Lê as medições, os treinos e o diário de uma pessoa (o próprio usuário ou, no painel do administrador,
   outro usuário) e monta a leitura da semana. Devolve { resumo, destaques, treino, alimentacao, meta }. */
function analiseDaSemana(e) {
  e = e || estado;
  const p = e.perfil, a = analisar(p), pl = planoAlimentar(p, a), hoje = hojeISO();
  const ms = e.medidas || [], ult = ms[ms.length - 1], ant = ms[ms.length - 2], pri = ms[0];
  const D = [], treino = [], alim = [];
  const ponto = (tipo, texto) => D.push({ tipo, texto });
  const emagrecer = a.objetivo === 'emagrecer' || a.objetivo === 'recomposicao', ganhar = a.objetivo === 'hipertrofia';
  const dif = (k, x, y) => (x && y && x[k] != null && y[k] != null ? x[k] - y[k] : null);
  const sinal = (v, casas) => (v > 0 ? '+' : '−') + br(arred(Math.abs(v), casas == null ? 1 : casas));
  let resumo;

  // Medições
  if (!ult) resumo = 'Ainda não há medição registrada. Lance o peso e a bioimpedância para começar o acompanhamento.';
  else if (!ant) {
    resumo = `Este é o seu ponto de partida: ${br(ult.peso)} kg${ult.gordura != null ? `, ${br(ult.gordura)}% de gordura corporal` : ''}. Com a medição da próxima semana já dá para ver a direção.`;
    ponto('info', 'Com uma medição só ainda não há evolução para comparar. Meça sempre no mesmo horário, de preferência de manhã e em jejum.');
  } else {
    const dias = Math.max(1, diasEntre(ant.data, ult.data)), dP = dif('peso', ult, ant), dG = dif('gordura', ult, ant), dM = dif('musculo', ult, ant), dV = dif('visceral', ult, ant);
    const pesoEstavel = Math.abs(dP) < 0.5, ritmo = dP / dias * 7, ritmoPct = Math.abs(ritmo) / ult.peso * 100;
    const partes = [];
    partes.push(pesoEstavel ? `peso estável em ${br(ult.peso)} kg` : `peso ${dP < 0 ? 'caiu' : 'subiu'} ${br(arred(Math.abs(dP), 1))} kg`);
    if (dG !== null) partes.push(Math.abs(dG) < 0.5 ? 'gordura estável' : `gordura ${sinal(dG)} ${Math.abs(dG) >= 1.95 ? 'pontos' : 'ponto'}`);
    if (dM !== null) partes.push(Math.abs(dM) < 0.5 ? 'músculo estável' : `músculo ${sinal(dM)} ${Math.abs(dM) >= 1.95 ? 'pontos' : 'ponto'}`);
    resumo = `Desde a medição de ${dataBR(ant.data)} (${dias} ${dias === 1 ? 'dia' : 'dias'}): ${partes.join(', ')}.`;

    if (pesoEstavel && (dG === null || Math.abs(dG) < 0.5) && (dM === null || Math.abs(dM) < 0.5))
      ponto('info', 'As variações desta medição são pequenas e podem ser só água e horário da pesagem. Vale olhar a tendência de três ou mais medições.');
    if (dG !== null && dG <= -0.5 && (dM === null || dM > -0.5)) ponto('bom', `Gordura corporal caiu ${br(arred(-dG, 1))} ${-dG >= 1.95 ? 'pontos' : 'ponto'}${dM !== null ? ' com o músculo preservado' : ''}. É o resultado que o treino de força com proteína adequada busca.`);
    if (dM !== null && dM <= -0.5 && dP < -0.5) ponto('atencao', `O músculo esquelético caiu ${br(arred(-dM, 1))} ${-dM >= 1.95 ? 'pontos' : 'ponto'} junto com o peso. Parte da perda pode estar vindo de massa magra: confira a proteína e não pule os treinos.`);
    if (dG !== null && dG >= 0.5 && emagrecer) ponto('atencao', `Gordura corporal subiu ${br(arred(dG, 1))} ${dG >= 1.95 ? 'pontos' : 'ponto'}, na direção contrária do objetivo. O diário alimentar ajuda a achar de onde vêm as calorias a mais.`);
    if (ganhar && dM !== null && dM >= 0.5) ponto('bom', `Músculo esquelético subiu ${br(arred(dM, 1))} ${dM >= 1.95 ? 'pontos' : 'ponto'}. O ganho de massa está acontecendo.`);
    if (ganhar && dG !== null && dG >= 1) ponto('atencao', `Gordura corporal subiu ${br(arred(dG, 1))} ${dG >= 1.95 ? 'pontos' : 'ponto'}. No ganho de massa algum aumento é esperado, mas se continuar reduza um pouco as calorias.`);
    if (ganhar && pesoEstavel && dias >= 14) ponto('info', 'O peso não subiu em duas semanas ou mais. Para ganhar massa é preciso comer um pouco acima do gasto: confira se você está batendo as calorias da meta.');
    if (!pesoEstavel && dP < 0 && ritmoPct > 1 && dias >= 7) ponto('alerta', `Você perdeu cerca de ${br(arred(-ritmo, 1))} kg por semana, mais de 1% do peso. Nesse ritmo o corpo perde músculo junto: aumente um pouco as calorias. Se a perda não foi intencional, procure um médico.`);
    if (emagrecer && !pesoEstavel && dP < 0 && ritmoPct <= 1 && ritmoPct >= 0.25) ponto('bom', `Ritmo de perda de cerca de ${br(arred(-ritmo, 1))} kg por semana, dentro da faixa saudável (até 1% do peso).`);
    if (dV !== null && dV !== 0) ponto(dV < 0 ? 'bom' : 'atencao', `Gordura abdominal passou do nível ${ant.visceral} para ${ult.visceral}.`);
    const dC = dif('cintura', ult, ant);
    if (dC !== null && Math.abs(dC) >= 1) ponto(dC < 0 ? 'bom' : emagrecer ? 'atencao' : 'info', `Cintura ${dC < 0 ? 'diminuiu' : 'aumentou'} ${br(arred(Math.abs(dC), 1))} cm desde a medição anterior.`);
    if (pri && pri !== ant && pri.peso != null) {
      const tP = ult.peso - pri.peso, tG = dif('gordura', ult, pri);
      ponto('info', `Desde o início, em ${dataBR(pri.data)}: peso ${Math.abs(tP) < 0.05 ? 'igual' : sinal(tP) + ' kg'}${tG !== null ? `, gordura ${Math.abs(tG) < 0.05 ? 'igual' : sinal(tG) + (Math.abs(tG) >= 1.95 ? ' pontos' : ' ponto')}` : ''}.`);
    }
  }
  if (a.visceral !== null && a.visceral >= 15) ponto('alerta', `Gordura abdominal no nível ${a.visceral}, na faixa muito alta. É o número mais ligado a risco cardiovascular; vale conversar com um médico.`);
  if (ult && ult.cintura && a.alturaCm && ult.cintura / a.alturaCm >= 0.5) ponto('atencao', `Sua cintura (${br(ult.cintura)} cm) passa de metade da sua altura. Essa relação é um sinal simples de gordura abdominal acima do ideal.`);
  const diasMedida = ult ? diasEntre(ult.data, hoje) : null;
  if (diasMedida !== null && diasMedida >= 8) ponto('info', `A última medição tem ${diasMedida} dias. Lance a desta semana para a análise ficar atual.`);

  // Treinos da semana
  const feitos = (e.sessoes || []).filter(s => s.data > dataMenos(hoje, 7)).length, meta = parseInt(p.dias, 10) || 3;
  if (feitos >= meta) { ponto('bom', `${feitos} ${feitos === 1 ? 'treino concluído' : 'treinos concluídos'} nos últimos 7 dias, meta de ${meta} batida.`); treino.push('Mantenha a frequência. Nos exercícios em que você fechou todas as séries no topo da faixa de repetições, suba um pouco a carga.'); }
  else if (feitos === 0) { ponto('atencao', `Nenhum treino concluído nos últimos 7 dias, de ${meta} planejados.`); treino.push('Recomece pelo primeiro treino da ficha, sem compensar os que ficaram para trás. Marcar dia e horário fixos ajuda a não falhar.'); }
  else { ponto('info', `${feitos} de ${meta} treinos concluídos nos últimos 7 dias.`); treino.push(`Faltaram ${meta - feitos}. Se a semana não comporta ${meta} treinos, é melhor reduzir os dias no cadastro e cumprir todos do que planejar mais e faltar.`); }
  if (emagrecer) treino.push('Caminhada ou outro cardio leve nos dias sem musculação aumenta o gasto sem atrapalhar a recuperação.');

  // Alimentação da semana
  const d7 = resumoDiario(dataMenos(hoje, 6), hoje, e);
  let proteinaBaixa = false, kcalAcima = false;
  if (d7.dias >= 3) {
    const pctK = d7.kcalMedia / pl.kcal, pctP = d7.proteinaMedia / pl.proteina;
    proteinaBaixa = pctP < 0.8; kcalAcima = pctK > 1.1;
    if (pctK > 1.1) { ponto(emagrecer ? 'atencao' : 'info', `Média de ${n0(d7.kcalMedia)} kcal nos ${d7.dias} dias registrados, ${n0(d7.kcalMedia - pl.kcal)} acima da meta de ${n0(pl.kcal)}.`); alim.push('Veja no diário qual refeição pesa mais e corte ali primeiro. Bebidas com açúcar e beliscos costumam ser o corte mais fácil.'); }
    else if (pctK < 0.8) { ponto('atencao', `Média de ${n0(d7.kcalMedia)} kcal nos ${d7.dias} dias registrados, bem abaixo da meta de ${n0(pl.kcal)}. Comer muito pouco derruba o rendimento e leva embora músculo.`); alim.push('Chegue mais perto da meta, ou confira se todas as refeições estão sendo registradas.'); }
    else ponto('bom', `Média de ${n0(d7.kcalMedia)} kcal nos ${d7.dias} dias registrados, dentro da meta de ${n0(pl.kcal)}.`);
    if (proteinaBaixa) { ponto('atencao', `Proteína média de ${n0(d7.proteinaMedia)} g, abaixo da meta de ${n0(pl.proteina)} g.`); alim.push('Coloque uma fonte de proteína em todas as refeições: ovos ou iogurte no café, carne, frango ou peixe no almoço e no jantar.'); }
    else alim.push(`Proteína média de ${n0(d7.proteinaMedia)} g, perto da meta de ${n0(pl.proteina)} g. Continue assim.`);
    if (d7.kcalFimDeSemana !== null && d7.kcalDiasUteis !== null && d7.kcalFimDeSemana > d7.kcalDiasUteis * 1.2) alim.push(`No fim de semana a média sobe para ${n0(d7.kcalFimDeSemana)} kcal, contra ${n0(d7.kcalDiasUteis)} nos dias úteis. Planejar uma refeição livre, em vez do dia inteiro, segura boa parte disso.`);
  } else alim.push(d7.dias ? `Só ${d7.dias} ${d7.dias === 1 ? 'dia registrado' : 'dias registrados'} no diário nesta semana. Com pelo menos 3 dias já dá para comparar com a meta.` : 'Registre o que você come em "O que eu comi", na Alimentação. Sem o diário não dá para saber se a meta de calorias e de proteína está sendo cumprida.');

  // Uma meta só, a mais importante agora
  const metaSemana = !ult ? 'Lançar a primeira medição de peso e bioimpedância.'
    : feitos < meta ? `Concluir os ${meta} treinos da ficha nos próximos 7 dias.`
    : d7.dias < 5 ? 'Registrar o que você comeu em pelo menos 5 dias da semana.'
    : proteinaBaixa ? `Bater ${n0(pl.proteina)} g de proteína em pelo menos 5 dias.`
    : kcalAcima && emagrecer ? `Ficar em até ${n0(pl.kcal)} kcal em pelo menos 5 dias.`
    : `Repetir a semana: ${meta} treinos, diário preenchido e nova medição em 7 dias.`;
  return { resumo, destaques: D, treino, alimentacao: alim, meta: metaSemana };
}
const ICONE_DESTAQUE = { bom: 'check', atencao: 'alerta', alerta: 'alerta', info: 'info' };
function corpoAnalise(x) {
  const lista = (titulo, itens) => (itens && itens.length ? `<div><h3>${titulo}</h3><ul class="lista">${itens.map(t => `<li>${esc(t)}</li>`).join('')}</ul></div>` : '');
  return `<p class="resumo-analise">${esc(x.resumo)}</p>
    <ul class="pontos">${x.destaques.map(d => `<li class="${d.tipo}"><span class="marca-p">${ic(ICONE_DESTAQUE[d.tipo], 'p')}</span><span>${esc(d.texto)}</span></li>`).join('')}</ul>
    <div class="duas colunas-analise">${lista('Treino', x.treino)}${lista('Alimentação', x.alimentacao)}</div>
    <div class="meta-semana"><span class="mini">Meta da semana</span><b>${esc(x.meta)}</b></div>`;
}
// Quantos dias faz da última medição; null se não há medição
const diasDaUltimaMedida = () => { const m = (estado.medidas || []).slice(-1)[0]; return m ? diasEntre(m.data, hojeISO()) : null; };
function cartaoAnalise() {
  const dias = diasDaUltimaMedida();
  const lembrete = dias === null ? 'Lance a sua primeira medição abaixo.'
    : dias >= 7 ? `Faz ${dias} dias da última medição. Lance a bioimpedância desta semana.`
    : `Última medição há ${dias === 0 ? 'menos de um dia' : dias === 1 ? '1 dia' : dias + ' dias'}. A próxima é em ${7 - dias} ${7 - dias === 1 ? 'dia' : 'dias'}.`;
  return `<div class="card analise"><span class="selo-auto">${ic('raio', 'p')}Análise da semana</span>
    <p class="suave pequeno" style="margin:8px 0 14px">${lembrete} A análise se refaz sozinha a cada medição, treino e refeição registrados.</p>
    ${corpoAnalise(analiseDaSemana())}
    <p class="mini suave" style="margin-top:14px">Leitura automática feita pelo site com base nos seus registros. É orientação geral, não substitui médico ou nutricionista.</p></div>`;
}
// Resumo no Painel
function cartaoSemana() {
  const dias = diasDaUltimaMedida(), atrasada = dias === null || dias >= 7;
  return `<div class="card ${atrasada ? 'chamada' : ''}"><span class="selo-auto">${ic('raio', 'p')}Semana</span>
    <h2 style="margin:8px 0 4px">${atrasada ? 'Hora da medição da semana' : 'Meta da semana'}</h2>
    <p class="${atrasada ? '' : 'suave'}">${atrasada ? (dias === null ? 'Lance a bioimpedância para começar o acompanhamento.' : `Faz ${dias} dias da última. Lance a bioimpedância e veja a análise da semana.`) : esc(analiseDaSemana().meta)}</p>
    <div class="acoes" style="margin-top:12px"><a class="btn ${atrasada ? 'primario' : ''}" href="#/evolucao">${atrasada ? 'Lançar medição' : 'Ver análise'}</a></div></div>`;
}

/* ───────── Diário alimentar ───────── */
function rascunhoDiario() {
  if (!ui.diario) ui.diario = { data: hojeISO(), refeicao: 'Almoço', busca: '', sel: '', qtd: '1', un: 'porcao', erro: '', manual: false, nome: '', kcal: '', p: '' };
  return ui.diario;
}
// Junta os alimentos da mesma refeição do mesmo dia em um registro só
function registrarNoDiario(data, refeicao, item, fonte) {
  const lista = estado.diario || [];
  let reg = fonte === 'tabela' ? lista.find(x => x.data === data && x.refeicao === refeicao && x.fonte === 'tabela') : null;
  if (!reg) { reg = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), data, refeicao, fonte, itens: [] }; lista.push(reg); }
  reg.itens.push(item);
  recalcularRegistro(reg);
  estado.diario = lista.filter(x => x.data >= dataMenos(hojeISO(), 200)).sort((a, b) => a.data.localeCompare(b.data));   // guarda cerca de seis meses
  salvar();
}
function recalcularRegistro(reg) { const t = somaDiario(reg.itens); reg.kcal = Math.round(t.kcal); reg.p = arred(t.p, 1); reg.c = arred(t.c, 1); reg.g = arred(t.g, 1); }
function adicionarAlimento() {
  const d = rascunhoDiario(), al = ALIMENTO_POR_ID[d.sel], q = num(d.qtd);
  d.erro = '';
  if (!d.data || d.data > hojeISO()) d.erro = 'Escolha uma data até hoje.';
  else if (!al) d.erro = 'Busque e escolha um alimento.';
  else if (q === null || q <= 0 || (d.un === 'g' ? q > 3000 : q > 30)) d.erro = d.un === 'g' ? 'Informe a quantidade em gramas, até 3000.' : 'Informe quantas porções, até 30.';
  if (d.erro) { render(); return; }
  const gramas = d.un === 'g' ? q : q * al.gramas, item = calcularItem(al, gramas);
  item.qtd = d.un === 'g' ? `${n0(gramas)} g` : `${br(q)} ${al.porcao} (${n0(gramas)} g)`;
  registrarNoDiario(d.data, d.refeicao, item, 'tabela');
  d.sel = ''; d.busca = ''; d.qtd = '1'; d.un = 'porcao';
  render(); toast(`${al.nome}: ${n0(item.kcal)} kcal.`);
  const c = $('#d-busca'); if (c) c.focus();
}
function salvarManual() {
  const d = rascunhoDiario(), kcal = num(d.kcal), p = num(d.p), nome = d.nome.trim();
  d.erro = '';
  if (!d.data || d.data > hojeISO()) d.erro = 'Escolha uma data até hoje.';
  else if (!nome) d.erro = 'Escreva o que você comeu.';
  else if (kcal === null || kcal < 0 || kcal > 5000) d.erro = 'Informe as calorias, entre 0 e 5000.';
  else if (p !== null && (p < 0 || p > 400)) d.erro = 'A proteína precisa estar entre 0 e 400 g.';
  if (d.erro) { render(); return; }
  registrarNoDiario(d.data, d.refeicao, { nome: nome.slice(0, 80), qtd: '', kcal: Math.round(kcal), p: p || 0, c: 0, g: 0 }, 'manual');
  d.nome = ''; d.kcal = ''; d.p = ''; render(); toast('Refeição registrada.');
}
const listaResultados = texto => {
  const r = buscarAlimentos(texto);
  return r.length ? r.map(a => `<button type="button" class="resultado" data-acao="diario-escolher" data-valor="${a.id}"><b>${esc(a.nome)}</b><span>${n0(a.kcal * a.gramas / 100)} kcal por ${esc(a.porcao)} (${a.gramas} g)</span></button>`).join('')
    : texto.trim().length >= 2 ? '<p class="suave pequeno">Não achei na tabela. Tente outro nome ou use "Não achei: digitar as calorias".</p>' : '';
};
function barraMeta(rotulo, valor, meta, un) {
  const pct = meta ? Math.min(100, valor / meta * 100) : 0, passou = meta && valor > meta * 1.05;
  return `<div class="barra-meta"><div class="linha-meta"><span>${rotulo}</span><span><b>${n0(valor)}</b> de ${n0(meta)} ${un}</span></div>
    <div class="progresso ${passou ? 'passou' : ''}" role="img" aria-label="${rotulo}: ${n0(valor)} de ${n0(meta)} ${un}"><i style="width:${pct.toFixed(0)}%"></i></div></div>`;
}
function secaoDiario(pl) {
  const d = rascunhoDiario(), hoje = hojeISO(), doDia = diarioDoDia(d.data), t = somaDiario(doDia), al = ALIMENTO_POR_ID[d.sel];
  const semana = Array.from({ length: 7 }, (_, i) => dataMenos(hoje, i)).map(data => ({ data, t: somaDiario(diarioDoDia(data)), n: diarioDoDia(data).length }));
  const resto = pl.kcal - t.kcal, q = num(d.qtd), previa = al && q > 0 ? calcularItem(al, d.un === 'g' ? q : q * al.gramas) : null;
  const registro = x => `<div class="entrada-diario"><div class="topo-entrada"><div><b>${esc(x.refeicao)}</b> <span class="suave">· ${n0(x.kcal)} kcal · ${n0(x.p)} g de proteína</span></div>
      <span class="acoes-entrada"><button class="btn icone ${ehFavorita(x) ? 'favorita-sim' : ''}" data-acao="diario-favoritar" data-valor="${esc(x.id)}" aria-pressed="${ehFavorita(x)}" aria-label="${ehFavorita(x) ? 'Tirar das favoritas' : 'Salvar como favorita'}" title="${ehFavorita(x) ? 'Tirar das favoritas' : 'Salvar como favorita'}">${ic('estrela', 'p')}</button>
      <button class="btn icone" data-acao="diario-apagar" data-valor="${esc(x.id)}" aria-label="Apagar ${esc(x.refeicao)}" title="Apagar a refeição">${ic('lixo', 'p')}</button></span></div>
    <table class="tabela itens-diario"><tbody>${x.itens.map((i, n) => `<tr><td>${esc(i.nome)}${i.qtd ? `<br><span class="suave mini">${esc(i.qtd)}</span>` : ''}</td><td>${n0(i.kcal)} kcal</td>
      <td class="so-largo">P ${n0(i.p)} · C ${n0(i.c)} · G ${n0(i.g)}</td><td>${x.itens.length > 1 ? `<button class="btn icone" data-acao="diario-item-apagar" data-valor="${esc(x.id)}" data-idx="${n}" aria-label="Tirar ${esc(i.nome)}" title="Tirar">${ic('x', 'p')}</button>` : ''}</td></tr>`).join('')}</tbody></table></div>`;
  return `<div class="secao" id="diario"><div class="cabecalho" style="margin-bottom:12px"><div><h2>O que eu comi</h2><p class="suave pequeno">Busque cada alimento, informe a quantidade e o site calcula calorias e macros. Em um mês, esses registros servem para reestruturar o plano.</p></div></div>
    <div class="duas">
      <div class="card"><div class="grade-campos diario-topo">
          <label class="campo"><span>Dia</span><input class="entrada" id="d-data" type="date" value="${esc(d.data)}" max="${hoje}"></label>
          <label class="campo"><span>Refeição</span><select class="entrada" id="d-refeicao">${REFEICOES_DIARIO.map(r => `<option ${r === d.refeicao ? 'selected' : ''}>${r}</option>`).join('')}</select></label></div>
        ${barraFavoritas()}
        ${d.manual ? `<div class="grade-campos" style="margin-top:14px">
            <label class="campo"><span>O que foi</span><input class="entrada" id="d-nome" value="${esc(d.nome)}" maxlength="80" placeholder="Prato feito do restaurante"></label>
            <label class="campo"><span>Calorias</span><div class="com-unidade"><input class="entrada" id="d-kcal" inputmode="numeric" value="${esc(d.kcal)}" placeholder="650"><i>kcal</i></div></label>
            <label class="campo"><span>Proteína (opcional)</span><div class="com-unidade"><input class="entrada" id="d-p" inputmode="decimal" value="${esc(d.p)}" placeholder="35"><i>g</i></div></label></div>`
          : al ? `<div class="alimento-escolhido" style="margin-top:14px"><div><b>${esc(al.nome)}</b><br><span class="suave pequeno">${n0(al.kcal)} kcal em 100 g · 1 ${esc(al.porcao)} = ${al.gramas} g</span></div>
              <button class="link" data-acao="diario-trocar">Trocar</button></div>
            <div class="grade-campos" style="margin-top:12px">
              <label class="campo"><span>Quantidade</span><input class="entrada" id="d-qtd" inputmode="decimal" value="${esc(d.qtd)}"></label>
              <label class="campo"><span>Medida</span><select class="entrada" id="d-un"><option value="porcao" ${d.un === 'porcao' ? 'selected' : ''}>${esc(al.porcao)} (${al.gramas} g)</option><option value="g" ${d.un === 'g' ? 'selected' : ''}>gramas</option></select></label></div>
            <p class="previa" id="d-previa">${previa ? `${n0(previa.kcal)} kcal · ${br(previa.p)} g de proteína · ${br(previa.c)} g de carboidrato · ${br(previa.g)} g de gordura` : ''}</p>`
          : `<label class="campo" style="margin-top:14px"><span>Alimento</span><input class="entrada" id="d-busca" value="${esc(d.busca)}" autocomplete="off" placeholder="Digite: arroz, frango, pão, banana…"></label>
            <div class="resultados" id="d-resultados">${listaResultados(d.busca)}</div>`}
        ${d.erro ? `<p class="aviso erro" role="alert" style="margin-top:12px">${esc(d.erro)}</p>` : ''}
        <div class="acoes" style="margin-top:14px">
          ${d.manual ? '<button class="btn primario" data-acao="diario-manual-salvar">Registrar</button>' : al ? '<button class="btn primario" data-acao="diario-adicionar">Adicionar à refeição</button>' : ''}
          <button class="link" data-acao="diario-modo">${d.manual ? 'Buscar na tabela de alimentos' : 'Não achei: digitar as calorias'}</button></div></div>
      <div class="card"><h2>${d.data === hoje ? 'Hoje' : dataBR(d.data)}</h2>
        ${barraMeta('Calorias', t.kcal, pl.kcal, 'kcal')}${barraMeta('Proteína', t.p, pl.proteina, 'g')}
        <p class="suave pequeno" style="margin-top:10px">${!doDia.length ? 'Nada registrado neste dia.' : resto >= 0 ? `Faltam ${n0(resto)} kcal para a meta.` : `Passou ${n0(-resto)} kcal da meta.`} ${doDia.length ? `Carboidrato ${n0(t.c)} g · gordura ${n0(t.g)} g.` : ''}</p>
        ${!doDia.length && diaAnteriorComRegistro(d.data) ? `<div class="acoes" style="margin-top:12px"><button class="btn" data-acao="diario-repetir">Repetir ${diaAnteriorComRegistro(d.data) === dataMenos(d.data, 1) ? 'o dia anterior' : 'o dia ' + dataCurta(diaAnteriorComRegistro(d.data))}</button></div>` : ''}
        <div class="pilha entradas-diario">${doDia.map(registro).join('')}</div></div>
    </div>
    <div class="card rolagem-x" style="margin-top:16px"><h2>Últimos 7 dias</h2><table class="tabela"><tr><th>Dia</th><th>Calorias</th><th>Meta</th><th>Diferença</th><th>Proteína</th></tr>
      ${semana.map(x => `<tr><td>${x.data === hoje ? 'Hoje' : dataBR(x.data)}</td><td>${x.n ? n0(x.t.kcal) + ' kcal' : '–'}</td><td>${n0(pl.kcal)} kcal</td><td>${x.n ? (x.t.kcal - pl.kcal > 0 ? '+' : '−') + n0(Math.abs(x.t.kcal - pl.kcal)) : '–'}</td><td>${x.n ? n0(x.t.p) + ' g' : '–'}</td></tr>`).join('')}</table>
      <p class="mini suave" style="margin-top:10px">Calorias e macros são aproximados (tabela TACO): servem para comparar com a meta, não como medida exata.</p></div>
  </div>`;
}

/* ───────── Reestruturar a alimentação ─────────
   Depois de cerca de um mês, refaz as metas com o que os dados mostram: o gasto real (pelo diário e pelo peso)
   quando há registros suficientes; senão, o ritmo de peso contra o ritmo que o objetivo pede. */
const inicioDoPlano = () => estado.planoDesde || (estado.medidas[0] && estado.medidas[0].data) || hojeISO();
// Mantém a proposta dentro de limites seguros e faz as contas fecharem
function ajustarProposta(s, a, pl) {
  const piso = a.sexo === 'F' ? 1200 : 1500, ref = pl.pesoRef || a.peso;
  const entre = (v, min, max) => Math.min(max, Math.max(min, v));
  let kcal = entre(Math.round((num(s.kcal) || pl.kcal) / 10) * 10, Math.max(piso, pl.kcal - 300), Math.max(piso, Math.min(pl.kcal + 300, Math.round(a.gastoDiario * 1.25))));
  const proteina = Math.round(entre(num(s.proteina) || pl.proteina, ref * 1.4, ref * 2.4));
  let gordura = Math.round(entre(num(s.gordura) || pl.gordura, ref * 0.5, ref * 1.2));
  let carbo = Math.round((kcal - proteina * 4 - gordura * 9) / 4);
  if (carbo < 50) { carbo = 50; gordura = Math.max(Math.round(ref * 0.5), Math.round((kcal - proteina * 4 - carbo * 4) / 9)); }
  kcal = Math.max(piso, Math.round((proteina * 4 + carbo * 4 + gordura * 9) / 10) * 10);
  return { kcal, proteina, carbo, gordura, resumo: s.resumo || '', mudancas: s.mudancas || [], cuidados: s.cuidados || [] };
}
function proporReestruturacao() {
  const p = estado.perfil, a = analise(), pl = planoAlimentar(p, a), hoje = hojeISO(), de = inicioDoPlano();
  const real = gastoReal(de, hoje), diario = resumoDiario(de, hoje);
  const pesos = (estado.medidas || []).filter(m => m.data >= de && m.peso != null), pri = pesos[0], ult = pesos[pesos.length - 1];
  const diasPeso = pri && ult ? diasEntre(pri.data, ult.data) : 0, ritmo = diasPeso >= 14 ? (ult.peso - pri.peso) / diasPeso * 7 : null;       // kg por semana
  const dM = pri && ult && pri.musculo != null && ult.musculo != null ? ult.musculo - pri.musculo : null;
  const dG = pri && ult && pri.gordura != null && ult.gordura != null ? ult.gordura - pri.gordura : null;
  // Ritmo de peso que o objetivo pede, em kg por semana
  const alvo = { emagrecer: -0.0075, recomposicao: -0.0025, hipertrofia: 0.0035, saude: 0 }[a.objetivo] * a.peso;
  const mudancas = [], cuidados = [];
  let kcal = pl.kcal, resumo;
  const perdendoMusculo = dM !== null && dM <= -1 && ritmo !== null && ritmo < -0.25;

  if (real) {
    kcal = real.kcal + alvo * 7700 / 7;
    resumo = `Pelo diário (${real.diasDeDiario} dias) e pelo peso (${real.variacaoPesoKg > 0 ? '+' : '−'}${br(Math.abs(real.variacaoPesoKg))} kg em ${real.diasEntrePesagens} dias), seu gasto real é de cerca de ${n0(real.kcal)} kcal por dia, contra ${n0(a.gastoDiario)} da fórmula. A nova meta parte desse gasto real.`;
  } else if (ritmo !== null) {
    kcal = pl.kcal + (alvo - ritmo) * 7700 / 7;
    const dentro = Math.abs(alvo - ritmo) < 0.15;
    resumo = `Sem diário suficiente para medir o gasto real, a conta usa o peso: você ${Math.abs(ritmo) < 0.05 ? 'manteve o peso' : (ritmo < 0 ? 'perdeu' : 'ganhou') + ' cerca de ' + br(arred(Math.abs(ritmo), 1)) + ' kg por semana'}, e o objetivo pede ${Math.abs(alvo) < 0.05 ? 'peso estável' : (alvo < 0 ? 'perda' : 'ganho') + ' de cerca de ' + br(arred(Math.abs(alvo), 1)) + ' kg por semana'}. ${dentro ? 'O ritmo está no alvo, então a meta de calorias fica como está.' : 'A meta de calorias foi corrigida por essa diferença.'}`;
    if (dentro) kcal = pl.kcal;
  } else {
    resumo = 'Ainda não há dados para recalcular com segurança: são necessárias duas pesagens com pelo menos 14 dias de intervalo. As metas ficam como estão.';
    cuidados.push('Lance o peso toda semana e registre o que come. Com 10 dias de diário e duas semanas de pesagens, a próxima reestruturação usa o seu gasto real.');
  }
  // Composição corporal ajusta a proteína e protege o músculo
  let protKg = { emagrecer: 2.0, recomposicao: 2.0, hipertrofia: 1.8, saude: 1.4 }[a.objetivo];
  if (perdendoMusculo) { protKg += 0.2; kcal += 100; cuidados.push(`O músculo esquelético caiu ${br(arred(-dM, 1))} ponto(s) no período. A proposta sobe a proteína e alivia um pouco o déficit para proteger a massa magra.`); }
  if (a.objetivo === 'emagrecer' && dG !== null && dG <= -1 && !perdendoMusculo) mudancas.push(`A gordura corporal caiu ${br(arred(-dG, 1))} ponto(s) no período. O plano está funcionando; a mudança é só um ajuste fino.`);
  // O que o diário mostra
  if (diario.dias >= 5) {
    if (diario.proteinaMedia < pl.proteina * 0.85) mudancas.push(`Sua proteína média foi de ${n0(diario.proteinaMedia)} g, abaixo da meta de ${n0(pl.proteina)} g. Inclua uma fonte de proteína em cada refeição, começando pelo café da manhã.`);
    if (diario.kcalMedia > pl.kcal * 1.1) mudancas.push(`Você comeu em média ${n0(diario.kcalMedia)} kcal, ${n0(diario.kcalMedia - pl.kcal)} acima da meta. Antes de cortar comida, corte bebidas com açúcar e beliscos fora das refeições.`);
    if (diario.kcalMedia < pl.kcal * 0.8) mudancas.push(`Você comeu em média ${n0(diario.kcalMedia)} kcal, bem abaixo da meta. Se os registros estão completos, comer tão pouco tira energia do treino: chegue mais perto da meta.`);
    if (diario.kcalFimDeSemana !== null && diario.kcalDiasUteis !== null && diario.kcalFimDeSemana > diario.kcalDiasUteis * 1.2) mudancas.push(`No fim de semana a média foi de ${n0(diario.kcalFimDeSemana)} kcal, contra ${n0(diario.kcalDiasUteis)} nos dias úteis. Uma refeição livre planejada, em vez do dia todo, resolve boa parte da diferença.`);
  } else mudancas.push('Há poucos registros no diário neste período. Anotar o que você come é o que mais melhora a precisão do próximo ajuste.');
  const s = ajustarProposta({ kcal, proteina: (pl.pesoRef || a.peso) * protKg, gordura: (pl.pesoRef || a.peso) * { emagrecer: 0.8, recomposicao: 0.9, hipertrofia: 1.0, saude: 1.0 }[a.objetivo], resumo, mudancas, cuidados }, a, pl);
  if (s.kcal === pl.kcal && s.proteina === pl.proteina && real) s.resumo += ' Como o resultado bate com a meta atual, os números ficam iguais.';
  return { atual: { kcal: pl.kcal, proteina: pl.proteina, carbo: pl.carbo, gordura: pl.gordura }, nova: s, real };
}
function pedirReestruturacao() {
  const dias = diasEntre(inicioDoPlano(), hojeISO());
  if (dias < DIAS_PARA_REESTRUTURAR && !confirm(`O plano atual tem ${dias} ${dias === 1 ? 'dia' : 'dias'}. O ideal é esperar ${DIAS_PARA_REESTRUTURAR} dias para o corpo mostrar o resultado antes de mudar.\n\nReestruturar agora mesmo assim?`)) return;
  ui.proposta = proporReestruturacao();
  modalProposta();
}
function modalProposta() {
  const x = ui.proposta; if (!x) return;
  const linha = (rot, k, un) => { const d = x.nova[k] - x.atual[k]; return `<tr><td>${rot}</td><td>${n0(x.atual[k])} ${un}</td><td><b>${n0(x.nova[k])} ${un}</b></td><td>${d === 0 ? 'igual' : (d > 0 ? '+' : '−') + n0(Math.abs(d)) + ' ' + un}</td></tr>`; };
  abrirModal(`${topoModal('Novo plano proposto')}<div class="miolo solto">
    <p>${esc(x.nova.resumo)}</p>
    <div class="rolagem-x" style="margin-top:14px"><table class="tabela"><tr><th></th><th>Hoje</th><th>Proposto</th><th>Mudança</th></tr>
      ${linha('Calorias', 'kcal', 'kcal')}${linha('Proteína', 'proteina', 'g')}${linha('Carboidrato', 'carbo', 'g')}${linha('Gordura', 'gordura', 'g')}</table></div>
    ${x.nova.mudancas.length ? `<h3 style="margin-top:18px">O que mudar no dia a dia</h3><ul class="lista" style="margin-top:8px">${x.nova.mudancas.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    ${x.nova.cuidados.length ? `<h3 style="margin-top:18px">Atenção</h3><ul class="lista" style="margin-top:8px">${x.nova.cuidados.map(t => `<li>${esc(t)}</li>`).join('')}</ul>` : ''}
    <p class="mini suave" style="margin-top:14px">A mudança de calorias é limitada a 300 kcal por vez e nunca fica abaixo do mínimo seguro.</p>
    <div class="acoes" style="margin-top:20px;justify-content:flex-end"><button class="btn" data-acao="proposta-descartar">Manter o plano atual</button><button class="btn primario" data-acao="proposta-aplicar">Aplicar novo plano</button></div></div>`);
}
function cartaoReestruturar() {
  const p = estado.perfil, de = inicioDoPlano(), dias = diasEntre(de, hojeISO()), falta = DIAS_PARA_REESTRUTURAR - dias, pronto = falta <= 0;
  const r = resumoDiario(de, hojeISO());
  return `<div class="card ${pronto ? 'chamada' : ''}"><span class="selo-auto">${ic('raio', 'p')}Reestruturar</span>
    <h2 style="margin:8px 0 4px">${pronto ? 'Hora de reestruturar a alimentação' : 'Reestruturação da alimentação'}</h2>
    <p class="${pronto ? '' : 'suave'}">${pronto ? `O plano atual tem ${dias} dias. O site refaz as metas com as suas medições e com o que você comeu.`
      : `Disponível em ${falta} ${falta === 1 ? 'dia' : 'dias'}: o plano precisa de ${DIAS_PARA_REESTRUTURAR} dias para mostrar resultado. Você está no dia ${dias}.`}</p>
    <p class="mini suave" style="margin-top:6px">${r.dias ? `${r.dias} ${r.dias === 1 ? 'dia registrado' : 'dias registrados'} no diário desde ${dataBR(de)}, média de ${n0(r.kcalMedia)} kcal.` : 'Nenhuma refeição registrada neste período. Com o diário preenchido, o ajuste usa o seu gasto real.'}</p>
    ${p.planoAjuste ? `<p class="aviso" style="margin-top:12px">Plano reestruturado em ${dataBR(p.planoAjuste.desde)}. <button class="link" data-acao="plano-automatico">Voltar ao cálculo automático</button></p>` : ''}
    <div class="acoes" style="margin-top:12px"><button class="btn ${pronto ? 'primario' : ''}" data-acao="reestruturar">${ic('raio', 'p')}${pronto ? 'Reestruturar alimentação' : 'Reestruturar agora'}</button></div></div>`;
}

/* ───────── Constância: frequência de treino e médias ─────────
   A semana vai de segunda a domingo. "Dias treinados" conta dias diferentes com pelo menos um treino concluído. */
const segundaDe = iso => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().slice(0, 10); };
function frequenciaDeTreino(e) {
  e = e || estado;
  const hoje = hojeISO(), ss = (e.sessoes || []).filter(s => s.data <= hoje), meta = parseInt(e.perfil.dias, 10) || 3;
  const treinados = new Set(ss.map(s => s.data)), seg0 = segundaDe(hoje);
  // 12 semanas, da mais antiga para a atual
  const semanas = Array.from({ length: 12 }, (_, i) => {
    const inicio = dataMenos(seg0, (11 - i) * 7), dias = Array.from({ length: 7 }, (_, k) => dataMenos(inicio, -k));
    return { inicio, dias, n: dias.filter(d => treinados.has(d)).length };
  });
  const atual = semanas[11], primeira = ss.length ? segundaDe(ss.reduce((m, s) => (s.data < m ? s.data : m), ss[0].data)) : null;
  // Média por semana: semanas completas desde o primeiro treino (até 4); sem nenhuma completa, vale a semana atual
  const completas = semanas.slice(0, 11).filter(s => primeira && s.inicio >= primeira).slice(-4);
  const media = completas.length ? completas.reduce((t, s) => t + s.n, 0) / completas.length : (ss.length ? atual.n : null);
  // Sequência de semanas seguidas com a meta batida (a atual só conta se já bateu)
  let sequencia = atual.n >= meta ? 1 : 0;
  for (let i = 10; i >= 0 && semanas[i].n >= meta; i--) sequencia++;
  const recentes = ss.filter(s => s.data > dataMenos(hoje, 28));
  const comDuracao = recentes.filter(s => s.minutos > 0), planejadas = recentes.reduce((t, s) => t + (s.total || 0), 0);
  const porDia = [0, 0, 0, 0, 0, 0, 0]; ss.forEach(s => { porDia[(new Date(s.data + 'T12:00:00').getDay() + 6) % 7]++; });
  const maior = Math.max(...porDia);
  return {
    meta, semanas, atual, total: ss.length, media, semanasNaMedia: completas.length, sequencia,
    dias28: new Set(recentes.map(s => s.data)).size,
    duracaoMedia: comDuracao.length ? Math.round(comDuracao.reduce((t, s) => t + s.minutos, 0) / comDuracao.length) : null,
    aproveitamento: planejadas ? Math.round(recentes.reduce((t, s) => t + (s.feitas || 0), 0) / planejadas * 100) : null,
    diaFavorito: ss.length >= 3 ? ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'][porDia.indexOf(maior)] : null,
    diasSemTreinar: ss.length ? diasEntre(ss.reduce((m, s) => (s.data > m ? s.data : m), ss[0].data), hoje) : null,
    treinados
  };
}
const LETRAS_DIA = ['S', 'T', 'Q', 'Q', 'S', 'S', 'D'], NOMES_DIA = ['segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado', 'domingo'];
// Barras de dias treinados por semana (8 semanas), com a linha da meta
function graficoSemanas(f) {
  const sem = f.semanas.slice(-8), W = GRAF_W, H = 170, m = { t: 16, r: 44, b: 24, l: 22 };
  const max = Math.max(f.meta, ...sem.map(s => s.n), 1), base = H - m.b, alt = base - m.t;
  const passo = (W - m.l - m.r) / sem.length, larg = Math.min(22, passo * 0.56);
  const y = v => base - v / max * alt, cx = i => m.l + passo * (i + 0.5);
  const rot = s => (s === f.atual ? 'esta semana' : 'semana de ' + dataCurta(s.inicio));
  const dados = sem.map((s, i) => ({ x: +cx(i).toFixed(1), y: +y(s.n).toFixed(1), t: `${rot(s)} · ${s.n} ${s.n === 1 ? 'dia' : 'dias'}` }));
  const barra = (s, i) => {
    if (!s.n) return `<line class="barra-zero" x1="${(cx(i) - larg / 2).toFixed(1)}" x2="${(cx(i) + larg / 2).toFixed(1)}" y1="${base}" y2="${base}"/>`;
    const x0 = cx(i) - larg / 2, h = base - y(s.n), r = Math.min(4, h);          // pontas arredondadas só em cima, presas à base
    return `<path class="barra ${s === f.atual ? 'atual' : ''}" d="M${x0.toFixed(1)} ${base}v${(-(h - r)).toFixed(1)}q0 ${-r} ${r} ${-r}h${(larg - 2 * r).toFixed(1)}q${r} 0 ${r} ${r}v${(h - r).toFixed(1)}z"/>`;
  };
  return `<div class="grafico"><svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Dias treinados por semana nas últimas 8 semanas. Esta semana: ${f.atual.n} de ${f.meta}." data-pontos='${JSON.stringify(dados)}'>
      <line class="grade-l" x1="${m.l}" x2="${W - m.r}" y1="${base}" y2="${base}"/>
      <line class="guia" y1="${m.t}" y2="${base}" x1="0" x2="0" visibility="hidden"/>
      ${sem.map(barra).join('')}
      <line class="linha-meta-g" x1="${m.l}" x2="${W - m.r}" y1="${y(f.meta).toFixed(1)}" y2="${y(f.meta).toFixed(1)}"/>
      <text class="eixo" x="${W - m.r + 6}" y="${(y(f.meta) + 4).toFixed(1)}">meta ${f.meta}</text>
      <text class="rotulo-fim" x="${cx(sem.length - 1).toFixed(1)}" y="${(y(f.atual.n) - 6).toFixed(1)}" text-anchor="middle">${f.atual.n}</text>
      <text class="eixo" x="${cx(0).toFixed(1)}" y="${H - 6}" text-anchor="middle">${dataCurta(sem[0].inicio)}</text>
      <text class="eixo" x="${cx(sem.length - 1).toFixed(1)}" y="${H - 6}" text-anchor="middle">esta</text>
    </svg><div class="dica-graf" hidden></div></div>
    <details class="ver-tabela"><summary>Ver em tabela</summary><table class="tabela"><tr><th>Semana</th><th>Dias treinados</th><th>Meta</th></tr>
      ${sem.slice().reverse().map(s => `<tr><td>${s === f.atual ? 'Esta semana' : 'Semana de ' + dataBR(s.inicio)}</td><td>${s.n}</td><td>${s.n >= f.meta ? 'batida' : 'faltou ' + (f.meta - s.n)}</td></tr>`).join('')}</table></details>`;
}
// Calendário das últimas 12 semanas: uma coluna por semana, uma linha por dia
function calendarioTreinos(f) {
  const hoje = hojeISO(), MESES = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];
  const mes = iso => MESES[parseInt(iso.slice(5, 7), 10) - 1];
  const topo = f.semanas.map((s, i) => `<span>${i === 0 || mes(s.inicio) !== mes(f.semanas[i - 1].inicio) ? mes(s.inicio) : ''}</span>`).join('');
  const linhas = LETRAS_DIA.map((letra, k) => `<span class="rot-dia" aria-hidden="true">${letra}</span>` + f.semanas.map(s => {
    const d = s.dias[k], fez = f.treinados.has(d), futuro = d > hoje;
    return `<i class="cel ${fez ? 'fez' : ''} ${futuro ? 'futuro' : ''} ${d === hoje ? 'hoje' : ''}" title="${NOMES_DIA[k]}, ${dataBR(d)}${futuro ? '' : fez ? ': treinou' : ': sem treino'}"></i>`;
  }).join('')).join('');
  return `<div class="calendario" role="img" aria-label="Calendário das últimas 12 semanas: ${f.semanas.reduce((t, s) => t + s.n, 0)} dias treinados.">
      <span></span>${topo}${linhas}</div>
    <div class="legenda"><span><i class="cel fez"></i>Treinou</span><span><i class="cel"></i>Sem treino</span><span><i class="cel hoje"></i>Hoje</span></div>`;
}
function secaoFrequencia() {
  const f = frequenciaDeTreino(), hoje = hojeISO();
  if (!f.total) return `<div class="secao"><h2>Sua constância</h2><div class="vazio">Conclua o primeiro treino para começar a contar a frequência. A meta é de ${f.meta} ${f.meta === 1 ? 'dia' : 'dias'} por semana.</div></div>`;
  const falta = f.meta - f.atual.n, C = 2 * Math.PI * 34, pct = Math.min(1, f.atual.n / f.meta);
  const d7 = resumoDiario(dataMenos(hoje, 6), hoje), pl = planoAlimentar(estado.perfil, analise());
  const pesos = (estado.medidas || []).filter(m => m.peso != null), p0 = pesos.find(m => m.data >= dataMenos(hoje, 35)) || pesos[0], p1 = pesos[pesos.length - 1];
  const ritmo = p0 && p1 && p0 !== p1 && diasEntre(p0.data, p1.data) >= 7 ? (p1.peso - p0.peso) / diasEntre(p0.data, p1.data) * 7 : null;
  return `<div class="secao"><h2>Sua constância</h2>
    <div class="constancia">
      <div class="card semana-atual">
        <div class="anel" role="img" aria-label="${f.atual.n} de ${f.meta} dias treinados nesta semana">
          <svg viewBox="0 0 80 80"><circle class="anel-fundo" cx="40" cy="40" r="34"/><circle class="anel-valor" cx="40" cy="40" r="34" stroke-dasharray="${(C * pct).toFixed(1)} ${C.toFixed(1)}" transform="rotate(-90 40 40)"/></svg>
          <div class="anel-centro"><b>${f.atual.n}</b><span>de ${f.meta}</span></div></div>
        <div class="semana-texto"><h3>Esta semana</h3>
          <p class="suave pequeno">${falta <= 0 ? 'Meta da semana batida.' : `${falta === 1 ? 'Falta 1 dia' : 'Faltam ' + falta + ' dias'} de treino para a meta.`}${f.diasSemTreinar >= 4 ? ` Último treino há ${f.diasSemTreinar} dias.` : ''}</p>
          <div class="dias-semana">${f.atual.dias.map((d, k) => `<span class="dia ${f.treinados.has(d) ? 'fez' : ''} ${d === hoje ? 'hoje' : ''} ${d > hoje ? 'futuro' : ''}" title="${NOMES_DIA[k]}${f.treinados.has(d) ? ': treinou' : ''}"><i>${f.treinados.has(d) ? ic('check', 'p') : ''}</i>${LETRAS_DIA[k]}</span>`).join('')}</div></div>
      </div>
      <div class="card"><h3>Dias treinados por semana</h3><p class="suave pequeno" style="margin-bottom:6px">Últimas 8 semanas · meta de ${f.meta} ${f.meta === 1 ? 'dia' : 'dias'}</p>${graficoSemanas(f)}</div>
    </div>
    <div class="tiles" style="margin-top:12px">
      ${tile('Média por semana', f.media === null ? '–' : n1(f.media), f.media === null ? '' : 'dias', `<span class="mini suave">${f.semanasNaMedia ? (f.semanasNaMedia === 1 ? 'última semana completa' : `últimas ${f.semanasNaMedia} semanas completas`) : 'semana atual'}</span>`)}
      ${tile('Sequência', f.sequencia, f.sequencia === 1 ? 'semana' : 'semanas', '<span class="mini suave">seguidas com a meta batida</span>')}
      ${tile('Dias treinados', f.dias28, '', '<span class="mini suave">nos últimos 28 dias</span>')}
      ${tile('Duração média', f.duracaoMedia === null ? '–' : f.duracaoMedia, f.duracaoMedia === null ? '' : 'min', '<span class="mini suave">por treino, em 28 dias</span>')}
      ${tile('Séries concluídas', f.aproveitamento === null ? '–' : f.aproveitamento, f.aproveitamento === null ? '' : '%', '<span class="mini suave">do planejado, em 28 dias</span>')}
      ${d7.dias ? tile('Calorias por dia', n0(d7.kcalMedia), 'kcal', `<span class="mini suave">média de ${d7.dias} ${d7.dias === 1 ? 'dia' : 'dias'} · meta ${n0(pl.kcal)}</span>`) : ''}
      ${d7.dias ? tile('Proteína por dia', n0(d7.proteinaMedia), 'g', `<span class="mini suave">média da semana · meta ${n0(pl.proteina)}</span>`) : ''}
      ${ritmo !== null ? tile('Ritmo do peso', (Math.abs(ritmo) < 0.05 ? '0,0' : (ritmo > 0 ? '+' : '−') + n1(Math.abs(ritmo))), 'kg/sem', `<span class="mini suave">média desde ${dataBR(p0.data)}</span>`) : ''}
    </div>
    <div class="card" style="margin-top:12px"><div class="cabecalho" style="margin-bottom:12px"><div><h3>Últimas 12 semanas</h3><p class="suave pequeno">${f.total} ${f.total === 1 ? 'treino concluído' : 'treinos concluídos'} no total${f.diaFavorito ? ` · você treina mais na ${f.diaFavorito}` : ''}</p></div></div>
      ${calendarioTreinos(f)}</div>
  </div>`;
}

/* ───────── Histórico de cargas por exercício ─────────
   Cada treino concluído guarda, por exercício, a carga anotada e as séries feitas (sessao.exs).
   Daí saem a evolução da carga, o recorde e a sugestão de quando subir o peso. */
function historicoCarga(exId, e) {
  return ((e || estado).sessoes || []).flatMap(s => (s.exs || []).filter(x => x.id === exId && x.carga > 0)
    .map(x => ({ data: s.data, carga: x.carga, feitas: x.feitas, series: x.series })));
}
// Próxima carga a tentar: quando as duas últimas vezes fecharam todas as séries com a mesma carga
function sugestaoCarga(exId, cargaAtual) {
  const h = historicoCarga(exId).slice(-2), atual = num(cargaAtual);
  if (h.length < 2 || h[0].carga !== h[1].carga || h.some(x => x.feitas < x.series)) return null;
  if (atual !== null && atual !== h[1].carga) return null;                       // a pessoa já mudou a carga
  const passo = h[1].carga >= 60 ? 5 : h[1].carga >= 20 ? 2.5 : 1;
  return { de: h[1].carga, para: h[1].carga + passo };
}
// Linha que aparece embaixo do exercício na ficha
function dicaCarga(it) {
  const h = historicoCarga(it.ex); if (!h.length) return '';
  const ult = h[h.length - 1], recorde = Math.max(...h.map(x => x.carga)), sug = sugestaoCarga(it.ex, it.carga);
  return `<div class="dica-carga">${sug ? `<span class="subir">${ic('cima', 'p')}Você fechou todas as séries com ${br(sug.de)} kg nas 2 últimas vezes. Tente ${br(sug.para)} kg.</span>` : ''}
    <span class="mini suave">Última: ${br(ult.carga)} kg em ${dataCurta(ult.data)}${recorde > ult.carga ? ` · recorde ${br(recorde)} kg` : h.length > 1 && recorde === ult.carga && h.slice(0, -1).every(x => x.carga < recorde) ? ' · recorde' : ''}</span></div>`;
}
// Bloco da janela do exercício
function blocoCarga(exId) {
  const h = historicoCarga(exId); if (!h.length) return '';
  const recorde = Math.max(...h.map(x => x.carga));
  return `<div class="carga-ex"><h3 style="margin-bottom:8px">Sua carga neste exercício</h3>
    ${grafico('Carga', h.map(x => ({ data: x.data, v: x.carga })), 'kg', 1)}
    <p class="mini suave" style="margin-top:8px">${h.length} ${h.length === 1 ? 'treino registrado' : 'treinos registrados'} · recorde de ${br(recorde)} kg</p></div>`;
}
// Tabela da Evolução: um exercício por linha, do treinado mais recentemente para o mais antigo
function secaoCargas() {
  const ids = [...new Set((estado.sessoes || []).flatMap(s => (s.exs || []).filter(x => x.carga > 0).map(x => x.id)))].filter(id => exDe(id));
  if (!ids.length) return `<div class="secao"><h2>Progresso de cargas</h2><div class="vazio">Anote a carga de cada exercício na ficha. Ao concluir o treino ela fica registrada, e aqui aparece a evolução.</div></div>`;
  const linhas = ids.map(id => { const h = historicoCarga(id); return { id, h, pri: h[0], ult: h[h.length - 1], recorde: Math.max(...h.map(x => x.carga)) }; })
    .sort((a, b) => b.ult.data.localeCompare(a.ult.data));
  return `<div class="secao"><h2>Progresso de cargas</h2>
    <div class="card rolagem-x"><table class="tabela cargas"><tr><th>Exercício</th><th>Primeira</th><th>Última</th><th>Recorde</th><th>Mudança</th><th>Treinos</th></tr>
      ${linhas.map(l => { const d = l.ult.carga - l.pri.carga; return `<tr><td><button class="link-ex" data-acao="ver" data-valor="${l.id}">${esc(exDe(l.id).nome)}</button></td><td>${br(l.pri.carga)} kg</td>
        <td><b>${br(l.ult.carga)} kg</b><br><span class="suave mini">${dataCurta(l.ult.data)}</span></td><td>${br(l.recorde)} kg</td>
        <td>${l.h.length < 2 ? '–' : d === 0 ? 'igual' : selo(d > 0 ? 'bom' : 'atencao', (d > 0 ? '+' : '−') + br(Math.abs(d)) + ' kg')}</td><td>${l.h.length}</td></tr>`; }).join('')}</table></div>
    <p class="mini suave" style="margin-top:8px">Toque no nome do exercício para ver o gráfico da carga.</p></div>`;
}

/* ───────── Diário: refeições favoritas e repetir o dia anterior ───────── */
const assinatura = itens => itens.map(i => i.nome + '|' + i.kcal).join(';');
const ehFavorita = reg => (estado.favoritos || []).some(f => assinatura(f.itens) === assinatura(reg.itens));
function barraFavoritas() {
  const fs = estado.favoritos || [];
  if (!fs.length) return '';
  return `<div class="favoritas"><span class="mini suave">Favoritas: toque para lançar nesta refeição</span><div class="chips">
    ${fs.map(f => `<span class="favorita"><button data-acao="diario-usar-favorita" data-valor="${esc(f.id)}"><b>${esc(f.nome)}</b> · ${n0(f.kcal)} kcal</button>
      <button class="tirar" data-acao="diario-remover-favorita" data-valor="${esc(f.id)}" aria-label="Tirar ${esc(f.nome)} das favoritas" title="Tirar das favoritas">${ic('x', 'p')}</button></span>`).join('')}</div></div>`;
}
// Último dia com registros antes da data escolhida
function diaAnteriorComRegistro(data) {
  const ds = [...new Set((estado.diario || []).map(x => x.data).filter(d => d < data))].sort();
  return ds.length ? ds[ds.length - 1] : null;
}
const ACOES_DIARIO_EXTRA = {
  'diario-favoritar'(el) {
    const reg = (estado.diario || []).find(x => x.id === el.dataset.valor); if (!reg) return;
    if (ehFavorita(reg)) { estado.favoritos = estado.favoritos.filter(f => assinatura(f.itens) !== assinatura(reg.itens)); salvar(); render(); return toast('Tirada das favoritas.'); }
    const nome = reg.itens.map(i => i.nome).slice(0, 3).join(', ').slice(0, 60) + (reg.itens.length > 3 ? '…' : '');
    estado.favoritos = (estado.favoritos || []).concat([{ id: Date.now().toString(36), nome, itens: JSON.parse(JSON.stringify(reg.itens)), kcal: reg.kcal, p: reg.p, c: reg.c, g: reg.g }]).slice(-20);
    salvar(); render(); toast('Salva nas favoritas.');
  },
  'diario-usar-favorita'(el) {
    const f = (estado.favoritos || []).find(x => x.id === el.dataset.valor), d = rascunhoDiario(); if (!f) return;
    if (!d.data || d.data > hojeISO()) { d.erro = 'Escolha uma data até hoje.'; return render(); }
    f.itens.forEach(i => registrarNoDiario(d.data, d.refeicao, Object.assign({}, i), 'tabela'));
    d.erro = ''; render(); toast(`${f.nome}: ${n0(f.kcal)} kcal lançadas em ${d.refeicao.toLowerCase()}.`);
  },
  'diario-remover-favorita'(el) { estado.favoritos = (estado.favoritos || []).filter(f => f.id !== el.dataset.valor); salvar(); render(); },
  'diario-repetir'() {
    const d = rascunhoDiario(), origem = diaAnteriorComRegistro(d.data); if (!origem) return;
    const copias = diarioDoDia(origem).map((x, n) => Object.assign(JSON.parse(JSON.stringify(x)), { id: Date.now().toString(36) + n, data: d.data }));
    estado.diario = (estado.diario || []).concat(copias).sort((a, b) => a.data.localeCompare(b.data));
    salvar(); render(); toast(`Copiei ${copias.length} ${copias.length === 1 ? 'refeição' : 'refeições'} de ${dataBR(origem)}. Ajuste o que mudou.`);
  }
};

/* ───────── Ações (entram no mapa de ações de app.js) ───────── */
const ACOES_ACOMPANHAMENTO = {
  'diario-escolher'(el) { const d = rascunhoDiario(); d.sel = el.dataset.valor; d.qtd = '1'; d.un = 'porcao'; d.erro = ''; render(); const c = $('#d-qtd'); if (c) { c.focus(); c.select(); } },
  'diario-trocar'() { const d = rascunhoDiario(); d.sel = ''; d.erro = ''; render(); const c = $('#d-busca'); if (c) c.focus(); },
  'diario-adicionar'() { adicionarAlimento(); },
  'diario-manual-salvar'() { salvarManual(); },
  'diario-modo'() { const d = rascunhoDiario(); d.manual = !d.manual; d.erro = ''; render(); },
  'diario-apagar'(el) { estado.diario = (estado.diario || []).filter(x => x.id !== el.dataset.valor); salvar(); render(); },
  'diario-item-apagar'(el) {
    const reg = (estado.diario || []).find(x => x.id === el.dataset.valor); if (!reg) return;
    reg.itens.splice(parseInt(el.dataset.idx, 10), 1); recalcularRegistro(reg); salvar(); render();
  },
  reestruturar() { pedirReestruturacao(); },
  'proposta-descartar'() { ui.proposta = null; fecharModal(); },
  'proposta-aplicar'() {
    const x = ui.proposta; if (!x) return;
    estado.perfil.planoAjuste = { kcal: x.nova.kcal, proteina: x.nova.proteina, carbo: x.nova.carbo, gordura: x.nova.gordura, desde: hojeISO() };
    estado.planoDesde = hojeISO(); ui.proposta = null;
    salvar(); fecharModal(); render(); toast('Novo plano aplicado.');
  },
  'plano-automatico'() {
    if (!confirm('Voltar às metas calculadas pelo cadastro, sem o ajuste da reestruturação?')) return;
    delete estado.perfil.planoAjuste; salvar(); render(); toast('Metas voltaram ao cálculo automático.');
  }
};
// Campos do diário: guardam o que está sendo digitado para sobreviver às atualizações de tela.
// Devolve true quando o campo é do diário.
function campoDiario(t) {
  const mapa = { 'd-busca': 'busca', 'd-qtd': 'qtd', 'd-un': 'un', 'd-nome': 'nome', 'd-kcal': 'kcal', 'd-p': 'p', 'd-data': 'data', 'd-refeicao': 'refeicao' };
  if (!mapa[t.id]) return false;
  const d = rascunhoDiario(); d[mapa[t.id]] = t.value;
  if (t.id === 'd-busca') { const r = $('#d-resultados'); if (r) r.innerHTML = listaResultados(t.value); }       // atualiza só a lista, sem tirar o foco do campo
  if (t.id === 'd-qtd') {
    const al = ALIMENTO_POR_ID[d.sel], q = num(t.value), pv = $('#d-previa');
    if (al && pv) { const i = q > 0 ? calcularItem(al, d.un === 'g' ? q : q * al.gramas) : null; pv.textContent = i ? `${n0(i.kcal)} kcal · ${br(i.p)} g de proteína · ${br(i.c)} g de carboidrato · ${br(i.g)} g de gordura` : ''; }
  }
  return true;
}
Object.assign(ACOES_ACOMPANHAMENTO, ACOES_DIARIO_EXTRA);
