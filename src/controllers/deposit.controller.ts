import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { PaymentOrchestrator } from '../services/orchestrator.service';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class DepositController {
  
  static async requestDeposit(req: Request, res: Response) {
    try {
      const user_id = (req as any).user.id;
      const { amount, currency, network, customer_email, country, metadata } = req.body;
      const amountNum = Number(amount);

      if (!amount || !currency) return res.status(400).json({ error: "Amount e Currency são obrigatórios." });

      const txId = `dep_${crypto.randomBytes(8).toString('hex')}`;

      // Grava tudo na DB!
      const transaction = await prisma.transaction.create({
        data: {
          id: txId,
          amount: amountNum,
          currency: currency.toUpperCase(),
          status: 'pending',
          provider_name: 'routing...',
          payment_method: 'pending',
          payee_id: user_id,
          country_code: country || 'UNKNOWN',
          customer_email: customer_email || null,
          metadata: metadata || {},
          fee_amount: 0,
          net_amount: amountNum
        }
      });

      const user = await prisma.user.findUnique({ where: { id: user_id } });

      let responsePayload: any = { transaction_id: txId, currency, amount };

      switch (currency.toUpperCase()) {
        case 'BRL':
          const pixProvider = PaymentOrchestrator.getProviderForBRL('mistic');
          await prisma.transaction.update({ where: { id: txId }, data: { provider_name: pixProvider.providerName, payment_method: 'PIX' } });
          const pixData = await pixProvider.createPixPayment(amountNum, txId, { name: customer_email, document: '00000000000' });
          responsePayload.type = 'QR_CODE'; responsePayload.provider_data = pixData;
          break;
        case 'EUR':
          await prisma.transaction.update({ where: { id: txId }, data: { provider_name: 'internal_bank', payment_method: 'IBAN' } });
          responsePayload.type = 'BANK_TRANSFER';
          responsePayload.provider_data = { iban: 'PT50 0000 0000 1234 5678 9012 3', bic_swift: 'NEXFPTPL', bank_name: 'NeXFlowX Standard Bank', reference: txId.toUpperCase() };
          break;
        case 'USDT':
        case 'BTC':
          await prisma.transaction.update({ where: { id: txId }, data: { provider_name: 'nowpayments', payment_method: 'CRYPTO' } });
          responsePayload.type = 'CRYPTO_ADDRESS';
          responsePayload.provider_data = { address: '0x1234567890abcdef1234567890abcdef12345678', network: network || 'ERC20', warning: `Envie exatamente ${amountNum} ${currency}.` };
          break;
        default:
          return res.status(400).json({ error: "Moeda não suportada." });
      }

      res.status(201).json({ success: true, data: responsePayload });
    } catch (e: any) { res.status(500).json({ error: e.message || "Erro interno" }); }
  }
}
