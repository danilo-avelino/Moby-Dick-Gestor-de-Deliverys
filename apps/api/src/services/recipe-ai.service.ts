import { GoogleGenerativeAI, Part } from '@google/generative-ai';
import { prisma } from 'database';

// Types for AI recipe generation
export interface AIRecipeInput {
    text?: string;
    imageBase64?: string[];
    audioBase64?: string; // Real audio
    audioTranscript?: string; // Fallback or additional context
    targetCMV?: number; // percentage, e.g., 30 for 30%
}

export interface AIRecipeIngredient {
    name: string;
    quantity: number;
    unit: string;
    productId?: string;
    estimatedCost?: number;
    matched?: boolean;
}

export interface AIRecipeOutput {
    name: string;
    description: string;
    ingredients: AIRecipeIngredient[];
    instructions: string;
    prepTimeMinutes?: number;
    cookTimeMinutes?: number;
    yieldQuantity: number;
    yieldUnit: string;
    estimatedCost: number;
    suggestedPrice: number;
    targetCMV: number;
    confidence: number;
    suggestions?: string[];
}

export class RecipeAIService {
    private client: GoogleGenerativeAI | null = null;
    private modelName = 'gemini-1.5-flash-001';

    constructor() {
        const apiKey = process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY;
        if (apiKey) {
            this.client = new GoogleGenerativeAI(apiKey);
        }
    }

    isAvailable(): boolean {
        return this.client !== null;
    }

    getProviderInfo() {
        return {
            provider: 'google',
            model: this.modelName,
            capabilities: ['text', 'images', 'audio_transcript', 'audio_file'],
        };
    }

    /**
     * Generate a recipe/technical sheet from text, images, and audio
     */
    async generateRecipe(
        restaurantId: string,
        input: AIRecipeInput
    ): Promise<AIRecipeOutput> {
        if (!this.client) {
            throw new Error('Google AI API key not configured. Please add GOOGLE_API_KEY or GEMINI_API_KEY to your .env file.');
        }

        // Get products from the restaurant for matching
        const products = await prisma.product.findMany({
            where: { restaurantId, isActive: true },
            select: {
                id: true,
                name: true,
                baseUnit: true,
                avgCost: true,
                sku: true,
            },
        });

        const productList = products.map(p =>
            `- ${p.name} (ID: ${p.id}, Unit: ${p.baseUnit}, Cost: R$${p.avgCost.toFixed(2)})`
        ).join('\n');

        const targetCMV = input.targetCMV || 30;

        // Build the prompt
        const systemPrompt = `Você é um chef profissional e especialista em precificação de restaurantes.
Sua tarefa é analisar informações sobre pratos e criar fichas técnicas completas.

PRODUTOS CADASTRADOS NO ESTOQUE:
${productList || 'Nenhum produto cadastrado ainda.'}

REGRAS:
1. Para cada ingrediente, tente encontrar o produto correspondente na lista acima
2. Use as unidades de medida corretas (kg, g, ml, L, un)
3. Seja preciso nas quantidades
4. O CMV alvo é ${targetCMV}% - calcule o preço de venda sugerido baseado nisso
5. Se não encontrar um produto cadastrado, marque como não encontrado e estime o custo

FORMATO DE RESPOSTA (JSON puro, sem markdown):
{
    "name": "Nome do Prato",
    "description": "Descrição breve do prato",
    "ingredients": [
        {
            "name": "Nome do ingrediente",
            "quantity": 0.5,
            "unit": "kg",
            "productId": "id_do_produto_se_encontrado",
            "estimatedCost": 15.00,
            "matched": true
        }
    ],
    "instructions": "Modo de preparo detalhado...",
    "prepTimeMinutes": 30,
    "cookTimeMinutes": 45,
    "yieldQuantity": 4,
    "yieldUnit": "porções",
    "estimatedCost": 45.00,
    "suggestedPrice": 150.00,
    "targetCMV": ${targetCMV},
    "confidence": 0.85,
    "suggestions": ["Sugestões de melhoria ou avisos"]
}`;

        // Build content parts
        const parts: Part[] = [];

        // Add text input
        let userText = systemPrompt + '\n\n';
        if (input.text) {
            userText += `DESCRIÇÃO DO PRATO:\n${input.text}\n\n`;
        }
        if (input.audioBase64) {
            userText += `ÁUDIO FORNECIDO: O áudio anexo contém a descrição da receita. Transcreva-o mentalmente e use as informações para preencher a ficha técnica.\n\n`;
        }
        if (input.audioTranscript) {
            userText += `TRANSCRIÇÃO DE ÁUDIO (CONTEXTO ADICIONAL):\n${input.audioTranscript}\n\n`;
        }

        if (!input.text && !input.audioTranscript && !input.audioBase64 && (!input.imageBase64 || input.imageBase64.length === 0)) {
            throw new Error('Por favor, forneça uma descrição, áudio ou imagem do prato.');
        }

        if (!input.text && !input.audioTranscript && !input.audioBase64) {
            userText += 'Analise as imagens fornecidas e crie uma ficha técnica para o prato.\n\n';
        }

        userText += 'Responda APENAS com o JSON, sem markdown ou explicações adicionais.';

        parts.push({ text: userText });

        // Add images (base64)
        if (input.imageBase64 && input.imageBase64.length > 0) {
            for (const img of input.imageBase64.slice(0, 5)) { // Max 5 images
                let mimeType = 'image/jpeg';
                let imageData = img;

                if (img.startsWith('data:')) {
                    const match = img.match(/^data:(image\/[a-z]+);base64,(.+)$/);
                    if (match) {
                        mimeType = match[1];
                        imageData = match[2];
                    }
                }

                parts.push({
                    inlineData: {
                        mimeType,
                        data: imageData,
                    },
                });
            }
        }

        // Add audio (base64)
        if (input.audioBase64) {
            let mimeType = 'audio/mp3'; // Default
            let audioData = input.audioBase64;

            if (input.audioBase64.startsWith('data:')) {
                // Regex to capture mimeType (ignoring extra params like codecs) and data
                // Supports data:audio/webm;codecs=opus;base64,...
                const match = input.audioBase64.match(/^data:(audio\/[^;]+)(?:;.+)?;base64,(.+)$/);
                if (match) {
                    mimeType = match[1];
                    audioData = match[2];
                }
            }

            parts.push({
                inlineData: {
                    mimeType,
                    data: audioData
                }
            });
        }

        try {
            const model = this.client.getGenerativeModel({ model: this.modelName });

            const result = await model.generateContent(parts);
            const response = result.response;
            const textContent = response.text();

            if (!textContent) {
                throw new Error('No response from AI');
            }

            // Parse JSON from response
            let jsonText = textContent;
            const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
            if (jsonMatch) {
                jsonText = jsonMatch[1].trim();
            } else {
                const rawJsonMatch = textContent.match(/\{[\s\S]*\}/);
                if (rawJsonMatch) {
                    jsonText = rawJsonMatch[0];
                }
            }

            const recipeData: AIRecipeOutput = JSON.parse(jsonText);

            // Validate and enhance with actual product data
            const enhancedIngredients = await this.matchIngredients(
                restaurantId,
                recipeData.ingredients
            );

            // Recalculate cost with actual product prices
            let totalCost = 0;
            for (const ing of enhancedIngredients) {
                totalCost += ing.estimatedCost || 0;
            }

            // Calculate suggested price based on target CMV
            const suggestedPrice = totalCost / (targetCMV / 100);

            return {
                ...recipeData,
                ingredients: enhancedIngredients,
                estimatedCost: totalCost,
                suggestedPrice: Math.ceil(suggestedPrice * 10) / 10,
                targetCMV,
            };
        } catch (error: any) {
            console.error('AI Recipe Generation Error Details:', JSON.stringify(error, null, 2));
            console.error('Original Error Message:', error.message);

            // Verifica se é erro de formato
            if (error.message?.includes('format')) {
                throw new Error(`Formato de arquivo não suportado pelo Gemini. Erro: ${error.message}`);
            }
            if (error.message?.includes('API key')) {
                throw new Error(`Erro de autenticação da API. Verifique a chave.`);
            }
            if (error.message?.includes('quota')) { // Check specifically for quota
                throw new Error(`Limite de uso da API atingido (Quota Exceeded). Tente novamente mais tarde.`);
            }

            throw new Error(`Falha na IA: ${error.message}`);
        }
    }

    /**
     * Match ingredient names to products in the database
     */
    private async matchIngredients(
        restaurantId: string,
        ingredients: AIRecipeIngredient[]
    ): Promise<AIRecipeIngredient[]> {
        const products = await prisma.product.findMany({
            where: { restaurantId, isActive: true },
            select: {
                id: true,
                name: true,
                baseUnit: true,
                avgCost: true,
            },
        });

        return ingredients.map(ing => {
            const normalizedName = ing.name.toLowerCase().trim();

            // Exact match
            let match = products.find(p =>
                p.name.toLowerCase() === normalizedName
            );

            // Partial match
            if (!match) {
                match = products.find(p =>
                    p.name.toLowerCase().includes(normalizedName) ||
                    normalizedName.includes(p.name.toLowerCase())
                );
            }

            if (match) {
                const estimatedCost = match.avgCost * ing.quantity;
                return {
                    ...ing,
                    productId: match.id,
                    estimatedCost,
                    matched: true,
                };
            }

            return {
                ...ing,
                matched: false,
                estimatedCost: ing.estimatedCost || 0,
            };
        });
    }

    /**
     * Enhance an existing recipe with AI suggestions
     */
    async enhanceRecipe(
        restaurantId: string,
        recipeId: string
    ): Promise<{ suggestions: string[]; costReductionPotential?: string; profitOptimizationTips?: string[] }> {
        if (!this.client) {
            throw new Error('Google AI API key not configured.');
        }

        const recipe = await prisma.recipe.findFirst({
            where: { id: recipeId, restaurantId },
            include: {
                ingredients: {
                    include: { product: true },
                },
            },
        });

        if (!recipe) {
            throw new Error('Recipe not found');
        }

        const ingredientList = recipe.ingredients.map(i =>
            `- ${i.product?.name || 'Unknown'}: ${i.quantity} ${i.unit} (Cost: R$${i.costSnapshot.toFixed(2)})`
        ).join('\n');

        const prompt = `Analise esta ficha técnica e sugira melhorias:

RECEITA: ${recipe.name}
${recipe.description || ''}

INGREDIENTES:
${ingredientList}

CUSTO TOTAL: R$${recipe.currentCost.toFixed(2)}
RENDIMENTO: ${recipe.yieldQuantity} ${recipe.yieldUnit}
CUSTO POR PORÇÃO: R$${recipe.costPerUnit.toFixed(2)}
PREÇO ATUAL: ${recipe.currentPrice ? `R$${recipe.currentPrice.toFixed(2)}` : 'Não definido'}

Sugira:
1. Possíveis substituições para reduzir custo
2. Otimizações de preparo
3. Ajustes de precificação
4. Ingredientes que podem aumentar o valor percebido

Responda APENAS com JSON puro (sem markdown):
{
    "suggestions": ["sugestão 1", "sugestão 2", ...],
    "costReductionPotential": "X%",
    "profitOptimizationTips": ["dica 1", "dica 2"]
}`;

        const model = this.client.getGenerativeModel({ model: this.modelName });
        const result = await model.generateContent(prompt);
        const response = result.response;
        const textContent = response.text();

        if (!textContent) {
            throw new Error('No response from AI');
        }

        // Parse JSON from response
        let jsonText = textContent;
        const jsonMatch = textContent.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (jsonMatch) {
            jsonText = jsonMatch[1].trim();
        } else {
            const rawJsonMatch = textContent.match(/\{[\s\S]*\}/);
            if (rawJsonMatch) {
                jsonText = rawJsonMatch[0];
            }
        }

        try {
            return JSON.parse(jsonText);
        } catch {
            return { suggestions: [textContent] };
        }
    }
}

// Singleton instance
export const recipeAIService = new RecipeAIService();
