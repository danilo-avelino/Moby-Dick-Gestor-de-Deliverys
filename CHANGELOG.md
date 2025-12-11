# Changelog

Todas as mudanças notáveis deste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

## [0.2.0] – 2025-12-11 – Estoque Completo

### Adicionado

- **Módulo completo de estoque**:
  - Importação de estoque a partir de planilhas Excel
  - Requisições de estoque por chef de cozinha
  - Aprovação de requisições pelo setor de estoque/diretor
  - Histórico completo de movimentações de estoque
  - Registro de perdas/desperdício com categorização
  - Dashboard de estoque com métricas em tempo real

- **Integrações de estoque com CMV**:
  - Cálculo automático de CMV por produto
  - Relatórios de CMV integrados ao dashboard
  - Alertas de estoque baixo

- **Sistema de permissões por cargo**:
  - Diretor: acesso total ao sistema
  - Estoque: gestão de estoque e aprovação de requisições
  - Chef de Cozinha: requisições de estoque e gestão de receitas
  - Líder de Despacho: visualização de pedidos e despacho

- **Gestão de Receitas**:
  - Categorias de receitas
  - Tipos de receita (Porcionamento, Produção, Preparação)
  - Cálculo automático de custo por porção
  - Integração com produtos do estoque

- **Gestão de Usuários**:
  - CRUD completo de usuários
  - Atribuição de cargos e restaurantes
  - Redefinição de senhas

### Melhorado

- UX nas telas ligadas ao estoque
- Performance do dashboard
- Sistema de autenticação com roles
- Interface do módulo de produtos

### Corrigido

- Problemas de permissão em rotas protegidas
- Cálculos de CMV em receitas
- Sincronização de estoque entre restaurantes

## [0.1.0] – 2025-12-08 – Versão Inicial

### Adicionado

- Estrutura inicial do projeto (monorepo com Turborepo)
- Sistema de autenticação JWT
- Gestão básica de produtos
- Integração com iFood (estrutura)
- Dashboard inicial
- Tema Moby Dick (branding)
