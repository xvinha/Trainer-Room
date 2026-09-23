import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, or, isNull, like } from 'drizzle-orm';
import { db, schema } from '../db';
import { authMiddleware, requireRole, requireTenant } from '../middleware/auth';
import { generateStudentId, formatStudentId } from '../utils/studentId';
import { hashPassword } from '../db/seed';

const router = Router();

const registerSchema = z.object({
  tenantSlug: z.string().min(3).max(50),
  name: z.string().min(2).max(150),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  password: z.string().min(8),
  birthDate: z.string().optional().nullable(),
  gender: z.enum(['M', 'F', 'O']).optional().nullable(),
  heightCm: z.coerce.number().int().positive().optional().nullable(),
});

const approveStudentSchema = z.object({
  studentId: z.string().min(4).max(20),
});

const updateStudentSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  birthDate: z.string().optional().nullable(),
  gender: z.enum(['M', 'F', 'O']).optional().nullable(),
  heightCm: z.coerce.number().int().positive().optional().nullable(),
  password: z.string().min(6).optional(),
  isApproved: z.boolean().optional(),
});

async function generateUniqueStudentId(tenantId: string, attempts = 5): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const id = generateStudentId();
    const exists = await db.query.students.findFirst({
      where: and(eq(schema.students.tenantId, tenantId), eq(schema.students.studentId, id)),
    });
    if (!exists) return id;
  }
  const fallback = generateStudentId() + generateStudentId().slice(0, 2);
  return fallback;
}

router.post('/register', async (req: Request, res: Response) => {
  const body = registerSchema.parse(req.body);

  const tenant = await db.query.tenants.findFirst({
    where: and(eq(schema.tenants.slug, body.tenantSlug), eq(schema.tenants.isActive, true)),
  });
  if (!tenant) {
    return res.status(404).json({ success: false, error: 'Página do Personal não encontrada' });
  }

  const studentId = await generateUniqueStudentId(tenant.id);
  const passwordHash = await hashPassword(body.password);

  const result = await db.transaction(async (tx) => {
    const [user] = await tx.insert(schema.users).values({
      tenantId: tenant.id,
      role: 'STUDENT',
      name: body.name,
      email: body.email ? body.email.toLowerCase() : `temp-${studentId}@trainerroom.local`,
      passwordHash,
      phone: body.phone ?? null,
      isActive: true,
    }).returning();

    const [student] = await tx.insert(schema.students).values({
      tenantId: tenant.id,
      studentId,
      userId: user.id,
      name: body.name,
      email: body.email ? body.email.toLowerCase() : null,
      phone: body.phone ?? null,
      birthDate: body.birthDate ?? null,
      gender: body.gender ?? null,
      heightCm: body.heightCm ?? null,
      isApproved: false,
    }).returning();

    return { student, user };
  });

  return res.status(201).json({
    success: true,
    data: {
      studentId: result.student.studentId,
      formattedStudentId: formatStudentId(result.student.studentId),
      message: 'Cadastro realizado com sucesso! Envie seu ID para seu Personal Trainer aprovar.',
    },
  });
});

router.get('/by-id/:studentId', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const rawId = req.params.studentId.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const tenantId = req.auth!.tenantId!;

  const student = await db.query.students.findFirst({
    where: and(eq(schema.students.tenantId, tenantId), eq(schema.students.studentId, rawId)),
  });

  if (!student) {
    return res.status(404).json({ success: false, error: 'Aluno com este ID não encontrado' });
  }

  return res.json({ success: true, data: student });
});

router.get('/', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const status = req.query.status as string | undefined;
  const search = req.query.search as string | undefined;

  const where: any[] = [eq(schema.students.tenantId, tenantId)];
  if (status === 'pending') where.push(eq(schema.students.isApproved, false));
  if (status === 'approved') where.push(eq(schema.students.isApproved, true));
  if (search) where.push(like(schema.students.name, `%${search}%`));

  const students = await db.query.students.findMany({
    where: and(...where),
    orderBy: [desc(schema.students.isApproved ? schema.students.approvedAt : schema.students.createdAt)],
  });

  return res.json({ success: true, data: students });
});

router.get('/:studentId/detail', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const student = await db.query.students.findFirst({
    where: and(eq(schema.students.tenantId, tenantId), eq(schema.students.id, req.params.studentId)),
    with: { progress: { orderBy: desc(schema.studentProgress.measuredAt) } },
  });

  if (!student) return res.status(404).json({ success: false, error: 'Aluno não encontrado' });
  return res.json({ success: true, data: student });
});

router.get('/:studentId', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const student = await db.query.students.findFirst({
    where: and(eq(schema.students.tenantId, tenantId), eq(schema.students.id, req.params.studentId)),
  });

  if (!student) return res.status(404).json({ success: false, error: 'Aluno não encontrado' });

  const progress = await db.query.studentProgress.findMany({
    where: and(eq(schema.studentProgress.studentId, student.id), eq(schema.studentProgress.tenantId, tenantId)),
    orderBy: desc(schema.studentProgress.measuredAt),
    limit: 20,
  });

  let user: any = null;
  if (student.userId) {
    const rawUser = await db.query.users.findFirst({
      where: eq(schema.users.id, student.userId),
    });
    if (rawUser) {
      const { passwordHash, ...safeUser } = rawUser as any;
      user = safeUser;
    }
  }

  return res.json({ success: true, data: { student, user, progress } });
});

router.put('/:studentId', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const parsed = updateStudentSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      error: 'Dados inválidos',
      details: parsed.error.flatten().fieldErrors,
    });
  }
  const data = parsed.data;

  const student = await db.query.students.findFirst({
    where: and(eq(schema.students.tenantId, tenantId), eq(schema.students.id, req.params.studentId)),
  });
  if (!student) return res.status(404).json({ success: false, error: 'Aluno não encontrado' });

  if (data.email && data.email !== student.email) {
    const normalizedEmail = data.email.toLowerCase();
    const emailConflict = await db.query.students.findFirst({
      where: and(
        eq(schema.students.tenantId, tenantId),
        eq(schema.students.email, normalizedEmail),
      ),
    });
    if (emailConflict && emailConflict.id !== student.id) {
      return res.status(409).json({ success: false, error: 'E-mail já está em uso por outro aluno' });
    }
    if (student.userId) {
      const userEmailConflict = await db.query.users.findFirst({
        where: and(eq(schema.users.tenantId, tenantId), eq(schema.users.email, normalizedEmail)),
      });
      if (userEmailConflict && userEmailConflict.id !== student.userId) {
        return res.status(409).json({ success: false, error: 'E-mail já está em uso por outra conta' });
      }
    }
  }

  const result = await db.transaction(async (tx) => {
    const studentUpdates: Record<string, any> = {
      name: data.name ?? student.name,
      email: data.email !== undefined ? (data.email ? data.email.toLowerCase() : null) : student.email,
      phone: data.phone !== undefined ? data.phone : student.phone,
      birthDate: data.birthDate !== undefined ? data.birthDate : student.birthDate,
      gender: data.gender !== undefined ? data.gender : student.gender,
      heightCm: data.heightCm !== undefined ? data.heightCm : student.heightCm,
      isApproved: data.isApproved !== undefined ? data.isApproved : student.isApproved,
      updatedAt: new Date(),
    };
    if (data.isApproved === true && !student.isApproved) {
      studentUpdates.approvedAt = new Date();
      studentUpdates.approvedBy = req.auth!.userId;
    }

    const [updatedStudent] = await tx.update(schema.students)
      .set(studentUpdates)
      .where(eq(schema.students.id, student.id))
      .returning();

    let updatedUser = null;
    if (student.userId) {
      const currentUser = await tx.query.users.findFirst({
        where: eq(schema.users.id, student.userId!),
      });

      if (currentUser) {
        const userUpdates: Record<string, any> = {
          name: data.name ?? currentUser.name,
          email: data.email !== undefined
            ? (data.email ? data.email.toLowerCase() : currentUser.email)
            : currentUser.email,
          phone: data.phone !== undefined ? data.phone : currentUser.phone,
          updatedAt: new Date(),
        };
        if (data.password && data.password.length >= 6) {
          userUpdates.passwordHash = await hashPassword(data.password);
        }
        [updatedUser] = await tx.update(schema.users)
          .set(userUpdates)
          .where(eq(schema.users.id, student.userId!))
          .returning({
            id: schema.users.id,
            name: schema.users.name,
            email: schema.users.email,
            phone: schema.users.phone,
            role: schema.users.role,
            isActive: schema.users.isActive,
          });
      }
    }

    return { student: updatedStudent, user: updatedUser };
  });

  return res.json({
    success: true,
    data: result,
    message: 'Dados do aluno atualizados com sucesso',
  });
});

router.post('/approve', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const body = approveStudentSchema.parse(req.body);
  const rawId = body.studentId.toUpperCase().replace(/[^A-Z0-9]/g, '');
  const tenantId = req.auth!.tenantId!;
  const trainerId = req.auth!.userId;

  const student = await db.query.students.findFirst({
    where: and(eq(schema.students.tenantId, tenantId), eq(schema.students.studentId, rawId)),
  });

  if (!student) {
    return res.status(404).json({ success: false, error: 'ID de aluno não encontrado na sua carteira' });
  }

  if (student.isApproved) {
    return res.status(409).json({
      success: false,
      error: 'Este aluno já está aprovado',
      data: student,
    });
  }

  const [approved] = await db.update(schema.students)
    .set({
      isApproved: true,
      approvedAt: new Date(),
      approvedBy: trainerId,
      updatedAt: new Date(),
    })
    .where(eq(schema.students.id, student.id))
    .returning();

  return res.json({
    success: true,
    data: approved,
    message: `Aluno ${approved.name} aprovado com sucesso!`,
  });
});

router.post('/:studentId/reject', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const student = await db.query.students.findFirst({
    where: and(eq(schema.students.tenantId, tenantId), eq(schema.students.id, req.params.studentId)),
  });
  if (!student) return res.status(404).json({ success: false, error: 'Aluno não encontrado' });

  await db.delete(schema.students).where(eq(schema.students.id, student.id));
  if (student.userId) {
    await db.delete(schema.users).where(eq(schema.users.id, student.userId));
  }
  return res.json({ success: true, message: 'Solicitação de cadastro rejeitada' });
});

router.get('/me/progress', authMiddleware, requireRole('STUDENT'), async (req: Request, res: Response) => {
  if (!req.auth?.studentId) return res.status(404).json({ success: false, error: 'Perfil de aluno não encontrado' });
  const progress = await db.query.studentProgress.findMany({
    where: eq(schema.studentProgress.studentId, req.auth.studentId),
    orderBy: desc(schema.studentProgress.measuredAt),
  });
  return res.json({ success: true, data: progress });
});

const createProgressSchema = z.object({
  weightKg: z.coerce.number().positive().optional().nullable(),
  bodyFatPct: z.coerce.number().min(0).max(100).optional().nullable(),
  chestCm: z.coerce.number().positive().optional().nullable(),
  waistCm: z.coerce.number().positive().optional().nullable(),
  hipCm: z.coerce.number().positive().optional().nullable(),
  armCm: z.coerce.number().positive().optional().nullable(),
  thighCm: z.coerce.number().positive().optional().nullable(),
  calfCm: z.coerce.number().positive().optional().nullable(),
  notes: z.string().optional().nullable(),
  measuredAt: z.string().optional(),
});

router.post('/me/progress', authMiddleware, requireRole('STUDENT'), async (req: Request, res: Response) => {
  if (!req.auth?.studentId || !req.auth?.tenantId) {
    return res.status(404).json({ success: false, error: 'Perfil de aluno não encontrado' });
  }
  const body = createProgressSchema.parse(req.body);
  const [record] = await db.insert(schema.studentProgress).values({
    studentId: req.auth.studentId,
    tenantId: req.auth.tenantId,
    weightKg: body.weightKg ?? null,
    bodyFatPct: body.bodyFatPct ?? null,
    chestCm: body.chestCm ?? null,
    waistCm: body.waistCm ?? null,
    hipCm: body.hipCm ?? null,
    armCm: body.armCm ?? null,
    thighCm: body.thighCm ?? null,
    calfCm: body.calfCm ?? null,
    notes: body.notes ?? null,
    measuredAt: body.measuredAt ?? new Date(),
  }).returning();

  return res.status(201).json({ success: true, data: record });
});

export const studentsRouter = router;
