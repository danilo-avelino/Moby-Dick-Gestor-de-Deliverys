import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { X, Save, Plus, Trash2, ChevronDown, ChevronUp, AlertTriangle, Upload, Image as ImageIcon } from 'lucide-react';
import { NumericFormat } from 'react-number-format';
// Removed unused react-select import
import { compressImage } from '../../../utils/imageUtils';

// Types
interface Option {
    id?: string;
    name: string;
    price: number;
    sortOrder?: number;
}
interface OptionGroup {
    id?: string;
    name: string;
    selectionType: 'SINGLE' | 'MULTIPLE';
    isRequired: boolean;
    minOptions: number;
    maxOptions: number;
    options: Option[];
}
interface MenuItemData {
    id?: string;
    menuCategoryId: string;
    name: string;
    description: string;
    price: number;
    imageUrl?: string;
    isActive: boolean;
    displayInPdv: boolean;
    optionGroups: OptionGroup[];
    recipeId?: string;
    costSnapshot?: number;
    markupPercent?: number;
}
interface Recipe {
    id: string;
    name: string;
    currentCost: number;
    yieldUnit: string;
    category?: { id: string; name: string };
}
interface RecipeCategory {
    id: string;
    name: string;
}

interface Props {
    categoryId: string;
    item?: any; // Simplify typing for now to match API response
    onClose: () => void;
    onSave: () => void;
}

export default function MenuItemForm({ categoryId, item, onClose, onSave }: Props) {
    const [activeTab, setActiveTab] = useState<'GENERAL' | 'MODIFIERS' | 'COST'>('GENERAL');
    const [isLoading, setIsLoading] = useState(false);
    const [recipes, setRecipes] = useState<Recipe[]>([]);
    const [recipeCategories, setRecipeCategories] = useState<RecipeCategory[]>([]);
    const [selectedRecipeCategoryId, setSelectedRecipeCategoryId] = useState<string>('');

    // Form State
    const [formData, setFormData] = useState<MenuItemData>({
        menuCategoryId: categoryId,
        name: item?.name || '',
        description: item?.description || '',
        price: item?.price || 0,
        isActive: item?.isActive ?? true,
        displayInPdv: item?.displayInPdv ?? true,
        optionGroups: item?.optionGroups || [],
        recipeId: item?.recipeId || '',
        costSnapshot: item?.costSnapshot || 0,
        markupPercent: item?.markupPercent || 0,
    });

    // Fetch Recipes and Categories
    useEffect(() => {
        Promise.all([
            api.get('/api/recipes?limit=100'),
            api.get('/api/recipe-categories')
        ]).then(([resRecipes, resCats]) => {
            // Handle paginated response for recipes: res.data.data is the payload object, data.data is the array
            const recipesPayload = resRecipes.data?.data;
            const recipesData = recipesPayload?.data && Array.isArray(recipesPayload.data)
                ? recipesPayload.data
                : [];

            setRecipes(recipesData);
            setRecipeCategories(Array.isArray(resCats.data) ? resCats.data : []);

            // If editing an item with a recipe, pre-select its category
            if (item?.recipeId) {
                const linkedRecipe = recipesData.find((r: Recipe) => r.id === item.recipeId);
                if (linkedRecipe?.category?.id) {
                    setSelectedRecipeCategoryId(linkedRecipe.category.id);
                }
            }
        }).catch(err => {
            console.error("Failed to fetch recipes/categories", err);
            setRecipes([]);
        });
    }, [item]);

    // Fetch detailed item if editing (to get deep option groups)
    useEffect(() => {
        if (item?.id) {
            api.get(`/api/menu/items/${item.id}`).then(res => {
                setFormData(prev => ({ ...prev, ...res.data.data }));
            });
        }
    }, [item]);

    // Cost Logic Helpers (local state for UI)
    const [targetCmv, setTargetCmv] = useState<number>(30); // Default 30%

    // Update targetCmv when item loads or cost/price changes externally (initial load)
    useEffect(() => {
        if (item?.price && item?.costSnapshot) {
            const cmv = (item.costSnapshot / item.price) * 100;
            if (isFinite(cmv) && cmv > 0) setTargetCmv(parseFloat(cmv.toFixed(1)));
        }
    }, [item]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            // Sanitize Option Groups (remove empty options)
            const cleanOptionGroups = formData.optionGroups.map(group => ({
                ...group,
                options: group.options.filter(opt => opt.name.trim() !== '')
            })).filter(group => group.name.trim() !== ''); // Remove empty groups too? Maybe not, checking name min(1)

            // Sanitize payload
            // Sanitize payload
            const payload = {
                ...formData,
                menuCategoryId: categoryId,
                description: formData.description || undefined,
                recipeId: formData.recipeId || undefined, // Send undefined if falsy
                price: Number(formData.price),
                costSnapshot: Number(formData.costSnapshot || 0),
                markupPercent: Number(formData.markupPercent || 0),
                taxPercent: (formData as any).taxPercent || undefined,
                internalNotes: (formData as any).internalNotes || undefined,
                optionGroups: cleanOptionGroups
            };

            console.log('Saving item payload:', payload);

            if (item?.id) {
                await api.put(`/api/menu/items/${item.id}`, payload);
            } else {
                await api.post('/api/menu/items', payload);
            }
            onSave();
        } catch (error: any) {
            console.error('Failed to save item:', error);

            const apiError = error?.response?.data;
            let msg = apiError?.error?.message || apiError?.message || 'Erro ao salvar item. Verifique se todos os campos obrigatórios estão preenchidos.';

            if (apiError?.error?.code === 'VALIDATION_ERROR' && apiError.error.details) {
                const details = Object.entries(apiError.error.details)
                    .map(([field, msgs]) => `- ${field.replace('body.', '')}: ${(msgs as string[]).join(', ')}`)
                    .join('\n');
                msg += `\n\nDetalhes do erro:\n${details}`;
            }

            alert(msg);
        } finally {
            setIsLoading(false);
        }
    };

    // ... (keep handleImageUpload)

    // Cost Logic Calculation
    const selectedRecipe = Array.isArray(recipes) ? recipes.find(r => r.id === formData.recipeId) : null;
    const currentCost = selectedRecipe ? selectedRecipe.currentCost : (formData.costSnapshot || 0);

    // Calculate Suggested Price based on Target CMV
    // Price = Cost / (CMV / 100)
    const suggestedPrice = targetCmv > 0 && currentCost > 0
        ? currentCost / (targetCmv / 100)
        : 0;

    // Calculate Markup from suggested price to keep backend happy (if we save it)
    // Markup = ((Price - Cost) / Cost) * 100
    // We update formData.markupPercent when we accept the price

    // Alert if CMV > 100% (Price < Cost) or other warnings
    const marginAlert = targetCmv >= 100;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4 transition-opacity">
            <div className="bg-white dark:bg-slate-900 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col border border-white/10">
                {/* Header */}
                <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-700">
                    <h2 className="text-xl font-bold text-slate-800 dark:text-white">
                        {item?.id ? 'Editar Item' : 'Novo Item'}
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
                        <X size={24} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800/50">
                    <button
                        type="button"
                        className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'GENERAL' ? 'bg-white dark:bg-slate-900 border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        onClick={() => setActiveTab('GENERAL')}
                    >
                        Geral
                    </button>
                    <button
                        type="button"
                        className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'MODIFIERS' ? 'bg-white dark:bg-slate-900 border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        onClick={() => setActiveTab('MODIFIERS')}
                    >
                        Adicionais
                    </button>
                    <button
                        type="button"
                        className={`px-6 py-3 text-sm font-medium transition-colors ${activeTab === 'COST' ? 'bg-white dark:bg-slate-900 border-b-2 border-blue-600 text-blue-600 dark:text-blue-400' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200'}`}
                        onClick={() => setActiveTab('COST')}
                    >
                        Ficha Técnica
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 text-slate-800 dark:text-slate-200">
                    <form id="menu-item-form" onSubmit={handleSave} className="space-y-6">
                        {activeTab === 'GENERAL' && (
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Nome do Item</label>
                                    <input
                                        type="text"
                                        required
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        placeholder="Ex: X-Bacon"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Descrição</label>
                                    <textarea
                                        rows={3}
                                        className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                        placeholder="Descrição detalhada do item..."
                                    />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Preço (R$)</label>
                                        <NumericFormat
                                            value={formData.price}
                                            onValueChange={(values) => setFormData({ ...formData, price: values.floatValue || 0 })}
                                            thousandSeparator="."
                                            decimalSeparator=","
                                            decimalScale={2}
                                            fixedDecimalScale
                                            prefix="R$ "
                                            className="mt-1 block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border"
                                            placeholder="R$ 0,00"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-6 pt-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.isActive}
                                            onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Ativo no Cardápio</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={formData.displayInPdv}
                                            onChange={e => setFormData({ ...formData, displayInPdv: e.target.checked })}
                                            className="rounded border-gray-300 text-blue-600 focus:ring-blue-500 h-4 w-4"
                                        />
                                        <span className="text-sm text-gray-700 dark:text-gray-300">Disponível no PDV</span>
                                    </label>
                                </div>
                            </div>
                        )}

                        {activeTab === 'MODIFIERS' && (
                            <div className="text-center py-12 bg-gray-50 dark:bg-slate-800/50 rounded border border-dashed border-gray-300 dark:border-slate-600">
                                <Plus className="mx-auto text-gray-400 mb-2" size={32} />
                                <p className="text-gray-500 dark:text-gray-400">Configuração de Adicionais em desenvolvimento.</p>
                                <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Implementação pendente.</p>
                            </div>
                        )}

                        {activeTab === 'COST' && (
                            <div className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Categoria da Ficha Técnica</label>
                                    <div className="relative">
                                        <select
                                            className="block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border appearance-none"
                                            value={selectedRecipeCategoryId}
                                            onChange={e => {
                                                setSelectedRecipeCategoryId(e.target.value);
                                                // Reset recipe selection when category changes
                                                setFormData({ ...formData, recipeId: '' });
                                            }}
                                        >
                                            <option value="" className="text-gray-500">Todas as Categorias</option>
                                            {recipeCategories.map(cat => (
                                                <option key={cat.id} value={cat.id} className="text-gray-900 dark:text-white">
                                                    {cat.name}
                                                </option>
                                            ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-400">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Vincular Receita (Item)</label>
                                    <div className="relative">
                                        <select
                                            className="block w-full rounded-md border-gray-300 dark:border-slate-600 dark:bg-slate-800 dark:text-white shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border appearance-none"
                                            value={formData.recipeId || ''}
                                            onChange={e => {
                                                const rid = e.target.value;
                                                const rec = recipes.find(r => r.id === rid);
                                                setFormData({
                                                    ...formData,
                                                    recipeId: rid,
                                                    costSnapshot: rec ? rec.currentCost : 0
                                                });
                                            }}
                                            disabled={!selectedRecipeCategoryId && recipeCategories.length > 0}
                                        >
                                            <option value="" className="text-gray-500">Selecione uma receita...</option>
                                            {recipes
                                                .filter(r => !selectedRecipeCategoryId || r.category?.id === selectedRecipeCategoryId)
                                                .map(r => (
                                                    <option key={r.id} value={r.id} className="text-gray-900 dark:text-white">
                                                        {r.name} - {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(r.currentCost)}
                                                    </option>
                                                ))}
                                        </select>
                                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700 dark:text-gray-400">
                                            <ChevronDown size={14} />
                                        </div>
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Ao vincular uma receita, o custo será atualizado automaticamente.</p>
                                </div>

                                {formData.recipeId && (
                                    <div className="bg-white dark:bg-slate-800 p-4 rounded border shadow-sm space-y-4 dark:border-slate-700">
                                        <div className="grid grid-cols-3 gap-6 text-center">
                                            <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded border border-transparent dark:border-slate-700">
                                                <div className="text-sm text-gray-500 dark:text-gray-400">Custo (CMV)</div>
                                                <div className="text-lg font-bold text-gray-800 dark:text-white">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(currentCost)}
                                                </div>
                                            </div>
                                            <div className="p-3 bg-gray-50 dark:bg-slate-900 rounded border border-transparent dark:border-slate-700">
                                                <div className="text-sm text-gray-500 dark:text-gray-400">CMV Esperado (%)</div>
                                                <div className="flex items-center justify-center gap-2">
                                                    <input
                                                        type="number"
                                                        className="w-20 text-center border-b border-gray-300 dark:border-slate-600 focus:border-blue-500 bg-transparent font-bold text-gray-900 dark:text-white"
                                                        value={targetCmv}
                                                        onChange={e => setTargetCmv(parseFloat(e.target.value) || 0)}
                                                    />
                                                    <span className="text-gray-700 dark:text-gray-300">%</span>
                                                </div>
                                            </div>
                                            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded border border-blue-100 dark:border-blue-800">
                                                <div className="text-sm text-blue-600 dark:text-blue-400 font-medium">Preço Sugerido</div>
                                                <div className="text-lg font-bold text-blue-700 dark:text-blue-300">
                                                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(suggestedPrice)}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex justify-center">
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    const newPrice = parseFloat(suggestedPrice.toFixed(2));
                                                    const markup = currentCost > 0 ? ((newPrice - currentCost) / currentCost) * 100 : 0;
                                                    setFormData(prev => ({
                                                        ...prev,
                                                        price: newPrice,
                                                        markupPercent: parseFloat(markup.toFixed(2))
                                                    }));
                                                    setActiveTab('GENERAL');
                                                }}
                                                className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline font-medium"
                                            >
                                                Usar este preço sugerido
                                            </button>
                                        </div>

                                        {marginAlert && (
                                            <div className="mt-4 flex items-start gap-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 p-3 rounded border border-red-100 dark:border-red-900/30">
                                                <AlertTriangle className="flex-shrink-0" size={20} />
                                                <div className="text-sm">
                                                    <strong>Atenção:</strong> O CMV está acima de 100%, o que significa prejuízo.
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer */}
                <div className="p-4 border-t bg-gray-50 dark:bg-slate-800 flex justify-end gap-3 rounded-b-lg border-gray-200 dark:border-slate-700">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-sm font-medium transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isLoading}
                        className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-600 disabled:opacity-50 flex items-center gap-2 transition-colors"
                    >
                        <Save size={18} />
                        Salvar Item
                    </button>
                </div>
            </div>
        </div>
    );
}
