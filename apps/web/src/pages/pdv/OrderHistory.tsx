import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
    History, Search, Filter, Download, ChevronDown, ChevronUp,
    Package, Truck, Users, Calendar, ArrowLeft
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface PdvOrder {
    id: string;
    code: string;
    orderType: 'DELIVERY' | 'RETIRADA' | 'SALAO';
    status: 'NOVO' | 'EM_PREPARO' | 'PRONTO' | 'EM_ENTREGA' | 'CONCLUIDO' | 'CANCELADO';
    salesChannel: string;
    customerName?: string;
    total: number;
    createdAt: string;
    items: Array<{ productName: string; quantity: number; totalPrice: number }>;
    payments: Array<{ method: string; amount: number }>;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    NOVO: { label: 'Novo', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    EM_PREPARO: { label: 'Em Preparo', color: 'text-red-400', bg: 'bg-red-500/20' },
    PRONTO: { label: 'Pronto', color: 'text-purple-400', bg: 'bg-purple-500/20' },
    EM_ENTREGA: { label: 'Em Entrega', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    CONCLUIDO: { label: 'Concluído', color: 'text-gray-400', bg: 'bg-gray-500/20' },
    CANCELADO: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-500/20' },
};

const orderTypeIcons = {
    DELIVERY: Truck,
    RETIRADA: Package,
    SALAO: Users,
};

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function OrderHistory() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [typeFilter, setTypeFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [page, setPage] = useState(1);
    const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
    const [showFilters, setShowFilters] = useState(false);

    const { data, isLoading } = useQuery({
        queryKey: ['order-history', page, statusFilter, typeFilter, startDate, endDate, search],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.set('page', String(page));
            params.set('limit', '20');
            if (statusFilter) params.set('status', statusFilter);
            if (typeFilter) params.set('type', typeFilter);
            if (startDate) params.set('startDate', startDate);
            if (endDate) params.set('endDate', endDate);
            if (search) params.set('search', search);

            const res = await api.get(`/api/pdv/orders?${params}`);
            return res.data.data;
        },
    });

    const orders: PdvOrder[] = data?.data || [];
    const pagination = data?.pagination;

    const handleExport = async () => {
        // Simple CSV export
        const headers = ['Código', 'Data', 'Tipo', 'Status', 'Cliente', 'Total'];
        const rows = orders.map(o => [
            `#${o.code}`,
            formatDate(o.createdAt),
            o.orderType,
            statusConfig[o.status].label,
            o.customerName || '-',
            formatCurrency(o.total),
        ]);

        const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pedidos-${new Date().toISOString().split('T')[0]}.csv`;
        a.click();
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/pdv')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Voltar
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <History className="w-7 h-7 text-primary-400" />
                            Histórico de Pedidos
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Consulte todos os pedidos realizados
                        </p>
                    </div>
                </div>
                <button onClick={handleExport} className="btn-secondary flex items-center gap-2">
                    <Download className="w-4 h-4" />
                    Exportar CSV
                </button>
            </div>

            {/* Search and Filters */}
            <div className="card p-4 mb-4">
                <div className="flex items-center gap-4 mb-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Pesquise por cliente ou número do pedido..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input pl-10 w-full"
                        />
                    </div>
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={cn(
                            'btn-secondary flex items-center gap-2',
                            showFilters && 'bg-primary-500/20'
                        )}
                    >
                        <Filter className="w-4 h-4" />
                        Filtros
                        {showFilters ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                    </button>
                </div>

                {showFilters && (
                    <div className="grid grid-cols-4 gap-4 pt-4 border-t border-white/10">
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Status</label>
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="input w-full"
                            >
                                <option value="">Todos</option>
                                {Object.entries(statusConfig).map(([key, val]) => (
                                    <option key={key} value={key}>{val.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Tipo</label>
                            <select
                                value={typeFilter}
                                onChange={(e) => setTypeFilter(e.target.value)}
                                className="input w-full"
                            >
                                <option value="">Todos</option>
                                <option value="DELIVERY">Delivery</option>
                                <option value="RETIRADA">Retirada</option>
                                <option value="SALAO">Salão</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Data Início</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={(e) => setStartDate(e.target.value)}
                                className="input w-full"
                            />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-1">Data Fim</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={(e) => setEndDate(e.target.value)}
                                className="input w-full"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Orders Table */}
            <div className="card flex-1 overflow-hidden flex flex-col">
                <div className="flex-1 overflow-y-auto">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                        </div>
                    ) : orders.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-500">
                            <History className="w-12 h-12 mb-2 opacity-50" />
                            <p>Nenhum pedido encontrado</p>
                        </div>
                    ) : (
                        <table className="w-full">
                            <thead className="bg-gray-800/50 sticky top-0">
                                <tr>
                                    <th className="text-left p-3 text-gray-400 font-medium text-sm">Pedido</th>
                                    <th className="text-left p-3 text-gray-400 font-medium text-sm">Data</th>
                                    <th className="text-left p-3 text-gray-400 font-medium text-sm">Tipo</th>
                                    <th className="text-left p-3 text-gray-400 font-medium text-sm">Cliente</th>
                                    <th className="text-center p-3 text-gray-400 font-medium text-sm">Status</th>
                                    <th className="text-right p-3 text-gray-400 font-medium text-sm">Total</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {orders.map((order) => {
                                    const status = statusConfig[order.status];
                                    const TypeIcon = orderTypeIcons[order.orderType];
                                    const isExpanded = expandedOrder === order.id;

                                    return (
                                        <>
                                            <tr
                                                key={order.id}
                                                onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                                                className="border-b border-white/5 hover:bg-white/5 cursor-pointer"
                                            >
                                                <td className="p-3">
                                                    <span className="font-medium text-white">#{order.code}</span>
                                                </td>
                                                <td className="p-3 text-gray-400 text-sm">
                                                    {formatDate(order.createdAt)}
                                                </td>
                                                <td className="p-3">
                                                    <div className="flex items-center gap-2 text-gray-400">
                                                        <TypeIcon className="w-4 h-4" />
                                                        <span className="text-sm">{order.orderType}</span>
                                                    </div>
                                                </td>
                                                <td className="p-3 text-white">
                                                    {order.customerName || '-'}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={cn('px-2 py-1 rounded text-xs font-medium', status.bg, status.color)}>
                                                        {status.label}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-right font-medium text-white">
                                                    {formatCurrency(order.total)}
                                                </td>
                                                <td className="p-3">
                                                    {isExpanded ? (
                                                        <ChevronUp className="w-4 h-4 text-gray-400" />
                                                    ) : (
                                                        <ChevronDown className="w-4 h-4 text-gray-400" />
                                                    )}
                                                </td>
                                            </tr>

                                            {/* Expanded Details */}
                                            {isExpanded && (
                                                <tr key={`${order.id}-details`}>
                                                    <td colSpan={7} className="bg-gray-800/30 p-4">
                                                        <div className="grid grid-cols-2 gap-6">
                                                            {/* Items */}
                                                            <div>
                                                                <h4 className="text-sm font-medium text-gray-400 mb-2">Itens</h4>
                                                                <div className="space-y-1">
                                                                    {order.items.map((item, idx) => (
                                                                        <div key={idx} className="flex justify-between text-sm">
                                                                            <span className="text-gray-300">
                                                                                {item.quantity}x {item.productName}
                                                                            </span>
                                                                            <span className="text-white">
                                                                                {formatCurrency(item.totalPrice)}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* Payments */}
                                                            <div>
                                                                <h4 className="text-sm font-medium text-gray-400 mb-2">Pagamentos</h4>
                                                                <div className="space-y-1">
                                                                    {order.payments.map((payment, idx) => (
                                                                        <div key={idx} className="flex justify-between text-sm">
                                                                            <span className="text-gray-300">{payment.method}</span>
                                                                            <span className="text-green-400">
                                                                                {formatCurrency(payment.amount)}
                                                                            </span>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Pagination */}
                {pagination && pagination.totalPages > 1 && (
                    <div className="p-4 border-t border-white/10 flex items-center justify-between">
                        <span className="text-sm text-gray-400">
                            Mostrando {orders.length} de {pagination.total} pedidos
                        </span>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={!pagination.hasPrev}
                                className="btn-secondary px-3 py-1"
                            >
                                Anterior
                            </button>
                            <span className="px-3 py-1 text-white">
                                {pagination.page} / {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={!pagination.hasNext}
                                className="btn-secondary px-3 py-1"
                            >
                                Próximo
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
