import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency, formatPercent } from '../../lib/utils';
import { TrendingUp, TrendingDown, Target, AlertTriangle } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

export default function CMV() {
    const { data: cmvData } = useQuery({
        queryKey: ['cmv'],
        queryFn: () => api.get('/api/cmv?period=daily').then((r) => r.data.data),
    });

    const { data: categoryData } = useQuery({
        queryKey: ['cmv-category'],
        queryFn: () => api.get('/api/cmv/by-category').then((r) => r.data.data),
    });

    const trend = cmvData?.trend || 'stable';
    const target = cmvData?.target || 30;
    const current = cmvData?.avgRealPercent || 0;
    const isAboveTarget = current > target;

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-white">Análise de CMV</h1>
                <p className="text-gray-400">Custo de Mercadoria Vendida</p>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className={`p-3 rounded-xl ${isAboveTarget ? 'bg-red-500/20' : 'bg-green-500/20'}`}>
                            {isAboveTarget ? <TrendingUp className="w-5 h-5 text-red-400" /> : <TrendingDown className="w-5 h-5 text-green-400" />}
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">CMV Atual</p>
                            <p className={`text-2xl font-bold ${isAboveTarget ? 'text-red-400' : 'text-green-400'}`}>
                                {formatPercent(current)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-primary-500/20">
                            <Target className="w-5 h-5 text-primary-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Meta</p>
                            <p className="text-2xl font-bold text-white">{formatPercent(target)}</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-yellow-500/20">
                            <AlertTriangle className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Desperdício</p>
                            <p className="text-2xl font-bold text-yellow-400">{formatPercent(cmvData?.avgWastePercent || 0)}</p>
                        </div>
                    </div>
                </div>

                <div className="stat-card">
                    <div className="flex items-center gap-3">
                        <div className="p-3 rounded-xl bg-blue-500/20">
                            <TrendingUp className="w-5 h-5 text-blue-400" />
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Faturamento</p>
                            <p className="text-2xl font-bold text-white">{formatCurrency(cmvData?.totalRevenue || 0)}</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* CMV Chart */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4">Evolução do CMV</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={cmvData?.snapshots || []}>
                            <defs>
                                <linearGradient id="cmvGradient" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" stroke="#666" fontSize={12} />
                            <YAxis stroke="#666" fontSize={12} domain={[0, 50]} tickFormatter={(v) => `${v}%`} />
                            <Tooltip
                                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                                formatter={(value: number) => [`${value.toFixed(1)}%`, 'CMV']}
                            />
                            <ReferenceLine y={target} stroke="#22c55e" strokeDasharray="3 3" label={{ value: 'Meta', fill: '#22c55e', fontSize: 12 }} />
                            <Area type="monotone" dataKey="realPercent" stroke="#8b5cf6" fill="url(#cmvGradient)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Category Breakdown */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4">CMV por Categoria</h3>
                <div className="space-y-4">
                    {(categoryData?.categories || []).slice(0, 6).map((cat: any) => (
                        <div key={cat.categoryId} className="flex items-center gap-4">
                            <div className="flex-1">
                                <div className="flex justify-between mb-1">
                                    <span className="text-sm text-white">{cat.categoryName}</span>
                                    <span className="text-sm text-gray-400">{formatCurrency(cat.cost)}</span>
                                </div>
                                <div className="progress-bar">
                                    <div
                                        className="progress-bar-fill bg-primary-500"
                                        style={{ width: `${cat.percent}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-sm font-medium text-gray-400 w-12 text-right">
                                {formatPercent(cat.percent)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
