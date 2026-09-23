import 'dotenv/config';
import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).pipe(z.number().int().positive()).default('3001'),
  DATABASE_URL: z.string().url().default('postgresql://postgres:postgres@localhost:5432/trainer_room'),
  JWT_SECRET: z.string().min(8).default('dev-jwt-secret-troque-em-producao-xyz12345678901234567890'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGIN: z.string().default('*'),

  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(8).optional(),
  ADMIN_PASSWORD_HASH: z.string().optional(),

  SETUP_KEY: z.string().optional(),

  STUDENT_ID_LENGTH: z.string().transform(Number).pipe(z.number().int().min(6).max(16)).default('8'),
  STUDENT_ID_ALPHABET: z.string().default('ABCDEFGHJKLMNPQRSTUVWXYZ23456789'),
});

const parsed = envSchema.safeParse(process.env);

let env: z.infer<typeof envSchema>;

if (!parsed.success) {
  const missing = parsed.error.issues
    .filter((i) => i.code === 'invalid_type' && i.received === 'undefined')
    .map((i) => i.path.join('.'));
  console.warn('\n⚠️  [CONFIG] Variáveis de ambiente com problemas:');
  parsed.error.issues.forEach((i) => {
    console.warn(`   • ${i.path.join('.')}: ${i.message}`);
  });
  if (missing.includes('JWT_SECRET') || missing.includes('DATABASE_URL')) {
    console.warn('\n💡 Usando valores DEFAULT de desenvolvimento. Altere no .env antes de produção.');
  }
  if (process.env.NODE_ENV === 'production') {
    console.error('\n❌ Abortando em PRODUÇÃO por variáveis faltantes!');
    process.exit(1);
  }
  env = envSchema.parse({});
} else {
  env = parsed.data;
}

const typedEnv = env as any;
typedEnv.jwtSecret = env.JWT_SECRET;
typedEnv.jwtExpiresIn = env.JWT_EXPIRES_IN;
typedEnv.studentIdLength = env.STUDENT_ID_LENGTH;
typedEnv.studentIdAlphabet = env.STUDENT_ID_ALPHABET;

function isProduction() {
  return env.NODE_ENV === 'production';
}

function hasAdminCredentials() {
  const hasHash = !!env.ADMIN_PASSWORD_HASH;
  const hasPlain = !!env.ADMIN_EMAIL && !!env.ADMIN_PASSWORD;
  return hasHash || hasPlain;
}

export { env, isProduction, hasAdminCredentials };
