import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import StockRequisitionModal from './components/StockRequisitionModal';
import StockImportModal from './components/StockImportModal';
import { api } from '../../lib/api';
import { formatCurrency, formatNumber, formatDate } from '../../lib/utils';
import {
    Plus, Package, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    Clock, AlertTriangle, Calendar, Trash2, ClipboardCheck, RefreshCw,
    Search, Filter, MoreVertical, Eye, History, Tag, X, FileOutput, Upload, ShoppingCart
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CategorySummary {
    name: string;
    value: number;
    count: number;
    percentage: number;
}

const wasteReasonMap: Record<string, string> = {
    expired: 'Vencido',
    spoiled: 'Estragado/Deteriorado',
    damaged: 'Danificado',
    preparation_error: 'Erro de Preparo',
    contaminated: 'Contaminado',
    other: 'Outro'
};

export default function Stock() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<'overview' | 'movements' | 'waste' | 'expiring'>('overview');
    const [search, setSearch] = useState('');
    const [showWasteModal, setShowWasteModal] = useState(false);
    const [showRequisitionModal, setShowRequisitionModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [wasteProductType, setWasteProductType] = useState<'raw' | 'portioned' | null>(null);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [wasteQuantity, setWasteQuantity] = useState('');

    const [wasteReason, setWasteReason] = useState('');
    const [wasteNote, setWasteNote] = useState('');
    const [deductStock, setDeductStock] = useState(true);

    const queryClient = useQueryClient();

    // Placeholder arrays for waste and expiring data (to be implemented with real queries later)
    const wasteLog: any[] = [];
    const expiringProducts: any[] = [];

    const { data: summary, refetch, isError: isSummaryError, error: summaryError } = useQuery({
        queryKey: ['stock-summary'],
        queryFn: () => api.get('/api/stock/summary').then((r) => r.data.data),
        staleTime: 10000, // 10 seconds
        refetchOnWindowFocus: true,
        refetchOnMount: 'always',
        retry: 1,
    });

    const { data: movements } = useQuery({
        queryKey: ['stock-movements'],
        queryFn: () => api.get('/api/stock/movements?limit=20').then((r) => r.data.data),
        staleTime: 10000, // 10 seconds
        refetchOnWindowFocus: true,
        refetchOnMount: 'always',
    });

    const { data: wasteMovements } = useQuery({
        queryKey: ['stock-movements-waste'],
        queryFn: () => api.get('/api/stock/movements?limit=50&type=WASTE').then((r) => r.data.data),
        staleTime: 10000,
    });

    const createMovementMutation = useMutation({
        mutationFn: (data: any) => api.post('/api/stock/movements', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
            queryClient.invalidateQueries({ queryKey: ['stock-movements-waste'] });
            queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
            queryClient.invalidateQueries({ queryKey: ['products-list'] });
            toast.success('Perda registrada com sucesso!');
            setShowWasteModal(false);
            resetWasteForm();
            setActiveTab('waste');
        },
        onError: (error: any) => {
            console.error('Error registering waste:', error);
            toast.error('Erro ao registrar perda');
        }
    });

    const resetWasteForm = () => {
        setWasteProductType(null);
        setSelectedProduct('');
        setWasteQuantity('');
        setWasteReason('');
        setWasteNote('');
        setDeductStock(true);
    };

    // Query for category data
    const { data: categoryData } = useQuery({
        queryKey: ['stock-by-category'],
        queryFn: () => api.get('/api/stock/by-category').then((r) => r.data.data),
        staleTime: 30000,
    });

    // Query for products (raw ingredients)
    const { data: productsData } = useQuery({
        queryKey: ['products-list', 'active'],
        queryFn: () => api.get('/api/products?limit=1000&isActive=true').then((r) => r.data.data),
        enabled: wasteProductType === 'raw',
        staleTime: 60000,
    });

    // Query for recipes (portioned items)
    const { data: recipesData } = useQuery({
        queryKey: ['recipes-list', 'active'],
        queryFn: () => api.get('/api/recipes?limit=100&isActive=true').then((r) => r.data.data),
        enabled: wasteProductType === 'portioned',
        staleTime: 60000,
    });

    // Use real category data from API
    const categorySummary: CategorySummary[] = categoryData?.categories || [];

    const dailyChecklist = [
        { id: 1, task: 'Verificar temperatura das geladeiras', completed: true, time: '08:00' },
        { id: 2, task: 'Contar estoque de proteínas', completed: true, time: '09:00' },
        { id: 3, task: 'Verificar produtos próximos do vencimento', completed: false, time: '10:00' },
        { id: 4, task: 'Registrar perdas do dia anterior', completed: false, time: '11:00' },
    ];

    const tabs = [
        { id: 'overview', label: 'Visão Geral', icon: Eye },
        { id: 'movements', label: 'Movimentações', icon: History },
        { id: 'waste', label: 'Desperdícios', icon: Trash2 },
        { id: 'expiring', label: 'Validade', icon: Calendar },
    ];



    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Gestão de Estoque</h1>
                    <p className="text-gray-400">Controle completo do seu inventário</p>
                </div>
                <div className="flex items-center gap-2">
                    <Link to="/stock/inventory" className="btn-primary">
                        <ClipboardCheck className="w-5 h-5" /> Fazer Inventário
                    </Link>
                    <Link to="/stock/entry" className="btn-primary">
                        <Plus className="w-5 h-5" /> Nova Entrada
                    </Link>
                </div>
            </div>

            {/* Tabs removed as per request */}

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <>
                    {/* Main KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="glass-card hover:bg-white/10 transition-all text-center py-6">
                            <Package className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">Valor Total</p>
                            <p className="text-xl font-bold text-white">{formatCurrency(summary?.totalValue ?? 0)}</p>
                        </div>

                        {/* Low Stock Card */}
                        <div
                            className="glass-card hover:bg-white/10 transition-all text-center py-6 cursor-pointer"
                            onClick={() => navigate('/products?filter=lowStock')}
                            title="Produtos com estoque atual ≤ ponto de reposição"
                        >
                            <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">Estoque Baixo</p>
                            <p className="text-xl font-bold text-yellow-400">{formatNumber(summary?.lowStockCount || 0)}</p>
                        </div>

                        {/* Expiring Card */}
                        <div
                            className="glass-card hover:bg-white/10 transition-all text-center py-6 cursor-pointer"
                            onClick={() => navigate('/products?filter=expiring')}
                        >
                            <Calendar className="w-8 h-8 text-red-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">Vencendo em 7 dias</p>
                            <p className="text-xl font-bold text-red-400">0</p>
                        </div>

                        {/* Waste Card */}
                        <div className="glass-card hover:bg-white/10 transition-all text-center py-6">
                            <Trash2 className="w-8 h-8 text-red-400 mx-auto mb-2" />
                            <p className="text-sm text-gray-400">Perdas (mês)</p>
                            <p className="text-xl font-bold text-red-400">{formatCurrency(summary?.monthWaste || 0)}</p>
                        </div>
                    </div>

                    {/* Quick Actions */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <Link to="/stock/entry" className="glass-card hover:bg-white/10 transition-all text-center py-6">
                            <ArrowUpRight className="w-8 h-8 text-green-400 mx-auto mb-2" />
                            <p className="font-medium text-white">Registrar Entrada</p>
                        </Link>
                        <button onClick={() => setShowWasteModal(true)} className="glass-card hover:bg-white/10 transition-all text-center py-6">
                            <Trash2 className="w-8 h-8 text-red-400 mx-auto mb-2" />
                            <p className="font-medium text-white">Registrar Perda</p>
                        </button>
                        <button onClick={() => setShowRequisitionModal(true)} className="glass-card hover:bg-white/10 transition-all text-center py-6">
                            <FileOutput className="w-8 h-8 text-orange-400 mx-auto mb-2" />
                            <p className="font-medium text-white">Requisição de Retirada</p>
                        </button>
                        <button onClick={() => setActiveTab('expiring')} className="glass-card hover:bg-white/10 transition-all text-center py-6">
                            <Calendar className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
                            <p className="font-medium text-white">Ver Vencimentos</p>
                        </button>

                        <Link to="/products" className="glass-card hover:bg-white/10 transition-all text-center py-6">
                            <Package className="w-8 h-8 text-primary-400 mx-auto mb-2" />
                            <p className="font-medium text-white">Produtos</p>
                        </Link>
                        <Link to="/stock/requests" className="glass-card hover:bg-white/10 transition-all text-center py-6">
                            <ClipboardCheck className="w-8 h-8 text-amber-400 mx-auto mb-2" />
                            <p className="font-medium text-white">Requisições</p>
                        </Link>
                        <Link to="/purchases" className="glass-card hover:bg-white/10 transition-all text-center py-6">
                            <ShoppingCart className="w-8 h-8 text-blue-400 mx-auto mb-2" />
                            <p className="font-medium text-white">Lista de Compras</p>
                        </Link>
                        <button onClick={() => setActiveTab('movements')} className="glass-card hover:bg-white/10 transition-all text-center py-6">
                            <History className="w-8 h-8 text-purple-400 mx-auto mb-2" />
                            <p className="font-medium text-white">Movimentações</p>
                        </button>
                    </div>

                    {/* Today Summary + Categories */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Today's Flow */}
                        {/* Today's Flow - Premium Glassmorphism Design */}
                        <div className="space-y-6">
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                    Movimentação Hoje
                                </h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Entries Premium Card */}
                                    <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-transparent border border-emerald-500/30 backdrop-blur-md shadow-[0_0_30px_rgba(16,185,129,0.15)] group hover:scale-[1.02] transition-transform duration-300">
                                        <div className="absolute -right-6 -bottom-6 opacity-10 rotate-12 group-hover:opacity-20 transition-opacity">
                                            <TrendingUp className="w-32 h-32 text-emerald-400" />
                                        </div>
                                        <div className="relative z-10 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-emerald-500/20 rounded-lg backdrop-blur-sm">
                                                        <ArrowUpRight className="w-5 h-5 text-emerald-300" />
                                                    </div>
                                                    <span className="text-emerald-200 font-medium">Entradas</span>
                                                </div>
                                                <span className="px-2.5 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-xs font-medium flex items-center gap-1">
                                                    <TrendingUp className="w-3 h-3" />
                                                    +12%
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-3xl font-bold text-white drop-shadow-lg tracking-tight">
                                                    {formatCurrency(summary?.todayEntries || 0)}
                                                </p>
                                                <p className="text-sm text-emerald-200/50 mt-1">vs ontem</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Exits Premium Card */}
                                    <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-rose-500/20 to-transparent border border-rose-500/30 backdrop-blur-md shadow-[0_0_30px_rgba(244,63,94,0.15)] group hover:scale-[1.02] transition-transform duration-300">
                                        <div className="absolute -right-6 -bottom-6 opacity-10 rotate-12 group-hover:opacity-20 transition-opacity">
                                            <TrendingDown className="w-32 h-32 text-rose-400" />
                                        </div>
                                        <div className="relative z-10 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-rose-500/20 rounded-lg backdrop-blur-sm">
                                                        <ArrowDownRight className="w-5 h-5 text-rose-300" />
                                                    </div>
                                                    <span className="text-rose-200 font-medium">Saídas</span>
                                                </div>
                                                <span className="px-2.5 py-1 rounded-full bg-rose-500/20 border border-rose-500/30 text-rose-300 text-xs font-medium flex items-center gap-1">
                                                    <TrendingDown className="w-3 h-3" />
                                                    -5%
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-3xl font-bold text-white drop-shadow-lg tracking-tight">
                                                    {formatCurrency(summary?.todayExits || 0)}
                                                </p>
                                                <p className="text-sm text-rose-200/50 mt-1">vs ontem</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Monthly Totals - Premium Design */}
                            <div>
                                <h3 className="text-lg font-semibold text-white mb-4">Movimentação do Mês</h3>
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Monthly Entries */}
                                    <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 backdrop-blur-md shadow-[0_0_20px_rgba(16,185,129,0.1)] group hover:scale-[1.02] transition-transform duration-300">
                                        <div className="absolute -right-6 -bottom-6 opacity-[0.05] rotate-12 group-hover:opacity-10 transition-opacity">
                                            <TrendingUp className="w-32 h-32 text-emerald-400" />
                                        </div>
                                        <div className="relative z-10 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-emerald-500/20 rounded-lg backdrop-blur-sm">
                                                        <ArrowUpRight className="w-5 h-5 text-emerald-300" />
                                                    </div>
                                                    <span className="text-emerald-200 font-medium">Entradas</span>
                                                </div>
                                                <span className="text-xs text-emerald-400/70 font-medium px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                                                    Mês Atual
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-white drop-shadow-lg tracking-tight">
                                                    {formatCurrency(summary?.monthEntries || 0)}
                                                </p>
                                                <p className="text-sm text-emerald-200/50 mt-1">acumulado</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Monthly Exits */}
                                    <div className="relative overflow-hidden p-6 rounded-2xl bg-gradient-to-br from-rose-500/10 to-transparent border border-rose-500/20 backdrop-blur-md shadow-[0_0_20px_rgba(244,63,94,0.1)] group hover:scale-[1.02] transition-transform duration-300">
                                        <div className="absolute -right-6 -bottom-6 opacity-[0.05] rotate-12 group-hover:opacity-10 transition-opacity">
                                            <TrendingDown className="w-32 h-32 text-rose-400" />
                                        </div>
                                        <div className="relative z-10 space-y-4">
                                            <div className="flex justify-between items-start">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2 bg-rose-500/20 rounded-lg backdrop-blur-sm">
                                                        <ArrowDownRight className="w-5 h-5 text-rose-300" />
                                                    </div>
                                                    <span className="text-rose-200 font-medium">Saídas</span>
                                                </div>
                                                <span className="text-xs text-rose-400/70 font-medium px-2 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">
                                                    Mês Atual
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-2xl font-bold text-white drop-shadow-lg tracking-tight">
                                                    {formatCurrency(summary?.monthExits || 0)}
                                                </p>
                                                <p className="text-sm text-rose-200/50 mt-1">acumulado</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Categories Breakdown */}
                        <div className="glass-card flex flex-col h-full max-h-[470px]">
                            <h3 className="text-lg font-semibold text-white mb-5 flex items-center gap-2 flex-shrink-0">
                                <Tag className="w-5 h-5 text-primary-400" /> Por Categoria
                            </h3>
                            <div className="flex-1 overflow-y-auto pr-2 space-y-4 custom-scrollbar">
                                {categorySummary.length > 0 ? (
                                    categorySummary.map((cat) => (
                                        <div key={cat.name} className="group relative">
                                            <div className="flex justify-between items-center mb-1.5">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-1 h-1 rounded-full bg-primary-500" />
                                                    <span className="text-sm text-gray-300 font-medium group-hover:text-white transition-colors">
                                                        {cat.name}
                                                    </span>
                                                    <span className="text-[9px] text-gray-500 font-bold uppercase tracking-widest ml-1 bg-white/5 px-1.5 py-0.5 rounded text-nowrap">
                                                        {cat.count} ITENS
                                                    </span>
                                                </div>
                                                <span className="text-sm text-white font-bold">{formatCurrency(cat.value)}</span>
                                            </div>
                                            <div className="relative h-1.5 rounded-full bg-white/5 overflow-hidden">
                                                <div
                                                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-primary-600 to-primary-400 transition-all duration-1000 ease-out"
                                                    style={{ width: `${cat.percentage}%` }}
                                                />
                                            </div>
                                            <div className="flex justify-end mt-0.5">
                                                <span className="text-[9px] text-gray-600 font-medium tracking-tight">
                                                    Representa {cat.percentage.toFixed(1)}% do estoque
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center h-full opacity-20">
                                        <Tag className="w-10 h-10 mb-2" />
                                        <p className="text-xs">Sem dados</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </>
            )}

            {/* Movements Tab */}
            {activeTab === 'movements' && (
                <div className="glass-card">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setActiveTab('overview')} className="btn-ghost text-sm">
                                ← Voltar
                            </button>
                            <h3 className="text-lg font-semibold text-white">Movimentações Recentes</h3>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Buscar..."
                                    className="input pl-10 w-48"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                />
                            </div>
                            <button className="btn-ghost"><Filter className="w-4 h-4" /> Filtros</button>
                        </div>
                    </div>
                    <div className="table-container">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Produto</th>
                                    <th>Tipo</th>
                                    <th>Quantidade</th>
                                    <th>Custo</th>
                                    <th>Data</th>
                                    <th>Responsável</th>
                                    <th></th>
                                </tr>
                            </thead>
                            <tbody>
                                {(movements?.data || []).map((m: any) => (
                                    <tr key={m.id}>
                                        <td className="font-medium text-white">{m.product?.name}</td>
                                        <td>
                                            <span className={`badge ${m.type === 'IN' ? 'badge-success' :
                                                m.type === 'OUT' ? 'badge-danger' :
                                                    m.type === 'ADJUSTMENT' ? (m.quantity >= 0 ? 'badge-success' : 'badge-danger') :
                                                        'badge-warning'
                                                }`}>
                                                {m.type === 'IN' ? 'Entrada' :
                                                    m.type === 'OUT' ? 'Saída' :
                                                        m.type === 'ADJUSTMENT' ? (m.quantity >= 0 ? 'Ajuste (Entrada)' : 'Ajuste (Saída)') :
                                                            m.type}
                                            </span>
                                        </td>
                                        <td>{formatNumber(m.quantity)} {m.unit}</td>
                                        <td>{formatCurrency(m.totalCost)}</td>
                                        <td className="text-gray-400">{formatDate(m.createdAt)}</td>
                                        <td className="text-gray-400">{m.user?.firstName} {m.user?.lastName}</td>
                                        <td>
                                            <button className="p-2 hover:bg-white/10 rounded-lg">
                                                <MoreVertical className="w-4 h-4 text-gray-400" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Waste Tab */}
            {activeTab === 'waste' && (
                <div className="space-y-4">
                    <div className="glass-card">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Trash2 className="w-5 h-5 text-red-400" /> Controle de Desperdícios
                            </h3>
                            <button className="btn-primary">
                                <Plus className="w-4 h-4" /> Registrar Perda
                            </button>
                        </div>

                        {/* Waste Summary */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                            <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center">
                                <p className="text-sm text-gray-400 mb-1">Perdas este mês</p>
                                <p className="text-2xl font-bold text-red-400">{formatCurrency(summary?.monthWaste || 0)}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                                <p className="text-sm text-gray-400 mb-1">Principal causa</p>
                                <p className="text-xl font-bold text-yellow-400">Vencimento</p>
                            </div>
                            <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 text-center">
                                <p className="text-sm text-gray-400 mb-1">Itens perdidos</p>
                                <p className="text-2xl font-bold text-white">{wasteMovements?.pagination?.total || 0}</p>
                            </div>
                        </div>

                        {/* Waste Log */}
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Produto</th>
                                        <th>Quantidade</th>
                                        <th>Motivo</th>
                                        <th>Observação</th>
                                        <th>Custo</th>
                                        <th>Data</th>
                                        <th>Usuário</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(wasteMovements?.data || []).map((w: any) => {
                                        const reasonKey = w.notes?.split(' - ')[0] || '';
                                        // Try to find translation, or use the key itself (handles both 'expired' and 'Vencido')
                                        const displayReason = wasteReasonMap[reasonKey] || reasonKey;
                                        const noteRest = w.notes?.split(' - ').slice(1).join(' - ');
                                        const displayNote = noteRest ? `${displayReason} - ${noteRest}` : displayReason;

                                        return (
                                            <tr key={w.id}>
                                                <td className="font-medium text-white">{w.product?.name}</td>
                                                <td>{formatNumber(w.quantity)} {w.unit}</td>
                                                <td>
                                                    <span className="badge badge-warning">
                                                        {displayReason}
                                                    </span>
                                                </td>
                                                <td className="text-gray-400 text-sm max-w-[200px] truncate" title={displayNote}>
                                                    {displayNote}
                                                </td>
                                                <td className="text-red-400">-{formatCurrency(w.totalCost)}</td>
                                                <td className="text-gray-400">{formatDate(w.createdAt)}</td>
                                                <td className="text-gray-400">{w.user?.firstName}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* Expiring Tab */}
            {activeTab === 'expiring' && (
                <div className="glass-card">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-4">
                            <button onClick={() => setActiveTab('overview')} className="btn-ghost text-sm">
                                ← Voltar
                            </button>
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-yellow-400" /> Produtos Próximos do Vencimento
                            </h3>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {expiringProducts.map((p) => (
                            <div key={p.id} className={`p-4 rounded-xl border ${p.daysLeft <= 2 ? 'bg-red-500/10 border-red-500/30' :
                                p.daysLeft <= 5 ? 'bg-yellow-500/10 border-yellow-500/30' :
                                    'bg-white/5 border-white/10'
                                }`}>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${p.daysLeft <= 2 ? 'bg-red-500/20' :
                                            p.daysLeft <= 5 ? 'bg-yellow-500/20' : 'bg-white/10'
                                            }`}>
                                            <Clock className={`w-5 h-5 ${p.daysLeft <= 2 ? 'text-red-400' :
                                                p.daysLeft <= 5 ? 'text-yellow-400' : 'text-gray-400'
                                                }`} />
                                        </div>
                                        <div>
                                            <p className="font-medium text-white">{p.name}</p>
                                            <p className="text-sm text-gray-400">{p.quantity} {p.unit}</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className={`font-semibold ${p.daysLeft <= 2 ? 'text-red-400' :
                                            p.daysLeft <= 5 ? 'text-yellow-400' : 'text-gray-400'
                                            }`}>
                                            {p.daysLeft === 0 ? 'Vence hoje!' :
                                                p.daysLeft === 1 ? 'Vence amanhã' :
                                                    `${p.daysLeft} dias`}
                                        </p>
                                        <p className="text-sm text-gray-500">{p.expiry}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}



            {/* Waste Registration Modal */}
            {showWasteModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-y-auto m-4">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                                <Trash2 className="w-6 h-6 text-red-400" /> Registrar Perda
                            </h3>
                            <button
                                onClick={() => {
                                    setShowWasteModal(false);
                                    resetWasteForm();
                                }}
                                className="p-2 hover:bg-white/10 rounded-lg"
                            >
                                <X className="w-5 h-5 text-gray-400" />
                            </button>
                        </div>

                        {!wasteProductType ? (
                            /* Product Type Selection */
                            <div className="space-y-4">
                                <p className="text-gray-300 mb-6">Selecione o tipo de insumo que teve perda:</p>
                                <button
                                    onClick={() => setWasteProductType('raw')}
                                    className="w-full p-6 rounded-xl bg-white/5 hover:bg-white/10 border-2 border-white/10 hover:border-primary-500/50 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-lg bg-green-500/20 group-hover:bg-green-500/30">
                                            <Package className="w-8 h-8 text-green-400" />
                                        </div>
                                        <div className="text-left flex-1">
                                            <h4 className="text-lg font-semibold text-white">Insumo Bruto</h4>
                                            <p className="text-sm text-gray-400">Matéria-prima em seu estado original (ex: carne crua, legumes, queijo)</p>
                                        </div>
                                    </div>
                                </button>
                                <button
                                    onClick={() => setWasteProductType('portioned')}
                                    className="w-full p-6 rounded-xl bg-white/5 hover:bg-white/10 border-2 border-white/10 hover:border-blue-500/50 transition-all group"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-lg bg-blue-500/20 group-hover:bg-blue-500/30">
                                            <Tag className="w-8 h-8 text-blue-400" />
                                        </div>
                                        <div className="text-left flex-1">
                                            <h4 className="text-lg font-semibold text-white">Insumo Porcionado</h4>
                                            <p className="text-sm text-gray-400">Produto já preparado/porcionado (ex: hambúrguer pronto, porção de batata frita)</p>
                                        </div>
                                    </div>
                                </button>
                            </div>
                        ) : (
                            /* Waste Form */
                            <div className="space-y-4">
                                <div className="flex items-center gap-2 mb-4">
                                    <button
                                        onClick={() => {
                                            setWasteProductType(null);
                                            setSelectedProduct('');
                                        }}
                                        className="btn-ghost text-sm"
                                    >
                                        ← Voltar
                                    </button>
                                    <span className="px-3 py-1 rounded-full bg-primary-500/20 text-primary-400 text-sm font-medium">
                                        {wasteProductType === 'raw' ? '🥬 Insumo Bruto' : '🍔 Insumo Porcionado'}
                                    </span>
                                </div>

                                <div>
                                    <label className="label">
                                        {wasteProductType === 'raw' ? 'Produto' : 'Receita/Porção'}
                                    </label>
                                    <select
                                        className="input"
                                        value={selectedProduct}
                                        onChange={(e) => setSelectedProduct(e.target.value)}
                                    >
                                        <option value="">Selecione...</option>
                                        {wasteProductType === 'raw' ? (
                                            productsData?.data?.map((p: any) => (
                                                <option key={p.id} value={p.id}>{p.name} ({p.baseUnit})</option>
                                            ))
                                        ) : (
                                            recipesData?.data?.map((r: any) => (
                                                <option key={r.id} value={r.id}>{r.name} ({r.yieldUnit})</option>
                                            ))
                                        )}
                                    </select>
                                </div>

                                <div>
                                    <label className="label">Quantidade Perdida</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="input"
                                        placeholder="Ex: 2.5"
                                        value={wasteQuantity}
                                        onChange={(e) => setWasteQuantity(e.target.value)}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        {wasteProductType === 'raw' ? 'Unidade conforme cadastro do produto' : 'Número de porções'}
                                    </p>
                                </div>

                                <div>
                                    <label className="label">Motivo da Perda</label>
                                    <select
                                        className="input"
                                        value={wasteReason}
                                        onChange={(e) => setWasteReason(e.target.value)}
                                    >
                                        <option value="">Selecione...</option>
                                        <option value="expired">Vencido</option>
                                        <option value="spoiled">Estragado/Deteriorado</option>
                                        <option value="damaged">Danificado</option>
                                        <option value="preparation_error">Erro de Preparo</option>
                                        <option value="contaminated">Contaminado</option>
                                        <option value="other">Outro</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="label">Observações (opcional)</label>
                                    <textarea
                                        className="input min-h-[80px]"
                                        placeholder="Detalhes adicionais sobre a perda..."
                                        value={wasteNote}
                                        onChange={(e) => setWasteNote(e.target.value)}
                                    />
                                </div>

                                <div className="flex items-center gap-2 p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                                    <input
                                        type="checkbox"
                                        id="deductStock"
                                        checked={deductStock}
                                        onChange={(e) => setDeductStock(e.target.checked)}
                                        className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500"
                                    />
                                    <label htmlFor="deductStock" className="text-sm text-gray-300 cursor-pointer select-none">
                                        Dar saída do estoque (deduzir quantidade)
                                    </label>
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-white/10">
                                    <button
                                        onClick={() => {
                                            setShowWasteModal(false);
                                            resetWasteForm();
                                        }}
                                        className="btn-ghost flex-1"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={() => {
                                            if (!selectedProduct || !wasteQuantity || !wasteReason) {
                                                toast.error('Preencha todos os campos obrigatórios');
                                                return;
                                            }

                                            // Find selected product to get unit
                                            const product = productsData?.data?.find((p: any) => p.id === selectedProduct)
                                                || recipesData?.data?.find((r: any) => r.id === selectedProduct);

                                            const unit = product?.baseUnit || product?.yieldUnit || 'un';

                                            // Get readable reason
                                            const readableReason = wasteReasonMap[wasteReason] || wasteReason;

                                            createMovementMutation.mutate({
                                                productId: selectedProduct,
                                                type: 'WASTE',
                                                quantity: Number(wasteQuantity),
                                                unit: unit,
                                                notes: `${readableReason}${wasteNote ? ` - ${wasteNote}` : ''}`,
                                                deductStock
                                            });
                                        }}
                                        className="btn-primary flex-1"
                                        disabled={!selectedProduct || !wasteQuantity || !wasteReason || createMovementMutation.isPending}
                                    >
                                        {createMovementMutation.isPending ? 'Registrando...' : 'Registrar Perda'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Requisition Modal - Commented for debugging */}
            <StockRequisitionModal
                isOpen={showRequisitionModal}
                onClose={() => setShowRequisitionModal(false)}
            />

            {/* Stock Import Modal */}
            <StockImportModal
                isOpen={showImportModal}
                onClose={() => setShowImportModal(false)}
            />
        </div>
    );
}
