import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency, formatPercent, formatNumber } from '../../lib/utils';
import {
    TrendingUp, TrendingDown, DollarSign, ShoppingBag, Receipt, Percent,
    AlertTriangle, Package, ArrowUpRight, ArrowDownRight, Clock, Timer
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';

export default function Dashboard() {
    const { data: kpis } = useQuery({
        queryKey: ['dashboard-kpis'],
        queryFn: () => api.get('/api/dashboard/kpis').then((r) => r.data.data),
    });

    const { data: chartData } = useQuery({
        queryKey: ['dashboard-chart'],
        queryFn: () => api.get('/api/dashboard/revenue-chart?period=week').then((r) => r.data.data),
    });

    const { data: topSelling } = useQuery({
        queryKey: ['dashboard-top'],
        queryFn: () => api.get('/api/dashboard/top-selling?limit=5').then((r) => r.data.data),
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                <p className="text-gray-400">Visão geral do seu restaurante</p>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                <KPICard
                    title="Faturamento Hoje"
                    value={formatCurrency(kpis?.revenue?.today || 0)}
                    change={kpis?.revenue?.trend || 0}
                    subtitle={`Semana: ${formatCurrency(kpis?.revenue?.thisWeek || 0)}`}
                    icon={DollarSign}
                    color="primary"
                />
                <KPICard
                    title="Pedidos Hoje"
                    value={formatNumber(kpis?.orders?.today || 0)}
                    change={kpis?.orders?.trend || 0}
                    subtitle={`Semana: ${formatNumber(kpis?.orders?.thisWeek || 0)}`}
                    icon={ShoppingBag}
                    color="secondary"
                />
                <KPICard
                    title="Ticket Médio"
                    value={formatCurrency(kpis?.avgTicket?.today || 0)}
                    change={kpis?.avgTicket?.trend || 0}
                    subtitle={`Mês: ${formatCurrency(kpis?.avgTicket?.thisMonth || 0)}`}
                    icon={Receipt}
                    color="blue"
                />
                <KPICard
                    title="CMV Hoje"
                    value={formatPercent(kpis?.cmv?.today || 0)}
                    change={-kpis?.cmv?.trend || 0}
                    subtitle={`Meta: ${formatPercent(kpis?.cmv?.target || 30)}`}
                    icon={Percent}
                    color={kpis?.cmv?.today > kpis?.cmv?.target ? 'red' : 'green'}
                    invertTrend
                />
                <KPICard
                    title="Tempo Médio Produção"
                    value={`${kpis?.avgProductionTime?.today || 12} min`}
                    change={kpis?.avgProductionTime?.trend || -5}
                    subtitle={`Meta: ${kpis?.avgProductionTime?.target || 10} min`}
                    icon={Timer}
                    color="blue"
                    invertTrend
                />
                <KPICard
                    title="Tempo Médio Coleta"
                    value={`${kpis?.avgCollectionTime?.today || 8} min`}
                    change={kpis?.avgCollectionTime?.trend || -3}
                    subtitle={`Meta: ${kpis?.avgCollectionTime?.target || 5} min`}
                    icon={Clock}
                    color="green"
                    invertTrend
                />
            </div>

            {/* Alerts Row */}
            {(kpis?.alerts?.unread > 0 || kpis?.stockAlerts?.lowStock > 0) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {kpis?.alerts?.unread > 0 && (
                        <div className="glass-card flex items-center gap-4 border-l-4 border-yellow-500">
                            <div className="p-3 rounded-xl bg-yellow-500/20">
                                <AlertTriangle className="w-6 h-6 text-yellow-400" />
                            </div>
                            <div>
                                <p className="font-medium text-white">{kpis.alerts.unread} alertas não lidos</p>
                                <p className="text-sm text-gray-400">
                                    {kpis.alerts.critical > 0 && `${kpis.alerts.critical} crítico(s)`}
                                </p>
                            </div>
                        </div>
                    )}
                    {kpis?.stockAlerts?.lowStock > 0 && (
                        <div className="glass-card flex items-center gap-4 border-l-4 border-red-500">
                            <div className="p-3 rounded-xl bg-red-500/20">
                                <Package className="w-6 h-6 text-red-400" />
                            </div>
                            <div>
                                <p className="font-medium text-white">{kpis.stockAlerts.lowStock} produtos com estoque baixo</p>
                                <p className="text-sm text-gray-400">
                                    {kpis.stockAlerts.expiring > 0 && `${kpis.stockAlerts.expiring} próximos do vencimento`}
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Revenue Chart */}
                <div className="lg:col-span-2 glass-card">
                    <h3 className="text-lg font-semibold text-white mb-4">Faturamento (7 dias)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={chartData || []}>
                                <defs>
                                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                                <XAxis dataKey="date" stroke="#666" fontSize={12} />
                                <YAxis stroke="#666" fontSize={12} tickFormatter={(v) => `R$${v / 1000}k`} />
                                <Tooltip
                                    contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                                    labelStyle={{ color: '#fff' }}
                                    formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="#8b5cf6" fill="url(#colorRevenue)" strokeWidth={2} />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Top Selling */}
                <div className="glass-card">
                    <h3 className="text-lg font-semibold text-white mb-4">Mais Vendidos</h3>
                    <div className="space-y-3">
                        {(topSelling || []).slice(0, 5).map((item: any, i: number) => (
                            <div key={item.recipe?.id || i} className="flex items-center gap-3 p-3 rounded-xl bg-white/5">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center font-bold text-primary-400">
                                    {i + 1}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="font-medium text-white truncate">{item.recipe?.name}</p>
                                    <p className="text-sm text-gray-400">{item.quantity} vendas</p>
                                </div>
                                <div className="text-right">
                                    <p className="font-medium text-white">{formatCurrency(item.revenue)}</p>
                                    <p className="text-xs text-green-400">{formatPercent(item.marginPercent)} margem</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {/* CMV Chart */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4">CMV vs Meta (7 dias)</h3>
                <div className="h-48">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData || []}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                            <XAxis dataKey="date" stroke="#666" fontSize={12} />
                            <YAxis stroke="#666" fontSize={12} domain={[0, 50]} tickFormatter={(v) => `${v}%`} />
                            <Tooltip
                                contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                                formatter={(value: number) => [`${value.toFixed(1)}%`, 'CMV']}
                            />
                            <Bar dataKey="cmv" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        </div>
    );
}

interface KPICardProps {
    title: string;
    value: string;
    change: number;
    subtitle: string;
    icon: React.ElementType;
    color: 'primary' | 'secondary' | 'blue' | 'green' | 'red';
    invertTrend?: boolean;
}

function KPICard({ title, value, change, subtitle, icon: Icon, color, invertTrend }: KPICardProps) {
    const isPositive = invertTrend ? change < 0 : change > 0;
    const colors = {
        primary: 'from-primary-500/20 to-primary-600/20 text-primary-400',
        secondary: 'from-secondary-500/20 to-secondary-600/20 text-secondary-400',
        blue: 'from-blue-500/20 to-blue-600/20 text-blue-400',
        green: 'from-green-500/20 to-green-600/20 text-green-400',
        red: 'from-red-500/20 to-red-600/20 text-red-400',
    };

    return (
        <div className="stat-card group">
            <div className="flex items-start justify-between">
                <div className={`p-3 rounded-xl bg-gradient-to-br ${colors[color]}`}>
                    <Icon className="w-5 h-5" />
                </div>
                {change !== 0 && (
                    <div className={`flex items-center gap-1 text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                        {isPositive ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                        {Math.abs(change).toFixed(1)}%
                    </div>
                )}
            </div>
            <div className="mt-4">
                <h3 className="text-sm text-gray-400">{title}</h3>
                <p className="text-2xl font-bold text-white mt-1">{value}</p>
                <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
            </div>
        </div>
    );
}
