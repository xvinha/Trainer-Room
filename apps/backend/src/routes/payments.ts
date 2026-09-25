import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, gte, lte, or, isNull, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { authMiddleware, requireRole, requireTenant } from '../middleware/auth';

const router = Router();

export const PAYMENT_STATUS = ['PENDING', 'PAID', 'LATE', 'CANCELED'] as const;
export type PaymentStatus = typeof PAYMENT_STATUS[number];

export const PAYMENT_METHODS = ['PIX', 'BOLETO', 'CREDIT_CARD', 'DEBIT_CARD', 'TRANSFER', 'CASH', 'OTHER'] as const;

const createPaymentSchema = z.object({
  studentId: z.string().uuid(),
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Mês de referência no formato YYYY-MM'),
  dueDate: z.string().min(1),
  amountBrl: z.coerce.number().gte(0),
  status: z.enum(PAYMENT_STATUS).default('PENDING'),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
  notes: z.string().optional().nullable(),
});

const updatePaymentSchema = z.object({
  referenceMonth: z.string().regex(/^\d{4}-\d{2}$/).optional(),
  dueDate: z.string().min(1).optional(),
  amountBrl: z.coerce.number().gte(0).optional(),
  status: z.enum(PAYMENT_STATUS).optional(),
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
  paidAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const markPaidSchema = z.object({
  paymentMethod: z.enum(PAYMENT_METHODS).optional().nullable(),
  paidAt: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

const setPlanSchema = z.object({
  studentId: z.string().uuid(),
  planMonthlyValue: z.coerce.number().positive().optional().nullable(),
  planDueDay: z.coerce.number().int().min(1).max(28).optional().nullable(),
  planStatus: z.enum(['INACTIVE', 'ACTIVE', 'SUSPENDED'] as const).optional(),
});

function addMonths(dateStr: string, months: number) {
  const d = new Date(dateStr);
  d.setMonth(d.getMonth() + months);
  return d.toISOString().slice(0, 10);
}

function buildDueDate(dueDay: number, refYYYYMM: string) {
  const [y, m] = refYYYYMM.split('-').map(Number);
  const day = Math.min(dueDay, new Date(y, m, 0).getDate());
  return `${refYYYYMM}-${String(day).padStart(2, '0')}`;
}

function computeLateStatus(status: PaymentStatus, dueDate: string | Date): PaymentStatus {
  if (status === 'PAID' || status === 'CANCELED') return status;
  const due = typeof dueDate === 'string' ? new Date(dueDate + 'T23:59:59') : dueDate;
  return due.getTime() < Date.now() - (23 * 3600 * 1000) ? 'LATE' : 'PENDING';
}

router.get('/', authMiddleware, requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const { status, studentId, fromDue, toDue } = req.query;

  const where: any[] = [eq(schema.payments.tenantId, tenantId)];
  if (studentId) where.push(eq(schema.payments.studentId, String(studentId)));
  if (status) where.push(eq(schema.payments.status, String(status)));
  if (fromDue) where.push(gte(schema.payments.dueDate, String(fromDue)));
  if (toDue) where.push(lte(schema.payments.dueDate, String(toDue)));

  const list = await db.select().from(schema.payments)
    .where(and(...where))
    .orderBy(desc(schema.payments.dueDate));

  const normalized = list.map((p) => ({ ...p, status: computeLateStatus(p.status as any, p.dueDate) }));
  return res.json({ success: true, data: normalized });
});

router.get('/summary', authMiddleware, requireRole('TRAINER'), requireTenant, async (_req: Request, res: Response) => {
  const tenantId = _req.auth!.tenantId!;
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const next30 = new Date(today.getTime() + 30 * 86400000).toISOString().slice(0, 10);

  const all = await db.select({
    id: schema.payments.id,
    status: schema.payments.status,
    dueDate: schema.payments.dueDate,
    amountBrl: schema.payments.amountBrl,
    referenceMonth: schema.payments.referenceMonth,
  }).from(schema.payments).where(eq(schema.payments.tenantId, tenantId));

  let pendingCount = 0, pendingSum = 0;
  let upcomingCount = 0, upcomingSum = 0;
  let lateCount = 0, lateSum = 0;
  let paidMonthCount = 0, paidMonthSum = 0;

  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

  for (const p of all) {
    const st = computeLateStatus(p.status as any, p.dueDate);
    const amnt = Number(p.amountBrl || 0);
    if (st === 'LATE') { lateCount++; lateSum += amnt; }
    else if (st === 'PENDING') {
      pendingCount++; pendingSum += amnt;
      if (String(p.dueDate) >= todayStr && String(p.dueDate) <= next30) { upcomingCount++; upcomingSum += amnt; }
    } else if (st === 'PAID' && String(p.referenceMonth) === currentMonth) {
      paidMonthCount++; paidMonthSum += amnt;
    }
  }

  return res.json({
    success: true,
    data: {
      pendingCount, pendingSum,
      upcomingCount, upcomingSum,
      lateCount, lateSum,
      paidMonthCount, paidMonthSum,
    },
  });
});

router.post('/', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const trainerId = req.auth!.userId;
  const body = createPaymentSchema.parse(req.body);

  const sRows = await db.select().from(schema.students)
    .where(and(eq(schema.students.id, body.studentId), eq(schema.students.tenantId, tenantId)))
    .limit(1);
  const student = sRows[0];
  if (!student) return res.status(404).json({ success: false, error: 'Aluno não encontrado' });

  const status = computeLateStatus(body.status, body.dueDate);

  const [created] = await db.insert(schema.payments).values({
    tenantId,
    studentId: body.studentId,
    referenceMonth: body.referenceMonth,
    dueDate: body.dueDate,
    amountBrl: body.amountBrl,
    status,
    paymentMethod: body.paymentMethod ?? null,
    notes: body.notes ?? null,
    paidAt: status === 'PAID' ? new Date() : null,
    paidBy: status === 'PAID' ? trainerId : null,
  }).returning();

  return res.status(201).json({ success: true, data: { ...created, status } });
});

router.post('/generate-monthly', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const trainerId = req.auth!.userId;
  const { studentId, referenceMonth, amountBrl, planDueDay } = z.object({
    studentId: z.string().uuid(),
    referenceMonth: z.string().regex(/^\d{4}-\d{2}$/),
    amountBrl: z.coerce.number().positive().optional(),
    planDueDay: z.coerce.number().int().min(1).max(28).optional(),
  }).parse(req.body);

  const sRows = await db.select().from(schema.students)
    .where(and(eq(schema.students.id, studentId), eq(schema.students.tenantId, tenantId)))
    .limit(1);
  const student = sRows[0];
  if (!student) return res.status(404).json({ success: false, error: 'Aluno não encontrado' });

  const value = Number(amountBrl ?? student.planMonthlyValue);
  const day = Number(planDueDay ?? student.planDueDay);
  if (!value || value <= 0) return res.status(400).json({ success: false, error: 'Informe o valor mensal do plano primeiro' });
  if (!day || day < 1) return res.status(400).json({ success: false, error: 'Informe o dia de vencimento do plano primeiro' });

  const dueDate = buildDueDate(day, referenceMonth);

  try {
    const [created] = await db.insert(schema.payments).values({
      tenantId,
      studentId,
      referenceMonth,
      dueDate,
      amountBrl: value,
      status: computeLateStatus('PENDING', dueDate),
    }).onConflictDoNothing().returning();

    if (!created) {
      const exRows = await db.select().from(schema.payments)
        .where(and(eq(schema.payments.studentId, studentId), eq(schema.payments.referenceMonth, referenceMonth)))
        .limit(1);
      const existing = exRows[0];
      return res.status(409).json({ success: false, error: 'Já existe um pagamento para esse mês', data: existing });
    }

    return res.status(201).json({ success: true, data: created });
  } catch (e: any) {
    return res.status(409).json({ success: false, error: e?.message || 'Erro ao gerar mensalidade' });
  }
});

router.put('/:id', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const trainerId = req.auth!.userId;
  const body = updatePaymentSchema.parse(req.body);

  const pRows = await db.select().from(schema.payments)
    .where(and(eq(schema.payments.id, req.params.id), eq(schema.payments.tenantId, tenantId)))
    .limit(1);
  const payment = pRows[0];
  if (!payment) return res.status(404).json({ success: false, error: 'Pagamento não encontrado' });

  let nextStatus = payment.status as PaymentStatus;
  if (body.status) nextStatus = body.status;
  else if (body.dueDate) nextStatus = computeLateStatus(nextStatus, body.dueDate);
  else nextStatus = computeLateStatus(nextStatus, payment.dueDate);

  const [updated] = await db.update(schema.payments)
    .set({
      ...(body.referenceMonth ? { referenceMonth: body.referenceMonth } : {}),
      ...(body.dueDate ? { dueDate: body.dueDate } : {}),
      ...(body.amountBrl ? { amountBrl: body.amountBrl } : {}),
      status: nextStatus,
      ...(body.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod ?? null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      paidAt: nextStatus === 'PAID' ? (body.paidAt ? new Date(body.paidAt) : new Date()) : (nextStatus !== 'PAID' ? null : payment.paidAt),
      paidBy: nextStatus === 'PAID' ? trainerId : (nextStatus !== 'PAID' ? null : payment.paidBy),
      updatedAt: new Date(),
    })
    .where(eq(schema.payments.id, payment.id))
    .returning();

  return res.json({ success: true, data: { ...updated, status: nextStatus } });
});

router.post('/:id/mark-paid', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const trainerId = req.auth!.userId;
  const body = markPaidSchema.parse(req.body);
  const pRows = await db.select().from(schema.payments)
    .where(and(eq(schema.payments.id, req.params.id), eq(schema.payments.tenantId, tenantId)))
    .limit(1);
  const payment = pRows[0];
  if (!payment) return res.status(404).json({ success: false, error: 'Pagamento não encontrado' });

  const [updated] = await db.update(schema.payments)
    .set({
      status: 'PAID',
      paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
      paidBy: trainerId,
      ...(body.paymentMethod !== undefined ? { paymentMethod: body.paymentMethod ?? null } : {}),
      ...(body.notes !== undefined ? { notes: body.notes ?? null } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.payments.id, payment.id))
    .returning();

  return res.json({ success: true, data: updated });
});

router.post('/:id/mark-pending', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const pRows = await db.select().from(schema.payments)
    .where(and(eq(schema.payments.id, req.params.id), eq(schema.payments.tenantId, tenantId)))
    .limit(1);
  const payment = pRows[0];
  if (!payment) return res.status(404).json({ success: false, error: 'Pagamento não encontrado' });

  const status = computeLateStatus('PENDING', payment.dueDate);
  const [updated] = await db.update(schema.payments)
    .set({ status, paidAt: null, paidBy: null, updatedAt: new Date() })
    .where(eq(schema.payments.id, payment.id))
    .returning();

  return res.json({ success: true, data: { ...updated, status } });
});

router.delete('/:id', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const pRows = await db.select().from(schema.payments)
    .where(and(eq(schema.payments.id, req.params.id), eq(schema.payments.tenantId, tenantId)))
    .limit(1);
  const payment = pRows[0];
  if (!payment) return res.status(404).json({ success: false, error: 'Pagamento não encontrado' });
  await db.delete(schema.payments).where(eq(schema.payments.id, payment.id));
  return res.json({ success: true, message: 'Pagamento excluído' });
});

router.post('/set-plan', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const body = setPlanSchema.parse(req.body);
  const sRows = await db.select().from(schema.students)
    .where(and(eq(schema.students.id, body.studentId), eq(schema.students.tenantId, tenantId)))
    .limit(1);
  const student = sRows[0];
  if (!student) return res.status(404).json({ success: false, error: 'Aluno não encontrado' });

  const [updated] = await db.update(schema.students)
    .set({
      ...(body.planMonthlyValue !== undefined ? { planMonthlyValue: body.planMonthlyValue ?? null } : {}),
      ...(body.planDueDay !== undefined ? { planDueDay: body.planDueDay ?? null } : {}),
      ...(body.planStatus ? { planStatus: body.planStatus } : {}),
      updatedAt: new Date(),
    })
    .where(eq(schema.students.id, student.id))
    .returning();

  return res.json({ success: true, data: updated });
});

export const paymentsRouter = router;
