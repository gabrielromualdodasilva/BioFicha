/* Análise corporal e plano alimentar.
   Fórmulas usadas: IMC; Deurenberg (estimativa de % de gordura quando não há bioimpedância);
   Katch-McArdle e Mifflin-St Jeor (metabolismo basal); FFMI (índice de massa magra). */

const OBJETIVOS = {
  emagrecer: { nome: 'Emagrecimento', resumo: 'Perder gordura preservando a massa muscular' },
  recomposicao: { nome: 'Recomposição corporal', resumo: 'Perder gordura e ganhar músculo ao mesmo tempo' },
  hipertrofia: { nome: 'Hipertrofia', resumo: 'Ganhar massa muscular' },
  saude: { nome: 'Saúde e condicionamento', resumo: 'Manter o peso, ganhar disposição e condicionamento' }
};

const ROTINAS = {
  sedentaria: { nome: 'Sedentária (trabalho sentado, pouco movimento)', base: 1.2, porTreino: 0.05 },
  leve: { nome: 'Leve (caminha um pouco, fica em pé parte do dia)', base: 1.3, porTreino: 0.045 },
  moderada: { nome: 'Moderada (em pé ou andando boa parte do dia)', base: 1.4, porTreino: 0.04 },
  intensa: { nome: 'Intensa (trabalho físico pesado)', base: 1.55, porTreino: 0.035 }
};

function num(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : parseFloat(String(v).replace(',', '.'));
  return isFinite(n) ? n : null;
}

// Número com vírgula decimal e no máximo uma casa, para os textos
const br = v => String(Math.round(v * 10) / 10).replace(".", ",");

function calcularIdade(nascimento, hoje) {
  if (!nascimento) return null;
  const n = new Date(nascimento + 'T00:00:00');
  const h = hoje || new Date();
  if (isNaN(n)) return null;
  let anos = h.getFullYear() - n.getFullYear();
  const m = h.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && h.getDate() < n.getDate())) anos--;
  return anos;
}

/* Faixas de referência das balanças Omron, conferidas no manual da HBF-516: cada número é classificado em baixo,
   normal, alto ou muito alto, conforme o sexo e a idade. O manual define gordura para 20 a 79 anos e músculo para
   18 a 80; fora disso vale a faixa etária mais próxima. */
const faixaEtaria = idade => (idade < 40 ? 0 : idade < 60 ? 1 : 2);
const NIVEIS_OMRON = [['Baixa', 'atencao'], ['Normal', 'bom'], ['Alta', 'atencao'], ['Muito alta', 'alerta']];

// Gordura corporal (%): limites inferiores de normal, alta e muito alta
const GORDURA_OMRON = { F: [[21, 33, 39], [23, 34, 40], [24, 36, 42]], M: [[8, 20, 25], [11, 22, 28], [13, 25, 30]] };
function faixasGordura(sexo, idade) {
  const c = GORDURA_OMRON[sexo === 'F' ? 'F' : 'M'][faixaEtaria(idade == null ? 30 : idade)];
  return [c[0], c[1], c[2], 75].map((ate, i) => ({ ate, rotulo: NIVEIS_OMRON[i][0], nivel: NIVEIS_OMRON[i][1] }));
}

// Músculo esquelético (% do peso): limites inferiores de normal, alto e muito alto
const MUSCULO_OMRON = { F: [[24.3, 30.4, 35.4], [24.1, 30.2, 35.2], [23.9, 30.0, 35.0]], M: [[33.3, 39.4, 44.1], [33.1, 39.2, 43.9], [32.9, 39.0, 43.7]] };
function classificarMusculo(pct, sexo, idade) {
  const c = MUSCULO_OMRON[sexo === 'F' ? 'F' : 'M'][faixaEtaria(idade)];
  const i = pct < c[0] ? 0 : pct < c[1] ? 1 : pct < c[2] ? 2 : 3;
  return { rotulo: ['Baixo', 'Normal', 'Alto', 'Muito alto'][i], nivel: i === 0 ? 'atencao' : 'bom', faixaNormal: [c[0], c[1]] };
}

// Gordura abdominal (visceral), nível de 1 a 30: até 9 normal, 10 a 14 alta, 15 ou mais muito alta
function classificarVisceral(nivel) {
  return nivel < 10 ? { rotulo: 'Normal', nivel: 'bom' } : nivel < 15 ? { rotulo: 'Alta', nivel: 'atencao' } : { rotulo: 'Muito alta', nivel: 'alerta' };
}

function classificarIMC(imc) {
  if (imc < 18.5) return { rotulo: 'Abaixo do peso', nivel: 'atencao' };
  if (imc < 25) return { rotulo: 'Peso normal', nivel: 'bom' };
  if (imc < 30) return { rotulo: 'Sobrepeso', nivel: 'atencao' };
  if (imc < 35) return { rotulo: 'Obesidade grau I', nivel: 'alerta' };
  if (imc < 40) return { rotulo: 'Obesidade grau II', nivel: 'alerta' };
  return { rotulo: 'Obesidade grau III', nivel: 'alerta' };
}

function analisar(perfil, hoje) {
  const bio = perfil.bio || {};
  const sexo = perfil.sexo === 'F' ? 'F' : 'M';
  const peso = num(perfil.peso), alturaCm = num(perfil.altura);
  const h = alturaCm / 100;
  const idade = calcularIdade(perfil.nascimento, hoje) || 30;
  const dias = num(perfil.dias) || 3;
  const a = { sexo, peso, alturaCm, idade, dias, pontos: [] };

  a.imc = peso / (h * h);
  a.imcClasse = classificarIMC(a.imc);

  // % de gordura: medida na bioimpedância ou estimada
  const gMedida = num(bio.gordura);
  a.gorduraMedida = gMedida !== null;
  a.gordura = a.gorduraMedida ? gMedida
    : Math.min(55, Math.max(5, 1.2 * a.imc + 0.23 * idade - 10.8 * (sexo === 'M' ? 1 : 0) - 5.4));
  a.faixas = faixasGordura(sexo, idade);
  a.gorduraClasse = a.faixas.find(f => a.gordura < f.ate) || a.faixas[a.faixas.length - 1];
  const nivelGordura = a.faixas.indexOf(a.gorduraClasse);      // 0 baixa, 1 normal, 2 alta, 3 muito alta
  a.massaGorda = peso * a.gordura / 100;
  a.massaMagra = peso - a.massaGorda;
  a.ffmi = a.massaMagra / (h * h);
  const ffmiCortes = sexo === 'F' ? [14.5, 16.5, 18.5] : [18, 20, 22];
  a.ffmiClasse = a.ffmi < ffmiCortes[0] ? 'abaixo da média' : a.ffmi < ffmiCortes[1] ? 'na média'
    : a.ffmi < ffmiCortes[2] ? 'acima da média' : 'muito desenvolvida';

  // Demais dados da bioimpedância: gordura abdominal (visceral, nível) e músculo esquelético (% do peso)
  a.visceral = num(bio.visceral);
  if (a.visceral !== null) a.visceralClasse = classificarVisceral(a.visceral);
  a.musculo = num(bio.musculo);
  if (a.musculo !== null) {
    a.musculoKg = peso * a.musculo / 100;
    a.musculoClasse = classificarMusculo(a.musculo, sexo, idade);
  }

  // Metabolismo em repouso e gasto diário
  const tmbInf = num(bio.tmb);
  if (tmbInf !== null && tmbInf >= 800 && tmbInf <= 4000) {
    a.tmb = tmbInf; a.tmbFonte = 'informado pela bioimpedância';
  } else if (a.gorduraMedida) {
    a.tmb = 370 + 21.6 * a.massaMagra; a.tmbFonte = 'calculado pela massa magra (Katch-McArdle)';
  } else {
    a.tmb = 10 * peso + 6.25 * alturaCm - 5 * idade + (sexo === 'M' ? 5 : -161);
    a.tmbFonte = 'estimado por peso, altura e idade (Mifflin-St Jeor)';
  }
  const rot = ROTINAS[perfil.rotina] || ROTINAS.sedentaria;
  a.fatorAtividade = Math.min(1.9, rot.base + rot.porTreino * dias);
  a.gastoDiario = a.tmb * a.fatorAtividade;

  // Objetivo recomendado, pela faixa de gordura: muito alta → emagrecer; alta → recomposição; normal ou baixa → ganhar massa
  a.gorduraAlta = nivelGordura === 3;
  if (a.imc < 18.5) {
    a.objetivoRecomendado = 'hipertrofia';
    a.motivoObjetivo = 'Seu peso está abaixo do recomendado para a sua altura; a prioridade é ganhar massa.';
  } else if (a.gorduraAlta || (a.visceral !== null && a.visceral >= 10)) {
    a.objetivoRecomendado = 'emagrecer';
    a.motivoObjetivo = a.gorduraAlta
      ? `Sua gordura corporal (${br(a.gordura)}%) está na faixa muito alta; reduzir gordura traz o maior ganho de saúde agora.`
      : 'Sua gordura abdominal está acima do normal; reduzi-la é a prioridade para a saúde.';
  } else if (nivelGordura === 2) {
    a.objetivoRecomendado = 'recomposicao';
    a.motivoObjetivo = `Com ${br(a.gordura)}% de gordura você está um pouco acima da faixa normal: dá para perder gordura e ganhar músculo ao mesmo tempo, sem dieta agressiva.`;
  } else {
    a.objetivoRecomendado = 'hipertrofia';
    a.motivoObjetivo = `Sua gordura corporal (${br(a.gordura)}%) está na faixa ${nivelGordura === 0 ? 'baixa' : 'normal'}; é um bom momento para focar em ganhar massa muscular.`;
  }
  a.objetivo = OBJETIVOS[perfil.objetivo] ? perfil.objetivo : a.objetivoRecomendado;

  // Leitura dos números
  const P = (tipo, texto) => a.pontos.push({ tipo, texto });
  const normalG = `${a.faixas[0].ate}% a ${br(a.faixas[1].ate - 0.1)}%`;
  if (!a.gorduraMedida) P('info', 'Você não informou a gordura corporal. Estou usando uma estimativa por IMC e idade; com a bioimpedância a análise fica bem mais precisa.');
  if (a.imc >= 25 && a.gorduraMedida && nivelGordura <= 1)
    P('bom', `Seu IMC (${br(a.imc)}) indica sobrepeso, mas a gordura corporal está na faixa ${nivelGordura === 0 ? 'baixa' : 'normal'}: o peso extra vem de massa muscular, não de gordura.`);
  else if (a.imc >= 18.5 && a.imc < 25 && nivelGordura >= 2)
    P('atencao', 'Seu peso está normal para a altura, mas a gordura corporal está acima da faixa normal e a massa muscular é baixa. Musculação e proteína adequada são o caminho.');
  if (nivelGordura === 3)
    P('alerta', `Gordura corporal de ${br(a.gordura)}%, na faixa muito alta (o normal para o seu sexo e idade é de ${normalG}). Isso equivale a cerca de ${br(a.massaGorda)} kg de gordura.`);
  else if (nivelGordura === 2)
    P('atencao', `Gordura corporal de ${br(a.gordura)}%, na faixa alta (o normal para o seu sexo e idade é de ${normalG}).`);
  else if (nivelGordura === 0)
    P('atencao', `Gordura corporal de ${br(a.gordura)}%, abaixo da faixa normal (${normalG}). Manter esse nível por muito tempo pode afetar hormônios e imunidade.`);
  else
    P('bom', `Gordura corporal de ${br(a.gordura)}%, dentro da faixa normal para o seu sexo e idade (${normalG}).`);
  if (!a.gorduraMedida || a.gorduraAlta)
    P('info', `Massa magra ${a.gorduraMedida ? 'de' : 'estimada em'} ${br(a.massaMagra)} kg. Preservar e aumentar essa massa é o que mantém o metabolismo alto.`);
  else P(a.ffmiClasse === 'abaixo da média' ? 'atencao' : 'bom',
    `Massa magra de ${br(a.massaMagra)} kg (índice FFMI ${br(a.ffmi)}), ${a.ffmiClasse} para ${sexo === 'F' ? 'mulheres' : 'homens'}.`);
  if (a.visceralClasse) {
    if (a.visceralClasse.nivel === 'bom') P('bom', `Gordura abdominal (visceral) nível ${a.visceral}, dentro da faixa normal (até 9).`);
    else P(a.visceralClasse.nivel, `Gordura abdominal (visceral) nível ${a.visceral}, ${a.visceralClasse.rotulo.toLowerCase()} (o normal é até 9). É a gordura em volta dos órgãos, a mais ligada a risco cardiovascular. Cardio regular e redução de açúcar e álcool ajudam bastante.`);
  }
  if (a.musculoClasse) {
    const [min, max] = a.musculoClasse.faixaNormal, ref = `${br(min)}% a ${br(max - 0.1)}%`;
    if (a.musculoClasse.rotulo === 'Baixo')
      P('atencao', `Músculo esquelético de ${br(a.musculo)}% do peso (cerca de ${br(a.musculoKg)} kg), abaixo da faixa normal (${ref}). Priorize o treino de força e a proteína.`);
    else P('bom', `Músculo esquelético de ${br(a.musculo)}% do peso (cerca de ${br(a.musculoKg)} kg), ${a.musculoClasse.rotulo === 'Normal' ? 'dentro da' : 'acima da'} faixa normal (${ref}).`);
  }

  return a;
}

/* ───────── Alimentação ───────── */

// Valores por 100 g (base: tabela TACO e USDA). porUn = gramas de uma unidade caseira.
const ALIMENTOS = {
  frango: { nome: 'peito de frango grelhado', kcal: 159, p: 32, c: 0, g: 2.5, max: 250 },
  patinho: { nome: 'carne magra grelhada (patinho)', kcal: 219, p: 35.9, c: 0, g: 7.3, max: 250 },
  tilapia: { nome: 'filé de peixe grelhado (tilápia)', kcal: 128, p: 26, c: 0, g: 2.7, max: 300 },
  ovo: { nome: 'ovos', kcal: 146, p: 13.3, c: 0.6, g: 9.5, porUn: 50, sing: 'ovo', plur: 'ovos', max: 150 },
  atum: { nome: 'atum em água', kcal: 116, p: 26, c: 0, g: 1, max: 170 },
  iogurte: { nome: 'iogurte natural desnatado', kcal: 41, p: 3.8, c: 5.8, g: 0.3, max: 340 },
  cottage: { nome: 'queijo cottage', kcal: 98, p: 11, c: 3.4, g: 4.3, max: 200 },
  whey: { nome: 'whey protein', kcal: 346, p: 78.1, c: 3.2, g: 1.6, porUn: 30, passo: 0.5, sing: 'dose de whey protein', plur: 'doses de whey protein', max: 60 },
  tofu: { nome: 'tofu', kcal: 64, p: 6.6, c: 2.1, g: 4, max: 300 },
  pts: { nome: 'proteína de soja texturizada (peso seco)', kcal: 330, p: 50, c: 30, g: 1, max: 60 },
  feijao: { nome: 'feijão cozido', kcal: 76, p: 4.8, c: 13.6, g: 0.5 },
  arroz: { nome: 'arroz cozido', kcal: 128, p: 2.5, c: 28.1, g: 0.2 },
  batatadoce: { nome: 'batata-doce cozida', kcal: 77, p: 0.6, c: 18.4, g: 0.1 },
  macarrao: { nome: 'macarrão cozido', kcal: 101, p: 3.7, c: 21, g: 0.5 },
  mandioca: { nome: 'mandioca cozida', kcal: 125, p: 0.6, c: 30.1, g: 0.3 },
  paofrances: { nome: 'pão francês', kcal: 300, p: 8, c: 58.6, g: 3.1, porUn: 50, passo: 0.5, sing: 'pão francês', plur: 'pães franceses' },
  paointegral: { nome: 'pão integral', kcal: 253, p: 9.4, c: 49.9, g: 3.7, porUn: 25, sing: 'fatia de pão integral', plur: 'fatias de pão integral' },
  tapioca: { nome: 'goma de tapioca', kcal: 240, p: 0, c: 60, g: 0 },
  aveia: { nome: 'aveia em flocos', kcal: 394, p: 13.9, c: 66.6, g: 8.5 },
  cuscuz: { nome: 'cuscuz de milho cozido', kcal: 113, p: 2.2, c: 25.3, g: 0.7 },
  banana: { nome: 'banana', kcal: 98, p: 1.3, c: 26, g: 0.1, porUn: 80, sing: 'banana', plur: 'bananas' },
  fruta: { nome: 'fruta', kcal: 60, p: 0.7, c: 15, g: 0.2, porUn: 120, sing: 'fruta (maçã, mamão, laranja…)', plur: 'frutas' },
  azeite: { nome: 'azeite de oliva', kcal: 884, p: 0, c: 0, g: 100, porUn: 12, passo: 0.5, sing: 'colher de sopa de azeite', plur: 'colheres de sopa de azeite' },
  castanhas: { nome: 'castanhas (caju ou pará)', kcal: 600, p: 16, c: 20, g: 52, passo10: 5 },
  pastaamendoim: { nome: 'pasta de amendoim', kcal: 590, p: 25, c: 20, g: 50, porUn: 15, passo: 0.5, sing: 'colher de sopa de pasta de amendoim', plur: 'colheres de sopa de pasta de amendoim' },
  abacate: { nome: 'abacate', kcal: 96, p: 1.2, c: 6, g: 8.4 }
};

function formatarQtd(chave, gramas) {
  const al = ALIMENTOS[chave];
  if (al.porUn) {
    const passo = al.passo || 1;
    const n = Math.max(passo, Math.round(gramas / al.porUn / passo) * passo);
    const txt = String(n).replace('.', ',');
    return { texto: `${txt} ${n > 1 ? al.plur : al.sing}`, gramas: n * al.porUn };
  }
  const passo = al.passo10 || 10;
  const g = Math.max(passo * 2, Math.round(gramas / passo) * passo);
  return { texto: `${g} g de ${al.nome}`, gramas: g };
}

/* Porção de proteína. Se passar do limite razoável do alimento, completa com um segundo alimento. */
function opcaoProteina(chave, pFalta, comp) {
  const al = ALIMENTOS[chave];
  const gramas = pFalta / al.p * 100;
  if (!al.max || gramas <= al.max * 1.15) {
    const q = formatarQtd(chave, gramas);
    return { texto: q.texto, g: macrosDe(chave, q.gramas).g };
  }
  const base = formatarQtd(chave, al.max);
  const m = macrosDe(chave, base.gramas);
  const sobra = pFalta - m.p;
  if (!comp || sobra < 6) return { texto: base.texto, g: m.g };
  const c = ALIMENTOS[comp];
  const extra = formatarQtd(comp, Math.min(sobra / c.p * 100, c.max || Infinity));
  return { texto: base.texto + ' + ' + extra.texto, g: m.g + macrosDe(comp, extra.gramas).g };
}

function macrosDe(chave, gramas) {
  const al = ALIMENTOS[chave], f = gramas / 100;
  return { kcal: al.kcal * f, p: al.p * f, c: al.c * f, g: al.g * f };
}

function refeicoesBase(n, veg) {
  const protPrincipal = veg ? ['tofu', 'ovo', 'pts'] : ['frango', 'patinho', 'tilapia'];
  const compPrincipal = veg ? ['ovo', 'tofu'] : [];
  const protLeve = veg ? ['iogurte', 'whey', 'ovo', 'cottage'] : ['iogurte', 'whey', 'ovo', 'atum'];
  const R = {
    cafe: { nome: 'Café da manhã', fixos: [['fruta', 120]], prot: ['ovo', 'whey', 'iogurte', 'cottage'],
      carb: ['paofrances', 'paointegral', 'tapioca', 'aveia', 'cuscuz'], gord: ['pastaamendoim', 'castanhas'], comp: ['whey', 'ovo'] },
    lancheManha: { nome: 'Lanche da manhã', fixos: [], prot: protLeve, carb: ['banana', 'aveia', 'paointegral'], gord: ['castanhas', 'pastaamendoim'], comp: ['whey', 'ovo'] },
    almoco: { nome: 'Almoço', fixos: [['feijao', veg ? 150 : 100]], prot: protPrincipal,
      carb: ['arroz', 'batatadoce', 'macarrao', 'mandioca'], gord: ['azeite', 'castanhas'], comp: compPrincipal, salada: true },
    lancheTarde: { nome: 'Lanche da tarde / pré-treino', fixos: [], prot: protLeve, carb: ['banana', 'paointegral', 'aveia', 'tapioca'], gord: ['pastaamendoim', 'castanhas'], comp: ['whey', 'ovo'] },
    jantar: { nome: 'Jantar', fixos: veg ? [['feijao', 150]] : [], prot: protPrincipal,
      carb: ['arroz', 'batatadoce', 'macarrao', 'mandioca'], gord: ['azeite', 'castanhas'], comp: compPrincipal, salada: true },
    ceia: { nome: 'Ceia', fixos: [], prot: ['iogurte', 'cottage', 'ovo'], carb: ['fruta', 'aveia'], gord: ['castanhas'], comp: ['whey', 'ovo'] }
  };
  const planos = {
    3: [['cafe', 0.30], ['almoco', 0.40], ['jantar', 0.30]],
    4: [['cafe', 0.25], ['almoco', 0.35], ['lancheTarde', 0.15], ['jantar', 0.25]],
    5: [['cafe', 0.20], ['lancheManha', 0.10], ['almoco', 0.30], ['lancheTarde', 0.15], ['jantar', 0.25]],
    6: [['cafe', 0.20], ['lancheManha', 0.10], ['almoco', 0.30], ['lancheTarde', 0.12], ['jantar', 0.20], ['ceia', 0.08]]
  };
  return (planos[n] || planos[4]).map(([k, fracao]) => Object.assign({ fracao }, R[k]));
}

function montarRefeicao(def, dia) {
  const alvo = { kcal: dia.kcal * def.fracao, p: dia.proteina * def.fracao, c: dia.carbo * def.fracao, g: dia.gordura * def.fracao };
  const resto = { p: alvo.p, c: alvo.c, g: alvo.g };
  const fixos = def.fixos.map(([k, g]) => {
    const m = macrosDe(k, g); resto.p -= m.p; resto.c -= m.c; resto.g -= m.g;
    return formatarQtd(k, g).texto;
  });
  // Carboidrato: cada opção cobre sozinha o carboidrato que falta
  let carb = [], refCarb = { p: 0, g: 0 };
  if (resto.c >= 10) {
    carb = def.carb.map(k => formatarQtd(k, resto.c / ALIMENTOS[k].c * 100).texto);
    const k0 = def.carb[0], g0 = formatarQtd(k0, resto.c / ALIMENTOS[k0].c * 100).gramas;
    refCarb = macrosDe(k0, g0);
  }
  // Proteína: desconta o que já veio do carboidrato de referência
  const pFalta = Math.max(8, resto.p - refCarb.p);
  const opcoes = def.prot.map(k => opcaoProteina(k, pFalta, (def.comp || []).find(c => c !== k)));
  const prot = opcoes.map(o => o.texto);
  const refProt = opcoes[0];
  // Gordura: o que sobrar depois da proteína e do carboidrato de referência
  const gFalta = resto.g - refProt.g - refCarb.g;
  const gord = gFalta >= 4 ? def.gord.map(k => formatarQtd(k, gFalta / ALIMENTOS[k].g * 100).texto) : [];
  return { nome: def.nome, alvo, fixos, prot, carb, gord, salada: !!def.salada };
}

function planoAlimentar(perfil, analise) {
  const a = analise || analisar(perfil);
  const obj = a.objetivo;
  const sexo = a.sexo;
  const muitoAlta = a.gordura >= (sexo === 'F' ? 38 : 30);
  const ajuste = { emagrecer: muitoAlta ? -0.25 : -0.20, recomposicao: -0.10, hipertrofia: 0.10, saude: 0 }[obj];
  const piso = sexo === 'F' ? 1200 : 1500;
  let kcal = Math.max(piso, a.gastoDiario * (1 + ajuste));
  kcal = Math.round(kcal / 10) * 10;

  // Peso de referência: para quem tem gordura elevada, usa o peso com gordura na faixa saudável
  const gAlvo = sexo === 'F' ? 0.28 : 0.20;
  const pesoRef = a.gorduraAlta ? a.massaMagra / (1 - gAlvo) : a.peso;
  const protKg = { emagrecer: 2.0, recomposicao: 2.0, hipertrofia: 1.8, saude: 1.4 }[obj];
  let gordKg = { emagrecer: 0.8, recomposicao: 0.9, hipertrofia: 1.0, saude: 1.0 }[obj];
  let proteina = Math.round(pesoRef * protKg);
  let gordura = Math.round(Math.min(Math.max(pesoRef * gordKg, kcal * 0.20 / 9), kcal * 0.35 / 9));
  let carbo = Math.round((kcal - proteina * 4 - gordura * 9) / 4);
  if (carbo < 80) { gordura = Math.round(Math.max(pesoRef * 0.6, kcal * 0.18 / 9)); carbo = Math.max(50, Math.round((kcal - proteina * 4 - gordura * 9) / 4)); }

  // Metas reestruturadas (perfil.planoAjuste) valem no lugar das calculadas
  const aj = perfil.planoAjuste, ajustado = !!(aj && num(aj.kcal) && num(aj.proteina) && num(aj.carbo) && num(aj.gordura));
  if (ajustado) { kcal = num(aj.kcal); proteina = num(aj.proteina); carbo = num(aj.carbo); gordura = num(aj.gordura); }

  const dia = { kcal, proteina, carbo, gordura };
  const veg = perfil.dieta === 'vegetariana';
  const nRef = Math.min(6, Math.max(3, parseInt(perfil.refeicoes, 10) || 4));
  const refeicoes = refeicoesBase(nRef, veg).map(d => montarRefeicao(d, dia));

  const diferenca = kcal - a.gastoDiario;
  const kgSemana = diferenca * 7 / 7700;
  const agua = Math.round(a.peso * 35 / 100) / 10;

  const dicas = {
    emagrecer: [
      'O que emagrece é o déficit calórico da semana, não um alimento específico. Constância vale mais que perfeição.',
      'Comece as refeições principais pela salada e pela proteína: dá mais saciedade com menos calorias.',
      'Evite calorias líquidas (refrigerante, suco, álcool). São as mais fáceis de cortar sem passar fome.',
      'Se a perda passar de 1% do peso por semana, aumente um pouco as calorias para não perder músculo.'
    ],
    recomposicao: [
      'O déficit é pequeno de propósito: você perde gordura devagar enquanto o treino constrói músculo.',
      'Bata a meta de proteína todos os dias; é o nutriente mais importante para esse objetivo.',
      'Concentre boa parte do carboidrato antes e depois do treino para render mais.',
      'A balança muda pouco na recomposição. Acompanhe medidas, fotos e a bioimpedância.'
    ],
    hipertrofia: [
      'Sem sobra de calorias o corpo não constrói músculo. Se o peso não subir em 2–3 semanas, some 100–200 kcal.',
      'Distribua a proteína em 3 a 5 refeições, com pelo menos 25–40 g em cada.',
      'Carboidrato é o combustível do treino pesado: não tenha medo dele.',
      'Ganhar entre 0,25% e 0,5% do peso por semana mantém o ganho de gordura sob controle.'
    ],
    saude: [
      'Prefira comida de verdade: arroz, feijão, carnes, ovos, frutas, legumes e verduras.',
      'Proteína em todas as refeições ajuda a manter a massa muscular e a saciedade.',
      'Metade do prato com vegetais no almoço e no jantar é uma regra simples e eficiente.',
      'Reduza ultraprocessados, açúcar e álcool; não precisa cortar tudo, só diminuir a frequência.'
    ]
  }[obj];

  return {
    objetivo: obj, kcal, proteina, carbo, gordura, ajuste, diferenca, kgSemana, agua,
    fibra: Math.round(kcal / 1000 * 14), pesoRef, protKg: ajustado ? proteina / pesoRef : protKg, refeicoes, dicas, veg, ajustado
  };
}

if (typeof module !== 'undefined') module.exports = { analisar, planoAlimentar, OBJETIVOS, ROTINAS, ALIMENTOS, calcularIdade, num, faixasGordura };
