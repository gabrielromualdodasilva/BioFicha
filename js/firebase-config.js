'use strict';
/* Ligação com o projeto do Firebase (bioficha-app). Esses valores só identificam o projeto e podem ficar públicos:
   quem protege os dados são o login e as regras do banco (firestore.rules).
   Com apiKey vazia, o site funciona só no modo local, salvando no navegador. */
const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyBQYmMZLWLimfVTSqwRkxq8qMFcxXkKQ6E',
  authDomain: 'bioficha-app.firebaseapp.com',
  projectId: 'bioficha-app',
  storageBucket: 'bioficha-app.firebasestorage.app',
  messagingSenderId: '11404401272',
  appId: '1:11404401272:web:67c7b0efc1ed4f4dac2b8d'
};
// Id da conta de quem administra os convites. Só muda o que a tela mostra; quem manda de verdade é firestore.rules.
const FIREBASE_ADMINS = ['x34voXDvYVjAx574z7M3yUFoX7tC'];
// Endereços em que o site roda no modo nuvem, além do padrão do projeto (<projeto>.web.app)
const FIREBASE_ENDERECOS = ['biofit.web.app', 'biofit.firebaseapp.com'];
