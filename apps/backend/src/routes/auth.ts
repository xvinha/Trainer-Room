import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { db, schema } from '../db';
import { makeAuthResponse } from '../utils/auth';
import { authMiddleware } from '../middleware/auth';
import { verifyPassword } from '../db/seed';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

router.post('/login', async (req: Request, res: Response) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, error: 'Dados inválidos' });
  }
  const { email, password } = parsed.data;
  const emailLower = email.toLowerCase();

  if (process.env.NODE_ENV !== 'production') {
    console.log('[AUTH] Tentativa de login:', emailLower);
  }

  const user = await db.query.users.findFirst({
    where: eq(schema.users.email, emailLower),
  });

  if (!user) {
    console.log('[AUTH] Usuário não encontrado:', emailLower);
    return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
  }

  if (!user.isActive) {
    return res.status(403).json({ success: false, error: 'Conta desativada' });
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    console.log('[AUTH] Senha incorreta para:', emailLower);
    return res.status(401).json({ success: false, error: 'Credenciais inválidas' });
  }

  const tenant = user.tenantId
    ? await db.query.tenants.findFirst({ where: eq(schema.tenants.id, user.tenantId) })
    : undefined;

  const student = user.role === 'STUDENT'
    ? await db.query.students.findFirst({ where: eq(schema.students.userId, user.id) })
    : undefined;

  if (student && !student.isApproved) {
    return res.status(403).json({
      success: false,
      error: 'Cadastro pendente de aprovação pelo Personal Trainer',
      pendingApproval: true,
      studentId: student.studentId,
    });
  }

  const auth = makeAuthResponse(user, tenant ?? undefined, student ?? undefined);
  return res.json({ success: true, data: auth });
});

router.get('/me', authMiddleware, async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json({ success: false, error: 'Não autenticado' });

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, req.auth.userId),
  });
  if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

  const tenant = user.tenantId
    ? await db.query.tenants.findFirst({ where: eq(schema.tenants.id, user.tenantId) })
    : undefined;

  const student = user.role === 'STUDENT'
    ? await db.query.students.findFirst({ where: eq(schema.students.userId, user.id) })
    : undefined;

  const auth = makeAuthResponse(user, tenant, student);
  return res.json({ success: true, data: auth });
});

export const authRouter = router;
