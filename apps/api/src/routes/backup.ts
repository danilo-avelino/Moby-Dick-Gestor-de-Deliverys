import { FastifyInstance } from 'fastify';
import { prisma } from 'database';
import { authenticate } from '../middleware/auth';

// Helper to convert ISO date strings to Date objects
function deserializeDates(body: any): any {
    if (body === null || body === undefined || typeof body !== "object")
        return body;

    for (const key of Object.keys(body)) {
        const value = body[key];
        if (typeof value === "string") {
            // Regex to match ISO 8601 dates (e.g., 2023-10-25T12:00:00.000Z)
            if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.*/.test(value)) {
                const d = new Date(value);
                if (!isNaN(d.getTime())) {
                    body[key] = d;
                }
            }
        } else if (typeof value === "object") {
            deserializeDates(value);
        }
    }
    return body;
}

export async function backupRoutes(fastify: FastifyInstance) {
    fastify.addHook('preHandler', authenticate);

    fastify.get('/export', {
        schema: {
            tags: ['Backup'],
            summary: 'Export all organization data',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const organizationId = request.user?.organizationId;

        if (!organizationId) {
            return reply.status(400).send({ message: 'Organization ID not found' });
        }

        // Fetch data in order of dependency (parent first)
        const [
            costCenters,
            users,
            suppliers,
            productCategories,
            products,
            recipeCategories,
            recipes,
            stockBatches,
            stockMovements,
            customers,
            userCostCenterAccess
        ] = await Promise.all([
            prisma.costCenter.findMany({ where: { organizationId } }),
            prisma.user.findMany({ where: { organizationId } }),
            prisma.supplier.findMany({ where: { organizationId } }),
            prisma.productCategory.findMany({ where: { organizationId } }),
            prisma.product.findMany({ where: { organizationId } }),
            prisma.recipeCategory.findMany({ where: { organizationId } }),
            // Fetch recipes with ingredients
            prisma.recipe.findMany({
                where: { organizationId },
                include: { ingredients: true }
            }),
            prisma.stockBatch.findMany({ where: { organizationId } }),
            prisma.stockMovement.findMany({ where: { organizationId } }),
            // Include addresses for customers
            prisma.customer.findMany({
                where: { costCenter: { organizationId } },
                include: { addresses: true }
            }),
            prisma.userCostCenterAccess.findMany({ where: { organizationId } })
        ]);

        const backupData = {
            metadata: {
                version: '1.0',
                exportedAt: new Date(),
                organizationId,
                counts: {
                    products: products.length,
                    recipes: recipes.length,
                    movements: stockMovements.length
                }
            },
            data: {
                costCenters,
                users,
                suppliers,
                productCategories,
                products,
                recipeCategories,
                recipes,
                stockBatches,
                stockMovements,
                customers,
                userCostCenterAccess
            }
        };

        return reply
            .header('Content-Disposition', `attachment; filename="backup-${new Date().toISOString().split('T')[0]}.json"`)
            .send(backupData);
    });

    fastify.post('/import', {
        schema: {
            tags: ['Backup'],
            summary: 'Import organization data',
            security: [{ bearerAuth: [] }],
            body: {
                type: 'object',
                properties: {
                    data: { type: 'object' },
                    metadata: { type: 'object' }
                }
            }
        },
    }, async (request, reply) => {
        const organizationId = request.user?.organizationId;
        const body: any = request.body;

        // Deserialize dates
        const backup = deserializeDates(body);

        if (!organizationId) {
            return reply.status(400).send({ message: 'Organization ID not found' });
        }

        if (!backup.data) {
            return reply.status(400).send({ message: 'Invalid backup format' });
        }

        const {
            costCenters,
            users,
            suppliers,
            productCategories,
            products,
            recipeCategories,
            recipes,
            stockBatches,
            stockMovements,
            customers,
            userCostCenterAccess
        } = backup.data;

        try {
            await prisma.$transaction(async (tx) => {
                // 1. Upsert Cost Centers (Base)
                if (costCenters?.length) {
                    for (const item of costCenters) {
                        await tx.costCenter.upsert({
                            where: { id: item.id },
                            update: { ...item, organizationId },
                            create: { ...item, organizationId }
                        });
                    }
                }

                // 2. Upsert Users (Depends on CostCenters if linked)
                if (users?.length) {
                    for (const item of users) {
                        await tx.user.upsert({
                            where: { id: item.id },
                            update: { ...item, organizationId },
                            create: { ...item, organizationId }
                        });
                    }
                }

                // 3. Upsert UserCostCenterAccess
                if (userCostCenterAccess?.length) {
                    for (const item of userCostCenterAccess) {
                        await tx.userCostCenterAccess.upsert({
                            where: { id: item.id },
                            update: { ...item, organizationId },
                            create: { ...item, organizationId }
                        });
                    }
                }

                // 4. Upsert Customers
                if (customers?.length) {
                    for (const item of customers) {
                        const { addresses, ...customerData } = item;
                        await tx.customer.upsert({
                            where: { id: customerData.id },
                            update: { ...customerData, organizationId },
                            create: { ...customerData, organizationId }
                        });

                        // Restore addresses
                        if (addresses?.length) {
                            await tx.customerAddress.deleteMany({ where: { customerId: customerData.id } });
                            await tx.customerAddress.createMany({
                                data: addresses.map((addr: any) => ({ ...addr, customerId: customerData.id }))
                            });
                        }
                    }
                }

                // Upsert Suppliers
                if (suppliers?.length) {
                    for (const item of suppliers) {
                        await tx.supplier.upsert({
                            where: { id: item.id },
                            update: { ...item, organizationId },
                            create: { ...item, organizationId }
                        });
                    }
                }

                // Upsert Categories
                if (productCategories?.length) {
                    for (const item of productCategories) {
                        await tx.productCategory.upsert({
                            where: { id: item.id },
                            update: { ...item, organizationId },
                            create: { ...item, organizationId }
                        });
                    }
                }

                // Upsert Products
                if (products?.length) {
                    for (const item of products) {
                        await tx.product.upsert({
                            where: { id: item.id },
                            update: { ...item, organizationId },
                            create: { ...item, organizationId }
                        });
                    }
                }

                // Upsert Recipe Categories
                if (recipeCategories?.length) {
                    for (const item of recipeCategories) {
                        await tx.recipeCategory.upsert({
                            where: { id: item.id },
                            update: { ...item, organizationId },
                            create: { ...item, organizationId }
                        });
                    }
                }

                // Upsert Recipes (and ingredients)
                if (recipes?.length) {
                    for (const item of recipes) {
                        const { ingredients, ...recipeData } = item;
                        await tx.recipe.upsert({
                            where: { id: recipeData.id },
                            update: { ...recipeData, organizationId },
                            create: { ...recipeData, organizationId }
                        });

                        if (ingredients?.length) {
                            await tx.recipeIngredient.deleteMany({ where: { recipeId: recipeData.id } });
                            await tx.recipeIngredient.createMany({
                                data: ingredients.map((ing: any) => ({ ...ing, recipeId: recipeData.id }))
                            });
                        }
                    }
                }

                // Upsert Batches
                if (stockBatches?.length) {
                    for (const item of stockBatches) {
                        await tx.stockBatch.upsert({
                            where: { id: item.id },
                            update: { ...item, organizationId },
                            create: { ...item, organizationId }
                        });
                    }
                }

                // Upsert Stock Movements
                if (stockMovements?.length) {
                    for (const item of stockMovements) {
                        await tx.stockMovement.upsert({
                            where: { id: item.id },
                            update: { ...item, organizationId },
                            create: { ...item, organizationId }
                        });
                    }
                }
            }, {
                maxWait: 5000,
                timeout: 60000
            });

            return reply.send({ message: 'Backup restored successfully' });
        } catch (error: any) {
            console.error('❌ Backup restore failed:', error);
            if (error.meta) console.error('Meta:', error.meta);
            return reply.status(500).send({ message: 'Failed to restore backup', error: error.message, details: error.meta });
        }
    });
}
