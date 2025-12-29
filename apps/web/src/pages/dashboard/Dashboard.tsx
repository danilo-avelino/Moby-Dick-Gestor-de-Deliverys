import { useState, useCallback, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency, formatPercent } from '../../lib/utils';
import {
    DollarSign, ShoppingBag, Trash2, TrendingUp, Package, TrendingDown,
    Maximize, Minimize
} from 'lucide-react';
import { cn } from '../../lib/utils';
import {
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    BarChart, Bar, Legend, ComposedChart, Line
} from 'recharts';
import { ErrorBoundary } from '../../components/ErrorBoundary';
import { BentoGrid, BentoCard } from './components/BentoGrid';
import { ModernKPICard } from './components/ModernKPICard';
import { format } from 'date-fns';

export default function Dashboard() {
    const [isFullscreen, setIsFullscreen] = useState(false);

    const toggleFullscreen = useCallback(() => {
        const docElm = document.documentElement as any;
        const doc = document as any;

        if (!doc.fullscreenElement && !doc.mozFullScreenElement && !doc.webkitFullscreenElement && !doc.msFullscreenElement) {
            if (docElm.requestFullscreen) {
                docElm.requestFullscreen();
            } else if (docElm.mozRequestFullScreen) {
                docElm.mozRequestFullScreen();
            } else if (docElm.webkitRequestFullscreen) {
                docElm.webkitRequestFullscreen();
            } else if (docElm.msRequestFullscreen) {
                docElm.msRequestFullscreen();
            }
        } else {
            if (doc.exitFullscreen) {
                doc.exitFullscreen();
            } else if (doc.mozCancelFullScreen) {
                doc.mozCancelFullScreen();
            } else if (doc.webkitExitFullscreen) {
                doc.webkitExitFullscreen();
            } else if (doc.msExitFullscreen) {
                doc.msExitFullscreen();
            }
        }
    }, []);

    useEffect(() => {
        const handleFullscreenChange = () => {
            const doc = document as any;
            setIsFullscreen(!!(doc.fullscreenElement || doc.mozFullScreenElement || doc.webkitFullscreenElement || doc.msFullscreenElement));
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
        document.addEventListener('mozfullscreenchange', handleFullscreenChange);
        document.addEventListener('MSFullscreenChange', handleFullscreenChange);

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
            document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
            document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
        };
    }, []);

    const { data: kpis, dataUpdatedAt: kpisUpdatedAt } = useQuery({
        queryKey: ['dashboard-kpis'],
        queryFn: () => api.get('/api/dashboard/kpis').then((r) => r.data.data),
        refetchInterval: 300000, // 5 minutes
    });

    const { data: monthlyChart, dataUpdatedAt: chartUpdatedAt } = useQuery({
        queryKey: ['dashboard-monthly-chart'],
        queryFn: () => api.get('/api/dashboard/monthly-chart').then((r) => r.data.data),
        refetchInterval: 300000,
    });

    const { data: turnoverData, dataUpdatedAt: turnoverUpdatedAt } = useQuery({
        queryKey: ['dashboard-stock-turnover'],
        queryFn: () => api.get('/api/dashboard/stock-turnover').then((r) => r.data.data),
        refetchInterval: 300000,
    });

    // Get the most recent update time
    const lastUpdate = Math.max(kpisUpdatedAt, chartUpdatedAt, turnoverUpdatedAt);

    // Safe access
    const revenueYesterday = kpis?.revenue?.yesterday || 0;
    const revenueMonth = kpis?.revenue?.thisMonth || 0;
    const purchasesMonth = kpis?.purchases?.thisMonth || 0;
    const wasteMonth = kpis?.waste?.thisMonth || 0;
    const cmvTarget = kpis?.targets?.cmv || 30;
    const cmvAlert = kpis?.targets?.cmvAlert || 35;

    // Calculate CMV (Purchases / Revenue)
    const cmvValue = revenueMonth > 0 ? (purchasesMonth / revenueMonth) * 100 : 0;

    // Calculate Balance Percentage
    const totalEntries = turnoverData?.reduce((acc: number, d: any) => acc + d.entries, 0) || 0;
    const totalExits = turnoverData?.reduce((acc: number, d: any) => acc + d.exits, 0) || 0;
    const balancePercent = totalEntries > 0 ? ((totalEntries - totalExits) / totalEntries) * 100 : 0;

    return (
        <div className="p-8 space-y-8 min-h-screen animate-fade-in pb-20">
            <div className="flex justify-between items-center mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Dashboard</h1>
                    <p className="text-gray-400 mt-1">Visao geral da operacao em tempo real</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="text-right mr-2">
                        <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-sm font-medium flex items-center mb-1">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 mr-2 animate-pulse" />
                            Online
                        </div>
                        <p className="text-[10px] text-gray-500 font-medium">
                            Última atualização: {lastUpdate ? format(lastUpdate, 'HH:mm:ss') : '--:--:--'}
                        </p>
                    </div>

                    <button
                        onClick={toggleFullscreen}
                        className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-400 hover:bg-white/10 hover:text-white transition-all flex items-center gap-2 group"
                        title={isFullscreen ? "Sair da Tela Cheia" : "Tela Cheia"}
                    >
                        {isFullscreen ? (
                            <Minimize size={18} className="group-hover:scale-110 transition-transform" />
                        ) : (
                            <Maximize size={18} className="group-hover:scale-110 transition-transform" />
                        )}
                        <span className="text-sm font-medium">{isFullscreen ? 'Sair' : 'Expandir'}</span>
                    </button>
                </div>
            </div>

            <ErrorBoundary>
                <BentoGrid>
                    {/* Top Row: KPIs */}
                    <BentoCard colSpan={1} className="min-h-[160px]" noPadding>
                        <ModernKPICard
                            title="Faturamento (Mes)"
                            value={formatCurrency(revenueMonth)}
                            subtitle="Acumulado"
                            icon={DollarSign}
                            variant="revenue"
                            trend={kpis?.revenue?.trend !== undefined ? `${kpis.revenue.trend >= 0 ? '+' : ''}${kpis.revenue.trend.toFixed(1)}% vs mes ant.` : ''}
                            trendType={kpis?.revenue?.trend >= 0 ? "up" : "down"}
                        />
                    </BentoCard>

                    <BentoCard colSpan={1} className="min-h-[160px]" noPadding>
                        <ModernKPICard
                            title="Compras (CMV)"
                            value={formatCurrency(purchasesMonth)}
                            subtitle={`CMV: ${formatPercent(cmvValue)}`}
                            icon={ShoppingBag}
                            variant="cmv"
                            trend={cmvValue > cmvAlert ? "Alerta: Alto" : "Dentro da meta"}
                            trendType={cmvValue > cmvAlert ? "down" : "up"}
                        />
                    </BentoCard>

                    <BentoCard colSpan={1} className="min-h-[160px]" noPadding>
                        <ModernKPICard
                            title="Desperdicio (Mes)"
                            value={formatCurrency(wasteMonth)}
                            subtitle="Perdas registradas"
                            icon={Trash2}
                            variant="waste"
                            trend={kpis?.waste?.trend !== undefined ? `${kpis.waste.trend >= 0 ? '+' : ''}${kpis.waste.trend.toFixed(1)}% vs mes ant.` : ''}
                            trendType={kpis?.waste?.trend > 0 ? "down" : "up"}
                        />
                    </BentoCard>

                    <BentoCard colSpan={1} className="min-h-[160px]" noPadding>
                        <ModernKPICard
                            title="Precisao de Estoque"
                            value={`${(kpis?.stockAccuracy || 98).toFixed(1)}%`}
                            subtitle={kpis?.lastInventoryDate ? `Ultimo: ${format(new Date(kpis.lastInventoryDate), 'dd/MM/yyyy')}` : 'Sem registros'}
                            icon={Package}
                            variant="profit" // Green
                            trend="Meta: 98%"
                            trendType="neutral"
                        />
                    </BentoCard>

                    <BentoCard colSpan={1} className="min-h-[160px]" noPadding>
                        {/* Placeholder for "Profit" or another metric. Let's use Yesterday's Revenue for quick check */}
                        <ModernKPICard
                            title="Faturamento (Ontem)"
                            value={formatCurrency(revenueYesterday)}
                            subtitle="Fechamento diario"
                            icon={TrendingUp}
                            variant="profit" // Green
                            trend="Diario"
                            trendType="neutral"
                        />
                    </BentoCard>

                    {/* Charts Row 1: CMV next to Faturamento (Ontem) */}
                    <BentoCard
                        colSpan={3}
                        title="CMV de Estoque vs Meta"
                        className="min-h-[400px]"
                        headerAction={
                            <div className={cn(
                                "flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-bold border",
                                cmvValue <= cmvTarget
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : cmvValue <= cmvAlert
                                        ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/20"
                                        : "bg-red-500/10 text-red-400 border-red-500/20"
                            )}>
                                <span className="text-xs font-medium opacity-70">Mês Atual:</span>
                                {formatPercent(cmvValue)}
                                {cmvValue <= cmvTarget && <TrendingDown className="w-3 h-3" />}
                                {cmvValue > cmvAlert && <TrendingUp className="w-3 h-3" />}
                            </div>
                        }
                    >
                        <div className="h-[300px] w-full">
                            {/* Explanation */}
                            <div className="absolute top-4 right-6 flex items-center gap-4 text-xs z-10">
                                <div className="flex items-center gap-1.5">
                                    <div className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span className="text-gray-400">CMV Real (%)</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <div className="w-4 h-0.5 rounded-full bg-red-400 border-t-2 border-dashed border-red-400" />
                                    <span className="text-gray-400">Meta ({cmvTarget}%)</span>
                                </div>
                            </div>

                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart
                                    data={monthlyChart?.map((d: any) => ({
                                        ...d,
                                        cmvPercent: d.revenue > 0 ? (d.purchases / d.revenue) * 100 : 0,
                                        target: cmvTarget
                                    })) || []}
                                    margin={{ top: 20, right: 0, left: -20, bottom: 0 }}
                                >
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis dataKey="day" stroke="#666" fontSize={10} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke="#666" fontSize={10} tickFormatter={(v) => `${v}%`} tickLine={false} axisLine={false} domain={[20, 50]} ticks={[20, 25, 30, 35, 40, 45, 50]} />
                                    <Tooltip
                                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
                                        labelStyle={{ color: '#fff' }}
                                        formatter={(value: number, name: string) => [
                                            name === 'cmvPercent' ? formatPercent(value) : `${value}%`,
                                            name === 'cmvPercent' ? 'CMV Real' : 'Meta'
                                        ]}
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    />
                                    <Bar dataKey="cmvPercent" name="cmvPercent" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={8} />
                                    <Line type="step" dataKey="target" name="target" stroke="#ef4444" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        </div>
                    </BentoCard>

                    {/* Charts Row 2: Stock Turnover */}
                    <BentoCard
                        colSpan={4}
                        title="Giro de Estoque: Entradas vs Saidas"
                        className="min-h-[400px]"
                        headerAction={
                            <div className={cn(
                                "flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-bold border",
                                balancePercent >= 0
                                    ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                                    : "bg-red-500/10 text-red-400 border-red-500/20"
                            )}>
                                {balancePercent >= 0 ? '+' : ''}{balancePercent.toFixed(1)}%
                                <span className="text-[10px] font-medium opacity-60">Balança</span>
                            </div>
                        }
                    >
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={turnoverData || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
                                    <XAxis dataKey="label" stroke="#666" fontSize={12} tickLine={false} axisLine={false} dy={10} />
                                    <YAxis stroke="#666" fontSize={12} tickFormatter={(v) => `R$${v}`} tickLine={false} axisLine={false} dx={-10} />
                                    <Tooltip
                                        contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 12 }}
                                        labelStyle={{ color: '#fff', marginBottom: 4 }}
                                        formatter={(value: number) => [formatCurrency(value), '']}
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                    />
                                    <Legend iconType="circle" />
                                    <Bar dataKey="entries" name="Entradas" fill="#10b981" radius={[4, 4, 0, 0]} barSize={60} />
                                    <Bar dataKey="exits" name="Saidas" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={60} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </BentoCard>
                </BentoGrid>
            </ErrorBoundary>
        </div>
    );
}
