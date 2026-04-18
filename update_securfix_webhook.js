const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

async function updateSecurfixWebhook() {
  try {
    const storeName = 'Securfix';
    const webhookUrl = 'https://securfix.xdeals.online/api/webhook';

    // 1. Encontrar a loja Securfix
    const store = await prisma.store.findFirst({
      where: { name: storeName }
    });

    if (!store) {
      return console.log('⚠️ Erro: Loja Securfix não encontrada. Já correste o setup_stores.js?');
    }

    // 2. Gerar o Segredo
    const newSecret = 'nx_sec_' + crypto.randomBytes(16).toString('hex');

    // 3. Atualizar a base de dados
    await prisma.store.update({
      where: { id: store.id },
      data: {
        webhook_url: webhookUrl,
        webhook_secret: newSecret
      }
    });

    console.log('\n✅ WEBHOOK DA SECURFIX ATUALIZADO COM SUCESSO!\n');
    console.log('--- 📦 DADOS PARA A EQUIPA DA SECURFIX ---');
    console.log(`URL do Webhook: ${webhookUrl}`);
    console.log(`Webhook Secret: ${newSecret}`);
    console.log('\n⚠️ Copia este Secret agora. É ele que a Securfix vai usar na variável NEXFLOWX_WEBHOOK_SECRET para validar os pagamentos que nós lhes enviarmos.');

  } catch (error) {
    console.error('⚠️ Ocorreu um erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

updateSecurfixWebhook();
