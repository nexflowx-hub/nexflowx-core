const fs = require('fs');

const schemaPath = 'prisma/schema.prisma';
let schema = fs.readFileSync(schemaPath, 'utf8');

if (!schema.includes('metadata          Json?')) {
  // Procura o customer_email e adiciona o metadata na linha seguinte
  schema = schema.replace(
    /customer_email\s+String\?/g,
    'customer_email          String?\n  metadata                Json?'
  );
  fs.writeFileSync(schemaPath, schema);
  console.log("✅ Coluna 'metadata' adicionada ao schema.prisma!");
} else {
  console.log("⚠️ A coluna 'metadata' já existia.");
}
