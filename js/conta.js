'use strict';
/* Conta e privacidade: política de privacidade e consentimento, troca de senha, exclusão da conta,
   anotações de quem acompanha o aluno e instalação do site como aplicativo.
   Carregado antes de app.js; usa as funções dele só na hora em que é chamado. */

/* ───────── Privacidade ───────── */
const VERSAO_PRIVACIDADE = 1;
const TEXTO_PRIVACIDADE = [
  ['O que o BioFicha guarda', 'Seu e-mail de acesso e o que você mesmo registra: nome ou apelido, sexo, data de nascimento, altura, peso, números da bioimpedância, medidas de fita, ficha de treino, treinos concluídos com as cargas, e o que você anota de alimentação.'],
  ['Para que usa', 'Só para montar e ajustar a sua ficha e o seu plano alimentar, mostrar a sua evolução e permitir o acompanhamento de quem convidou você. Os dados não são vendidos, não são usados para anúncios e não são enviados a serviços de inteligência artificial.'],
  ['Quem vê', 'Você; a pessoa que convidou você (o administrador do site ou o profissional que acompanha você); e o administrador do BioFicha. Eles veem medições, treinos e alimentação para acompanhar o seu progresso, e podem fazer anotações sobre o acompanhamento. Eles não alteram os seus registros. Outros usuários não veem nada seu.'],
  ['Onde fica', 'Na nuvem do Google (Firebase), em servidores em São Paulo, com acesso protegido por login. No seu aparelho fica uma cópia para o site funcionar sem internet; ela é apagada quando você toca em Sair.'],
  ['Por quanto tempo', 'Até você apagar. Se o seu acesso for removido por quem convidou você, os dados ficam guardados e inacessíveis até serem apagados.'],
  ['O que você pode fazer', 'No Perfil você baixa uma cópia de tudo, corrige o cadastro, apaga todos os seus dados ou exclui a conta inteira. Você também pode pedir essas ações a quem convidou você. Dados de saúde são tratados com base no seu consentimento, que você pode retirar a qualquer momento apagando os dados ou excluindo a conta.'],
  ['Aviso de saúde', 'O BioFicha dá orientações gerais calculadas por fórmulas. Não é consulta, diagnóstico nem prescrição, e não substitui médico, nutricionista ou profissional de educação física.']
];
function modalPrivacidade() {
  abrirModal(`${topoModal('Privacidade e uso dos dados')}<div class="miolo solto privacidade">
    ${TEXTO_PRIVACIDADE.map(([t, x]) => `<h3>${t}</h3><p>${x}</p>`).join('')}
    <p class="mini suave" style="margin-top:16px">Versão ${VERSAO_PRIVACIDADE} desta política. Dúvidas ou pedidos: fale com quem enviou o seu convite.</p></div>`);
}
// O consentimento só existe no site publicado: é lá que os dados saem do aparelho e outra pessoa pode vê-los
const precisaConsentir = () => NUVEM && !ehAdmin();
const consentiu = p => !!(p && p.consentimento && p.consentimento.versao >= VERSAO_PRIVACIDADE);
function campoConsentimento() {
  if (!precisaConsentir() || consentiu(estado.perfil)) return '';
  const r = ui.rascunho, erro = ui.erros.consentimento;
  return `<div class="bloco"><label class="consentimento ${erro ? 'invalida' : ''}"><input type="checkbox" id="aceite" ${r.aceite ? 'checked' : ''}>
      <span>Li a <button type="button" class="link" data-acao="ver-privacidade">política de privacidade</button> e concordo com o uso dos meus dados de saúde para montar o meu plano e para o acompanhamento de quem me convidou.</span></label>
    ${erro ? `<small class="erro-consentimento">${erro}</small>` : ''}</div>`;
}
// Para quem já usava o site antes da política existir
function cartaoConsentimento() {
  if (!precisaConsentir() || consentiu(estado.perfil)) return '';
  return `<div class="card chamada" style="margin-bottom:16px"><h2 style="margin-bottom:6px">Privacidade dos seus dados</h2>
    <p>O BioFicha guarda dados de saúde que você registra, e quem convidou você acompanha o seu progresso. Leia como isso funciona e confirme que está de acordo.</p>
    <div class="acoes" style="margin-top:12px"><button class="btn" data-acao="ver-privacidade">Ler a política</button><button class="btn primario" data-acao="aceitar-privacidade">Li e concordo</button></div></div>`;
}

/* ───────── Senha e exclusão da conta ───────── */
const reautenticar = senha => fb.auth.reauthenticateWithCredential(fb.au.currentUser, fb.auth.EmailAuthProvider.credential(fb.au.currentUser.email, senha));
const erroDeSenha = e => (['auth/invalid-credential', 'auth/wrong-password', 'auth/missing-password'].includes(e.code) ? 'A senha atual não confere.' : ERROS_CONTA[e.code] || 'Não consegui concluir. Tente de novo.');
function modalSenha() {
  const m = ui.modalConta || (ui.modalConta = { erro: '', ocupado: false });
  abrirModal(`${topoModal('Trocar senha')}<div class="miolo solto"><form id="form-trocar-senha" class="pilha" novalidate>
      <label class="campo"><span>Senha atual</span><input class="entrada" id="s-atual" type="password" autocomplete="current-password"></label>
      <label class="campo"><span>Nova senha</span><input class="entrada" id="s-nova" type="password" autocomplete="new-password"><small>Pelo menos 6 caracteres.</small></label>
      ${m.erro ? `<p class="aviso erro" role="alert">${esc(m.erro)}</p>` : ''}
      <div class="acoes" style="justify-content:flex-end"><button class="btn" type="button" data-acao="fechar-conta">Cancelar</button><button class="btn primario" type="submit" ${m.ocupado ? 'disabled' : ''}>${m.ocupado ? 'Aguarde…' : 'Trocar senha'}</button></div>
    </form></div>`, true);
}
async function trocarSenha() {
  const m = ui.modalConta, atual = $('#s-atual').value, nova = $('#s-nova').value;
  m.erro = !atual ? 'Digite a senha atual.' : nova.length < 6 ? 'A nova senha precisa ter pelo menos 6 caracteres.' : nova === atual ? 'A nova senha precisa ser diferente da atual.' : '';
  if (m.erro) return modalSenha();
  m.ocupado = true; modalSenha();
  try {
    await reautenticar(atual); await fb.auth.updatePassword(fb.au.currentUser, nova);
    ui.modalConta = null; fecharModal(); toast('Senha trocada.');
  } catch (e) { console.warn('senha', e); m.ocupado = false; m.erro = erroDeSenha(e); modalSenha(); }
}
function modalExcluirConta() {
  const m = ui.modalConta || (ui.modalConta = { erro: '', ocupado: false });
  abrirModal(`${topoModal('Excluir minha conta')}<div class="miolo solto"><form id="form-excluir-conta" class="pilha" novalidate>
      <p>Isso apaga o seu cadastro, a ficha, as medições, o diário e o histórico, e também a sua conta de acesso. <b>Não dá para desfazer.</b> Se quiser guardar algo, feche esta janela e use "Baixar cópia" antes.</p>
      <label class="campo"><span>Digite sua senha para confirmar</span><input class="entrada" id="x-senha" type="password" autocomplete="current-password"></label>
      ${m.erro ? `<p class="aviso erro" role="alert">${esc(m.erro)}</p>` : ''}
      <div class="acoes" style="justify-content:flex-end"><button class="btn" type="button" data-acao="fechar-conta">Cancelar</button><button class="btn perigo" type="submit" ${m.ocupado ? 'disabled' : ''}>${m.ocupado ? 'Excluindo…' : 'Excluir conta e dados'}</button></div>
    </form></div>`, true);
}
async function excluirConta() {
  const m = ui.modalConta, senha = $('#x-senha').value;
  m.erro = !senha ? 'Digite a senha.' : !navigator.onLine ? 'Sem conexão com a internet.' : '';
  if (m.erro) return modalExcluirConta();
  m.ocupado = true; modalExcluirConta();
  try {
    await reautenticar(senha);
    nuvem.saindo = true;                                    // daqui em diante a tela não reage mais às mudanças da conta
    clearTimeout(nuvem.timer); nuvem.timer = null;
    if (nuvem.parar) { nuvem.parar(); nuvem.parar = null; }
    await fb.fs.deleteDoc(fb.fs.doc(fb.db, 'usuarios', fb.au.currentUser.uid));
    await fb.auth.deleteUser(fb.au.currentUser);
    try { await fb.fs.terminate(fb.db); await fb.fs.clearIndexedDbPersistence(fb.db); } catch (e) { /* cópia local some no próximo acesso */ }
    history.replaceState(null, '', location.pathname); location.reload();
  } catch (e) { console.warn('excluir conta', e); nuvem.saindo = false; m.ocupado = false; m.erro = erroDeSenha(e); modalExcluirConta(); }
}

/* ───────── Anotações de quem acompanha (administrador ou profissional) ───────── */
async function carregarNota(uid) {
  ui.notas = ui.notas || {};
  try { const s = await fb.fs.getDoc(fb.fs.doc(fb.db, 'anotacoes', uid)); ui.notas[uid] = s.exists() ? s.data() : { texto: '' }; }
  catch (e) { console.warn('anotacao', e); ui.notas[uid] = { texto: '', erro: true }; }
  const t = $('#nota-usuario');
  if (t && t.dataset.uid === uid) { t.value = ui.notas[uid].texto || ''; t.disabled = false; t.placeholder = 'Combinados, observações, o que ajustar na próxima semana…'; }
}
function blocoNota(uid) {
  const n = (ui.notas || {})[uid];
  if (!n) carregarNota(uid);
  return `<div class="anotacao"><h3>Suas anotações</h3>
    <textarea class="entrada" id="nota-usuario" data-uid="${esc(uid)}" rows="3" maxlength="4000" ${n ? '' : 'disabled'} placeholder="${n ? 'Combinados, observações, o que ajustar na próxima semana…' : 'Carregando…'}">${n ? esc(n.texto || '') : ''}</textarea>
    <div class="acoes" style="margin-top:8px"><button class="btn" data-acao="salvar-nota" data-valor="${esc(uid)}">Salvar anotação</button>
      <span class="mini suave">${n && n.atualizadoEm ? 'Salva em ' + dataBR(new Date(n.atualizadoEm - new Date(n.atualizadoEm).getTimezoneOffset() * 60000).toISOString()) + '. ' : ''}A pessoa não vê estas anotações.</span></div></div>`;
}

/* ───────── Instalar como aplicativo ─────────
   O navegador avisa quando o site pode ser instalado; guardamos o aviso para oferecer o botão no Perfil. */
let avisoInstalar = null;
window.addEventListener('beforeinstallprompt', ev => { ev.preventDefault(); avisoInstalar = ev; if (typeof rotaAtual === 'function' && typeof estado !== 'undefined' && estado.perfil && rotaAtual() === 'perfil') render(); });
window.addEventListener('appinstalled', () => { avisoInstalar = null; });
const instalado = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
function cartaoInstalar() {
  if (location.protocol !== 'https:' || instalado()) return '';
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  return `<div class="card"><h2>Instalar no celular</h2><p class="suave pequeno">${avisoInstalar ? 'Instale o BioFicha para abrir pela tela inicial, em tela cheia, e usar na academia mesmo sem sinal.'
      : ios ? 'No iPhone: toque em Compartilhar e depois em "Adicionar à Tela de Início". O BioFicha passa a abrir como aplicativo e funciona sem sinal.'
      : 'No menu do navegador, toque em "Instalar aplicativo" ou "Adicionar à tela inicial". O BioFicha passa a abrir como aplicativo e funciona sem sinal.'}</p>
    ${avisoInstalar ? '<div class="acoes" style="margin-top:12px"><button class="btn primario" data-acao="instalar-app">Instalar aplicativo</button></div>' : ''}</div>`;
}
// O serviço em segundo plano guarda o site no aparelho para abrir sem internet (só existe no endereço publicado)
function ligarModoAplicativo() {
  if (location.protocol !== 'https:' || !('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => { navigator.serviceWorker.register('sw.js').catch(e => console.warn('modo aplicativo', e)); });
}

const ACOES_CONTA = {
  'ver-privacidade'() { modalPrivacidade(); },
  'aceitar-privacidade'() { estado.perfil.consentimento = { em: Date.now(), versao: VERSAO_PRIVACIDADE }; salvar(); render(); toast('Obrigado. Registrado.'); },
  'trocar-senha'() { ui.modalConta = null; modalSenha(); const c = $('#s-atual'); if (c) c.focus(); },
  'excluir-conta'() { ui.modalConta = null; modalExcluirConta(); },
  'fechar-conta'() { ui.modalConta = null; fecharModal(); },
  async 'salvar-nota'(el) {
    const uid = el.dataset.valor, t = $('#nota-usuario'); if (!t) return;
    const nota = { texto: t.value.slice(0, 4000), atualizadoEm: Date.now(), por: nuvem.usuario.uid };
    try { await fb.fs.setDoc(fb.fs.doc(fb.db, 'anotacoes', uid), nota); (ui.notas = ui.notas || {})[uid] = nota; toast('Anotação salva.'); }
    catch (e) { console.warn('anotacao', e); toast('Não consegui salvar a anotação. Tente de novo.'); }
  },
  async 'instalar-app'() { if (!avisoInstalar) return; const a = avisoInstalar; avisoInstalar = null; a.prompt(); try { await a.userChoice; } catch (e) { /* fechou o aviso */ } render(); }
};
