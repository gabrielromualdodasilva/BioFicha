// Gera três contas descartáveis para testar os convites e os arquivos que o teste usa.
// uso: node contas-teste.js <pasta de saída>   (depois: firebase auth:import importar.json --hash-algo=HMAC_SHA256 --hash-key=<chave>)
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const pasta = process.argv[2];
const chave = crypto.randomBytes(32);
const id = () => crypto.randomBytes(4).toString('hex');
const conta = (papel, verificado) => {
  const senha = crypto.randomBytes(12).toString('base64url');
  return { papel, uid: 'teste' + papel + crypto.randomBytes(10).toString('hex'), email: `teste.${papel}.${id()}@example.com`, senha, verificado };
};
const contas = { ta: conta('admin', true), tb: conta('convidado', true), tc: conta('semconfirmar', false) };
fs.writeFileSync(path.join(pasta, 'importar.json'), JSON.stringify({
  users: Object.values(contas).map(c => ({
    localId: c.uid, email: c.email, emailVerified: c.verificado,
    passwordHash: crypto.createHmac('sha256', chave).update(c.senha).digest('base64')
  }))
}));
fs.writeFileSync(path.join(pasta, 'contas.json'), JSON.stringify(contas));
fs.writeFileSync(path.join(pasta, 'chave.txt'), chave.toString('base64'));
// Configuração do site para o teste: a conta "admin" de teste entra na lista de administradores da tela
const cfg = fs.readFileSync(process.argv[3], 'utf8').replace(/const FIREBASE_ADMINS = \[([^\]]*)\];/, (m, a) => `const FIREBASE_ADMINS = [${a}, '${contas.ta.uid}'];`);
fs.writeFileSync(path.join(pasta, 'config-teste.js'), cfg);
console.log(contas.ta.uid);
