const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function run() {
  console.log("🔄 A atualizar o Merchant Code da SumUp...");
  
  const userId = 'cmngnjdcn0000a8an74ymrz55'; // O ID do XDeals

  try {
    await prisma.gatewayConfig.update({
      where: { 
        user_id_provider_name: { 
          user_id: userId, 
          provider_name: 'sumup' 
        } 
      },
      data: { 
        merchant_id: 'M4YYDCJQ' 
      }
    });
    console.log("✅ Merchant Code atualizado com sucesso para M4YYDCJQ (NeX-Systems)!");
  } catch(e) {
    console.error("❌ Erro ao atualizar:", e.message);
  }
}

run().finally(() => prisma.$disconnect());
