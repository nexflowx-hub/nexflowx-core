require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
const prisma = new PrismaClient();

// --- PREENCHE ESTES DADOS ---
const SUMUP_API_KEY = 'sup_sk_WTk5HT4bjg8hvxoT91jPfl2ttFdFp4D4O'; // Access Token da SumUp
const SUMUP_MERCHANT_ID = 'M6CS4X5G'; // Merchant Code (geralmente começa por M)
// ----------------------------

const MASTER_KEY = process.env.NEXFLOWX_MASTER_KEY;

function encrypt(text) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(MASTER_KEY, 'hex'), iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function addSumup() {
  try {
    const user = await prisma.user.findUnique({ 
      where: { username: 'Mx02042026' }, 
      include: { stores: true } 
    });

    if (!user || user.stores.length === 0) {
      console.error("❌ Cliente ou Loja não encontrados!");
      return;
    }

    const storeId = user.stores[0].id;

    await prisma.gatewayConfig.create({
      data: {
        user_id: user.id,
        store_id: storeId,
        provider_name: 'sumup',
        api_key: encrypt(SUMUP_API_KEY),
        merchant_id: SUMUP_MERCHANT_ID,
        is_active: true
      }
    });

    console.log("✅ Configuração da SumUp adicionada com sucesso à Loja Oficial Cliente!");
  } catch (e) {
    console.error("❌ Erro ao adicionar SumUp:", e.message);
  } finally {
    await prisma.$disconnect();
  }
}

addSumup();
