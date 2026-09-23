import {
  pgTable,
  text,
  varchar,
  boolean,
  timestamp,
  integer,
  numeric,
  date,
  uuid,
  primaryKey,
  index,
  uniqueIndex,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

export const tenants = pgTable(
  'tenants',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: varchar('slug', { length: 50 }).notNull(),
    name: varchar('name', { length: 100 }).notNull(),
    logoUrl: text('logo_url'),
    primaryColor: varchar('primary_color', { length: 7 }).notNull().default('#6366F1'),
    secondaryColor: varchar('secondary_color', { length: 7 }).notNull().default('#8B5CF6'),
    accentColor: varchar('accent_color', { length: 7 }).notNull().default('#EC4899'),
    backgroundColor: varchar('background_color', { length: 7 }).notNull().default('#FFFFFF'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    slugIdx: uniqueIndex('tenants_slug_idx').on(table.slug),
  })
);

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id').references(() => tenants.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: 20 }).notNull().default('STUDENT'),
    name: varchar('name', { length: 150 }).notNull(),
    email: varchar('email', { length: 150 }).notNull(),
    passwordHash: text('password_hash').notNull(),
    phone: varchar('phone', { length: 30 }),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    emailIdx: uniqueIndex('users_email_idx').on(table.email),
    tenantIdx: index('users_tenant_idx').on(table.tenantId),
    roleIdx: index('users_role_idx').on(table.role),
  })
);

export const students = pgTable(
  'students',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    studentId: varchar('student_id', { length: 12 }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    name: varchar('name', { length: 150 }).notNull(),
    email: varchar('email', { length: 150 }),
    phone: varchar('phone', { length: 30 }),
    birthDate: date('birth_date'),
    gender: varchar('gender', { length: 1 }),
    heightCm: integer('height_cm'),
    isApproved: boolean('is_approved').notNull().default(false),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    approvedBy: uuid('approved_by').references(() => users.id),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    studentIdUniqueIdx: uniqueIndex('students_student_id_idx').on(table.tenantId, table.studentId),
    tenantIdx: index('students_tenant_idx').on(table.tenantId),
    approvalIdx: index('students_approval_idx').on(table.tenantId, table.isApproved),
    userIdx: index('students_user_idx').on(table.userId),
  })
);

export const studentProgress = pgTable(
  'student_progress',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    weightKg: numeric('weight_kg', { precision: 5, scale: 2 }),
    bodyFatPct: numeric('body_fat_pct', { precision: 5, scale: 2 }),
    chestCm: numeric('chest_cm', { precision: 5, scale: 2 }),
    waistCm: numeric('waist_cm', { precision: 5, scale: 2 }),
    hipCm: numeric('hip_cm', { precision: 5, scale: 2 }),
    armCm: numeric('arm_cm', { precision: 5, scale: 2 }),
    thighCm: numeric('thigh_cm', { precision: 5, scale: 2 }),
    calfCm: numeric('calf_cm', { precision: 5, scale: 2 }),
    notes: text('notes'),
    measuredAt: date('measured_at').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    studentIdx: index('student_progress_student_idx').on(table.studentId),
    measuredIdx: index('student_progress_measured_idx').on(table.studentId, table.measuredAt),
  })
);

export const workouts = pgTable(
  'workouts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    tenantId: uuid('tenant_id')
      .notNull()
      .references(() => tenants.id, { onDelete: 'cascade' }),
    studentId: uuid('student_id')
      .notNull()
      .references(() => students.id, { onDelete: 'cascade' }),
    trainerId: uuid('trainer_id')
      .notNull()
      .references(() => users.id),
    title: varchar('title', { length: 100 }).notNull(),
    description: text('description'),
    weekNumber: integer('week_number'),
    dayOfWeek: integer('day_of_week'),
    scheduledDate: date('scheduled_date'),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .default(sql`now()`),
  },
  (table) => ({
    studentIdx: index('workouts_student_idx').on(table.studentId),
    scheduledIdx: index('workouts_scheduled_idx').on(table.studentId, table.scheduledDate),
  })
);

export const workoutExercises = pgTable(
  'workout_exercises',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    workoutId: uuid('workout_id')
      .notNull()
      .references(() => workouts.id, { onDelete: 'cascade' }),
    name: varchar('name', { length: 150 }).notNull(),
    muscleGroup: varchar('muscle_group', { length: 50 }),
    sets: integer('sets').notNull().default(3),
    reps: varchar('reps', { length: 50 }).notNull().default('12'),
    restSeconds: integer('rest_seconds'),
    loadKg: numeric('load_kg', { precision: 6, scale: 2 }),
    notes: text('notes'),
    orderIndex: integer('order_index').notNull().default(0),
    isCompleted: boolean('is_completed').notNull().default(false),
    completedSets: integer('completed_sets').notNull().default(0),
    completedAt: timestamp('completed_at', { withTimezone: true }),
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
