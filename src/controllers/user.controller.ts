// @ts-nocheck
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import crypto from 'crypto';

const prisma = new PrismaClient();

export class UserController {
  
  static async getMe(req: Request, res: Response) {
    try {
      const user_id = (req as any).user.id;
      const user = await prisma.user.findUnique({
        where: { id: user_id },
        select: { id: true, username: true, email: true, role: true, kyc_level: true, webhook_url: true, webhook_secret: true, notification_prefs: true }
      });
      res.json({ data: user });
    } catch (e: any) { res.status(500).json({ error: "Erro ao procurar perfil" }); }
  }

  static async updateMe(req: Request, res: Response) {
    try {
      const user_id = (req as any).user.id;
      const { email, webhook_url, notification_prefs } = req.body;
      
      // Busca o user para ver se já tem secret
      const currentUser = await prisma.user.findUnique({ where: { id: user_id } });
      
      // Se o utilizador envia um URL novo e não tem secret, nós geramos um HMAC-SHA256 na hora!
      let newSecret = currentUser?.webhook_secret;
      if (webhook_url && !newSecret) {
         newSecret = "whsec_" + crypto.randomBytes(32).toString('hex');
      }

      const updated = await prisma.user.update({
        where: { id: user_id },
        data: {
          ...(email !== undefined && { email }),
          ...(webhook_url !== undefined && { webhook_url }),
          ...(newSecret !== undefined && { webhook_secret: newSecret }),
          ...(notification_prefs !== undefined && { notification_prefs })
        },
        select: { id: true, email: true, webhook_url: true, webhook_secret: true, notification_prefs: true }
      });
      
      res.json({ success: true, data: updated, message: "Perfil atualizado com sucesso." });
    } catch (e: any) { res.status(500).json({ error: "Erro ao atualizar perfil" }); }
  }

  static async updatePassword(req: Request, res: Response) {
    try {
      const user_id = (req as any).user.id;
      const { old_password, new_password } = req.body;
      
      const user = await prisma.user.findUnique({ where: { id: user_id } });
      if (!user || user.password_hash !== old_password) {
        return res.status(400).json({ error: "Senha atual incorreta." });
      }

      await prisma.user.update({ where: { id: user_id }, data: { password_hash: new_password } });
      res.json({ success: true, message: "Senha alterada com sucesso." });
    } catch (e: any) { res.status(500).json({ error: "Erro ao alterar senha" }); }
  }
}
