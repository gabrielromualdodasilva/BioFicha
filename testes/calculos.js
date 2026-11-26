// Confere as faixas no padrão Omron e a leitura dos números (sem navegador).
// uso: node teste-omron.js <pasta do site>
const fs = require('fs'), vm = require('vm'), path = require('path');
const P = process.argv[2];
const ctx = { console, module: undefined }; vm.createContext(ctx);
for (const f of ['exercicios', 'musculos', 'calculos', 'treino']) vm.runInContext(fs.readFileSync(path.join(P, 'js', f + '.js'), 'utf8'), ctx, { filename: f });
const run = c => vm.runInContext(c, ctx);
let falhas = 0;
const ok = (cond, msg) => { if (!cond) falhas++; console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); };
const hoje = 'new Date("2026-11-26")';
const an = perfil => { ctx.p = perfil; return run(`analisar(p, ${hoje})`); };
const base = (sexo, nasc, bio, extra) => Object.assign({ sexo, nascimento: nasc, altura: sexo === 'F' ? 165 : 178, peso: sexo === 'F' ? 62 : 80, objetivo: 'auto', nivel: 1, dias: 3, rotina: 'sedentaria', equip: [], restricoes: [], bio }, extra || {});

// Gordura corporal: homem de 32 anos → normal 8–19,9; alta 20–24,9; muito alta 25+
const g = v => an(base('M', '1994-05-10', { gordura: v })).gorduraClasse.rotulo;
ok(g(7.9) === 'Baixa' && g(8) === 'Normal' && g(19.9) === 'Normal' && g(20) === 'Alta' && g(24.9) === 'Alta' && g(25) === 'Muito alta', 'gordura, homem 20–39: 8 / 20 / 25');
const g50 = v => an(base('M', '1975-01-01', { gordura: v })).gorduraClasse.rotulo;
ok(g50(10.9) === 'Baixa' && g50(11) === 'Normal' && g50(22) === 'Alta' && g50(28) === 'Muito alta', 'gordura, homem 40–59: 11 / 22 / 28');
const g65 = v => an(base('M', '1960-01-01', { gordura: v })).gorduraClasse.rotulo;
ok(g65(12.9) === 'Baixa' && g65(13) === 'Normal' && g65(25) === 'Alta' && g65(30) === 'Muito alta', 'gordura, homem 60+: 13 / 25 / 30');
const gf = v => an(base('F', '1995-01-01', { gordura: v })).gorduraClasse.rotulo;
ok(gf(20.9) === 'Baixa' && gf(21) === 'Normal' && gf(32.9) === 'Normal' && gf(33) === 'Alta' && gf(39) === 'Muito alta', 'gordura, mulher 20–39: 21 / 33 / 39');
const gf50 = v => an(base('F', '1975-01-01', { gordura: v })).gorduraClasse.rotulo;
ok(gf50(22.9) === 'Baixa' && gf50(23) === 'Normal' && gf50(34) === 'Alta' && gf50(40) === 'Muito alta', 'gordura, mulher 40–59: 23 / 34 / 40');
const gf65 = v => an(base('F', '1960-01-01', { gordura: v })).gorduraClasse.rotulo;
ok(gf65(23.9) === 'Baixa' && gf65(24) === 'Normal' && gf65(36) === 'Alta' && gf65(42) === 'Muito alta', 'gordura, mulher 60+: 24 / 36 / 42');

// Gordura abdominal (visceral): até 9 normal; 10–14 alta; 15+ muito alta
const v = n => an(base('M', '1994-05-10', { gordura: 18, visceral: n })).visceralClasse.rotulo;
ok(v(1) === 'Normal' && v(9) === 'Normal' && v(10) === 'Alta' && v(14) === 'Alta' && v(15) === 'Muito alta' && v(30) === 'Muito alta', 'gordura abdominal: 9 / 10 / 15');

// Músculo esquelético (%)
const m = (sexo, nasc, pct) => an(base(sexo, nasc, { gordura: 18, musculo: pct })).musculoClasse.rotulo;
ok(m('M', '1994-05-10', 33.2) === 'Baixo' && m('M', '1994-05-10', 33.3) === 'Normal' && m('M', '1994-05-10', 39.4) === 'Alto' && m('M', '1994-05-10', 44.1) === 'Muito alto', 'músculo, homem 18–39: 33,3 / 39,4 / 44,1');
ok(m('M', '1975-01-01', 33.0) === 'Baixo' && m('M', '1975-01-01', 33.1) === 'Normal' && m('M', '1975-01-01', 39.2) === 'Alto' && m('M', '1975-01-01', 43.9) === 'Muito alto', 'músculo, homem 40–59: 33,1 / 39,2 / 43,9');
ok(m('F', '1995-01-01', 24.2) === 'Baixo' && m('F', '1995-01-01', 24.3) === 'Normal' && m('F', '1995-01-01', 30.4) === 'Alto' && m('F', '1995-01-01', 35.4) === 'Muito alto', 'músculo, mulher 18–39: 24,3 / 30,4 / 35,4');
ok(m('F', '1960-01-01', 23.8) === 'Baixo' && m('F', '1960-01-01', 23.9) === 'Normal' && m('F', '1960-01-01', 30.0) === 'Alto' && m('F', '1960-01-01', 35.0) === 'Muito alto', 'músculo, mulher 60+: 23,9 / 30,0 / 35,0');

// Leitura completa de uma medição de exemplo
const a = an(base('M', '1994-05-10', { gordura: 25.6, visceral: 10, musculo: 35.8, tmb: 1845 }, { peso: 88.4 }));
ok(Math.abs(a.imc - 27.9) < 0.05, 'IMC de 88,4 kg e 178 cm = ' + a.imc.toFixed(1));
ok(a.tmb === 1845 && /bioimped/.test(a.tmbFonte), 'metabolismo em repouso informado é o usado nas contas');
ok(Math.abs(a.musculoKg - 31.65) < 0.05, 'músculo esquelético em kg calculado do percentual: ' + a.musculoKg.toFixed(1));
ok(a.objetivoRecomendado === 'emagrecer', 'gordura muito alta recomenda emagrecer');
ok(an(base('M', '1994-05-10', { gordura: 22 })).objetivoRecomendado === 'recomposicao', 'gordura alta recomenda recomposição');
ok(an(base('M', '1994-05-10', { gordura: 15 })).objetivoRecomendado === 'hipertrofia', 'gordura normal recomenda ganhar massa');
ok(an(base('M', '1994-05-10', { gordura: 15, visceral: 11 })).objetivoRecomendado === 'emagrecer', 'gordura abdominal alta recomenda emagrecer mesmo com gordura normal');
ok(an(base('F', '1995-01-01', { gordura: 35 })).objetivoRecomendado === 'recomposicao' && an(base('F', '1995-01-01', { gordura: 40 })).objetivoRecomendado === 'emagrecer', 'mulher: 35% → recomposição, 40% → emagrecer');
const semBio = an(base('M', '1994-05-10', {}));
ok(!semBio.gorduraMedida && semBio.visceral === null && semBio.musculo === null && semBio.tmb > 1000, 'sem bioimpedância: estima gordura e metabolismo, sem inventar os outros números');
const textos = a.pontos.map(x => x.texto).join(' | ');
ok(/Gordura abdominal/.test(textos) && /Músculo esquelético/.test(textos) && !/[Áá]gua corporal|Idade metabólica|óssea/.test(textos), 'leitura fala de gordura abdominal e músculo esquelético, sem água, idade metabólica ou massa óssea');
ok(!/\d\.\d/.test(textos), 'números da leitura com vírgula decimal');
console.log('\n' + a.pontos.map(x => '  [' + x.tipo + '] ' + x.texto).join('\n'));
for (const pf of [a, semBio, an(base('F', '1960-01-01', { gordura: 30, visceral: 6, musculo: 26 }))]) { ctx.p2 = pf; }
ctx.pl = null; ctx.p = base('M', '1994-05-10', { gordura: 25.6, visceral: 10, musculo: 35.8, tmb: 1845 }, { peso: 88.4, refeicoes: 4, dieta: 'tradicional' });
const pl = run(`planoAlimentar(p, analisar(p, ${hoje}))`);
ok(pl.kcal > 1400 && pl.kcal < 2600 && pl.proteina > 100, `plano alimentar continua calculando: ${pl.kcal} kcal, ${pl.proteina} g de proteína`);
console.log(falhas ? `\n${falhas} FALHA(S)` : '\nTUDO OK');
process.exit(falhas ? 1 : 0);
