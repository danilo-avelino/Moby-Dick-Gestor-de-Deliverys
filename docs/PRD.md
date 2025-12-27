# PRD - Moby Dick Project

## 1. Visão Geral
O **Moby Dick** é uma plataforma SaaS completa de gestão para delivery de restaurantes. O foco principal é fornecer controle total sobre custos, estoque, fichas técnicas e utilizar Inteligência Artificial para otimizar o processo de compras e prever demanda.

## 2. Objetivos
- Centralizar a gestão de múltiplos canais de venda (iFood, Rappi, etc).
- Garantir a precisão do CMV (Custo de Mercadoria Vendida).
- Otimizar o estoque e reduzir desperdícios.
- Automatizar o planejamento de compras.
- Gerenciar escalas de funcionários de forma eficiente.

## 3. Público-Alvo
- Donos de restaurantes.
- Gestores de estoque.
- Chefes de cozinha.
- Operadores de despacho.

## 4. Arquitetura Técnica
- **Frontend**: React + Vite + TailwindCSS.
- **Backend**: Fastify + TypeScript (Node.js).
- **Banco de Dados**: PostgreSQL com Prisma ORM.
- **Cache/Mensageria**: Redis + BullMQ.

## 5. Funcionalidades Detalhadas

### 5.1. MVP (Fase 1)
- **Autenticação**: Sistema robusto com JWT e RBAC (Role Based Access Control).
- **Gestão de Fornecedores**: Cadastro e acompanhamento de performance.
- **Controle de Insumos**: Cadastro de produtos com unidades de medida e conversões.
- **Estoque (PEPS)**: Controle rigoroso de entrada e saída (Primeiro que Entra, Primeiro que Sai).
- **Fichas Técnicas**: Cálculo automático de custo por porção.

### 5.2. Análise e Gestão Avançada (Fase 2)
- **Cálculo de CMV**: Comparativo entre CMV Teórico (baseado em fichas) e CMV Real (baseado em estoque).
- **Análise ABC**: Classificação de insumos por importância financeira.
- **Matriz BCG**: Análise de rentabilidade e popularidade dos itens do cardápio.
- **Gestão de Porcionados**: Controle de sub-receitas e pré-preparos.

### 5.3. Integrações e Automação (Fase 3)
- **Marketplaces**: Integração com iFood, Rappi e Uber Eats.
- **ERPs**: Sincronização com sistemas legados (Linx, TOTVS, etc).
- **Alertas Inteligentes**: Notificações sobre baixo estoque ou anomalias de custo.
- **Metas e Gamificação**: KPI's por setor e incentivos para a equipe.

### 5.4. Inteligência Artificial (Fase 4 - GASS)
- **Sugestão de Compras**: IA que analisa histórico e sugere pedidos.
- **Detecção de Anomalias**: Identificação automática de desvios no consumo ou preços.
- **Análise Preditiva**: Previsão de demanda para datas comemorativas e feriados.

## 6. Novo Módulo: Escalas (Schedules)
Atualmente em implementação, este módulo permite a gestão de turnos e folgas dos colaboradores.

### Requisitos:
- **Setores de Escala**: Definição de setores com necessidades mínimas e máximas de staff por dia da semana.
- **Cadastro de Colaboradores**: Preferências de folga, contratos (dias por semana), indisponibilidades.
- **Configuração Mensal**: Definição de datas bloqueadas ou preferenciais para folgas extras.
- **Geração de Escala**: Matriz de escala mensal por setor.
- **Histórico de Alterações**: Log de quem alterou a escala e o motivo.

## 7. Roadmap de Curto Prazo
1.  Finalizar a estrutura de banco de dados para o módulo de Escalas.
2.  Implementar a interface de visualização da matriz de escala.
3.  Desenvolver o algoritmo básico de distribuição de folgas.
4.  Integrar com o sistema de notificações para avisar colaboradores sobre novas escalas.
