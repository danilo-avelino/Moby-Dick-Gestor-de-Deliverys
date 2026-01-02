
import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Clock,
    Calendar,
    ChefHat,
    Bike,
    CheckCircle2,
    Timer,
    ChevronLeft,
    ChevronRight,
    Search,
    Filter,
    BarChart3,
    Table as TableIcon
} from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { api } from '../../lib/api';
import { ModernKPICard } from '../dashboard/components/ModernKPICard';
import {
    AreaChart,
    Area,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    BarChart,
    Bar,
    Legend
} from 'recharts';

type Period = 'yesterday' | 'last7days' | 'thisMonth' | 'lastMonth' | 'custom';

export default function WorkTimes() {
    const [period, setPeriod] = useState<Period>('thisMonth');
    const [page, setPage] = useState(1);
    const [view, setView] = useState<'chart' | 'logs'>('chart');

    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['work-times', 'stats', period],
        queryFn: async () => {
            const res = await api.get(`/api/work-times/stats?period=${period}`);
            return res.data.data;
        }
    });

    const { data: evolutionData, isLoading: evolutionLoading } = useQuery({
        queryKey: ['work-times', 'evolution', period],
        queryFn: async () => {
            const res = await api.get(`/api/work-times/evolution?period=${period}`);
            return res.data.data;
        }
    });

    const { data: ordersData, isLoading: ordersLoading } = useQuery({
        queryKey: ['work-times', 'orders', period, page],
        queryFn: async () => {
            const res = await api.get(`/api/work-times/orders?period=${period}&page=${page}&limit=10`);
            return res.data;
        }
    });

    const formatTime = (minutes: number | null) => {
        if (minutes === null || minutes === undefined) return '--';
        const totalSeconds = Math.round(minutes * 60);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;

        if (mins === 0) return `${secs}s`;
        if (secs === 0) return `${mins}m`;
        return `${mins}m ${secs}s`;
    };

    const stats = statsData || {};

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Clock className="w-8 h-8 text-blue-400" />
                        Tempos de Trabalho
                    </h1>
                    <p className="text-white/60">Análise de eficiência operacional e tempos de entrega.</p>
                </div>

                <div className="flex items-center gap-2 bg-white/5 p-1 rounded-lg border border-white/10">
                    {([
                        { id: 'yesterday', label: 'Ontem' },
                        { id: 'last7days', label: '7 Dias' },
                        { id: 'thisMonth', label: 'Este Mês' },
                        { id: 'lastMonth', label: 'Dezembro (Mês Passado)' },
                    ] as const).map((p) => (
                        <button
                            key={p.id}
                            onClick={() => { setPeriod(p.id); setPage(1); }}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-all ${period === p.id
                                ? 'bg-blue-500 text-white shadow-lg'
                                : 'text-white/60 hover:text-white hover:bg-white/5'
                                }`}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <ModernKPICard
                    title="Tempo de Preparo"
                    value={formatTime(stats.avgPrepTime)}
                    icon={ChefHat}
                    subtitle="Desde a chegada até ficar pronto"
                    variant="cmv"
                />
                <ModernKPICard
                    title="Tempo de Coleta"
                    value={formatTime(stats.avgPickupTime)}
                    icon={Timer}
                    subtitle="Desde pronto até sair para entrega"
                    variant="neutral"
                />
                <ModernKPICard
                    title="Tempo em Rota"
                    value={formatTime(stats.avgDeliveryTime)}
                    icon={Bike}
                    subtitle="Tempo médio de deslocamento"
                    variant="revenue"
                />
                <ModernKPICard
                    title="Tempo Total"
                    value={formatTime(stats.avgTotalTime)}
                    icon={CheckCircle2}
                    subtitle="Ciclo completo do pedido"
                    variant="profit"
                />
            </div>

            {/* Main Content Areas */}
            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Evolution Chart */}
                <Card className="xl:col-span-2 p-6 overflow-hidden">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                            <BarChart3 className="w-5 h-5 text-blue-400" />
                            Evolução dos Tempos
                        </h3>
                        <div className="flex items-center gap-2 bg-white/5 rounded-md p-1">
                            <button
                                onClick={() => setView('chart')}
                                className={`p-1.5 rounded ${view === 'chart' ? 'bg-white/10 text-white' : 'text-white/40'}`}
                            >
                                <BarChart3 className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => setView('logs')}
                                className={`p-1.5 rounded ${view === 'logs' ? 'bg-white/10 text-white' : 'text-white/40'}`}
                            >
                                <TableIcon className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    <div className="h-[350px] w-full">
                        {evolutionLoading ? (
                            <div className="w-full h-full flex items-center justify-center">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
                            </div>
                        ) : evolutionData && evolutionData.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={evolutionData}>
                                    <defs>
                                        <linearGradient id="colorPrep" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorPickup" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorDelivery" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        stroke="rgba(255,255,255,0.4)"
                                        fontSize={12}
                                        tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                    />
                                    <YAxis stroke="rgba(255,255,255,0.4)" fontSize={12} unit="m" />
                                    <Tooltip
                                        content={({ active, payload, label }) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-slate-900 border border-white/10 p-3 rounded-lg shadow-xl">
                                                        <p className="font-semibold text-white mb-2 pb-2 border-b border-white/10">
                                                            {new Date(label).toLocaleDateString('pt-BR')}
                                                        </p>
                                                        <div className="space-y-1.5 min-w-[150px]">
                                                            <div className="flex justify-between items-center text-blue-400">
                                                                <span className="text-xs">Preparo:</span>
                                                                <span className="text-sm font-medium">{formatTime(data.avgPrepTime)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-amber-400">
                                                                <span className="text-xs">Coleta:</span>
                                                                <span className="text-sm font-medium">{formatTime(data.avgPickupTime)}</span>
                                                            </div>
                                                            <div className="flex justify-between items-center text-purple-400">
                                                                <span className="text-xs">Entrega:</span>
                                                                <span className="text-sm font-medium">{formatTime(data.avgDeliveryTime)}</span>
                                                            </div>
                                                            <div className="border-t border-white/10 pt-1.5 mt-1">
                                                                <div className="flex justify-between items-center text-emerald-400">
                                                                    <span className="text-xs font-bold">Tempo Total:</span>
                                                                    <span className="text-sm font-bold">{formatTime(data.avgTotalTime)}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                        cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }}
                                    />
                                    <Legend />
                                    <Area
                                        type="monotone"
                                        dataKey="avgPrepTime"
                                        name="Preparo"
                                        stroke="#3b82f6"
                                        fillOpacity={1}
                                        fill="url(#colorPrep)"
                                        stackId="1"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="avgPickupTime"
                                        name="Coleta"
                                        stroke="#f59e0b"
                                        fillOpacity={1}
                                        fill="url(#colorPickup)"
                                        stackId="1"
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="avgDeliveryTime"
                                        name="Entrega"
                                        stroke="#8b5cf6"
                                        fillOpacity={1}
                                        fill="url(#colorDelivery)"
                                        stackId="1"
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center text-white/40">
                                <Clock className="w-12 h-12 mb-2 opacity-20" />
                                <p>Sem dados para o período selecionado.</p>
                            </div>
                        )}
                    </div>
                </Card>

                {/* Logistics Mix / Distribution (Dummy for now or small summary) */}
                <Card className="p-6">
                    <h3 className="text-lg font-semibold text-white mb-6 flex items-center gap-2">
                        <Filter className="w-5 h-5 text-purple-400" />
                        Distribuição por Provedor
                    </h3>

                    <div className="space-y-4">
                        {/* Summary of logistics providers found in data */}
                        {stats.totalOrders > 0 ? (
                            <>
                                <div className="flex items-center justify-between p-3 rounded-lg bg-white/5 border border-white/10">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold">FD</div>
                                        <div>
                                            <p className="text-sm font-medium text-white">Foody Delivery</p>
                                            <p className="text-xs text-white/40">{stats.totalOrders} pedidos</p>
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-white">{formatTime(stats.avgTotalTime)}</p>
                                        <div className="w-20 h-1.5 bg-white/10 rounded-full mt-1 overflow-hidden">
                                            <div className="h-full bg-blue-500 w-full"></div>
                                        </div>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <p className="text-center text-white/40 py-10">Dados limitados no momento.</p>
                        )}

                        <div className="mt-8 p-4 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-white/10">
                            <p className="text-sm text-white/80 leading-relaxed italic">
                                "O tempo médio de preparo representa
                                <span className="text-blue-400 font-bold"> {stats.avgPrepTime ? Math.round((stats.avgPrepTime / stats.avgTotalTime) * 100) : 0}%</span>
                                do tempo total do pedido."
                            </p>
                        </div>
                    </div>
                </Card>
            </div>

            {/* Logs Table */}
            <Card className="overflow-hidden">
                <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                        <Search className="w-5 h-5 text-blue-400" />
                        Log Detalhado de Pedidos
                    </h3>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-white/5 text-white/40 text-xs font-medium uppercase tracking-wider">
                                <th className="px-6 py-4">Pedido</th>
                                <th className="px-6 py-4">Data/Hora</th>
                                <th className="px-6 py-4">Cliente</th>
                                <th className="px-6 py-4">Preparo</th>
                                <th className="px-6 py-4">Coleta</th>
                                <th className="px-6 py-4">Entrega</th>
                                <th className="px-6 py-4">Total</th>
                                <th className="px-6 py-4">Valor</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {ordersLoading ? (
                                Array.from({ length: 5 }).map((_, i) => (
                                    <tr key={i} className="animate-pulse">
                                        <td colSpan={7} className="px-6 py-8">
                                            <div className="h-4 bg-white/5 rounded w-full"></div>
                                        </td>
                                    </tr>
                                ))
                            ) : ordersData?.data?.length > 0 ? (
                                ordersData.data.map((order: any) => (
                                    <tr key={order.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded bg-white/5 flex items-center justify-center group-hover:bg-blue-500/20 transition-colors">
                                                    <span className="text-xs font-bold text-white/40 group-hover:text-blue-400">#{order.externalId}</span>
                                                </div>
                                                <span className="text-sm text-white font-medium">{order.logisticsProvider}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-sm text-white/60">
                                            {new Date(order.orderDatetime).toLocaleString('pt-BR', {
                                                day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
                                            })}
                                        </td>
                                        <td className="px-6 py-4 text-sm text-white/60">{order.customerName || '---'}</td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className={order.prepTime > 20 ? 'text-orange-400' : 'text-blue-400'}>
                                                {formatTime(order.prepTime)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="text-amber-400">
                                                {formatTime(order.pickupTime)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-sm">
                                            <span className="text-purple-400">
                                                {formatTime(order.deliveryTime)}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-bold text-sm text-white">{formatTime(order.totalTime)}</td>
                                        <td className="px-6 py-4 text-sm text-white/80">
                                            {order.orderValue?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                                        </td>
                                    </tr>
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-white/40 italic">
                                        Nenhum pedido encontrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {ordersData?.pagination && (
                    <div className="p-4 border-t border-white/5 flex items-center justify-between bg-black/20">
                        <span className="text-xs text-white/40 uppercase font-bold tracking-widest">
                            Página {page} de {ordersData.pagination.totalPages}
                        </span>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={page === 1}
                                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronLeft className="w-5 h-5 text-white" />
                            </button>
                            <button
                                onClick={() => setPage(p => Math.min(ordersData.pagination.totalPages, p + 1))}
                                disabled={page === ordersData.pagination.totalPages}
                                className="p-2 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
                            >
                                <ChevronRight className="w-5 h-5 text-white" />
                            </button>
                        </div>
                    </div>
                )}
            </Card>
        </div>
    );
}
