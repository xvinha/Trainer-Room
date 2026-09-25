import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { env, isProduction } from './config/env';
import { errorHandler, notFoundHandler } from './middleware/error';
import { authRouter } from './routes/auth';
import { tenantsRouter } from './routes/tenants';
import { studentsRouter } from './routes/students';
import { workoutsRouter } from './routes/workouts';
import { paymentsRouter } from './routes/payments';
import { seedMasterAdmin } from './db/seed';
import { initializeDb } from './db';

const app = express();

app.disable('x-powered-by');
app.set('trust proxy', true);

app.use(
  cors({
    origin: env.CORS_ORIGIN === '*' ? true : env.CORS_ORIGIN.split(','),
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Tenant-Slug'],
    exposedHeaders: ['X-Total-Count'],
    preflightContinue: false,
    optionsSuccessStatus: 204,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: env.NODE_ENV,
  });
});

if (!isProduction()) {
  app.post('/api/setup/master', async (req, res) => {
    try {
      const expectedKey = env.SETUP_KEY;
      if (expectedKey) {
        const incomingKey = req.headers['x-setup-key'] as string | undefined;
        if (!incomingKey || incomingKey !== expectedKey) {
          return res.status(403).json({
            success: false,
            error: 'SETUP_KEY definida no ambiente, informe o header X-Setup-Key correto',
          });
        }
      }

      const seed = await import('./db/seed');
      const { eq } = await import('drizzle-orm');
      const { db, schema } = await import('./db');

      const email = env.ADMIN_EMAIL;
      const password = env.ADMIN_PASSWORD;
      const passwordHash = env.ADMIN_PASSWORD_HASH;

      if (!email || (!password && !passwordHash)) {
        return res.status(400).json({
          success: false,
          error: 'Credenciais incompletas nas variáveis de ambiente',
          hint: 'Configure ADMIN_EMAIL + ADMIN_PASSWORD (ou ADMIN_PASSWORD_HASH) no .env, reinicie e esta rota criará o usuário automaticamente',
        });
      }

      const finalHash = passwordHash ?? (password ? await seed.hashPassword(password) : null);
      if (!finalHash) {
        return res.status(400).json({ success: false, error: 'Não foi possível calcular o hash da senha' });
      }

      const emailLower = email.toLowerCase();
      const existing = await db.query.users.findFirst({
        where: eq(schema.users.email, emailLower),
      });

      if (existing) {
        if (existing.role !== 'MASTER_ADMIN') {
          await db.update(schema.users)
            .set({ role: 'MASTER_ADMIN', isActive: true, passwordHash: finalHash, updatedAt: new Date() })
            .where(eq(schema.users.id, existing.id));
          console.log('[SETUP] Usuário existente promovido a MASTER_ADMIN:', emailLower);
        } else {
          await db.update(schema.users)
            .set({ passwordHash: finalHash, isActive: true, updatedAt: new Date() })
            .where(eq(schema.users.id, existing.id));
          console.log('[SETUP] MASTER_ADMIN atualizado:', emailLower);
        }
      } else {
        await db.insert(schema.users).values({
          tenantId: null,
          role: 'MASTER_ADMIN',
          name: 'Administrador Master',
          email: emailLower,
          passwordHash: finalHash,
          isActive: true,
        });
        console.log('[SETUP] MASTER_ADMIN criado:', emailLower);
      }

      return res.json({
        success: true,
        data: {
          email: emailLower,
          role: 'MASTER_ADMIN',
          used_pre_hashed: !!passwordHash,
          next_step: 'Acesse /login com as credenciais configuradas nas variáveis de ambiente',
        },
      });
    } catch (err: any) {
      console.error('[SETUP] Falha:', err);
      return res.status(500).json({
        success: false,
        error: err.message || 'Falha no setup',
        hint: 'Confirme se rodou "bun run db:push" para criar as tabelas',
      });
    }
  });
}

app.use('/api/auth', authRouter);
app.use('/api/tenants', tenantsRouter);
app.use('/api/students', studentsRouter);
app.use('/api/workouts', workoutsRouter);
app.use('/api/payments', paymentsRouter);

app.use(notFoundHandler);
app.use(errorHandler);

async function start() {
  try {
    const init = await initializeDb();
    console.log(`🗄️  Banco de dados ativo: ${init.dbKind.toUpperCase()}`);

    const seedResult = await seedMasterAdmin();

    app.listen(env.PORT, () => {
      console.log(`\n🚀 Trainer Room API rodando em http://localhost:${env.PORT}`);
      console.log(`📄 Health: http://localhost:${env.PORT}/health`);
      console.log(`🌍 Ambiente: ${env.NODE_ENV}`);

      if (seedResult.created || seedResult.email) {
        console.log(`👤 MASTER_ADMIN: ${seedResult.email}`);
        console.log(`   → Status: ${seedResult.created ? 'CRIADO' : 'já existia'}`);
      } else if (seedResult.skippedNoCredentials) {
        if (!isProduction()) {
          console.log('⚠️  Admin não criado (sem ADMIN_EMAIL/ADMIN_PASSWORD nas vars).');
          console.log('   POST /api/setup/master (após configurar vars) OU configure .env e reinicie.');
        }
      }

      if (!isProduction()) {
        console.log(`🛠️  Setup endpoint (dev-only): POST /api/setup/master`);
      }
      console.log('');
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
}

start();
