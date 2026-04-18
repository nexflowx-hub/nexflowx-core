const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');

const prisma = new PrismaClient();

async function forceFix() {
  const recordId = 'cmnfrzhes00014gbe283rhuwg'; // O ID exato da chave na tua BD
  const apiKeyOriginal = 'nx_live_3351f5fcf21a3ccf1decee1f2c62e1fc1e63392a1475d6ce';
  
  const rawSecret = apiKeyOriginal.replace(/^nx_live_[a-f0-9]{4}/, '');
  const realHash = crypto.createHash('sha256').update(rawSecret).digest('hex');

  try {
    await prisma.apiKey.update({
      where: { id: recordId },
      data: { key_hash: realHash }
    });
    console.log('\n✅ CHAVE FORÇADA COM SUCESSO! Podes testar o cURL agora.\n');
  } catch (error) {
    console.log('\n⚠️ Erro ao forçar a chave:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

forceFix();
