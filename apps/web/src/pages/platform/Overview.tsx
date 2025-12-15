
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
    Users, Activity, DollarSign, Calendar, AlertTriangle, CheckCircle,
    TrendingUp, ShieldAlert, CreditCard
} from 'lucide-react';
import { cn } from '../../lib/utils';

import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, LineChart, Line, Legend
} from 'recharts';

export default function PlatformOverview() {
    const { data, isLoading } = useQuery({
        queryKey: ['platform-overview'],
        queryFn: () => api.get('/api/platform/overview').then(r => r.data.data),
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
            </div>
        );
    }

    const { kpis, health } = data || { kpis: {}, health: {} };

    // TODO: Connect to real API
    const mockGrowthData = [
        { name: '01/12', orgs: 4 },
        { name: '02/12', orgs: 6 },
        { name: '03/12', orgs: 5 },
        { name: '04/12', orgs: 8 },
        { name: '05/12', orgs: 12 },
        { name: '06/12', orgs: 10 },
        { name: '07/12', orgs: 15 },
    ];

    const mockEventsData = [
        { name: '01/12', events: 12 },
        { name: '02/12', events: 19 },
        { name: '03/12', events: 15 },
        { name: '04/12', events: 22 },
        { name: '05/12', events: 28 },
        { name: '06/12', events: 25 },
        { name: '07/12', events: 35 },
    ];

    const mockRevenueData = [
        { name: '01/12', gmv: 4500 },
        { name: '02/12', gmv: 6200 },
        { name: '03/12', gmv: 5100 },
        { name: '04/12', gmv: 8900 },
        { name: '05/12', gmv: 12400 },
        { name: '06/12', gmv: 10500 },
        { name: '07/12', gmv: 15800 },
    ];

    return (
        <div className="space-y-6 pb-20">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Visão Geral da Plataforma</h1>
                <p className="text-gray-400">Monitoramento em tempo real do ecossistema SaaS.</p>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    title="Organizações Ativas"
                    value={kpis.activeOrgs || 0}
                    icon={Users}
                    trend="+12%"
                    color="text-blue-500"
                    bg="bg-blue-500/10"
                />
                <KpiCard
                    title="Eventos Ativos"
                    value={kpis.activeEvents || 0}
                    icon={Calendar}
                    trend="+5"
                    color="text-amber-500"
                    bg="bg-amber-500/10"
                />
                <KpiCard
                    title="Ingressos (7d)"
                    value={kpis.ticketsSoldWeek || 0}
                    icon={Activity}
                    trend="+24%"
                    color="text-emerald-500"
                    bg="bg-emerald-500/10"
                />
                <KpiCard
                    title="Receita (Est.)"
                    value={`R$ ${(kpis.revenueWeek || 0).toLocaleString()}`}
                    icon={DollarSign}
                    trend="+8%"
                    color="text-purple-500"
                    bg="bg-purple-500/10"
                />
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                {/* Growth Chart */}
                <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
                    <h3 className="font-semibold text-white mb-4">Novas Organizações (30d)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={mockGrowthData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.5rem' }}
                                    itemStyle={{ color: '#E5E7EB' }}
                                />
                                <Line type="monotone" dataKey="orgs" stroke="#3B82F6" strokeWidth={3} dot={{ fill: '#3B82F6' }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Events Chart */}
                <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
                    <h3 className="font-semibold text-white mb-4">Eventos Publicados (14d)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={mockEventsData}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.5rem' }}
                                    itemStyle={{ color: '#E5E7EB' }}
                                    cursor={{ fill: '#374151', opacity: 0.3 }}
                                />
                                <Bar dataKey="events" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Revenue Chart */}
                <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 lg:col-span-2 xl:col-span-1">
                    <h3 className="font-semibold text-white mb-4">Receita / GMV (14d)</h3>
                    <div className="h-64">
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={mockRevenueData}>
                                <defs>
                                    <linearGradient id="colorGmv" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#8B5CF6" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.5} />
                                <XAxis dataKey="name" stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false} />
                                <YAxis stroke="#9CA3AF" fontSize={12} tickLine={false} axisLine={false}
                                    tickFormatter={(value) => `R$${value / 1000}k`}
                                />
                                <Tooltip
                                    contentStyle={{ backgroundColor: '#111827', border: '1px solid #374151', borderRadius: '0.5rem' }}
                                    itemStyle={{ color: '#E5E7EB' }}
                                    formatter={(value: number) => [`R$ ${value.toLocaleString()}`, 'GMV']}
                                />
                                <Area type="monotone" dataKey="gmv" stroke="#8B5CF6" fillOpacity={1} fill="url(#colorGmv)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Health & Alerts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* System Health */}
                <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6">
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="font-semibold text-white">Saúde do Sistema</h3>
                        <div className={cn(
                            "px-3 py-1 rounded-full text-xs font-bold",
                            health.status === 'OPERATIONAL' ? "bg-emerald-500/20 text-emerald-500" : "bg-red-500/20 text-red-500"
                        )}>
                            {health.status || 'Checking...'}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <HealthMetric label="Latência API" value={`${health.apiLatency || 0}ms`} ideal="< 100ms" />
                        <HealthMetric label="Jobs Pendentes" value={health.jobsPending || 0} ideal="0" />
                        <HealthMetric label="Webhook Success" value={`${health.webhooksSuccessRate || 100}%`} ideal="> 99%" />
                    </div>
                </div>

                {/* Failed Webhooks / Critical Issues */}
                <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 lg:col-span-2">
                    <h3 className="font-semibold text-white mb-4">Insights & Atenção</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Insight 1: Risk */}
                        <div className="p-4 rounded-xl bg-gray-900 border border-white/5 hover:border-red-500/30 transition-colors group cursor-pointer">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-red-500/10 text-red-500 group-hover:bg-red-500/20">
                                    <AlertTriangle className="w-4 h-4" />
                                </div>
                                <h4 className="font-medium text-white">Organizações em Risco</h4>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">3 organizações sem eventos publicados há 30 dias.</p>
                            <div className="flex -space-x-2">
                                <span className="w-6 h-6 rounded-full bg-gray-700 border border-black flex items-center justify-center text-[10px] text-white">OR</span>
                                <span className="w-6 h-6 rounded-full bg-gray-700 border border-black flex items-center justify-center text-[10px] text-white">BH</span>
                            </div>
                        </div>

                        {/* Insight 2: Webhook Failures */}
                        <div className="p-4 rounded-xl bg-gray-900 border border-white/5 hover:border-amber-500/30 transition-colors group cursor-pointer">
                            <div className="flex items-center gap-3 mb-2">
                                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500 group-hover:bg-amber-500/20">
                                    <ShieldAlert className="w-4 h-4" />
                                </div>
                                <h4 className="font-medium text-white">Webhooks (24h)</h4>
                            </div>
                            <p className="text-xs text-gray-400 mb-3">
                                {kpis.failedWebhooks24h > 0
                                    ? `Crescimento anormal: ${kpis.failedWebhooks24h} falhas registradas.`
                                    : "Nenhuma falha crítica detectada."}
                            </p>
                            <span className="text-xs text-blue-400 hover:text-blue-300">Ver logs de integrações &rarr;</span>
                        </div>
                    </div>

                    <h3 className="font-semibold text-white mt-6 mb-4">Alertas Recentes</h3>
                    <div className="space-y-3">
                        {kpis.failedWebhooks24h > 0 && (
                            <div className="flex items-center gap-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg">
                                <div className="p-2 bg-red-500/20 rounded-lg">
                                    <ShieldAlert className="w-5 h-5 text-red-500" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-white">Falha em Webhooks (24h)</h4>
                                </div>
                                <button className="px-3 py-1.5 text-xs font-medium text-red-400 hover:text-white hover:bg-red-500/20 rounded-lg transition-colors">
                                    Ver Logs
                                </button>
                            </div>
                        )}
                        {kpis.failedPayments24h > 0 && (
                            <div className="flex items-center gap-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                                <div className="p-2 bg-amber-500/20 rounded-lg">
                                    <CreditCard className="w-5 h-5 text-amber-500" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-white">Falha em Pagamentos</h4>
                                    <p className="text-xs text-gray-400">{kpis.failedPayments24h} tentativas falharam.</p>
                                </div>
                            </div>
                        )}
                        {!kpis.failedWebhooks24h && !kpis.failedPayments24h && (
                            <div className="flex items-center gap-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
                                <div className="p-2 bg-green-500/20 rounded-lg">
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                </div>
                                <div className="flex-1">
                                    <h4 className="text-sm font-medium text-white">Tudo Certo</h4>
                                    <p className="text-xs text-gray-400">Sistemas operando normalmente.</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

function KpiCard({ title, value, icon: Icon, trend, color, bg }: any) {
    return (
        <div className="bg-gray-900/50 border border-white/5 rounded-xl p-6 hover:bg-white/5 transition-colors group">
            <div className="flex items-start justify-between mb-4">
                <div className={cn("p-2 rounded-lg transition-colors group-hover:scale-110 duration-300", bg)}>
                    <Icon className={cn("w-5 h-5", color)} />
                </div>
                {trend && (
                    <span className="flex items-center text-xs font-medium text-emerald-500 bg-emerald-500/10 px-2 py-1 rounded-full">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {trend}
                    </span>
                )}
            </div>
            <h3 className="text-3xl font-bold text-white tracking-tight mb-1">{value}</h3>
            <p className="text-sm text-gray-500 font-medium">{title}</p>
        </div>
    );
}

function HealthMetric({ label, value, ideal }: any) {
    return (
        <div className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <span className="text-sm text-gray-400">{label}</span>
            <div className="text-right">
                <p className="text-sm font-bold text-white">{value}</p>
                <p className="text-[10px] text-gray-500">Ideal: {ideal}</p>
            </div>
        </div>
    )
}
