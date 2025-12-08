import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency, formatNumber } from '../../lib/utils';
import {
    Plus, Search, Package, AlertTriangle, Edit, Trash2, DollarSign,
    Calendar, Tag, Filter, TrendingDown, Archive, ShoppingCart, MoreVertical,
    Settings, Users, Layers, X
} from 'lucide-react';
import { useState } from 'react';
import toast from 'react-hot-toast';

export default function Products() {
    const [search, setSearch] = useState('');
    const [filter, setFilter] = useState<'all' | 'active' | 'low' | 'cmv' | 'perishable'>('all');
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showCategoriesModal, setShowCategoriesModal] = useState(false);
    const [showSuppliersModal, setShowSuppliersModal] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [newSupplierName, setNewSupplierName] = useState('');
    const [newSupplierContact, setNewSupplierContact] = useState('');

    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['products', search, filter],
        queryFn: () => api.get('/api/products', {
            params: {
                search: search || undefined,
                isActive: filter === 'active' ? 'true' : undefined,
                lowStock: filter === 'low' ? 'true' : undefined,
            },
        }).then((r) => r.data.data),
    });

    const { data: categories } = useQuery({
        queryKey: ['categories-flat'],
        queryFn: () => api.get('/api/categories/flat').then((r) => r.data.data),
    });

    const { data: suppliers } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => api.get('/api/suppliers').then((r) => r.data.data),
    });

    const createCategory = useMutation({
        mutationFn: (name: string) => api.post('/api/categories', { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories-flat'] });
            setNewCategoryName('');
            toast.success('Categoria criada!');
        },
        onError: () => toast.error('Erro ao criar categoria'),
    });

    const deleteCategory = useMutation({
        mutationFn: (id: string) => api.delete(`/api/categories/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories-flat'] });
            toast.success('Categoria excluída!');
        },
        onError: () => toast.error('Erro ao excluir categoria'),
    });

    const createSupplier = useMutation({
        mutationFn: (data: { name: string; contactInfo?: string }) => api.post('/api/suppliers', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            setNewSupplierName('');
            setNewSupplierContact('');
            toast.success('Fornecedor criado!');
        },
        onError: () => toast.error('Erro ao criar fornecedor'),
    });

    const deleteSupplier = useMutation({
        mutationFn: (id: string) => api.delete(`/api/suppliers/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Fornecedor excluído!');
        },
        onError: () => toast.error('Erro ao excluir fornecedor'),
    });

    const products = data?.data || [];

    const filteredProducts = products.filter((p: any) => {
        if (filter === 'cmv') return p.countsCMV;
        if (filter === 'perishable') return p.isPerishable;
        return true;
    });

    const stats = {
        total: products.length,
        lowStock: products.filter((p: any) => p.currentStock <= p.minStock).length,
        cmv: products.filter((p: any) => p.countsCMV).length,
        perishable: products.filter((p: any) => p.isPerishable).length,
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Produtos</h1>
                    <p className="text-gray-400">Gerencie seus insumos e produtos</p>
                </div>
                <div className="flex items-center gap-2">
                    <div className="relative">
                        <button
                            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                            className="btn-ghost"
                            onBlur={() => setTimeout(() => setShowSettingsMenu(false), 200)}
                        >
                            <Settings className="w-5 h-5" /> Configurar
                        </button>
                        {showSettingsMenu && (
                            <div className="absolute right-0 top-full mt-1 w-56 rounded-xl bg-gray-800 border border-white/20 shadow-xl z-50 overflow-hidden">
                                <button
                                    onClick={() => { setShowCategoriesModal(true); setShowSettingsMenu(false); }}
                                    className="w-full px-4 py-3 text-left hover:bg-white/10 flex items-center gap-3 text-white border-b border-white/10"
                                >
                                    <Layers className="w-5 h-5 text-primary-400" />
                                    <div>
                                        <p className="font-medium">Categorias</p>
                                        <p className="text-xs text-gray-400">Organize seus produtos</p>
                                    </div>
                                </button>
                                <button
                                    onClick={() => { setShowSuppliersModal(true); setShowSettingsMenu(false); }}
                                    className="w-full px-4 py-3 text-left hover:bg-white/10 flex items-center gap-3 text-white"
                                >
                                    <Users className="w-5 h-5 text-blue-400" />
                                    <div>
                                        <p className="font-medium">Fornecedores</p>
                                        <p className="text-xs text-gray-400">Gerencie seus fornecedores</p>
                                    </div>
                                </button>
                            </div>
                        )}
                    </div>
                    <Link to="/products/new" className="btn-primary">
                        <Plus className="w-5 h-5" /> Novo Produto
                    </Link>
                </div>
            </div>

            {/* Quick Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="stat-card cursor-pointer hover:bg-white/10 transition-all" onClick={() => setFilter('all')}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary-500/20">
                            <Package className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Total</p>
                            <p className="text-xl font-bold text-white">{stats.total}</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card cursor-pointer hover:bg-white/10 transition-all" onClick={() => setFilter('low')}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-yellow-500/20">
                            <TrendingDown className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Estoque Baixo</p>
                            <p className="text-xl font-bold text-yellow-400">{stats.lowStock}</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card cursor-pointer hover:bg-white/10 transition-all" onClick={() => setFilter('cmv')}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-green-500/20">
                            <DollarSign className="w-5 h-5 text-green-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Compõem CMV</p>
                            <p className="text-xl font-bold text-green-400">{stats.cmv}</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card cursor-pointer hover:bg-white/10 transition-all" onClick={() => setFilter('perishable')}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-red-500/20">
                            <Calendar className="w-5 h-5 text-red-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Perecíveis</p>
                            <p className="text-xl font-bold text-red-400">{stats.perishable}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters and Search */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, SKU ou código de barras..."
                        className="input pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <div className="flex gap-2">
                    {[
                        { id: 'all', label: 'Todos', icon: Package },
                        { id: 'low', label: 'Baixo', icon: TrendingDown },
                        { id: 'cmv', label: 'CMV', icon: DollarSign },
                        { id: 'perishable', label: 'Perecível', icon: Calendar },
                    ].map((f) => (
                        <button
                            key={f.id}
                            onClick={() => setFilter(f.id as any)}
                            className={`btn text-sm ${filter === f.id ? 'btn-primary' : 'btn-ghost'}`}
                        >
                            <f.icon className="w-4 h-4" />
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Products Grid */}
            {isLoading ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[...Array(6)].map((_, i) => (
                        <div key={i} className="glass-card animate-pulse">
                            <div className="h-4 bg-gray-700 rounded w-2/3 mb-4" />
                            <div className="h-3 bg-gray-700 rounded w-1/2" />
                        </div>
                    ))}
                </div>
            ) : filteredProducts.length === 0 ? (
                <div className="glass-card text-center py-12">
                    <Package className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">Nenhum produto encontrado</p>
                    {filter !== 'all' && (
                        <button onClick={() => setFilter('all')} className="text-primary-400 text-sm">
                            Limpar filtros
                        </button>
                    )}
                    {filter === 'all' && (
                        <Link to="/products/new" className="btn-primary mt-4">
                            <Plus className="w-5 h-5" /> Criar Primeiro Produto
                        </Link>
                    )}
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {filteredProducts.map((product: any) => (
                        <div key={product.id} className="card p-5 group hover:border-primary-500/30 transition-all">
                            <div className="flex items-start justify-between mb-3">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h3 className="font-semibold text-white truncate">{product.name}</h3>
                                        {product.currentStock <= product.minStock && (
                                            <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2 flex-wrap">
                                        {product.sku && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                                                {product.sku}
                                            </span>
                                        )}
                                        {product.countsCMV && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                                                <DollarSign className="w-3 h-3 inline mr-1" />
                                                CMV
                                            </span>
                                        )}
                                        {product.isPerishable && (
                                            <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                                                <Calendar className="w-3 h-3 inline mr-1" />
                                                Perecível
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <Link
                                    to={`/products/${product.id}`}
                                    className="p-2 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                    <Edit className="w-4 h-4 text-gray-400" />
                                </Link>
                            </div>

                            {product.category && (
                                <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                                    <Tag className="w-3 h-3" />
                                    {product.category.name}
                                </div>
                            )}

                            <div className="grid grid-cols-2 gap-3 mb-3">
                                <div className="p-2 rounded-lg bg-white/5">
                                    <p className="text-xs text-gray-500 mb-0.5">Estoque Atual</p>
                                    <p className={`font-semibold ${product.currentStock <= product.minStock ? 'text-yellow-400' : 'text-white'}`}>
                                        {formatNumber(product.currentStock)} {product.baseUnit}
                                    </p>
                                </div>
                                <div className="p-2 rounded-lg bg-white/5">
                                    <p className="text-xs text-gray-500 mb-0.5">Custo Médio</p>
                                    <p className="font-semibold text-white">{formatCurrency(product.avgCost)}/{product.baseUnit}</p>
                                </div>
                            </div>

                            <div className="mb-2">
                                <div className="flex justify-between text-xs text-gray-500 mb-1">
                                    <span>Min: {product.minStock}</span>
                                    {product.maxStock && <span>Max: {product.maxStock}</span>}
                                </div>
                                <div className="progress-bar h-2">
                                    <div
                                        className={`progress-bar-fill h-2 ${product.currentStock <= product.minStock
                                                ? 'bg-yellow-500'
                                                : product.currentStock >= (product.maxStock || product.minStock * 3)
                                                    ? 'bg-blue-500'
                                                    : 'bg-primary-500'
                                            }`}
                                        style={{
                                            width: `${Math.min(
                                                (product.currentStock / (product.maxStock || product.minStock * 2)) * 100,
                                                100
                                            )}%`
                                        }}
                                    />
                                </div>
                            </div>

                            <div className="pt-3 border-t border-white/10 flex gap-2">
                                <Link
                                    to={`/stock/entry?productId=${product.id}`}
                                    className="btn-ghost text-xs flex-1"
                                >
                                    <ShoppingCart className="w-3 h-3" /> Entrada
                                </Link>
                                <Link
                                    to={`/products/${product.id}`}
                                    className="btn-ghost text-xs flex-1"
                                >
                                    <Edit className="w-3 h-3" /> Editar
                                </Link>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Categories Modal */}
            {showCategoriesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-lg max-h-[80vh] overflow-y-auto m-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Layers className="w-5 h-5 text-primary-400" /> Categorias
                            </h3>
                            <button onClick={() => setShowCategoriesModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Add Category Form */}
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="Nome da categoria..."
                                className="input flex-1"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && newCategoryName && createCategory.mutate(newCategoryName)}
                            />
                            <button
                                onClick={() => newCategoryName && createCategory.mutate(newCategoryName)}
                                className="btn-primary"
                                disabled={!newCategoryName || createCategory.isPending}
                            >
                                <Plus className="w-4 h-4" /> Adicionar
                            </button>
                        </div>

                        {/* Categories List */}
                        <div className="space-y-2">
                            {(categories || []).map((cat: any) => (
                                <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                                    <div className="flex items-center gap-2">
                                        <Tag className="w-4 h-4 text-primary-400" />
                                        <span className="text-white">{cat.name}</span>
                                    </div>
                                    <button
                                        onClick={() => deleteCategory.mutate(cat.id)}
                                        className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"
                                        disabled={deleteCategory.isPending}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {(!categories || categories.length === 0) && (
                                <p className="text-center text-gray-400 py-8">Nenhuma categoria criada</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Suppliers Modal */}
            {showSuppliersModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-lg max-h-[80vh] overflow-y-auto m-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-400" /> Fornecedores
                            </h3>
                            <button onClick={() => setShowSuppliersModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Add Supplier Form */}
                        <div className="space-y-2 mb-4">
                            <input
                                type="text"
                                placeholder="Nome do fornecedor..."
                                className="input w-full"
                                value={newSupplierName}
                                onChange={(e) => setNewSupplierName(e.target.value)}
                            />
                            <input
                                type="text"
                                placeholder="Contato (opcional)..."
                                className="input w-full"
                                value={newSupplierContact}
                                onChange={(e) => setNewSupplierContact(e.target.value)}
                            />
                            <button
                                onClick={() => newSupplierName && createSupplier.mutate({
                                    name: newSupplierName,
                                    contactInfo: newSupplierContact || undefined
                                })}
                                className="btn-primary w-full"
                                disabled={!newSupplierName || createSupplier.isPending}
                            >
                                <Plus className="w-4 h-4" /> Adicionar Fornecedor
                            </button>
                        </div>

                        {/* Suppliers List */}
                        <div className="space-y-2">
                            {(suppliers || []).map((sup: any) => (
                                <div key={sup.id} className="flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all">
                                    <div>
                                        <p className="text-white font-medium">{sup.name}</p>
                                        {sup.contactInfo && (
                                            <p className="text-xs text-gray-400">{sup.contactInfo}</p>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => deleteSupplier.mutate(sup.id)}
                                        className="p-2 hover:bg-red-500/20 rounded-lg text-red-400"
                                        disabled={deleteSupplier.isPending}
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            ))}
                            {(!suppliers || suppliers.length === 0) && (
                                <p className="text-center text-gray-400 py-8">Nenhum fornecedor cadastrado</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
