const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function provisionEnterpriseClient() {
  try {
    const client = await prisma.user.create({
      data: {
        id: 'cmnfb4v4z000064rllglrtyi8',
        username: 'C.Euro2026',
        password_hash: 'Euro2026_SecurePwd!',
        role: 'merchant',
        preferred_provider: 'stripe',
        webhook_secret: 'nx_sec_9kL2p_Xv92_Rz8w_Kq'
      }
    });

    const apiKey = 'nx_live_3351f5fcf21a3ccf1decee1f2c62e1fc1e63392a1475d6ce';

    await prisma.apiKey.create({
      data: {
        name: 'Euro2026 Production Key',
        key_hash: apiKey,
        key_prefix: 'nx_live_',
        user_id: client.id
      }
    });

    console.log('✅ Cliente restaurado com SUCESSO com as credenciais corretas!');
  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}
provisionEnterpriseClient();
