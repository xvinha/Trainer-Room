import {
  sqliteTable,
  text,
  integer,
  real,
  index,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';
import { relations } from 'drizzle-orm';

function uuidPK(name: string) {
  return text(name).primaryKey().$defaultFn(() => crypto.randomUUID());
}

export const tenants = sqliteTable(
  'tenants',
  {
    id: uuidPK('id'),
    slug: text('slug').notNull(),
    name: text('name').notNull(),
    logoUrl: text('logo_url'),
    primaryColor: text('primary_color').notNull().default('#0F3D36'),
    secondaryColor: text('secondary_color').notNull().default('#0B2E29'),
    accentColor: text('accent_color').notNull().default('#C3F230'),
    backgroundColor: text('background_color').notNull().default('#FCFDF8'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    slugIdx: uniqueIndex('tenants_slug_idx').on(table.slug),
  })
);

export const users = sqliteTable(
  'users',
  {
    id: uuidPK('id'),
    tenantId: text('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    role: text('role').notNull().default('STUDENT'),
    name: text('name').notNull(),
    email: text('email').notNull(),
    passwordHash: text('password_hash').notNull(),
    phone: text('phone'),
    isActive: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    tenantIdx: index('users_tenant_idx').on(table.tenantId),
    roleIdx: index('users_role_idx').on(table.role),
  })
);

export const students = sqliteTable(
  'students',
  {
    id: uuidPK('id'),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    studentId: text('student_id').notNull(),
    userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: text('name').notNull(),
    email: text('email'),
    phone: text('phone'),
    birthDate: text('birth_date'),
    gender: text('gender'),
    heightCm: integer('height_cm'),
    isApproved: integer('is_approved', { mode: 'boolean' }).notNull().default(false),
    approvedAt: integer('approved_at', { mode: 'timestamp_ms' }),
    approvedBy: text('approved_by'),
    planMonthlyValue: real('plan_monthly_value'),
    planDueDay: integer('plan_due_day'),
    planStatus: text('plan_status').notNull().default('INACTIVE'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    studentIdUniqueIdx: uniqueIndex('students_student_id_idx').on(table.tenantId, table.studentId),
    tenantIdx: index('students_tenant_idx').on(table.tenantId),
    approvalIdx: index('students_approval_idx').on(table.tenantId, table.isApproved),
    planStatusIdx: index('students_plan_status_idx').on(table.tenantId, table.planStatus),
    userIdx: index('students_user_idx').on(table.userId),
  })
);

export const payments = sqliteTable(
  'payments',
  {
    id: uuidPK('id'),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    referenceMonth: text('reference_month').notNull(),
    dueDate: text('due_date').notNull(),
    amountBrl: real('amount_brl').notNull(),
    status: text('status').notNull().default('PENDING'),
    paidAt: integer('paid_at', { mode: 'timestamp_ms' }),
    paidBy: text('paid_by'),
    paymentMethod: text('payment_method'),
    notes: text('notes'),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    tenantIdx: index('payments_tenant_idx').on(table.tenantId),
    studentIdx: index('payments_student_idx').on(table.studentId),
    uniquePerStudentMonth: uniqueIndex('payments_student_month_idx').on(table.studentId, table.referenceMonth),
    statusIdx: index('payments_status_idx').on(table.tenantId, table.status),
    dueDateIdx: index('payments_due_idx').on(table.tenantId, table.dueDate),
  })
);

export type Payment = typeof payments.$inferSelect;
export type NewPayment = typeof payments.$inferInsert;

export const studentProgress = sqliteTable(
  'student_progress',
  {
    id: uuidPK('id'),
    studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    weightKg: real('weight_kg'),
    bodyFatPct: real('body_fat_pct'),
    chestCm: real('chest_cm'),
    waistCm: real('waist_cm'),
    hipCm: real('hip_cm'),
    armCm: real('arm_cm'),
    thighCm: real('thigh_cm'),
    calfCm: real('calf_cm'),
    notes: text('notes'),
    measuredAt: text('measured_at').notNull(),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    studentIdx: index('student_progress_student_idx').on(table.studentId),
    measuredIdx: index('student_progress_measured_idx').on(table.studentId, table.measuredAt),
  })
);

export const workouts = sqliteTable(
  'workouts',
  {
    id: uuidPK('id'),
    tenantId: text('tenant_id').notNull().references(() => tenants.id, { onDelete: 'cascade' }),
    studentId: text('student_id').notNull().references(() => students.id, { onDelete: 'cascade' }),
    trainerId: text('trainer_id').notNull().references(() => users.id),
    title: text('title').notNull(),
    description: text('description'),
    weekNumber: integer('week_number'),
    dayOfWeek: integer('day_of_week'),
    scheduledDate: text('scheduled_date'),
    isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
    createdAt: integer('created_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
    updatedAt: integer('updated_at', { mode: 'timestamp_ms' }).notNull().$defaultFn(() => new Date()),
  },
  (table) => ({
    studentIdx: index('workouts_student_idx').on(table.studentId),
    scheduledIdx: index('workouts_scheduled_idx').on(table.studentId, table.scheduledDate),
  })
);

export const workoutExercises = sqliteTable(
  'workout_exercises',
  {
    id: uuidPK('id'),
    workoutId: text('workout_id').notNull().references(() => workouts.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    muscleGroup: text('muscle_group'),
    sets: integer('sets').notNull().default(3),
    reps: text('reps').notNull().default('12'),
    restSeconds: integer('rest_seconds'),
    loadKg: real('load_kg'),
    notes: text('notes'),
    youtubeUrl: text('youtube_url'),
    orderIndex: integer('order_index').notNull().default(0),
    isCompleted: integer('is_completed', { mode: 'boolean' }).notNull().default(false),
    completedSets: integer('completed_sets').notNull().default(0),
    completedAt: integer('completed_at', { mode: 'timestamp_ms' }),
  },
  (table) => ({
    workoutIdx: index('workout_exercises_workout_idx').on(table.workoutId),
  })
);

export type Tenant = typeof tenants.$inferSelect;
export type NewTenant = typeof tenants.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Student = typeof students.$inferSelect;
export type NewStudent = typeof students.$inferInsert;
export type StudentProgress = typeof studentProgress.$inferSelect;
export type NewStudentProgress = typeof studentProgress.$inferInsert;
export type Workout = typeof workouts.$inferSelect;
export type NewWorkout = typeof workouts.$inferInsert;
export type WorkoutExercise = typeof workoutExercises.$inferSelect;
export type NewWorkoutExercise = typeof workoutExercises.$inferInsert;

export const tenantsRelations = relations(tenants, ({ many }) => ({
  users: many(users),
  students: many(students),
  payments: many(payments),
  studentProgress: many(studentProgress),
  workouts: many(workouts),
}));

export const usersRelations = relations(users, ({ one, many }) => ({
  tenant: one(tenants, { fields: [users.tenantId], references: [tenants.id] }),
  approvedStudents: many(students, { relationName: 'approvedByUser' }),
  trainedWorkouts: many(workouts, { relationName: 'trainerUser' }),
  studentProfile: many(students, { relationName: 'userProfile' }),
}));

export const studentsRelations = relations(students, ({ one, many }) => ({
  tenant: one(tenants, { fields: [students.tenantId], references: [tenants.id] }),
  approvedBy: one(users, { fields: [students.approvedBy], references: [users.id], relationName: 'approvedByUser' }),
  user: one(users, { fields: [students.userId], references: [users.id], relationName: 'userProfile' }),
  payments: many(payments),
  progress: many(studentProgress),
  workouts: many(workouts),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  tenant: one(tenants, { fields: [payments.tenantId], references: [tenants.id] }),
  student: one(students, { fields: [payments.studentId], references: [students.id] }),
}));

export const studentProgressRelations = relations(studentProgress, ({ one }) => ({
  tenant: one(tenants, { fields: [studentProgress.tenantId], references: [tenants.id] }),
  student: one(students, { fields: [studentProgress.studentId], references: [students.id] }),
}));

export const workoutsRelations = relations(workouts, ({ one, many }) => ({
  tenant: one(tenants, { fields: [workouts.tenantId], references: [tenants.id] }),
  student: one(students, { fields: [workouts.studentId], references: [students.id] }),
  trainer: one(users, { fields: [workouts.trainerId], references: [users.id], relationName: 'trainerUser' }),
  exercises: many(workoutExercises),
}));

export const workoutExercisesRelations = relations(workoutExercises, ({ one }) => ({
  workout: one(workouts, { fields: [workoutExercises.workoutId], references: [workouts.id] }),
}));
