import dotenv from 'dotenv';
dotenv.config();

export type DbKind = 'postgres' | 'sqlite';

let resolved: {
  dbKind: DbKind;
  db: any;
  schema: any;
  sqlClient: { unsafe: (sql: string, params?: any[]) => any };
} | null = null;

export function getDb() {
  if (!resolved) throw new Error('DB not initialized. Call initializeDb() first.');
  return resolved;
}

export const db = new Proxy(
  {},
  {
    get(_t, prop) {
      return Reflect.get(getDb().db, prop);
    },
  }
) as any;

export const schema = new Proxy(
  {},
  {
    get(_t, prop) {
      return Reflect.get(getDb().schema, prop);
    },
  }
) as any;

export const sqlClient = new Proxy(
  {},
  {
    get(_t, prop) {
      return Reflect.get(getDb().sqlClient, prop);
    },
  }
) as any;

export async function initializeDb(): Promise<{ dbKind: DbKind }> {
  if (resolved) return { dbKind: resolved.dbKind };

  const preferSqlite = process.env.FORCE_SQLITE === '1' || !!process.env.SQLITE_FILE;
  const forcePg = process.env.FORCE_POSTGRES === '1';

  if (!forcePg) {
    try {
      const pgOk = await tryPostgres();
      if (!preferSqlite && pgOk) {
        resolved = pgOk;
        console.log('✅ [DB] Usando PostgreSQL');
        return { dbKind: 'postgres' };
      }
    } catch {}
  }

  const sqliteOk = await initSqlite();
  resolved = sqliteOk;
  console.log('✅ [DB] Usando SQLite (banco local embutido)');
  console.log(`   → Arquivo: ${process.env.SQLITE_FILE || './data/trainer_room.sqlite'}`);
  return { dbKind: 'sqlite' };
}

async function tryPostgres() {
  const url = process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/trainer_room';
  const { default: postgres } = await import('postgres');
  const { drizzle } = await import('drizzle-orm/postgres-js');
  const schema = await import('./schema');

  const client = postgres(url, {
    max: 10,
    idle_timeout: 20,
    connect_timeout: 5,
  });

  try {
    const [test] = await client`SELECT 1 as ok`;
    if (!test) throw new Error('no response');
  } catch (e) {
    try { client.end(); } catch {}
    return null;
  }

  try {
    await client`CREATE EXTENSION IF NOT EXISTS pgcrypto`;
  } catch {}

  const db = drizzle(client, { schema: { ...schema } });
  return {
    dbKind: 'postgres' as DbKind,
    db,
    schema,
    sqlClient: {
      unsafe: (sql: string, params?: any[]) => (params ? client.unsafe(sql, params) : client.unsafe(sql)),
    },
  };
}

async function initSqlite() {
  const path = await import('node:path');
  const fs = await import('node:fs');
  const { Database } = await import('bun:sqlite');
  const { drizzle } = await import('drizzle-orm/bun-sqlite');
  const schema = await import('./schema-sqlite');

  const DB_FILE = process.env.SQLITE_FILE || path.resolve(process.cwd(), 'data', 'trainer_room.sqlite');
  const dir = path.dirname(DB_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

  const client = new Database(DB_FILE);
  client.run('PRAGMA journal_mode = WAL');
  client.run('PRAGMA foreign_keys = ON');

  runSqliteBootstrap(client);

  const db = drizzle(client, { schema: { ...schema } });
  process.env.SQLITE_FILE = DB_FILE;

  return {
    dbKind: 'sqlite' as DbKind,
    db,
    schema,
    sqlClient: {
      unsafe: (sql: string, params?: any[]) => {
        if (params && params.length) return client.query(sql).all(...params);
        return client.query(sql).all();
      },
    },
  };
}

const SQLITE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    slug TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    logo_url TEXT,
    primary_color TEXT NOT NULL DEFAULT '#6366F1',
    secondary_color TEXT NOT NULL DEFAULT '#8B5CF6',
    accent_color TEXT NOT NULL DEFAULT '#EC4899',
    background_color TEXT NOT NULL DEFAULT '#FFFFFF',
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'STUDENT',
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    phone TEXT,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL,
    user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    birth_date TEXT,
    gender TEXT,
    height_cm INTEGER,
    is_approved INTEGER NOT NULL DEFAULT 0,
    approved_at INTEGER,
    approved_by TEXT REFERENCES users(id),
    plan_monthly_value REAL,
    plan_due_day INTEGER,
    plan_status TEXT NOT NULL DEFAULT 'INACTIVE',
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(tenant_id, student_id)
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    reference_month TEXT NOT NULL,
    due_date TEXT NOT NULL,
    amount_brl REAL NOT NULL,
    status TEXT NOT NULL DEFAULT 'PENDING',
    paid_at INTEGER,
    paid_by TEXT,
    payment_method TEXT,
    notes TEXT,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL,
    UNIQUE(student_id, reference_month)
  )`,
  `CREATE TABLE IF NOT EXISTS student_progress (
    id TEXT PRIMARY KEY,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    weight_kg REAL,
    body_fat_pct REAL,
    chest_cm REAL,
    waist_cm REAL,
    hip_cm REAL,
    arm_cm REAL,
    thigh_cm REAL,
    calf_cm REAL,
    notes TEXT,
    measured_at TEXT NOT NULL,
    created_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS workouts (
    id TEXT PRIMARY KEY,
    tenant_id TEXT NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
    student_id TEXT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    trainer_id TEXT NOT NULL REFERENCES users(id),
    title TEXT NOT NULL,
    description TEXT,
    week_number INTEGER,
    day_of_week INTEGER,
    scheduled_date TEXT,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS workout_exercises (
    id TEXT PRIMARY KEY,
    workout_id TEXT NOT NULL REFERENCES workouts(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    muscle_group TEXT,
    sets INTEGER NOT NULL DEFAULT 3,
    reps TEXT NOT NULL DEFAULT '12',
    rest_seconds INTEGER,
    load_kg REAL,
    notes TEXT,
    youtube_url TEXT,
    order_index INTEGER NOT NULL DEFAULT 0,
    is_completed INTEGER NOT NULL DEFAULT 0,
    completed_sets INTEGER NOT NULL DEFAULT 0,
    completed_at INTEGER
  )`,
  `CREATE INDEX IF NOT EXISTS users_tenant_idx ON users (tenant_id)`,
  `CREATE INDEX IF NOT EXISTS users_role_idx ON users (role)`,
  `CREATE INDEX IF NOT EXISTS students_tenant_idx ON students (tenant_id)`,
  `CREATE INDEX IF NOT EXISTS students_approval_idx ON students (tenant_id, is_approved)`,
  `CREATE INDEX IF NOT EXISTS students_user_idx ON students (user_id)`,
  `CREATE INDEX IF NOT EXISTS students_plan_status_idx ON students (tenant_id, plan_status)`,
  `CREATE INDEX IF NOT EXISTS payments_tenant_idx ON payments (tenant_id)`,
  `CREATE INDEX IF NOT EXISTS payments_student_idx ON payments (student_id)`,
  `CREATE UNIQUE INDEX IF NOT EXISTS payments_student_month_idx ON payments (student_id, reference_month)`,
  `CREATE INDEX IF NOT EXISTS payments_status_idx ON payments (tenant_id, status)`,
  `CREATE INDEX IF NOT EXISTS payments_due_idx ON payments (tenant_id, due_date)`,
  `CREATE INDEX IF NOT EXISTS student_progress_student_idx ON student_progress (student_id)`,
  `CREATE INDEX IF NOT EXISTS student_progress_measured_idx ON student_progress (student_id, measured_at)`,
  `CREATE INDEX IF NOT EXISTS workouts_student_idx ON workouts (student_id)`,
  `CREATE INDEX IF NOT EXISTS workouts_scheduled_idx ON workouts (student_id, scheduled_date)`,
  `CREATE INDEX IF NOT EXISTS workout_exercises_workout_idx ON workout_exercises (workout_id)`,
];

function runSqliteBootstrap(client: any) {
  const studentsCols = new Set<string>();
  try {
    const rows: any[] = client.query('PRAGMA table_info(students)').all();
    rows.forEach((r: any) => studentsCols.add(r.name));
  } catch {}
  const addStudentCol = (sql: string, colName: string) => {
    if (!studentsCols.has(colName)) {
      try { client.run(sql); } catch {}
    }
  };
  addStudentCol('ALTER TABLE students ADD COLUMN plan_monthly_value REAL', 'plan_monthly_value');
  addStudentCol('ALTER TABLE students ADD COLUMN plan_due_day INTEGER', 'plan_due_day');
  addStudentCol("ALTER TABLE students ADD COLUMN plan_status TEXT NOT NULL DEFAULT 'INACTIVE'", 'plan_status');

  const paymentsCols = new Set<string>();
  try {
    const rows: any[] = client.query('PRAGMA table_info(payments)').all();
    rows.forEach((r: any) => paymentsCols.add(r.name));
  } catch {}
  const addPaymentCol = (sql: string, colName: string) => {
    if (!paymentsCols.has(colName)) {
      try { client.run(sql); } catch {}
    }
  };
  addPaymentCol('ALTER TABLE payments ADD COLUMN reference_month TEXT', 'reference_month');
  addPaymentCol('ALTER TABLE payments ADD COLUMN due_date TEXT', 'due_date');
  addPaymentCol('ALTER TABLE payments ADD COLUMN amount_brl REAL NOT NULL DEFAULT 0', 'amount_brl');
  addPaymentCol("ALTER TABLE payments ADD COLUMN status TEXT NOT NULL DEFAULT 'PENDING'", 'status');
  addPaymentCol('ALTER TABLE payments ADD COLUMN paid_at INTEGER', 'paid_at');
  addPaymentCol('ALTER TABLE payments ADD COLUMN paid_by TEXT', 'paid_by');
  addPaymentCol('ALTER TABLE payments ADD COLUMN payment_method TEXT', 'payment_method');
  addPaymentCol('ALTER TABLE payments ADD COLUMN notes TEXT', 'notes');
  addPaymentCol('ALTER TABLE payments ADD COLUMN tenant_id TEXT REFERENCES tenants(id) ON DELETE CASCADE', 'tenant_id');

  const workoutExCols = new Set<string>();
  try {
    const rows: any[] = client.query('PRAGMA table_info(workout_exercises)').all();
    rows.forEach((r: any) => workoutExCols.add(r.name));
  } catch {}
  if (!workoutExCols.has('youtube_url')) {
    try { client.run('ALTER TABLE workout_exercises ADD COLUMN youtube_url TEXT'); } catch {}
  }
  if (!workoutExCols.has('order_index')) {
    try { client.run('ALTER TABLE workout_exercises ADD COLUMN order_index INTEGER NOT NULL DEFAULT 0'); } catch {}
  }
  if (!workoutExCols.has('is_completed')) {
    try { client.run('ALTER TABLE workout_exercises ADD COLUMN is_completed INTEGER NOT NULL DEFAULT 0'); } catch {}
  }
  if (!workoutExCols.has('completed_sets')) {
    try { client.run('ALTER TABLE workout_exercises ADD COLUMN completed_sets INTEGER NOT NULL DEFAULT 0'); } catch {}
  }
  if (!workoutExCols.has('completed_at')) {
    try { client.run('ALTER TABLE workout_exercises ADD COLUMN completed_at INTEGER'); } catch {}
  }

  const workoutsCols = new Set<string>();
  try {
    const rows: any[] = client.query('PRAGMA table_info(workouts)').all();
    rows.forEach((r: any) => workoutsCols.add(r.name));
  } catch {}
  if (!workoutsCols.has('day_of_week')) {
    try { client.run('ALTER TABLE workouts ADD COLUMN day_of_week INTEGER'); } catch {}
  }

  const tx = client.transaction((stmts: string[]) => {
    for (const s of stmts) client.run(s);
  });
  tx(SQLITE_SCHEMA);
}
