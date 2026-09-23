import { eq } from 'drizzle-orm';
import { db, schema } from './index';
import { env, isProduction, hasAdminCredentials } from '../config/env';

export async function hashPassword(plain: string): Promise<string> {
  try {
    return await Bun.password.hash(plain, {
      algorithm: 'bcrypt',
      cost: 12,
    });
  } catch {
    const { default: bcrypt } = await import('bcryptjs');
    return bcrypt.hash(plain, 12);
  }
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(plain, hash);
  } catch {
    const { default: bcrypt } = await import('bcryptjs');
    return bcrypt.compare(plain, hash);
  }
}

export async function hashFromEnvOrPlain(): Promise<{ email: string; passwordHash: string; usedHash: boolean } | null> {
  if (env.ADMIN_PASSWORD_HASH && env.ADMIN_EMAIL) {
    return {
      email: env.ADMIN_EMAIL.toLowerCase(),
      passwordHash: env.ADMIN_PASSWORD_HASH,
      usedHash: true,
    };
  }
  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    return {
      email: env.ADMIN_EMAIL.toLowerCase(),
      passwordHash: await hashPassword(env.ADMIN_PASSWORD),
      usedHash: false,
    };
  }
  return null;
}

export interface SeedResult {
  created: boolean;
  alreadyExisted: boolean;
  skippedNoCredentials: boolean;
  email?: string;
  usedHash?: boolean;
  error?: string;
}

export async function seedMasterAdmin(): Promise<SeedResult> {
  try {
    const credentials = await hashFromEnvOrPlain();

    if (!credentials) {
      if (isProduction()) {
        console.warn('\n⚠️  [SEED] Nenhuma credencial de Admin Master definida no ambiente.');
        console.warn('   Defina ADMIN_EMAIL + ADMIN_PASSWORD (ou ADMIN_PASSWORD_HASH) para criar o usuário inicial.\n');
      } else {
        const count = await db
          .select({ count: schema.users.id })
          .from(schema.users)
          .where(eq(schema.users.role, 'MASTER_ADMIN'))
          .execute()
          .then((r) => r.length)
          .catch(() => 0);
        if (count === 0) {
          console.warn('\n⚠️  [SEED] Sem ADMIN_EMAIL/ADMIN_PASSWORD nas variáveis de ambiente.');
          console.warn('   O painel administrativo não terá usuário para acessar.');
          console.warn('   Defina as variáveis e reinicie, ou use POST /api/setup/master com SETUP_KEY.\n');
        }
      }
      return { created: false, alreadyExisted: false, skippedNoCredentials: true };
    }

    const existing = await db.query.users.findFirst({
      where: eq(schema.users.email, credentials.email),
    });

    if (existing) {
      if (existing.role !== 'MASTER_ADMIN') {
        await db.update(schema.users)
          .set({ role: 'MASTER_ADMIN', isActive: true, passwordHash: credentials.passwordHash, updatedAt: new Date() })
          .where(eq(schema.users.id, existing.id));
        console.log('[SEED] Usuário existente promovido a MASTER_ADMIN:', credentials.email);
        return { created: false, alreadyExisted: true, email: credentials.email, usedHash: credentials.usedHash };
      }
      console.log('[SEED] MASTER_ADMIN já cadastrado:', credentials.email);
      return { created: false, alreadyExisted: true, email: credentials.email, usedHash: credentials.usedHash };
    }

    const adminCount = await db
      .select({ count: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.role, 'MASTER_ADMIN'))
      .execute()
      .then((r) => r.length)
      .catch(() => 0);

    if (adminCount > 0) {
      console.log('[SEED] Já existe outro MASTER_ADMIN cadastrado. Nenhuma alteração feita.');
      return { created: false, alreadyExisted: true, skippedNoCredentials: false };
    }

    const [created] = await db.insert(schema.users).values({
      tenantId: null,
      role: 'MASTER_ADMIN',
      name: 'Administrador Master',
      email: credentials.email,
      passwordHash: credentials.passwordHash,
      isActive: true,
    }).returning();

    console.log(`\n✅ [SEED] MASTER_ADMIN criado com sucesso!`);
    console.log(`   → E-mail: ${created.email}`);
    console.log(`   → Hash pré-calculado: ${credentials.usedHash ? 'SIM (via ADMIN_PASSWORD_HASH)' : 'NÃO (gerado via ADMIN_PASSWORD)'}`);
    if (!credentials.usedHash) {
      console.log('   💡 Dica de segurança: para produção, prefira configurar ADMIN_PASSWORD_HASH diretamente.');
      console.log('      Use: bun run apps/backend/src/scripts/hash-password.ts "sua-senha"\n');
    } else {
      console.log('');
    }

    return {
      created: true,
      alreadyExisted: false,
      skippedNoCredentials: false,
      email: created.email,
      usedHash: credentials.usedHash,
    };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error('❌ [SEED] Falha ao criar MASTER_ADMIN:', msg);
    if (msg.includes('relation') && msg.includes('does not exist')) {
      console.error('   Dica: as tabelas ainda não existem. Rode "bun run db:push" ou "bun run db:migrate" primeiro.\n');
    }
    return { created: false, alreadyExisted: false, skippedNoCredentials: false, error: msg };
  }
}

if (typeof import.meta !== 'undefined' && import.meta.main) {
  seedMasterAdmin()
    .then((r) => {
      if (r.error) process.exit(1);
      if (r.skippedNoCredentials && isProduction()) process.exit(2);
      process.exit(0);
    })
    .catch(() => process.exit(1));
}
