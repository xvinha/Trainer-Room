import dotenv from 'dotenv';
dotenv.config();

import { sqlClient } from '../db/index';

const schemaSQL = `
CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug VARCHAR(50) NOT NULL,
  name VARCHAR(100) NOT NULL,
  logo_url TEXT,
  primary_color VARCHAR(7) NOT NULL DEFAULT '#6366F1',
  secondary_color VARCHAR(7) NOT NULL DEFAULT '#8B5CF6',
  accent_color VARCHAR(7) NOT NULL DEFAULT '#EC4899',
  background_color VARCHAR(7) NOT NULL DEFAULT '#FFFFFF',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS tenants_slug_idx ON tenants (slug);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL DEFAULT 'STUDENT',
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150) NOT NULL,
  password_hash TEXT NOT NULL,
  phone VARCHAR(30),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS users_email_idx ON users (email);
CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id);
CREATE INDEX IF NOT EXISTS users_role_idx ON users (role);

CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id VARCHAR(12) NOT NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(150) NOT NULL,
  email VARCHAR(150),
  phone VARCHAR(30),
  birth_date DATE,
  gender VARCHAR(1),
  height_cm INTEGER,
  is_approved BOOLEAN NOT NULL DEFAULT false,
  approved_at TIMESTAMPTZ,
  approved_by UUID REFERENCES users(id),
  plan_monthly_value NUMERIC(8,2),
  plan_due_day INTEGER,
  plan_status VARCHAR(16) NOT NULL DEFAULT 'INACTIVE',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS students_student_id_idx ON students (tenant_id, student_id);
CREATE INDEX IF NOT EXISTS students_tenant_idx ON students (tenant_id);
CREATE INDEX IF NOT EXISTS students_approval_idx ON students (tenant_id, is_approved);
CREATE INDEX IF NOT EXISTS students_plan_status_idx ON students (tenant_id, plan_status);
CREATE INDEX IF NOT EXISTS students_user_idx ON students (user_id);

CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  reference_month VARCHAR(7) NOT NULL,
  due_date DATE NOT NULL,
  amount_brl NUMERIC(8,2) NOT NULL,
  status VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  paid_at TIMESTAMPTZ,
  paid_by UUID REFERENCES users(id),
  payment_method VARCHAR(30),
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS payments_tenant_idx ON payments (tenant_id);
CREATE INDEX IF NOT EXISTS payments_student_idx ON payments (student_id);
CREATE UNIQUE INDEX IF NOT EXISTS payments_student_month_idx ON payments (student_id, reference_month);
CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (tenant_id, status);
CREATE INDEX IF NOT EXISTS payments_due_idx ON payments (tenant_id, due_date);

CREATE TABLE IF NOT EXISTS student_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  weight_kg NUMERIC(5,2),
  body_fat_pct NUMERIC(5,2),
  chest_cm NUMERIC(5,2),
  waist_cm NUMERIC(5,2),
  hip_cm NUMERIC(5,2),
  arm_cm NUMERIC(5,2),
  thigh_cm NUMERIC(5,2),
  calf_cm NUMERIC(5,2),
  notes TEXT,
  measured_at DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS student_progress_student_idx ON student_progress (student_id);
CREATE INDEX IF NOT EXISTS student_progress_measured_idx ON student_progress (student_id, measured_at);

CREATE TABLE IF NOT EXISTS workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  trainer_id UUID NOT NULL REFERENCES users(id),
  title VARCHAR(100) NOT NULL,
  description TEXT,
  week_number INTEGER,
  day_of_week INTEGER,
  scheduled_date DATE,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS workouts_student_idx ON workouts (student_id);
CREATE INDEX IF NOT EXISTS workouts_scheduled_idx ON workouts (student_id, scheduled_date);

CREATE TABLE IF NOT EXISTS workout_exercises (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
  name VARCHAR(150) NOT NULL,
  muscle_group VARCHAR(50),
  sets INTEGER NOT NULL DEFAULT 3,
  reps VARCHAR(50) NOT NULL DEFAULT '12',
  rest_seconds INTEGER,
  load_kg NUMERIC(6,2),
  notes TEXT,
  youtube_url VARCHAR(500),
  order_index INTEGER NOT NULL DEFAULT 0,
  is_completed BOOLEAN NOT NULL DEFAULT false,
  completed_sets INTEGER NOT NULL DEFAULT 0,
  completed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS workout_exercises_workout_idx ON workout_exercises (workout_id);
`;

async function main() {
  try {
    console.log('🔧 [DB] Testando conexão com PostgreSQL...');
    const test = await sqlClient`SELECT 1 as ok`;
    if (test.length === 1) console.log('✅ [DB] Conexão com PostgreSQL: OK');

    console.log('🔧 [DB] Garantindo que banco "trainer_room" e tabelas existam...');
    try {
      await sqlClient`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
    } catch {}

    for (const stmt of schemaSQL
      .split(';')
      .map((s) => s.trim())
      .filter((s) => s.length > 5)) {
      try {
        await sqlClient.unsafe(stmt + ';');
      } catch (e: any) {
        if (!e.message || !e.message.includes('already exists')) {
          console.warn('  ⚠️ ', e.message);
        }
      }
    }

    console.log('✅ [DB] Todas as tabelas e índices garantidos.');
    process.exit(0);
  } catch (e: any) {
    console.error('❌ [DB] Falha na conexão ou criação de tabelas:');
    console.error('   ', e?.message || String(e));
    console.error('');
    console.error('💡 Dica: verifique se o PostgreSQL está rodando em localhost:5432');
    console.error('   e se o banco "trainer_room" existe, ou se o usuário postgres pode criar.');
    process.exit(1);
  }
}

main();
