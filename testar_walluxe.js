const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function testar() {
  // 1. Pega no primeiro utilizador do teu sistema (o merchant)
  const user = await prisma.user.findFirst();
  if (!user) return console.log("Nenhum utilizador encontrado.");

  // 2. Cria autorização temporária para o teste
  const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET || 'nexflowx-dev-sandbox-2026');

  console.log("🛒 A Walluxe está a pedir um link de pagamento à NeXFlowX...");
  
  // 3. A Chamada API (Exatamente como a loja vai fazer)
  const res = await fetch('http://localhost:8080/api/v1/payment-links', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      amount: 120.50,
      currency: "EUR",
      metadata: {
        order_id: "WLX-2026-001",
        customer_name: "Cliente Teste",
        items: [
          { name: "Casaco de Lã Walluxe", quantity: 1, price: 120.50 }
        ]
      }
    })
  });

  const data = await res.json();
  
  console.log("\n✅ RESPOSTA DA TUA API (O que a Walluxe recebe):");
  console.log(data);
  
  if (data.data && data.data.shareable_url) {
    console.log("\n🔗 LINK PARA O CLIENTE FINAL PAGAR:");
    console.log(data.data.shareable_url);
  }
}

testar().finally(() => prisma.$disconnect());
