const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();
const MASTER_KEY = process.env.NEXFLOWX_MASTER_KEY || '7c8f9b2d3e4a5c6b7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c';
const ENCRYPTION_KEY = Buffer.from(MASTER_KEY, 'hex');

function decryptKey(text) {
  try {
    const textParts = text.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, Buffer.from(textParts[0], 'hex'));
    return decipher.update(Buffer.from(textParts[1], 'hex'), undefined, 'utf8') + decipher.final('utf8');
  } catch (e) { return null; }
}

async function diagnostic() {
  console.log("🔍 Testando chaves com MASTER_KEY:", MASTER_KEY.substring(0, 10) + "...");
  const configs = await prisma.gatewayConfig.findMany({ include: { store: true } });
  
  for (const c of configs) {
    const decrypted = decryptKey(c.api_key);
    console.log(`- Loja: ${c.store?.name || 'Global'} | Provider: ${c.provider_name} | Leitura: ${decrypted ? '✅ OK' : '❌ ERRO DE DESENCRIPTAÇÃO'}`);
  }
  await prisma.$disconnect();
}
diagnostic();
