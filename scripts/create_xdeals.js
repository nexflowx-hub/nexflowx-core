const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function createXdeals() {
  try {
    // 1. Criar o Utilizador Merchant
    const user = await prisma.user.create({
      data: {
        username: 'XDEALS_Admin',
        password_hash: 'Xdeals_Secure_2026!', // A password do Dashboard
        role: 'merchant',
        preferred_provider: 'stripe'
      }
    });

    // 2. Gerar API Key Segura
    const rawSecret = crypto.randomBytes(24).toString('hex');
    const fullKey = `nx_live_${rawSecret}`;
    const prefix = fullKey.substring(0, 12);
    const hash = crypto.createHash('sha256').update(rawSecret).digest('hex');

    await prisma.apiKey.create({
      data: {
        name: 'XDEALS Production Key',
        key_prefix: prefix,
        key_hash: hash,
        user_id: user.id
      }
    });

    console.log('\n✅ CLIENTE XDEALS CRIADO COM SUCESSO!\n');
    console.log('--- CREDENCIAIS DO DASHBOARD ---');
    console.log(`Username: XDEALS_Admin`);
    console.log(`Password: Xdeals_Secure_2026!`);
    console.log('\n--- CREDENCIAIS DA API (PRODUÇÃO) ---');
    console.log(`API Key (x-api-key): ${fullKey}`);
    console.log('⚠️ AVISO: Copia esta API Key para o e-mail do cliente agora! Ela está em Hash na BD e não poderá ser vista novamente.\n');

  } catch (e) {
    console.error('⚠️ Erro ao criar cliente (já existe?):', e.message);
  } finally {
    await prisma.$disconnect();
  }
}

createXdeals();
