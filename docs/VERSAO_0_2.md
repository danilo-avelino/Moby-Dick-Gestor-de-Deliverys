# Versão 0.2 – Estoque Completo

**Data de Lançamento:** 11 de Dezembro de 2025

## Sobre Esta Versão

A versão 0.2 é a primeira versão do Moby Dick com o **módulo de estoque completo** implementado. Esta release marca um marco importante no desenvolvimento do sistema, trazendo todas as funcionalidades essenciais para gestão de estoque em restaurantes.

## Funcionalidades Principais

### 📦 Importação de Estoque

- Importe a posição atual do estoque através de planilhas Excel
- Suporte a múltiplos formatos de dados
- Validação automática dos dados importados

**Como acessar:** Menu lateral → Estoque → Botão "Importar Planilha"

### 📋 Requisições de Estoque

- Chefs de cozinha podem solicitar itens do estoque
- Sistema de requisições com status (Pendente, Aprovado, Rejeitado, Parcial)
- Histórico completo de todas as requisições

**Como acessar:** Menu lateral → Requisições de Estoque

### ✅ Aprovação de Requisições

- Setor de estoque e diretores podem aprovar ou rejeitar requisições
- Baixa automática do estoque após aprovação
- Possibilidade de aprovação parcial

**Como acessar:** Menu lateral → Requisições de Estoque → Aba "Para Aprovar"

### 📊 Dashboard de Estoque

- Visão geral do estoque atual
- Alertas de produtos com estoque baixo
- Produtos próximos do vencimento

**Como acessar:** Menu lateral → Estoque

### 🔄 Registro de Perdas

- Registre perdas e desperdícios de estoque
- Categorização por tipo de perda
- Histórico de perdas para análise

**Como acessar:** Menu lateral → Estoque → Botão "Registrar Perda"

### 📈 Integração com CMV

- Cálculo automático de Custo de Mercadoria Vendida
- Integração com receitas do sistema
- Relatórios de CMV por produto e receita

**Como acessar:** Dashboard → Card de CMV

## Permissões por Cargo

| Cargo | Estoque | Requisições | Aprovar | Receitas | Usuários |
|-------|---------|-------------|---------|----------|----------|
| Diretor | ✅ Total | ✅ Criar/Ver | ✅ Sim | ✅ Total | ✅ Gerenciar |
| Estoque | ✅ Total | ✅ Ver | ✅ Sim | ❌ | ❌ |
| Chef de Cozinha | 📖 Consulta | ✅ Criar | ❌ | ✅ Total | ❌ |
| Líder de Despacho | 📖 Consulta | 📖 Ver | ❌ | 📖 Ver | ❌ |

## Requisitos

- Node.js 18 ou superior
- PostgreSQL 14 ou superior
- pnpm 8.10 ou superior

## Documentação Adicional

- [README.md](../README.md) - Instruções de instalação
- [CHANGELOG.md](../CHANGELOG.md) - Histórico completo de mudanças
- [ACESSO_EXTERNO.md](../ACESSO_EXTERNO.md) - Configuração de acesso externo
