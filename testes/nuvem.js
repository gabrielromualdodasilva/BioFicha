// Teste de ponta a ponta do acesso por convite (link pessoal), contra o projeto de verdade, com contas descartáveis.
// uso: node cdp-convites.js <porta do navegador> <url> <pasta das fotos> <contas.json>
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const [, , porta, url, pasta, arqContas] = process.argv;
const { ta, tb, tc } = JSON.parse(fs.readFileSync(arqContas, 'utf8'));
const NOVO = `Teste.Novo.${crypto.randomBytes(4).toString('hex')}@Example.com`;      // com maiúsculas de propósito
const novo = NOVO.toLowerCase();
const SENHA_NOVA = crypto.randomBytes(12).toString('base64url');
const senhaAleatoria = () => crypto.randomBytes(12).toString('base64url');
const SENHA_2 = senhaAleatoria(), SENHA_PROF = senhaAleatoria(), SENHA_ALUNO = senhaAleatoria();
const PROF = `teste.prof.${crypto.randomBytes(4).toString('hex')}@example.com`, ALUNO = `teste.aluno.${crypto.randomBytes(4).toString('hex')}@example.com`;
const espera = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  let alvo;
  for (let i = 0; i < 40 && !alvo; i++) {
    try { alvo = (await (await fetch(`http://127.0.0.1:${porta}/json`)).json()).find(t => t.type === 'page'); } catch (e) { await espera(250); }
  }
  const ws = new WebSocket(alvo.webSocketDebuggerUrl);
  await new Promise(r => { ws.onopen = r; });
  let seq = 0; const pend = {}; const erros = []; let falhas = 0;
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if (m.id && pend[m.id]) { pend[m.id](m); delete pend[m.id]; }
    if (m.method === 'Runtime.exceptionThrown') erros.push(m.params.exceptionDetails.exception ? m.params.exceptionDetails.exception.description : m.params.exceptionDetails.text);
    if (m.method === 'Page.javascriptDialogOpening') cmd('Page.handleJavaScriptDialog', { accept: true });
  };
  const cmd = (method, params) => new Promise(r => { const id = ++seq; pend[id] = r; ws.send(JSON.stringify({ id, method, params: params || {} })); });
  const js = async expr => {
    const r = await cmd('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result.exceptionDetails) { const d = JSON.stringify(r.result.exceptionDetails.exception.description || r.result.exceptionDetails.text); if (!/is not defined/.test(d)) erros.push('EVAL: ' + expr.slice(0, 60) + ' -> ' + d.slice(0, 160)); return null; }
    return r.result.result.value;
  };
  const foto = async nome => { await espera(400); const r = await cmd('Page.captureScreenshot', { format: 'png' }); fs.writeFileSync(path.join(pasta, nome + '.png'), Buffer.from(r.result.data, 'base64')); };
  const clicar = sel => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('nao achei ${sel.replace(/'/g, '')}'); e.click(); return true; })()`);
  const digitar = (sel, v) => js(`(() => { const e = document.querySelector(${JSON.stringify(sel)}); if (!e) throw new Error('nao achei campo ${sel.replace(/'/g, '')}'); e.value = ${JSON.stringify(v)}; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  const texto = sel => js(`(document.querySelector(${JSON.stringify(sel)}) || {}).innerText || ''`);
  const ok = (cond, msg) => { if (!cond) falhas++; console.log((cond ? 'OK   ' : 'FALHA') + ' ' + msg); };
  const ate = async (expr, ms) => { for (let t = 0; t < (ms || 15000); t += 250) { if (await js(expr)) return true; await espera(250); } return false; };
  const FASES = `typeof nuvem !== 'undefined' && ['pronto', 'sem-convite', 'confirmar', 'criar-senha'].includes(nuvem.fase)`;
  const entrar = async c => { await js(`fb.auth.signInWithEmailAndPassword(fb.au, ${JSON.stringify(c.email)}, ${JSON.stringify(c.senha)}).then(() => true)`); await ate(FASES); return js('nuvem.fase'); };
  const sair = async () => { await js(`location.hash = '', true`); await js(`fb.auth.signOut(fb.au).then(() => true)`); await ate(`nuvem.fase === 'login'`); };
  const tenta = expr => js(`(${expr}).then(() => 'permitido', e => e.code)`);
  const doc = (col, id) => `fb.fs.doc(fb.db, ${JSON.stringify(col)}, ${JSON.stringify(id)})`;
  const abrirPessoas = async () => { await js(`location.hash = '#/pessoas', true`); await espera(400); await ate(`Array.isArray(ui.convites) && Array.isArray(ui.usuarios)`); };
  const convidar = async (email, nome) => {
    await digitar('#cv-email', email); await digitar('#cv-nome', nome || '');
    await js(`document.querySelector('#form-convite').requestSubmit(), true`);
    return ate(`Array.isArray(ui.convites) && ui.convites.some(p => p.email === ${JSON.stringify(email.toLowerCase())}) && !(ui.convite && ui.convite.ocupado) && ui.conviteNovo === ${JSON.stringify(email.toLowerCase())}`, 25000);
  };
  const pessoa = email => `ui.convites.find(p => p.email === ${JSON.stringify(email)})`;
  const cadastro = async nome => {
    await digitar('[data-r="nome"]', nome); await digitar('[data-r="nascimento"]', '1990-03-02');
    await digitar('[data-r="altura"]', '165'); await digitar('[data-r="peso"]', '62');
    if (await js(`!!document.querySelector('#aceite')`)) await clicar('#aceite');
    for (let i = 0; i < 4; i++) await clicar('[data-acao="passo"][data-valor="1"]');
    await espera(400);
    return (await texto('h1')).includes('Olá, ' + nome.split(' ')[0]) && await ate('!nuvem.timer && !nuvem.pendente');
  };

  await cmd('Runtime.enable'); await cmd('Page.enable');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1320, height: 900, deviceScaleFactor: 1, mobile: false });
  await cmd('Page.navigate', { url });
  ok(await ate(`!!document.querySelector('#form-conta')`), 'tela de login aparece');
  ok(!/Criar conta/.test(await texto('#app')), 'não existe a opção "Criar conta"');

  // 1. Quem não foi convidado não entra
  await digitar('#c-email', tb.email); await js(`document.querySelector('#c-senha').value = ${JSON.stringify(tb.senha)}, true`);
  await js(`document.querySelector('#form-conta').requestSubmit(), true`); await ate(FASES);
  ok((await js('nuvem.fase')) === 'sem-convite' && (await texto('h1')) === 'Acesso por convite', 'conta sem convite vê "Acesso por convite"');
  ok((await tenta(`fb.fs.getDocFromServer(${doc('usuarios', tb.uid)})`)) === 'permission-denied', 'sem convite: não lê os próprios dados');
  ok((await tenta(`fb.fs.setDoc(${doc('usuarios', tb.uid)}, { x: 1 })`)) === 'permission-denied', 'sem convite: não grava dados');
  ok((await tenta(`fb.fs.setDoc(${doc('convites', tb.email)}, { email: ${JSON.stringify(tb.email)}, uid: ${JSON.stringify(tb.uid)} })`)) === 'permission-denied', 'sem convite: não consegue se convidar sozinho');
  ok((await tenta(`fb.fs.getDocs(fb.fs.collection(fb.db, 'convites'))`)) === 'permission-denied', 'sem convite: não lê a lista de convidados');
  await sair();

  // 2. Administrador cria os convites
  ok((await entrar(ta)) === 'pronto', 'administrador entra sem precisar de convite');
  await abrirPessoas();
  const usuariosAntes = await js('ui.usuarios.length');
  ok((await texto('h1')) === 'Administração' && /Ninguém foi convidado/.test(await texto('#app')), 'painel do administrador abre (usuários que já existiam: ' + usuariosAntes + ')');
  await digitar('#cv-email', 'sem-arroba'); await js(`document.querySelector('#form-convite').requestSubmit(), true`); await espera(200);
  ok(/Confira o e-mail/.test(await texto('.aviso.erro')), 'convite recusa e-mail inválido');
  ok(await convidar(NOVO, 'Pessoa Nova'), 'convite para e-mail que não tinha conta');
  ok((await js('fb.au.currentUser.uid')) === ta.uid, 'administrador continua conectado depois de criar a conta do convidado');
  ok(await js(`(p => !!p && !!p.uid && !!p.chave && p.chave.length >= 30)(${pessoa(novo)})`), 'convite novo tem link pessoal (e-mail em minúsculas, senha provisória longa)');
  ok(await js(`!!document.querySelector('#convite-novo') && document.querySelector('#msg-convite').value.includes('#convite=')`), 'aparece a mensagem pronta com o link');
  await foto('convite-pronto');
  const link = await js(`linkConvite(${pessoa(novo)})`);
  ok(await convidar(tb.email, 'Pessoa B'), 'convite para conta que já existia');
  ok(await js(`(p => !!p && !p.chave && !p.uid)(${pessoa(tb.email)})`), 'conta que já existia não ganha link nem senha provisória');
  ok(await convidar(tc.email, ''), 'convite para conta sem e-mail confirmado');
  ok((await js('document.querySelectorAll(".convidados tr").length')) === 3, 'lista mostra os 3 convidados');
  ok((await js(`document.querySelectorAll('[data-acao="copiar-convite"]').length`)) >= 1 && /Falta abrir o link/.test(await texto('.convidados')), 'convite pendente mostra "Falta abrir o link" e "Copiar convite"');
  ok((await tenta(`fb.fs.setDoc(${doc('usuarios', tb.uid)}, { x: 1 })`)) === 'permission-denied', 'administrador não grava nos dados de outra pessoa');
  ok(await js('document.documentElement.scrollWidth <= window.innerWidth'), 'Pessoas sem rolagem horizontal no computador');
  await foto('convite-pessoas');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 2, mobile: true }); await espera(300);
  ok(await js('document.documentElement.scrollWidth <= window.innerWidth'), 'Pessoas sem rolagem horizontal no celular');
  await foto('convite-pessoas-celular');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1320, height: 900, deviceScaleFactor: 1, mobile: false });
  await sair();

  // 3. Pessoa nova abre o link do convite e cria a senha
  await cmd('Page.navigate', { url: 'about:blank' }); await espera(300);
  await cmd('Page.navigate', { url: link });
  ok(await ate(`${FASES} && nuvem.fase === 'criar-senha'`, 20000), 'link do convite entra direto na tela "Crie sua senha"');
  ok((await texto('h1')) === 'Crie sua senha' && (await texto('#app')).includes(novo), 'tela mostra o e-mail convidado');
  ok(!(await js('location.href')).includes('convite='), 'o link sai da barra de endereço depois de lido');
  await foto('convite-criar-senha');
  await js(`document.querySelector('#n-senha').value = '123', true`); await js(`document.querySelector('#form-senha').requestSubmit(), true`); await espera(200);
  ok(/pelo menos 6/.test(await texto('.aviso.erro')), 'recusa senha curta');
  await js(`document.querySelector('#n-senha').value = ${JSON.stringify(SENHA_NOVA)}, true`); await js(`document.querySelector('#form-senha').requestSubmit(), true`);
  ok(await ate(`nuvem.fase === 'pronto'`), 'senha criada e pessoa entra');
  ok((await texto('h1')).includes('Sobre você'), 'pessoa nova cai no cadastro');
  await digitar('[data-r="nome"]', 'Pessoa Nova'); await digitar('[data-r="nascimento"]', '1990-03-02'); await digitar('[data-r="altura"]', '165'); await digitar('[data-r="peso"]', '62');
  await clicar('[data-acao="passo"][data-valor="1"]'); await espera(300);
  ok((await texto('h1')).includes('Sobre você') && /Marque a caixa para continuar/.test(await texto('#app')), 'cadastro não avança sem aceitar a política de privacidade');
  ok(await cadastro('Pessoa Nova'), 'pessoa nova conclui o cadastro e os dados sobem');
  ok(await ate(`fb.fs.getDocFromServer(${doc('convites', novo)}).then(s => typeof s.data().entrouEm === 'number' && !('chave' in s.data()))`, 10000), 'convite marca a entrada e apaga a senha provisória');
  ok((await tenta(`fb.fs.updateDoc(${doc('convites', novo)}, { nome: 'Outro' })`)) === 'permission-denied', 'convidado não altera o próprio convite');
  ok((await tenta(`fb.fs.updateDoc(${doc('convites', novo)}, { chave: 'x' })`)) === 'permission-denied', 'convidado não recria a senha provisória');
  ok((await tenta(`fb.fs.getDocs(fb.fs.collection(fb.db, 'convites'))`)) === 'permission-denied', 'convidado não lê a lista de convidados');
  ok((await tenta(`fb.fs.setDoc(${doc('convites', 'intruso@example.com')}, { email: 'intruso@example.com' })`)) === 'permission-denied', 'convidado não convida outras pessoas');
  ok((await tenta(`fb.fs.getDocFromServer(${doc('usuarios', ta.uid)})`)) === 'permission-denied', 'convidado não lê os dados do administrador');
  await js(`location.hash = '#/pessoas', true`); await espera(300);
  ok((await texto('h1')) !== 'Administração', 'convidado não abre o painel do administrador');
  ok((await tenta(`fb.fs.getDocs(fb.fs.collection(fb.db, 'usuarios'))`)) === 'permission-denied', 'convidado não lista os dados dos outros usuários');
  ok(/Quem convidou você e o administrador do BioFicha acompanham/.test(await (async () => { await js(`location.hash = '#/perfil', true`); await espera(300); return texto('#conteudo'); })()), 'Perfil do convidado avisa que o administrador acompanha o progresso');
  await sair();

  // 4. O link só vale uma vez; depois a pessoa entra com a senha dela
  await cmd('Page.navigate', { url: 'about:blank' }); await espera(300);
  await cmd('Page.navigate', { url: link });
  ok(await ate(`typeof nuvem !== 'undefined' && nuvem.fase === 'login' && /já foi usado/.test(nuvem.erro || '')`, 20000), 'link usado de novo não entra e explica o motivo');
  await foto('convite-link-usado');
  ok((await entrar({ email: novo, senha: SENHA_NOVA })) === 'pronto' && await js('estado.perfil.nome === "Pessoa Nova"'), 'pessoa entra com a senha que criou e vê os dados dela');
  await sair();

  // 5. Contas que já existiam: com e-mail confirmado entra; sem confirmar, não
  ok((await entrar(tb)) === 'pronto', 'conta que já existia, com e-mail confirmado, entra depois do convite');
  ok(await cadastro('Pessoa B'), 'ela conclui o cadastro');
  await sair();
  ok((await entrar(tc)) === 'confirmar' && (await texto('h1')) === 'Confirme seu e-mail', 'conta que já existia, sem e-mail confirmado, precisa confirmar');
  ok((await tenta(`fb.fs.getDocFromServer(${doc('usuarios', tc.uid)})`)) === 'permission-denied', 'sem confirmar o e-mail: não lê dados mesmo com convite');
  await sair();

  // 6. Administrador vê quem entrou, remove e devolve o acesso
  await entrar(ta); await abrirPessoas();
  ok((await js(`(document.querySelector('.convidados').innerText.match(/Entrou em/g) || []).length`)) === 2, 'lista mostra as duas pessoas que já entraram');
  await ate(`Array.isArray(ui.usuarios)`);
  ok((await js('ui.usuarios.length')) === usuariosAntes + 2 && (await js('document.querySelectorAll(".usuarios tr").length')) === usuariosAntes + 3, 'painel lista os 2 usuários novos que fizeram cadastro');
  ok(/Pessoa Nova/.test(await texto('.usuarios')) && /Pessoa B/.test(await texto('.usuarios')) && /hoje/.test(await texto('.usuarios')) && /62,0 kg/.test(await texto('.usuarios')), 'painel mostra nome, último uso e última medição de cada um');
  ok(await js('document.documentElement.scrollWidth <= window.innerWidth'), 'painel do administrador sem rolagem horizontal no computador');
  await foto('admin-painel');
  await clicar('[data-acao="ver-usuario"]'); await espera(400);
  ok(/Medições/.test(await texto('#modal')) && /Treinos concluídos/.test(await texto('#modal')) && /165 cm/.test(await texto('#modal')), 'detalhe do usuário mostra números, medições e treinos');
  await foto('admin-usuario');
  await clicar('[data-acao="fechar-modal"][data-forcar]'); await espera(200);
  await cmd('Emulation.setDeviceMetricsOverride', { width: 390, height: 780, deviceScaleFactor: 2, mobile: true }); await espera(300);
  ok(await js('document.documentElement.scrollWidth <= window.innerWidth'), 'painel do administrador sem rolagem horizontal no celular');
  await foto('admin-painel-celular');
  await cmd('Emulation.setDeviceMetricsOverride', { width: 1320, height: 900, deviceScaleFactor: 1, mobile: false });
  ok(!(await js(`!!document.querySelector('[data-acao="copiar-convite"][data-valor=${JSON.stringify(novo)}]')`)), 'depois que a pessoa cria a senha, "Copiar convite" some');
  await clicar(`[data-acao="remover-convite"][data-valor=${JSON.stringify(novo)}]`);
  ok(await ate(`Array.isArray(ui.convites) && (p => p && p.removido === true)(${pessoa(novo)})`), 'remover marca o acesso como removido');
  ok(/Acesso removido/.test(await texto('.convidados')), 'lista mostra "Acesso removido"');
  await sair();
  ok((await entrar({ email: novo, senha: SENHA_NOVA })) === 'sem-convite', 'pessoa removida não entra mais');
  ok(await js('estado.perfil === null'), 'pessoa removida não vê os dados que tinha gravado');
  ok((await tenta(`fb.fs.getDocFromServer(${doc('usuarios', await js('fb.au.currentUser.uid'))})`)) === 'permission-denied', 'pessoa removida não lê os próprios dados no servidor');
  ok((await tenta(`fb.fs.updateDoc(${doc('convites', novo)}, { removido: false })`)) === 'permission-denied', 'pessoa removida não devolve o próprio acesso');
  await sair();
  await entrar(ta); await abrirPessoas();
  await clicar(`[data-acao="devolver-acesso"][data-valor=${JSON.stringify(novo)}]`);
  ok(await ate(`Array.isArray(ui.convites) && (p => p && p.removido === false)(${pessoa(novo)})`), 'devolver acesso funciona');
  await sair();
  ok((await entrar({ email: novo, senha: SENHA_NOVA })) === 'pronto' && await js('estado.perfil.nome === "Pessoa Nova"'), 'com o acesso devolvido, os dados voltam');

  const uidNovo = await js('fb.au.currentUser.uid');
  ok(await js('!!estado.perfil.consentimento && estado.perfil.consentimento.versao === 1'), 'aceite da política fica registrado no cadastro');
  const abrirLink = async (lnk, senha) => {
    await cmd('Page.navigate', { url: 'about:blank' }); await espera(300); await cmd('Page.navigate', { url: lnk });
    if (!(await ate(`${FASES} && nuvem.fase === 'criar-senha'`, 20000))) return false;
    await js(`document.querySelector('#n-senha').value = ${JSON.stringify(senha)}, true`); await js(`document.querySelector('#form-senha').requestSubmit(), true`);
    return ate(`nuvem.fase === 'pronto'`);
  };
  const enviarForm = (id, campos) => js(`(() => { ${Object.entries(campos).map(([k, v]) => `document.querySelector('${k}').value = ${JSON.stringify(v)};`).join(' ')} document.querySelector('${id}').requestSubmit(); return true; })()`);

  // 6b. Trocar a senha dentro do site
  await js(`location.hash = '#/perfil', true`); await espera(300);
  await clicar('[data-acao="trocar-senha"]'); await espera(200);
  await enviarForm('#form-trocar-senha', { '#s-atual': 'senha-errada-1', '#s-nova': SENHA_2 });
  ok(await ate(`/senha atual não confere/.test((document.querySelector('#modal .aviso.erro') || {}).innerText || '')`), 'trocar senha recusa a senha atual errada');
  await enviarForm('#form-trocar-senha', { '#s-atual': SENHA_NOVA, '#s-nova': SENHA_2 });
  ok(await ate(`document.querySelector('#modal').hidden`), 'senha trocada com a senha atual certa');
  await sair();
  ok((await tenta(`fb.auth.signInWithEmailAndPassword(fb.au, ${JSON.stringify(novo)}, ${JSON.stringify(SENHA_NOVA)})`)) === 'auth/invalid-credential', 'a senha antiga deixa de valer');
  ok((await entrar({ email: novo, senha: SENHA_2 })) === 'pronto', 'entra com a senha nova');
  await sair();

  // 6c. Profissional: convidado pelo administrador, convida e acompanha só os próprios alunos
  await entrar(ta); await abrirPessoas();
  await js(`(() => { const c = document.querySelector('#cv-prof'); c.checked = true; c.dispatchEvent(new Event('change', { bubbles: true })); return true; })()`);
  ok(await convidar(PROF, 'Profissional Teste'), 'administrador convida um profissional');
  ok(await js(`(p => p.papel === 'profissional' && p.de === ${JSON.stringify(ta.uid)})(${pessoa(PROF)})`) && /Profissional/.test(await texto('.convidados')), 'convite fica marcado como profissional');
  const linkProf = await js(`linkConvite(${pessoa(PROF)})`);
  await sair();
  ok(await abrirLink(linkProf, SENHA_PROF), 'profissional abre o link e cria a senha');
  ok(await cadastro('Profissional Teste'), 'profissional faz o próprio cadastro');
  const uidProf = await js('fb.au.currentUser.uid');
  ok(await js('ehProfissional() && !ehAdmin()'), 'site reconhece o papel de profissional');
  await js(`location.hash = '#/perfil', true`); await espera(300);
  ok(/Abrir meus alunos/.test(await texto('#conteudo')), 'Perfil do profissional tem o atalho "Meus alunos"');
  await abrirPessoas();
  ok((await texto('h1')) === 'Meus alunos' && !(await js(`!!document.querySelector('#cv-prof')`)) && /Ninguém foi convidado/.test(await texto('#app')), 'profissional vê a tela "Meus alunos", vazia e sem a opção de criar profissional');
  ok((await tenta(`fb.fs.getDocs(fb.fs.collection(fb.db, 'convites'))`)) === 'permission-denied', 'profissional não lista os convites dos outros');
  ok((await tenta(`fb.fs.getDocFromServer(${doc('convites', tb.email)})`)) === 'permission-denied', 'profissional não lê convite criado pelo administrador');
  ok((await tenta(`fb.fs.setDoc(${doc('convites', 'outro.prof@example.com')}, { email: 'outro.prof@example.com', de: ${JSON.stringify(uidProf)}, papel: 'profissional' })`)) === 'permission-denied', 'profissional não cria outro profissional');
  ok((await tenta(`fb.fs.setDoc(${doc('convites', tb.email)}, { email: ${JSON.stringify(tb.email)}, de: ${JSON.stringify(uidProf)}, papel: 'aluno' }, { merge: true })`)) === 'permission-denied', 'profissional não toma o convite de outra pessoa');
  ok((await tenta(`fb.fs.getDocFromServer(${doc('usuarios', uidNovo)})`)) === 'permission-denied', 'profissional não lê os dados de quem ele não convidou');
  ok(await convidar(ALUNO, 'Aluno Dois'), 'profissional convida um aluno');
  ok(await js(`(p => p.papel === 'aluno' && p.de === ${JSON.stringify(uidProf)} && !!p.chave)(${pessoa(ALUNO)})`), 'convite do aluno fica ligado ao profissional');
  const linkAluno = await js(`linkConvite(${pessoa(ALUNO)})`);
  await sair();
  ok(await abrirLink(linkAluno, SENHA_ALUNO), 'aluno abre o link e cria a senha');
  ok(await cadastro('Aluno Dois'), 'aluno faz o cadastro');
  const uidAluno = await js('fb.au.currentUser.uid');
  ok((await js(`fb.fs.getDocFromServer(${doc('usuarios', uidAluno)}).then(s => s.data().responsavel)`)) === uidProf, 'os dados do aluno ficam ligados ao profissional que o convidou');
  ok((await tenta(`fb.fs.getDocFromServer(${doc('anotacoes', uidAluno)})`)) === 'permission-denied', 'aluno não lê as anotações feitas sobre ele');
  ok((await tenta(`fb.fs.getDocFromServer(${doc('usuarios', uidProf)})`)) === 'permission-denied', 'aluno não lê os dados do profissional');
  await js(`location.hash = '#/pessoas', true`); await espera(300);
  ok((await texto('h1')) !== 'Meus alunos' && (await texto('h1')) !== 'Administração', 'aluno não abre a tela de gestão');
  await sair();
  await entrar({ email: PROF, senha: SENHA_PROF }); await abrirPessoas();
  ok((await js('ui.usuarios.length')) === 1 && /Aluno Dois/.test(await texto('.usuarios')) && !/Pessoa Nova/.test(await texto('.usuarios')), 'profissional vê só o aluno dele no painel');
  await foto('prof-meus-alunos');
  await clicar('[data-acao="ver-usuario"]'); await espera(400);
  ok(await ate(`(t => !!t && !t.disabled)(document.querySelector('#nota-usuario'))`), 'detalhe do aluno abre com o campo de anotações');
  await js(`document.querySelector('#nota-usuario').value = 'Combinado: 4 treinos por semana.', true`); await clicar('[data-acao="salvar-nota"]');
  ok(await ate(`fb.fs.getDocFromServer(${doc('anotacoes', uidAluno)}).then(s => s.exists() && s.data().texto === 'Combinado: 4 treinos por semana.' && s.data().por === ${JSON.stringify(uidProf)})`, 10000), 'anotação do profissional é gravada');
  await foto('prof-aluno-detalhe');
  await clicar('[data-acao="fechar-modal"][data-forcar]'); await espera(200);
  ok((await tenta(`fb.fs.setDoc(${doc('anotacoes', uidNovo)}, { texto: 'x' })`)) === 'permission-denied', 'profissional não anota sobre quem não é aluno dele');
  ok((await tenta(`fb.fs.setDoc(${doc('usuarios', uidAluno)}, { x: 1 })`)) === 'permission-denied', 'profissional não altera os dados do aluno');
  await sair();
  await entrar(ta); await abrirPessoas();
  ok((await js(`fb.fs.getDocFromServer(${doc('anotacoes', uidAluno)}).then(s => s.data().texto)`)) === 'Combinado: 4 treinos por semana.', 'administrador lê a anotação feita pelo profissional');
  ok((await js(`ui.usuarios.filter(u => [${JSON.stringify(uidNovo)}, ${JSON.stringify(tb.uid)}, ${JSON.stringify(uidProf)}, ${JSON.stringify(uidAluno)}].includes(u.uid)).length`)) === 4, 'administrador vê todos: alunos dele, o profissional e o aluno do profissional');
  await sair();

  // 6d. Excluir a própria conta
  await entrar({ email: ALUNO, senha: SENHA_ALUNO });
  await js(`location.hash = '#/perfil', true`); await espera(300);
  await clicar('[data-acao="excluir-conta"]'); await espera(200);
  await enviarForm('#form-excluir-conta', { '#x-senha': 'senha-errada-2' });
  ok(await ate(`/senha atual não confere/.test((document.querySelector('#modal .aviso.erro') || {}).innerText || '')`), 'excluir conta recusa a senha errada');
  await js('window.__antesDeExcluir = true');
  await enviarForm('#form-excluir-conta', { '#x-senha': SENHA_ALUNO });
  ok(await ate(`typeof nuvem !== 'undefined' && !window.__antesDeExcluir && nuvem.fase === 'login'`, 25000), 'conta excluída: o site volta para a tela de entrada');
  ok((await tenta(`fb.auth.signInWithEmailAndPassword(fb.au, ${JSON.stringify(ALUNO)}, ${JSON.stringify(SENHA_ALUNO)})`)) === 'auth/invalid-credential', 'a conta excluída não entra mais');
  await entrar(ta);
  ok((await js(`fb.fs.getDocFromServer(${doc('usuarios', uidAluno)}).then(s => s.exists())`)) === false, 'os dados do aluno foram apagados junto com a conta');
  await tenta(`fb.fs.deleteDoc(${doc('anotacoes', uidAluno)})`); await tenta(`fb.fs.deleteDoc(${doc('convites', ALUNO)})`);
  await sair();
  await entrar({ email: PROF, senha: SENHA_PROF });
  ok((await tenta(`fb.fs.deleteDoc(${doc('usuarios', uidProf)})`)) === 'permitido', 'limpeza: dados do profissional apagados por ele mesmo');
  await sair();
  await entrar(ta); await tenta(`fb.fs.deleteDoc(${doc('convites', PROF)})`); await sair();
  await entrar({ email: PROF, senha: SENHA_PROF });
  ok((await js('ehProfissional()')) === false && ['sem-convite', 'confirmar'].includes(await js('nuvem.fase')) && (await tenta(`fb.fs.getDocs(fb.fs.query(fb.fs.collection(fb.db, 'convites'), fb.fs.where('de', '==', fb.au.currentUser.uid)))`)) === 'permission-denied', 'profissional com o convite apagado perde o acesso');
  ok((await tenta(`fb.auth.deleteUser(fb.au.currentUser)`)) === 'permitido', 'limpeza: conta do profissional apagada'); await ate(`nuvem.fase === 'login'`);

  // 7. Limpeza: cada conta de teste apaga os próprios dados e a si mesma; o administrador de teste apaga os convites
  await entrar({ email: novo, senha: SENHA_2 });
  ok((await tenta(`fb.fs.deleteDoc(${doc('usuarios', uidNovo)})`)) === 'permitido', 'limpeza: dados da pessoa nova apagados');
  ok((await tenta(`fb.auth.deleteUser(fb.au.currentUser)`)) === 'permitido', 'limpeza: conta nova apagada'); await ate(`nuvem.fase === 'login'`);
  await entrar(tb);
  ok((await tenta(`fb.fs.deleteDoc(${doc('usuarios', tb.uid)})`)) === 'permitido', 'limpeza: dados da pessoa B apagados');
  ok((await tenta(`fb.auth.deleteUser(fb.au.currentUser)`)) === 'permitido', 'limpeza: conta B apagada'); await ate(`nuvem.fase === 'login'`);
  await entrar(tc);
  ok((await tenta(`fb.auth.deleteUser(fb.au.currentUser)`)) === 'permitido', 'limpeza: conta sem confirmar apagada'); await ate(`nuvem.fase === 'login'`);
  await entrar(ta);
  for (const e of [tb.email, tc.email, novo]) await tenta(`fb.fs.deleteDoc(${doc('convites', e)})`);
  ok((await js(`fb.fs.getDocs(fb.fs.collection(fb.db, 'convites')).then(q => q.size)`)) === 0, 'limpeza: nenhum convite de teste sobrou');
  ok((await tenta(`fb.auth.deleteUser(fb.au.currentUser)`)) === 'permitido', 'limpeza: conta do administrador de teste apagada');

  console.log(erros.length ? 'Erros:\n' + erros.join('\n') : 'Sem erros de script.');
  console.log(falhas ? `${falhas} FALHA(S)` : 'TUDO OK');
  ws.close(); process.exit(falhas ? 1 : 0);
})();
