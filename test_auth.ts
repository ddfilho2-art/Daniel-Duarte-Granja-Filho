import { loginWithLogin } from './src/lib/authService';

async function test(username, pass) {
   console.log(`\nTesting login for: ${username}`);
   try {
       const user = await loginWithLogin(username, pass);
       console.log("Success! user:", user.login);
   } catch (e) {
       console.log("Failed!", e.message);
   }
}

async function run() {
    await test('admin2026', 'Admin@123'); // bad pass -> expects "Email ou senha inválidos."
    await test('admin2026', 'Teste@123'); // bad pass -> expects "Email ou senha inválidos."
    await test('candidato1', 'Teste@123'); // good pass -> success
}

run();