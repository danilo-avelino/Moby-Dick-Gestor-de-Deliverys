import { useState, useRef, useCallback, useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import {
    ArrowLeft, Loader2, Plus, Trash2, ChefHat, DollarSign, Clock, Package, AlertTriangle,
    Check
} from 'lucide-react';
import toast from 'react-hot-toast';

interface Ingredient {
    id?: string;
    ingredientType: 'PRODUCT' | 'RECIPE';
    productId?: string;
    subRecipeId?: string;
    quantity: number;
    unit: string;
    isOptional?: boolean;
    name?: string;
    estimatedCost?: number;
    matched?: boolean;
}

interface AIRecipeResult {
    name: string;
    description: string;
    ingredients: Ingredient[];
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

export default function RecipeForm() {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isEdit = !!id;
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Form state
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [categoryId, setCategoryId] = useState(''); // Legacy Product Category
    const [type, setType] = useState('FINAL_PRODUCT');
    const [status, setStatus] = useState('DRAFT');
    const [recipeCategoryId, setRecipeCategoryId] = useState('');
    const [outputProductId, setOutputProductId] = useState('');
    const [yieldQuantity, setYieldQuantity] = useState(1);
    const [yieldUnit, setYieldUnit] = useState('porção');
    const [prepTimeMinutes, setPrepTimeMinutes] = useState<number | undefined>();
    const [cookTimeMinutes, setCookTimeMinutes] = useState<number | undefined>();
    const [instructions, setInstructions] = useState('');
    const [currentPrice, setCurrentPrice] = useState<number | undefined>();
    const [packagingCost, setPackagingCost] = useState(0);
    const [laborCost, setLaborCost] = useState(0);
    const [overheadPercent, setOverheadPercent] = useState(0);
    const [ingredients, setIngredients] = useState<Ingredient[]>([]);

    // AI state
    const [showAIPanel, setShowAIPanel] = useState(false);
    const [aiText, setAiText] = useState('');
    const [aiImages, setAiImages] = useState<string[]>([]);
    const [aiAudioTranscript, setAiAudioTranscript] = useState('');
    const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
    const [audioUrl, setAudioUrl] = useState<string | null>(null);
    const [targetCMV, setTargetCMV] = useState(30);
    const [isRecording, setIsRecording] = useState(false);
    const [aiResult, setAiResult] = useState<AIRecipeResult | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);

    // Load existing recipe
    const { data: recipe, isLoading } = useQuery({
        queryKey: ['recipe', id],
        queryFn: () => api.get(`/api/recipes/${id}`).then((r) => r.data.data),
        enabled: isEdit,
    });

    // Load products for ingredient selection
    const { data: productsData } = useQuery({
        queryKey: ['products-simple'],
        queryFn: () => api.get('/api/products?limit=200').then((r) => r.data.data.data),
    });

    // Load categories
    const { data: categories } = useQuery({
        queryKey: ['categories-flat'],
        queryFn: () => api.get('/api/categories/flat').then((r) => r.data.data),
    });

    // Check AI availability
    const { data: aiStatus } = useQuery({
        queryKey: ['ai-status'],
        queryFn: () => api.get('/api/recipes/ai/status').then((r) => r.data.data),
    });

    // Load recipe categories
    const { data: recipeCategories } = useQuery({
        queryKey: ['recipe-categories'],
        queryFn: () => api.get('/api/recipe-categories').then((r) => r.data),
    });

    const products = productsData || [];

    // Initialize form with existing data
    // Initialize form
    useEffect(() => {
        if (recipe) {
            setName(recipe.name || '');
            setDescription(recipe.description || '');
            setCategoryId(recipe.categoryId || ''); // Legacy
            setRecipeCategoryId(recipe.recipeCategoryId || '');
            setType(recipe.type || 'FINAL_PRODUCT');
            setStatus(recipe.status || 'DRAFT');

            setYieldQuantity(recipe.yieldQuantity || 1);
            setYieldUnit(recipe.yieldUnit || 'porção');
            setPrepTimeMinutes(recipe.prepTimeMinutes);
            setCookTimeMinutes(recipe.cookTimeMinutes);
            setInstructions(recipe.instructions || '');
            setCurrentPrice(recipe.currentPrice);
            setPackagingCost(recipe.packagingCost || 0);
            setLaborCost(recipe.laborCost || 0);
            setOverheadPercent(recipe.overheadPercent || 0);
            setIngredients(recipe.ingredients?.map((i: any) => ({
                id: i.id,
                ingredientType: i.ingredientType,
                productId: i.product?.id || i.productId,
                subRecipeId: i.subRecipeId,
                quantity: i.quantity,
                unit: i.unit,
                isOptional: i.isOptional,
                name: i.product?.name || i.subRecipe?.name,
                estimatedCost: i.costSnapshot * i.quantity,
                matched: true,
            })) || []);
        } else if (!isEdit) {
            const t = searchParams.get('type');
            const c = searchParams.get('recipeCategoryId');
            if (t) setType(t);
            if (c) setRecipeCategoryId(c);
        }
    }, [recipe, isEdit, searchParams]);

    // Create/Update mutation
    const saveMutation = useMutation({
        mutationFn: async (data: any) => {
            const payload = {
                ...data,
                type,
                status,
                recipeCategoryId,
                outputProductId: outputProductId || undefined,
                targetCmv: targetCMV,
            };

            if (isEdit) {
                return api.patch(`/api/recipes/${id}`, payload);
            }
            return api.post('/api/recipes', payload);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['recipes'] });
            toast.success(isEdit ? 'Receita atualizada!' : 'Receita criada!');
            navigate('/recipes');
        },
        onError: () => toast.error('Erro ao salvar receita'),
    });

    // AI Generation mutation
    const aiGenerateMutation = useMutation({
        mutationFn: async (data: { text?: string; images?: string[]; audioTranscript?: string; targetCMV: number }) => {
            return api.post('/api/recipes/ai/generate', data);
        },
        onSuccess: (response) => {
            const result = response.data.data as AIRecipeResult;
            setAiResult(result);
            toast.success('Receita gerada pela IA!');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao gerar com IA');
        },
    });

    // AI Generation with Files mutation
    const aiGenerateWithFilesMutation = useMutation({
        mutationFn: async (formData: FormData) => {
            return api.post('/api/recipes/ai/generate-with-files', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
        },
        onSuccess: (response) => {
            const result = response.data.data as AIRecipeResult;
            setAiResult(result);
            toast.success('Receita gerada pela IA!');
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao gerar com IA');
        },
    });

    // Calculate total cost
    const calculateTotalCost = useCallback(() => {
        let total = 0;
        for (const ing of ingredients) {
            if (ing.productId) {
                const product = products.find((p: any) => p.id === ing.productId);
                if (product) {
                    total += product.avgCost * ing.quantity;
                }
            } else if (ing.estimatedCost) {
                total += ing.estimatedCost;
            }
        }
        return total * (1 + overheadPercent / 100) + laborCost + packagingCost;
    }, [ingredients, products, overheadPercent, laborCost, packagingCost]);

    const totalCost = calculateTotalCost();
    const costPerUnit = yieldQuantity > 0 ? totalCost / yieldQuantity : 0;
    const suggestedPrice = costPerUnit / (targetCMV / 100);
    const actualCMV = currentPrice ? (costPerUnit / currentPrice) * 100 : null;

    // Handle image upload
    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach((file) => {
            const reader = new FileReader();
            reader.onloadend = () => {
                setAiImages((prev) => [...prev.slice(0, 4), reader.result as string]);
            };
            reader.readAsDataURL(file);
        });
    };

    // Handle audio recording
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });

            // Prioritize formats supported by Gemini (MP4/AAC, OGG). Fallback to WebM.
            const mimeTypes = [
                'audio/mp4',
                'audio/ogg',
                'audio/webm;codecs=opus',
                'audio/webm'
            ];
            const selectedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
            const options = selectedType ? { mimeType: selectedType } : undefined;

            const mediaRecorder = new MediaRecorder(stream, options);
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = () => {
                const mimeType = mediaRecorder.mimeType || 'audio/webm';
                const blob = new Blob(audioChunksRef.current, { type: mimeType });
                const url = URL.createObjectURL(blob);
                setAudioBlob(blob);
                setAudioUrl(url);
                setAiAudioTranscript(''); // Clear placeholder
                stream.getTracks().forEach((track) => track.stop());
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (error) {
            console.error('Error accessing microphone:', error);
            toast.error('Não foi possível acessar o microfone');
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const clearAudio = () => {
        if (audioUrl) {
            URL.revokeObjectURL(audioUrl);
        }
        setAudioBlob(null);
        setAudioUrl(null);
    };

    const handleGenerateWithAI = () => {
        if (!aiText && aiImages.length === 0 && !audioBlob && !aiAudioTranscript) {
            toast.error('Adicione texto, imagens ou áudio');
            return;
        }

        if (audioBlob) {
            const formData = new FormData();
            if (aiText) formData.append('text', aiText);
            formData.append('targetCMV', targetCMV.toString());

            // Determine extension from mime type
            const extension = audioBlob.type.split('/')[1]?.split(';')[0] || 'webm';
            formData.append('file', audioBlob, `recording.${extension}`);

            // Handle images (base64 to blob) if any
            aiImages.forEach((imgBase64, index) => {
                try {
                    const byteString = atob(imgBase64.split(',')[1]);
                    const mimeString = imgBase64.split(',')[0].split(':')[1].split(';')[0];
                    const ab = new ArrayBuffer(byteString.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < byteString.length; i++) {
                        ia[i] = byteString.charCodeAt(i);
                    }
                    const blob = new Blob([ab], { type: mimeString });
                    formData.append('file', blob, `image-${index}.${mimeString.split('/')[1]}`);
                } catch (e) {
                    console.error('Error converting image to blob', e);
                }
            });

            aiGenerateWithFilesMutation.mutate(formData);
        } else {
            // Use JSON endpoint as before
            aiGenerateMutation.mutate({
                text: aiText,
                images: aiImages,
                audioTranscript: aiAudioTranscript,
                targetCMV,
            });
        }
    };

    // Apply AI result to form
    const applyAIResult = () => {
        if (!aiResult) return;

        setName(aiResult.name);
        setDescription(aiResult.description);
        setInstructions(aiResult.instructions);
        setPrepTimeMinutes(aiResult.prepTimeMinutes);
        setCookTimeMinutes(aiResult.cookTimeMinutes);
        setYieldQuantity(aiResult.yieldQuantity);
        setYieldUnit(aiResult.yieldUnit);
        setCurrentPrice(aiResult.suggestedPrice);

        // Map ingredients
        const mappedIngredients: Ingredient[] = aiResult.ingredients.map((ing, idx) => ({
            id: `temp-${idx}`,
            ingredientType: 'PRODUCT' as const,
            productId: ing.productId,
            quantity: ing.quantity,
            unit: ing.unit,
            isOptional: false,
            name: ing.name,
            estimatedCost: ing.estimatedCost,
            matched: ing.matched,
        }));

        setIngredients(mappedIngredients);
        setShowAIPanel(false);
        toast.success('Dados aplicados ao formulário!');
    };

    // Add ingredient
    const addIngredient = () => {
        setIngredients([
            ...ingredients,
            {
                ingredientType: 'PRODUCT',
                productId: '',
                quantity: 1,
                unit: 'un',
            },
        ]);
    };

    // Remove ingredient
    const removeIngredient = (index: number) => {
        setIngredients(ingredients.filter((_, i) => i !== index));
    };

    // Update ingredient
    const updateIngredient = (index: number, updates: Partial<Ingredient>) => {
        setIngredients(
            ingredients.map((ing, i) => (i === index ? { ...ing, ...updates } : ing))
        );
    };

    // Handle submit
    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            toast.error('Nome é obrigatório');
            return;
        }

        if (ingredients.length === 0) {
            toast.error('Adicione pelo menos um ingrediente');
            return;
        }

        const data = {
            name,
            description,
            categoryId: categoryId || undefined,
            yieldQuantity,
            yieldUnit,
            prepTimeMinutes,
            cookTimeMinutes,
            instructions,
            currentPrice,
            packagingCost,
            laborCost,
            overheadPercent,
            ingredients: ingredients.map((ing) => ({
                ingredientType: ing.ingredientType,
                productId: ing.productId || undefined,
                subRecipeId: ing.subRecipeId || undefined,
                quantity: ing.quantity,
                unit: ing.unit,
                isOptional: ing.isOptional || false,
            })),
        };

        saveMutation.mutate(data);
    };

    if (isEdit && isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-6 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-lg">
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            {isEdit ? 'Editar Receita' : 'Nova Ficha Técnica'}
                        </h1>
                        <p className="text-gray-400">Configure ingredientes, custos e preço sugerido</p>
                    </div>
                </div>

                {/* AI Button - DISABLED
                <button
                    onClick={() => {
                        if (aiStatus?.available) {
                            setShowAIPanel(!showAIPanel);
                        } else {
                            toast.error('Configure GOOGLE_API_KEY no arquivo .env para usar a IA');
                        }
                    }}
                    className={`btn ${showAIPanel ? 'btn-secondary' : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white'} ${!aiStatus?.available ? 'opacity-60' : ''}`}
                    title={!aiStatus?.available ? 'Configure GOOGLE_API_KEY para ativar' : 'Criar ficha técnica com IA'}
                >
                    <Sparkles className="w-5 h-5" />
                    {showAIPanel ? 'Fechar IA' : 'Criar com IA'}
                </button>
                */}
            </div>

            {/* AI Panel - DISABLED
            {showAIPanel && (
                <div className="glass-card border-2 border-purple-500/30 bg-gradient-to-br from-purple-900/20 to-pink-900/20">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                            <Sparkles className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h3 className="font-semibold text-white">Assistente de IA</h3>
                            <p className="text-sm text-gray-400">
                                Descreva o prato com texto, fotos ou áudio para gerar a ficha técnica automaticamente
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <label className="label">Descrição do Prato</label>
                                <textarea
                                    value={aiText}
                                    onChange={(e) => setAiText(e.target.value)}
                                    className="input min-h-[120px]"
                                    placeholder="Ex: Strogonoff de frango cremoso com champignon, servido com arroz branco e batata palha. Rende 4 porções..."
                                />
                            </div>

                            <div>
                                <label className="label">Fotos do Prato</label>
                                <div className="flex flex-wrap gap-2">
                                    {aiImages.map((img, idx) => (
                                        <div key={idx} className="relative w-20 h-20 rounded-lg overflow-hidden">
                                            <img src={img} alt="" className="w-full h-full object-cover" />
                                            <button
                                                onClick={() => setAiImages(aiImages.filter((_, i) => i !== idx))}
                                                className="absolute top-1 right-1 p-1 bg-red-500 rounded-full"
                                            >
                                                <X className="w-3 h-3 text-white" />
                                            </button>
                                        </div>
                                    ))}
                                    {aiImages.length < 5 && (
                                        <button
                                            onClick={() => fileInputRef.current?.click()}
                                            className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-600 hover:border-purple-500 flex flex-col items-center justify-center text-gray-500 hover:text-purple-400 transition-colors"
                                        >
                                            <Camera className="w-6 h-6" />
                                            <span className="text-xs mt-1">Foto</span>
                                        </button>
                                    )}
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={handleImageUpload}
                                    className="hidden"
                                />
                            </div>

                            <div>
                                <label className="label">Gravação de Áudio</label>
                                <div className="flex items-center gap-3 mb-2">
                                    <button
                                        onClick={isRecording ? stopRecording : startRecording}
                                        type="button"
                                        className={`p-3 rounded-full transition-all ${isRecording ? 'bg-red-500 hover:bg-red-600 animate-pulse' : 'bg-white/5 hover:bg-white/10'}`}
                                    >
                                        {isRecording ? <MicOff className="w-5 h-5 text-white" /> : <Mic className="w-5 h-5 text-purple-400" />}
                                    </button>

                                    <div className="flex-1">
                                        {isRecording ? (
                                            <p className="text-red-400 animate-pulse">Gravando... (Clique para parar)</p>
                                        ) : audioUrl ? (
                                            <div className="flex items-center gap-2">
                                                <audio src={audioUrl} controls className="h-8 w-full max-w-[240px] rounded" />
                                                <button
                                                    onClick={clearAudio}
                                                    type="button"
                                                    className="p-2 hover:bg-red-500/20 rounded-lg hover:text-red-400 text-gray-400 transition-colors"
                                                    title="Apagar áudio"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ) : (
                                            <p className="text-gray-400 text-sm">Clique no microfone para descrever o prato</p>
                                        )}
                                    </div>
                                </div>

                                {!audioUrl && !isRecording && (
                                    <input
                                        type="text"
                                        value={aiAudioTranscript}
                                        onChange={(e) => setAiAudioTranscript(e.target.value)}
                                        className="input mt-2"
                                        placeholder="Ou digite a transcrição manualmente..."
                                    />
                                )}
                            </div>

                            <div>
                                <label className="label">CMV Alvo (%)</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="range"
                                        min="15"
                                        max="50"
                                        value={targetCMV}
                                        onChange={(e) => setTargetCMV(Number(e.target.value))}
                                        className="flex-1"
                                    />
                                    <span className="w-12 text-center font-bold text-white">{targetCMV}%</span>
                                </div>
                                <p className="text-xs text-gray-500 mt-1">
                                    O preço sugerido será calculado para atingir este CMV
                                </p>
                            </div>

                            <button
                                onClick={handleGenerateWithAI}
                                disabled={aiGenerateMutation.isPending || aiGenerateWithFilesMutation.isPending || (!aiText && aiImages.length === 0 && !audioBlob && !aiAudioTranscript)}
                                className="btn w-full bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white disabled:opacity-50"
                            >
                                {aiGenerateMutation.isPending || aiGenerateWithFilesMutation.isPending ? (
                                    <>
                                        <RefreshCw className="w-5 h-5 animate-spin" />
                                        Gerando...
                                    </>
                                ) : (
                                    <>
                                        <Sparkles className="w-5 h-5" />
                                        Gerar Ficha Técnica
                                    </>
                                )}
                            </button>
                        </div>

                        <div className="space-y-4">
                            {aiResult ? (
                                <>
                                    <div className="p-4 bg-white/5 rounded-xl">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="font-semibold text-white">{aiResult.name}</h4>
                                            <span className="text-xs px-2 py-1 bg-purple-500/20 text-purple-400 rounded-full">
                                                {Math.round(aiResult.confidence * 100)}% confiança
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-400 mb-3">{aiResult.description}</p>

                                        <div className="grid grid-cols-3 gap-2 text-center mb-4">
                                            <div className="p-2 bg-white/5 rounded-lg">
                                                <p className="text-xs text-gray-500">Custo Est.</p>
                                                <p className="font-bold text-white">{formatCurrency(aiResult.estimatedCost)}</p>
                                            </div>
                                            <div className="p-2 bg-white/5 rounded-lg">
                                                <p className="text-xs text-gray-500">Preço Sug.</p>
                                                <p className="font-bold text-green-400">{formatCurrency(aiResult.suggestedPrice)}</p>
                                            </div>
                                            <div className="p-2 bg-white/5 rounded-lg">
                                                <p className="text-xs text-gray-500">CMV</p>
                                                <p className="font-bold text-yellow-400">{aiResult.targetCMV}%</p>
                                            </div>
                                        </div>

                                        <div className="space-y-2 max-h-40 overflow-y-auto">
                                            <p className="text-xs font-medium text-gray-400">Ingredientes:</p>
                                            {aiResult.ingredients.map((ing, idx) => (
                                                <div key={idx} className="flex items-center justify-between text-sm">
                                                    <span className={ing.matched ? 'text-white' : 'text-yellow-400'}>
                                                        {ing.matched ? '✓' : '⚠'} {ing.name}
                                                    </span>
                                                    <span className="text-gray-400">
                                                        {ing.quantity} {ing.unit}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        {aiResult.suggestions && aiResult.suggestions.length > 0 && (
                                            <div className="mt-4 p-3 bg-yellow-500/10 rounded-lg">
                                                <p className="text-xs font-medium text-yellow-400 mb-1">Sugestões:</p>
                                                {aiResult.suggestions.map((s, idx) => (
                                                    <p key={idx} className="text-xs text-gray-400">• {s}</p>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <button
                                        onClick={applyAIResult}
                                        className="btn btn-primary w-full"
                                    >
                                        <Check className="w-5 h-5" />
                                        Aplicar ao Formulário
                                    </button>
                                </>
                            ) : (
                                <div className="flex flex-col items-center justify-center h-full text-center py-12">
                                    <ImageIcon className="w-12 h-12 text-gray-600 mb-4" />
                                    <p className="text-gray-400">
                                        Adicione uma descrição, foto ou áudio e clique em "Gerar" para criar a ficha técnica automaticamente
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            */}

            {/* Main Form */}
            <form onSubmit={handleSubmit} className="space-y-6">
                {/* Basic Info */}
                <div className="glass-card">
                    <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                        <ChefHat className="w-5 h-5 text-primary-400" />
                        Informações Básicas
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="label">Nome da Receita *</label>
                            <input
                                type="text"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="input"
                                placeholder="Ex: Strogonoff de Frango"
                                required
                            />
                        </div>

                        <div className="md:col-span-2">
                            <label className="label">Descrição</label>
                            <textarea
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="input min-h-[80px]"
                                placeholder="Descrição do prato..."
                            />
                        </div>

                        <div>
                            <label className="label">Categoria</label>
                            <select
                                value={categoryId}
                                onChange={(e) => setCategoryId(e.target.value)}
                                className="input"
                            >
                                <option value="">Nenhuma</option>
                                {(categories || []).map((c: any) => (
                                    <option key={c.id} value={c.id}>
                                        {c.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <div>
                                <label className="label">Rendimento</label>
                                <input
                                    type="number"
                                    value={yieldQuantity}
                                    onChange={(e) => setYieldQuantity(Number(e.target.value))}
                                    className="input"
                                    min="0.1"
                                    step="0.1"
                                />
                            </div>
                            <div>
                                <label className="label">Unidade</label>
                                <input
                                    type="text"
                                    value={yieldUnit}
                                    onChange={(e) => setYieldUnit(e.target.value)}
                                    className="input"
                                    placeholder="porção"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="label flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Tempo de Preparo (min)
                            </label>
                            <input
                                type="number"
                                value={prepTimeMinutes || ''}
                                onChange={(e) => setPrepTimeMinutes(e.target.value ? Number(e.target.value) : undefined)}
                                className="input"
                                min="0"
                            />
                        </div>

                        <div>
                            <label className="label flex items-center gap-2">
                                <Clock className="w-4 h-4" /> Tempo de Cozimento (min)
                            </label>
                            <input
                                type="number"
                                value={cookTimeMinutes || ''}
                                onChange={(e) => setCookTimeMinutes(e.target.value ? Number(e.target.value) : undefined)}
                                className="input"
                                min="0"
                            />
                        </div>
                    </div>
                </div>

                {/* Ingredients */}
                <div className="glass-card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white flex items-center gap-2">
                            <Package className="w-5 h-5 text-primary-400" />
                            Ingredientes
                        </h3>
                        <button type="button" onClick={addIngredient} className="btn btn-secondary">
                            <Plus className="w-4 h-4" /> Adicionar
                        </button>
                    </div>

                    {ingredients.length === 0 ? (
                        <div className="text-center py-8 text-gray-400">
                            <Package className="w-10 h-10 mx-auto mb-2 opacity-50" />
                            <p>Nenhum ingrediente adicionado</p>
                            <button type="button" onClick={addIngredient} className="btn btn-primary mt-4">
                                <Plus className="w-4 h-4" /> Adicionar Primeiro Ingrediente
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {ingredients.map((ing, idx) => {
                                const product = products.find((p: any) => p.id === ing.productId);
                                const ingCost = product ? product.avgCost * ing.quantity : ing.estimatedCost || 0;

                                return (
                                    <div key={idx} className="flex items-center gap-3 p-3 bg-white/5 rounded-lg">
                                        <div className="flex-1 grid grid-cols-12 gap-2 items-center">
                                            <div className="col-span-5">
                                                <select
                                                    value={ing.productId || ''}
                                                    onChange={(e) => {
                                                        const prod = products.find((p: any) => p.id === e.target.value);
                                                        updateIngredient(idx, {
                                                            productId: e.target.value,
                                                            unit: prod?.baseUnit || ing.unit,
                                                            name: prod?.name,
                                                            matched: true,
                                                        });
                                                    }}
                                                    className="input text-sm"
                                                >
                                                    <option value="">Selecionar produto...</option>
                                                    {products.map((p: any) => (
                                                        <option key={p.id} value={p.id}>
                                                            {p.name}
                                                        </option>
                                                    ))}
                                                </select>
                                                {!ing.matched && ing.name && (
                                                    <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                                                        <AlertTriangle className="w-3 h-3" />
                                                        Sugestão IA: {ing.name}
                                                    </p>
                                                )}
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="number"
                                                    value={ing.quantity}
                                                    onChange={(e) => updateIngredient(idx, { quantity: Number(e.target.value) })}
                                                    className="input text-sm"
                                                    min="0.001"
                                                    step="0.001"
                                                />
                                            </div>
                                            <div className="col-span-2">
                                                <input
                                                    type="text"
                                                    value={ing.unit}
                                                    onChange={(e) => updateIngredient(idx, { unit: e.target.value })}
                                                    className="input text-sm"
                                                    placeholder="un"
                                                />
                                            </div>
                                            <div className="col-span-2 text-right">
                                                <span className="text-sm font-medium text-white">
                                                    {formatCurrency(ingCost)}
                                                </span>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeIngredient(idx)}
                                            className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Costs & Pricing */}
                <div className="glass-card">
                    <h3 className="font-semibold text-white mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-primary-400" />
                        Custos e Precificação
                    </h3>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div>
                            <label className="label">Custo de Embalagem (R$)</label>
                            <input
                                type="number"
                                value={packagingCost}
                                onChange={(e) => setPackagingCost(Number(e.target.value))}
                                className="input"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="label">Custo de Mão de Obra (R$)</label>
                            <input
                                type="number"
                                value={laborCost}
                                onChange={(e) => setLaborCost(Number(e.target.value))}
                                className="input"
                                min="0"
                                step="0.01"
                            />
                        </div>
                        <div>
                            <label className="label">Overhead (%)</label>
                            <input
                                type="number"
                                value={overheadPercent}
                                onChange={(e) => setOverheadPercent(Number(e.target.value))}
                                className="input"
                                min="0"
                                max="100"
                            />
                        </div>
                    </div>

                    {/* Summary Cards */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                        <div className="p-4 bg-white/5 rounded-xl text-center">
                            <p className="text-xs text-gray-500">Custo Total</p>
                            <p className="text-xl font-bold text-white">{formatCurrency(totalCost)}</p>
                        </div>
                        <div className="p-4 bg-white/5 rounded-xl text-center">
                            <p className="text-xs text-gray-500">Custo/Porção</p>
                            <p className="text-xl font-bold text-white">{formatCurrency(costPerUnit)}</p>
                        </div>
                        <div className="p-4 bg-green-500/10 rounded-xl text-center">
                            <p className="text-xs text-gray-500">Preço Sugerido</p>
                            <p className="text-xl font-bold text-green-400">{formatCurrency(suggestedPrice)}</p>
                            <p className="text-xs text-gray-500">para {targetCMV}% CMV</p>
                        </div>
                        <div className={`p-4 rounded-xl text-center ${actualCMV && actualCMV > 35 ? 'bg-red-500/10' : 'bg-white/5'}`}>
                            <p className="text-xs text-gray-500">CMV Atual</p>
                            <p className={`text-xl font-bold ${actualCMV && actualCMV > 35 ? 'text-red-400' : 'text-white'}`}>
                                {actualCMV ? `${actualCMV.toFixed(1)}%` : '-'}
                            </p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">CMV Alvo (%)</label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="range"
                                    min="15"
                                    max="50"
                                    value={targetCMV}
                                    onChange={(e) => setTargetCMV(Number(e.target.value))}
                                    className="flex-1"
                                />
                                <span className="w-12 text-center font-bold text-white">{targetCMV}%</span>
                            </div>
                        </div>
                        <div>
                            <label className="label">Preço de Venda Atual (R$)</label>
                            <input
                                type="number"
                                value={currentPrice || ''}
                                onChange={(e) => setCurrentPrice(e.target.value ? Number(e.target.value) : undefined)}
                                className="input"
                                min="0"
                                step="0.01"
                                placeholder={suggestedPrice.toFixed(2)}
                            />
                        </div>
                    </div>
                </div>

                {/* Instructions */}
                <div className="glass-card">
                    <h3 className="font-semibold text-white mb-4">Modo de Preparo</h3>
                    <textarea
                        value={instructions}
                        onChange={(e) => setInstructions(e.target.value)}
                        className="input min-h-[150px]"
                        placeholder="Descreva o passo a passo do preparo..."
                    />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                    <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
                        Cancelar
                    </button>
                    <button type="submit" disabled={saveMutation.isPending} className="btn btn-primary">
                        {saveMutation.isPending ? (
                            <>
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Salvando...
                            </>
                        ) : (
                            <>
                                <Check className="w-5 h-5" />
                                {isEdit ? 'Atualizar' : 'Criar'} Receita
                            </>
                        )}
                    </button>
                </div>
            </form>
        </div>
    );
}
