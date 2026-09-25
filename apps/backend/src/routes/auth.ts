import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, isNull } from 'drizzle-orm';
import { db, schema } from '../db';
import { makeAuthResponse } from '../utils/auth';
import { authMiddleware } from '../middleware/auth';
import { verifyPassword, hashPassword } from '../db/seed';

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const updateProfileSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional().nullable(),
  currentPassword: z.string().optional(),
  newPassword: z.string().min(8).optional(),
}).refine((data) => {
  if (data.newPassword && !data.currentPassword) return false;
  return true;
}, {
  message: 'Para alterar a senha, informe a senha atual',
  path: ['currentPassword'],
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

router.put('/profile', authMiddleware, async (req: Request, res: Response) => {
  if (!req.auth) return res.status(401).json({ success: false, error: 'Não autenticado' });
  const parsed = updateProfileSchema.safeParse(req.body);
  if (!parsed.success) {
    const issues = parsed.error.issues;
    return res.status(400).json({
      success: false,
      error: issues[0]?.message || 'Dados inválidos',
      details: issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  const data = parsed.data;

  const user = await db.query.users.findFirst({
    where: eq(schema.users.id, req.auth.userId),
  });
  if (!user) return res.status(404).json({ success: false, error: 'Usuário não encontrado' });

  if (data.email && data.email.toLowerCase() !== user.email.toLowerCase()) {
    const existing = await db.query.users.findFirst({ where: eq(schema.users.email, data.email.toLowerCase()) });
    if (existing) return res.status(409).json({ success: false, error: 'E-mail já em uso por outra conta' });
  }

  if (data.newPassword) {
    if (!data.currentPassword) {
      return res.status(400).json({ success: false, error: 'Informe a senha atual para trocar de senha' });
    }
    const valid = await verifyPassword(data.currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, error: 'Senha atual incorreta' });
    }
  }

  const updates: Record<string, any> = {
    updatedAt: new Date(),
  };
  if (data.name) updates.name = data.name;
  if (data.email) updates.email = data.email.toLowerCase();
  if (data.phone !== undefined) updates.phone = data.phone ?? null;
  if (data.newPassword) updates.passwordHash = await hashPassword(data.newPassword);

  const [updated] = await db.update(schema.users)
    .set(updates)
    .where(eq(schema.users.id, user.id))
    .returning();

  if (data.name && user.role === 'STUDENT') {
    const student = await db.query.students.findFirst({ where: eq(schema.students.userId, user.id) });
    if (student) {
      await db.update(schema.students)
        .set({ name: data.name, updatedAt: new Date() })
        .where(eq(schema.students.id, student.id));
    }
  }
  if (data.email && user.role === 'STUDENT') {
    const student = await db.query.students.findFirst({ where: eq(schema.students.userId, user.id) });
    if (student) {
      await db.update(schema.students)
        .set({ email: data.email.toLowerCase(), updatedAt: new Date() })
        .where(eq(schema.students.id, student.id));
    }
  }
  if (data.phone !== undefined && user.role === 'STUDENT') {
    const student = await db.query.students.findFirst({ where: eq(schema.students.userId, user.id) });
    if (student) {
      await db.update(schema.students)
        .set({ phone: data.phone ?? null, updatedAt: new Date() })
        .where(eq(schema.students.id, student.id));
    }
  }

  const { passwordHash: _ph, ...userClean } = updated;
  return res.json({ success: true, data: { user: userClean } });
});

export const authRouter = router;
