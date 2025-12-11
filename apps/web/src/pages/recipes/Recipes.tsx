import { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency, formatPercent } from '../../lib/utils';
import {
    Plus, Search, ChefHat, Edit, ArrowLeft, FolderPlus,
    MoreVertical, Trash2, LayoutGrid, List as ListIcon, Scale
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CreateCategoryModal } from './components/CreateCategoryModal';
import { NewRecipeModal } from './components/NewRecipeModal';

export default function Recipes() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState<'recipes' | 'portioning'>('recipes');

    // Recipes State
    const categoryIdParam = searchParams.get('categoryId');
    const [viewMode, setViewMode] = useState<'categories' | 'list'>(categoryIdParam ? 'list' : 'categories');
    const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(categoryIdParam);
    const [search, setSearch] = useState('');

    // Sync URL with state changes isn't needed if we rely on URL as source of truth, 
    // but mixing local state and URL requires care. 
    // Let's rely on URL for categoryId.

    useEffect(() => {
        const catId = searchParams.get('categoryId');
        if (catId) {
            setSelectedCategoryId(catId);
            setViewMode('list');
        } else {
            setSelectedCategoryId(null);
            setViewMode('categories');
        }
    }, [searchParams]);

    // Modals
    const [isCreateCategoryOpen, setIsCreateCategoryOpen] = useState(false);
    const [isNewRecipeOpen, setIsNewRecipeOpen] = useState(false);

    // Fetch Categories
    const { data: categories = [], isLoading: isLoadingCategories } = useQuery({
        queryKey: ['recipe-categories'],
        queryFn: async () => {
            const res = await api.get('/api/recipe-categories');
            return res.data;
        }
    });

    // Fetch Recipes (only when category is selected or search is active)
    const { data: recipesData, isLoading: isLoadingRecipes } = useQuery({
        queryKey: ['recipes', selectedCategoryId, search],
        queryFn: async () => {
            const params: any = {};
            if (activeTab === 'recipes') {
                if (selectedCategoryId) params.categoryId = selectedCategoryId;
                if (search) params.search = search;
            }
            const res = await api.get('/api/recipes', { params });
            return res.data;
        },
        enabled: (viewMode === 'list' && !!selectedCategoryId) || !!search
    });

    const recipes = recipesData?.data?.data || [];

    // Handlers
    function handleCategoryClick(catId: string) {
        setSearchParams({ categoryId: catId });
    }

    function handleBackToCategories() {
        setSearchParams({});
    }

    async function handleDeleteCategory(e: React.MouseEvent, id: string) {
        e.stopPropagation();
        if (!confirm('Tem certeza que deseja excluir esta categoria?')) return;
        try {
            await api.delete(`/api/recipe-categories/${id}`);
            toast.success('Categoria excluída');
            queryClient.invalidateQueries({ queryKey: ['recipe-categories'] });
        } catch (error) {
            toast.error('Erro ao excluir categoria');
        }
    }

    // Render Portioning Tab (Placeholder for now)
    if (activeTab === 'portioning') {
        return (
            <div className="space-y-6 animate-fade-in">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={() => setActiveTab('recipes')} className="p-2 hover:bg-white/10 rounded-lg text-gray-400">
                            <ArrowLeft className="w-5 h-5" />
                        </button>
                        <h1 className="text-2xl font-bold text-white">Porcionamento</h1>
                    </div>
                </div>
                <div className="glass-card p-12 text-center">
                    <Scale className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <h3 className="text-xl font-medium text-white mb-2">Controle de Porcionamento</h3>
                    <p className="text-gray-400 max-w-md mx-auto">
                        Registre a produção de lotes de porcionamento para atualizar o custo médio dos insumos porcionados.
                    </p>
                    <button className="btn-primary mt-6">
                        <Plus className="w-5 h-5 mr-2" /> Registrar Lote
                    </button>
                    <p className="mt-4 text-xs text-yellow-500">Funcionalidade em desenvolvimento</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header & Tabs */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => setActiveTab('recipes')}
                        className={`text-lg font-bold border-b-2 px-1 pb-1 transition-colors ${activeTab === 'recipes' ? 'text-white border-primary-500' : 'text-gray-400 border-transparent hover:text-white'}`}
                    >
                        Fichas Técnicas
                    </button>
                    <button
                        onClick={() => setActiveTab('portioning')}
                        className={`text-lg font-bold border-b-2 px-1 pb-1 transition-colors ${activeTab === 'portioning' ? 'text-white border-primary-500' : 'text-gray-400 border-transparent hover:text-white'}`}
                    >
                        Porcionados
                    </button>
                </div>

                <div className="flex items-center gap-3">
                    {viewMode === 'categories' && (
                        <button onClick={() => setIsCreateCategoryOpen(true)} className="btn-secondary">
                            <FolderPlus className="w-5 h-5 sm:mr-2" />
                            <span className="hidden sm:inline">Nova Categoria</span>
                        </button>
                    )}
                    <button onClick={() => setIsNewRecipeOpen(true)} className="btn-primary">
                        <Plus className="w-5 h-5 sm:mr-2" />
                        <span className="hidden sm:inline">Nova Receita</span>
                    </button>
                </div>
            </div>

            {/* Breadcrumb / Navigation */}
            {viewMode === 'list' && selectedCategoryId && (
                <div className="flex items-center gap-2 text-sm text-gray-400">
                    <button onClick={handleBackToCategories} className="hover:text-white flex items-center gap-1">
                        <LayoutGrid className="w-4 h-4" /> Categorias
                    </button>
                    <span>/</span>
                    <span className="text-white">
                        {categories.find((c: any) => c.id === selectedCategoryId)?.name || 'Categoria'}
                    </span>
                </div>
            )}

            {/* Categories Grid View */}
            {viewMode === 'categories' && !search && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {isLoadingCategories ? (
                        [...Array(4)].map((_, i) => <div key={i} className="glass-card h-32 animate-pulse bg-white/5" />)
                    ) : categories.map((cat: any) => (
                        <div
                            key={cat.id}
                            onClick={() => handleCategoryClick(cat.id)}
                            className="glass-card p-5 cursor-pointer hover:border-primary-500/50 hover:bg-white/5 transition-all group relative"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div className="p-3 bg-primary-500/10 rounded-lg text-primary-400 group-hover:bg-primary-500 group-hover:text-white transition-colors">
                                    <ChefHat className="w-6 h-6" />
                                </div>
                                <div className="flex items-center gap-2">
                                    {/* Progress Indicator */}
                                    <div className={`text-xs font-bold px-2 py-1 rounded-full ${cat.completedRecipes === cat.totalRecipes && cat.totalRecipes > 0
                                        ? 'bg-green-500/20 text-green-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                        }`}>
                                        {cat.completedRecipes}/{cat.totalRecipes}
                                    </div>
                                    <button
                                        onClick={(e) => handleDeleteCategory(e, cat.id)}
                                        className="p-1 text-gray-500 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                            <h3 className="text-lg font-bold text-white mb-1">{cat.name}</h3>
                            <p className="text-sm text-gray-500">{cat.totalRecipes} fichas técnicas</p>
                        </div>
                    ))}

                    {/* Empty State Call to Action */}
                    {categories.length === 0 && !isLoadingCategories && (
                        <div onClick={() => setIsCreateCategoryOpen(true)} className="border-2 border-dashed border-white/10 rounded-xl p-8 flex flex-col items-center justify-center text-gray-500 hover:border-primary-500/50 hover:text-primary-400 cursor-pointer transition-colors h-full min-h-[160px]">
                            <FolderPlus className="w-8 h-8 mb-3" />
                            <p className="font-medium">Criar primeira categoria</p>
                        </div>
                    )}
                </div>
            )}

            {/* Recipes List View */}
            {(viewMode === 'list' || search) && (
                <div className="space-y-4">
                    {/* Search Bar */}
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar nesta categoria..."
                            className="input pl-10"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>

                    {isLoadingRecipes ? (
                        <div className="text-center py-12 text-gray-500">Carregando receitas...</div>
                    ) : recipes.length === 0 ? (
                        <div className="glass-card text-center py-12">
                            <ChefHat className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                            <p className="text-gray-400">Nenhuma receita encontrada nesta categoria.</p>
                            <button onClick={() => setIsNewRecipeOpen(true)} className="btn-primary mt-4">
                                <Plus className="w-5 h-5 mr-2" /> Criar Receita
                            </button>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {recipes.map((recipe: any) => (
                                <Link key={recipe.id} to={`/recipes/${recipe.id}`} className="card p-5 group hover:border-primary-500/50 transition-all">
                                    <div className="flex items-start justify-between">
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2 mb-1">
                                                <h3 className="font-semibold text-white truncate">{recipe.name}</h3>
                                                {recipe.status === 'COMPLETE' && <span className="w-2 h-2 rounded-full bg-green-500" title="Completa" />}
                                            </div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wider">{recipe.type?.replace('_', ' ')}</p>
                                        </div>
                                        <Edit className="w-4 h-4 text-gray-400 group-hover:text-white" />
                                    </div>

                                    <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                                        <div className="p-2 rounded-lg bg-white/5">
                                            <p className="text-xs text-gray-500">Custo</p>
                                            <p className="font-medium text-white">{formatCurrency(recipe.costPerUnit)}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-white/5">
                                            <p className="text-xs text-gray-500">{recipe.type === 'FINAL_PRODUCT' ? 'Venda' : 'Ref'}</p>
                                            <p className="font-medium text-white">{recipe.currentPrice ? formatCurrency(recipe.currentPrice) : '-'}</p>
                                        </div>
                                        <div className="p-2 rounded-lg bg-white/5">
                                            <p className="text-xs text-gray-500">CMV</p>
                                            <p className={`font-medium ${!recipe.currentPrice ? 'text-gray-500' : (1 - (recipe.marginPercent / 100)) * 100 <= 35 ? 'text-green-400' : 'text-red-400'}`}>
                                                {recipe.currentPrice ? `${((1 - (recipe.marginPercent / 100)) * 100).toFixed(0)}%` : '-'}
                                            </p>
                                        </div>
                                    </div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Modals */}
            {isCreateCategoryOpen && (
                <CreateCategoryModal
                    onClose={() => setIsCreateCategoryOpen(false)}
                    onSuccess={() => queryClient.invalidateQueries({ queryKey: ['recipe-categories'] })}
                />
            )}

            {isNewRecipeOpen && (
                <NewRecipeModal
                    onClose={() => setIsNewRecipeOpen(false)}
                    categories={categories}
                    preSelectedCategoryId={selectedCategoryId || undefined}
                />
            )}
        </div>
    );
}
