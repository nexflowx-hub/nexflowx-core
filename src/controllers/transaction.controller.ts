// @ts-nocheck
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { LedgerService, LedgerEntryInput } from '../services/ledger.service';

const prisma = new PrismaClient();

export class TransactionController {
  
  static async swap(req: Request, res: Response) {
    const user_id = (req as any).user.id;
    const { amount, from_currency, to_currency } = req.body;
    
    try {
      const amountNum = Number(amount);
      const walletFrom = await prisma.wallet.findUnique({ where: { user_id_currency_code_type_provider: { user_id, currency_code: from_currency, type: 'merchant', provider: 'platform' } } });
      if (!walletFrom || Number(walletFrom.balance_available) < amountNum) return res.status(400).json({ error: "Saldo indisponível." });

      // FIX: Lógica Direcional Mock (Até ligarmos a Binance API na Fase 7)
      let rate = 1.0;
      if (from_currency === 'EUR' && to_currency === 'USDT') rate = 1.08; // 1 EUR compra 1.08 USDT
      else if (from_currency === 'USDT' && to_currency === 'EUR') rate = 0.92; // 1 USDT compra 0.92 EUR
      else if (from_currency === 'EUR' && to_currency === 'BRL') rate = 5.40;
      else if (from_currency === 'BRL' && to_currency === 'EUR') rate = 0.18;
      else rate = 1.0; // Mesma moeda ou não mapeada
      
      const spreadFee = 0.01; // 1% Fee
      const feeAmount = amountNum * spreadFee;
      const netAmount = amountNum - feeAmount;
      const toAmount = netAmount * rate;

      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      const walletTo = await prisma.wallet.upsert({ where: { user_id_currency_code_type_provider: { user_id, currency_code: to_currency, type: 'merchant', provider: 'platform' } }, update: {}, create: { user_id, currency_code: to_currency, type: 'merchant', provider: 'platform' } });
      const feeWallet = await prisma.wallet.upsert({ where: { user_id_currency_code_type_provider: { user_id: admin!.id, currency_code: from_currency, type: 'fee', provider: 'platform' } }, update: {}, create: { user_id: admin!.id, currency_code: from_currency, type: 'fee', provider: 'platform' } });
      const fxPoolFrom = await prisma.wallet.upsert({ where: { user_id_currency_code_type_provider: { user_id: admin!.id, currency_code: from_currency, type: 'fx_pool', provider: 'platform' } }, update: {}, create: { user_id: admin!.id, currency_code: from_currency, type: 'fx_pool', provider: 'platform' } });
      const fxPoolTo = await prisma.wallet.upsert({ where: { user_id_currency_code_type_provider: { user_id: admin!.id, currency_code: to_currency, type: 'fx_pool', provider: 'platform' } }, update: {}, create: { user_id: admin!.id, currency_code: to_currency, type: 'fx_pool', provider: 'platform' } });

      const entries: LedgerEntryInput[] = [
        { wallet_id: walletFrom.id, direction: 'DEBIT', amount: amountNum, currency_code: from_currency, _type: walletFrom.type },
        { wallet_id: feeWallet.id, direction: 'CREDIT', amount: feeAmount, currency_code: from_currency, _type: feeWallet.type },
        { wallet_id: fxPoolFrom.id, direction: 'CREDIT', amount: netAmount, currency_code: from_currency, _type: fxPoolFrom.type },
        { wallet_id: fxPoolTo.id, direction: 'DEBIT', amount: toAmount, currency_code: to_currency, _type: fxPoolTo.type },
        { wallet_id: walletTo.id, direction: 'CREDIT', amount: toAmount, currency_code: to_currency, _type: walletTo.type }
      ];

      await prisma.$transaction(async (tx) => {
        const swapRec = await tx.swap.create({ data: { user_id, from_currency, to_currency, from_amount: amountNum, to_amount: toAmount, exchange_rate: rate, spread_fee: feeAmount, status: 'completed' } });
        await LedgerService.commitTransaction('SWAP', 'cleared', swapRec.id, `Swap ${from_currency} to ${to_currency}`, entries, tx);
      });

      res.json({ success: true, message: "Câmbio efetuado!", converted: toAmount, fee: feeAmount });
    } catch (e: any) { res.status(500).json({ error: e.message || "Erro no motor de Swap" }); }
  }

  static async payout(req: Request, res: Response) {
    const user_id = (req as any).user.id;
    const { amount, currency, method, destination } = req.body;
    try {
      const amountNum = Number(amount);
      const walletFrom = await prisma.wallet.findUnique({ where: { user_id_currency_code_type_provider: { user_id, currency_code: currency, type: 'merchant', provider: 'platform' } } });
      if (!walletFrom || Number(walletFrom.balance_available) < amountNum) return res.status(400).json({ error: "Saldo indisponível." });

      const admin = await prisma.user.findFirst({ where: { role: 'admin' } });
      const treasuryWallet = await prisma.wallet.findFirst({ where: { user_id: admin!.id, currency_code: currency, type: 'treasury' } });
      if (!treasuryWallet) throw new Error("Tesouraria sem conta nesta moeda.");

      const entries: LedgerEntryInput[] = [
        { wallet_id: walletFrom.id, direction: 'DEBIT', amount: amountNum, currency_code: currency, _type: walletFrom.type },
        { wallet_id: treasuryWallet.id, direction: 'CREDIT', amount: amountNum, currency_code: currency, _type: treasuryWallet.type }
      ];

      await prisma.$transaction(async (tx) => {
        const payout = await tx.payout.create({ data: { user_id, amount: amountNum, currency_code: currency, method, destination, status: 'pending' } });
        const ledgerTx = await LedgerService.commitTransaction('PAYOUT', 'pending', payout.id, `Levantamento via ${method}`, entries, tx);
        await tx.actionTicket.create({ data: { type: 'PAYOUT_APPROVAL', priority: 'high', reference_id: ledgerTx.id, merchant_id: user_id, metadata: { payout_id: payout.id, amount, currency, destination, method } } });
      });

      res.json({ success: true, message: "Levantamento trancado. Ticket gerado." });
    } catch (e: any) { res.status(500).json({ error: e.message || "Erro ao processar Payout" }); }
  }
}
