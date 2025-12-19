import React, { useState, useEffect } from 'react';
import { api } from '../../../lib/api';
import { Plus, GripVertical, Settings } from 'lucide-react';

interface Category {
    id: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
    _count?: { items: number };
}

interface Props {
    costCenterId: string;
    selectedCategoryId: string | null;
    onSelectCategory: (id: string) => void;
}

export default function CategoryList({ costCenterId, selectedCategoryId, onSelectCategory }: Props) {
    const [categories, setCategories] = useState<Category[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isCreating, setIsCreating] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');

    const fetchCategories = async () => {
        try {
            const res = await api.get(`/api/menu/categories`, { params: { costCenterId } });
            setCategories(res.data.data);
        } catch (error) {
            console.error('Failed to fetch categories', error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (costCenterId) fetchCategories();
    }, [costCenterId]);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/api/menu/categories', {
                costCenterId,
                name: newCategoryName,
                sortOrder: categories.length // append to end
            });
            setNewCategoryName('');
            setIsCreating(false);
            fetchCategories();
        } catch (error) {
            alert('Erro ao criar categoria');
        }
    };

    if (isLoading) return <div className="p-4 text-gray-500">Carregando categorias...</div>;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900">
            <div className="p-4 border-b border-gray-200 dark:border-slate-700 flex justify-between items-center bg-gray-50 dark:bg-slate-800">
                <h2 className="font-semibold text-gray-700 dark:text-gray-200">Categorias</h2>
                <button
                    onClick={() => setIsCreating(true)}
                    className="p-1 hover:bg-gray-200 dark:hover:bg-slate-700 rounded text-blue-600 dark:text-blue-400 transition-colors"
                    title="Nova Categoria"
                >
                    <Plus size={20} />
                </button>
            </div>

            {isCreating && (
                <form onSubmit={handleCreate} className="p-3 border-b border-gray-200 dark:border-slate-700 bg-blue-50 dark:bg-slate-800/50">
                    <input
                        autoFocus
                        type="text"
                        className="w-full border border-gray-300 dark:border-slate-600 rounded px-2 py-1 text-sm mb-2 bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                        placeholder="Nome da categoria..."
                        value={newCategoryName}
                        onChange={e => setNewCategoryName(e.target.value)}
                    />
                    <div className="flex justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setIsCreating(false)}
                            className="text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            className="text-xs bg-blue-600 text-white px-3 py-1 rounded hover:bg-blue-700 dark:hover:bg-blue-500"
                            disabled={!newCategoryName.trim()}
                        >
                            Salvar
                        </button>
                    </div>
                </form>
            )}

            <div className="flex-1 overflow-y-auto">
                {categories.length === 0 ? (
                    <div className="p-8 text-center text-gray-400 dark:text-gray-500 text-sm">
                        Nenhuma categoria encontrada.
                    </div>
                ) : (
                    <ul className="divide-y divide-gray-100 dark:divide-slate-800">
                        {categories.map(cat => (
                            <li
                                key={cat.id}
                                onClick={() => onSelectCategory(cat.id)}
                                className={`
                                    group flex items-center justify-between p-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-slate-800 transition-colors
                                    ${selectedCategoryId === cat.id ? 'bg-blue-50 dark:bg-blue-900/10 border-l-4 border-blue-500' : 'border-l-4 border-transparent dark:border-transparent'}
                                    ${!cat.isActive ? 'opacity-60' : ''}
                                `}
                            >
                                <div className="flex items-center gap-3">
                                    <GripVertical size={16} className="text-gray-300 dark:text-slate-600 cursor-move opacity-0 group-hover:opacity-100" />
                                    <div>
                                        <div className="font-medium text-gray-800 dark:text-gray-200">{cat.name}</div>
                                        <div className="text-xs text-gray-500 dark:text-gray-400">
                                            {cat._count?.items || 0} itens
                                        </div>
                                    </div>
                                </div>
                                {selectedCategoryId === cat.id && (
                                    <button className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                                        <Settings size={16} />
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
