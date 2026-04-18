const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // 1. Criar o Utilizador (Merchant)
  const user = await prisma.user.create({
    data: {
      username: 'Mx02042026',
      password_hash: 'Mx13467928*', // Em prod usar bcrypt
      role: 'merchant',
      email: 'admin@cliente.com'
    }
  });

  // 2. Criar a Loja (Store) com Webhook
  const store = await prisma.store.create({
    data: {
      name: 'Loja A',
      user_id: user.id,
      webhook_url: 'https://webhook.site/teu-endpoint-de-teste',
      webhook_secret: 'nx_sec_' + require('crypto').randomBytes(16).toString('hex'),
      primary_color: '#00ff41', // Estilo Matrix/Dark Mode
      accent_color: '#ffffff'
    }
  });

  console.log(`✅ Cliente Criado! ID User: ${user.id} | ID Store: ${store.id}`);
}

main();
