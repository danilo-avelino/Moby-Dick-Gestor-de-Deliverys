
import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { TrendingUp, TrendingDown, Target, AlertTriangle, DollarSign, Calendar } from 'lucide-react';
import {
    ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from 'recharts';
import { format, startOfMonth, endOfMonth, subMonths, startOfDay, endOfDay } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type PeriodType = 'current-month' | 'last-month' | 'custom';

interface CMVData {
    period: string;
    startDate: string;
    endDate: string;
    totalRevenue: number;
    totalCost: number;
    cmvPercent: number;
    alerts: string[];
}

interface CategoryData {
    totalCost: number;
    categories: Array<{
        categoryId: string;
        categoryName: string;
        cost: number;
        percent: number;
    }>;
}

interface ChartData {
    date: string;
    revenue: number;
    cost: number;
    cmvPercent: number;
}

export default function CMV() {
    const [periodType, setPeriodType] = useState<PeriodType>('current-month');
    const [customRange, setCustomRange] = useState({ start: '', end: '' });

    // Calculate dates based on period type
    const getDateRange = () => {
        const today = new Date();
        if (periodType === 'current-month') {
            return {
                startDate: format(startOfMonth(today), 'yyyy-MM-dd'),
                endDate: format(endOfMonth(today), 'yyyy-MM-dd')
            };
        } else if (periodType === 'last-month') {
            const lastMonth = subMonths(today, 1);
            return {
                startDate: format(startOfMonth(lastMonth), 'yyyy-MM-dd'),
                endDate: format(endOfMonth(lastMonth), 'yyyy-MM-dd')
            };
        } else {
            return {
                startDate: customRange.start,
                endDate: customRange.end
            };
        }
    };

    const { startDate, endDate } = getDateRange();
    const isCustomValid = periodType !== 'custom' || (!!customRange.start && !!customRange.end);

    const { data: cmvData, isLoading } = useQuery<CMVData>({
        queryKey: ['cmv', startDate, endDate],
        queryFn: () => api.get('/api/cmv', { params: { startDate, endDate, period: 'custom' } }).then((r) => r.data.data),
        enabled: !!startDate && !!endDate && isCustomValid,
    });

    const { data: categoryData } = useQuery<CategoryData>({
        queryKey: ['cmv-category', startDate, endDate],
        queryFn: () => api.get('/api/cmv/by-category', { params: { startDate, endDate } }).then((r) => r.data.data),
        enabled: !!startDate && !!endDate && isCustomValid,
    });

    const { data: chartData, isLoading: chartLoading } = useQuery<ChartData[]>({
        queryKey: ['cmv-chart', startDate, endDate],
        queryFn: () => api.get('/api/cmv/chart', { params: { startDate, endDate } }).then((r) => r.data.data),
        enabled: !!startDate && !!endDate && isCustomValid,
    });

    const target = 30; // Could be fetched from restaurant settings if available in response
    const current = cmvData?.cmvPercent || 0;
    const isAboveTarget = current > target;
    const isWarning = current > target * 0.8 && !isAboveTarget;

    const alerts = cmvData?.alerts || [];

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Análise de CMV</h1>
                    <p className="text-gray-400">Custo de Mercadoria Vendida (Apuração Interna)</p>
                </div>

                {/* Filters */}
                <div className="flex flex-wrap items-center gap-2 bg-gray-900/50 p-2 rounded-xl border border-white/5">
                    <button
                        onClick={() => setPeriodType('current-month')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${periodType === 'current-month' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Mês Atual
                    </button>
                    <button
                        onClick={() => setPeriodType('last-month')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${periodType === 'last-month' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Mês Anterior
                    </button>
                    <button
                        onClick={() => setPeriodType('custom')}
                        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${periodType === 'custom' ? 'bg-primary-500 text-white' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                    >
                        Personalizado
                    </button>

                    {periodType === 'custom' && (
                        <div className="flex items-center gap-2 ml-2 pl-2 border-l border-white/10">
                            <input
                                type="date"
                                className="bg-gray-800 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                value={customRange.start}
                                onChange={(e) => setCustomRange(p => ({ ...p, start: e.target.value }))}
                            />
                            <span className="text-gray-500">-</span>
                            <input
                                type="date"
                                className="bg-gray-800 border border-white/10 rounded-lg px-2 py-1 text-sm text-white focus:outline-none focus:ring-1 focus:ring-primary-500"
                                value={customRange.end}
                                onChange={(e) => setCustomRange(p => ({ ...p, end: e.target.value }))}
                            />
                        </div>
                    )}
                </div>
            </div>

            {/* Alerts Section */}
            {alerts.length > 0 && (
                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 mt-0.5" />
                        <div>
                            <h3 className="text-sm font-bold text-yellow-500 mb-1">Atenção</h3>
                            <ul className="list-disc list-inside text-sm text-yellow-200/80 space-y-1">
                                {alerts.map((alert: string, i: number) => (
                                    <li key={i}>{alert}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="stat-card p-6 rounded-xl bg-gray-900 border border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-green-500/20">
                                <DollarSign className="w-5 h-5 text-green-400" />
                            </div>
                            <p className="text-sm text-gray-400 font-medium">Faturamento Total</p>
                        </div>
                        <p className="text-3xl font-bold text-white">{formatCurrency(cmvData?.totalRevenue || 0)}</p>
                        <p className="text-xs text-gray-500 mt-1">Registrado via Faturamento</p>
                    </div>
                </div>

                <div className="stat-card p-6 rounded-xl bg-gray-900 border border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-red-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="p-2 rounded-lg bg-red-500/20">
                                <TrendingDown className="w-5 h-5 text-red-400" />
                            </div>
                            <p className="text-sm text-gray-400 font-medium">Custo Total</p>
                        </div>
                        <p className="text-3xl font-bold text-white">{formatCurrency(cmvData?.totalCost || 0)}</p>
                        <p className="text-xs text-gray-500 mt-1">Saídas de Estoque</p>
                    </div>
                </div>

                <div className="stat-card p-6 rounded-xl bg-gray-900 border border-white/5 relative overflow-hidden group">
                    <div className="absolute inset-0 bg-gradient-to-br from-amber-500/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                    <div className="relative z-10">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-amber-500/20">
                                    <TrendingUp className="w-5 h-5 text-[#fbbf24]" />
                                </div>
                                <p className="text-sm text-gray-400 font-medium">CMV pelo Estoque</p>
                            </div>
                            {isAboveTarget && <span className="text-xs font-bold text-red-400 bg-red-500/10 px-2 py-1 rounded">Acima da Meta</span>}
                        </div>
                        <p className="text-3xl font-bold text-[#fbbf24]">
                            {formatPercent(current)}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">Meta: {formatPercent(target)}</p>
                    </div>
                </div>
            </div>

            {/* Daily Evolution Chart */}
            <div className="glass-card p-6 rounded-xl bg-gray-900/50 border border-white/5">
                <h3 className="text-lg font-semibold text-white mb-6">Evolução Diária (Receita vs Custo)</h3>
                <div className="h-[300px] w-full">
                    {chartLoading ? (
                        <div className="flex items-center justify-center h-full text-gray-500">Carregando gráfico...</div>
                    ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={chartData || []}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                <XAxis
                                    dataKey="date"
                                    tickFormatter={(val) => {
                                        try {
                                            return format(new Date(val), 'dd/MM');
                                        } catch {
                                            return val;
                                        }
                                    }}
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                />
                                <YAxis
                                    yAxisId="left"
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    tickFormatter={(val) => `R$ ${val / 1000}k`}
                                />
                                <YAxis
                                    yAxisId="right"
                                    orientation="right"
                                    stroke="#9CA3AF"
                                    fontSize={12}
                                    unit="%"
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111827', borderColor: '#374151', color: '#fff' }}
                                    formatter={(value: number, name: string) => {
                                        if (name === 'CMV pelo estoque') return [formatPercent(value || 0), name];
                                        return [formatCurrency(value || 0), name];
                                    }}
                                    labelFormatter={(label) => {
                                        try {
                                            const d = new Date(label);
                                            return format(d, "dd 'de' MMMM", { locale: ptBR });
                                        } catch {
                                            return label;
                                        }
                                    }}
                                />
                                <Legend />
                                <Bar yAxisId="left" dataKey="revenue" name="Faturamento" fill="#22c55e" radius={[4, 4, 0, 0]} opacity={0.8} />
                                <Bar yAxisId="left" dataKey="cost" name="Saídas de estoque" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.8} />
                                <Line yAxisId="right" type="monotone" dataKey="cmvPercent" name="CMV pelo estoque" stroke="#fbbf24" strokeWidth={2} dot={false} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    )}
                </div>
            </div>

            {/* Category Breakdown */}
            <div className="glass-card p-6 rounded-xl bg-gray-900/50 border border-white/5">
                <h3 className="text-lg font-semibold text-white mb-6">Custos por Categoria</h3>
                <div className="space-y-4">
                    {(categoryData?.categories || []).map((cat: any) => (
                        <div key={cat.categoryId} className="flex items-center gap-4 group">
                            <div className="flex-1">
                                <div className="flex justify-between mb-2">
                                    <span className="text-sm font-medium text-white group-hover:text-primary-400 transition-colors">{cat.categoryName}</span>
                                    <span className="text-sm text-gray-400">{formatCurrency(cat.cost)}</span>
                                </div>
                                <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                    <div
                                        className="h-full bg-primary-500 rounded-full transition-all duration-500"
                                        style={{ width: `${cat.percent}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-sm font-bold text-gray-500 w-16 text-right">
                                {formatPercent(cat.percent)}
                            </span>
                        </div>
                    ))}
                    {(!categoryData?.categories || categoryData.categories.length === 0) && (
                        <div className="text-center py-8 text-gray-500">
                            Nenhum custo registrado no período.
                        </div>
                    )}
                </div>
            </div>
        </div >
    );
}
