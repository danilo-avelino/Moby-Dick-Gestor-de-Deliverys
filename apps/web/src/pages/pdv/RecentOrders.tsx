import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
    Plus, Search, ShoppingBag, Clock,
    Package, Truck, Users, AlertCircle
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
    const [selectedOrder, setSelectedOrder] = useState<PdvOrder | null>(null);

    const { data: orders = [], isLoading, refetch } = useQuery<PdvOrder[]>({
        queryKey: ['pdv-orders'],
        queryFn: async () => {
            const res = await api.get(`/api/pdv/orders/recent`);
            return res.data.data;
        },
        refetchInterval: 10000,
    });

    const filteredOrders = useMemo(() => {
        return orders.filter(order => {
            if (search) {
                const searchLower = search.toLowerCase();
                const matches = (
                    order.code.includes(search) ||
                    order.customerName?.toLowerCase().includes(searchLower) ||
                    order.customerPhone?.includes(search)
                );
                if (!matches) return false;
            }

            const status = order.status;
            return ['NOVO', 'EM_PREPARO', 'PRONTO', 'EM_ENTREGA', 'RETIRADA'].includes(status);
        });
    }, [orders, search]);

    const kanbanData = useMemo(() => {
        const columns = {
            preparo: [] as PdvOrder[],
            pronto: [] as PdvOrder[],
            rota: [] as PdvOrder[]
        };

        filteredOrders.forEach(order => {
            if (order.status === 'NOVO' || order.status === 'EM_PREPARO') {
                columns.preparo.push(order);
            }
            else if (order.status === 'PRONTO') {
                columns.pronto.push(order);
            }
            else if (order.status === 'EM_ENTREGA') {
                columns.rota.push(order);
            }
        });

        return columns;
    }, [filteredOrders]);


    return (
        <div className="h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-6">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <ShoppingBag className="w-7 h-7 text-primary-400" />
                            PDV - Kanban
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Gerencie o fluxo de pedidos
                        </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                        <button className="px-4 py-2 rounded-lg bg-primary-500/20 text-primary-400 font-medium text-sm">
                            Quadros
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
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Buscar pedido..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            className="input pl-9 w-64 text-sm"
                        />
                    </div>
                    <button
                        onClick={() => navigate('/pdv/new')}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        NOVO PEDIDO
                    </button>
                </div>
            </div>

            <div className="flex-1 flex gap-6 min-h-0 overflow-hidden">
                <div className="flex-1 grid grid-cols-3 gap-4 min-h-0 overflow-hidden">

                    <KanbanColumn
                        title="Em Preparo"
                        count={kanbanData.preparo.length}
                        colorClass="border-red-500/50"
                        headerBg="bg-red-500/10 text-red-500"
                    >
                        {kanbanData.preparo.length === 0 ? <EmptyState /> : (
                            kanbanData.preparo.map(order => (
                                <KanbanCard
                                    key={order.id}
                                    order={order}
                                    selectedId={selectedOrder?.id}
                                    onClick={() => setSelectedOrder(order)}
                                />
                            ))
                        )}
                    </KanbanColumn>

                    <KanbanColumn
                        title="Prontos"
                        count={kanbanData.pronto.length}
                        colorClass="border-purple-500/50"
                        headerBg="bg-purple-500/10 text-purple-500"
                    >
                        {kanbanData.pronto.length === 0 ? <EmptyState /> : (
                            kanbanData.pronto.map(order => (
                                <KanbanCard
                                    key={order.id}
                                    order={order}
                                    selectedId={selectedOrder?.id}
                                    onClick={() => setSelectedOrder(order)}
                                />
                            ))
                        )}
                    </KanbanColumn>

                    <KanbanColumn
                        title="Em Rota"
                        count={kanbanData.rota.length}
                        colorClass="border-blue-500/50"
                        headerBg="bg-blue-500/10 text-blue-500"
                    >
                        {kanbanData.rota.length === 0 ? <EmptyState /> : (
                            kanbanData.rota.map(order => (
                                <KanbanCard
                                    key={order.id}
                                    order={order}
                                    selectedId={selectedOrder?.id}
                                    onClick={() => setSelectedOrder(order)}
                                />
                            ))
                        )}
                    </KanbanColumn>

                </div>

                {selectedOrder && (
                    <div className="w-96 flex-shrink-0 flex flex-col min-h-0">
                        <div className="card h-full overflow-y-auto">
                            <OrderDetailsPanel
                                order={selectedOrder}
                                onStatusChange={() => {
                                    refetch();
                                }}
                                onClose={() => setSelectedOrder(null)}
                            />
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

function KanbanColumn({ title, count, children, colorClass, headerBg }: { title: string, count: number, children: React.ReactNode, colorClass: string, headerBg: string }) {
    return (
        <div className="flex flex-col h-full bg-white/5 rounded-xl border border-white/5 overflow-hidden">
            <div className={cn("p-4 border-b border-white/5 flex items-center justify-between", headerBg)}>
                <h3 className="font-bold text-lg">{title}</h3>
                <span className="px-2 py-0.5 rounded-full bg-black/20 text-sm font-bold">
                    {count}
                </span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3 custom-scrollbar">
                {children}
            </div>
        </div>
    );
}

function KanbanCard({ order, onClick, selectedId }: { order: PdvOrder, onClick: () => void, selectedId?: string }) {
    const TypeIcon = orderTypeIcons[order.orderType];
    const isNew = order.status === 'NOVO';
    const isSelected = selectedId === order.id;

    // Timer Effect
    const [timeSince, setTimeSince] = useState(formatTimeSince(order.createdAt));

    useEffect(() => {
        const interval = setInterval(() => {
            setTimeSince(formatTimeSince(order.createdAt));
        }, 60000);
        return () => clearInterval(interval);
    }, [order.createdAt]);

    return (
        <div
            onClick={onClick}
            className={cn(
                'card p-4 cursor-pointer transition-all hover:bg-white/5 relative group',
                isSelected ? 'border-primary-500 ring-1 ring-primary-500/50' : 'hover:border-primary-500/30'
            )}
        >
            {isNew && (
                <div className="absolute -top-1 -right-1">
                    <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-blue-500"></span>
                    </span>
                </div>
            )}

            <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                    <div className={cn('p-1.5 rounded-md', isNew ? 'bg-blue-500/20 text-blue-400' : 'bg-gray-800 text-gray-400')}>
                        <TypeIcon className="w-4 h-4" />
                    </div>
                    <span className="font-mono font-bold text-white">#{order.code}</span>
                </div>
                <div className="text-right">
                    <span className="flex items-center gap-1 text-xs text-gray-400 font-medium bg-black/20 px-1.5 py-0.5 rounded">
                        <Clock className="w-3 h-3" />
                        {timeSince}
                    </span>
                </div>
            </div>

            <div className="mb-3">
                <div className="font-medium text-white line-clamp-1">
                    {order.customerName || 'Cliente sem nome'}
                </div>
                {isNew && (
                    <div className="flex items-center gap-1 mt-1 text-xs text-blue-300 font-medium">
                        <AlertCircle className="w-3 h-3" />
                        Aguardando confirmação
                    </div>
                )}
            </div>

            <div className="flex items-center justify-between pt-3 border-t border-white/5">
                <div className="text-gray-400 text-sm">
                    {order.items.length} {order.items.length === 1 ? 'item' : 'itens'}
                </div>
                <div className="font-bold text-primary-400">
                    {formatCurrency(order.total)}
                </div>
            </div>
        </div>
    );
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center py-10 opacity-50">
            <Package className="w-10 h-10 mb-2" />
            <p className="text-sm">Vazio</p>
        </div>
    );
}

interface OrderDetailsPanelProps {
    order: PdvOrder;
    onStatusChange: () => void;
    onClose: () => void;
}

function OrderDetailsPanel({ order, onStatusChange, onClose }: OrderDetailsPanelProps) {
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
        <div className="p-5 h-full flex flex-col">
            <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-white">Detalhes do Pedido</h3>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <div className="sr-only">Fechar</div>
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
                <div className="flex items-center gap-3 mb-6 p-3 rounded-lg bg-white/5 border border-white/5">
                    <div className={cn('p-2 rounded-lg', status.bg)}>
                        <TypeIcon className={cn('w-6 h-6', status.color)} />
                    </div>
                    <div>
                        <div className="text-xl font-bold text-white">#{order.code}</div>
                        <span className={cn('text-xs font-bold uppercase tracking-wider', status.color)}>
                            {status.label}
                        </span>
                    </div>
                </div>

                <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Cliente</h4>
                    <div className="bg-black/20 rounded-lg p-3">
                        <p className="text-white font-medium">{order.customerName || 'Não identificado'}</p>
                        {order.customerPhone && <p className="text-gray-400 text-sm mt-1">{order.customerPhone}</p>}
                        {order.tableIdentifier && (
                            <div className="mt-2 text-sm text-primary-400 flex items-center gap-1">
                                <Users className="w-3 h-3" />
                                {order.tableIdentifier}
                            </div>
                        )}
                    </div>
                </div>

                <div className="mb-6">
                    <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                        Itens ({order.items.length})
                    </h4>
                    <div className="space-y-2">
                        {order.items.map((item) => (
                            <div key={item.id} className="flex justify-between items-start text-sm p-2 rounded hover:bg-white/5 transition-colors">
                                <div className="flex gap-2">
                                    <span className="font-bold text-primary-400 w-6 text-center">{item.quantity}x</span>
                                    <span className="text-gray-300">{item.productName}</span>
                                </div>
                                <span className="text-white font-medium">{formatCurrency(item.totalPrice)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="border-t border-white/10 pt-4 mb-6">
                    <div className="flex justify-between text-lg font-bold">
                        <span className="text-white">Total</span>
                        <span className="text-primary-400">{formatCurrency(order.total)}</span>
                    </div>
                </div>
            </div>

            <div className="pt-4 mt-auto border-t border-white/10">
                {nextStatuses[order.status] && (
                    <div className="grid grid-cols-1 gap-2">
                        {nextStatuses[order.status].map((nextStatus) => {
                            const config = statusConfig[nextStatus];
                            const isCancel = nextStatus === 'CANCELADO';

                            return (
                                <button
                                    key={nextStatus}
                                    onClick={() => handleStatusChange(nextStatus)}
                                    disabled={isUpdating}
                                    className={cn(
                                        'w-full py-3 px-4 rounded-xl font-bold text-sm transition-all transform active:scale-95',
                                        isCancel
                                            ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20'
                                            : 'bg-primary-500 text-white hover:bg-primary-600 shadow-lg shadow-primary-500/20'
                                    )}
                                >
                                    {isUpdating ? 'Atualizando...' : (
                                        isCancel ? 'Cancelar Pedido' : `Mover para ${config.label}`
                                    )}
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
