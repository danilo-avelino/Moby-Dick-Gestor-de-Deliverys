import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { prisma } from 'database';
import { authenticate } from '../middleware/auth';

export async function recipeCategoriesRoutes(app: FastifyInstance) {
    app.addHook('onRequest', authenticate);

    // List categories with counts
    app.get('/', async (request, reply) => {
        const { restaurantId } = request.user!;

        const categories = await prisma.recipeCategory.findMany({
            where: { restaurantId },
            include: {
                recipes: {
                    select: { status: true }
                }
            },
            orderBy: { createdAt: 'asc' }
        });

        const result = categories.map(cat => ({
            id: cat.id,
            name: cat.name,
            totalRecipes: cat.recipes.length,
            completedRecipes: cat.recipes.filter(r => r.status === 'COMPLETE').length
        }));

        return result;
    });

    // Create category
    app.post('/', async (req, reply) => {
        const schema = z.object({
            name: z.string().min(1)
        });

        const { name } = schema.parse(req.body);
        const { restaurantId } = req.user!;

        // Check duplicate
        const existing = await prisma.recipeCategory.findUnique({
            where: {
                restaurantId_name: {
                    restaurantId,
                    name
                }
            }
        });

        if (existing) {
            return reply.status(409).send({ message: 'Categoria já existe.' });
        }

        const category = await prisma.recipeCategory.create({
            data: { name, restaurantId }
        });

        return category;
    });

    // Delete category
    app.delete('/:id', async (req, reply) => {
        const { id } = req.params as { id: string };
        const { restaurantId, role } = req.user!;

        // Only DIRETOR can delete categories
        if (role !== 'DIRETOR' && role !== 'SUPER_ADMIN') {
            return reply.status(403).send({ message: 'Apenas Diretores podem excluir categorias.' });
        }

        // Check ownership
        const cat = await prisma.recipeCategory.findFirst({
            where: { id, restaurantId }
        });

        if (!cat) {
            return reply.status(404).send({ message: 'Categoria não encontrada.' });
        }

        // Check if has recipes?
        // OnDelete Cascade is not set on recipes, it is SetNull.
        // So safe to delete.

        await prisma.recipeCategory.delete({
            where: { id }
        });

        return reply.status(204).send();
    });
}
