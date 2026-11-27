# Testes do BioFicha

Scripts em Node (sem dependências) que abrem o site num navegador sem janela, pelo protocolo de depuração do Chrome/Edge, e conferem o comportamento. Esta pasta não é publicada no site.

## O que cada arquivo faz

| Arquivo | O que confere | Precisa de internet |
|---|---|---|
| `calculos.js` | Faixas de referência (gordura, músculo, gordura abdominal), objetivo recomendado e plano alimentar | Não |
| `site.js` | O site inteiro aberto como arquivo: cadastro, avatar (montador, humor, balão e palco), ficha, treino, cargas, diário, análise da semana, reestruturação, constância, telas no celular | Só para a fonte |
| `nuvem.js` | Login, convites, papéis (administrador, profissional, aluno), regras do banco, anotações, troca de senha e exclusão de conta, no projeto real do Firebase | Sim |
| `servidor.js` | Servidor local usado por `nuvem.js` | |
| `contas-teste.js` | Gera contas descartáveis para `nuvem.js` | |

## Como rodar

Abra o Edge (ou o Chrome) sem janela, com a porta de depuração:

```
"C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe" --headless=new --remote-debugging-port=9400 --user-data-dir=%TEMP%\perfil-teste about:blank
```

Em outro terminal, na pasta do projeto:

```
node testes/calculos.js .
node testes/site.js 9400 "file:///C:/caminho/da/pasta/index.html" %TEMP%\fotos
```

Cada linha da saída começa com `OK` ou `FALHA`. O segundo teste grava capturas de tela na pasta indicada (ela precisa existir).

## Teste na nuvem

`nuvem.js` usa o projeto de verdade, então exige cuidado. Ele cria contas `teste.*@example.com`, usa o site com elas e apaga tudo no fim.

1. `node testes/contas-teste.js <pasta temporária> js/firebase-config.js` gera as contas e mostra o id do administrador de teste.
2. `firebase auth:import <pasta>/importar.json --hash-algo=HMAC_SHA256 --hash-key=<conteúdo de chave.txt>` cria as contas.
3. Acrescente o id do administrador de teste na lista de `ehAdmin()` em `firestore.rules`, publique com `firebase deploy --only firestore` e **devolva o arquivo ao normal em seguida**. Espere cerca de um minuto e meio para as regras valerem.
4. `node testes/servidor.js 5180 . <pasta>/config-teste.js` serve o site em `http://localhost:5180`.
5. `node testes/nuvem.js 9400 http://localhost:5180/ <pasta de fotos> <pasta>/contas.json`.
6. Publique de novo as regras normais (`firebase deploy --only firestore`) e confira, com `firebase auth:export`, que nenhuma conta de teste sobrou.

O Firebase CLI não tem comando para apagar contas. Se uma conta de teste sobrar, importe-a de novo com uma senha conhecida, entre com ela e apague pelo próprio site.
