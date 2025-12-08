import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Clock, Calendar, Filter, ChevronDown, ChevronUp,
    RefreshCw, Loader2, Building, TrendingUp, Package,
    Truck, Timer
} from 'lucide-react';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';
import api from '../../lib/api';

// Types
interface WorkTimesStats {
    totalOrders: number;
    avgPrepTime: number | null;
    avgPickupTime: number | null;
    avgDeliveryTime: number | null;
    avgTotalTime: number | null;
}

interface Order {
    id: string;
    externalId: string;
    logisticsProvider: string;
    orderDatetime: string;
    readyDatetime: string | null;
    outForDeliveryDatetime: string | null;
    deliveredDatetime: string | null;
    prepTime: number | null;
    pickupTime: number | null;
    deliveryTime: number | null;
    totalTime: number | null;
    customerName: string | null;
    orderValue: number | null;
    restaurant: {
        id: string;
        name: string;
    };
}

interface EvolutionData {
    date: string;
    avgPrepTime: number | null;
    avgPickupTime: number | null;
    avgDeliveryTime: number | null;
    avgTotalTime: number | null;
    orderCount: number;
}

// Helper functions
function formatMinutes(minutes: number | null): string {
    if (minutes === null || minutes === undefined) return '-';

    if (minutes < 60) {
        const mins = Math.floor(minutes);
        const secs = Math.round((minutes - mins) * 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    } else {
        const hours = Math.floor(minutes / 60);
        const mins = Math.round(minutes % 60);
        return `${hours}h ${mins}m`;
    }
}

function formatDate(dateString: string): string {
    return new Date(dateString).toLocaleDateString('pt-BR');
}

function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('pt-BR');
}

// Period options
const periodOptions = [
    { value: 'yesterday', label: 'Ontem' },
    { value: 'last7days', label: 'Últimos 7 dias' },
    { value: 'thisMonth', label: 'Mês atual' },
    { value: 'lastMonth', label: 'Mês anterior' },
    { value: 'custom', label: 'Período personalizado' },
];

export default function WorkTimes() {
    const [period, setPeriod] = useState('last7days');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sortBy, setSortBy] = useState<string>('orderDatetime');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);

    // Build query params
    const queryParams = new URLSearchParams({
        period,
        page: page.toString(),
        limit: '20',
        sortBy,
        sortOrder,
    });

    if (period === 'custom' && startDate && endDate) {
        queryParams.set('startDate', startDate);
        queryParams.set('endDate', endDate);
    }

    // Fetch stats
    const { data: statsData, isLoading: statsLoading, refetch: refetchStats } = useQuery({
        queryKey: ['work-times-stats', period, startDate, endDate],
        queryFn: async () => {
            const res = await api.get(`/api/work-times/stats?${queryParams}`);
            return res.data.data as WorkTimesStats;
        },
    });

    // Fetch orders
    const { data: ordersData, isLoading: ordersLoading } = useQuery({
        queryKey: ['work-times-orders', period, startDate, endDate, page, sortBy, sortOrder],
        queryFn: async () => {
            const res = await api.get(`/api/work-times/orders?${queryParams}`);
            return res.data as { data: Order[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
        },
    });

    // Fetch evolution data
    const { data: evolutionData, isLoading: evolutionLoading } = useQuery({
        queryKey: ['work-times-evolution', period, startDate, endDate],
        queryFn: async () => {
            const res = await api.get(`/api/work-times/evolution?${queryParams}`);
            return res.data.data as EvolutionData[];
        },
    });

    const handleRefresh = () => {
        refetchStats();
    };

    const handleSort = (column: string) => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc');
        }
    };

    const SortIcon = ({ column }: { column: string }) => {
        if (sortBy !== column) return null;
        return sortOrder === 'asc' ?
            <ChevronUp className="w-4 h-4 inline" /> :
            <ChevronDown className="w-4 h-4 inline" />;
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Clock className="w-7 h-7 text-primary-400" />
                        Tempos de Trabalho
                    </h1>
                    <p className="text-gray-400">Acompanhe os tempos de preparo, coleta e entrega dos pedidos</p>
                </div>
                <button onClick={handleRefresh} className="btn-ghost" disabled={statsLoading}>
                    <RefreshCw className={`w-4 h-4 ${statsLoading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            {/* Filters */}
            <div className="glass-card">
                <div className="flex flex-wrap items-end gap-4">
                    {/* Period selector */}
                    <div className="flex-1 min-w-[200px]">
                        <label className="label">Período</label>
                        <select
                            value={period}
                            onChange={(e) => setPeriod(e.target.value)}
                            className="input"
                        >
                            {periodOptions.map(opt => (
                                <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Custom date range */}
                    {period === 'custom' && (
                        <>
                            <div className="min-w-[150px]">
                                <label className="label">Data Inicial</label>
                                <input
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                            <div className="min-w-[150px]">
                                <label className="label">Data Final</label>
                                <input
                                    type="date"
                                    value={endDate}
                                    onChange={(e) => setEndDate(e.target.value)}
                                    className="input"
                                />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                {/* Total Orders */}
                <div className="stat-card">
                    <div className="flex items-center justify-between mb-4">
                        <Package className="w-8 h-8 text-blue-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : statsData?.totalOrders ?? 0}
                    </p>
                    <p className="text-sm text-gray-400">Total de Pedidos</p>
                </div>

                {/* Prep Time */}
                <div className="stat-card">
                    <div className="flex items-center justify-between mb-4">
                        <Timer className="w-8 h-8 text-orange-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : formatMinutes(statsData?.avgPrepTime ?? null)}
                    </p>
                    <p className="text-sm text-gray-400">Tempo Médio de Preparo</p>
                </div>

                {/* Pickup Time */}
                <div className="stat-card">
                    <div className="flex items-center justify-between mb-4">
                        <Building className="w-8 h-8 text-yellow-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : formatMinutes(statsData?.avgPickupTime ?? null)}
                    </p>
                    <p className="text-sm text-gray-400">Tempo Médio de Coleta</p>
                </div>

                {/* Delivery Time */}
                <div className="stat-card">
                    <div className="flex items-center justify-between mb-4">
                        <Truck className="w-8 h-8 text-green-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : formatMinutes(statsData?.avgDeliveryTime ?? null)}
                    </p>
                    <p className="text-sm text-gray-400">Tempo Médio de Entrega</p>
                </div>

                {/* Total Time */}
                <div className="stat-card">
                    <div className="flex items-center justify-between mb-4">
                        <TrendingUp className="w-8 h-8 text-primary-400" />
                    </div>
                    <p className="text-3xl font-bold text-white">
                        {statsLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : formatMinutes(statsData?.avgTotalTime ?? null)}
                    </p>
                    <p className="text-sm text-gray-400">Tempo Médio Total</p>
                </div>
            </div>

            {/* Evolution Chart */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4">Evolução dos Tempos</h3>
                {evolutionLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                    </div>
                ) : evolutionData && evolutionData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={evolutionData}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                            <XAxis
                                dataKey="date"
                                stroke="#9CA3AF"
                                tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                            />
                            <YAxis stroke="#9CA3AF" unit=" min" />
                            <Tooltip
                                contentStyle={{ backgroundColor: '#1F2937', border: '1px solid #374151', borderRadius: '8px' }}
                                labelFormatter={(val) => `Data: ${new Date(val).toLocaleDateString('pt-BR')}`}
                                formatter={(value: number) => [formatMinutes(value), '']}
                            />
                            <Legend />
                            <Line type="monotone" dataKey="avgPrepTime" name="Preparo" stroke="#F97316" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="avgPickupTime" name="Coleta" stroke="#EAB308" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="avgDeliveryTime" name="Entrega" stroke="#22C55E" strokeWidth={2} dot={false} />
                            <Line type="monotone" dataKey="avgTotalTime" name="Total" stroke="#2A8C8C" strokeWidth={2} dot={false} />
                        </LineChart>
                    </ResponsiveContainer>
                ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                        Nenhum dado disponível para o período selecionado
                    </div>
                )}
            </div>

            {/* Orders Table */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4">Detalhamento por Pedido</h3>

                {ordersLoading ? (
                    <div className="flex items-center justify-center h-32">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                    </div>
                ) : (
                    <>
                        <div className="table-container">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th
                                            className="cursor-pointer hover:text-white"
                                            onClick={() => handleSort('orderDatetime')}
                                        >
                                            Data <SortIcon column="orderDatetime" />
                                        </th>
                                        <th>ID Pedido</th>
                                        <th>Integrador</th>
                                        <th
                                            className="cursor-pointer hover:text-white"
                                            onClick={() => handleSort('prepTime')}
                                        >
                                            Preparo <SortIcon column="prepTime" />
                                        </th>
                                        <th
                                            className="cursor-pointer hover:text-white"
                                            onClick={() => handleSort('pickupTime')}
                                        >
                                            Coleta <SortIcon column="pickupTime" />
                                        </th>
                                        <th
                                            className="cursor-pointer hover:text-white"
                                            onClick={() => handleSort('deliveryTime')}
                                        >
                                            Entrega <SortIcon column="deliveryTime" />
                                        </th>
                                        <th
                                            className="cursor-pointer hover:text-white"
                                            onClick={() => handleSort('totalTime')}
                                        >
                                            Total <SortIcon column="totalTime" />
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {ordersData?.data && ordersData.data.length > 0 ? (
                                        ordersData.data.map((order) => (
                                            <tr key={order.id}>
                                                <td>{formatDateTime(order.orderDatetime)}</td>
                                                <td className="font-mono text-xs">{order.externalId}</td>
                                                <td>
                                                    <span className="badge badge-info">{order.logisticsProvider}</span>
                                                </td>
                                                <td>{formatMinutes(order.prepTime)}</td>
                                                <td>{formatMinutes(order.pickupTime)}</td>
                                                <td>{formatMinutes(order.deliveryTime)}</td>
                                                <td className="font-semibold text-primary-400">
                                                    {formatMinutes(order.totalTime)}
                                                </td>
                                            </tr>
                                        ))
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="text-center text-gray-500 py-8">
                                                Nenhum pedido encontrado para o período selecionado
                                            </td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {ordersData?.pagination && ordersData.pagination.totalPages > 1 && (
                            <div className="flex items-center justify-between mt-4 pt-4 border-t border-white/10">
                                <p className="text-sm text-gray-400">
                                    Mostrando {((page - 1) * 20) + 1} a {Math.min(page * 20, ordersData.pagination.total)} de {ordersData.pagination.total} pedidos
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setPage(p => Math.max(1, p - 1))}
                                        disabled={page === 1}
                                        className="btn-ghost"
                                    >
                                        Anterior
                                    </button>
                                    <span className="px-4 py-2 text-white">
                                        {page} / {ordersData.pagination.totalPages}
                                    </span>
                                    <button
                                        onClick={() => setPage(p => Math.min(ordersData.pagination.totalPages, p + 1))}
                                        disabled={page === ordersData.pagination.totalPages}
                                        className="btn-ghost"
                                    >
                                        Próximo
                                    </button>
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );
}
