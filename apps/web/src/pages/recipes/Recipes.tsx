import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { Plus, Search, ChefHat, Edit } from 'lucide-react';
import { useState } from 'react';

export default function Recipes() {
    const [search, setSearch] = useState('');

    const { data, isLoading } = useQuery({
        queryKey: ['recipes', search],
        queryFn: () => api.get('/api/recipes', { params: { search: search || undefined } }).then((r) => r.data.data),
    });

    const recipes = data?.data || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Fichas Técnicas</h1>
                    <p className="text-gray-400">Gerencie receitas e custos</p>
                </div>
                <Link to="/recipes/new" className="btn-primary">
                    <Plus className="w-5 h-5" /> Nova Receita
                </Link>
            </div>

            <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                    type="text"
                    placeholder="Buscar receitas..."
                    className="input pl-10"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                />
            </div>

            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="glass-card animate-pulse"><div className="h-4 bg-gray-700 rounded w-2/3" /></div>
                    ))}
                </div>
            ) : recipes.length === 0 ? (
                <div className="glass-card text-center py-12">
                    <ChefHat className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Nenhuma receita encontrada</p>
                    <Link to="/recipes/new" className="btn-primary mt-4"><Plus className="w-5 h-5" /> Criar Primeira Receita</Link>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {recipes.map((recipe: any) => (
                        <div key={recipe.id} className="card p-5 group">
                            <div className="flex items-start justify-between">
                                <div className="flex-1 min-w-0">
                                    <h3 className="font-semibold text-white truncate">{recipe.name}</h3>
                                    <p className="text-sm text-gray-500">{recipe.category?.name || 'Sem categoria'}</p>
                                </div>
                                <Link to={`/recipes/${recipe.id}`} className="p-2 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100">
                                    <Edit className="w-4 h-4 text-gray-400" />
                                </Link>
                            </div>

                            <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                <div className="p-2 rounded-lg bg-white/5">
                                    <p className="text-xs text-gray-500">Custo</p>
                                    <p className="font-medium text-white">{formatCurrency(recipe.costPerUnit)}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-white/5">
                                    <p className="text-xs text-gray-500">Preço</p>
                                    <p className="font-medium text-white">{recipe.currentPrice ? formatCurrency(recipe.currentPrice) : '-'}</p>
                                </div>
                                <div className="p-2 rounded-lg bg-white/5">
                                    <p className="text-xs text-gray-500">Margem</p>
                                    <p className={`font-medium ${recipe.marginPercent >= 30 ? 'text-green-400' : 'text-yellow-400'}`}>
                                        {recipe.marginPercent ? formatPercent(recipe.marginPercent) : '-'}
                                    </p>
                                </div>
                            </div>

                            <div className="mt-4 flex items-center justify-between text-sm text-gray-400">
                                <span>{recipe.ingredientCount} ingredientes</span>
                                <span>{recipe.yieldQuantity} {recipe.yieldUnit}</span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
