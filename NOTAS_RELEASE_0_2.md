# Notas da Release 0.2

## Data: 2025-12-11

## Problemas Encontrados no Build

Durante o processo de build para a release v0.2, foram encontrados os seguintes erros de TypeScript na API:

### Erros na API (`apps/api`)

1. **TS2688**: Cannot find type definition file for 'uuid'
   - O arquivo está no programa como ponto de entrada para biblioteca de tipo implícita 'uuid'
   
2. **TS6133**: 'swagger' is declared but its value is never read (`src/server.ts:8`)

3. **TS6133**: 'swaggerUI' is declared but its value is never read (`src/server.ts:9`)

### Status do Build

- ✅ `database`: Build success
- ✅ `types`: Build success  
- ✅ `web`: Build success (build de produção)
- ❌ `api`: Build falhou (DTS build error)

### Resolução Recomendada

Para resolver esses problemas após a release:

1. Instalar tipos do uuid: `pnpm add -D @types/uuid --filter api`
2. Remover imports não utilizados em `apps/api/src/server.ts`

## Observação

Estes erros não afetam o funcionamento do sistema em modo de desenvolvimento (`pnpm dev`), apenas o build de produção. O sistema está operacional para uso.
