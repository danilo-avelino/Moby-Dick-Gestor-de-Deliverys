
import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import {
    X, Search, Package, ChefHat,
    Scale, ArrowLeft, Loader2, AlertCircle
} from 'lucide-react';
import { formatCurrency } from '../../../lib/utils';
import { useAuthStore } from '../../../stores/auth';

interface IngredientSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (item: SelectedItem) => void;
}

export interface SelectedItem {
    id: string;
    type: 'PRODUCT' | 'RECIPE';
    name: string;
    unit: string;
    cost: number;
}

type SelectionType = 'STOCK' | 'PREPARED' | 'PORTIONED' | null;

export function IngredientSelectionModal({ isOpen, onClose, onSelect }: IngredientSelectionModalProps) {
    const [selectionType, setSelectionType] = useState<SelectionType>(null);
    const [search, setSearch] = useState('');
    const { user } = useAuthStore();

    // Fetch Products (Stock)
    const { data: products, isLoading: isLoadingProducts } = useQuery({
        queryKey: ['products-simple'],
        queryFn: () => api.get('/api/products?limit=500').then((r) => r.data.data.data),
        enabled: selectionType === 'STOCK' && isOpen,
    });

    // Fetch Recipes (Prepared & Portioned)
    const { data: recipes, isLoading: isLoadingRecipes } = useQuery({
        queryKey: ['recipes-simple'],
        queryFn: () => api.get('/api/recipes?limit=1000').then((r) => r.data.data.data),
        enabled: (selectionType === 'PREPARED' || selectionType === 'PORTIONED') && isOpen,
    });

    const filteredItems = useMemo(() => {
        const term = search.toLowerCase();

        if (selectionType === 'STOCK') {
            return (products || []).filter((p: any) =>
                p.name.toLowerCase().includes(term)
            );
        }

        if (selectionType === 'PREPARED') {
            return (recipes || []).filter((r: any) =>
                (r.type === 'TRANSFORMED_ITEM' || r.isComponent) &&
                r.name.toLowerCase().includes(term)
            );
        }

        if (selectionType === 'PORTIONED') {
            return (recipes || []).filter((r: any) =>
                r.type === 'PORCIONAMENTO' &&
                r.name.toLowerCase().includes(term)
            );
        }

        return [];
    }, [selectionType, search, products, recipes]);

    const isLoading = selectionType === 'STOCK' ? isLoadingProducts : isLoadingRecipes;

    const handleSelect = (item: any) => {
        if (selectionType === 'STOCK') {
            onSelect({
                id: item.id,
                type: 'PRODUCT',
                name: item.name,
                unit: item.baseUnit,
                cost: item.lastPurchasePrice || item.avgCost || 0
            });
        } else {
            // Recipe
            const cost = item.currentPrice || 0; // Or calculate based on ingredients? Usually pre-calculated.
            // Note: Recipes usually have a calculated cost (CMV) or we use the 'currentPrice' as the internal transfer price? 
            // For now let's use currentPrice which usually stores the suggestion, or we might need a dedicated cost field.
            // Using item.currentPrice might be the selling price. Let's assume cost is costPerUnit or similar.
            // If the API returns 'costPerUnit' or 'totalCost', better. 
            // Let's assume 0 for now if not found, usually recipes have 'costSnapshot' when used as ingredient.

            onSelect({
                id: item.id,
                type: 'RECIPE',
                name: item.name,
                unit: item.yieldUnit || 'un',
                cost: item.costPerUnit || item.currentCost || 0 // Use production cost, not selling price
            });
        }
        handleClose();
    };

    const handleClose = () => {
        setSelectionType(null);
        setSearch('');
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-2xl shadow-2xl flex flex-col max-h-[80vh]">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        {selectionType && (
                            <button
                                onClick={() => setSelectionType(null)}
                                className="p-1 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-gray-400" />
                            </button>
                        )}
                        <div>
                            <h2 className="text-xl font-bold text-white">Adicionar Ingrediente</h2>
                            <p className="text-sm text-gray-400">
                                {selectionType ? 'Selecione o item da lista' : 'Escolha a origem do ingrediente'}
                            </p>
                        </div>
                    </div>
                    <button onClick={handleClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="p-6 overflow-y-auto custom-scrollbar">
                    {!selectionType ? (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <button
                                onClick={() => setSelectionType('STOCK')}
                                className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-primary-500/50 hover:shadow-[0_0_20px_rgba(var(--primary-500),0.1)] transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Package className="w-6 h-6 text-blue-400" />
                                </div>
                                <h3 className="font-semibold text-white mb-1">Item de Estoque</h3>
                                <p className="text-xs text-gray-500 text-center">Insumos brutos comprados de fornecedores</p>
                            </button>

                            <button
                                onClick={() => setSelectionType('PREPARED')}
                                className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-amber-500/50 hover:shadow-[0_0_20px_rgba(245,158,11,0.1)] transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <ChefHat className="w-6 h-6 text-amber-400" />
                                </div>
                                <h3 className="text-lg font-bold text-white mb-2">Transformados</h3>
                                <p className="text-sm text-gray-400">
                                    Itens transformados na cozinha (Ex: Molhos)
                                </p>    </button>

                            <button
                                onClick={() => setSelectionType('PORTIONED')}
                                className="flex flex-col items-center justify-center p-6 bg-white/5 border border-white/5 rounded-xl hover:bg-white/10 hover:border-purple-500/50 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)] transition-all group"
                            >
                                <div className="w-12 h-12 rounded-full bg-purple-500/20 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Scale className="w-6 h-6 text-purple-400" />
                                </div>
                                <h3 className="font-semibold text-white mb-1">Porcionado</h3>
                                <p className="text-xs text-gray-500 text-center">Itens fracionados (Ex: Carnes, Queijos)</p>
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar item..."
                                    className="w-full bg-black/20 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all"
                                    autoFocus
                                />
                            </div>

                            {/* List */}
                            <div className="space-y-2">
                                {isLoading ? (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                        <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                        <p>Carregando itens...</p>
                                    </div>
                                ) : filteredItems.length > 0 ? (
                                    filteredItems.map((item: any) => (
                                        <button
                                            key={item.id}
                                            onClick={() => handleSelect(item)}
                                            className="w-full flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 transition-colors text-left group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`p-2 rounded-lg ${selectionType === 'STOCK' ? 'bg-blue-500/20' : selectionType === 'PREPARED' ? 'bg-amber-500/20' : 'bg-purple-500/20'}`}>
                                                    {selectionType === 'STOCK' ? (
                                                        <Package className={`w-4 h-4 ${selectionType === 'STOCK' ? 'text-blue-400' : ''}`} />
                                                    ) : selectionType === 'PREPARED' ? (
                                                        <ChefHat className="w-4 h-4 text-amber-400" />
                                                    ) : (
                                                        <Scale className="w-4 h-4 text-purple-400" />
                                                    )}
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white group-hover:text-primary-400 transition-colors">{item.name}</p>
                                                    <p className="text-xs text-gray-500">
                                                        {selectionType === 'STOCK'
                                                            ? `${item.category?.name || 'Sem categoria'} • ${item.baseUnit}`
                                                            : `${formatCurrency(item.currentPrice || 0)}/${item.yieldUnit || 'un'}`
                                                        }
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                {selectionType === 'STOCK' && (
                                                    <p className="text-sm font-medium text-white">
                                                        {formatCurrency(item.avgCost)}
                                                    </p>
                                                )}
                                            </div>
                                        </button>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                                        <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
                                        <p>Nenhum item encontrado</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
