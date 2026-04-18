const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function simulate() {
  const txId = process.argv[2]; // Recebe o ID do terminal
  if (!txId) {
    console.error('❌ Erro: Precisas de passar o ID da transação. Ex: node simulate_paid.js ID_AQUI');
    return;
  }

  try {
    console.log(`🔄 A simular confirmação de pagamento para: ${txId}...`);

    const tx = await prisma.transaction.update({
      where: { id: txId },
      data: { status: 'gateway_confirmed' }
    });

    console.log('✅ SUCESSO! A transação foi marcada como PAGA (gateway_confirmed).');
    console.log('📈 Verifica agora o teu Dashboard. O valor deve ter saltado para o balde Verde.');

  } catch (error) {
    console.error('❌ Erro ao atualizar:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

simulate();
