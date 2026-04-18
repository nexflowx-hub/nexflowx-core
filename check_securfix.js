const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  const store = await prisma.store.findFirst({
    where: { name: 'Securfix' },
    include: { gateways: true, user: true }
  });

  if (!store) {
    console.log("❌ Loja Securfix não encontrada.");
    return;
  }

  console.log("\n🏪 --- DADOS DA LOJA SECURFIX ---");
  console.log(`- ID da Loja: ${store.id}`);
  console.log(`- Cor Primária: ${store.primary_color}`);
  console.log(`- Webhook URL: ${store.webhook_url}`);
  console.log(`- Webhook Secret: ${store.webhook_secret}`);

  console.log("\n💳 --- GATEWAYS CONFIGURADOS ---");
  if (store.gateways.length === 0) {
    console.log("⚠️ NENHUM gateway associado diretamente a esta loja.");
    console.log("💡 (Se houver uma venda agora, a API vai tentar usar o Gateway da conta mãe: " + store.user.username + ")");
  } else {
    store.gateways.forEach(g => {
      console.log(`✅ Provedor: ${g.provider_name.toUpperCase()} | Ativo: ${g.is_active}`);
    });
  }
  console.log("\n");
  await prisma.$disconnect();
}
check();
