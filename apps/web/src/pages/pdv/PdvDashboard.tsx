
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
    ShoppingBag, Plus, History, CreditCard,
    Truck, Package, Users, Clock, ArrowRight,
    Search, Filter, ChevronRight
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface OrderSummary {
    id: string;
    code: string;
    customerName: string;
    total: number;
    status: 'NOVO' | 'EM_PREPARO' | 'PRONTO' | 'EM_ENTREGA' | 'CONCLUIDO' | 'CANCELADO';
    orderType: 'DELIVERY' | 'RETIRADA' | 'SALAO';
    createdAt: string;
}

const statusConfig: Record<string, { label: string; bg: string; text: string; border: string }> = {
    NOVO: { label: 'Novo', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    EM_PREPARO: { label: 'Preparo', bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
    PRONTO: { label: 'Pronto', bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/20' },
    EM_ENTREGA: { label: 'Entrega', bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/20' },
    CONCLUIDO: { label: 'Concluído', bg: 'bg-green-500/10', text: 'text-green-400', border: 'border-green-500/20' },
    CANCELADO: { label: 'Cancelado', bg: 'bg-gray-500/10', text: 'text-gray-400', border: 'border-gray-500/20' },
};

const orderTypeIcons = {
    DELIVERY: Truck,
    RETIRADA: Package,
    SALAO: Users,
};

export default function PdvDashboard() {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');

    const { data: orders, isLoading } = useQuery({
        queryKey: ['recent-orders'],
        queryFn: async () => {
            const res = await api.get('/api/pdv/orders', { params: { limit: 10 } });
            return res.data.data.data as OrderSummary[];
        },
        refetchInterval: 30000, // Refresh every 30s
    });

    const { data: cashSession } = useQuery({
        queryKey: ['cash-session-summary'],
        queryFn: async () => {
            const res = await api.get('/api/pdv/cash/current');
            return res.data.data;
        },
    });

    const filteredOrders = orders?.filter(o =>
        o.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        o.code.includes(search)
    ) || [];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header with Quick Actions */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShoppingBag className="w-8 h-8 text-primary-500" />
                        Ponto de Venda
                    </h1>
                    <p className="text-gray-400">Gerencie pedidos e fluxo de caixa</p>
                </div>

                <div className="flex flex-wrap gap-2">
                    <Link to="/pdv/new" className="btn-primary">
                        <Plus className="w-5 h-5" /> Novo Pedido
                    </Link>
                    <Link to="/pdv/cash" className="btn-secondary">
                        <CreditCard className="w-5 h-5" /> {cashSession ? 'Gerenciar Caixa' : 'Abrir Caixa'}
                    </Link>
                    <Link to="/pdv/history" className="btn-ghost">
                        <History className="w-5 h-5" /> Histórico
                    </Link>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main: Recent Orders */}
                <div className="lg:col-span-2 space-y-4">
                    <div className="flex items-center justify-between">
                        <h2 className="text-lg font-semibold text-white">Pedidos Recentes</h2>
                        <div className="relative w-64">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Buscar pedido..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="input pl-9 py-1.5 text-sm"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        {isLoading ? (
                            Array(5).fill(0).map((_, i) => (
                                <div key={i} className="glass-card py-4 animate-pulse h-20" />
                            ))
                        ) : filteredOrders.length > 0 ? (
                            filteredOrders.map(order => {
                                const status = statusConfig[order.status];
                                const TypeIcon = orderTypeIcons[order.orderType];
                                return (
                                    <div
                                        key={order.id}
                                        className="card group hover:scale-[1.01] transition-transform cursor-pointer"
                                        onClick={() => navigate(`/pdv/history`)} // Expand logic can be added later
                                    >
                                        <div className="p-4 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className={cn("p-2 rounded-lg bg-gray-800", status.text)}>
                                                    <TypeIcon className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <h3 className="font-medium text-white flex items-center gap-2">
                                                        #{order.code}
                                                        <span className="text-xs text-gray-500 font-normal">
                                                            {new Date(order.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </h3>
                                                    <p className="text-sm text-gray-400 capitalize">{order.customerName || 'Cliente sem nome'}</p>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-6">
                                                <div className="text-right hidden sm:block">
                                                    <p className="text-sm font-bold text-white">
                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(order.total)}
                                                    </p>
                                                    <p className="text-[10px] text-gray-500 uppercase tracking-wider">{order.orderType}</p>
                                                </div>
                                                <div className={cn(
                                                    "px-3 py-1 rounded-full text-xs font-bold border",
                                                    status.bg, status.text, status.border
                                                )}>
                                                    {status.label}
                                                </div>
                                                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-primary-400 transition-colors" />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="glass-card py-12 text-center">
                                <ShoppingBag className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                                <p className="text-gray-500">Nenhum pedido recente encontrado.</p>
                            </div>
                        )}
                    </div>

                    {filteredOrders.length > 0 && (
                        <Link to="/pdv/history" className="flex items-center justify-center gap-2 text-primary-400 hover:text-primary-300 text-sm font-medium py-2">
                            Ver histórico completo <ArrowRight className="w-4 h-4" />
                        </Link>
                    )}
                </div>

                {/* Sidebar: Status & Stats */}
                <div className="space-y-6">
                    {/* Cash Status Card */}
                    <div className={cn(
                        "glass-card border-t-4",
                        cashSession ? "border-t-green-500" : "border-t-red-500"
                    )}>
                        <h3 className="text-lg font-bold text-white mb-4">Status do Caixa</h3>
                        {cashSession ? (
                            <div className="space-y-4">
                                <div className="flex items-center gap-3">
                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                    <span className="text-sm text-green-400 font-medium">Caixa Aberto</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-white/5 p-3 rounded-xl">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Em Caixa</p>
                                        <p className="text-lg font-bold text-white">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cashSession.expectedBalance)}
                                        </p>
                                    </div>
                                    <div className="bg-white/5 p-3 rounded-xl">
                                        <p className="text-[10px] text-gray-500 uppercase font-bold mb-1">Vendas Hoje</p>
                                        <p className="text-lg font-bold text-green-400">
                                            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(cashSession.totalSales)}
                                        </p>
                                    </div>
                                </div>
                                <Link to="/pdv/cash" className="btn-ghost w-full py-2 text-sm">Controle de Fluxo</Link>
                            </div>
                        ) : (
                            <div className="text-center py-4">
                                <Clock className="w-10 h-10 text-gray-700 mx-auto mb-3" />
                                <p className="text-gray-400 text-sm mb-4">O caixa está fechado no momento.</p>
                                <Link to="/pdv/cash" className="btn-primary w-full text-sm">Abrir Caixa Agora</Link>
                            </div>
                        )}
                    </div>

                    {/* Quick Stats Grid */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="glass-card p-4 flex flex-col items-center justify-center text-center">
                            <Clock className="w-6 h-6 text-blue-400 mb-2" />
                            <p className="text-2xl font-bold text-white">
                                {orders?.filter(o => o.status === 'EM_PREPARO' || o.status === 'NOVO').length || 0}
                            </p>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Pendentes</p>
                        </div>
                        <div className="glass-card p-4 flex flex-col items-center justify-center text-center">
                            <Users className="w-6 h-6 text-purple-400 mb-2" />
                            <p className="text-2xl font-bold text-white">
                                {orders?.filter(o => o.orderType === 'SALAO' && o.status !== 'CONCLUIDO').length || 0}
                            </p>
                            <p className="text-[10px] text-gray-500 uppercase font-bold">Nas Mesas</p>
                        </div>
                    </div>

                    {/* Banner / Promotion? (Optional premium feel) */}
                    <div className="rounded-2xl bg-gradient-to-br from-primary-600/20 to-primary-900/40 border border-primary-500/20 p-6 relative overflow-hidden">
                        <ShoppingBag className="absolute -right-4 -bottom-4 w-24 h-24 text-primary-500/10 rotate-12" />
                        <h4 className="text-white font-bold mb-2 relative z-10">Moby PDV v2.0</h4>
                        <p className="text-sm text-primary-200/70 relative z-10">Interface otimizada para agilidade no atendimento.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}

