import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency, formatNumber } from '../../lib/utils';
import {
    Plus, Search, Package, AlertTriangle, Edit, Trash2, DollarSign,
    Calendar, Tag, Filter, TrendingDown, Archive, ShoppingCart, MoreVertical,
    Settings, Users, Layers, X
} from 'lucide-react';
import { useState, useEffect } from 'react';
import toast from 'react-hot-toast';

import ProductDetailsModal from '../stock/components/ProductDetailsModal';

export default function Products() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showCategoriesModal, setShowCategoriesModal] = useState(false);
    const [showSuppliersModal, setShowSuppliersModal] = useState(false);

    const [search, setSearch] = useState('');
    const [categoryId, setCategoryId] = useState('all');
    const [limit, setLimit] = useState(50); // Initial limit increased to 50
    const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);
    const [showCalibrationWarning, setShowCalibrationWarning] = useState(false);
    const [dismissedCalibrationWarning, setDismissedCalibrationWarning] = useState(false);
    const [searchParams, setSearchParams] = useSearchParams();
    const filterParam = searchParams.get('filter'); // 'lowStock' | 'expiring' | null

    // Check if system is in calibration period (first 90 days)
    useEffect(() => {
        const CALIBRATION_DAYS = 90;
        const STORAGE_KEY = 'moby_first_visit_date';
        const DISMISSED_KEY = 'moby_calibration_warning_dismissed';

        // Check if already dismissed
        const dismissed = localStorage.getItem(DISMISSED_KEY);
        if (dismissed) {
            setDismissedCalibrationWarning(true);
            return;
        }

        // Get or set first visit date
        let firstVisit = localStorage.getItem(STORAGE_KEY);
        if (!firstVisit) {
            firstVisit = new Date().toISOString();
            localStorage.setItem(STORAGE_KEY, firstVisit);
        }

        const firstVisitDate = new Date(firstVisit);
        const now = new Date();
        const daysSinceFirstVisit = Math.floor((now.getTime() - firstVisitDate.getTime()) / (1000 * 60 * 60 * 24));

        setShowCalibrationWarning(daysSinceFirstVisit < CALIBRATION_DAYS);
    }, []);

    const handleDismissCalibrationWarning = () => {
        localStorage.setItem('moby_calibration_warning_dismissed', 'true');
        setDismissedCalibrationWarning(true);
    };



    // Queries
    const { data: productsData, isLoading: isLoadingProducts, refetch: refetchProducts, error: productsError, isError: isProductsError } = useQuery({
        queryKey: ['products', search, categoryId, limit], // Include limit in query key
        queryFn: () => api.get('/api/products', {
            params: {
                search,
                limit, // Use dynamic limit
                categoryId: categoryId !== 'all' ? categoryId : undefined,
            }
        }).then(r => r.data),
        staleTime: 10000,
        refetchOnWindowFocus: true,
        refetchOnMount: 'always',
        retry: 1,
    });

    const { data: categories } = useQuery({
        queryKey: ['categories'],
        queryFn: () => api.get('/api/categories').then(r => r.data.data),
        staleTime: 60000,
    });

    const { data: suppliers } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => api.get('/api/suppliers').then(r => r.data.data),
    });

    const [newCategoryName, setNewCategoryName] = useState('');
    const [newSupplierName, setNewSupplierName] = useState('');

    // Mutations
    const createCategory = useMutation({
        mutationFn: (name: string) => api.post('/api/categories', { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            toast.success('Categoria criada com sucesso');
            setNewCategoryName('');
        },
        onError: () => toast.error('Erro ao criar categoria'),
    });

    const createSupplier = useMutation({
        mutationFn: (name: string) => api.post('/api/suppliers', { name }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Fornecedor criado com sucesso');
            setNewSupplierName('');
        },
        onError: () => toast.error('Erro ao criar fornecedor'),
    });

    const deleteCategory = useMutation({
        mutationFn: (id: string) => api.delete(`/api/categories/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['categories'] });
            toast.success('Categoria removida com sucesso');
        },
        onError: () => toast.error('Erro ao remover categoria'),
    });

    const deleteSupplier = useMutation({
        mutationFn: (id: string) => api.delete(`/api/suppliers/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['suppliers'] });
            toast.success('Fornecedor removido com sucesso');
        },
        onError: () => toast.error('Erro ao remover fornecedor'),
    });

    const products = productsData?.data?.data || [];
    const isLoading = isLoadingProducts;
    const pagination = productsData?.data?.pagination;

    // Helper to calculate stock urgency ratio
    // Lower ratio = Higher urgency (e.g. 0 stock with RP 10 = ratio 0)
    const getStockRatio = (product: any) => {
        const reorderPoint = product.manualReorderPoint ?? product.reorderPoint ?? 0;

        // If product has 0 stock, even if no RP, it should be prioritized if it's not inactive?
        // But requested logic is "comparison with reorder point".

        // Items with reorder point set should be prioritized based on how close they are to 0.
        if (reorderPoint > 0) {
            return product.currentStock / reorderPoint;
        }

        // Items without reorder point but low stock (e.g. 0) might technically be urgent if used,
        // but without RP we assume less urgency than those WITH RP defined.
        // We give them a high ratio to sink them, but keep them sorted by stock amount.
        return 1000 + product.currentStock;
    };

    // Smart Sort: Prioritize low stock items
    const sortedProducts = [...products].sort((a: any, b: any) => {
        const ratioA = getStockRatio(a);
        const ratioB = getStockRatio(b);
        return ratioA - ratioB;
    });

    // Filter products based on URL parameter
    const filteredProducts = sortedProducts.filter((product: any) => {
        if (filterParam === 'lowStock') {
            const reorderPoint = product.reorderPoint || 0;
            return reorderPoint > 0 && product.currentStock < (reorderPoint * 0.2);
        }
        if (filterParam === 'expiring') {
            return product.isPerishable;
        }
        return true;
    });

    const clearFilter = () => {
        setSearchParams({});
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header and Stats */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Produtos</h1>
                    <p className="text-gray-400">Gerencie seu catálogo de produtos</p>
                </div>
                <div className="flex flex-wrap gap-3">

                    <button
                        onClick={() => setShowCategoriesModal(true)}
                        className="btn-ghost text-sm"
                    >
                        <Layers className="w-4 h-4 mr-2" />
                        Categorias
                    </button>
                    <button
                        onClick={() => setShowSuppliersModal(true)}
                        className="btn-ghost text-sm"
                    >
                        <Users className="w-4 h-4 mr-2" />
                        Fornecedores
                    </button>
                    <Link to="/products/new" className="btn-primary">
                        <Plus className="w-4 h-4 mr-2" />
                        Novo Produto
                    </Link>
                </div>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar produtos..."
                        className="input pl-10"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="input md:w-48"
                    value={categoryId}
                    onChange={(e) => setCategoryId(e.target.value)}
                >
                    <option value="all">Todas as Categorias</option>
                    <option value="uncategorized">Sem Categoria</option>
                    {(categories || []).map((cat: any) => (
                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                </select>
            </div>

            {/* Active Filter Banner */}
            {filterParam && (
                <div className={`rounded-xl p-4 flex items-center justify-between ${filterParam === 'lowStock'
                    ? 'bg-yellow-500/10 border border-yellow-500/30'
                    : 'bg-red-500/10 border border-red-500/30'
                    }`}>
                    <div className="flex items-center gap-3">
                        {filterParam === 'lowStock' ? (
                            <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        ) : (
                            <Calendar className="w-5 h-5 text-red-400" />
                        )}
                        <div>
                            <p className={`font-medium text-sm ${filterParam === 'lowStock' ? 'text-yellow-200' : 'text-red-200'
                                }`}>
                                {filterParam === 'lowStock'
                                    ? `Exibindo Produtos com Estoque Baixo (${filteredProducts.length})`
                                    : `Exibindo Produtos Perecíveis (${filteredProducts.length})`}
                            </p>
                            <p className={`text-xs ${filterParam === 'lowStock' ? 'text-yellow-200/70' : 'text-red-200/70'
                                }`}>
                                {filterParam === 'lowStock'
                                    ? 'Critério: Estoque Atual < 20% do Ponto de Reposição'
                                    : 'Produtos com validade próxima'}
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={clearFilter}
                        className={`btn-ghost text-sm ${filterParam === 'lowStock' ? 'text-yellow-400 hover:bg-yellow-500/20' : 'text-red-400 hover:bg-red-500/20'
                            }`}
                    >
                        <X className="w-4 h-4 mr-1" /> Limpar Filtro
                    </button>
                </div>
            )}

            {/* Calibration Warning Banner */}
            {showCalibrationWarning && !dismissedCalibrationWarning && (
                <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-4 flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                        <p className="text-amber-200 font-medium text-sm">Período de Calibração</p>
                        <p className="text-amber-200/80 text-sm mt-1">
                            O <strong>Ponto de Reposição</strong> e a <strong>Autonomia</strong> dos produtos são calculados com base em informações de consumo dos últimos 60 dias.
                            Antes desse período de uso, as informações podem não ser precisas.
                        </p>
                    </div>
                    <button
                        onClick={handleDismissCalibrationWarning}
                        className="text-amber-400 hover:text-amber-300 p-1"
                        title="Dispensar aviso"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            )}

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
                    <p className="text-gray-400 text-lg">Nenhum produto encontrado</p>
                    <p className="text-gray-500 text-sm mt-1">
                        Tente ajustar os filtros ou adicione um novo produto
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProducts.map((product: any) => (
                            <div
                                key={product.id}
                                className="card p-5 group hover:border-primary-500/30 transition-all cursor-pointer relative"
                                onClick={(e) => {
                                    // Prevent opening when clicking specific action buttons
                                    if ((e.target as HTMLElement).closest('a') || (e.target as HTMLElement).closest('button')) return;
                                    setSelectedProductId(product.id);
                                    setShowDetailsModal(true);
                                }}
                            >
                                <div className="flex items-start justify-between mb-3">
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h3 className="font-semibold text-white truncate">{product.name}</h3>
                                            {product.currentStock <= (product.manualReorderPoint ?? product.reorderPoint ?? 0) && (product.manualReorderPoint ?? product.reorderPoint ?? 0) > 0 && (
                                                <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0" />
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2 flex-wrap">
                                            {product.sku && (
                                                <span className="text-xs px-2 py-0.5 rounded-full bg-gray-700 text-gray-300">
                                                    {product.sku}
                                                </span>
                                            )}
                                            {/* Stock Priority Badge for debugging/info */}
                                            {/* <span className="text-xs text-gray-500">
                                                Ratio: {getStockRatio(product).toFixed(2)}
                                            </span> */}
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
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            navigate(`/products/${product.id}`);
                                        }}
                                        className="p-2 hover:bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                        <Edit className="w-4 h-4 text-gray-400" />
                                    </button>
                                </div>

                                {/* Category */}
                                {product.category && (
                                    <div className="flex items-center gap-1 text-xs text-gray-400 mb-3">
                                        <Tag className="w-3 h-3" />
                                        {product.category.name}
                                    </div>
                                )}

                                <div className="grid grid-cols-3 gap-2 mb-3">
                                    <div className="p-2 rounded-lg bg-white/5">
                                        <p className="text-xs text-gray-500 mb-0.5">Estoque</p>
                                        <p className={`font-semibold text-sm ${product.currentStock <= (product.manualReorderPoint ?? product.reorderPoint ?? 0) && (product.manualReorderPoint ?? product.reorderPoint ?? 0) > 0 ? 'text-yellow-400' : 'text-white'}`}>
                                            {formatNumber(product.currentStock)} {product.baseUnit}
                                        </p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white/5">
                                        <p className="text-xs text-gray-500 mb-0.5">Custo</p>
                                        <p className="font-semibold text-sm text-white">{formatCurrency(product.avgCost)}</p>
                                    </div>
                                    <div className="p-2 rounded-lg bg-white/5">
                                        <p className="text-xs text-gray-500 mb-0.5">Autonomia</p>
                                        {product.autonomyDays !== null ? (
                                            <p className={`font-semibold text-sm ${product.autonomyDays <= 3 ? 'text-red-400' :
                                                product.autonomyDays <= 7 ? 'text-yellow-400' :
                                                    'text-green-400'
                                                }`}>
                                                {product.autonomyDays} dias
                                            </p>
                                        ) : (
                                            <p className="font-semibold text-sm text-gray-500">--</p>
                                        )}
                                    </div>
                                </div>

                                {(() => {
                                    const reorderPt = product.manualReorderPoint ?? product.reorderPoint ?? 0;
                                    const stockPercent = reorderPt > 0
                                        ? Math.min((product.currentStock / reorderPt) * 100, 100)
                                        : 100; // If no reorder point set, show full bar
                                    const isLowStock = product.currentStock <= reorderPt && reorderPt > 0;

                                    return (
                                        <div className="mb-2">
                                            <div className="flex justify-between text-xs text-gray-500 mb-1">
                                                <span>Estoque: {product.currentStock} / {reorderPt > 0 ? reorderPt : '-'} {product.baseUnit}</span>
                                                {reorderPt > 0 && <span>{Math.round(stockPercent)}%</span>}
                                            </div>
                                            <div className="progress-bar h-2">
                                                <div
                                                    className={`progress-bar-fill h-2 ${isLowStock
                                                        ? 'bg-yellow-500'
                                                        : 'bg-primary-500'
                                                        }`}
                                                    style={{ width: `${stockPercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    );
                                })()}

                                <div className="pt-3 border-t border-white/10 flex gap-2">
                                    <Link
                                        to={`/stock/entry?productId=${product.id}`}
                                        className="btn-ghost text-xs flex-1 z-10"
                                    >
                                        <ShoppingCart className="w-3 h-3" /> Entrada
                                    </Link>
                                    <Link
                                        to={`/products/${product.id}`}
                                        className="btn-ghost text-xs flex-1 z-10"
                                    >
                                        <Edit className="w-3 h-3" /> Editar
                                    </Link>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Load More Button */}
                    {pagination?.hasNext && (
                        <div className="flex justify-center py-4">
                            <button
                                onClick={() => setLimit((prev) => prev + 50)}
                                className="btn-secondary w-full md:w-auto min-w-[200px]"
                                disabled={isLoadingProducts}
                            >
                                {isLoadingProducts ? (
                                    <span className="loading loading-spinner loading-sm"></span>
                                ) : (
                                    <>
                                        Carregar Mais Produtos
                                        <span className="ml-2 text-xs opacity-70">
                                            ({filteredProducts.length} exibidos de {pagination.total})
                                        </span>
                                    </>
                                )}
                            </button>
                        </div>
                    )}
                </>
            )}

            {/* ... Modals (Category, Supplier) ... */}
            {/* Categories Modal */}
            {showCategoriesModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    {/* ... existing category modal content ... */}
                    <div className="glass-card w-full max-w-lg max-h-[80vh] overflow-y-auto m-4">
                        {/* ... */}
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
                                placeholder="Nova Categoria..."
                                className="input flex-1"
                                value={newCategoryName}
                                onChange={(e) => setNewCategoryName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && newCategoryName && createCategory.mutate(newCategoryName)}
                            />
                            <button
                                onClick={() => newCategoryName && createCategory.mutate(newCategoryName)}
                                disabled={!newCategoryName || createCategory.isPending}
                                className="btn-primary whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Adicionar
                            </button>
                        </div>

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
                        </div>
                    </div>
                </div>
            )}

            {/* Suppliers Modal */}
            {showSuppliersModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    {/* ... existing supplier modal content ... */}
                    <div className="glass-card w-full max-w-lg max-h-[80vh] overflow-y-auto m-4">
                        {/* ... */}
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Users className="w-5 h-5 text-blue-400" /> Fornecedores
                            </h3>
                            <button onClick={() => setShowSuppliersModal(false)} className="p-2 hover:bg-white/10 rounded-lg">
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {/* Add Supplier Form */}
                        <div className="flex gap-2 mb-4">
                            <input
                                type="text"
                                placeholder="Novo Fornecedor..."
                                className="input flex-1"
                                value={newSupplierName}
                                onChange={(e) => setNewSupplierName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && newSupplierName && createSupplier.mutate(newSupplierName)}
                            />
                            <button
                                onClick={() => newSupplierName && createSupplier.mutate(newSupplierName)}
                                disabled={!newSupplierName || createSupplier.isPending}
                                className="btn-primary whitespace-nowrap"
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Adicionar
                            </button>
                        </div>

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
                        </div>
                    </div>
                </div>
            )}

            {/* New Product Details Modal */}
            <ProductDetailsModal
                isOpen={showDetailsModal}
                onClose={() => setShowDetailsModal(false)}
                productId={selectedProductId}
            />


        </div>
    );
}
