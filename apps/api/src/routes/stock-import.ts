import { FastifyInstance } from 'fastify';
import multipart from '@fastify/multipart';
import { requireCostCenter } from '../middleware/auth';
import { importStockFromExcel } from '../services/stock-import.service';
import type { ApiResponse } from 'types';

export async function stockImportRoutes(fastify: FastifyInstance) {
    // Register multipart plugin for this route
    // Removed: handled globally in server.ts
    // await fastify.register(multipart, {
    //     limits: {
    //         fileSize: 10 * 1024 * 1024, // 10MB max
    //     },
    // });

    // Import stock from Excel file
    fastify.post('/import', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Stock Import'],
            summary: 'Import stock from Excel file',
            description: `
                Importa estoque a partir de um arquivo Excel (.xlsx).
                
                A planilha deve conter uma aba chamada "Posição de estoque" com as seguintes colunas:
                - Data
                - Ingrediente
                - Grupo ingrediente
                - Estoque Atual (formato: "2,3600KG")
                - Qtde Conferida
                - Diferença
                - Valor unitário
                - Total
            `,
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        console.log('📦 Stock Import Request');
        console.log('Headers:', request.headers);
        console.log('Is Multipart:', request.isMultipart());

        try {
            // Get the uploaded file
            const data = await request.file();
            console.log('File data received:', data ? { filename: data.filename, mimetype: data.mimetype } : 'null');

            if (!data) {
                const response: ApiResponse = {
                    success: false,
                    error: {
                        code: 'NO_FILE',
                        message: 'Nenhum arquivo enviado',
                    },
                };
                return reply.status(400).send(response);
            }

            // Validate file type
            const filename = data.filename.toLowerCase();
            if (!filename.endsWith('.xlsx') && !filename.endsWith('.xls')) {
                const response: ApiResponse = {
                    success: false,
                    error: {
                        code: 'INVALID_FILE_TYPE',
                        message: 'Tipo de arquivo inválido. Envie um arquivo Excel (.xlsx ou .xls)',
                    },
                };
                return reply.status(400).send(response);
            }

            // Read file buffer
            const buffer = await data.toBuffer();

            // Get options from fields (if multipart has fields)
            let sobrescreverEstoqueAtual = false;
            try {
                const fields = data.fields as Record<string, any>;
                if (fields?.sobrescreverEstoqueAtual) {
                    sobrescreverEstoqueAtual = fields.sobrescreverEstoqueAtual.value === 'true';
                }
            } catch {
                // Ignore field parsing errors
            }

            // Process the import
            const result = await importStockFromExcel(buffer, request.user!.organizationId!, {
                sobrescreverEstoqueAtual,
            });

            // Prepare response
            const response: ApiResponse = {
                success: result.success,
                data: {
                    totalRows: result.totalRows,
                    importedRows: result.importedRows,
                    createdProducts: result.createdProducts,
                    updatedProducts: result.updatedProducts,
                    createdCategories: result.createdCategories,
                    errors: result.errors,
                    message: result.success
                        ? `Importação concluída! ${result.importedRows} de ${result.totalRows} linhas importadas. ` +
                        `${result.createdProducts} produtos criados, ${result.updatedProducts} produtos atualizados.`
                        : `Erro na importação. ${result.errors.length} erros encontrados.`,
                },
            };

            return reply.status(result.success ? 200 : 400).send(response);
        } catch (error: any) {
            console.error('Stock Import Route Error:', error);
            const response: ApiResponse = {
                success: false,
                error: {
                    code: 'IMPORT_ERROR',
                    message: `Debug: ${error.message || 'Erro desconhecido'} (Stack: ${error.stack?.substring(0, 100)})`,
                },
            };
            return reply.status(500).send(response);
        }
    });

    // Get import template info
    fastify.get('/import/template', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Stock Import'],
            summary: 'Get import template information',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const response: ApiResponse = {
            success: true,
            data: {
                sheetName: 'Posição de estoque',
                columns: [
                    { name: 'Data', description: 'Data do estoque (formato: dd/MM/yyyy)', required: true, example: '09/12/2025' },
                    { name: 'Ingrediente', description: 'Nome do ingrediente/produto', required: true, example: 'ABACATE (KG)' },
                    { name: 'Grupo ingrediente', description: 'Categoria do ingrediente', required: true, example: 'HORTIFRUTI' },
                    { name: 'Estoque Atual', description: 'Quantidade atual + unidade (4 casas decimais)', required: true, example: '2,3600KG' },
                    { name: 'Qtde Conferida', description: 'Quantidade conferida manualmente', required: false, example: '0' },
                    { name: 'Diferença', description: 'Diferença entre estoque atual e conferido', required: false, example: '' },
                    { name: 'Valor unitário', description: 'Custo unitário do produto', required: true, example: '7.20' },
                    { name: 'Total', description: 'Valor total em estoque', required: false, example: '16,99' },
                ],
                supportedUnits: ['KG', 'G', 'UN', 'L', 'ML', 'CX', 'Fardo', 'Pacote', 'Balde', 'MC', 'Rolo'],
                notes: [
                    'O arquivo deve ser um Excel (.xlsx ou .xls)',
                    'A aba deve se chamar "Posição de estoque"',
                    'Quantidades usam vírgula como separador decimal (ex: 2,3600)',
                    'Valores monetários podem usar ponto ou vírgula como separador decimal',
                    'Ingredientes inexistentes serão criados automaticamente',
                    'Categorias inexistentes serão criadas automaticamente',
                ],
            },
        };

        return reply.send(response);
    });
}
