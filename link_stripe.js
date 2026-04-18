const { PrismaClient } = require('@prisma/client');
const crypto = require('crypto');
require('dotenv').config();

const prisma = new PrismaClient();

// ⚠️ ATENÇÃO: SUBSTITUI O VALOR ABAIXO PELA TUA CHAVE SECRETA DA STRIPE!
const STRIPE_SECRET_KEY = '[CHAVE_REMOVIDA_POR_SEGURANCA]_removido_por_seguranca'; 

const MASTER_KEY = process.env.NEXFLOWX_MASTER_KEY || '7c8f9b2d3e4a5c6b7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c';
const ENCRYPTION_KEY = Buffer.from(MASTER_KEY, 'hex');
const IV_LENGTH = 16;

function encryptKey(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

async function linkStripe() {
  if (STRIPE_SECRET_KEY === '[CHAVE_REMOVIDA_POR_SEGURANCA]_removido_por_seguranca') {
    console.log('\n❌ ERRO: Esqueceste-te de colocar a tua chave real da Stripe no script!\n');
    process.exit(1);
  }

  try {
    const store = await prisma.store.findFirst({ where: { name: 'Securfix' } });
    if (!store) return console.log('❌ Loja Securfix não encontrada.');

    const encryptedStripeKey = encryptKey(STRIPE_SECRET_KEY);

    // Cria ou atualiza a configuração da Stripe para a loja Securfix
    await prisma.gatewayConfig.create({
      data: {
        user_id: store.user_id,
        store_id: store.id,
        provider_name: 'stripe',
        api_key: encryptedStripeKey,
        merchant_id: 'securfix_stripe', 
        is_active: true
      }
    });

    console.log('\n✅ SUCESSO! A Stripe está agora ligada à loja Securfix!');
    console.log('🔒 A tua chave foi encriptada com AES-256 antes de ser guardada na base de dados.\n');

  } catch (error) {
    console.log('⚠️ Erro ao ligar Stripe:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

linkStripe();
