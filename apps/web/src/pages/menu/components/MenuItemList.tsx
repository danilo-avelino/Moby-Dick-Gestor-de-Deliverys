import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { Plus, Search, Edit2, AlertCircle } from 'lucide-react';
import MenuItemForm from './MenuItemForm';

interface MenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    description?: string;
    price: number;
    imageUrl?: string;
    isActive: boolean;
    displayInPdv: boolean;
    recipe?: { id: string; currentCost: number; yieldUnit: string }; // simple relation
}

interface Props {
    categoryId: string;
}

export default function MenuItemList({ categoryId }: Props) {
    const [items, setItems] = useState<MenuItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [editingItem, setEditingItem] = useState<MenuItem | 'NEW' | null>(null);

    const fetchItems = async () => {
        setIsLoading(true);
        try {
            const res = await api.get(`/api/menu/categories/${categoryId}/items`);
            setItems(res.data.data);
        } catch (error) {
            console.error('Failed to fetch items', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (categoryId) fetchItems();
    }, [categoryId]);

    if (editingItem) {
        return (
            <MenuItemForm
                categoryId={categoryId}
                item={editingItem === 'NEW' ? undefined : editingItem}
                onClose={() => setEditingItem(null)}
                onSave={() => {
                    setEditingItem(null);
                    fetchItems();
                }}
            />
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            {/* Header */}
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                    <input
                        type="text"
                        placeholder="Buscar itens..."
                        className="pl-9 pr-4 py-1.5 text-sm border border-gray-300 dark:border-slate-600 rounded-full w-64 bg-white dark:bg-slate-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                    />
                </div>
                <button
                    onClick={() => setEditingItem('NEW')}
                    className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors"
                >
                    <Plus size={16} />
                    Novo Item
                </button>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto bg-gray-50/50 dark:bg-slate-900 p-4">
                {isLoading ? (
                    <div className="text-center text-gray-500 dark:text-gray-400 mt-10">Carregando itens...</div>
                ) : items.length === 0 ? (
                    <div className="text-center text-gray-400 dark:text-gray-500 mt-10 flex flex-col items-center">
                        <div className="text-4xl mb-2">🍔</div>
                        <p>Nenhum item nesta categoria.</p>
                        <button
                            onClick={() => setEditingItem('NEW')}
                            className="text-blue-600 dark:text-blue-400 text-sm mt-2 hover:underline"
                        >
                            Criar o primeiro item
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-4">
                        {items.map(item => (
                            <div key={item.id} className="bg-white dark:bg-slate-800 p-4 rounded-lg shadow-sm border border-gray-100 dark:border-slate-700 flex items-center gap-4 hover:shadow-md transition-shadow">
                                {/* Image Placeholder */}
                                <div className="w-16 h-16 bg-gray-100 dark:bg-slate-700 rounded-md flex-shrink-0 flex items-center justify-center text-gray-300 dark:text-slate-500 overflow-hidden">
                                    {item.imageUrl ? (
                                        <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover" />
                                    ) : (
                                        <span className="text-[10px] text-center px-1">Sem foto</span>
                                    )}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <h3 className="font-semibold text-gray-900 dark:text-white truncate">{item.name}</h3>
                                        {!item.isActive && (
                                            <span className="text-[10px] bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 px-1.5 py-0.5 rounded font-medium">INATIVO</span>
                                        )}
                                        {!item.displayInPdv && (
                                            <span className="text-[10px] bg-gray-100 text-gray-600 dark:bg-slate-700 dark:text-gray-300 px-1.5 py-0.5 rounded font-medium">OCULTO PDV</span>
                                        )}
                                    </div>
                                    <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{item.description || 'Sem descrição'}</p>
                                    <div className="flex items-center gap-4 mt-1 text-sm">
                                        <span className="font-medium text-green-700 dark:text-green-400">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(item.price)}
                                        </span>

                                        {/* Technical Sheet Status */}
                                        {item.recipe ? (
                                            <span className="text-xs text-gray-400 dark:text-gray-500 flex items-center gap-1" title="Ficha Técnica Associada">
                                                ✅ FT Associada
                                            </span>
                                        ) : (
                                            <span className="text-xs text-orange-400 dark:text-orange-300 flex items-center gap-1" title="Sem Ficha Técnica">
                                                <AlertCircle size={12} /> Sem ficha técnica
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <button
                                    onClick={() => setEditingItem(item)}
                                    className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:hover:text-blue-400 rounded-full transition-colors"
                                >
                                    <Edit2 size={18} />
                                </button>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
