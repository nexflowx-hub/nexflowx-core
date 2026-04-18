import { Router } from 'express';
import { TransactionController } from '../controllers/transaction.controller';
import { UserController } from '../controllers/user.controller';
import { ApiKeyController } from '../controllers/apikey.controller';
import { DepositController } from '../controllers/deposit.controller';
import { authenticateUser } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { swapSchema, payoutSchema } from '../validators/transaction.validator';

const router = Router();

// Rotas de Mutação Financeira
router.post('/swap', authenticateUser, validate(swapSchema), TransactionController.swap);
router.post('/payout', authenticateUser, validate(payoutSchema), TransactionController.payout);

// NOVO: Rota de Depósito Modular (A porta de entrada)
router.post('/deposits', authenticateUser, DepositController.requestDeposit);

// Rotas de Utilizador & Definições
router.get('/users/me', authenticateUser, UserController.getMe);
router.patch('/users/me', authenticateUser, UserController.updateMe);
router.post('/users/me/password', authenticateUser, UserController.updatePassword);

// Rotas do Developer Hub (API Keys)
router.get('/api-keys', authenticateUser, ApiKeyController.listKeys);
router.post('/api-keys', authenticateUser, ApiKeyController.createKey);
router.delete('/api-keys/:id', authenticateUser, ApiKeyController.revokeKey);

export default router;
