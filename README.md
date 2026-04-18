# 💠 NeXFlow-Core v2.4.5

> **Orquestrador de Capital Logístico Multi-Provider.**
> Motor de alta performance para gestão de fluxo de caixa em 5 estágios, integração White-Label e roteamento inteligente (Stripe/Viva Wallet).

---

## 📑 1. Dossier Técnico (Arquitetura)

O NeXFlow-Core não é um simples processador de pagamentos; é uma **Torre de Controlo Financeiro**. Ele isola a complexidade dos provedores (Gateways) e oferece uma visão unificada do "Pipeline de Capital".

### 🏗️ Stack Tecnológica
- **Runtime:** Node.js 20+ (TypeScript)
- **Engine:** Express.js
- **ORM:** Prisma (PostgreSQL / Supabase)
- **Infra:** Docker & Docker-Compose
- **Providers:** Stripe (Nativo/Embedded), Viva Wallet (Smart Checkout)

### 📈 O Pipeline de 5 Estágios (Logística de Capital)
O sistema ignora intenções de compra (`pending`) e apenas contabiliza dinheiro real nos seguintes estágios:
1. **Gateway Confirmed:** Capital capturado pelo provedor e confirmado via Webhook.
2. **Holding Provider:** Dinheiro retido no saldo do provedor, aguardando liquidação.
3. **FX In Transit:** Capital em processo de conversão ou transferência internacional.
4. **Inventory Wallet:** Dinheiro disponível na carteira de operações para compra de stock/serviços.
5. **Distributed:** Capital final liquidado e distribuído aos parceiros/nós.

---

## 💻 2. Contrato API: Frontend (Z.ai Dashboard)

Destinado ao consumo do Dashboard administrativo. Requer **Bearer Token (JWT)**.

| Endpoint | Método | Descrição |
| :--- | :--- | :--- |
| `/api/v1/auth/login` | `POST` | Autenticação Admin. Devolve JWT. |
| `/api/v1/pipeline` | `GET` | Resumo financeiro consolidado pelos 5 estágios. |
| `/api/v1/transactions` | `GET` | Listagem completa de fluxos com filtros de status. |
| `/api/v1/transactions/:id/status` | `PATCH` | Movimentação manual de capital entre estágios (Admin). |

---

## 📦 3. Contrato API: Merchant (Lojista)

Destinado à integração em lojas externas. Requer **X-API-KEY**.

### Geração de Pagamento
`POST /api/v1/payment-links`
**Payload:**
```json
{
  "amount": 15.50,
  "currency": "EUR",
  "description": "Sapatilhas XPTO",
  "ui_mode": "embedded" 
}
Resposta:

shareable_url: Link direto para o Smart Checkout NeXFlowX.

client_secret: Chave para renderização nativa (se modo embedded).

provider_used: O motor decide automaticamente (Stripe ou Viva).

NeXFlowX JS SDK
O lojista deve apenas importar:
<script src="https://api.nexflowx.tech/sdk.js"></script>

Uso:

JavaScript
const nex = NexFlowX('nx_live_key');
const pedido = await nex.checkout({ amount: 10, currency: 'EUR' });
pedido.mount('#div-do-site');
🛡️ 4. Segurança e Webhooks
O Core utiliza Webhooks Ativos para garantir a integridade dos dados.

Stripe: /api/v1/webhooks/stripe (Validação via Assinatura HMAC).

O sistema converte automaticamente eventos de checkout.session.completed em transações de Estágio 1 no Pipeline.

🚀 5. Instalação (DevOps)
Clonar repositório.

Configurar .env (Stripe Keys, Viva Keys, Database URL).

docker-compose up -d --build

npx prisma db push

© 2026 NeXFlowX Hub. Sistemas de Fluxo de Capital de Próxima Geração.
