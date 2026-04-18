const fs = require('fs');
const serverPath = 'src/server.ts';
let code = fs.readFileSync(serverPath, 'utf8');

const oldRouteRegex = /app\.post\('\/api\/v1\/payment-links', authenticateUser, async \(req, res\) => \{[\s\S]*?\}\);/;

const newRoute = `app.post('/api/v1/payment-links', authenticateUser, async (req, res) => {
  try {
    const user_id = (req as any).user.id;
    const { amount, currency, country, customer_email, metadata } = req.body;
    
    const tx = await prisma.transaction.create({ 
      data: { 
        amount: Number(amount), 
        currency: String(currency || 'EUR').toUpperCase(), 
        status: 'pending' as any, 
        provider_name: 'pending', 
        payee_id: user_id, 
        country_code: country || 'UNKNOWN', 
        customer_email: customer_email || null,
        metadata: metadata || {},
        payment_method: 'PENDING', 
        fee_amount: 0, 
        net_amount: 0 
      } 
    });
    
    res.status(201).json({ data: { id: tx.id, shareable_url: "https://api-dev.nexflowx.tech/checkout/" + tx.id } });
  } catch (e: any) { 
    console.error(e);
    res.status(500).json({ error: "Erro ao gerar link de pagamento" }); 
  }
});`;

if (oldRouteRegex.test(code)) {
  code = code.replace(oldRouteRegex, newRoute);
  fs.writeFileSync(serverPath, code);
  console.log("✅ Rota /api/v1/payment-links atualizada no server.ts!");
} else {
  console.log("⚠️ A rota já estava atualizada ou não foi encontrada.");
}
