// Teste de ponta a ponta do site via Chrome DevTools Protocol (sem dependências).
const fs = require('fs'), path = require('path');
const [, , porta, url, pasta] = process.argv;
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let alvo;
  for (let i = 0; i < 40 && !alvo; i++) {
    try { alvo = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find(t => t.type === 'page'); } catch (e) { await espera(250); }
  }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let seq = 0; const pend = {}; const erros = [];
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
    if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') erros.push('LOG: ' + m.params.entry.text + ' ' + (m.params.entry.url || ''));
    if (m.method === 'Page.javascriptDialogOpening') cmd('Page.handleJavaScriptDialog', { accept: true });
  };
  const cmd = (method, params) => new Promise(r => { const id = ++seq; pend[id] = r; ws.send(JSON.stringify({ id, method, params: params || {} })); });
  const js = async expr => {
    const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) { erros.push('EVAL: ' + expr.slice(0, 80) + ' -> ' + JSON.stringify(r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text)); return null; }
    return r.result.result.value;
  };
  const foto = async (nome, alturaTotal) => {
    await espera(500);
    const r = await cmd('Page.captureScreenshot', { format: 'png', captureBeyondViewport: !!alturaTotal });
    fs.writeFileSync(path.join(pasta, nome + '.png'), Buffer.from(r.result.data, 'base64'));
  };
  const clicar = sel => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('nao achei ${sel.replace(/'/g, '')}'); e.click(); return true; })()`);
  const digitar = (sel, v) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('nao achei campo ${sel.replace(/'/g, '')}'); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  const texto = sel => js(`(document.querySelector(${JSON.stringify(sel)}) || {}).innerText || ''`);
  const ok = (cond, msg) => console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg);

  await cmd('Runtime.enable'); await cmd('Log.enable'); await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1320, height: 900, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url }); await espera(1200);
  await js('localStorage.clear()'); await cmd('Page.reload'); await espera(1000);

  // 1. Cadastro
  ok((await texto('h1')).includes('Sobre você'), 'abre no cadastro quando não há dados');
  await clicar('[data-acao="passo"][data-valor="1"]');
  ok((await js('document.querySelectorAll(".erro").length')) >= 3, 'valida campos obrigatórios do passo 1');
  await digitar('[data-r="nome"]', 'Gabriel'); await digitar('[data-r="nascimento"]', '1994-05-10');
  await digitar('[data-r="altura"]', '178'); await digitar('[data-r="peso"]', '88,4');
  await clicar('[data-acao="passo"][data-valor="1"]');
  ok((await texto('h1')).includes('Bioimpedância'), 'avança para a bioimpedância');
  ok((await js(`[...document.querySelectorAll('.cadastro .campo > span')].map(s => s.innerText).join(' | ')`)) === 'Gordura corporal | Gordura abdominal (visceral) | Músculo esquelético | Metabolismo em repouso | IMC', 'bioimpedância pede os cinco números da Omron, nessa ordem');
  ok((await js(`document.querySelector('.entrada.calculado').value`)) === '27,9' && (await js(`document.querySelector('.entrada.calculado').readOnly`)), 'IMC aparece calculado (27,9) e não é editável');
  await foto('t0-bioimpedancia');
  await digitar('[data-r="bio.gordura"]', '95'); await clicar('[data-acao="passo"][data-valor="1"]');
  ok((await js('document.querySelectorAll(".erro").length')) === 1, 'recusa percentual de gordura absurdo');
  await digitar('[data-r="bio.gordura"]', '25,6'); await digitar('[data-r="bio.visceral"]', '45'); await digitar('[data-r="bio.musculo"]', '80'); await clicar('[data-acao="passo"][data-valor="1"]');
  ok((await js('document.querySelectorAll(".erro").length')) === 2, 'recusa gordura abdominal acima de 30 e músculo esquelético acima de 60%');
  await digitar('[data-r="bio.visceral"]', '10'); await digitar('[data-r="bio.musculo"]', '35,8'); await digitar('[data-r="bio.tmb"]', '1845');
  await clicar('[data-acao="passo"][data-valor="1"]');
  ok((await texto('h1')).includes('Objetivo'), 'avança para objetivo');
  await foto('t1-objetivo');
  await clicar('[data-campo="dias"][data-valor="4"]'); await clicar('[data-campo="nivel"][data-valor="2"]');
  await clicar('[data-acao="passo"][data-valor="1"]');
  await clicar('[data-campo="restricoes"][data-valor="joelho"]');
  await foto('t2-equip');
  await clicar('[data-acao="passo"][data-valor="1"]'); await espera(400);
  ok((await texto('h1')).includes('Olá, Gabriel'), 'conclui o cadastro e mostra o painel');
  ok((await js('JSON.parse(localStorage.getItem("fichaAcademia.v1")).ficha.dias.length')) === 4, 'ficha de 4 dias gerada e salva');
  ok((await js('JSON.parse(localStorage.getItem("fichaAcademia.v1")).medidas.length')) === 1, 'primeira medição registrada');
  ok((await js('JSON.stringify(JSON.parse(localStorage.getItem("fichaAcademia.v1")).medidas[0])')) === JSON.stringify({ data: await js('hojeISO()'), peso: 88.4, gordura: 25.6, visceral: 10, musculo: 35.8, tmb: 1845 }), 'medição guarda peso, gordura, gordura abdominal, músculo (%) e metabolismo em repouso');
  const tiles = await js(`[...document.querySelectorAll('.tile .rot')].map(s => s.innerText).join(' | ')`);
  ok(tiles === 'Gordura corporal | Gordura abdominal | Músculo esquelético | Metabolismo em repouso | IMC | Massa magra | Gasto diário', 'painel mostra os números na ordem da Omron: ' + tiles);
  ok((await js(`[...document.querySelectorAll('.tile')].map(t => t.innerText.replace(/\\s+/g, ' ')).join(' | ')`)).includes('1.845 kcal informado pela bioimpedância'), 'metabolismo em repouso informado aparece no painel');
  ok(!/Água corporal|Idade metabólica|Massa óssea/.test(await texto('#app')), 'painel não fala mais de água, idade metabólica ou massa óssea');
  await foto('t2b-painel');
  const comJoelho = await js(`JSON.parse(localStorage.getItem("fichaAcademia.v1")).ficha.dias.flatMap(d => d.itens).filter(i => EX_POR_ID[i.ex].evitar.includes('joelho')).map(i => i.ex)`);
  ok(comJoelho && comJoelho.length === 0, 'nenhum exercício de risco para joelho na ficha: ' + JSON.stringify(comJoelho));

  // 2. Ficha e treino
  await clicar('[data-acao="ir-treino"]'); await espera(400);
  ok((await texto('.treinando h2')).includes('em andamento'), 'inicia o treino pelo painel');
  await clicar('.serie'); await espera(400);
  ok((await js('document.querySelectorAll(".serie.feita").length')) === 1, 'marca a primeira série');
  ok((await js('!document.querySelector("#cronometro").hidden')), 'cronômetro de descanso aparece');
  await foto('t3-treino');
  await clicar('[data-acao="crono-pular"]');
  await clicar('[data-acao="concluir-treino"]'); await espera(300);
  ok((await js('JSON.parse(localStorage.getItem("fichaAcademia.v1")).sessoes.length')) === 1, 'treino concluído vai para o histórico');
  await digitar('[data-prop="carga"]', '22,5');
  ok((await js('JSON.parse(localStorage.getItem("fichaAcademia.v1")).ficha.dias[0].itens[0].carga')) === '22,5', 'carga anotada é salva');
  const antes = await js('JSON.parse(localStorage.getItem("fichaAcademia.v1")).ficha.dias[0].itens[0].ex');
  await clicar('[data-acao="trocar"]'); await espera(300); await foto('t4-trocar');
  await clicar('.alt'); await espera(300);
  const depois = await js('JSON.parse(localStorage.getItem("fichaAcademia.v1")).ficha.dias[0].itens[0].ex');
  ok(antes !== depois && EXP(depois), `troca de exercício: ${antes} -> ${depois}`);
  await clicar('.item .nome'); await espera(600); await foto('t5-detalhe');
  ok((await js('getComputedStyle(document.querySelector(".modal .anim .f2")).animationName')) === 'troca', 'animação do exercício ativa no detalhe');
  ok((await js('document.querySelector(".modal .anim .f2").naturalWidth')) > 0, 'segunda foto do exercício carregou');
  await clicar('.modal [data-acao="fechar-modal"]');

  // 3. Biblioteca
  await js('location.hash = "#/exercicios"'); await espera(600);
  const total = await js('document.querySelectorAll(".ex-card").length');
  await clicar('[data-acao="filtro-indicados"]'); await espera(300);
  const todos = await js('document.querySelectorAll(".ex-card").length');
  ok(todos === 157 && total < todos, `biblioteca: ${total} indicados de ${todos} exercícios`);
  await digitar('#busca', 'agachamento'); await espera(300);
  ok((await js('document.querySelectorAll(".ex-card").length')) >= 6, 'busca por "agachamento" encontra resultados');
  await foto('t6-biblioteca');
  await clicar('.ex-card .flag:not(.ativo)'); await espera(300);
  ok((await texto('.modal h2')).includes('Em quais treinos'), 'marcar exercício abre escolha de treino');
  await clicar('.modal [data-acao="flag-dia"]'); await espera(300); await foto('t7-dias');
  ok((await js('document.querySelectorAll(".modal .flag.ativo").length')) === 1, 'exercício marcado no Treino A');
  await clicar('.modal .btn.primario');
  ok((await js('!!document.querySelector("#modal").hidden')), 'janela fecha');
  const quebradas = await js('Promise.all(EXERCICIOS.flatMap(e => [0, 1].map(n => new Promise(r => { const i = new Image(); i.onload = () => r(null); i.onerror = () => r(e.id + "/" + n); i.src = "img/exercicios/" + e.id + "/" + n + ".jpg"; })))).then(x => x.filter(Boolean))');
  ok(quebradas && quebradas.length === 0, 'todas as 314 fotos carregam: ' + JSON.stringify(quebradas));

  // 4. Alimentação e evolução
  await js('location.hash = "#/alimentacao"'); await espera(500);
  ok((await js('document.querySelectorAll(".refeicao").length')) === 4, 'plano com 4 refeições');
  await clicar('[data-campo="refeicoes"][data-valor="6"]'); await espera(300);
  ok((await js('document.querySelectorAll(".refeicao").length')) === 6, 'troca para 6 refeições');
  await clicar('[data-campo="refeicoes"][data-valor="4"]'); await foto('t8-alimentacao', true);
  await js('location.hash = "#/evolucao"'); await espera(500);
  ok((await js(`[...document.querySelectorAll('.grade-campos .campo > span')].map(s => s.innerText).join(' | ')`)) === 'Data | Peso | Gordura corporal | Gordura abdominal | Músculo esquelético | Metabolismo em repouso | Cintura | Quadril | Braço', 'nova medição pede os números da balança e as medidas de fita');
  await digitar('#m-data', '2026-10-01'); await digitar('#m-peso', '91'); await digitar('#m-gordura', '27'); await digitar('#m-visceral', '11'); await digitar('#m-musculo', '35'); await digitar('#m-tmb', '1870'); await digitar('#m-cintura', '96,5'); await digitar('#m-quadril', '104');
  await clicar('[data-acao="salvar-medida"]'); await espera(400);
  ok((await js('document.querySelectorAll(".grafico svg").length')) >= 2, 'gráficos aparecem com duas medições');
  ok((await js('JSON.parse(localStorage.getItem("fichaAcademia.v1")).perfil.peso')) === 88.4, 'medição antiga não sobrescreve o peso atual');
  ok((await js(`[...document.querySelectorAll('.tabela th')].map(s => s.innerText).filter(Boolean).slice(0, 8).join(' | ')`)) === 'Data | Peso (kg) | Gordura (%) | Abdominal (nível) | Músculo (%) | Repouso (kcal) | IMC | Massa magra (kg)', 'histórico tem as colunas novas');
  ok((await js(`[...document.querySelectorAll('.tabela tr')].map(r => r.innerText.replace(/\\s+/g, ' ').trim()).find(l => l.startsWith('01/10/2026'))`)) === '01/10/2026 91,0 27,0 11 35,0 1.870 28,7 66,4 96,5 104,0 –', 'linha do histórico mostra a medição completa, com IMC calculado e medidas de fita');
  ok((await js(`[...document.querySelectorAll('.graficos h2')].map(s => s.innerText).join(' | ')`)) === 'Peso | Gordura corporal | Músculo esquelético | Cintura | Massa magra', 'gráficos de músculo esquelético e de cintura aparecem');
  await foto('t6b-evolucao');
  await foto('t9-evolucao');
  await js('location.hash = "#/perfil"'); await espera(400); await foto('t10-perfil');

  // 5. Celular e tema claro
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await js('location.hash = "#/painel"'); await espera(500); await foto('m1-painel', true);
  ok((await js('document.documentElement.scrollWidth <= window.innerWidth')), 'painel sem rolagem horizontal no celular');
  await js('location.hash = "#/ficha"'); await espera(500); await foto('m2-ficha');
  ok((await js('document.documentElement.scrollWidth <= window.innerWidth')), 'ficha sem rolagem horizontal no celular');
  await js('location.hash = "#/exercicios"'); await espera(500); await foto('m3-exercicios');
  ok((await js('document.documentElement.scrollWidth <= window.innerWidth')), 'biblioteca sem rolagem horizontal no celular');
  await js('location.hash = "#/alimentacao"'); await espera(500);
  ok((await js('document.documentElement.scrollWidth <= window.innerWidth')), 'alimentação sem rolagem horizontal no celular');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1320, height: 900, deviceScaleFactor: 1, mobile: false });
  await cmd('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-color-scheme', value: 'light' }] });
  await js('location.hash = "#/painel"'); await espera(500); await foto('c1-painel-claro', true);
  await js('location.hash = "#/evolucao"'); await espera(500); await foto('c2-evolucao-claro');

  await cmd('Emulation.setDeviceMetricsOverride', { width: 1320, height: 900, deviceScaleFactor: 1, mobile: false });

  // Concluir exercício por exercício
  await js(`location.hash = '#/ficha', true`); await espera(300);
  await clicar('.aba:nth-child(2)'); await espera(200);
  await clicar('[data-acao="iniciar-treino"]'); await espera(300);
  const nEx = await js('document.querySelectorAll(".concluir-ex").length');
  ok(nEx >= 3, 'no treino, cada exercício tem o botão "Concluir exercício" (' + nEx + ')');
  await clicar('.concluir-ex'); await espera(300);
  ok((await js('document.querySelectorAll(".item.feito").length')) === 1 && (await js('[...document.querySelector(".item").querySelectorAll(".serie")].every(s => s.classList.contains("feita"))')), 'concluir exercício marca todas as séries dele');
  ok((await texto('.treinando')).includes('1 de ' + nEx + ' exercícios'), 'cabeçalho conta os exercícios concluídos');
  ok((await js('document.querySelector(".concluir-ex").innerText.trim()')) === 'Concluído', 'botão passa a mostrar "Concluído"');
  await clicar('.concluir-ex'); await espera(300);
  ok((await js('document.querySelectorAll(".item.feito").length')) === 0, 'tocar de novo desfaz a conclusão');
  for (let i = 0; i < nEx; i++) { await clicar('.concluir-ex:not(.feito)'); await espera(150); }
  ok((await js('document.querySelectorAll(".item.feito").length')) === nEx && (await js('!!document.querySelector(".btn.primario.pronto")')), 'com todos concluídos, "Concluir treino" fica em destaque');
  await foto('t7-treino-por-exercicio');
  await clicar('[data-acao="concluir-treino"]'); await espera(400);
  ok((await js('estado.sessoes.length')) === 2 && (await js('estado.sessoes[1].feitas === estado.sessoes[1].total')), 'treino concluído por exercício vai para o histórico com todas as séries');
  ok((await js('document.querySelectorAll(".aba.feita").length')) === 2 && /Feito esta semana/.test(await texto('.abas')), 'abas marcam os treinos já feitos na semana');
  await foto('t7b-ficha');

  // Histórico de cargas
  await js(`location.hash = '#/ficha', true`); await espera(300);
  await clicar('.aba:nth-child(3)'); await espera(200);
  const exCarga = await js('diaAtual().itens.find(i => EX_POR_ID[i.ex].padrao !== "cardio").ex');
  await digitar(`.item input[data-prop="carga"]`, '40'); await espera(100);
  await clicar('[data-acao="iniciar-treino"]'); await espera(300);
  for (let i = 0, n = await js('document.querySelectorAll(".concluir-ex").length'); i < n; i++) { await clicar('.concluir-ex:not(.feito)'); await espera(120); }
  await clicar('[data-acao="concluir-treino"]'); await espera(400);
  ok((await js(`JSON.stringify((s => [s.exs.length === diaAtual().itens.length, s.exs[0].carga, s.exs[0].feitas === s.exs[0].series])(estado.sessoes[estado.sessoes.length - 1]))`)) === '[true,40,true]', 'treino concluído guarda a carga e as séries de cada exercício');
  ok((await js(`JSON.stringify(historicoCarga(${JSON.stringify(exCarga)}).map(x => x.carga))`)) === '[40]' && /Última: 40 kg/.test(await texto('.dica-carga')), 'ficha mostra a última carga usada no exercício');
  ok((await js(`sugestaoCarga(${JSON.stringify(exCarga)}, '40')`)) === null, 'com um treino só, ainda não sugere aumentar');
  await js(`(() => { const u = estado.sessoes[estado.sessoes.length - 1]; estado.sessoes.push(Object.assign(JSON.parse(JSON.stringify(u)), { data: hojeISO() })); render(); return true; })()`); await espera(300);
  ok((await js(`JSON.stringify(sugestaoCarga(${JSON.stringify(exCarga)}, '40'))`)) === '{"de":40,"para":42.5}' && /Tente 42,5 kg/.test(await texto('.dica-carga')), 'duas vezes fechando todas as séries com 40 kg: sugere 42,5 kg');
  ok((await js(`sugestaoCarga(${JSON.stringify(exCarga)}, '45')`)) === null && (await js(`JSON.stringify(sugestaoCarga('x', ''))`)) === 'null', 'não sugere se a pessoa já mudou a carga');
  ok((await js(`(() => { const g = estado.sessoes; estado.sessoes = [{ data: '2026-11-01', exs: [{ id: 'q', carga: 70, series: 3, feitas: 3 }] }, { data: '2026-11-08', exs: [{ id: 'q', carga: 70, series: 3, feitas: 2 }] }, { data: '2026-11-09', exs: [{ id: 'r', carga: 8, series: 3, feitas: 3 }] }, { data: '2026-11-10', exs: [{ id: 'r', carga: 8, series: 3, feitas: 3 }] }];
    const r = JSON.stringify([sugestaoCarga('q', '70'), sugestaoCarga('r', '8')]); estado.sessoes = g; return r; })()`)) === '[null,{"de":8,"para":9}]', 'não sugere se faltou série; passo de aumento acompanha o peso (8 kg → 9 kg)');
  await clicar('.item .abre'); await espera(300);
  ok(/Sua carga neste exercício/.test(await texto('#modal')) && /recorde de 40 kg/.test(await texto('#modal')), 'janela do exercício mostra a evolução da carga e o recorde');
  await foto('t7c-carga-exercicio');
  await js('fecharModal(), true');
  await js(`location.hash = '#/evolucao', true`); await espera(300);
  ok(/Progresso de cargas/.test(await texto('#conteudo')) && (await js('document.querySelectorAll(".tabela.cargas tr").length')) >= 2 && /40 kg/.test(await texto('.tabela.cargas')), 'evolução tem a tabela de progresso de cargas');
  await js(`(() => { estado.sessoes.pop(); estado.sessoes.pop(); salvar(); render(); return true; })()`);

  // Exercícios: aba dentro de Minha ficha e atalho no Perfil
  ok((await js(`[...document.querySelectorAll('.lateral .nav-item')].map(a => a.innerText.trim().replace(/\\s+/g, ' ')).join(' | ')`)) === 'Painel | Minha ficha | Alimentação | Evolução | Perfil', 'menu principal tem 5 itens, sem Exercícios');
  await js(`location.hash = '#/ficha', true`); await espera(300);
  ok((await js(`[...document.querySelectorAll('.subaba')].map(a => a.innerText.trim().replace(/\\s+/g, ' ') + (a.classList.contains('ativo') ? '*' : '')).join(' | ')`)) === 'Meus treinos* | Todos os exercícios 157', 'Minha ficha tem as abas "Meus treinos" e "Todos os exercícios"');
  await clicar('.subaba:not(.ativo)'); await espera(400);
  ok((await js('location.hash')) === '#/exercicios' && (await js('document.querySelectorAll(".ex-card").length')) > 0 && (await js('document.querySelector(".subaba.ativo").innerText.includes("Todos os exercícios")')), 'a aba abre a biblioteca de exercícios');
  ok((await js('document.querySelector(".lateral .nav-item.ativo").innerText.trim().replace(/\\s+/g, " ")')) === 'Minha ficha', 'na biblioteca, o menu continua marcando Minha ficha');
  await foto('t6c-exercicios-aba');
  await js(`location.hash = '#/perfil', true`); await espera(300);
  ok(/O BioFicha tem 157 exercícios/.test(await texto('#conteudo')) && (await js(`!!document.querySelector('#conteudo a[href="#/exercicios"]')`)), 'Perfil tem o atalho "Ver todos os exercícios"');
  await clicar('#conteudo a[href="#/exercicios"]'); await espera(300);
  ok((await js('location.hash')) === '#/exercicios', 'atalho do Perfil abre a biblioteca');

  // Painel: cartões sem buraco e constância
  await js(`location.hash = '#/painel', true`); await espera(300);
  ok(await js(`(() => { const ts = [...document.querySelectorAll('.tiles.equilibrado > .tile')], c = document.querySelector('.tiles.equilibrado').getBoundingClientRect();
    const linhas = {}; ts.forEach(x => { const r = x.getBoundingClientRect(); (linhas[Math.round(r.top)] = linhas[Math.round(r.top)] || []).push(r); });
    return ts.length === 7 && Object.values(linhas).every(l => Math.abs(l[l.length - 1].right - c.right) < 2 && Math.abs(l[0].left - c.left) < 2) && Object.values(linhas).map(l => l.length).join() === '4,3'; })()`), 'os 7 cartões de números ocupam as linhas inteiras (4 + 3), sem buraco');
  ok(/Sua constância/.test(await texto('#conteudo')) && (await js('!!document.querySelector(".anel") && !!document.querySelector(".calendario") && !!document.querySelector(".grafico .barra")')), 'painel mostra a constância: anel da semana, barras por semana e calendário');
  ok((await js('JSON.stringify((f => [f.atual.n, f.meta, f.total, f.dias28, f.sequencia, f.aproveitamento === Math.round(estado.sessoes.reduce((s, x) => s + x.feitas, 0) / estado.sessoes.reduce((s, x) => s + x.total, 0) * 100)])(frequenciaDeTreino()))')) === '[1,4,2,1,0,true]', 'dois treinos no mesmo dia contam como 1 dia treinado de 4; séries concluídas somam os dois treinos');
  ok((await texto('.anel-centro')).replace(/\s+/g, ' ') === '1 de 4' && /Faltam 3 dias/.test(await texto('.semana-texto')), 'anel mostra 1 de 4 e quanto falta para a meta');
  ok((await js('document.querySelectorAll(".calendario .cel").length')) === 84 && (await js('document.querySelectorAll(".calendario .cel.fez").length')) === 1 && (await js('document.querySelectorAll(".calendario .cel.hoje").length')) === 1, 'calendário tem 12 semanas, com hoje marcado como treinado');
  ok(await js(`(() => { const g = estado.sessoes, h = hojeISO(), seg = segundaDe(h), dias = [];
    for (let s = 1; s <= 3; s++) for (const k of [0, 1, 3, 4]) dias.push(dataMenos(seg, s * 7 - k));        // 3 semanas completas com 4 dias cada
    dias.push(dataMenos(seg, 4 * 7), dataMenos(seg, 4 * 7 - 2));                                           // a semana anterior a essas, só 2 dias
    estado.sessoes = dias.map(d => ({ data: d, dia: 'A', feitas: 16, total: 20, minutos: 50 }));
    const f = frequenciaDeTreino(); estado.sessoes = g;
    return JSON.stringify([f.semanas.slice(-5).map(s => s.n), f.media, f.semanasNaMedia, f.sequencia, f.duracaoMedia, f.aproveitamento]); })()`) === '[[2,4,4,4,0],3.5,4,3,50,80]', 'média das 4 semanas completas (3,5 dias), sequência de 3 semanas com a meta batida, duração e aproveitamento médios');
  ok(await js(`(() => { const g = estado.sessoes; estado.sessoes = []; const h = secaoFrequencia(); estado.sessoes = g; return /Conclua o primeiro treino/.test(h); })()`), 'sem treinos, a constância mostra o convite para começar');
  ok(await js('document.documentElement.scrollWidth <= window.innerWidth'), 'painel com constância sem rolagem horizontal no computador');
  await js(`document.querySelector('.constancia').scrollIntoView(), true`); await foto('t8a-constancia');

  // Análise da semana (calculada pelo site)
  await js(`location.hash = '#/painel', true`); await espera(300);
  ok(/Semana/.test(await texto('.tres')) && (await js('document.querySelectorAll(".tres > .card").length')) === 3, 'painel mostra o cartão da semana');
  await foto('t8-painel');
  await js(`location.hash = '#/evolucao', true`); await espera(300);
  const txtAnalise = (await texto('.card.analise')).replace(/\s+/g, ' ');
  ok(/Desde a medição de 01\/10\/2026 \(\d+ dias\): peso caiu 2,6 kg, gordura −1,4 ponto, músculo \+0,8 ponto\./.test(txtAnalise), 'análise compara a medição atual com a anterior: ' + txtAnalise.slice(txtAnalise.indexOf('Desde'), txtAnalise.indexOf('Desde') + 100));
  ok(/Gordura corporal caiu 1,4 ponto com o músculo preservado/.test(txtAnalise) && /2 de 4 treinos concluídos/.test(txtAnalise) && /Meta da semana Concluir os 4 treinos/i.test(txtAnalise), 'análise traz destaque de composição, treinos da semana e uma meta');
  ok(!/\bIA\b/.test(await texto('#app')), 'nenhuma menção a IA na tela');
  await foto('t8b-evolucao');
  ok((await js(`(() => { const g = estado.medidas; estado.medidas = [g[g.length - 1]]; const r = analiseDaSemana(); estado.medidas = g; return /ponto de partida/.test(r.resumo) && r.destaques.some(d => /uma medição só/.test(d.texto)); })()`)), 'com uma medição só, a análise fala em ponto de partida e não inventa evolução');
  ok((await js(`(() => { const g = estado.medidas, h = hojeISO(); estado.medidas = [{ data: dataMenos(h, 7), peso: 91, gordura: 26, musculo: 36 }, { data: h, peso: 88.4, gordura: 25.6, musculo: 34.5 }];
    const r = analiseDaSemana(); estado.medidas = g; return r.destaques.some(d => d.tipo === 'alerta' && /mais de 1% do peso/.test(d.texto)) && r.destaques.some(d => d.tipo === 'atencao' && /músculo esquelético caiu 1,5/.test(d.texto)); })()`)), 'perda rápida demais vira alerta, e queda de músculo vira atenção');
  ok((await js(`(() => { const g = estado.sessoes; estado.sessoes = []; const r = analiseDaSemana(); estado.sessoes = g; return r.destaques.some(d => d.tipo === 'atencao' && /Nenhum treino concluído/.test(d.texto)); })()`)), 'semana sem treino vira atenção');

  // Diário alimentar pela tabela de alimentos
  await js(`location.hash = '#/alimentacao', true`); await espera(300);
  ok(/O que eu comi/.test(await texto('#diario')), 'alimentação tem o diário "O que eu comi"');
  await digitar('#d-busca', 'arroz'); await espera(200);
  ok(/Arroz branco cozido/.test(await texto('#d-resultados')) && (await js('document.activeElement.id')) !== 'nada', 'buscar "arroz" lista o arroz branco');
  ok((await js('buscarAlimentos("aipim").map(a => a.nome).join()')) === 'Mandioca cozida,Mandioca frita' && (await js('buscarAlimentos("feijao preto")[0].nome')) === 'Feijão preto cozido' && (await js('buscarAlimentos("pao de queijo")[0].nome')) === 'Pão de queijo', 'busca ignora acentos e aceita outros nomes (aipim, feijao, pao)');
  await digitar('#d-busca', 'xyzabc'); await espera(150);
  ok(/Não achei na tabela/.test(await texto('#d-resultados')), 'busca sem resultado orienta a digitar as calorias');
  await digitar('#d-busca', 'arroz'); await espera(150);
  await clicar('.resultado'); await espera(200);
  await digitar('#d-qtd', '2'); await espera(150);
  ok(/^115 kcal/.test(await texto('#d-previa')), '2 colheres de servir de arroz (90 g) = 115 kcal, mostrado antes de adicionar');
  await clicar('[data-acao="diario-adicionar"]'); await espera(300);
  await digitar('#d-busca', 'feijao carioca'); await espera(150); await clicar('.resultado'); await espera(200);
  await js(`(() => { const s = document.querySelector('#d-un'); s.value = 'g'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await espera(200);
  await digitar('#d-qtd', '150'); await espera(100);
  ok(/^114 kcal/.test(await texto('#d-previa')), '150 g de feijão = 114 kcal');
  await clicar('[data-acao="diario-adicionar"]'); await espera(300);
  ok((await js('JSON.stringify(estado.diario.map(x => [x.refeicao, x.fonte, x.itens.length, x.kcal]))')) === '[["Almoço","tabela",2,229]]', 'alimentos da mesma refeição ficam juntos e somados (229 kcal)');
  const metaKcal = await js('planoAlimentar(estado.perfil, analise()).kcal');
  ok((await texto('#diario')).replace(/\s+/g, ' ').includes('229 de ' + metaKcal.toLocaleString('pt-BR') + ' kcal'), 'dia mostra as calorias comidas contra a meta');
  await foto('t9-alimentacao');
  await clicar('[data-acao="diario-item-apagar"]'); await espera(300);
  ok((await js('JSON.stringify(estado.diario.map(x => [x.itens.length, x.kcal]))')) === '[[1,114]]', 'tirar um alimento recalcula a refeição');
  await clicar('[data-acao="diario-modo"]'); await espera(200);
  await digitar('#d-nome', 'Prato feito'); await digitar('#d-kcal', '650'); await digitar('#d-p', '35'); await clicar('[data-acao="diario-manual-salvar"]'); await espera(300);
  ok((await js('JSON.stringify(estado.diario.map(x => [x.fonte, x.kcal]))')) === '[["tabela",114],["manual",650]]' && (await js('somaDiario(diarioDoDia(hojeISO())).kcal')) === 764, 'calorias digitadas entram como outra refeição e somam no dia (764 kcal)');
  await clicar('[data-acao="diario-apagar"]'); await espera(300);
  ok((await js('estado.diario.length')) === 1, 'apagar tira a refeição do diário');
  await clicar('[data-acao="diario-modo"]'); await espera(200);
  await clicar('[data-acao="diario-favoritar"]'); await espera(300);
  ok((await js('JSON.stringify(estado.favoritos.map(f => [f.nome, f.kcal, f.itens.length]))')) === '[["Prato feito",650,1]]' && /Favoritas/.test(await texto('#diario')), 'salvar como favorita guarda a refeição e mostra o atalho');
  await js(`(() => { const s = document.querySelector('#d-refeicao'); s.value = 'Jantar'; s.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`); await espera(200);
  await clicar('[data-acao="diario-usar-favorita"]'); await espera(300);
  ok((await js('JSON.stringify(estado.diario.map(x => [x.refeicao, x.kcal]))')) === '[["Almoço",650],["Jantar",650]]', 'tocar na favorita lança a refeição de novo, na refeição escolhida');
  await foto('t9a-favoritas');
  await js(`(() => { estado.diario.forEach(x => { x.data = dataMenos(hojeISO(), 1); }); salvar(); render(); return true; })()`); await espera(300);
  ok(/Repetir o dia anterior/.test(await texto('#diario')), 'dia vazio oferece repetir o dia anterior');
  await clicar('[data-acao="diario-repetir"]'); await espera(300);
  ok((await js('JSON.stringify([diarioDoDia(hojeISO()).length, somaDiario(diarioDoDia(hojeISO())).kcal, estado.diario.length, new Set(estado.diario.map(x => x.id)).size])')) === '[2,1300,4,4]', 'repetir copia as refeições do dia anterior para hoje, sem mexer no original');
  await clicar('[data-acao="diario-remover-favorita"]'); await espera(200);
  ok((await js('estado.favoritos.length')) === 0, 'favorita pode ser removida');
  await js(`(() => { estado.diario = estado.diario.filter(x => x.data === hojeISO()).slice(0, 1); const s = document.querySelector('#d-refeicao'); s.value = 'Almoço'; s.dispatchEvent(new Event('change', { bubbles: true })); salvar(); render(); return true; })()`); await espera(200);
  ok((await js('TABELA_ALIMENTOS.every(a => a.kcal >= 0 && a.gramas > 0 && Math.abs(a.kcal - (a.p * 4 + a.c * 4 + a.g * 9)) <= Math.max(25, a.kcal * 0.18) || /Cerveja|Vinho/.test(a.nome))')), 'tabela de alimentos é coerente: calorias batem com os macros em todos os itens (exceto álcool)');

  // Reestruturação por fórmula
  ok((await js(`(() => { const g = estado.diario, m = estado.medidas; const h = hojeISO();
    estado.diario = Array.from({ length: 12 }, (_, i) => ({ id: 'x' + i, data: dataMenos(h, i), refeicao: 'Almoço', fonte: 'manual', itens: [], kcal: 2000, p: 150, c: 200, g: 60 }));
    estado.medidas = [{ data: dataMenos(h, 20), peso: 90 }, { data: h, peso: 89 }];
    const r = gastoReal(dataMenos(h, 27), h), d = resumoDiario(dataMenos(h, 27), h); estado.diario = g; estado.medidas = m;
    return JSON.stringify([r.kcal, r.diasDeDiario, r.diasEntrePesagens, r.variacaoPesoKg, d.kcalMedia, d.proteinaMedia]); })()`)) === '[2385,12,20,-1,2000,150]', 'gasto real = média comida (2000) + 1 kg perdido em 20 dias (385 kcal/dia) = 2385');
  ok((await js(`gastoReal(dataMenos(hojeISO(), 27), hojeISO())`)) === null, 'com poucos dias de diário, o gasto real não é calculado');
  ok((await js(`JSON.stringify((p => [p.kcal, p.proteina >= 100, p.carbo >= 50, Math.abs(p.kcal - (p.proteina * 4 + p.carbo * 4 + p.gordura * 9)) <= 5])(ajustarProposta({ kcal: 600, proteina: 900, carbo: 0, gordura: 0 }, analise(), planoAlimentar(estado.perfil, analise()))))`)) === JSON.stringify([metaKcal - 300, true, true, true]), 'proposta é contida: no máximo 300 kcal de mudança e contas fechadas');
  const cenario = await js(`(() => { const g = estado.diario, m = estado.medidas, pd = estado.planoDesde, h = hojeISO();
    estado.planoDesde = dataMenos(h, 30);
    estado.diario = Array.from({ length: 14 }, (_, i) => ({ id: 'y' + i, data: dataMenos(h, i), refeicao: 'Almoço', fonte: 'manual', itens: [], kcal: 2400, p: 110, c: 250, g: 80 }));
    estado.medidas = [{ data: dataMenos(h, 28), peso: 88.8, gordura: 25.8, musculo: 35.8 }, { data: h, peso: 88.4, gordura: 25.6, musculo: 35.8 }];
    const x = proporReestruturacao(); estado.diario = g; estado.medidas = m; estado.planoDesde = pd;
    return { real: x.real.kcal, nova: x.nova.kcal, resumo: x.nova.resumo, mudancas: x.nova.mudancas.join(' | ') }; })()`);
  ok(cenario.real === 2510 && cenario.nova === 1780 && cenario.nova >= metaKcal - 300 && /gasto real é de cerca de 2\.510 kcal/.test(cenario.resumo), 'reestruturação usa o gasto real: 2.510 kcal menos o déficit do objetivo = ' + cenario.nova + ' kcal');
  ok(/proteína média foi de 110 g/.test(cenario.mudancas) && /acima da meta/.test(cenario.mudancas), 'proposta aponta o que o diário mostrou (proteína baixa, calorias acima)');
  await clicar('[data-acao="reestruturar"]'); await espera(400);
  ok(/Novo plano proposto/.test(await texto('#modal')) && /duas pesagens com pelo menos 14 dias/.test(await texto('#modal')), 'sem dados suficientes, a proposta explica o que falta e mantém as metas');
  await foto('t9b-proposta');
  await clicar('[data-acao="proposta-descartar"]'); await espera(200);
  await js(`(() => { const a = analise(), pl = planoAlimentar(estado.perfil, a);
    ui.proposta = { atual: { kcal: pl.kcal, proteina: pl.proteina, carbo: pl.carbo, gordura: pl.gordura }, nova: ajustarProposta({ kcal: pl.kcal - 150, proteina: 170, gordura: 60, resumo: 'Proposta de teste.', mudancas: ['Trocar o suco por fruta.'], cuidados: [] }, a, pl), real: null };
    modalProposta(); return true; })()`); await espera(300);
  const novaKcal = await js('ui.proposta.nova.kcal');
  await clicar('[data-acao="proposta-aplicar"]'); await espera(400);
  ok((await js('JSON.stringify([planoAlimentar(estado.perfil, analise()).kcal, planoAlimentar(estado.perfil, analise()).ajustado, estado.planoDesde === hojeISO()])')) === JSON.stringify([novaKcal, true, true]), 'aplicar troca a meta e reinicia a contagem do plano');
  ok((await texto('.heroi')).replace(/\D/g, '') === String(novaKcal) && /reestruturado em/.test(await texto('.cabecalho')), 'tela mostra a meta nova e que o plano foi reestruturado');
  ok(await js('(pl => pl.refeicoes.length === (parseInt(estado.perfil.refeicoes, 10) || 4) && Math.abs(pl.refeicoes.reduce((s, r) => s + r.alvo.kcal, 0) - pl.kcal) < 60)(planoAlimentar(estado.perfil, analise()))'), 'refeições do dia são remontadas somando a meta nova');
  await clicar('[data-acao="plano-automatico"]'); await espera(300);
  ok((await js('JSON.stringify([!!estado.perfil.planoAjuste, planoAlimentar(estado.perfil, analise()).kcal])')) === JSON.stringify([false, metaKcal]), 'voltar ao cálculo automático devolve a meta do cadastro');

  // Privacidade
  await js('modalPrivacidade(), true'); await espera(200);
  ok((await js('document.querySelectorAll("#modal .privacidade h3").length')) === 7 && /não são enviados a serviços de inteligência artificial/.test(await texto('#modal')) && /exclui a conta inteira/.test(await texto('#modal')), 'política de privacidade abre com as 7 seções');
  await js('fecharModal(), true');
  ok((await js('campoConsentimento() === "" && cartaoConsentimento() === "" && cartaoInstalar() === ""')), 'aberto como arquivo: sem consentimento nem instalação (os dados não saem do aparelho)');
  ok(await js(`(() => { const r = resumoUsuario(Object.assign(JSON.parse(JSON.stringify(estado)), { uid: 'u9', sessoes: [{ data: dataMenos(hojeISO(), 9), dia: 'A', feitas: 1, total: 1 }], medidas: [{ data: dataMenos(hojeISO(), 12), peso: 80 }] })); return JSON.stringify(r.alertas) === '["Sem treinar há 9 dias","Sem medir há 12 dias"]'; })()`), 'painel aponta quem está há mais de uma semana sem treinar ou sem medir');
  ok(await js(`(() => { const r = resumoUsuario(Object.assign(JSON.parse(JSON.stringify(estado)), { uid: 'u8', sessoes: [{ data: hojeISO(), dia: 'A', feitas: 1, total: 1 }], medidas: [{ data: dataMenos(hojeISO(), 3), peso: 80 }] })); return r.alertas.length === 0; })()`), 'quem treinou e mediu na semana não recebe alerta');

  // Detalhe de um usuário no painel do administrador (dados simulados, sem a nuvem)
  await js(`(() => { ui.usuarios = [Object.assign(JSON.parse(JSON.stringify(estado)), { uid: 'u1', conta: { email: 'pessoa@exemplo.com' }, atualizadoEm: Date.now() })]; nuvem.usuario = { uid: 'x' }; modalUsuario('u1'); return true; })()`); await espera(300);
  ok(/pessoa@exemplo.com/.test(await texto('#modal')) && /Análise da semana/.test(await texto('#modal')) && /Meta da semana/i.test(await texto('#modal')) && /Medições/.test(await texto('#modal')), 'detalhe do usuário mostra números, medições, treinos e a análise da semana dele');
  ok(await js('JSON.stringify(analiseDaSemana(JSON.parse(JSON.stringify(estado)))) === JSON.stringify(analiseDaSemana())'), 'análise de outro usuário usa os dados dele, não os de quem está olhando');
  await foto('t10-admin-usuario');
  await js(`(() => { fecharModal(); nuvem.usuario = null; ui.usuarios = undefined; return true; })()`);

  // Celular: todas as telas sem rolagem lateral, com foto para revisão
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 2, mobile: true }); await espera(300);
  for (const r of ['painel', 'ficha', 'exercicios', 'alimentacao', 'evolucao', 'perfil']) {
    await js(`location.hash = '#/${r}', true`); await espera(350);
    ok(await js('document.documentElement.scrollWidth <= window.innerWidth'), 'celular: ' + r + ' sem rolagem lateral');
    await foto('cel-' + r);
  }
  await js(`location.hash = '#/painel', true`); await espera(300);
  ok(await js(`(() => { const ts = [...document.querySelectorAll('.tiles.equilibrado > .tile')], c = document.querySelector('.tiles.equilibrado').getBoundingClientRect();
    const linhas = {}; ts.forEach(x => { const r = x.getBoundingClientRect(); (linhas[Math.round(r.top)] = linhas[Math.round(r.top)] || []).push(r); });
    return Object.values(linhas).every(l => Math.abs(l[l.length - 1].right - c.right) < 2) && Object.values(linhas).map(l => l.length).join() === '2,2,2,1'; })()`), 'celular: cartões de números em pares, sem buraco');
  ok(await js(`[...document.querySelectorAll('.lateral .nav-item > span')].every(s => s.scrollWidth <= s.clientWidth + 1)`), 'celular: os 5 rótulos do menu cabem inteiros, sem corte');
  await js(`location.hash = '#/exercicios', true`); await espera(300); await foto('cel-exercicios-aba');
  ok(await js('document.documentElement.scrollWidth <= window.innerWidth'), 'celular: abas de Minha ficha sem rolagem lateral');
  await js(`location.hash = '#/painel', true`); await espera(300);
  await js(`document.querySelector('.constancia').scrollIntoView(), true`); await foto('cel-constancia');
  await js(`document.querySelector('.calendario').scrollIntoView(), true`); await foto('cel-calendario');
  await js(`location.hash = '#/alimentacao', true`); await espera(300);
  await js(`document.querySelector('#diario').scrollIntoView(), true`); await foto('cel-diario');
  await digitar('#d-busca', 'frango'); await espera(200); await foto('cel-diario-busca');
  await digitar('#d-busca', ''); await espera(100);
  await js(`location.hash = '#/evolucao', true`); await espera(300);
  await js(`window.scrollTo(0, 0), true`);
  ok(!(await js('!!document.querySelector(".erro-app")')), 'nenhum erro mostrado na página');
  await js(`(() => { const d = JSON.parse(localStorage.getItem('fichaAcademia.v1')); delete d.modelo;
    d.perfil.peso = 90; d.perfil.bio = { gordura: 24, musculo: 36, agua: 55, visceral: 9, tmb: '', idadeMet: 35, ossea: 3.2 };
    d.medidas = [{ data: '2026-09-01', peso: 92, gordura: 25, musculo: 62, agua: 54, visceral: 9 }, { data: '2026-10-01', peso: 90, gordura: 24, musculo: 36, agua: 55, visceral: 9 }];
    localStorage.setItem('fichaAcademia.v1', JSON.stringify(d)); return true; })()`);
  await cmd('Page.reload'); await espera(1200);
  ok((await js('JSON.stringify([estado.modelo, estado.perfil.bio])')) === JSON.stringify([2, { gordura: 24, musculo: 40, visceral: 9, tmb: '' }]), 'dados antigos: músculo em kg vira % do peso (36 kg de 90 kg = 40%) e os campos retirados somem');
  ok((await js('JSON.stringify(estado.medidas.map(m => [m.musculo, "agua" in m]))')) === JSON.stringify([[null, false], [40, false]]), 'dados antigos: massa muscular total (62 kg de 92 kg) não vira músculo esquelético');
  ok(!(await js('!!document.querySelector(".erro-app")')) && (await texto('h1')).length > 0, 'página abre normalmente com os dados convertidos');
  console.log(erros.length ? 'ERROS DE CONSOLE:\n' + erros.join('\n') : 'Sem erros de console.');
  await cmd('Browser.close');
  process.exit(0);
  function EXP(v) { return typeof v === 'string' && v.length > 0; }
})().catch(e => { console.error('FALHOU', e); process.exit(1); });
