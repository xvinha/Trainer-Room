import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { eq, and, desc, gte, lte, sql } from 'drizzle-orm';
import { db, schema } from '../db';
import { authMiddleware, requireRole, requireTenant } from '../middleware/auth';

const router = Router();

const exerciseSchema = z.object({
  name: z.string().min(1),
  muscleGroup: z.string().optional().nullable(),
  sets: z.coerce.number().int().min(1).default(3),
  reps: z.string().default('12'),
  restSeconds: z.coerce.number().int().min(0).optional().nullable(),
  loadKg: z.coerce.number().min(0).optional().nullable(),
  notes: z.string().optional().nullable(),
  orderIndex: z.coerce.number().int().default(0),
});

const createWorkoutSchema = z.object({
  studentId: z.string().uuid(),
  title: z.string().min(1).max(100),
  description: z.string().optional().nullable(),
  weekNumber: z.coerce.number().int().min(1).optional().nullable(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional().nullable(),
  scheduledDate: z.string().optional().nullable(),
  exercises: z.array(exerciseSchema).min(1),
});

const updateExerciseSchema = exerciseSchema.partial().extend({
  id: z.string().uuid().optional(),
});

const updateWorkoutSchema = z.object({
  title: z.string().min(1).max(100).optional(),
  description: z.string().optional().nullable(),
  weekNumber: z.coerce.number().int().min(1).optional().nullable(),
  dayOfWeek: z.coerce.number().int().min(0).max(6).optional().nullable(),
  scheduledDate: z.string().optional().nullable(),
  exercises: z.array(updateExerciseSchema).optional(),
});

router.post('/', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const body = createWorkoutSchema.parse(req.body);
  const tenantId = req.auth!.tenantId!;
  const trainerId = req.auth!.userId;

  const student = await db.query.students.findFirst({
    where: and(eq(schema.students.id, body.studentId), eq(schema.students.tenantId, tenantId)),
  });
  if (!student) return res.status(404).json({ success: false, error: 'Aluno não encontrado' });
  if (!student.isApproved) return res.status(403).json({ success: false, error: 'Aluno não aprovado' });

  const result = await db.transaction(async (tx) => {
    const [workout] = await tx.insert(schema.workouts).values({
      tenantId,
      studentId: body.studentId,
      trainerId,
      title: body.title,
      description: body.description ?? null,
      weekNumber: body.weekNumber ?? null,
      dayOfWeek: body.dayOfWeek ?? null,
      scheduledDate: body.scheduledDate ?? null,
    }).returning();

    const exercises = body.exercises.map((ex, idx) => ({
      workoutId: workout.id,
      name: ex.name,
      muscleGroup: ex.muscleGroup ?? null,
      sets: ex.sets,
      reps: ex.reps,
      restSeconds: ex.restSeconds ?? null,
      loadKg: ex.loadKg ?? null,
      notes: ex.notes ?? null,
      orderIndex: ex.orderIndex || idx,
    }));

    const createdExercises = await tx.insert(schema.workoutExercises).values(exercises).returning();
    return { workout, exercises: createdExercises };
  });

  return res.status(201).json({ success: true, data: result });
});

router.get('/student/:studentId', authMiddleware, async (req: Request, res: Response) => {
  const tenantId = req.auth?.tenantId;
  const role = req.auth?.role;

  const where: any[] = [eq(schema.workouts.studentId, req.params.studentId)];

  if (role !== 'MASTER_ADMIN' && tenantId) {
    where.push(eq(schema.workouts.tenantId, tenantId));
  }

  if (role === 'STUDENT' && req.auth?.studentId !== req.params.studentId) {
    return res.status(403).json({ success: false, error: 'Acesso negado' });
  }

  const workouts = await db.query.workouts.findMany({
    where: and(...where),
    orderBy: desc(schema.workouts.scheduledDate || schema.workouts.createdAt),
    with: { exercises: { orderBy: schema.workoutExercises.orderIndex } },
  });

  return res.json({ success: true, data: workouts });
});

router.get('/me', authMiddleware, requireRole('STUDENT'), async (req: Request, res: Response) => {
  if (!req.auth?.studentId) return res.status(404).json({ success: false, error: 'Perfil de aluno não encontrado' });

  const workouts = await db.query.workouts.findMany({
    where: eq(schema.workouts.studentId, req.auth.studentId),
    orderBy: desc(schema.workouts.scheduledDate || schema.workouts.createdAt),
    with: { exercises: { orderBy: schema.workoutExercises.orderIndex } },
    limit: 20,
  });

  return res.json({ success: true, data: workouts });
});

router.get('/:workoutId', authMiddleware, async (req: Request, res: Response) => {
  const workout = await db.query.workouts.findFirst({
    where: eq(schema.workouts.id, req.params.workoutId),
    with: { exercises: { orderBy: schema.workoutExercises.orderIndex } },
  });

  if (!workout) return res.status(404).json({ success: false, error: 'Treino não encontrado' });

  const tenantId = req.auth?.tenantId;
  const role = req.auth?.role;
  if (role !== 'MASTER_ADMIN' && tenantId && workout.tenantId !== tenantId) {
    return res.status(403).json({ success: false, error: 'Acesso negado' });
  }
  if (role === 'STUDENT' && req.auth?.studentId !== workout.studentId) {
    return res.status(403).json({ success: false, error: 'Acesso negado' });
  }

  return res.json({ success: true, data: workout });
});

router.put('/:workoutId', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const body = updateWorkoutSchema.parse(req.body);
  const tenantId = req.auth!.tenantId!;

  const workout = await db.query.workouts.findFirst({
    where: and(eq(schema.workouts.id, req.params.workoutId), eq(schema.workouts.tenantId, tenantId)),
  });
  if (!workout) return res.status(404).json({ success: false, error: 'Treino não encontrado' });

  const result = await db.transaction(async (tx) => {
    const [updated] = await tx.update(schema.workouts)
      .set({
        title: body.title ?? workout.title,
        description: body.description ?? workout.description,
        weekNumber: body.weekNumber ?? workout.weekNumber,
        dayOfWeek: body.dayOfWeek ?? workout.dayOfWeek,
        scheduledDate: body.scheduledDate ?? workout.scheduledDate,
        updatedAt: new Date(),
      })
      .where(eq(schema.workouts.id, workout.id))
      .returning();

    let exercises;
    if (body.exercises && body.exercises.length > 0) {
      await tx.delete(schema.workoutExercises).where(eq(schema.workoutExercises.workoutId, workout.id));
      const newEx = body.exercises.map((ex, idx) => ({
        workoutId: workout.id,
        name: ex.name!,
        muscleGroup: ex.muscleGroup ?? null,
        sets: ex.sets ?? 3,
        reps: ex.reps ?? '12',
        restSeconds: ex.restSeconds ?? null,
        loadKg: ex.loadKg ?? null,
        notes: ex.notes ?? null,
        orderIndex: ex.orderIndex ?? idx,
      }));
      exercises = await tx.insert(schema.workoutExercises).values(newEx).returning();
    }

    return { workout: updated, exercises };
  });

  return res.json({ success: true, data: result });
});

router.delete('/:workoutId', authMiddleware, requireRole('TRAINER'), requireTenant, async (req: Request, res: Response) => {
  const tenantId = req.auth!.tenantId!;
  const workout = await db.query.workouts.findFirst({
    where: and(eq(schema.workouts.id, req.params.workoutId), eq(schema.workouts.tenantId, tenantId)),
  });
  if (!workout) return res.status(404).json({ success: false, error: 'Treino não encontrado' });

  await db.delete(schema.workouts).where(eq(schema.workouts.id, workout.id));
  return res.json({ success: true, message: 'Treino excluído com sucesso' });
});

const toggleExerciseSchema = z.object({
  completedSets: z.coerce.number().int().min(0).optional(),
  isCompleted: z.boolean().optional(),
});

router.post('/:workoutId/exercise/:exerciseId/toggle', authMiddleware, requireRole('STUDENT'), async (req: Request, res: Response) => {
  const body = toggleExerciseSchema.parse(req.body);
  const studentId = req.auth!.studentId;
  if (!studentId) return res.status(403).json({ success: false, error: 'Perfil de aluno inválido' });

  const workout = await db.query.workouts.findFirst({
    where: eq(schema.workouts.id, req.params.workoutId),
  });
  if (!workout || workout.studentId !== studentId) {
    return res.status(403).json({ success: false, error: 'Acesso negado' });
  }

  const exercise = await db.query.workoutExercises.findFirst({
    where: and(eq(schema.workoutExercises.id, req.params.exerciseId), eq(schema.workoutExercises.workoutId, workout.id)),
  });
  if (!exercise) return res.status(404).json({ success: false, error: 'Exercício não encontrado' });

  const completedSets = body.completedSets ?? exercise.completedSets;
  const isCompleted = body.isCompleted ?? (completedSets >= exercise.sets);

  const [updated] = await db.update(schema.workoutExercises)
    .set({
      completedSets,
      isCompleted,
      completedAt: isCompleted ? new Date() : null,
    })
    .where(eq(schema.workoutExercises.id, exercise.id))
    .returning();

  return res.json({ success: true, data: updated });
});

router.post('/:workoutId/finish', authMiddleware, requireRole('STUDENT'), async (req: Request, res: Response) => {
  const studentId = req.auth!.studentId;
  if (!studentId) return res.status(403).json({ success: false, error: 'Perfil de aluno inválido' });

  const workout = await db.query.workouts.findFirst({
    where: eq(schema.workouts.id, req.params.workoutId),
    with: { exercises: true },
  });
  if (!workout || workout.studentId !== studentId) {
    return res.status(403).json({ success: false, error: 'Acesso negado' });
  }

  const [updated] = await db.update(schema.workouts)
    .set({
      isCompleted: true,
      completedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(schema.workouts.id, workout.id))
    .returning();

  return res.json({ success: true, data: updated, message: 'Treino finalizado com sucesso!' });
});

export const workoutsRouter = router;
