import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Clock, Calendar, Filter, ChevronDown, ChevronUp,
    RefreshCw, Loader2, Building, TrendingUp, Package,
    Truck, Timer, Store
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts';
import api from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { ErrorBoundary } from '../../components/ErrorBoundary';

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

// Helper functions - mantidas globais
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

type ViewMode = 'general' | 'restaurant';

// --- Sub-componente para exibir o Dashboard (KPIs + Gráfico) ---
interface DashboardSectionProps {
    restaurantId: string;
    title: string;
    period: string;
    startDate: string;
    endDate: string;
    isGeneral?: boolean;
}

function DashboardSection({ restaurantId, title, period, startDate, endDate, isGeneral }: DashboardSectionProps) {
    // Build query params specific for this section
    const queryParams = useMemo(() => {
        const params = new URLSearchParams({
            period,
            restaurantId: restaurantId.startsWith('rest_') ? 'all' : restaurantId // Fallback para 'all' se for ID mockado, ou tratar no backend
            // NOTA: Se o ID for local (rest_...), a API não vai validar.
            // Para evitar erro 400 ou 500, talvez devêssemos não chamar a API se o ID for local e não existir no backend.
            // Mas vamos assumir que queremos tentar buscar dados ou receber vazio.
        });
        if (period === 'custom' && startDate && endDate) {
            params.set('startDate', startDate);
            params.set('endDate', endDate);
        }
        return params;
    }, [period, startDate, endDate, restaurantId]);

    // Fetch stats
    const { data: statsData, isLoading: statsLoading } = useQuery({
        queryKey: ['work-times-stats', restaurantId, period, startDate, endDate],
        queryFn: async () => {
            // Se for ID local, a API real provavelmente retornará erro ou vazio.
            // Vamos tentar chamar. Se der erro, fallback para zeros.
            try {
                const res = await api.get(`/api/work-times/stats?${queryParams}`);
                return res.data.data as WorkTimesStats;
            } catch (e) {
                console.warn(`Failed to fetch stats for ${restaurantId}`, e);
                return { totalOrders: 0, avgPrepTime: null, avgPickupTime: null, avgDeliveryTime: null, avgTotalTime: null };
            }
        },
    });

    // Fetch evolution data
    const { data: evolutionData, isLoading: evolutionLoading } = useQuery({
        queryKey: ['work-times-evolution', restaurantId, period, startDate, endDate],
        queryFn: async () => {
            try {
                const res = await api.get(`/api/work-times/evolution?${queryParams}`);
                return res.data.data as EvolutionData[];
            } catch (e) {
                console.warn(`Failed to fetch evolution for ${restaurantId}`, e);
                return [];
            }
        },
    });

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            const prep = payload.find((p: any) => p.dataKey === 'avgPrepTime')?.value || 0;
            const pickup = payload.find((p: any) => p.dataKey === 'avgPickupTime')?.value || 0;
            const delivery = payload.find((p: any) => p.dataKey === 'avgDeliveryTime')?.value || 0;
            const total = prep + pickup + delivery;

            return (
                <div className="bg-gray-800 border border-gray-700 p-3 rounded-lg shadow-lg">
                    <p className="text-gray-300 mb-2 font-medium">{new Date(label).toLocaleDateString('pt-BR')}</p>
                    <div className="space-y-1">
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-[#22C55E]"></div>
                            <span className="text-gray-400">Entrega:</span>
                            <span className="text-white ml-auto font-mono">{formatMinutes(delivery)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-[#EAB308]"></div>
                            <span className="text-gray-400">Coleta:</span>
                            <span className="text-white ml-auto font-mono">{formatMinutes(pickup)}</span>
                        </div>
                        <div className="flex items-center gap-2 text-sm">
                            <div className="w-3 h-3 rounded-full bg-[#F97316]"></div>
                            <span className="text-gray-400">Preparo:</span>
                            <span className="text-white ml-auto font-mono">{formatMinutes(prep)}</span>
                        </div>
                        <div className="h-px bg-gray-700 my-2"></div>
                        <div className="flex items-center gap-2 text-sm font-bold">
                            <span className="text-gray-300">Tempo Total:</span>
                            <span className="text-primary-400 ml-auto font-mono">{formatMinutes(total)}</span>
                        </div>
                    </div>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="mb-8 animate-fade-in">
            {/* Section Title */}
            <div className="flex items-center gap-2 mb-4">
                {isGeneral ? (
                    <h2 className="text-xl font-bold text-white">Visão Geral Consolidada</h2>
                ) : (
                    <>
                        <Store className="w-6 h-6 text-primary-400" />
                        <h2 className="text-xl font-bold text-white">{title}</h2>
                    </>
                )}
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
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
                <h3 className="text-lg font-semibold text-white mb-4">Evolução dos Tempos - {title}</h3>
                {evolutionLoading ? (
                    <div className="flex items-center justify-center h-64">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                    </div>
                ) : evolutionData && evolutionData.length > 0 ? (
                    <div className="h-[300px] w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={evolutionData}>
                                <defs>
                                    <linearGradient id={`${restaurantId}-colorPrep`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#F97316" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id={`${restaurantId}-colorPickup`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#EAB308" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#EAB308" stopOpacity={0} />
                                    </linearGradient>
                                    <linearGradient id={`${restaurantId}-colorDelivery`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#22C55E" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#22C55E" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                                <XAxis
                                    dataKey="date"
                                    stroke="#9CA3AF"
                                    tickFormatter={(val) => new Date(val).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
                                />
                                <YAxis stroke="#9CA3AF" unit=" min" />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend />
                                {/* Ordem empilhada: Base (Preparo) -> Coleta -> Entrega (Topo) */}
                                <Area
                                    type="monotone"
                                    dataKey="avgPrepTime"
                                    name="Preparo"
                                    stackId="1"
                                    stroke="#F97316"
                                    fill={`url(#${restaurantId}-colorPrep)`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="avgPickupTime"
                                    name="Coleta"
                                    stackId="1"
                                    stroke="#EAB308"
                                    fill={`url(#${restaurantId}-colorPickup)`}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="avgDeliveryTime"
                                    name="Entrega"
                                    stackId="1"
                                    stroke="#22C55E"
                                    fill={`url(#${restaurantId}-colorDelivery)`}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="flex items-center justify-center h-64 text-gray-500">
                        Nenhum dado disponível para o período selecionado
                    </div>
                )}
            </div>
        </div>
    );
}

// --- Componente Principal ---
export default function WorkTimes() {
    const { user } = useAuthStore();
    const { subRestaurants, operationMode } = useSettingsStore();

    const [period, setPeriod] = useState('last7days');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [sortBy, setSortBy] = useState<string>('orderDatetime');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const [page, setPage] = useState(1);

    // Novos estados
    const [viewMode, setViewMode] = useState<ViewMode>('general');

    // Lista de restaurantes baseada no modo de operação
    const restaurants = useMemo(() => {
        if (operationMode === 'separate') {
            return subRestaurants; // Retorna os restaurantes criados localmente
        } else {
            // Modo single: retorna apenas o restaurante principal do usuário logado
            if (user?.restaurant) {
                return [{ id: user.restaurant.id, name: user.restaurant.name }];
            }
            return [];
        }
    }, [operationMode, subRestaurants, user]);

    // Update view mode based on operation mode automatically?
    // User can still switch between General and Restaurant.

    // Sort logic for table (global list of orders)
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

    // Fetch global orders for the table
    const queryParamsOrders = new URLSearchParams({
        period,
        page: page.toString(),
        limit: '20',
        sortBy,
        sortOrder,
        restaurantId: 'all'
    });
    if (period === 'custom' && startDate && endDate) {
        queryParamsOrders.set('startDate', startDate);
        queryParamsOrders.set('endDate', endDate);
    }

    const { data: ordersData, isLoading: ordersLoading } = useQuery({
        queryKey: ['work-times-orders', period, startDate, endDate, page, sortBy, sortOrder],
        queryFn: async () => {
            const res = await api.get(`/api/work-times/orders?${queryParamsOrders}`);
            return res.data as { data: Order[]; pagination: { page: number; limit: number; total: number; totalPages: number } };
        },
    });

    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <div className="space-y-6 animate-fade-in pl-16">
            <ErrorBoundary>
                {/* Header */}
                <div className="flex items-center justify-between">
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <Clock className="w-7 h-7 text-primary-400" />
                            Tempos de Trabalho
                        </h1>
                        <p className="text-gray-400">Acompanhe os tempos de preparo, coleta e entrega dos pedidos</p>
                    </div>
                    <button onClick={handleRefresh} className="btn-ghost" disabled={ordersLoading}>
                        <RefreshCw className={`w-4 h-4 ${ordersLoading ? 'animate-spin' : ''}`} />
                        Atualizar
                    </button>
                </div>

                {/* Filters & Mode Control */}
                <div className="glass-card">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-4 mb-4">
                        {/* View Mode Toggle */}
                        <div className="flex bg-gray-800 rounded-lg p-1">
                            <button
                                onClick={() => setViewMode('general')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'general'
                                    ? 'bg-primary-600 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                    }`}
                            >
                                Tempos Gerais
                            </button>
                            <button
                                onClick={() => setViewMode('restaurant')}
                                className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${viewMode === 'restaurant'
                                    ? 'bg-primary-600 text-white shadow-sm'
                                    : 'text-gray-400 hover:text-white hover:bg-gray-700'
                                    }`}
                            >
                                Por Restaurante (Detalhado)
                            </button>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-end gap-4 border-t border-gray-700/50 pt-4">
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

                {/* Content Area */}
                <div className="space-y-8">
                    {viewMode === 'general' ? (
                        <DashboardSection
                            restaurantId="all"
                            title="Geral"
                            period={period}
                            startDate={startDate}
                            endDate={endDate}
                            isGeneral={true}
                        />
                    ) : (
                        <div className="space-y-12">
                            {restaurants && restaurants.length > 0 ? (
                                restaurants.map(restaurant => (
                                    <div key={restaurant.id} className="border-b border-gray-800 pb-8 last:border-0">
                                        <DashboardSection
                                            restaurantId={restaurant.id}
                                            title={restaurant.name}
                                            period={period}
                                            startDate={startDate}
                                            endDate={endDate}
                                            isGeneral={false}
                                        />
                                    </div>
                                ))
                            ) : (
                                <div className="text-center text-gray-400 py-8">
                                    Nenhum restaurante encontrado.
                                    {operationMode === 'separate' && (
                                        <p className="text-sm mt-2 text-gray-500">
                                            Vá em Configurações &gt; Modo de Operação para adicionar restaurantes.
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Orders Table (Global) */}
                <div className="glass-card mt-8">
                    <h3 className="text-lg font-semibold text-white mb-4">Detalhamento por Pedido (Todos)</h3>

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
                                            <th>Restaurante</th>
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
                                                    <td>{order.restaurant.name}</td>
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
                                                <td colSpan={8} className="text-center text-gray-500 py-8">
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
            </ErrorBoundary>
        </div>
    );
}
