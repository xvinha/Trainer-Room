# Trainer Room 🚀

> SaaS White-Label de gestão de treinos mobile-first para Personal Trainers

## 🏗️ Arquitetura Geral

Monorepo com Bun Workspaces (3 pacotes):

```
Trainer-Room/
├── apps/
│   ├── backend/          # API REST (Bun + Express + Drizzle ORM)
│   │   └── src/
│   │       ├── config/   # Variáveis de ambiente
│   │       ├── db/       # Schema, conexão, seed (PostgreSQL)
│   │       ├── middleware/ # auth, error handling
│   │       ├── routes/   # auth, tenants, students, workouts
│   │       ├── utils/    # JWT, geração de StudentID
│   │       └── index.ts  # Entry point
│   │
│   └── frontend/         # Web App Mobile-First (React + Vite + Tailwind)
│       └── src/
│           ├── components/  # MobileLayout, UI elements
│           ├── pages/       # Páginas por role (admin/trainer/student)
│           ├── services/    # Axios API client
│           ├── store/       # Zustand: auth + tema dinâmico
│           ├── styles/      # CSS variables white-label
│           └── utils/       # helpers
│
├── packages/
│   └── shared-types/    # Tipos TypeScript compartilhados (Tenant, User, Student, Workout)
│
├── package.json         # Workspace root + scripts globais
└── tsconfig.base.json   # TSConfig base
```

---

## 🔀 Fluxo Principal (ID de Aluno + Aprovação)

```
1. Aluno acessa /t/{slug-do-personal}
   ↓
2. Tema (cores/logo) injetado DINAMICAMENTE via CSS vars
   ↓
3. Aluno preenche cadastro → back gera STUDENT_ID (alfanumérico 8 chars, ex: ABCD-1234)
   ↓
4. Tela de sucesso EXIBE DESTAQUE o ID com botão COPIAR
   ↓
5. Aluno envia ID para o Personal (WhatsApp)
   ↓
6. Personal loga → Tela "Aprovar Aluno por ID" → digita o ID
   ↓
7. Sistema busca + confirma → Personal clica em Aprovar (is_approved = true)
   ↓
8. Aluno loga → acesso liberado → vê treinos do dia
```

### Lógica de Geração do Student ID
- **Alfabeto**: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (sem I,O,0,1 ambíguos)
- **Tamanho**: 8 caracteres → ~2,8 trilhões de combinações
- **Unicidade**: `UNIQUE(tenant_id, student_id)` no banco + retry loop 5x
- **Formato exibição**: `ABCD-1234` (separador visual no 4º char)

---

## 🗄️ Modelagem Banco de Dados (PostgreSQL)

**Estratégia Multi-Tenant**: `tenant_id` em todas as tabelas relacionais + RLS (Row Level Security pode ser adicionado via trigger)

### Tabelas Principais

| Tabela | Chave | Campos Essenciais |
|--------|-------|-------------------|
| **tenants** | id uuid PK | `slug` (UK), name, logo_url, `primary_color`, secondary_color, accent_color, background_color, is_active |
| **users** | id uuid PK | `tenant_id` FK→tenants, role [MASTER_ADMIN/TRAINER/STUDENT], name, email (UK), password_hash, phone |
| **students** | id uuid PK | `tenant_id` FK, `student_id` varchar(12), `UNIQUE(tenant_id, student_id)`, user_id FK→users, name, email, phone, birth_date, gender, height_cm, **`is_approved` bool DEFAULT false**, approved_at, approved_by |
| **student_progress** | id uuid PK | student_id FK, tenant_id FK, weight_kg, body_fat_pct, chest/waist/hip/arm/thigh/calf_cm, measured_at |
| **workouts** | id uuid PK | tenant_id FK, student_id FK, trainer_id FK, title, description, week_number, day_of_week, scheduled_date, is_completed |
| **workout_exercises** | id uuid PK | workout_id FK cascade, name, muscle_group, sets, reps, rest_seconds, load_kg, order_index, `is_completed`, `completed_sets` |

Índices criados em: `students(tenant_id, is_approved)`, `workouts(student_id, scheduled_date)`, `users(email)`, `tenants(slug)`.

---

## 🎨 Design Mobile-First (Tailwind + CSS)

### Safe Areas iOS (iPhone com Dynamic Island / Notch)
```css
padding-top: env(safe-area-inset-top);       /* Header */
padding-bottom: env(safe-area-inset-bottom); /* Tab Bar */
padding-left/right: env(safe-area-inset-*);  /* Landscape */
min-height: 100dvh; /* Dynamic viewport height - corrige iOS Safari */
```

### Meta Tags PWA/Nativo
- `viewport-fit=cover` + `apple-mobile-web-app-status-bar-style=black-translucent`
- `user-scalable=no`, `touch-action: manipulation`
- `webkit-tap-highlight-color: transparent` (remove highlight azul dos toques)

### Tema White-Label Dinâmico
Todo componente usa **CSS Variables**, não hardcoded colors:
```css
:root { --color-primary, --color-secondary, --color-accent, --color-bg, --color-text }
.btn-primary { background-color: var(--color-primary) }
```

O Zustand [`applyTheme()`](apps/frontend/src/store/auth.ts) injeta no `<html>` as variáveis do tenant (identificado via slug da URL `/t/{slug}`) + troca `<meta name="theme-color">` + `document.title`.

### Componentes Touch-Optimized
- **Botões**: `min-height: 48px` (guia WCAG para touch targets)
- **Checkbox**: `28x28px` customizados
- **Tab Bar inferior**: 4 ícones fixos com safe area
- **FAB (Floating Action Button)**: canto inferor direito
- **Sombra**: `shadow-mobile` e `shadow-mobile-lg` (subtle, estilo iOS Material You)

---

## 🛣️ Rotas da API

| Método | Path | Role | Descrição |
|--------|------|------|-----------|
| POST | `/api/auth/login` | Public | Login (retorna JWT + tenant theme) |
| GET  | `/api/auth/me` | Auth | Perfil atual |
| GET  | `/api/tenants/slug/:slug` | Public | Busca tema white-label (sem expor dados sensíveis) |
| GET/POST/PUT | `/api/tenants` | MASTER_ADMIN | CRUD Personais (cria user TRAINER junto) |
| POST | `/api/students/register` | Public | Cadastro aluno via slug → retorna STUDENT_ID |
| GET  | `/api/students/by-id/:id` | TRAINER | Busca aluno pelo student_id |
| GET  | `/api/students?status=pending\|approved` | TRAINER | Lista por status |
| **POST** | **`/api/students/approve`** | **TRAINER** | **Fluxo core: { studentId } → is_approved=true + approved_by** |
| POST | `/api/students/me/progress` | STUDENT | Envia peso/medidas |
| POST/GET | `/api/workouts` | TRAINER | Criar/listar fichas |
| GET  | `/api/workouts/me` | STUDENT | Meus treinos (últimos 20) |
| POST | `/api/workouts/:id/exercise/:eid/toggle` | STUDENT | Marca série concluída |
| POST | `/api/workouts/:id/finish` | STUDENT | Finaliza treino completo |

---

## 📱 Telas Implementadas

### 👑 Admin Master (Você)
- **Dashboard** → Cards com estatísticas + lista de Personais
- **Novo Cliente** → Form: dados do Personal + identidade visual (slugs/cores) + preview em tempo real
- **Lista Clientes** → Status ativo/inativo

### 🏋️ Painel Personal Trainer
- **Home** → Saudação + cards (pendentes, alunos, treinos) + ações rápidas
- **Aprovar Aluno por ID** (Foco principal!) → Campo uppercase auto-format, busca, preview do aluno, botão Aprovar
- **Lista Alunos** → Filtro Pendentes/Aprovados/Todos
- **Perfil** → Link de cadastro copiável (`/t/{slug}`) + preview das cores

### 🏃 Painel Aluno (UX Mobile Nativo)
- **Cadastro público** `/t/:slug` → tema white-label injetado, campos otimizados touch
- **Tela Sucesso** → ID destacado em caixa colorida + botão copiar + passo-a-passo "O que fazer agora"
- **Home** → Saudação + card treino do dia + próximos
- **Detalhe do Treino** → Progress bar, cada exercício com +/− séries, checkbox grande, botão finalizar
- **Evolução** → Enviar peso/medidas + histórico

---

## 🚀 Como Rodar

### Pré-requisitos
- [Bun](https://bun.sh/) ≥ 1.1
- PostgreSQL ≥ 14 rodando localmente

### Setup
```bash
# 1. Instalar dependências do monorepo
bun install

# 2. Configurar backend
cp apps/backend/.env.example apps/backend/.env
# Edite DATABASE_URL com seus dados

# 3. Criar tabelas
cd apps/backend
bun run db:generate
bun run db:push
bun run seed    # Cria MASTER_ADMIN padrão

# 4. Voltar pro root e rodar TUDO
cd ../..
bun run dev
```

### URLs padrão
- Frontend: **http://localhost:5173**
- Backend API: **http://localhost:3001/health**
- Login Master: `admin@trainerroom.com` / `admin123`
- Link cadastro aluno: `http://localhost:5173/t/{slug-do-personal}`

### Comandos Úteis
```bash
bun run dev:backend       # Só API
bun run dev:frontend      # Só Web App
bun run db:studio         # Drizzle Studio (GUI banco)
bun run build             # Builda backend + frontend
```

---

## 🔐 Segurança e Isolamento Multi-Tenant
- Todo `SELECT/UPDATE/DELETE` de TRAINER/STUDENT passa por `WHERE tenant_id = req.auth.tenantId`
- Student só vê seus treinos (middleware checa `workout.studentId === req.auth.studentId`)
- Rotas protegidas por `requireRole(...)` e `requireTenant`
- JWT com payload `{ userId, role, tenantId, studentId }` e expiração 7d
- Passwords com bcrypt (cost 10)
- Zod validation em todas as rotas (sanitização de input)

---

## 📝 Próximos Passos (Backlog)
- [ ] **Notificações Push** (Web Push API + Service Worker)
- [ ] **Upload logo** (S3 / Cloudflare R2)
- [ ] **Exercícios library** (banco pré-cadastrado de exercícios com GIFs)
- [ ] **PWA installável**: manifest.json + service worker cache
- [ ] **Chat aluno ↔ personal** (integração WhatsApp Cloud API nativo)
- [ ] **Assinatura**: integração Stripe (cobrança por personal ativo)
- [ ] **RLS triggers** no Postgres para segurança extra em queries brutas
