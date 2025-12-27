import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency, formatPercent } from '../../lib/utils';
import {
    TrendingUp, TrendingDown, DollarSign, ShoppingBag, Receipt, Percent,
    AlertTriangle, Package, Trash2, Calendar
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, ComposedChart, Line
} from 'recharts';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function Dashboard() {
    const { data: kpis } = useQuery({
        queryKey: ['dashboard-kpis'],
        queryFn: () => api.get('/api/dashboard/kpis').then((r) => r.data.data),
    });

    const { data: revenueChart } = useQuery({
        queryKey: ['dashboard-revenue-chart'],
        queryFn: () => api.get('/api/dashboard/revenue-chart?period=week').then((r) => r.data.data),
    });

    const { data: monthlyChart } = useQuery({
        queryKey: ['dashboard-monthly-chart'],
        queryFn: () => api.get('/api/dashboard/monthly-chart').then((r) => r.data.data),
    });

    // Safe access
    const revenueYesterday = kpis?.revenue?.yesterday || 0;
    const revenueMonth = kpis?.revenue?.thisMonth || 0;
    const purchasesMonth = kpis?.purchases?.thisMonth || 0;
    const wasteMonth = kpis?.waste?.thisMonth || 0;

    // Calculate CMV (Purchases / Revenue)
    const cmvValue = revenueMonth > 0 ? (purchasesMonth / revenueMonth) * 100 : 0;

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <ErrorBoundary>
                <div>
                    <h1 className="text-2xl font-bold text-white">Dashboard</h1>
                    <p className="text-gray-400">Visão geral do seu restaurante (Dados Reais)</p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <KPICard
                        title="Faturamento (Ontem)"
                        value={formatCurrency(revenueYesterday)}
                        subtitle="Fechamento do dia anterior"
                        icon={DollarSign}
                        color="primary"
                    />
                    <KPICard
                        title="Faturamento (Mês)"
                        value={formatCurrency(revenueMonth)}
                        subtitle="Acumulado mês atual"
                        icon={Calendar}
                        color="green"
                    />
                    <KPICard
                        title="Compras (Mês)"
                        value={formatCurrency(purchasesMonth)}
                        subtitle="Entradas de estoque"
                        icon={ShoppingBag}
                        color="blue"
                    />
                    <KPICard
                        title="Desperdício (Mês)"
                        value={formatCurrency(wasteMonth)}
                        subtitle="Baixas por perda/lixo"
                        icon={Trash2}
                        color="red"
                    />
                    <KPICard
                        title="CMV (Compras/Fat)"
                        value={formatPercent(cmvValue)}
                        subtitle="Baseado em Entradas vs Faturamento"
                        icon={Percent}
                        color={cmvValue > 35 ? 'red' : 'green'}
                    />
                </div>

                {/* Charts Row */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Revenue Chart (7 Days) */}
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Faturamento Diário (Últimos 7 dias)</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={revenueChart || []}>
                                    <defs>
                                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#eab308" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#eab308" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis dataKey="date" stroke="#666" fontSize={12} />
                                    <YAxis stroke="#666" fontSize={12} tickFormatter={(v) => `R$${v / 1000}k`} />
                                    <Tooltip
                                        contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                                        labelStyle={{ color: '#fff' }}
                                        formatter={(value: number) => [formatCurrency(value), 'Faturamento']}
                                    />
                                    <Area type="monotone" dataKey="revenue" stroke="#eab308" fill="url(#colorRevenue)" strokeWidth={2} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Monthly Chart (Purchases vs Revenue) */}
                    <div className="glass-card p-6">
                        <h3 className="text-lg font-semibold text-white mb-4">Entradas vs Faturamento (Mês Atual)</h3>
                        <div className="h-80">
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={monthlyChart || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis dataKey="day" stroke="#666" fontSize={12} unit="d" />
                                    <YAxis yAxisId="left" stroke="#666" fontSize={12} tickFormatter={(v) => `R$${v / 1000}k`} />
                                    <Tooltip
                                        contentStyle={{ background: '#1a1a2e', border: '1px solid #333', borderRadius: 8 }}
                                        labelStyle={{ color: '#fff' }}
                                    />
                                    <Legend />
                                    <Bar yAxisId="left" dataKey="purchases" name="Compras" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={10} />
                                    <Line yAxisId="left" type="monotone" dataKey="revenue" name="Faturamento" stroke="#eab308" strokeWidth={2} dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </ErrorBoundary>
        </div>
    );
}

interface KPICardProps {
    title: string;
    value: string;
    subtitle?: string;
    icon: React.ElementType;
    color: 'primary' | 'secondary' | 'blue' | 'green' | 'red';
}

function KPICard({ title, value, subtitle, icon: Icon, color }: KPICardProps) {
    const colors = {
        primary: 'bg-primary-500/10 text-primary-400 border-primary-500/20',
        secondary: 'bg-secondary-500/10 text-secondary-400 border-secondary-500/20',
        blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        green: 'bg-green-500/10 text-green-400 border-green-500/20',
        red: 'bg-red-500/10 text-red-400 border-red-500/20',
    };

    return (
        <div className={`glass-card p-4 border border-white/5 flex flex-col justify-between ${colors[color].split(' ')[2]}`}>
            <div className="flex items-start justify-between mb-2">
                <div>
                    <p className="text-gray-400 text-sm font-medium">{title}</p>
                </div>
                <div className={`p-2 rounded-lg ${colors[color].split(' ').slice(0, 2).join(' ')}`}>
                    <Icon className="w-5 h-5" />
                </div>
            </div>
            <div>
                <p className="text-2xl font-bold text-white tracking-tight">{value}</p>
                {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
            </div>
        </div>
    );
}

