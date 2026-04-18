const fs = require('fs');
let content = fs.readFileSync('src/server.ts', 'utf8');

// 1. Adicionar a rota de Logout logo após a de Login
const logoutRoute = `
app.post('/api/v1/auth/logout', (req, res) => {
  res.json({ success: true, message: "Sessão encerrada no servidor" });
});`;

if (!content.includes('/auth/logout')) {
  content = content.replace("res.status(401).json({ error: \"Credenciais inválidas\" });\\n});", 
                             "res.status(401).json({ error: \"Credenciais inválidas\" });\\n});" + logoutRoute);
}

// 2. Adicionar uma rota de diagnóstico para conferência
const debugRoute = `
app.get('/api/v1/debug/me', authenticateUser, (req, res) => {
  res.json({ who_am_i: (req as any).user });
});`;

if (!content.includes('/debug/me')) {
  content += debugRoute;
}

fs.writeFileSync('src/server.ts', content);
console.log("✅ server.ts atualizado com Logout e Rota de Debug.");
