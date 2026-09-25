import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { db, schema } from '../db';
import { authMiddleware, requireRole } from '../middleware/auth';
import { hashPassword } from '../db/seed';

const router = Router();

const createTenantSchema = z.object({
  slug: z.string().min(3).max(50).regex(/^[a-z0-9-]+$/),
  name: z.string().min(2).max(100),
  logoUrl: z.string().url().optional().nullable(),
  trainerEmail: z.string().email(),
  trainerName: z.string().min(2),
  trainerPassword: z.string().min(6).optional(),
  trainerPhone: z.string().optional().nullable(),
});

const updateTenantSchema = createTenantSchema.partial().extend({
  trainerPassword: z.string().min(6).optional().nullable(),
});

router.get('/', authMiddleware, requireRole('MASTER_ADMIN'), async (_req: Request, res: Response) => {
  const tenants = await db.query.tenants.findMany({
    orderBy: desc(schema.tenants.createdAt),
  });
  return res.json({ success: true, data: tenants });
});

router.get('/:tenantId', authMiddleware, requireRole('MASTER_ADMIN'), async (req: Request, res: Response) => {
  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, req.params.tenantId),
  });
  if (!tenant) return res.status(404).json({ success: false, error: 'Tenant não encontrado' });

  const trainer = await db.query.users.findFirst({
    where: and(eq(schema.users.tenantId, tenant.id), eq(schema.users.role, 'TRAINER')),
    columns: { passwordHash: false },
  });

  return res.json({
    success: true,
    data: {
      tenant,
      trainer,
    },
  });
});

router.get('/slug/:slug', async (req: Request, res: Response) => {
  const tenant = await db.query.tenants.findFirst({
    where: and(eq(schema.tenants.slug, req.params.slug), eq(schema.tenants.isActive, true)),
  });
  if (!tenant) return res.status(404).json({ success: false, error: 'Página não encontrada' });
  const { primaryColor, secondaryColor, accentColor, backgroundColor, logoUrl, name } = tenant;
  return res.json({
    success: true,
    data: {
      slug: tenant.slug,
      name,
      logoUrl,
      primaryColor,
      secondaryColor,
      accentColor,
      backgroundColor,
    },
  });
});

router.post('/', authMiddleware, requireRole('MASTER_ADMIN'), async (req: Request, res: Response) => {
  const body = createTenantSchema.parse(req.body);

  const existing = await db.query.tenants.findFirst({
    where: eq(schema.tenants.slug, body.slug),
  });
  if (existing) {
    return res.status(409).json({ success: false, error: 'Slug já está em uso' });
  }

  const existingEmail = await db.query.users.findFirst({
    where: eq(schema.users.email, body.trainerEmail.toLowerCase()),
  });
  if (existingEmail) {
    return res.status(409).json({ success: false, error: 'E-mail já cadastrado' });
  }

  const result = await db.transaction(async (tx) => {
    const [tenant] = await tx.insert(schema.tenants).values({
      slug: body.slug,
      name: body.name,
      logoUrl: body.logoUrl ?? null,
      primaryColor: '#0F3D36',
      secondaryColor: '#0B2E29',
      accentColor: '#C3F230',
      backgroundColor: '#FCFDF8',
    }).returning();

    const passwordHash = await hashPassword(body.trainerPassword || 'personal123');
    const [trainer] = await tx.insert(schema.users).values({
      tenantId: tenant.id,
      role: 'TRAINER',
      name: body.trainerName,
      email: body.trainerEmail.toLowerCase(),
      passwordHash,
      phone: body.trainerPhone ?? null,
    }).returning();

    return { tenant, trainer };
  });

  return res.status(201).json({ success: true, data: result });
});

router.put('/:tenantId', authMiddleware, requireRole('MASTER_ADMIN'), async (req: Request, res: Response) => {
  const body = updateTenantSchema.safeParse(req.body);
  if (!body.success) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: body.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    });
  }
  const data = body.data;

  const tenant = await db.query.tenants.findFirst({
    where: eq(schema.tenants.id, req.params.tenantId),
  });
  if (!tenant) return res.status(404).json({ success: false, error: 'Tenant não encontrado' });

  if (data.slug && data.slug !== tenant.slug) {
    const existing = await db.query.tenants.findFirst({ where: eq(schema.tenants.slug, data.slug) });
    if (existing) return res.status(409).json({ success: false, error: 'Slug já está em uso' });
  }

  const trainer = await db.query.users.findFirst({
    where: and(eq(schema.users.tenantId, tenant.id), eq(schema.users.role, 'TRAINER')),
  });
  if (!trainer) return res.status(404).json({ success: false, error: 'Personal Trainer não encontrado neste tenant' });

  if (data.trainerEmail && data.trainerEmail.toLowerCase() !== trainer.email.toLowerCase()) {
    const existingEmail = await db.query.users.findFirst({
      where: eq(schema.users.email, data.trainerEmail.toLowerCase()),
    });
    if (existingEmail) return res.status(409).json({ success: false, error: 'E-mail já cadastrado em outro usuário' });
  }

  const result = await db.transaction(async (tx) => {
    const [updatedTenant] = await tx.update(schema.tenants)
      .set({
        slug: data.slug ?? tenant.slug,
        name: data.name ?? tenant.name,
        logoUrl: data.logoUrl !== undefined ? data.logoUrl : tenant.logoUrl,
        updatedAt: new Date(),
      })
      .where(eq(schema.tenants.id, tenant.id))
      .returning();

    const trainerUpdates: Record<string, any> = {
      name: data.trainerName ?? trainer.name,
      email: data.trainerEmail ? data.trainerEmail.toLowerCase() : trainer.email,
      phone: data.trainerPhone !== undefined ? data.trainerPhone : trainer.phone,
      updatedAt: new Date(),
    };
    if (data.trainerPassword && data.trainerPassword.length >= 6) {
      trainerUpdates.passwordHash = await hashPassword(data.trainerPassword);
    }
    const [updatedTrainer] = await tx.update(schema.users)
      .set(trainerUpdates)
      .where(eq(schema.users.id, trainer.id))
      .returning();

    const { passwordHash: _ph, ...trainerWithoutPass } = updatedTrainer;
    return { tenant: updatedTenant, trainer: trainerWithoutPass };
  });

  return res.json({ success: true, data: result });
});

export const tenantsRouter = router;
