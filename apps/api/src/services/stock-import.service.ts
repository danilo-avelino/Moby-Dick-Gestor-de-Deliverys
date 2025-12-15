import * as XLSX from 'xlsx';
import { prisma } from 'database';

// Expected column names (exact match)
const EXPECTED_COLUMNS = [
    'Data',
    'Ingrediente',
    'Grupo ingrediente',
    'Estoque Atual',
    'Qtde Conferida',
    'Diferença',
    'Valor unitário',
    'Total'
];

const SHEET_NAME = 'Posição de estoque';

interface ImportedStockItem {
    dataEstoque: Date;
    nomeInsumo: string;
    grupoInsumo: string;
    quantidade: number;
    unidade: string;
    custoUnitario: number;
    valorTotal: number;
    quantidadeConferida: number;
    diferenca: number | null;
}

interface ImportResult {
    success: boolean;
    totalRows: number;
    importedRows: number;
    createdProducts: number;
    updatedProducts: number;
    createdCategories: number;
    errors: Array<{ row: number; field: string; value: string; message: string }>;
}

/**
 * Parse "Estoque Atual" field that comes in format like "2,3600KG" or "5,0000Fardo 12x"
 * Returns { quantidade: number, unidade: string }
 */
function parseEstoqueAtual(value: string): { quantidade: number; unidade: string } | null {
    if (!value || typeof value !== 'string') {
        return null;
    }

    // Clean up any whitespace
    const cleanValue = value.trim();

    // Regex: capture decimal number with comma (4 decimal places) + rest as unit
    // Pattern: digits, comma, 4 digits, then anything else
    const regex = /^(\d+,\d{4})(.*)$/;
    const match = cleanValue.match(regex);

    if (!match) {
        // Try alternative format with dot instead of comma
        const regexDot = /^(\d+\.\d{4})(.*)$/;
        const matchDot = cleanValue.match(regexDot);

        if (!matchDot) {
            // Try format with fewer decimal places
            const regexAlt = /^(\d+[,.]?\d*)(.*)$/;
            const matchAlt = cleanValue.match(regexAlt);

            if (matchAlt) {
                const quantidadeStr = matchAlt[1].replace(',', '.');
                const quantidade = parseFloat(quantidadeStr);
                const unidade = matchAlt[2].trim() || 'UN';

                if (!isNaN(quantidade)) {
                    return { quantidade, unidade };
                }
            }
            return null;
        }

        const quantidade = parseFloat(matchDot[1]);
        const unidade = matchDot[2].trim() || 'UN';
        return { quantidade, unidade };
    }

    // Convert quantity: replace comma with dot
    const quantidadeStr = match[1].replace(',', '.');
    const quantidade = parseFloat(quantidadeStr);
    const unidade = match[2].trim() || 'UN';

    return { quantidade, unidade };
}

/**
 * Parse date in format "dd/MM/yyyy" to Date object
 */
function parseDate(value: string | number | Date): Date | null {
    if (value instanceof Date) {
        return value;
    }

    if (typeof value === 'number') {
        // Excel serial date number
        const date = XLSX.SSF.parse_date_code(value);
        if (date) {
            return new Date(date.y, date.m - 1, date.d);
        }
        return null;
    }

    if (typeof value !== 'string') {
        return null;
    }

    // Parse "dd/MM/yyyy"
    const parts = value.split('/');
    if (parts.length !== 3) {
        return null;
    }

    const day = parseInt(parts[0], 10);
    const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
    const year = parseInt(parts[2], 10);

    if (isNaN(day) || isNaN(month) || isNaN(year)) {
        return null;
    }

    return new Date(year, month, day);
}

/**
 * Parse Brazilian decimal format (comma as separator)
 */
function parseDecimal(value: string | number | null | undefined): number {
    if (value === null || value === undefined || value === '') {
        return 0;
    }

    if (typeof value === 'number') {
        return value;
    }

    // Replace comma with dot and parse
    const cleaned = value.toString().replace(',', '.');
    const parsed = parseFloat(cleaned);

    return isNaN(parsed) ? 0 : parsed;
}

/**
 * Map unit string to UnitType enum
 */
function getUnitType(unidade: string): 'WEIGHT' | 'VOLUME' | 'UNIT' | 'LENGTH' {
    const lowerUnit = unidade.toLowerCase();

    if (['kg', 'g', 'mg'].includes(lowerUnit)) {
        return 'WEIGHT';
    }
    if (['l', 'ml', 'litro', 'litros'].includes(lowerUnit)) {
        return 'VOLUME';
    }
    if (['m', 'cm', 'mm', 'mc'].includes(lowerUnit)) {
        return 'LENGTH';
    }

    return 'UNIT';
}

/**
 * Import stock from Excel buffer
 */
export async function importStockFromExcel(
    buffer: Buffer,
    organizationId: string,
    options: {
        sobrescreverEstoqueAtual?: boolean;
    } = {}
): Promise<ImportResult> {
    const result: ImportResult = {
        success: false,
        totalRows: 0,
        importedRows: 0,
        createdProducts: 0,
        updatedProducts: 0,
        createdCategories: 0,
        errors: [],
    };

    try {
        // Read workbook
        const workbook = XLSX.read(buffer, { type: 'buffer' });

        // Check if sheet exists
        if (!workbook.SheetNames.includes(SHEET_NAME)) {
            // Try to find a similar sheet name
            const foundSheet = workbook.SheetNames.find(
                name => name.toLowerCase().includes('posição') || name.toLowerCase().includes('estoque')
            );

            if (!foundSheet) {
                result.errors.push({
                    row: 0,
                    field: 'sheet',
                    value: workbook.SheetNames.join(', '),
                    message: `Aba "${SHEET_NAME}" não encontrada. Abas disponíveis: ${workbook.SheetNames.join(', ')}`,
                });
                return result;
            }

            // Use the found sheet
            console.log(`Using sheet "${foundSheet}" instead of "${SHEET_NAME}"`);
        }

        const sheetName = workbook.SheetNames.includes(SHEET_NAME)
            ? SHEET_NAME
            : workbook.SheetNames.find(name => name.toLowerCase().includes('posição') || name.toLowerCase().includes('estoque')) || workbook.SheetNames[0];

        const sheet = workbook.Sheets[sheetName];

        // Convert to JSON
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];

        if (rows.length < 2) {
            result.errors.push({
                row: 0,
                field: 'data',
                value: '',
                message: 'Planilha vazia ou sem dados',
            });
            return result;
        }

        // Get header row
        const header = rows[0] as string[];

        // Validate columns
        const missingColumns = EXPECTED_COLUMNS.filter(col => !header.includes(col));
        if (missingColumns.length > 0) {
            result.errors.push({
                row: 1,
                field: 'header',
                value: header.join(', '),
                message: `Colunas obrigatórias não encontradas: ${missingColumns.join(', ')}`,
            });
            return result;
        }

        // Create column index map
        const colIndex: Record<string, number> = {};
        header.forEach((col, idx) => {
            colIndex[col] = idx;
        });

        // Process data rows
        const dataRows = rows.slice(1).filter(row => row.length > 0 && row.some(cell => cell !== undefined && cell !== ''));
        result.totalRows = dataRows.length;

        // Cache for categories
        const categoryCache = new Map<string, string>(); // name -> id

        // Pre-fetch existing categories
        const existingCategories = await prisma.productCategory.findMany({
            where: { organizationId },
            select: { id: true, name: true },
        });
        existingCategories.forEach(cat => categoryCache.set(cat.name.toUpperCase(), cat.id));

        // Pre-fetch existing products
        const existingProducts = await prisma.product.findMany({
            where: { organizationId },
            select: { id: true, name: true },
        });
        const productMap = new Map<string, string>();
        existingProducts.forEach(p => productMap.set(p.name.toUpperCase(), p.id));

        // Track date for this import
        let importDate: Date | null = null;

        // Process each row
        for (let i = 0; i < dataRows.length; i++) {
            const row = dataRows[i];
            const rowNum = i + 2; // 1-indexed, skip header

            try {
                // Parse Data
                const dataValue = row[colIndex['Data']];
                const dataEstoque = parseDate(dataValue);
                if (!dataEstoque) {
                    result.errors.push({
                        row: rowNum,
                        field: 'Data',
                        value: String(dataValue),
                        message: 'Data inválida. Formato esperado: dd/MM/yyyy',
                    });
                    continue;
                }
                importDate = dataEstoque;

                // Parse Ingrediente
                const nomeInsumo = String(row[colIndex['Ingrediente']] || '').trim();
                if (!nomeInsumo) {
                    result.errors.push({
                        row: rowNum,
                        field: 'Ingrediente',
                        value: '',
                        message: 'Nome do ingrediente é obrigatório',
                    });
                    continue;
                }

                // Parse Grupo ingrediente
                const grupoInsumo = String(row[colIndex['Grupo ingrediente']] || '').trim() || 'SEM CATEGORIA';

                // Parse Estoque Atual
                const estoqueAtualRaw = String(row[colIndex['Estoque Atual']] || '');
                const estoqueAtual = parseEstoqueAtual(estoqueAtualRaw);
                if (!estoqueAtual) {
                    result.errors.push({
                        row: rowNum,
                        field: 'Estoque Atual',
                        value: estoqueAtualRaw,
                        message: 'Formato de estoque inválido. Esperado: "quantidade+unidade" (ex: 2,3600KG)',
                    });
                    continue;
                }

                // Parse Valor unitário
                const custoUnitario = parseDecimal(row[colIndex['Valor unitário']]);

                // Parse Total
                let valorTotal = parseDecimal(row[colIndex['Total']]);
                if (valorTotal === 0 && custoUnitario > 0 && estoqueAtual.quantidade > 0) {
                    valorTotal = estoqueAtual.quantidade * custoUnitario;
                }

                // Parse Qtde Conferida
                const quantidadeConferida = parseDecimal(row[colIndex['Qtde Conferida']]);

                // Parse Diferença
                const diferencaRaw = row[colIndex['Diferença']];
                let diferenca: number | null = null;
                if (diferencaRaw !== undefined && diferencaRaw !== '' && diferencaRaw !== 'NaN' && !isNaN(parseDecimal(diferencaRaw))) {
                    diferenca = parseDecimal(diferencaRaw);
                }

                // Get or create category
                let categoryId = categoryCache.get(grupoInsumo.toUpperCase());
                if (!categoryId) {
                    const newCategory = await prisma.productCategory.create({
                        data: {
                            organizationId,
                            name: grupoInsumo,
                            description: `Categoria importada: ${grupoInsumo}`,
                        },
                    });
                    categoryId = newCategory.id;
                    categoryCache.set(grupoInsumo.toUpperCase(), categoryId);
                    result.createdCategories++;
                }

                // Get or create product
                let productId = productMap.get(nomeInsumo.toUpperCase());
                const unitType = getUnitType(estoqueAtual.unidade);

                if (!productId) {
                    // Create new product
                    const newProduct = await prisma.product.create({
                        data: {
                            organizationId,
                            name: nomeInsumo,
                            categoryId,
                            baseUnit: estoqueAtual.unidade.toLowerCase(),
                            unitType,
                            currentStock: estoqueAtual.quantidade,
                            avgCost: custoUnitario,
                            lastPurchasePrice: custoUnitario,
                            isRawMaterial: true,
                            isActive: true,
                        },
                    });
                    productId = newProduct.id;
                    productMap.set(nomeInsumo.toUpperCase(), productId);
                    result.createdProducts++;
                } else {
                    // Update existing product
                    await prisma.product.update({
                        where: { id: productId },
                        data: {
                            currentStock: estoqueAtual.quantidade,
                            avgCost: custoUnitario > 0 ? custoUnitario : undefined,
                            lastPurchasePrice: custoUnitario > 0 ? custoUnitario : undefined,
                            categoryId, // Update category if changed
                            baseUnit: estoqueAtual.unidade.toLowerCase(),
                            unitType,
                        },
                    });
                    result.updatedProducts++;
                }

                // Create stock movement for the adjustment (if there's a difference from the system)
                await prisma.stockMovement.create({
                    data: {
                        productId,
                        organizationId,
                        type: 'ADJUSTMENT',
                        quantity: estoqueAtual.quantidade,
                        unit: estoqueAtual.unidade.toLowerCase(),
                        costPerUnit: custoUnitario,
                        totalCost: valorTotal,
                        stockBefore: 0, // We don't know the previous stock from import
                        stockAfter: estoqueAtual.quantidade,
                        referenceType: 'INVENTORY',
                        notes: `Importação de estoque - Data: ${dataEstoque.toLocaleDateString('pt-BR')}. Qtde Conferida: ${quantidadeConferida}${diferenca !== null ? `. Diferença: ${diferenca}` : ''}`,
                    },
                });

                result.importedRows++;
            } catch (rowError: any) {
                result.errors.push({
                    row: rowNum,
                    field: 'general',
                    value: '',
                    message: rowError.message || 'Erro ao processar linha',
                });
            }
        }

        // If sobrescreverEstoqueAtual is true, zero out products not in the import
        if (options.sobrescreverEstoqueAtual && importDate) {
            const importedProductIds = new Set(
                Array.from(productMap.values())
            );

            // Find products that weren't in the import
            const productsToZero = await prisma.product.findMany({
                where: {
                    organizationId,
                    isActive: true,
                    id: { notIn: Array.from(importedProductIds) },
                },
            });

            // Zero out their stock
            for (const product of productsToZero) {
                if (product.currentStock > 0) {
                    await prisma.product.update({
                        where: { id: product.id },
                        data: { currentStock: 0 },
                    });

                    await prisma.stockMovement.create({
                        data: {
                            productId: product.id,
                            organizationId,
                            type: 'ADJUSTMENT',
                            quantity: product.currentStock,
                            unit: product.baseUnit,
                            costPerUnit: product.avgCost,
                            totalCost: product.currentStock * product.avgCost,
                            stockBefore: product.currentStock,
                            stockAfter: 0,
                            referenceType: 'INVENTORY',
                            notes: `Zerado na importação de estoque - Produto não constava na planilha de ${importDate.toLocaleDateString('pt-BR')}`,
                        },
                    });
                }
            }
        }

        result.success = result.errors.length === 0 || result.importedRows > 0;
        return result;
    } catch (error: any) {
        result.errors.push({
            row: 0,
            field: 'file',
            value: '',
            message: error.message || 'Erro ao processar arquivo',
        });
        return result;
    }
}
