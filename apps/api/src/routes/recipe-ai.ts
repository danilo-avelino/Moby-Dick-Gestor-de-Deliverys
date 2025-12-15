import { FastifyInstance } from 'fastify';
import { z } from 'zod';
import { requireCostCenter } from '../middleware/auth';
import { errors } from '../middleware/error-handler';
import { recipeAIService } from '../services/recipe-ai.service';
import type { ApiResponse } from 'types';
import multipart from '@fastify/multipart';

const generateRecipeSchema = z.object({
    text: z.string().optional(),
    audioTranscript: z.string().optional(),
    targetCMV: z.number().min(1).max(100).optional().default(30),
    images: z.array(z.string()).optional(), // base64 images
});

const enhanceRecipeSchema = z.object({
    recipeId: z.string(),
});

export async function recipeAIRoutes(fastify: FastifyInstance) {
    // Register multipart for file uploads
    await fastify.register(multipart, {
        limits: {
            fileSize: 10 * 1024 * 1024, // 10MB max per file
            files: 5, // Max 5 files
        },
    });

    // Check if AI is available
    fastify.get('/status', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Recipe AI'],
            summary: 'Check AI service status',
            security: [{ bearerAuth: [] }],
        },
    }, async (_request, reply) => {
        const providerInfo = recipeAIService.getProviderInfo();
        const response: ApiResponse = {
            success: true,
            data: {
                available: recipeAIService.isAvailable(),
                ...providerInfo,
            },
        };
        return reply.send(response);
    });

    // Generate recipe from text/images/audio
    fastify.post('/generate', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Recipe AI'],
            summary: 'Generate recipe using AI',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        if (!recipeAIService.isAvailable()) {
            throw errors.badRequest('AI service not configured. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your environment.');
        }

        const body = generateRecipeSchema.parse(request.body);

        try {
            const result = await recipeAIService.generateRecipe(
                request.user!.costCenterId!,
                {
                    text: body.text,
                    imageBase64: body.images,
                    audioTranscript: body.audioTranscript,
                    targetCMV: body.targetCMV,
                }
            );

            const response: ApiResponse = {
                success: true,
                data: result,
            };

            return reply.send(response);
        } catch (error: any) {
            console.error('AI Generation Error:', error);
            throw errors.internal(`AI generation failed: ${error.message}`);
        }
    });

    // Generate recipe from multipart form (with file uploads)
    fastify.post('/generate-with-files', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Recipe AI'],
            summary: 'Generate recipe from uploaded files',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        if (!recipeAIService.isAvailable()) {
            throw errors.badRequest('AI service not configured. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your environment.');
        }

        const parts = request.parts();

        let text = '';
        let audioTranscript = '';
        let audioBase64 = '';
        let targetCMV = 30;
        const images: string[] = [];

        for await (const part of parts) {
            if (part.type === 'file') {
                // Handle file upload
                const buffer = await part.toBuffer();
                const base64 = buffer.toString('base64');
                const mimeType = part.mimetype;

                if (mimeType.startsWith('image/')) {
                    images.push(`data:${mimeType};base64,${base64}`);
                } else if (mimeType.startsWith('audio/')) {
                    audioBase64 = `data:${mimeType};base64,${base64}`;
                }
            } else {
                // Handle form fields
                const value = part.value as string;
                switch (part.fieldname) {
                    case 'text':
                        text = value;
                        break;
                    case 'audioTranscript':
                        audioTranscript = value;
                        break;
                    case 'targetCMV':
                        targetCMV = parseFloat(value) || 30;
                        break;
                }
            }
        }

        try {
            const result = await recipeAIService.generateRecipe(
                request.user!.costCenterId!,
                {
                    text,
                    imageBase64: images,
                    audioBase64: audioBase64 || undefined,
                    audioTranscript: audioTranscript || undefined,
                    targetCMV,
                }
            );

            const response: ApiResponse = {
                success: true,
                data: result,
            };

            return reply.send(response);
        } catch (error: any) {
            console.error('AI Generation Error:', error);
            throw errors.internal(`AI generation failed: ${error.message}`);
        }
    });

    // Enhance existing recipe with AI suggestions
    fastify.post('/enhance', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Recipe AI'],
            summary: 'Get AI suggestions for existing recipe',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        if (!recipeAIService.isAvailable()) {
            throw errors.badRequest('AI service not configured.');
        }

        const body = enhanceRecipeSchema.parse(request.body);

        try {
            const result = await recipeAIService.enhanceRecipe(
                request.user!.costCenterId!,
                body.recipeId
            );

            const response: ApiResponse = {
                success: true,
                data: result,
            };

            return reply.send(response);
        } catch (error: any) {
            console.error('AI Enhancement Error:', error);
            throw errors.internal(`AI enhancement failed: ${error.message}`);
        }
    });

    // Calculate suggested price based on CMV
    fastify.post('/calculate-price', {
        preHandler: [requireCostCenter],
        schema: {
            tags: ['Recipe AI'],
            summary: 'Calculate suggested price based on target CMV',
            security: [{ bearerAuth: [] }],
        },
    }, async (request, reply) => {
        const schema = z.object({
            cost: z.number().positive(),
            targetCMV: z.number().min(1).max(100),
            packagingCost: z.number().min(0).optional().default(0),
            laborCost: z.number().min(0).optional().default(0),
            overheadPercent: z.number().min(0).max(100).optional().default(0),
        });

        const body = schema.parse(request.body);

        // Total cost including overhead
        const totalCost = (body.cost * (1 + body.overheadPercent / 100)) + body.laborCost + body.packagingCost;

        // Suggested price based on target CMV
        // CMV = Cost / Price => Price = Cost / CMV
        const suggestedPrice = totalCost / (body.targetCMV / 100);

        // Calculate different pricing scenarios
        const scenarios = [
            { cmv: 25, price: totalCost / 0.25, margin: 75 },
            { cmv: 30, price: totalCost / 0.30, margin: 70 },
            { cmv: 35, price: totalCost / 0.35, margin: 65 },
            { cmv: 40, price: totalCost / 0.40, margin: 60 },
        ];

        const response: ApiResponse = {
            success: true,
            data: {
                totalCost,
                targetCMV: body.targetCMV,
                suggestedPrice: Math.ceil(suggestedPrice * 10) / 10,
                marginPercent: 100 - body.targetCMV,
                marginAmount: suggestedPrice - totalCost,
                scenarios: scenarios.map(s => ({
                    ...s,
                    price: Math.ceil(s.price * 10) / 10,
                    marginAmount: (s.price * (1 - s.cmv / 100)),
                })),
            },
        };

        return reply.send(response);
    });
}
