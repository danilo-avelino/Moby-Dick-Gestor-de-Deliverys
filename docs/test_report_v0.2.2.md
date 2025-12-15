
# Relatório de Testes Manuais - Moby Dick v0.2.2

**Data**: 13/12/2025
**Versão**: v0.2.2 (Commit: `a8e3648`)
**Usuário de Teste**: Admin (Diretor)
**Ambiente**: Desenvolvimento Local (localhost:5173 / API:3001)

## Visão Geral

Foi realizada uma passada completa pelas principais funcionalidades do sistema, focando em navegação, abertura de modais e ações de criação/edição.

| Módulo / Aba | Status | Observações | screenshots |
|---|---|---|---|
| **Dashboard** | ✅ Sucesso | Carregamento de cards métricos visível. | `01_dashboard_load` |
| **Produtos** | ✅ Sucesso | Listagem, Novo Produto (Modal) e Edição funcionais. | `02_products`, `03_new_product`, `04_edit` |
| **Estoque** | ✅ Sucesso | Visão geral e abas internas funcionais. | `05_stock`, `06_movements` |
| **Requisições** | ⚠️ Atenção | Listagem OK. Ao clicar em "Nova Requisição", o modal abre, mas houve comportamento atípico de URL (possível redirecionamento rápido). Modal funcional. | `07_requests`, `08_new_request` |
| **Fichas Técnicas** | ✅ Sucesso | Listagem e Modal de Nova Ficha funcionais. | `09_recipes`, `10_new_recipe` |
| **Compras** | ✅ Sucesso | Listagem e Modal de Nova Lista Automática funcionais. | `12_purchases`, `13_new_purchase` |
| **PDV (Ponto de Venda)** | ✅ Sucesso | Abertura de caixa/Novo Pedido funcional. | `14_pdv`, `15_new_order` |
| **Gestão de Usuários** | ✅ Sucesso | Listagem e Modal de Novo Usuário funcionais. | `16_admin_users`, `17_new_user` |
| **Configurações** | 🔄 Não Testado | Não alcançado devido a limite de tempo, mas acessível via menu. | - |

## Problemas Encontrados

1. **Requisições de Estoque**: Comportamento de navegação ao abrir "Nova Requisição" precisa de revisão. O teste indicou uma possível mudança de rota para `/alerts` ou similar, embora o modal tenha aberto.
2. **Performance**: Em algumas transições de página, o carregamento inicial pode demorar alguns segundos (esperado em dev).

## Erros de Console
Não foram identificados erros críticos (crash/tela branca) ou erros de rede (500/404) durante o fluxo principal. Apenas warnings de desenvolvimento (React Router / Vite) foram observados.

## Conclusão
O sistema na versão v0.2.2 apresenta estabilidade nas funções principais (CRUDs básicos e navegação). Os fluxos de criação (modais) estão respondendo corretamente em todas as áreas testadas.
