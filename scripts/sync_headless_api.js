const fs = require('fs');
const serverPath = 'src/server.ts';
let code = fs.readFileSync(serverPath, 'utf8');

// 1. Atualizar o GET Session para incluir Branding e Allowed Methods
const newGetSession = `
app.get('/api/v1/checkout-session/:id', async (req, res) => {
  try {
    const tx = await prisma.transaction.findUnique({ 
      where: { id: req.params.id },
      include: { payee: { select: { username: true } } }
    });
    if (!tx) return res.status(404).json({ error: 'Sessão expirada ou inválida.' });
    
    res.json({ 
      id: tx.id, 
      amount: tx.amount, 
      currency: tx.currency, 
      merchant_name: tx.payee.username,
      // 🚀 INJETADO PARA SUPORTAR O PROMPT DO GPT (WHITE-LABEL)
      branding: {
        logo_url: "https://ui-avatars.com/api/?name=" + tx.payee.username + "&background=random",
        primary_color: "#000000",
        accent_color: "#f3f4f6"
      },
      allowed_methods: ["card", "mbway", "apple_pay"]
    });
  } catch (err) { res.status(500).json({ error: 'Erro no servidor' }); }
});
`;

// 2. Atualizar o Initiate para devolver o redirect_url da Stripe
const newInitiate = `
app.post('/api/v1/checkout-session/:id/initiate', async (req, res) => {
  try {
    const tx = await prisma.transaction.findUnique({ where: { id: req.params.id } });
    if (!tx) return res.status(404).json({ error: 'Transação não encontrada' });

    const gateway = await prisma.gatewayConfig.findFirst({
      where: { user_id: tx.payee_id, provider_name: tx.provider_name, is_active: true }
    });
    if (!gateway) return res.status(500).json({ error: \`Gateway \${tx.provider_name} não configurado.\` });

    if (tx.provider_name === 'sumup') {
      const sumupResponse = await fetch('https://api.sumup.com/v0.1/checkouts', {
        method: 'POST',
        headers: { 'Authorization': \`Bearer \${gateway.api_key}\`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: Number(tx.amount), currency: tx.currency, checkout_reference: tx.id, merchant_code: gateway.merchant_id })
      });
      const sumupData = await sumupResponse.json();
      // 🚀 FORMATO EXATO DO PROMPT GPT
      return res.json({ provider: 'sumup', checkout_id: sumupData.id });
    }

    if (tx.provider_name === 'stripe') {
      const session = await stripe.checkout.sessions.create({
        line_items: [{ price_data: { currency: tx.currency.toLowerCase(), product_data: { name: 'Compra em ' + tx.payee_id }, unit_amount: Math.round(Number(tx.amount) * 100) }, quantity: 1 }],
        mode: 'payment',
        success_url: 'https://api-dev.nexflowx.tech/success',
        cancel_url: 'https://api-dev.nexflowx.tech/cancel',
        client_reference_id: tx.id
      });
      // 🚀 FORMATO EXATO DO PROMPT GPT
      return res.json({ provider: 'stripe', redirect_url: session.url });
    }

  } catch (err) { res.status(500).json({ error: 'Erro ao iniciar gateway de pagamento.' }); }
});
`;

// Substituir blocos antigos
code = code.replace(/app\.get\('\/api\/v1\/checkout-session\/:id'[\s\S]*?\}\);/, newGetSession);
code = code.replace(/app\.post\('\/api\/v1\/checkout-session\/:id\/initiate'[\s\S]*?\}\);/, newInitiate);

fs.writeFileSync(serverPath, code);
console.log("✅ Motor NeXFlowX sincronizado com o Prompt do GPT!");
