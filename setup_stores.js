const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function setupStores() {
  try {
    const user = await prisma.user.findUnique({ where: { username: 'C.Euro2026' } });
    if (!user) return console.log('⚠️ Erro: Cliente C.Euro2026 não encontrado.');

    console.log('Criando lojas para o cliente C.Euro2026...');

    await prisma.store.create({
      data: {
        name: 'Walluxe', logo_url: 'https://walluxeuk.com/images/walluxe-logo-nome.png',
        primary_color: '#111111', accent_color: '#d4af37',
        webhook_url: 'https://walluxeuk.com/api/webhook.php', webhook_secret: 'nx_sec_9kL2p_Xv92_Rz8w_Kq', user_id: user.id
      }
    });
    console.log('✅ Loja Walluxe criada!');

    await prisma.store.create({
      data: { name: 'TEMU', logo_url: '', primary_color: '#FF6600', accent_color: '#111111', user_id: user.id }
    });
    console.log('✅ Loja TEMU criada!');

    await prisma.store.create({
      data: {
        name: 'Securfix', logo_url: 'https://securfix.pt/cdn/shop/files/logo_securfix_250x@2x.png',
        primary_color: '#111111', accent_color: '#00FF41', user_id: user.id
      }
    });
    console.log('✅ Loja Securfix criada!');

  } catch (error) {
    console.log('⚠️ Erro ao criar lojas:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}
setupStores();
