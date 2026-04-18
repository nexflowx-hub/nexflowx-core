import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const JWT_SECRET = process.env.JWT_SECRET || 'nexflowx-dev-sandbox-2026';

export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  const apiKey = req.headers['x-api-key'];

  if (apiKey) {
     const keyData = await prisma.apiKey.findUnique({ where: { key_hash: apiKey as string }, include: { user: true } });
     if (keyData) { (req as any).user = { id: keyData.user_id, role: keyData.user.role }; return next(); }
  }

  if (!authHeader) return res.status(401).json({ error: "Token em falta" });
  jwt.verify(authHeader.split(' ')[1], JWT_SECRET, (err: any, user: any) => {
    if (err) return res.status(403).json({ error: "Sessão expirada" });
    (req as any).user = user; next();
  });
};
