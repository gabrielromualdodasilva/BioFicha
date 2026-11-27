'use strict';
/* BioFicha · avatar (o mesmo do Planejamento Financeiro)
   Desenho próprio em SVG (200 × 200), ilustrado com luz e sombra (gradientes na pele, no cabelo, na roupa e no fundo).
   A primeira escolha é Homem ou Mulher: muda rosto, pescoço, ombros, sobrancelhas, cílios, lábios e quais cabelos,
   barbas e roupas aparecem. O avatar é guardado como um objeto pequeno ({ tipo: 'masculino', pele: 2, cabelo: 'curto', … })
   no perfil de cada pessoa (perfil.avatar). Roda no navegador (variável global AVATAR) e no Node (testes).
   O humor (feliz, neutro, triste) vem dos treinos e é calculado em js/avatar-vivo.js. */
(function (global) {
  const PELE = ['#ffe0c7', '#f6c7a1', '#e7aa7d', '#c98a5c', '#9a6340', '#6a4027'];
  const CABELO = ['#2a1d17', '#4a2c1c', '#77482a', '#b0602f', '#dcae5e', '#ecdcb6', '#b8b2aa', '#3d6fd6', '#df6aa3', '#7a5ce0', '#141414'];
  const NOMES_CABELO = ['Castanho bem escuro', 'Castanho escuro', 'Castanho', 'Ruivo', 'Loiro', 'Platinado', 'Grisalho', 'Azul', 'Rosa', 'Roxo', 'Preto'];
  const ROUPA = ['#4338ca', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#1f2937', '#f3f4f6', '#64748b', '#7c3aed'];
  const FUNDO = ['#c7d2fe', '#bae6fd', '#bbf7d0', '#fde68a', '#fecaca', '#fbcfe8', '#ddd6fe', '#e2e8f0', '#fed7aa', '#99f6e4'];

  // Opções: [valor, nome, só para ('m' homem | 'f' mulher)]
  const PARTES = [
    { id: 'tipo', nome: 'Tipo', grupo: 'base', opcoes: [['masculino', 'Homem'], ['feminino', 'Mulher']] },
    { id: 'pele', nome: 'Pele', grupo: 'rosto', cores: PELE },
    { id: 'olhos', nome: 'Olhos', grupo: 'rosto', recorte: '64 78 72 38', opcoes: [['redondos', 'Brilhantes'], ['grandes', 'Grandes'], ['felizes', 'Felizes'], ['piscando', 'Piscando'], ['serenos', 'Serenos']] },
    { id: 'sobrancelha', nome: 'Sobrancelhas', grupo: 'rosto', recorte: '64 72 72 38', opcoes: [['naturais', 'Naturais'], ['grossas', 'Grossas'], ['arqueadas', 'Arqueadas'], ['retas', 'Retas']] },
    { id: 'boca', nome: 'Boca', grupo: 'rosto', recorte: '76 104 48 34', opcoes: [['sorriso', 'Sorriso'], ['sorrisinho', 'Sorrisinho'], ['riso', 'Risada'], ['lado', 'De lado'], ['neutra', 'Séria'], ['surpresa', 'Surpresa'], ['lingua', 'Língua']] },
    { id: 'rosto', nome: 'Detalhes', grupo: 'rosto', recorte: '56 84 88 56', opcoes: [['nenhum', 'Nenhum'], ['bochechas', 'Bochechas'], ['sardas', 'Sardas'], ['pinta', 'Pinta']] },
    { id: 'cabelo', nome: 'Cabelo', grupo: 'cabelo', opcoes: [
      ['curto', 'Curto', 'm'], ['degrade', 'Degradê', 'm'], ['topete', 'Topete', 'm'], ['lateral', 'Lateral', 'm'], ['cacheado', 'Cacheado'], ['black', 'Black power'], ['raspado', 'Raspado', 'm'], ['careca', 'Careca', 'm'],
      ['longo', 'Longo', 'f'], ['ondulado', 'Ondulado', 'f'], ['franja', 'Com franja', 'f'], ['chanel', 'Chanel', 'f'], ['rabo', 'Rabo de cavalo', 'f'], ['coque', 'Coque', 'f'], ['curtinho', 'Curtinho', 'f']] },
    { id: 'corCabelo', nome: 'Cor do cabelo', grupo: 'cabelo', cores: CABELO, nomes: NOMES_CABELO, ordem: [10, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9] },
    { id: 'barba', nome: 'Barba', grupo: 'cabelo', so: 'masculino', recorte: '50 88 100 70', opcoes: [['nenhuma', 'Sem barba'], ['rala', 'Por fazer'], ['bigode', 'Bigode'], ['cavanhaque', 'Cavanhaque'], ['curta', 'Curta'], ['cheia', 'Cheia']] },
    { id: 'acessorio', nome: 'Acessório', grupo: 'estilo', opcoes: [['nenhum', 'Nenhum'], ['redondo', 'Óculos redondos'], ['quadrado', 'Óculos quadrados'], ['sol', 'Óculos escuros'], ['bone', 'Boné'], ['fone', 'Fone'], ['brinco', 'Brincos'], ['colar', 'Colar']] },
    { id: 'roupa', nome: 'Roupa', grupo: 'estilo', opcoes: [['camiseta', 'Camiseta'], ['golaV', 'Gola V'], ['camisa', 'Camisa'], ['moletom', 'Moletom'], ['jaqueta', 'Jaqueta']] },
    { id: 'corRoupa', nome: 'Cor da roupa', grupo: 'estilo', cores: ROUPA },
    { id: 'fundo', nome: 'Fundo', grupo: 'estilo', cores: FUNDO }
  ];
  const GRUPOS = [['rosto', 'Rosto'], ['cabelo', 'Cabelo'], ['estilo', 'Estilo']];
  const BASE = {
    masculino: { olhos: 'redondos', sobrancelha: 'naturais', boca: 'sorriso', rosto: 'nenhum', cabelo: 'curto', barba: 'nenhuma', acessorio: 'nenhum', roupa: 'camiseta' },
    feminino: { olhos: 'grandes', sobrancelha: 'arqueadas', boca: 'sorriso', rosto: 'bochechas', cabelo: 'longo', barba: 'nenhuma', acessorio: 'brinco', roupa: 'camiseta' }
  };
  const PADRAO = Object.assign({ tipo: 'masculino', pele: 1, corCabelo: 1, corRoupa: 0, fundo: 0 }, BASE.masculino);
  const letra = tipo => (tipo === 'feminino' ? 'f' : 'm');
  const vale = (parte, valor, tipo) => parte.opcoes.some(o => o[0] === valor && (!o[2] || o[2] === letra(tipo)));
  const opcoesPara = (parte, tipo) => (parte.opcoes || []).filter(o => !o[2] || o[2] === letra(tipo));

  // Nomes da primeira versão do avatar, para quem já tinha montado um
  const ANTIGOS = {
    olhos: { aberto: 'grandes', ponto: 'redondos', feliz: 'felizes', sereno: 'serenos', cilios: 'grandes' },
    sobrancelha: { normal: 'naturais', grossa: 'grossas', arqueada: 'arqueadas', reta: 'retas', fina: 'naturais' },
    boca: { neutro: 'neutra', surpreso: 'surpresa' },
    cabelo: { medio: 'ondulado' }
  };
  // Confere e completa um avatar vindo de fora (perfil na nuvem, navegador)
  function normalizar(a) {
    a = a && typeof a === 'object' ? Object.assign({}, a) : {};
    for (const [k, mapa] of Object.entries(ANTIGOS)) if (mapa[a[k]]) a[k] = mapa[a[k]];
    let tipo = a.tipo === 'feminino' || a.tipo === 'masculino' ? a.tipo : null;
    if (!tipo) tipo = a.barba && a.barba !== 'nenhuma' ? 'masculino' : ['longo', 'ondulado', 'coque'].includes(a.cabelo) ? 'feminino' : 'masculino';
    const r = Object.assign({}, PADRAO, BASE[tipo], { tipo });
    for (const p of PARTES) {
      if (p.id === 'tipo') continue;
      const v = a[p.id];
      if (p.cores) { if (Number.isInteger(v) && v >= 0 && v < p.cores.length) r[p.id] = v; }
      else if (vale(p, v, tipo)) r[p.id] = v;
    }
    if (tipo === 'feminino') r.barba = 'nenhuma';
    return r;
  }
  // Troca Homem/Mulher mantendo o que continuar valendo (cores, olhos, boca…) e trocando o resto pelo padrão do tipo
  function trocarTipo(a, tipo) { return normalizar(Object.assign({}, normalizar(a), { tipo, cabelo: null, barba: null })); }
  function aleatorio(sorteio, tipoFixo) {
    const s = sorteio || Math.random, um = l => l[Math.floor(s() * l.length)];
    const tipo = tipoFixo || (s() < 0.5 ? 'masculino' : 'feminino');
    const a = { tipo };
    for (const p of PARTES) {
      if (p.id === 'tipo') continue;
      a[p.id] = p.cores ? Math.floor(s() * p.cores.length) : um(opcoesPara(p, tipo))[0];
    }
    // sorteio mais natural: cores de cabelo comuns, menos acessórios, barba em metade dos homens
    if (s() < 0.75) a.corCabelo = [10, 0, 1, 2, 3, 4, 5][Math.floor(s() * 7)];
    if (s() < 0.55) a.acessorio = tipo === 'feminino' && s() < 0.5 ? 'brinco' : 'nenhum';
    if (tipo === 'masculino' && s() < 0.5) a.barba = 'nenhuma';
    if (s() < 0.65) a.boca = 'sorriso';
    if (s() < 0.7) a.rosto = tipo === 'feminino' ? 'bochechas' : 'nenhum';
    if (['piscando', 'serenos'].includes(a.olhos) && s() < 0.6) a.olhos = tipo === 'feminino' ? 'grandes' : 'redondos';
    return normalizar(a);
  }

  // Escurece ou clareia uma cor #rrggbb (f < 0 escurece)
  function tom(hex, f) {
    const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(x => Math.round(f < 0 ? x * (1 + f) : x + (255 - x) * f));
    return '#' + c.map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
  }
  function mistura(a, b, t) {
    const p = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16)), x = p(a), y = p(b);
    return '#' + x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('');
  }
  const espelho = s => `<g transform="translate(200 0) scale(-1 1)">${s}</g>`;

  /* ───────── Rosto e corpo por tipo ───────── */
  const FORMA = {
    masculino: {
      rosto: 'M60 92C60 61 78 47 100 47S140 61 140 92V104C140 131 123 148 100 148S60 131 60 104Z',
      contorno: 'M62 108C64 124 72 136 84 143C74 132 68 120 66 106ZM138 108C136 124 128 136 116 143C126 132 132 120 134 106Z',
      orelha: [60, 103, 8.5, 11.5], pescoco: 'M84 128H116V157Q100 169 84 157Z', sombraPescoco: 'M84 128H116V144Q100 155 84 144Z',
      corpo: 'M10 200C12 171 38 158 70 154H130C162 158 188 171 190 200Z', brilhoCorpo: 'M28 186C34 172 50 163 70 159',
      gola: [84, 116, 155]
    },
    feminino: {
      rosto: 'M62 91C62 61 79 47 100 47S138 61 138 91C138 117 123 139 100 144C77 139 62 117 62 91Z',
      orelha: [62, 102, 7.5, 10.5], pescoco: 'M89 128H111V159Q100 169 89 159Z', sombraPescoco: 'M89 128H111V143Q100 151 89 143Z',
      corpo: 'M26 200C28 175 50 163 78 159H122C150 163 172 175 174 200Z', brilhoCorpo: 'M40 188C45 176 58 167 76 163',
      gola: [86, 114, 159]
    }
  };

  /* ───────── Cabelo (atrás da cabeça e na frente) ─────────
     Cada estilo: { atras, frente } com o caminho; a cor vem do gradiente do cabelo (url(#idH)). */
  const CACHOS_M = [[62, 82, 9], [65, 66, 10], [75, 53, 11], [89, 45, 11], [104, 43, 11], [119, 46, 11], [131, 56, 10], [137, 70, 9.5], [140, 85, 8], [60, 95, 7]];
  const CACHOS_F_ATRAS = [[66, 70, 16], [57, 92, 16], [54, 116, 15], [57, 139, 14], [66, 158, 12], [134, 70, 16], [143, 92, 16], [146, 116, 15], [143, 139, 14], [134, 158, 12], [82, 50, 16], [100, 44, 17], [118, 50, 16]];
  const CACHOS_F_FRENTE = [[66, 84, 9], [72, 70, 10], [84, 61, 10], [98, 58, 10], [112, 59, 10], [125, 66, 10], [133, 80, 9]];
  const bolas = (lista, pinta) => lista.map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${pinta}"/>`).join('');
  const brilhoBolas = lista => lista.filter((_, i) => i % 2 === 0).map(([x, y, r]) => `<circle cx="${x - r * 0.3}" cy="${y - r * 0.35}" r="${r * 0.32}" fill="#fff" opacity=".16"/>`).join('');
  const CABELOS = {
    curto: { fios: 'M78 70C82 60 90 52 100 49M96 69C100 58 108 50 118 48M114 70C118 62 124 56 132 54', frente: 'M57 101C53 66 70 37 100 35C130 37 147 66 143 101H139C138 86 135 77 129 72C120 67 108 72 96 69C86 66 76 67 70 73C64 80 62 90 61 101Z', brilho: 'M70 57C78 45 92 40 106 40' },
    degrade: { fios: 'M84 68C88 58 96 50 106 47M104 66C108 57 116 51 126 50', frente: 'M62 80C60 55 77 37 100 36C123 37 140 55 138 80C134 72 126 67 116 66C104 65 92 67 82 69C72 71 66 75 62 80Z', lados: 'M57 101C55 81 60 66 70 58L72 74C66 80 62 90 61 101ZM143 101C145 81 140 66 130 58L128 74C134 80 138 90 139 101Z', brilho: 'M74 52C82 43 94 40 106 40' },
    topete: { fios: 'M88 68C92 52 102 40 116 34M104 66C110 52 120 42 134 40M74 78C76 64 84 52 96 44', frente: 'M57 101C52 62 68 31 98 27C124 24 148 37 146 62C146 74 144 87 143 101H139C137 84 131 74 123 70C113 65 100 67 90 70C80 72 70 77 65 84C62 89 61 95 61 101Z', brilho: 'M84 35C98 29 116 29 128 37' },
    lateral: { fios: 'M92 60C102 54 114 52 126 56M98 64C110 60 122 60 134 66', frente: 'M57 101C53 64 72 37 102 36C130 37 147 60 143 101H139C137 82 130 72 120 67C106 66 92 62 82 56C74 64 64 78 61 101Z', risca: 'M82 56C96 47 118 45 132 56', brilho: 'M110 42C120 43 130 48 136 56' },
    cacheado: {
      m: { base: 'M58 99C55 66 72 42 100 41C128 42 145 66 142 99H138C136 85 132 76 126 72C116 70 106 73 96 71C86 69 76 71 70 76C64 82 62 90 62 99Z', cachos: CACHOS_M },
      f: { atras: CACHOS_F_ATRAS, base: 'M62 96C60 66 76 46 100 45C124 46 140 66 138 96C134 82 126 74 116 72C104 70 94 72 84 74C74 76 66 84 62 96Z', cachos: CACHOS_F_FRENTE }
    },
    black: {
      m: { atras: 'M100 24C130 24 152 44 152 72C152 96 140 108 132 112H68C60 108 48 96 48 72C48 44 70 24 100 24Z', frente: 'M58 98C56 64 72 42 100 41C128 42 144 64 142 98C138 86 130 80 122 77C112 75 106 76 100 76C94 76 88 75 78 77C70 80 62 86 58 98Z' },
      f: { atras: 'M100 18C134 18 158 42 158 74C158 104 146 122 134 128H66C54 122 42 104 42 74C42 42 66 18 100 18Z', frente: 'M60 96C58 63 74 42 100 41C126 42 142 63 140 96C134 82 122 75 100 75C78 75 66 82 60 96Z' }
    },
    raspado: { frente: 'M59 100C57 64 76 43 100 42C124 43 143 64 141 100H137.5C136.5 87 133 78 127 73C118 68 108 67 100 67C92 67 82 68 73 73C67 78 63.5 87 62.5 100Z', chapado: true },
    careca: {},
    longo: { fios: 'M70 70C68 90 66 110 66 122M130 70C132 90 134 110 134 122M92 52C84 58 78 66 74 78M108 52C116 58 122 66 126 78', atras: 'M56 96C52 58 74 36 100 36S148 58 144 96L150 176C138 186 122 182 116 170H84C78 182 62 186 50 176Z', frente: 'M100 41C78 41 61 58 59 100L63 122C65 96 71 72 85 60C91 56 96 52 100 47C104 52 109 56 115 60C129 72 135 96 137 122L141 100C139 58 122 41 100 41Z', brilho: 'M66 70C72 56 84 47 96 45' },
    ondulado: { fios: 'M80 74C92 70 104 64 114 58M70 86C80 80 90 76 100 74', atras: 'M56 96C52 58 74 36 100 36S148 58 144 96C150 112 142 122 150 138C156 152 146 164 152 176C138 184 124 176 118 168H82C76 176 62 184 48 176C54 164 44 152 50 138C58 122 50 112 56 96Z', frente: 'M60 103C56 64 74 40 102 40C128 40 146 60 140 103C136 82 128 70 118 64C104 68 86 78 72 80C66 86 62 94 60 103Z', brilho: 'M108 45C120 47 130 53 136 62' },
    franja: { fios: 'M80 62V78M92 60V79M104 60V79M116 61V78', atras: 'M56 96C52 58 74 36 100 36S148 58 144 96L150 176C138 186 122 182 116 170H84C78 182 62 186 50 176Z', frente: 'M60 98C58 61 76 41 100 41S142 61 140 98C138 89 136 81 132 77C120 80 80 80 68 77C64 81 62 89 60 98Z', brilho: 'M74 50C84 44 96 42 108 43' },
    chanel: { fios: 'M84 70C96 64 108 60 120 60M74 82C84 76 94 72 104 70', atras: 'M56 96C52 58 74 38 100 38S148 58 144 96C146 116 144 132 138 140C128 140 122 132 120 124H80C78 132 72 140 62 140C56 132 54 116 56 96Z', frente: 'M60 99C57 62 76 42 102 42C127 42 144 61 140 99C137 84 131 74 121 68C106 66 90 72 76 78C68 84 63 91 60 99Z', brilho: 'M110 47C121 49 130 55 135 63' },
    rabo: { atras: 'M126 60C152 66 160 100 152 134C148 150 138 158 130 154C140 134 142 110 132 86Z', prende: [131, 64], frente: 'M60 97C57 62 76 42 100 42S143 62 140 97C138 82 132 72 124 66C110 62 92 62 80 66C70 72 63 82 60 97Z', brilho: 'M76 52C86 45 98 43 110 44' },
    coque: { atras: 'M100 18A16 16 0 1 1 99.9 18Z', prende: [100, 34], frente: 'M60 97C57 62 76 42 100 42S143 62 140 97C138 82 132 72 124 66C110 62 92 62 80 66C70 72 63 82 60 97Z', brilho: 'M76 52C86 45 98 43 110 44' },
    curtinho: { fios: 'M84 74C92 64 104 56 118 52M100 72C110 64 122 60 134 62', frente: 'M58 101C54 64 72 39 100 38C128 39 146 61 142 93C138 80 130 72 120 68C108 70 92 76 76 77C68 83 62 91 60 101Z', brilho: 'M110 43C121 45 131 52 137 62' }
  };

  /* ───────── Olhos, sobrancelhas, nariz, boca, barba, roupa, acessórios ───────── */
  const OLHO = '#22160f', EY = 97;
  // Cada olho: parte fixa e parte que acompanha o ponteiro (grupo av-pupilas, movido pelo CSS com --px/--py)
  function olhosDe(estilo, fem) {
    const rx = fem ? 5.6 : 5, ry = fem ? 7.2 : 6.3;
    const cilio = (x, alto) => fem ? `<path d="M${x - 6.5} ${alto + 1.5}Q${x} ${alto - 3} ${x + 6.5} ${alto + 1.5}" fill="none" stroke="${OLHO}" stroke-width="2.2" stroke-linecap="round"/><path d="M${x + (x < 100 ? -6.5 : 6.5)} ${alto + 1.5}l${x < 100 ? -3 : 3} -2.6" stroke="${OLHO}" stroke-width="2" stroke-linecap="round"/>` : '';
    const arco = (x, sobe) => `<path d="M${x - 6.5} ${EY + (sobe ? 2 : -1)}Q${x} ${EY + (sobe ? -7 : 5)} ${x + 6.5} ${EY + (sobe ? 2 : -1)}" fill="none" stroke="${OLHO}" stroke-width="3.2" stroke-linecap="round"/>` +
      (fem ? `<path d="M${x + (x < 100 ? -6.5 : 6.5)} ${EY + (sobe ? 2 : -1)}l${x < 100 ? -2.6 : 2.6} -2" stroke="${OLHO}" stroke-width="2" stroke-linecap="round"/>` : '');
    const redondo = x => `<ellipse cx="${x}" cy="${EY}" rx="${rx}" ry="${ry}" fill="${OLHO}"/><circle cx="${x + 1.8}" cy="${EY - 2.6}" r="${fem ? 2.2 : 1.9}" fill="#fff"/><circle cx="${x - 1.7}" cy="${EY + 3}" r="1.05" fill="#fff" opacity=".75"/>`;
    const iris = x => `<circle cx="${x}" cy="${EY + 0.6}" r="${fem ? 5.1 : 4.6}" fill="#5a3a22"/><circle cx="${x}" cy="${EY + 0.6}" r="2.7" fill="#140d09"/><circle cx="${x + 1.9}" cy="${EY - 1.6}" r="1.7" fill="#fff"/><circle cx="${x - 1.6}" cy="${EY + 2.6}" r=".8" fill="#fff" opacity=".7"/>`;
    switch (estilo) {
      case 'grandes': return { fixo: [84, 116].map(x => `<ellipse cx="${x}" cy="${EY}" rx="${fem ? 7.2 : 6.6}" ry="${fem ? 7.6 : 6.6}" fill="#fff"/>`).join(''), move: [84, 116].map(iris).join(''), cima: [84, 116].map(x => cilio(x, EY - 7.6)).join('') };
      case 'felizes': return { fixo: [84, 116].map(x => arco(x, true)).join(''), move: '', cima: '' };
      case 'serenos': return { fixo: [84, 116].map(x => arco(x, false)).join(''), move: '', cima: '' };
      case 'piscando': return { fixo: arco(116, true), move: redondo(84), cima: cilio(84, EY - 7.2) };
      default: return { fixo: '', move: [84, 116].map(redondo).join(''), cima: [84, 116].map(x => cilio(x, EY - 7.2)).join('') };
    }
  }
  function sobrancelhasDe(estilo, cor, fem, triste) {
    const larg = fem ? (estilo === 'grossas' ? 4.4 : 2.8) : (estilo === 'grossas' ? 7 : 5.4);
    const d = triste ? 'M75 87Q84 86 93 80' : { naturais: 'M75 86Q84 81 93 84', grossas: 'M75 86Q84 81 93 84', arqueadas: 'M75 88Q83 77 93 83', retas: 'M75 84.5L93 84' }[estilo] || 'M75 86Q84 81 93 84';
    const um = `<path d="${d}" fill="none" stroke="${cor}" stroke-width="${larg}" stroke-linecap="round"${fem ? '' : ' transform="translate(0 1.5)"'}/>`;
    return um + espelho(um);
  }
  const LABIO_F = ['#d9707f', '#d26777', '#c45c6c', '#a94c5b', '#8e3f4c', '#743443'];
  const LABIO_M = ['#d48a80', '#ca7d72', '#b86d62', '#9c584e', '#80463e', '#64352f'];
  const TRACO_BARBA = '#2b1410';
  function bocaDe(estilo, pele, fem, iPele, barbudo) {
    const escuro = '#5b2420', labio = fem ? LABIO_F[iPele] : LABIO_M[iPele];
    const traco = fem ? tom(labio, -0.35) : barbudo ? TRACO_BARBA : tom(pele, -0.5);
    const contorno = fem || barbudo ? labio : tom(pele, -0.5);
    const esp = fem ? 1.6 : barbudo ? 2.2 : 2.6;
    // mulher e homem de barba: lábios com cor; na barba, um pouco maiores para aparecer bem
    const labios = (d, l) => (fem || barbudo ? `<path d="${d}" fill="${labio}"/>` : '') + l;
    const maior = h => (barbudo ? `<g transform="translate(100 124) scale(1.14) translate(-100 -124)">${h}</g>` : h);
    const linha = (d, larg) => `<path d="${d}" fill="none" stroke="${traco}" stroke-width="${larg || esp}" stroke-linecap="round"/>`;
    return maior(bocaDoEstilo());
    function bocaDoEstilo() {
    switch (estilo) {
      case 'sorrisinho': return labios('M89 121.5Q94.5 119 100 120.6Q105.5 119 111 121.5Q100 131 89 121.5Z', linha('M90 122Q100 128 110 122'));
      case 'riso': return `<path d="M87 119Q100 141 113 119Q100 123 87 119Z" fill="${escuro}" stroke="${contorno}" stroke-width="${fem || barbudo ? 2.4 : 1.4}" stroke-linejoin="round"/><path d="M89 120Q100 124 111 120L110.4 123Q100 127 89.6 123Z" fill="#fff"/><ellipse cx="100" cy="132" rx="5" ry="3.2" fill="#e8727c"/>`;
      case 'lado': return labios('M90 124Q96 121.5 101 123Q106 120 111 119.5Q104 130 90 124Z', linha('M91 124Q102 127 110 120'));
      case 'neutra': return barbudo ? labios('M89 122.5Q100 119 111 122.5Q100 130.5 89 122.5Z', linha('M90.5 123.3H109.5', 1.8)) : labios('M91 123Q100 120.5 109 123Q100 128 91 123Z', linha('M92 124H108'));
      case 'surpresa': return `<ellipse cx="100" cy="125" rx="4.4" ry="5.6" fill="${escuro}" stroke="${fem || barbudo ? labio : 'none'}" stroke-width="2.2"/>`;
      case 'lingua': return labios('M89 121.5Q94.5 119 100 120.6Q105.5 119 111 121.5Q100 131 89 121.5Z', linha('M90 122Q100 128 110 122') + '<path d="M96 125Q100 134 104 125Z" fill="#e8727c"/>');
      case 'triste': return barbudo ? labios('M88.5 128.5Q100 116.5 111.5 128.5Q100 125 88.5 128.5Z', linha('M90 127.6Q100 121 110 127.6', 1.8)) : labios('M90 127Q100 119 110 127Q100 124 90 127Z', linha('M91 127Q100 120 109 127', fem ? 1.8 : 2.6));
      default: return `<path d="M88.5 120Q100 134 111.5 120Q100 124.5 88.5 120Z" fill="#fff" stroke="${contorno}" stroke-width="${fem ? 2.2 : barbudo ? 2.6 : 1.6}" stroke-linejoin="round"/>`;
    }
    }
  }
  // Boca aberta de quando o avatar fala: borda, dentes e língua (aparece sobre qualquer barba)
  function bocaAberta(pele, fem, iPele, barbudo) {
    const borda = fem ? LABIO_F[iPele] : barbudo ? LABIO_M[iPele] : tom(pele, -0.3);
    return '' +
      `<ellipse cx="100" cy="125" rx="7" ry="5.8" fill="#5b2420" stroke="${borda}" stroke-width="${barbudo ? 2.8 : 2.2}"/><path d="M94 120.4Q100 119.4 106 120.4V122.4Q100 123.4 94 122.4Z" fill="#fff"/><ellipse cx="100" cy="128" rx="4.2" ry="2.2" fill="#e8727c"/>`;
  }
  // Bigode sozinho (e no cavanhaque): encorpado. Com barba curta ou cheia: desce pelos cantos da boca e encontra a barba
  const BIGODE = 'M85 121C87 115 94 113.6 100 116.4C106 113.6 113 115 115 121C111 119.2 106 119.4 100 120.4C94 119.4 89 119.2 85 121Z';
  const BIGODE_CHEIO = 'M84 130C82 121 88 114.5 96 114.6C98.2 114.7 99.3 115.3 100 116.2C100.7 115.3 101.8 114.7 104 114.6C112 114.5 118 121 116 130C113.6 125.6 110 121.8 105 121C103 120.7 101.4 120.9 100 121.6C98.6 120.9 97 120.7 95 121C90 121.8 86.4 125.6 84 130Z';
  const BARBAS = {
    nenhuma: () => '',
    rala: c => `<path d="M60 100C61 126 78 145 100 146C122 145 139 126 140 100C134 116 122 124 112 125Q100 120 88 125C78 124 66 116 60 100Z" fill="${c}" opacity=".26"/><path d="${BIGODE}" fill="${c}" opacity=".3"/>`,
    bigode: c => `<path d="${BIGODE}" fill="${c}"/>`,
    cavanhaque: c => `<path d="${BIGODE}" fill="${c}"/><path d="M92 131Q100 136 108 131L105.5 142Q100 146 94.5 142Z" fill="${c}"/>`,
    curta: c => `<path d="M60 98C60 126 78 146 100 147C122 146 140 126 140 98C136 114 126 124 114 126C108 122 104 121 100 121C96 121 92 122 86 126C74 124 64 114 60 98Z" fill="${c}"/><path d="${BIGODE_CHEIO}" fill="${c}"/>`,
    cheia: c => `<path d="M58 95C58 131 76 153 100 154C124 153 142 131 142 95C138 114 127 125 114 127C108 122 104 121 100 121C96 121 92 122 86 127C73 125 62 114 58 95Z" fill="${c}"/><path d="${BIGODE_CHEIO}" fill="${c}"/><path d="M66 120C72 138 86 148 100 150" fill="none" stroke="#fff" stroke-opacity=".14" stroke-width="3" stroke-linecap="round"/>`
  };
  // Roupas: o que fica atrás do pescoço (capuz) e o que fica na frente (gola, botões)
  function roupaDe(estilo, cor, pele, fem, f) {
    const [e, d, y] = f.gola, esc = tom(cor, -0.22), cla = tom(cor, 0.5);
    switch (estilo) {
      case 'golaV': return { atras: '', frente: `<path d="M${e + 2} ${y - 1}L100 ${y + 22}L${d - 2} ${y - 1}Z" fill="${tom(pele, -0.12)}"/><path d="M${e} ${y - 1}L100 ${y + 23}L${d} ${y - 1}" fill="none" stroke="${esc}" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>` };
      case 'camisa': return { atras: '', frente: `<path d="M${e - 1} ${y - 3}L100 ${y + 14}L${e + 7} ${y + 24}L${e - 8} ${y + 6}Z" fill="${cla}"/><path d="M${d + 1} ${y - 3}L100 ${y + 14}L${d - 7} ${y + 24}L${d + 8} ${y + 6}Z" fill="${cla}"/><path d="M100 ${y + 14}V200" stroke="${esc}" stroke-width="1.6" opacity=".6"/><circle cx="100" cy="${y + 26}" r="2" fill="${esc}"/><circle cx="100" cy="${y + 38}" r="2" fill="${esc}"/>` };
      case 'moletom': return {
        atras: `<path d="M64 ${y + 12}C70 ${y - 6} 85 ${y - 10} 100 ${y - 10}S130 ${y - 6} 136 ${y + 12}C126 ${y + 4} 113 ${y + 1} 100 ${y + 1}S74 ${y + 4} 64 ${y + 12}Z" fill="${esc}"/>`,
        frente: `<path d="M93 ${y + 6}V${y + 28}M107 ${y + 6}V${y + 28}" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".9"/><circle cx="93" cy="${y + 29}" r="2.4" fill="#fff" opacity=".9"/><circle cx="107" cy="${y + 29}" r="2.4" fill="#fff" opacity=".9"/>`
      };
      case 'jaqueta': return { atras: '', frente: `<path d="M${e} ${y - 1}L100 ${y + 26}L${d} ${y - 1}Z" fill="#f4f7fa"/><path d="M${e - 14} ${y + 3}L${e + 1} ${y - 3}L100 ${y + 27}L${e + 6} ${y + 42}Z" fill="${tom(cor, 0.18)}"/><path d="M${d + 14} ${y + 3}L${d - 1} ${y - 3}L100 ${y + 27}L${d - 6} ${y + 42}Z" fill="${tom(cor, 0.06)}"/>` };
      default: return { atras: '', frente: fem ? `<path d="M${e - 4} ${y}Q100 ${y + 20} ${d + 4} ${y}" fill="${tom(pele, -0.12)}"/><path d="M${e - 5} ${y}Q100 ${y + 21} ${d + 5} ${y}" fill="none" stroke="${esc}" stroke-width="3.6" stroke-linecap="round"/>`
        : `<path d="M${e - 2} ${y}Q100 ${y + 15} ${d + 2} ${y}" fill="none" stroke="${esc}" stroke-width="5" stroke-linecap="round"/>` };
    }
  }
  const LENTE = '#1f2937';
  function acessorioDe(estilo, cor, f) {
    const [ox, oy] = f.orelha;
    switch (estilo) {
      case 'redondo': return `<g fill="rgba(255,255,255,.16)" stroke="${LENTE}" stroke-width="2.6"><circle cx="84" cy="${EY}" r="11"/><circle cx="116" cy="${EY}" r="11"/></g><path d="M95 ${EY - 1}Q100 ${EY - 4} 105 ${EY - 1}M73 ${EY - 2}L${ox + 2} ${EY - 5}M127 ${EY - 2}L${200 - ox - 2} ${EY - 5}" fill="none" stroke="${LENTE}" stroke-width="2.6" stroke-linecap="round"/>`;
      case 'quadrado': return `<g fill="rgba(255,255,255,.16)" stroke="${LENTE}" stroke-width="2.6"><rect x="72" y="${EY - 9}" width="25" height="18" rx="5"/><rect x="103" y="${EY - 9}" width="25" height="18" rx="5"/></g><path d="M97 ${EY - 2}Q100 ${EY - 4} 103 ${EY - 2}M72 ${EY - 4}L${ox + 2} ${EY - 6}M128 ${EY - 4}L${200 - ox - 2} ${EY - 6}" fill="none" stroke="${LENTE}" stroke-width="2.6" stroke-linecap="round"/>`;
      case 'sol': return `<g fill="#111827" stroke="${LENTE}" stroke-width="2.4"><path d="M71 ${EY - 8}H98V${EY - 1}C98 ${EY + 7} 93 ${EY + 11} 84.5 ${EY + 11}S71 ${EY + 7} 71 ${EY - 1}Z"/><path d="M102 ${EY - 8}H129V${EY - 1}C129 ${EY + 7} 124 ${EY + 11} 115.5 ${EY + 11}S102 ${EY + 7} 102 ${EY - 1}Z"/></g><path d="M98 ${EY - 6}Q100 ${EY - 7.5} 102 ${EY - 6}M71 ${EY - 6}L${ox + 2} ${EY - 8}M129 ${EY - 6}L${200 - ox - 2} ${EY - 8}" fill="none" stroke="${LENTE}" stroke-width="2.4" stroke-linecap="round"/><path d="M75 ${EY - 4}l7 -2.6M106 ${EY - 4}l7 -2.6" stroke="#fff" stroke-width="2" stroke-linecap="round" opacity=".5"/>`;
      case 'bone': return `<path d="M56 86C56 54 76 35 100 35S144 54 144 86C130 78 116 75 100 75S70 78 56 86Z" fill="${cor}"/><path d="M56 86C56 54 76 35 100 35" fill="none" stroke="#fff" stroke-opacity=".2" stroke-width="3" stroke-linecap="round"/><path d="M48 88C80 72 120 72 152 88C158 94 154 100 146 98C120 88 80 88 54 98C46 100 42 94 48 88Z" fill="${tom(cor, -0.28)}"/><circle cx="100" cy="36" r="4" fill="${tom(cor, -0.28)}"/>`;
      case 'fone': return `<path d="M${ox - 2} ${oy - 4}C${ox - 4} 46 ${200 - ox + 4} 46 ${200 - ox + 2} ${oy - 4}" fill="none" stroke="#1f2937" stroke-width="7" stroke-linecap="round"/><rect x="${ox - 9}" y="${oy - 14}" width="16" height="27" rx="8" fill="#1f2937"/><rect x="${200 - ox - 7}" y="${oy - 14}" width="16" height="27" rx="8" fill="#1f2937"/><rect x="${ox - 6}" y="${oy - 9}" width="5" height="17" rx="2.5" fill="#818cf8"/><rect x="${200 - ox + 1}" y="${oy - 9}" width="5" height="17" rx="2.5" fill="#818cf8"/>`;
      case 'brinco': return `<circle cx="${ox}" cy="${oy + 12}" r="3.6" fill="none" stroke="#e8b33c" stroke-width="2.2"/><circle cx="${200 - ox}" cy="${oy + 12}" r="3.6" fill="none" stroke="#e8b33c" stroke-width="2.2"/>`;
      case 'colar': return `<path d="M${f.gola[0] + 1} ${f.gola[2] - 1}Q100 ${f.gola[2] + 16} ${f.gola[1] - 1} ${f.gola[2] - 1}" fill="none" stroke="#e8b33c" stroke-width="1.8"/><circle cx="100" cy="${f.gola[2] + 9}" r="3.4" fill="#e8b33c" stroke="#b98a24" stroke-width="1"/>`;
      default: return '';
    }
  }

  let seq = 0;
  const ZOOM = 1.12, OX = 100, OY = 104;
  const recorte = r => r.split(' ').map(Number).map((v, i) => (i === 0 ? OX + (v - OX) * ZOOM : i === 1 ? OY + (v - OY) * ZOOM : v * ZOOM)).map(v => Math.round(v * 10) / 10).join(' ');
  const BOCAS_FELIZES = ['sorriso', 'sorrisinho', 'riso', 'lingua', 'lado'];
  /* Desenha o avatar.
     opc: { tamanho (px), recorte ('x y w h': só uma parte), titulo, classe,
            humor ('feliz' | 'neutro' | 'triste': muda boca, sobrancelhas e olhos), vivo (pisca, respira, olha o ponteiro) }
     As partes ficam em grupos com classe (av-fundo, av-corpo, av-atras, av-pescoco, av-cabeca, av-rosto, av-olhos, av-pupilas,
     av-boca, av-boca-aberta, av-sobrancelhas, av-frente…) para o CSS animar e para o palco separar em camadas. */
  function svg(avatar, opc) {
    const a = normalizar(avatar), o = opc || {}, id = 'av' + (++seq), humor = o.humor, fem = a.tipo === 'feminino', f = FORMA[a.tipo];
    const pele = PELE[a.pele], cab = CABELO[a.corCabelo], roupa = ROUPA[a.corRoupa], fundo = FUNDO[a.fundo];
    const corSob = tom(cab, a.corCabelo >= 4 && a.corCabelo <= 6 ? -0.4 : -0.08);
    let boca = a.boca, olho = a.olhos;
    if (humor === 'feliz' && !BOCAS_FELIZES.includes(boca)) boca = 'sorriso';
    if (humor === 'neutro') boca = 'neutra';
    if (humor === 'triste') { boca = 'triste'; if (olho === 'felizes' || olho === 'piscando') olho = fem ? 'grandes' : 'redondos'; }
    const t = o.tamanho || 40, vb = o.recorte ? recorte(o.recorte) : '0 0 200 200';
    const estilo = CABELOS[a.cabelo] || {}, var_ = estilo[letra(a.tipo)] || estilo;
    const comBone = a.acessorio === 'bone' && a.cabelo !== 'careca' && a.cabelo !== 'black';
    const ol = olhosDe(olho, fem), r = roupaDe(a.roupa, roupa, pele, fem, f), [ox, oy, orx, ory] = f.orelha;
    const H = `url(#${id}h)`;
    const barbudo = !fem && ['bigode', 'cavanhaque', 'curta', 'cheia'].includes(a.barba);
    // cabelo atrás da cabeça (longos, black, rabo, coque, cachos)
    let atras = '';
    if (Array.isArray(var_.atras)) atras = bolas(var_.atras, H) + brilhoBolas(var_.atras);
    else if (var_.atras && !(comBone && a.cabelo === 'coque')) atras = `<path d="${var_.atras}" fill="${H}"/>` + (var_.prende ? `<circle cx="${var_.prende[0]}" cy="${var_.prende[1]}" r="4.2" fill="${tom(roupa, -0.1)}"/>` : '');
    // cabelo na frente
    let frente = '';
    if (!comBone || a.cabelo === 'black') {
      if (var_.base) frente += `<path d="${var_.base}" fill="${H}"/>` + bolas(var_.cachos, H) + brilhoBolas(var_.cachos);
      if (var_.frente && var_.chapado) frente += `<path d="${var_.frente}" fill="${mistura(cab, pele, a.corCabelo === 10 ? 0.16 : 0.22)}"/><path d="M74 60C82 52 92 49 102 49" fill="none" stroke="#fff" stroke-opacity=".12" stroke-width="3" stroke-linecap="round"/>`;
      else if (var_.frente) frente += `<path d="${var_.frente}" fill="${H}"/>`;
      if (var_.lados) frente += `<path d="${var_.lados}" fill="${H}" opacity=".5"/>`;
      if (var_.risca) frente += `<path d="${var_.risca}" fill="none" stroke="${tom(cab, 0.28)}" stroke-width="2.4" stroke-linecap="round" opacity=".55"/>`;
      if (var_.fios) frente += `<path d="${var_.fios}" fill="none" stroke="${tom(cab, -0.3)}" stroke-width="1.6" stroke-linecap="round" opacity=".55"/>`;
      if (var_.brilho) frente += `<path d="${var_.brilho}" fill="none" stroke="#fff" stroke-opacity=".24" stroke-width="3" stroke-linecap="round"/>`;
      if (a.cabelo === 'careca') frente += `<path d="M80 56C88 51 100 50 110 52" fill="none" stroke="#fff" stroke-width="3.4" stroke-linecap="round" opacity=".35"/>`;
    }
    const temFranja = a.cabelo !== 'careca' && !comBone;
    const detalhes = {
      nenhum: '', bochechas: `<ellipse cx="75" cy="115" rx="7.5" ry="4.6" fill="#f0786f" opacity=".3"/><ellipse cx="125" cy="115" rx="7.5" ry="4.6" fill="#f0786f" opacity=".3"/>`,
      sardas: [[74, 110], [79, 113], [70, 114], [126, 110], [121, 113], [130, 114], [76, 117], [124, 117]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.25" fill="${tom(pele, -0.38)}" opacity=".7"/>`).join(''),
      pinta: `<circle cx="117" cy="121" r="1.8" fill="${tom(pele, -0.55)}"/>`
    }[a.rosto] + (fem && a.rosto !== 'bochechas' ? `<ellipse cx="75" cy="115" rx="7" ry="4.2" fill="#f0786f" opacity=".16"/><ellipse cx="125" cy="115" rx="7" ry="4.2" fill="#f0786f" opacity=".16"/>` : '');
    const brilhos = [[34, 52, 1], [166, 46, 0.8], [158, 150, 0.7]].map(([x, y, k], i) => `<path class="av-brilho" style="animation-delay:${i * 0.5}s" d="M${x} ${y - 9 * k}q${2 * k} ${7 * k} ${9 * k} ${9 * k}q${-7 * k} ${2 * k} ${-9 * k} ${9 * k}q${-2 * k} ${-7 * k} ${-9 * k} ${-9 * k}q${7 * k} ${-2 * k} ${9 * k} ${-9 * k}z" fill="#fff"/>`).join('');
    // cada avatar vivo pisca num momento diferente, para a tela não piscar inteira de uma vez
    const atraso = o.vivo ? ` style="--atraso:${(-((seq * 1.37) % 5)).toFixed(2)}s"` : '';
    return `<svg class="avatar${o.vivo ? ' vivo' : ''}${humor ? ' humor-' + humor : ''} ${o.classe || ''}"${atraso} width="${t}" height="${t}" viewBox="${vb}" role="img" aria-label="${o.titulo ? String(o.titulo).replace(/"/g, '&quot;') : 'Avatar'}">` +
      `<defs><clipPath id="${id}"><circle cx="100" cy="100" r="100"/></clipPath>` +
      `<radialGradient id="${id}f" cx=".5" cy=".38" r=".7"><stop offset="0" stop-color="${tom(fundo, 0.5)}"/><stop offset="1" stop-color="${tom(fundo, -0.06)}"/></radialGradient>` +
      `<radialGradient id="${id}p" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="${tom(pele, 0.2)}"/><stop offset=".6" stop-color="${pele}"/><stop offset="1" stop-color="${tom(pele, -0.12)}"/></radialGradient>` +
      `<linearGradient id="${id}h" gradientUnits="userSpaceOnUse" x1="0" y1="24" x2="0" y2="176"><stop offset="0" stop-color="${tom(cab, 0.2)}"/><stop offset=".55" stop-color="${cab}"/><stop offset="1" stop-color="${tom(cab, -0.22)}"/></linearGradient>` +
      `<linearGradient id="${id}r" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${tom(roupa, 0.12)}"/><stop offset="1" stop-color="${tom(roupa, -0.2)}"/></linearGradient></defs>` +
      `<g clip-path="url(#${id})"><g class="av-fundo"><rect width="200" height="200" fill="url(#${id}f)"/></g>` +
      `<g class="av-brilhos" opacity="0">${brilhos}</g>` +
      `<g class="av-figura"><g transform="translate(${OX} ${OY}) scale(${ZOOM}) translate(${-OX} ${-OY})">` +
      `<g class="av-corpo"><path d="${f.corpo}" fill="url(#${id}r)"/><path d="${f.brilhoCorpo}" fill="none" stroke="#fff" stroke-opacity=".16" stroke-width="3" stroke-linecap="round"/>${r.atras}</g>` +
      `<g class="av-atras">${atras}</g>` +
      `<g class="av-pescoco"><path d="${f.pescoco}" fill="${tom(pele, -0.1)}"/><path d="${f.sombraPescoco}" fill="${tom(pele, -0.3)}" opacity=".45"/>${r.frente}${a.acessorio === 'colar' ? acessorioDe('colar', roupa, f) : ''}</g>` +
      `<g class="av-cabeca">` +
        `<g class="av-rosto"><ellipse cx="${ox}" cy="${oy}" rx="${orx}" ry="${ory}" fill="${tom(pele, -0.04)}"/><ellipse cx="${200 - ox}" cy="${oy}" rx="${orx}" ry="${ory}" fill="${tom(pele, -0.04)}"/>` +
        `<path d="M${ox - 1} ${oy - 5}q-3 5 0 10M${201 - ox} ${oy - 5}q3 5 0 10" fill="none" stroke="${tom(pele, -0.25)}" stroke-width="2" stroke-linecap="round"/>` +
        `<path d="${f.rosto}" fill="url(#${id}p)"/>` + (f.contorno ? `<path d="${f.contorno}" fill="${tom(pele, -0.18)}" opacity=".35"/>` : '') +
        (temFranja ? `<path d="M64 84C86 73 114 73 136 84C116 79 84 79 64 90Z" fill="#000" opacity=".08"/>` : '') +
        detalhes + (fem ? '' : BARBAS[a.barba](tom(cab, -0.05))) +
        `<ellipse cx="100" cy="111" rx="${fem ? 4.8 : 5.8}" ry="${fem ? 3.7 : 4.5}" fill="${tom(pele, -0.13)}"/><ellipse cx="98.5" cy="109.8" rx="${fem ? 1.6 : 1.9}" ry="1.2" fill="#fff" opacity=".45"/>` +
        `<g class="av-boca">${bocaDe(boca, pele, fem, a.pele, barbudo)}</g><g class="av-boca-aberta" opacity="0">${bocaAberta(pele, fem, a.pele, barbudo)}</g>` +
        `<g class="av-olhos">${ol.fixo}<g class="av-pupilas">${ol.move}</g>${ol.cima}</g>` +
        `<g class="av-olhos-felizes" opacity="0">${olhosDe('felizes', fem).fixo}</g>` +
        (humor === 'triste' ? `<g class="av-lagrima"><path d="M118 107c-2.4 4.4-3.6 6.6-3.6 8.2a3.6 3.6 0 0 0 7.2 0c0-1.6-1.2-3.8-3.6-8.2z" fill="#7cc6ff" stroke="#4aa3e0" stroke-width=".8"/></g>` : '') +
        `<g class="av-sobrancelhas">${sobrancelhasDe(a.sobrancelha, corSob, fem, humor === 'triste')}</g></g>` +
        `<g class="av-frente">${frente}${a.acessorio !== 'colar' ? acessorioDe(a.acessorio, roupa, f) : ''}</g>` +
      `</g></g></g></g></svg>`;
  }

  // Sem avatar ainda: círculo com as iniciais
  function iniciais(nome, tamanho) {
    const t = tamanho || 40, p = String(nome || '?').trim().split(/\s+/).filter(Boolean);
    const ini = ((p[0] || '?')[0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
    let h = 0; for (const ch of String(nome || '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const fundo = FUNDO[h % FUNDO.length];
    return `<svg class="avatar" width="${t}" height="${t}" viewBox="0 0 200 200" role="img" aria-label="${String(nome || '').replace(/"/g, '&quot;')}"><circle cx="100" cy="100" r="100" fill="${fundo}"/>` +
      `<text x="100" y="100" dy=".35em" text-anchor="middle" font-family="Plus Jakarta Sans, system-ui, sans-serif" font-weight="800" font-size="78" fill="#1f2937">${ini.replace(/[<&>]/g, '')}</text></svg>`;
  }

  const AVATAR = { PARTES, GRUPOS, PADRAO, PELE, CABELO, ROUPA, FUNDO, normalizar, trocarTipo, aleatorio, opcoesPara, svg, iniciais, tom };
  if (typeof module !== 'undefined' && module.exports) module.exports = AVATAR;
  else global.AVATAR = AVATAR;
})(typeof window !== 'undefined' ? window : globalThis);
