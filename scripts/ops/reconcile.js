const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function runReconciliation() {
  console.log('🔍 A INICIAR MOTOR DE RECONCILIAÇÃO INTERNA (ANTI-DRIFT)...\n');
  
  const wallets = await prisma.wallet.findMany({
    include: { user: true }
  });

  let driftFound = false;

  for (const wallet of wallets) {
    // Procura todas as entradas do Ledger para esta Wallet específica
    const entries = await prisma.ledgerEntry.findMany({
      where: { wallet_id: wallet.id },
      include: { ledger_transaction: true }
    });

    let expectedTotal = 0;
    let expectedAvailable = 0;

    // Recalcula o saldo do zero baseado exclusivamente no Livro-Razão
    for (const entry of entries) {
      const amount = Number(entry.amount);
      const isCleared = entry.ledger_transaction.status === 'cleared';

      if (entry.direction === 'CREDIT') {
        expectedTotal += amount;
        if (isCleared) expectedAvailable += amount; // Só aumenta o disponível se estiver liquidado
      } else if (entry.direction === 'DEBIT') {
        expectedTotal -= amount;
        expectedAvailable -= amount; // O débito (ex: saque pendente) reduz sempre o disponível de imediato
      }
    }

    // Arredondar para evitar problemas de limite de precisão do Javascript (Float)
    expectedTotal = Math.round(expectedTotal * 100000000) / 100000000;
    expectedAvailable = Math.round(expectedAvailable * 100000000) / 100000000;
    
    const actualTotal = Number(wallet.balance_total);
    const actualAvailable = Number(wallet.balance_available);

    const isTotalOk = expectedTotal === actualTotal;
    const isAvailOk = expectedAvailable === actualAvailable;

    if (!isTotalOk || !isAvailOk) {
      driftFound = true;
      console.log(`❌ ALARME DE DRIFT: Carteira [${wallet.type.toUpperCase()}] de ${wallet.user.username} (${wallet.currency_code})`);
      if (!isTotalOk) console.log(`   -> Total: Esperado ${expectedTotal}, mas a Wallet diz ${actualTotal}`);
      if (!isAvailOk) console.log(`   -> Disponível: Esperado ${expectedAvailable}, mas a Wallet diz ${actualAvailable}`);
    } else {
      console.log(`✅ OK: Carteira [${wallet.type.toUpperCase()}] de ${wallet.user.username} (${wallet.currency_code}) perfeitamente alinhada.`);
    }
  }

  console.log('\n================================================');
  if (driftFound) {
    console.log('🚨 AUDITORIA FALHOU: Foram detetadas inconsistências (Drift). Ação necessária!');
  } else {
    console.log('🛡️ AUDITORIA PASSOU: Todos os saldos batem certo com o Livro-Razão.');
  }
  console.log('================================================\n');
}

runReconciliation().finally(() => prisma.$disconnect());
