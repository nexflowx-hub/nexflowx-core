import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();
const prisma = new PrismaClient();

const MASTER_KEY = process.env.NEXFLOWX_MASTER_KEY || '';
const ENCRYPTION_KEY = Buffer.from(MASTER_KEY, 'hex');

function encryptKey(text: string) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function main() {
  const storeId = "cmnpkykp400054iey7n9yc7ie"; // ID do Securifix
  const userId = "cmnfb4v4z000064rllglrtyi8";   // O teu ID
  
  // COLOCA AQUI A TUA CHAVE REAL
  const sumupKey = "sup_sk_WTk5HT4bjg8hvxoT91jPfl2ttFdFp4D4O"; 

  if (sumupKey === "sup_sk_WTk5HT4bjg8hvxoT91jPfl2ttFdFp4D4O") {
    console.log("❌ ERRO: Esqueceste-te de colocar a tua chave da SumUp no script!");
    process.exit(1);
  }

  console.log("🔒 A encriptar a chave da SumUp...");
  const encryptedKey = encryptKey(sumupKey);

  console.log("🛑 A desativar a Stripe para a loja Securifix...");
  await prisma.gatewayConfig.updateMany({
    where: { store_id: storeId, provider_name: 'stripe' },
    data: { is_active: false }
  });

  console.log("✅ A ligar e ativar a SumUp...");
  await prisma.gatewayConfig.create({
    data: {
      user_id: userId,
      store_id: storeId,
      provider_name: 'sumup',
      api_key: encryptedKey,
      merchant_id: "", // <- CORREÇÃO: O Prisma exige este campo.
      is_active: true
    }
  });

  console.log("🚀 FEITO! O Securifix agora vai usar exclusivamente a SumUp.");
}

main()
  .catch(e => console.error("Erro:", e))
  .finally(async () => {
    await prisma.$disconnect();
  });
