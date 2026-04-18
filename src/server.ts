// ============================================================================
// SECÇÃO 1: IMPORTS & CONFIGURAÇÃO INICIAL
// ============================================================================
import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';

import crypto from 'crypto';
import Stripe from 'stripe';


import apiRoutes from './routes/api.routes';
import { authenticateUser } from './middleware/auth.middleware';

dotenv.config();
const app = express();
const prisma = new PrismaClient();

// CORREÇÃO CRÍTICA (Segurança): Fallback removido. Forçar variáveis de ambiente.
if (!process.env.NEXFLOWX_MASTER_KEY || !process.env.JWT_SECRET) {
  console.error("🚨 ERRO FATAL: NEXFLOWX_MASTER_KEY ou JWT_SECRET não estão definidos no .env!");
  process.exit(1); // Derruba o servidor para não comprometer dados
}

const JWT_SECRET = process.env.JWT_SECRET;
const MASTER_KEY = process.env.NEXFLOWX_MASTER_KEY;
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', { apiVersion: '2023-10-16' as any });

app.use(cors({
  origin: true,
  methods: ['GET', 'POST', 'PATCH', 'OPTIONS', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization']
}));

const ENCRYPTION_KEY = Buffer.from(MASTER_KEY, 'hex');
const IV_LENGTH = 16;

// ============================================================================
// SECÇÃO 2: UTILITÁRIOS DE CRIPTOGRAFIA
// ============================================================================
function encryptKey(text: string) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

function decryptKey(text: string) {
  try {
    const textParts = text.split(':');
    const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, Buffer.from(textParts[0], 'hex'));
    return decipher.update(Buffer.from(textParts[1], 'hex'), undefined, 'utf8') + decipher.final('utf8');
  } catch (e) {
    return null;
  }
}

// ============================================================================
// SECÇÃO 3: MOTOR DE NOTIFICAÇÕES (WEBHOOKS)
// ============================================================================
async function notifyMerchant(txId: string) {
  const tx = await prisma.transaction.findUnique({ where: { id: txId }, include: { payee: true, store: true } });
  if (!tx) return false;

  const targetWebhookUrl = tx.store?.webhook_url || tx.payee.webhook_url;
  const targetWebhookSecret = tx.store?.webhook_secret || tx.payee.webhook_secret;

  if (!targetWebhookUrl) return false;

  const payload = {
    event: 'payment.gateway_confirmed',
    transaction_id: tx.id,
    store_id: tx.store_id,
    amount: tx.amount,
    net_amount: tx.net_amount || tx.amount,
    method: tx.payment_method,
    currency: tx.currency,
    country: tx.country_code,
    customer_email: tx.customer_email,
    customer_details: tx.metadata,
    logistics_status: (tx as any).logistics_status
  };

  const signature = crypto.createHmac('sha256', targetWebhookSecret || '').update(JSON.stringify(payload)).digest('hex');

  for (let i = 0; i < 3; i++) {
    try {
      const res = await fetch(targetWebhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-nexflowx-signature': signature },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        await prisma.webhookEvent.create({ data: { transaction_id: tx.id, payload, status: 'sent', attempts: i + 1, response_code: res.status } });
        return true;
      }
    } catch (e) {
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
  await prisma.webhookEvent.create({ data: { transaction_id: tx.id, payload, status: 'failed', attempts: 3 } });
  return false;
}
// ============================================================================
// SECÇÃO 4: HANDLERS & INCOMING WEBHOOKS (STRIPE)
// ============================================================================
app.post('/api/v1/webhooks/stripe', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig as string, process.env.STRIPE_WEBHOOK_SECRET as string);
    
    // CORREÇÃO: Escutar Payment Intents (compatível com a Secção 9)
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as any;
      const txId = paymentIntent.metadata?.txId; // Lê o ID que injetámos no initiate
      
      if (txId) {
        // 1. Atualizar o Ledger / DB
        await prisma.transaction.update({
          where: { id: txId },
          data: {
            status: 'gateway_confirmed',
            provider_transaction_id: paymentIntent.id,
            customer_email: paymentIntent.receipt_email || null
          }
        });
        
        // 2. Disparar a notificação para o cliente final
        console.log(`[WEBHOOK STRIPE] Pagamento confirmado. Notificando merchant para Tx: ${txId}`);
        await notifyMerchant(txId);
      }
    }
    
    res.json({ received: true });
  } catch (err: any) { 
    console.error("[WEBHOOK ERRO]", err.message);
    res.status(400).send(`Webhook Error: ${err.message}`); 
  }
});

app.use(cors({ origin: true, methods: ['GET', 'POST', 'PATCH', 'OPTIONS', 'PUT'], allowedHeaders: ['Content-Type', 'x-api-key', 'Authorization'] }));
app.use(express.json());

// ============================================================================
// SECÇÃO 5: MIDDLEWARES & AUTENTICAÇÃO
// ============================================================================
// authenticateUser importado da Secção 1

app.post('/api/v1/auth/login', async (req, res) => {
  const { username, password } = req.body;
  const user = await prisma.user.findUnique({ where: { username } });
  if (user && user.password_hash === password) {
    return res.json({
      success: true,
      token: jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: '24h' }),
      user: { id: user.id, role: user.role, username: user.username }
    });
  }
  res.status(401).json({ error: "Credenciais inválidas" });
});

app.get('/api/v1/users/me', authenticateUser, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: (req as any).user.id },
      select: { id: true, username: true, role: true }
    });
    res.json({ data: user });
  } catch (e) { res.status(500).json({ error: "Erro ao obter perfil" }); }
});

app.get('/api/v1/api-keys', authenticateUser, async (req, res) => {
  try {
    const keys = await prisma.apiKey.findMany({
      where: { user_id: (req as any).user.id },
      orderBy: { created_at: 'desc' }
    });
    res.json({ data: keys });
  } catch (e) { res.status(500).json({ error: "Erro ao listar chaves" }); }
});

// ============================================================================
// SECÇÃO 6: GESTÃO DE LOJAS (MULTI-TENANT)
// ============================================================================
app.get('/api/v1/stores', authenticateUser, async (req, res) => {
  try {
    const stores = await prisma.store.findMany({ where: { user_id: (req as any).user.id }, orderBy: { created_at: 'desc' } });
    res.json({ data: stores });
  } catch (e) { res.status(500).json({ error: "Erro ao listar lojas" }); }
});

app.post('/api/v1/stores', authenticateUser, async (req, res) => {
  try {
    const { name, logo_url, primary_color, accent_color, webhook_url } = req.body;
    const webhook_secret = 'nx_sec_' + crypto.randomBytes(16).toString('hex');
    const store = await prisma.store.create({
      data: { name, logo_url, primary_color, accent_color, webhook_url, webhook_secret, user_id: (req as any).user.id }
    });
    res.status(201).json({ success: true, data: store });
  } catch (e) { res.status(500).json({ error: "Erro ao criar loja" }); }
});

app.patch('/api/v1/stores/:id', authenticateUser, async (req, res) => {
  try {
    const { name, logo_url, primary_color, accent_color, webhook_url } = req.body;
    await prisma.store.updateMany({
      where: { id: req.params.id, user_id: (req as any).user.id },
      data: { name, logo_url, primary_color, accent_color, webhook_url }
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Erro update loja" }); }
});

// ============================================================================
// SECÇÃO 7: DASHBOARD E LOGÍSTICA
// ============================================================================
app.get('/api/v1/pipeline', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const storeId = req.query.store_id as string;
    const whereClause: any = user.role === 'admin' ? { status: { notIn: ['pending', 'failed'] } } : { payee_id: user.id, status: { notIn: ['pending', 'failed'] } };
    if (storeId) whereClause.store_id = storeId;

    const txs = await prisma.transaction.findMany({ where: whereClause });
    const p: any = { failed: { total: 0, count: 0 }, gateway_confirmed: { total: 0, count: 0 }, holding_provider: { total: 0, count: 0 }, fx_in_transit: { total: 0, count: 0 }, inventory_wallet: { total: 0, count: 0 }, distributed: { total: 0, count: 0 } };
    txs.forEach((t) => {
      if (p[t.status]) {
        p[t.status].count += 1;
        p[t.status].total += Number(t.net_amount || t.amount || 0);
      }
    });
    res.json({ data: p });
  } catch (e: any) { console.error("[ERRO DASHBOARD]", e); res.status(500).json({ error: e.message || String(e) }); }
});

app.get('/api/v1/transactions', authenticateUser, async (req, res) => {
  try {
    const user = (req as any).user;
    const storeId = req.query.store_id as string;
    const whereClause: any = user.role === 'admin' ? { status: { not: 'pending' } } : { payee_id: user.id, status: { not: 'pending' } };
    if (storeId) whereClause.store_id = storeId;

    const txs = await prisma.transaction.findMany({
      where: whereClause,
      orderBy: { created_at: 'desc' },
      include: { store: { select: { name: true } } }
    });
    res.json({ data: txs });
  } catch (e: any) { console.error("[ERRO DASHBOARD]", e); res.status(500).json({ error: e.message || String(e) }); }
});

// ============================================================================
// SECÇÃO 8: CONFIGURAÇÕES E GATEWAYS
// ============================================================================
app.get('/api/v1/settings/gateways', authenticateUser, async (req, res) => {
  try {
    const configs = await prisma.gatewayConfig.findMany({ where: { user_id: (req as any).user.id } });
    res.json({ data: configs.map(c => ({ id: c.id, provider_name: c.provider_name, is_active: c.is_active, merchant_id: c.merchant_id, store_id: c.store_id })) });
  } catch (e: any) { console.error("[ERRO DASHBOARD]", e); res.status(500).json({ error: e.message || String(e) }); }
});

app.post('/api/v1/settings/gateways', authenticateUser, async (req, res) => {
  try {
    const { provider_name, api_key, merchant_id, is_active, store_id } = req.body;
    await prisma.gatewayConfig.create({
      data: { user_id: (req as any).user.id, store_id: store_id || null, provider_name, api_key: encryptKey(api_key), merchant_id, is_active }
    });
    res.json({ success: true });
  } catch (e: any) { res.status(500).json({ error: "Erro" }); }
});

// ============================================================================
// SECÇÃO 9: FLUXO DE CHECKOUT E INTEGRAÇÃO
// ============================================================================
app.post('/api/v1/sumup/confirm', async (req, res) => {
  const { txId, checkoutId } = req.body;
  try {
    const tx = await prisma.transaction.findUnique({ where: { id: txId }, include: { payee: { include: { gateway_configs: true } }, store: { include: { gateways: true } } } });
    if (!tx || tx.status === 'gateway_confirmed') return res.json({ ok: true });

    let config = tx.store?.gateways.find(c => c.provider_name === 'sumup' && c.is_active);
    if (!config) config = tx.payee.gateway_configs.find(c => c.provider_name === 'sumup' && c.is_active && !c.store_id);

    if (!config) return res.status(400).json({ error: "Gateway não configurado" });

    const secretKey = decryptKey(config.api_key);
    const sumupRes = await fetch(`https://api.sumup.com/v0.1/checkouts/${checkoutId}`, { headers: { Authorization: `Bearer ${secretKey}` } });
    const sumupTx = await sumupRes.json();

    if (sumupTx.status === 'PAID') {
      await prisma.transaction.update({ where: { id: txId }, data: { status: 'gateway_confirmed', provider_transaction_id: checkoutId, net_amount: Number(tx.amount) } });
      await notifyMerchant(txId);
      return res.json({ ok: true });
    }
    res.status(400).json({ error: "Payment not verified" });
  } catch (e) { res.status(500).json({ error: "Internal error" }); }
});

app.post('/api/v1/payment-links', async (req, res) => {
  try {
    const apiKey = req.headers['x-api-key'] as string;
    const authHeader = req.headers.authorization;
    let userId = null;

    if (apiKey) {
      const rawSecret = apiKey.replace(/^nx_live_[a-f0-9]{4}/, '');
      const hashOld = crypto.createHash('sha256').update(rawSecret).digest('hex');
      let keyData = await prisma.apiKey.findUnique({ where: { key_hash: hashOld } });
      
      if (!keyData) {
        const hashNew = crypto.createHash('sha256').update(apiKey).digest('hex');
        keyData = await prisma.apiKey.findUnique({ where: { key_hash: hashNew } });
      }
      if (keyData) userId = keyData.user_id;
    } else if (authHeader) {
      try {
        const decoded = jwt.verify(authHeader.split(' ')[1], JWT_SECRET) as any;
        userId = decoded.id;
      } catch (err) { }
    }

    if (!userId) return res.status(403).json({ error: "Unauthorized" });

    let resolvedStoreId = req.body.store_id || null;
    if (!resolvedStoreId && req.body.store_name) {
      const store = await prisma.store.findFirst({ where: { user_id: userId, name: { equals: req.body.store_name, mode: 'insensitive' } } });
      if (store) resolvedStoreId = store.id;
    }
    
    // CORREÇÃO DE EMERGÊNCIA: Fallback para a loja principal se nenhuma for passada
    if (!resolvedStoreId) {
      const defaultStore = await prisma.store.findFirst({ where: { user_id: userId } });
      if (defaultStore) resolvedStoreId = defaultStore.id;
    }

    let autoProvider = 'sumup';
    if (resolvedStoreId) {
       const activeStoreGateway = await prisma.gatewayConfig.findFirst({
           where: { store_id: resolvedStoreId, is_active: true }
       });
       if (activeStoreGateway) autoProvider = activeStoreGateway.provider_name;
    } else {
       const activePayeeGateway = await prisma.gatewayConfig.findFirst({
           where: { user_id: userId, store_id: null, is_active: true }
       });
       if (activePayeeGateway) autoProvider = activePayeeGateway.provider_name;
    }

    const tx = await prisma.transaction.create({
      data: {
        amount: Number(req.body.amount),
        currency: String(req.body.currency || 'EUR').toUpperCase(),
        store_id: resolvedStoreId,
        status: 'pending' as any,
        provider_name: autoProvider,
        payee_id: userId,
        country_code: 'UNKNOWN',
        payment_method: 'PENDING',
        fee_amount: 0,
        net_amount: 0,
        metadata: req.body.metadata || {}
      }
    });
    res.status(201).json({ data: { id: tx.id, shareable_url: "https://checkout.nexflowx.tech/?txId=" + tx.id } });
  } catch (e: any) { res.status(500).json({ error: "Erro interno no link" }); }
});

app.get('/api/v1/checkout-session/:id', async (req, res) => {
  try {
    const tx = await prisma.transaction.findUnique({ where: { id: req.params.id }, include: { store: true } });
    if (!tx) return res.status(404).json({ error: 'Sessão não encontrada' });
    res.json({
      id: tx.id,
      amount: Number(tx.amount),
      currency: tx.currency,
      merchant_name: tx.store?.name || "NeXFlowX Checkout",
      metadata: tx.metadata,
      branding: {
        logo_url: tx.store?.logo_url || "https://walluxeuk.com/images/walluxe-logo-nome.png",
        primary_color: tx.store?.primary_color || "#111111",
        accent_color: tx.store?.accent_color || "#d4af37"
      },
      // CORREÇÃO: Métodos permitidos dinâmicos baseados no provider real
      allowed_methods: [tx.provider_name] 
    });
  } catch (err) { res.status(500).json({ error: "Erro interno" }); }
});

app.patch('/api/v1/checkout-session/:id/customer', async (req, res) => {
  try {
    const { customer_email, country, ...otherData } = req.body;
    const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    const currentMetadata = (tx?.metadata as any) || {};
    await prisma.transaction.update({
      where: { id: req.params.id },
      data: { customer_email, country_code: country, metadata: { ...currentMetadata, ...otherData, updated_at: new Date() } }
    });
    res.json({ success: true });
  } catch (e) { res.status(500).json({ error: "Erro save" }); }
});

app.post('/api/v1/checkout-session/:id/initiate', async (req, res) => {
  try {
    const tx = await prisma.transaction.findUnique({
      where: { id: req.params.id },
      include: { payee: { include: { gateway_configs: true } }, store: { include: { gateways: true } } }
    });

    if (!tx) return res.status(404).json({ error: "Transação não encontrada" });

    const requestedProvider = tx.provider_name === 'stripe' ? 'stripe' : 'sumup';
    console.log(`[INITIATE] Usando ${requestedProvider} para Tx: ${tx.id}`);

    let config = tx.store?.gateways.find(c => c.provider_name === requestedProvider && c.is_active);
    if (!config) config = tx.payee.gateway_configs.find(c => c.provider_name === requestedProvider && c.is_active && !c.store_id);

    if (!config) return res.status(500).json({ error: `Gateway ${requestedProvider} offline.` });

    const secretKey = decryptKey(config.api_key);
    if (!secretKey) return res.status(500).json({ error: "Erro de encriptação" });

    if (requestedProvider === 'stripe') {
      const stripeInstance = new Stripe(secretKey, { apiVersion: '2023-10-16' as any });
      const paymentIntent = await stripeInstance.paymentIntents.create({
        amount: Math.round(Number(tx.amount) * 100),
        currency: tx.currency.toLowerCase(),
        metadata: { txId: tx.id }
      });
      return res.json({ provider: 'stripe', client_secret: paymentIntent.client_secret });
    } else {
      let merchantCode = config.merchant_id;
      if (!merchantCode || merchantCode.startsWith('sup_pk_')) {
        const meRes = await fetch('https://api.sumup.com/v0.1/me', { headers: { 'Authorization': `Bearer ${secretKey}` } });
        const meData = await meRes.json();
        if (meData.merchant_profile?.merchant_code) merchantCode = meData.merchant_profile.merchant_code;
      }

      const sumupRes = await fetch('https://api.sumup.com/v0.1/checkouts', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(tx.amount),
          currency: tx.currency.toUpperCase(),
          checkout_reference: `${tx.id}_${Date.now()}`,
          merchant_code: merchantCode
        })
      });
      const data = await sumupRes.json();
      if (!data.id) return res.status(500).json({ error: "Erro na SumUp", details: data });
      return res.json({ provider: 'sumup', checkout_id: data.id });
    }
  } catch (e: any) {
    res.status(500).json({ error: "Erro interno" });
  }
});

// ============================================================================
// SECÇÃO 10: PÁGINAS DE RETORNO E BOOTSTRAP
// ============================================================================
const STRIPE_CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap');
  body { background: #f6f9fc; color: #30313d; font-family: 'Inter', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; padding: 20px; }
  .box { background: #ffffff; padding: 32px; border-radius: 12px; width: 100%; max-width: 400px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #e6ebf1; text-align: center; }
`;

app.get('/success', (req, res) => res.send(`<!DOCTYPE html><html><head><style>${STRIPE_CSS}</style></head><body><div class="box"><h2>✓ Payment Confirmed</h2><p>Thank you!</p></div></body></html>`));
app.get('/cancel', (req, res) => res.send(`<!DOCTYPE html><html><head><style>${STRIPE_CSS}</style></head><body><div class="box"><h2>✕ Canceled</h2></div></body></html>`));
app.get('/ping', (req, res) => res.json({ status: "online", version: "3.0.0-MULTI-TENANT-READY" }));

app.listen(8080, '0.0.0.0', () => console.log('🚀 NeXFlowX v3.0.0-MULTI-TENANT-READY UP'));

app.get('/api/v1/debug/me', authenticateUser, (req, res) => {
  res.json({ who_am_i: (req as any).user });
});
