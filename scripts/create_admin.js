const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function provisionMaster() {
  try {
    console.log('🛡️ A provisionar a Conta Master (Admin)...');

    const admin = await prisma.user.create({
      data: {
        username: 'NeXFlowX_Master',
        password_hash: 'NexAdmin_Secure_2026*', // A tua password de login
        role: 'admin',
        preferred_provider: 'stripe'
      }
    });

    console.log('✅ Admin Master criado com sucesso!');
    console.log(`👤 Username: ${admin.username}`);
    console.log(`🆔 Ledger ID: ${admin.id}`);
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

provisionMaster();
