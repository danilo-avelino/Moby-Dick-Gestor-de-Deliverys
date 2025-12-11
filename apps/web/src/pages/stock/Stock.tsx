import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import StockRequisitionModal from './components/StockRequisitionModal';
import StockImportModal from './components/StockImportModal';
import { api } from '../../lib/api';
import { formatCurrency, formatNumber, formatDate } from '../../lib/utils';
import {
    Plus, Package, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
    Clock, AlertTriangle, Calendar, Trash2, ClipboardCheck, RefreshCw,
    Search, Filter, MoreVertical, Eye, History, Tag, X, FileOutput, Upload
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CategorySummary {
    name: string;
    value: number;
    count: number;
    percentage: number;
}

export default function Stock() {
    const [activeTab, setActiveTab] = useState<'overview' | 'movements' | 'waste' | 'expiring' | 'checklist'>('overview');
    const [search, setSearch] = useState('');
    const [showWasteModal, setShowWasteModal] = useState(false);
    const [showRequisitionModal, setShowRequisitionModal] = useState(false);
    const [showImportModal, setShowImportModal] = useState(false);
    const [wasteProductType, setWasteProductType] = useState<'raw' | 'portioned' | null>(null);
    const [selectedProduct, setSelectedProduct] = useState('');
    const [wasteQuantity, setWasteQuantity] = useState('');
    const [wasteReason, setWasteReason] = useState('');

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

    // Query for category data
    const { data: categoryData } = useQuery({
        queryKey: ['stock-by-category'],
        queryFn: () => api.get('/api/stock/by-category').then((r) => r.data.data),
        staleTime: 30000,
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
        { id: 'checklist', label: 'Checklist', icon: ClipboardCheck },
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
                    <button onClick={() => refetch()} className="btn-ghost">
                        <RefreshCw className="w-4 h-4" /> Atualizar
                    </button>
                    <button onClick={() => setShowImportModal(true)} className="btn-ghost">
                        <Upload className="w-4 h-4" /> Importar Excel
                    </button>
                    <Link to="/stock/inventory" className="btn-secondary">
                        <ClipboardCheck className="w-5 h-5" /> Fazer Inventário
                    </Link>
                    <Link to="/stock/entry" className="btn-primary">
                        <Plus className="w-5 h-5" /> Nova Entrada
                    </Link>
                </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 overflow-x-auto pb-2">
                {tabs.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => setActiveTab(tab.id as any)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-medium whitespace-nowrap transition-all ${activeTab === tab.id
                            ? 'bg-primary-600 text-white'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* Overview Tab */}
            {activeTab === 'overview' && (
                <>
                    {/* Main KPIs */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="stat-card">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-primary-500/20">
                                    <Package className="w-5 h-5 text-primary-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Valor Total</p>
                                    <p className="text-xl font-bold text-white">{formatCurrency(summary?.totalValue || 42600)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Low Stock Card */}
                        <div className="stat-card">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-yellow-500/20">
                                    <AlertTriangle className="w-5 h-5 text-yellow-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Estoque Baixo</p>
                                    <p className="text-xl font-bold text-yellow-400">{formatNumber(summary?.lowStockCount || 0)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Expiring Card */}
                        <div className="stat-card">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-red-500/20">
                                    <Calendar className="w-5 h-5 text-red-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Vencendo em 7 dias</p>
                                    <p className="text-xl font-bold text-red-400">0</p>
                                </div>
                            </div>
                        </div>

                        {/* Waste Card */}
                        <div className="stat-card">
                            <div className="flex items-center gap-3">
                                <div className="p-3 rounded-xl bg-red-500/20">
                                    <Trash2 className="w-5 h-5 text-red-400" />
                                </div>
                                <div>
                                    <p className="text-sm text-gray-400">Perdas (mês)</p>
                                    <p className="text-xl font-bold text-red-400">{formatCurrency(0)}</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Today Summary + Categories */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {/* Today's Flow */}
                        <div className="glass-card">
                            <h3 className="text-lg font-semibold text-white mb-4">Movimentação Hoje</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowUpRight className="w-5 h-5 text-green-400" />
                                        <span className="text-green-400 font-medium">Entradas</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{formatCurrency(summary?.todayEntries || 0)}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowDownRight className="w-5 h-5 text-red-400" />
                                        <span className="text-red-400 font-medium">Saídas</span>
                                    </div>
                                    <p className="text-2xl font-bold text-white">{formatCurrency(summary?.todayExits || 0)}</p>
                                </div>
                            </div>

                            {/* Monthly Totals */}
                            <h3 className="text-lg font-semibold text-white mt-6 mb-4">Movimentação do Mês</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 rounded-xl bg-green-500/5 border border-green-500/10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowUpRight className="w-4 h-4 text-green-400" />
                                        <span className="text-green-400/80 text-sm font-medium">Entradas (mês)</span>
                                    </div>
                                    <p className="text-xl font-bold text-white">{formatCurrency(summary?.monthEntries || 0)}</p>
                                </div>
                                <div className="p-4 rounded-xl bg-red-500/5 border border-red-500/10">
                                    <div className="flex items-center gap-2 mb-2">
                                        <ArrowDownRight className="w-4 h-4 text-red-400" />
                                        <span className="text-red-400/80 text-sm font-medium">Saídas (mês)</span>
                                    </div>
                                    <p className="text-xl font-bold text-white">{formatCurrency(summary?.monthExits || 0)}</p>
                                </div>
                            </div>
                        </div>

                        {/* Categories Breakdown */}
                        <div className="glass-card">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Tag className="w-5 h-5 text-primary-400" /> Por Categoria
                            </h3>
                            <div className="space-y-3">
                                {categorySummary.length > 0 ? (
                                    categorySummary.map((cat) => (
                                        <div key={cat.name} className="flex items-center gap-3">
                                            <div className="flex-1">
                                                <div className="flex justify-between text-sm mb-1">
                                                    <span className="text-white">{cat.name}</span>
                                                    <span className="text-gray-400">{formatCurrency(cat.value)}</span>
                                                </div>
                                                <div className="h-2 rounded-full bg-gray-700 overflow-hidden">
                                                    <div
                                                        className="h-full rounded-full bg-gradient-to-r from-primary-500 to-secondary-500"
                                                        style={{ width: `${cat.percentage}%` }}
                                                    />
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="text-gray-500 text-sm text-center py-4">Nenhum produto cadastrado</p>
                                )}
                            </div>
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
                    </div>
                </>
            )}

            {/* Movements Tab */}
            {activeTab === 'movements' && (
                <div className="glass-card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white">Movimentações Recentes</h3>
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
                                <p className="text-2xl font-bold text-red-400">{formatCurrency(wasteLog.reduce((a, w) => a + w.value, 0))}</p>
                            </div>
                            <div className="p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/20 text-center">
                                <p className="text-sm text-gray-400 mb-1">Principal causa</p>
                                <p className="text-xl font-bold text-yellow-400">Vencimento</p>
                            </div>
                            <div className="p-4 rounded-xl bg-primary-500/10 border border-primary-500/20 text-center">
                                <p className="text-sm text-gray-400 mb-1">Itens perdidos</p>
                                <p className="text-2xl font-bold text-white">{wasteLog.length}</p>
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
                                        <th>Valor</th>
                                        <th>Data</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {wasteLog.map((w) => (
                                        <tr key={w.id}>
                                            <td className="font-medium text-white">{w.product}</td>
                                            <td>{w.quantity} {w.unit}</td>
                                            <td>
                                                <span className={`badge ${w.reason === 'Vencido' ? 'badge-danger' : 'badge-warning'}`}>
                                                    {w.reason}
                                                </span>
                                            </td>
                                            <td className="text-red-400">-{formatCurrency(w.value)}</td>
                                            <td className="text-gray-400">{w.date}</td>
                                        </tr>
                                    ))}
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
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-yellow-400" /> Produtos Próximos do Vencimento
                        </h3>
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

            {/* Checklist Tab */}
            {activeTab === 'checklist' && (
                <div className="glass-card">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <ClipboardCheck className="w-5 h-5 text-blue-400" /> Checklist Diário
                        </h3>
                        <button className="btn-ghost">
                            <Plus className="w-4 h-4" /> Nova Tarefa
                        </button>
                    </div>

                    <div className="space-y-3">
                        {dailyChecklist.map((item) => (
                            <div key={item.id} className={`p-4 rounded-xl border flex items-center gap-4 ${item.completed ? 'bg-green-500/5 border-green-500/20' : 'bg-white/5 border-white/10'
                                }`}>
                                <button className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${item.completed
                                    ? 'bg-green-500 border-green-500'
                                    : 'border-gray-500 hover:border-primary-400'
                                    }`}>
                                    {item.completed && (
                                        <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    )}
                                </button>
                                <div className="flex-1">
                                    <p className={`font-medium ${item.completed ? 'text-gray-400 line-through' : 'text-white'}`}>
                                        {item.task}
                                    </p>
                                    <p className="text-sm text-gray-500">Programado para {item.time}</p>
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
                                    setWasteProductType(null);
                                    setSelectedProduct('');
                                    setWasteQuantity('');
                                    setWasteReason('');
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
                                        onClick={() => setWasteProductType(null)}
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
                                            <>
                                                <option value="1">Carne Moída</option>
                                                <option value="2">Queijo Mussarela</option>
                                                <option value="3">Tomate</option>
                                                <option value="4">Alface</option>
                                            </>
                                        ) : (
                                            <>
                                                <option value="10">Hambúrguer Artesanal</option>
                                                <option value="11">Porção Batata Frita</option>
                                                <option value="12">Pizza Margherita</option>
                                                <option value="13">Sanduíche Natural</option>
                                            </>
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
                                    />
                                </div>

                                <div className="flex gap-3 pt-4 border-t border-white/10">
                                    <button
                                        onClick={() => {
                                            setShowWasteModal(false);
                                            setWasteProductType(null);
                                            setSelectedProduct('');
                                            setWasteQuantity('');
                                            setWasteReason('');
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
                                            toast.success('Perda registrada com sucesso!');
                                            setShowWasteModal(false);
                                            setWasteProductType(null);
                                            setSelectedProduct('');
                                            setWasteQuantity('');
                                            setWasteReason('');
                                            setActiveTab('waste');
                                        }}
                                        className="btn-primary flex-1"
                                        disabled={!selectedProduct || !wasteQuantity || !wasteReason}
                                    >
                                        Registrar Perda
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
