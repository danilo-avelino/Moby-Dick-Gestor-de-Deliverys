# Delivery SaaS Platform

Plataforma completa de gestão de delivery para restaurantes, desenvolvida com foco em controle de custos, estoque, fichas técnicas e inteligência artificial para otimização de compras.

## 🚀 Tecnologias

- **Monorepo**: Turborepo + PNPM Workspaces
- **Backend**: Fastify + TypeScript + Prisma ORM
- **Frontend**: React + Vite + TailwindCSS
- **Banco de Dados**: PostgreSQL
- **Cache/Filas**: Redis + BullMQ
- **Autenticação**: JWT próprio

## 📦 Estrutura do Projeto

```
delivery-saas/
├── apps/
│   ├── api/          # Backend Fastify
│   └── web/          # Frontend React
├── packages/
│   ├── database/     # Prisma schema e client
│   └── types/        # Tipos compartilhados
├── docker-compose.yml
└── turbo.json
```

## 🛠️ Setup

### Pré-requisitos

- Node.js 18+
- PNPM 8+
- Docker e Docker Compose

### Instalação

```bash
# Clone o projeto
git clone <repo-url>
cd delivery-saas

# Instale as dependências
pnpm install

# Suba os containers (PostgreSQL + Redis)
docker-compose up -d

# Configure o .env
cp .env.example .env
# Edite o .env com suas configurações

# Execute as migrations
pnpm db:push

# (Opcional) Seed dos dados de teste
pnpm db:seed

# Inicie o desenvolvimento
pnpm dev
```

### Scripts Disponíveis

```bash
pnpm dev          # Inicia todos os apps em modo dev
pnpm build        # Build de produção
pnpm lint         # Linting
pnpm db:push      # Aplica o schema ao banco
pnpm db:seed      # Popula com dados de teste
pnpm db:studio    # Abre o Prisma Studio
```

## 🔐 Variáveis de Ambiente

```env
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/delivery_saas"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
JWT_SECRET="sua-chave-secreta-aqui"

# API
API_PORT=3001
CORS_ORIGIN="http://localhost:5173"

# Frontend
VITE_API_URL="http://localhost:3001"
```

## 📱 Funcionalidades

### Fase 1 - MVP
- ✅ Autenticação JWT
- ✅ Gestão de Produtos/Insumos
- ✅ Controle de Estoque (PEPS)
- ✅ Fichas Técnicas com custo automático
- ✅ Dashboard com KPIs

### Fase 2 - CMV & Análise
- ✅ Cálculo de CMV real vs teórico
- ✅ Análise ABC de produtos
- ✅ Matriz BCG de cardápio
- ✅ Gestão de porcionados

### Fase 3 - Integrações
- ✅ iFood, Rappi, Uber Eats
- ✅ ERPs (Linx, TOTVS)
- ✅ Alertas inteligentes
- ✅ Metas e gamificação

### Fase 4 - IA
- ✅ Sugestões de compra (GASS)
- ✅ Detecção de anomalias
- ✅ Análise preditiva de consumo

## 🔗 URLs

- **Frontend**: http://localhost:5173
- **API**: http://localhost:3001
- **Swagger**: http://localhost:3001/docs
- **pgAdmin**: http://localhost:5050

## 📄 Licença

MIT
