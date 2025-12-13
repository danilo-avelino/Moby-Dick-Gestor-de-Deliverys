import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
    Plus, Search, ShoppingBag, Clock, ChevronRight,
    Package, Truck, Users, XCircle, CheckCircle, Timer
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface PdvOrder {
    id: string;
    code: string;
    orderType: 'DELIVERY' | 'RETIRADA' | 'SALAO';
    status: 'NOVO' | 'EM_PREPARO' | 'PRONTO' | 'EM_ENTREGA' | 'CONCLUIDO' | 'CANCELADO';
    salesChannel: string;
    customerName?: string;
    customerPhone?: string;
    tableIdentifier?: string;
    total: number;
    createdAt: string;
    items: Array<{ id: string; productName: string; quantity: number; totalPrice: number }>;
    payments: Array<{ method: string; amount: number; status: string }>;
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    NOVO: { label: 'Novo', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    EM_PREPARO: { label: 'Em Preparo', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    PRONTO: { label: 'Pronto', color: 'text-green-400', bg: 'bg-green-500/20' },
    EM_ENTREGA: { label: 'Em Entrega', color: 'text-purple-400', bg: 'bg-purple-500/20' },
    CONCLUIDO: { label: 'Concluído', color: 'text-gray-400', bg: 'bg-gray-500/20' },
    CANCELADO: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-500/20' },
};

const orderTypeIcons = {
    DELIVERY: Truck,
    RETIRADA: Package,
    SALAO: Users,
};

function formatTimeSince(dateString: string): string {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 60) return `${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    const remainMins = diffMins % 60;
    return `${diffHours} h ${remainMins} min`;
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function RecentOrders() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [selectedOrder, setSelectedOrder] = useState<PdvOrder | null>(null);

    const { data: orders = [], isLoading, refetch } = useQuery({
        queryKey: ['pdv-orders', statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);
            const res = await api.get(`/api/pdv/orders/recent?${params}`);
            return res.data.data as PdvOrder[];
        },
        refetchInterval: 10000, // Auto-refresh every 10s
    });

    // Filter by search
    const filteredOrders = orders.filter(order => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
            order.code.includes(search) ||
            order.customerName?.toLowerCase().includes(searchLower) ||
            order.customerPhone?.includes(search)
        );
    });

    // Stats
    const stats = {
        total: orders.length,
        novo: orders.filter(o => o.status === 'NOVO').length,
        emPreparo: orders.filter(o => o.status === 'EM_PREPARO').length,
        pronto: orders.filter(o => o.status === 'PRONTO').length,
    };

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <ShoppingBag className="w-7 h-7 text-primary-400" />
                            PDV - Últimos Pedidos
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Gerencie seus pedidos em tempo real
                        </p>
                    </div>
                    {/* Navigation Tabs */}
                    <div className="flex items-center gap-2 ml-4">
                        <button
                            className="px-4 py-2 rounded-lg bg-primary-500/20 text-primary-400 font-medium text-sm"
                        >
                            Pedidos
                        </button>
                        <button
                            onClick={() => navigate('/pdv/cash')}
                            className="px-4 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white font-medium text-sm transition-colors"
                        >
                            Caixa
                        </button>
                        <button
                            onClick={() => navigate('/pdv/history')}
                            className="px-4 py-2 rounded-lg hover:bg-white/5 text-gray-400 hover:text-white font-medium text-sm transition-colors"
                        >
                            Histórico
                        </button>
                    </div>
                </div>
                <button
                    onClick={() => navigate('/pdv/new')}
                    className="btn-primary flex items-center gap-2"
                >
                    <Plus className="w-5 h-5" />
                    NOVO PEDIDO
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-4 gap-4 mb-6">
                <div className="card p-4">
                    <div className="text-gray-400 text-sm">Total Hoje</div>
                    <div className="text-2xl font-bold text-white">{stats.total}</div>
                </div>
                <div className="card p-4 border-l-4 border-blue-500">
                    <div className="text-gray-400 text-sm">Novos</div>
                    <div className="text-2xl font-bold text-blue-400">{stats.novo}</div>
                </div>
                <div className="card p-4 border-l-4 border-yellow-500">
                    <div className="text-gray-400 text-sm">Em Preparo</div>
                    <div className="text-2xl font-bold text-yellow-400">{stats.emPreparo}</div>
                </div>
                <div className="card p-4 border-l-4 border-green-500">
                    <div className="text-gray-400 text-sm">Prontos</div>
                    <div className="text-2xl font-bold text-green-400">{stats.pronto}</div>
                </div>
            </div>

            {/* Search and Filters */}
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
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="input w-48"
                >
                    <option value="">Todos os status</option>
                    <option value="NOVO">Novos</option>
                    <option value="EM_PREPARO">Em Preparo</option>
                    <option value="PRONTO">Prontos</option>
                    <option value="EM_ENTREGA">Em Entrega</option>
                    <option value="CONCLUIDO">Concluídos</option>
                    <option value="CANCELADO">Cancelados</option>
                </select>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex gap-6 min-h-0">
                {/* Orders List */}
                <div className="flex-1 overflow-y-auto space-y-3 pr-2">
                    {isLoading ? (
                        <div className="flex items-center justify-center h-40">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
                        </div>
                    ) : filteredOrders.length === 0 ? (
                        <div className="card p-8 text-center">
                            <Package className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-400">Nenhum pedido encontrado</p>
                        </div>
                    ) : (
                        filteredOrders.map((order) => {
                            const TypeIcon = orderTypeIcons[order.orderType];
                            const status = statusConfig[order.status];

                            return (
                                <div
                                    key={order.id}
                                    onClick={() => setSelectedOrder(order)}
                                    className={cn(
                                        'card p-4 cursor-pointer transition-all hover:border-primary-500/50',
                                        selectedOrder?.id === order.id && 'border-primary-500 bg-primary-500/5'
                                    )}
                                >
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-start gap-3">
                                            <div className={cn('p-2 rounded-lg', status.bg)}>
                                                <TypeIcon className={cn('w-5 h-5', status.color)} />
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-white">
                                                        #{order.code}
                                                    </span>
                                                    <span className={cn('px-2 py-0.5 rounded text-xs font-medium', status.bg, status.color)}>
                                                        {status.label}
                                                    </span>
                                                </div>
                                                <p className="text-gray-400 text-sm">
                                                    {order.customerName || 'Cliente não identificado'}
                                                </p>
                                                {order.tableIdentifier && (
                                                    <p className="text-gray-500 text-xs">{order.tableIdentifier}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="font-semibold text-white">
                                                {formatCurrency(order.total)}
                                            </div>
                                            <div className="flex items-center gap-1 text-gray-500 text-sm">
                                                <Clock className="w-3 h-3" />
                                                {formatTimeSince(order.createdAt)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Order Details Panel */}
                <div className="w-96 flex-shrink-0">
                    <div className="card h-full overflow-y-auto">
                        {selectedOrder ? (
                            <OrderDetailsPanel order={selectedOrder} onStatusChange={() => refetch()} />
                        ) : (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500 p-8">
                                <Package className="w-16 h-16 mb-4 opacity-50" />
                                <p className="text-center">Selecione um pedido para ver os detalhes</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

interface OrderDetailsPanelProps {
    order: PdvOrder;
    onStatusChange: () => void;
}

function OrderDetailsPanel({ order, onStatusChange }: OrderDetailsPanelProps) {
    const [isUpdating, setIsUpdating] = useState(false);
    const status = statusConfig[order.status];
    const TypeIcon = orderTypeIcons[order.orderType];

    const nextStatuses: Record<string, string[]> = {
        NOVO: ['EM_PREPARO', 'CANCELADO'],
        EM_PREPARO: ['PRONTO', 'CANCELADO'],
        PRONTO: order.orderType === 'DELIVERY' ? ['EM_ENTREGA', 'CONCLUIDO'] : ['CONCLUIDO'],
        EM_ENTREGA: ['CONCLUIDO', 'CANCELADO'],
    };

    const handleStatusChange = async (newStatus: string) => {
        setIsUpdating(true);
        try {
            await api.patch(`/api/pdv/orders/${order.id}/status`, { status: newStatus });
            onStatusChange();
        } catch (err) {
            console.error('Failed to update status:', err);
        } finally {
            setIsUpdating(false);
        }
    };

    return (
        <div className="p-4">
            {/* Header */}
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-white/10">
                <div className="flex items-center gap-3">
                    <div className={cn('p-2 rounded-lg', status.bg)}>
                        <TypeIcon className={cn('w-6 h-6', status.color)} />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white">Pedido #{order.code}</h3>
                        <span className={cn('px-2 py-0.5 rounded text-xs font-medium', status.bg, status.color)}>
                            {status.label}
                        </span>
                    </div>
                </div>
            </div>

            {/* Customer Info */}
            <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Cliente</h4>
                <p className="text-white">{order.customerName || 'Não identificado'}</p>
                {order.customerPhone && <p className="text-gray-400 text-sm">{order.customerPhone}</p>}
                {order.tableIdentifier && (
                    <p className="text-primary-400 text-sm">{order.tableIdentifier}</p>
                )}
            </div>

            {/* Items */}
            <div className="mb-4">
                <h4 className="text-sm font-medium text-gray-400 mb-2">Itens</h4>
                <div className="space-y-2">
                    {order.items.map((item) => (
                        <div key={item.id} className="flex justify-between text-sm">
                            <span className="text-gray-300">
                                {item.quantity}x {item.productName}
                            </span>
                            <span className="text-white">{formatCurrency(item.totalPrice)}</span>
                        </div>
                    ))}
                </div>
            </div>

            {/* Total */}
            <div className="border-t border-white/10 pt-4 mb-4">
                <div className="flex justify-between text-lg font-bold">
                    <span className="text-white">Total</span>
                    <span className="text-primary-400">{formatCurrency(order.total)}</span>
                </div>
            </div>

            {/* Actions */}
            {nextStatuses[order.status] && (
                <div className="space-y-2">
                    <h4 className="text-sm font-medium text-gray-400 mb-2">Ações</h4>
                    <div className="flex flex-wrap gap-2">
                        {nextStatuses[order.status].map((nextStatus) => {
                            const config = statusConfig[nextStatus];
                            const isCancel = nextStatus === 'CANCELADO';

                            return (
                                <button
                                    key={nextStatus}
                                    onClick={() => handleStatusChange(nextStatus)}
                                    disabled={isUpdating}
                                    className={cn(
                                        'flex-1 py-2 px-3 rounded-lg font-medium text-sm transition-colors',
                                        isCancel
                                            ? 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
                                            : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'
                                    )}
                                >
                                    {isUpdating ? '...' : config.label}
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}
