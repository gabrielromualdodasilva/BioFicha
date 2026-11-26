/* Montagem da ficha de treino a partir do perfil.
   Cada dia é uma lista de "padrões de movimento"; para cada padrão o gerador escolhe o melhor
   exercício do catálogo considerando equipamento disponível, nível e restrições. */

// "?" no fim marca um padrão opcional, cortado primeiro para iniciantes.
const MODELOS = {
  fullA: { nome: 'Corpo inteiro A', foco: 'Agachar, empurrar e puxar', slots: ['quad_comp', 'peito_h', 'costas_v', 'post_iso', 'ombro_lat', 'biceps?', 'triceps?', 'core'] },
  fullB: { nome: 'Corpo inteiro B', foco: 'Posterior, costas e ombros', slots: ['post_comp', 'costas_h', 'peito_inc', 'uni', 'ombro_press', 'panturrilha?', 'triceps?', 'core'] },
  fullC: { nome: 'Corpo inteiro C', foco: 'Pernas, glúteos e braços', slots: ['quad_comp', 'costas_v', 'peito_h', 'gluteo', 'ombro_post', 'biceps', 'triceps?', 'core'] },
  push: { nome: 'Empurrar', foco: 'Peito, ombros e tríceps', slots: ['peito_h', 'peito_inc', 'ombro_press', 'peito_iso?', 'ombro_lat', 'triceps', 'triceps?'] },
  pull: { nome: 'Puxar', foco: 'Costas, posterior de ombro e bíceps', slots: ['costas_v', 'costas_h', 'costas_v?', 'ombro_post', 'biceps', 'biceps?', 'core'] },
  legs: { nome: 'Pernas', foco: 'Quadríceps, posterior, glúteos e panturrilha', slots: ['quad_comp', 'post_comp', 'uni', 'quad_iso?', 'post_iso', 'panturrilha', 'core'] },
  upperA: { nome: 'Superiores A', foco: 'Peito e costas com ênfase em força', slots: ['peito_h', 'costas_h', 'ombro_press', 'costas_v', 'peito_iso?', 'biceps', 'triceps'] },
  upperB: { nome: 'Superiores B', foco: 'Ombros, costas e braços', slots: ['peito_inc', 'costas_v', 'ombro_lat', 'costas_h', 'ombro_post?', 'triceps', 'biceps'] },
  lowerA: { nome: 'Inferiores A', foco: 'Ênfase em quadríceps', slots: ['quad_comp', 'post_comp', 'quad_iso', 'post_iso?', 'panturrilha', 'core'] },
  lowerB: { nome: 'Inferiores B', foco: 'Ênfase em posterior e glúteos', slots: ['post_comp', 'quad_comp', 'gluteo', 'uni?', 'post_iso', 'panturrilha?', 'core'] }
};

const DIVISOES = {
  2: ['fullA', 'fullB'],
  3: ['fullA', 'fullB', 'fullC'],
  '3+': ['push', 'pull', 'legs'],
  4: ['upperA', 'lowerA', 'upperB', 'lowerB'],
  5: ['push', 'pull', 'legs', 'upperB', 'lowerB'],
  6: ['push', 'pull', 'legs', 'push', 'pull', 'legs']
};

// Se não houver exercício disponível para um padrão, tenta estes no lugar.
const SUBSTITUTOS = {
  costas_v: ['costas_iso', 'costas_h', 'lombar'], costas_h: ['costas_v', 'costas_iso', 'lombar'], peito_inc: ['peito_h'], peito_iso: ['peito_h'],
  quad_comp: ['uni'], quad_iso: ['uni', 'quad_comp'], uni: ['quad_comp', 'gluteo'],
  post_comp: ['gluteo', 'post_iso'], post_iso: ['post_comp', 'gluteo'], gluteo: ['post_comp', 'gluteo_iso'],
  ombro_press: ['ombro_lat'], ombro_lat: ['ombro_press'], ombro_post: ['costas_iso', 'costas_h'],
  biceps: [], triceps: ['peito_h'], panturrilha: [], core: []
};

const PADROES_COM_CARGA = ['peito_h', 'peito_inc', 'quad_comp', 'uni', 'gluteo', 'gluteo_iso', 'triceps', 'lombar'];
const PADROES_PERNA = ['quad_comp', 'quad_iso', 'uni', 'post_comp', 'post_iso', 'gluteo', 'gluteo_iso', 'abdutor', 'adutor', 'panturrilha'];

function equipDisponivel(perfil) {
  const set = new Set(perfil.equip || []);
  set.add('corpo');
  return set;
}

/* Avalia um exercício para o perfil: indicado, exige atenção, avançado demais ou sem equipamento. */
function avaliarExercicio(ex, perfil) {
  const equip = equipDisponivel(perfil);
  const nivel = parseInt(perfil.nivel, 10) || 1;
  const conflitos = (ex.evitar || []).filter(r => (perfil.restricoes || []).includes(r));
  if (!equip.has(ex.equip)) return { status: 'sem_equip', rotulo: 'Sem equipamento', motivo: `Precisa de: ${EQUIPAMENTOS[ex.equip].toLowerCase()}.` };
  if (conflitos.length) return { status: 'atencao', rotulo: 'Atenção', motivo: `Pode sobrecarregar: ${conflitos.map(c => RESTRICOES[c].toLowerCase()).join(', ')}. Prefira outra opção ou peça orientação.` };
  if (ex.nivel > nivel) return { status: 'avancado', rotulo: 'Acima do seu nível', motivo: `Exercício de nível ${NIVEIS[ex.nivel].toLowerCase()}; ganhe base antes.` };
  return { status: 'indicado', rotulo: 'Indicado para você', motivo: 'Compatível com seu nível, seus equipamentos e suas restrições.' };
}

function escolher(padrao, perfil, usadosNoDia, usadosNaFicha, semSubstituto) {
  const nivel = parseInt(perfil.nivel, 10) || 1;
  const temEquip = equipDisponivel(perfil).size > 1;
  const tentar = semSubstituto ? [padrao] : [padrao].concat(SUBSTITUTOS[padrao] || []);
  for (const p of tentar) {
    let melhor = null, melhorNota = -Infinity, pos = 0;
    for (const ex of EXERCICIOS) {
      if (ex.padrao !== p) continue;
      const posicao = pos++;
      if (usadosNoDia.has(ex.id)) continue;
      const av = avaliarExercicio(ex, perfil);
      if (av.status === 'sem_equip' || av.status === 'atencao') continue;
      let nota = ex.nivel <= nivel ? 10 - (nivel - ex.nivel) : -20 * (ex.nivel - nivel);
      nota -= posicao * 0.6;                       // ordem de preferência do catálogo
      if (usadosNaFicha.has(ex.id)) nota -= 6;     // varia os exercícios entre os dias
      if (temEquip && ex.equip === 'corpo' && PADROES_COM_CARGA.includes(p)) nota -= 4; // com equipamento, prefere exercícios com carga
      if (nota > melhorNota) { melhorNota = nota; melhor = ex; }
    }
    if (melhor && melhorNota > -15) return melhor;
  }
  return null;
}

function parametros(ex, objetivo, nivel) {
  if (ex.padrao === 'cardio') {
    const min = { emagrecer: 25, recomposicao: 15, hipertrofia: 10, saude: 20 }[objetivo];
    return { series: 1, reps: `${min} min`, descanso: 0 };
  }
  if (ex.id === 'Plank' || ex.id === 'Side_Bridge')
    return { series: 3, reps: nivel === 1 ? '20–30 s' : '40–60 s', descanso: 45 };
  if (ex.padrao === 'core') return { series: 3, reps: '12–15', descanso: 45 };
  const comp = ex.tipo === 'C';
  const T = {
    hipertrofia: { c: ['8–10', 90], i: ['10–12', 60] },
    emagrecer: { c: ['10–12', 60], i: ['12–15', 45] },
    recomposicao: { c: ['8–12', 75], i: ['10–15', 60] },
    saude: { c: ['12–15', 60], i: ['12–15', 45] }
  }[objetivo] || { c: ['8–12', 75], i: ['10–15', 60] };
  const [reps, descanso] = comp ? T.c : T.i;
  const series = comp ? (nivel === 1 ? 3 : 4) : 3;
  return { series, reps, descanso };
}

function novoItem(ex, objetivo, nivel) {
  return Object.assign({ ex: ex.id, carga: '' }, parametros(ex, objetivo, nivel));
}

function gerarFicha(perfil, objetivo) {
  const nivel = parseInt(perfil.nivel, 10) || 1;
  const dias = Math.min(6, Math.max(2, parseInt(perfil.dias, 10) || 3));
  const chave = dias === 3 && nivel >= 2 ? '3+' : dias;
  const letras = 'ABCDEF';
  const usadosNaFicha = new Set();
  const maxForca = nivel === 1 ? 6 : nivel === 2 ? 7 : 8;

  const fichaDias = DIVISOES[chave].map((modeloId, i) => {
    const modelo = MODELOS[modeloId];
    let slots = modelo.slots.map(s => ({ padrao: s.replace('?', ''), opcional: s.endsWith('?') }));
    const temPerna = slots.some(s => PADROES_PERNA.includes(s.padrao));
    const soSuperior = !temPerna;
    if (perfil.enfase === 'gluteos' && temPerna) {
      if (!slots.some(s => s.padrao === 'gluteo')) slots.splice(2, 0, { padrao: 'gluteo' });
      slots.splice(slots.length - 1, 0, { padrao: 'abdutor', opcional: true });
    }
    if (perfil.enfase === 'superiores' && soSuperior) slots.push({ padrao: 'ombro_lat', opcional: true });
    const usadosNoDia = new Set();
    const escolhidos = [];
    for (const s of slots) {
      // Padrão opcional sem exercício disponível é pulado em vez de substituído
      const ex = escolher(s.padrao, perfil, usadosNoDia, usadosNaFicha, s.opcional);
      if (!ex) continue;
      usadosNoDia.add(ex.id);
      escolhidos.push({ ex, opcional: s.opcional });
    }
    // Limita o volume conforme o nível, cortando os opcionais do fim para o começo
    const forca = () => escolhidos.filter(e => e.ex.padrao !== 'core').length;
    for (let j = escolhidos.length - 1; j >= 0 && forca() > maxForca; j--)
      if (escolhidos[j].opcional) escolhidos.splice(j, 1);
    const itens = escolhidos.map(e => { usadosNaFicha.add(e.ex.id); return novoItem(e.ex, objetivo, nivel); });
    // Cardio ao final, conforme o objetivo
    const querCardio = objetivo === 'emagrecer' || objetivo === 'saude' || (objetivo === 'recomposicao' && i % 2 === 0);
    if (querCardio) {
      const cardio = escolher('cardio', perfil, usadosNoDia, new Set());
      if (cardio) itens.push(novoItem(cardio, objetivo, nivel));
    }
    const repetido = DIVISOES[chave].indexOf(modeloId) !== i;
    return { id: letras[i], nome: `Treino ${letras[i]}`, titulo: modelo.nome + (repetido ? ' (variação)' : ''), foco: modelo.foco, itens };
  });

  return { dias: fichaDias, geradaEm: new Date().toISOString(), objetivo };
}

/* Exercícios que podem substituir outro (mesmo padrão de movimento, compatíveis com o perfil). */
function alternativas(exId, perfil, naoUsar) {
  const base = EX_POR_ID[exId];
  if (!base) return [];
  return EXERCICIOS.filter(e => e.padrao === base.padrao && e.id !== exId && !naoUsar.has(e.id))
    .map(e => ({ ex: e, av: avaliarExercicio(e, perfil) }))
    .filter(x => x.av.status !== 'sem_equip')
    .sort((a, b) => (a.av.status === 'indicado' ? 0 : 1) - (b.av.status === 'indicado' ? 0 : 1));
}

const NOMES_DIVISAO = {
  2: 'Corpo inteiro, 2 vezes por semana', 3: 'Corpo inteiro, 3 vezes por semana', '3+': 'Empurrar / Puxar / Pernas',
  4: 'Superiores / Inferiores, 2 vezes cada', 5: 'Empurrar / Puxar / Pernas + Superiores / Inferiores', 6: 'Empurrar / Puxar / Pernas, 2 vezes cada'
};

function descreverDivisao(perfil) {
  const nivel = parseInt(perfil.nivel, 10) || 1;
  const dias = Math.min(6, Math.max(2, parseInt(perfil.dias, 10) || 3));
  return NOMES_DIVISAO[dias === 3 && nivel >= 2 ? '3+' : dias];
}

if (typeof module !== 'undefined') module.exports = { gerarFicha, avaliarExercicio, alternativas, parametros, novoItem, descreverDivisao, MODELOS };
