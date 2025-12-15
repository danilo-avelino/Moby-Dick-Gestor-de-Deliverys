
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
    Calendar, Search, Filter, ArrowUpRight, MapPin, Building, Ticket,
    AlertTriangle, CheckCircle, TrendingDown, DollarSign, Eye, MoreHorizontal,
    FileText, CreditCard
} from "lucide-react";
import { api } from '../../lib/api';
import { Link, useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function PlatformEvents() {
    const navigate = useNavigate();
    const [page, setPage] = useState(1);
    const [filters, setFilters] = useState({
        search: '',
        status: 'ALL',
        period: 'today', // today, next_7, past_30, custom
        noSales: false,
        orgId: '',
    });

    // Fetch Events with Filters
    const { data, isLoading } = useQuery({
        queryKey: ['platform-events', page, filters],
        queryFn: async () => {
            const params = new URLSearchParams({
                page: page.toString(),
                limit: '20',
                period: filters.period,
                status: filters.status,
                search: filters.search,
                noSales: filters.noSales.toString(),
            });
            if (filters.orgId) params.append('orgId', filters.orgId);

            const res = await api.get(`/api/platform/events?${params.toString()}`);
            return res.data.data;
        },
        refetchInterval: 30000 // Real-timeish updates
    });

    const handleInspectOrg = (orgId: string) => {
        // In a real app we might set some "Impersonation Context" here
        navigate(`/org/${orgId}/overview`);
        toast.success('Inspecionando organização', { icon: '🕵️' });
    };

    const stats = data?.kpis || {
        today: 0,
        next7: 0,
        published30d: 0,
        totalTicketsSold: 0,
        totalRevenue: 0
    };

    const insights = data?.insights || { stuckEvents: 0, webhooksFailed: 0 };
    const events = data?.items || [];
    const pagination = data?.pagination;

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Eventos (Plataforma)</h1>
                    <p className="text-gray-400 mt-1">Visão agregada de eventos de todas as organizações (Multi-tenant)</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={() => setFilters(f => ({ ...f, period: 'today' }))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filters.period === 'today' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    >
                        Hoje
                    </button>
                    <button
                        onClick={() => setFilters(f => ({ ...f, period: 'next_7' }))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${filters.period === 'next_7' ? 'bg-blue-600 text-white' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    >
                        Próximos 7 dias
                    </button>
                    <button
                        onClick={() => setFilters(f => ({ ...f, noSales: !f.noSales }))}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${filters.noSales ? 'bg-amber-600/20 text-amber-500 border border-amber-500/50' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'}`}
                    >
                        <AlertTriangle className="w-4 h-4" />
                        Sem vendas
                    </button>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                <div className="bg-gray-900 border border-white/5 p-4 rounded-xl">
                    <div className="text-gray-400 text-xs font-medium uppercase mb-1">Eventos Hoje</div>
                    <div className="text-2xl font-bold text-white">{stats.today}</div>
                </div>
                <div className="bg-gray-900 border border-white/5 p-4 rounded-xl">
                    <div className="text-gray-400 text-xs font-medium uppercase mb-1">Próximos 7 dias</div>
                    <div className="text-2xl font-bold text-white">{stats.next7}</div>
                </div>
                <div className="bg-gray-900 border border-white/5 p-4 rounded-xl">
                    <div className="text-gray-400 text-xs font-medium uppercase mb-1">Publicados (30d)</div>
                    <div className="text-2xl font-bold text-blue-400">{stats.published30d}</div>
                </div>
                <div className="bg-gray-900 border border-white/5 p-4 rounded-xl">
                    <div className="text-gray-400 text-xs font-medium uppercase mb-1">Total Ingressos</div>
                    <div className="text-2xl font-bold text-green-400">{stats.totalTicketsSold}</div>
                </div>
                <div className="bg-gray-900 border border-white/5 p-4 rounded-xl">
                    <div className="text-gray-400 text-xs font-medium uppercase mb-1">Receita Total</div>
                    <div className="text-2xl font-bold text-white">R$ {stats.totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}</div>
                </div>
            </div>

            {/* Filters Bar */}
            <div className="flex flex-col lg:flex-row gap-4 bg-gray-900/50 p-4 rounded-xl border border-white/5">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Buscar evento ou organização..."
                        value={filters.search}
                        onChange={(e) => setFilters(f => ({ ...f, search: e.target.value }))}
                        className="w-full bg-gray-900 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-blue-500 focus:border-blue-500 placeholder-gray-500 text-sm"
                    />
                </div>

                <select
                    value={filters.status}
                    onChange={(e) => setFilters(f => ({ ...f, status: e.target.value }))}
                    className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
                >
                    <option value="ALL">Todos os status</option>
                    <option value="PUBLISHED">Publicado</option>
                    <option value="DRAFT">Rascunho</option>
                    <option value="ENDED">Encerrado</option>
                    <option value="CANCELLED">Cancelado</option>
                </select>

                <select
                    value={filters.period}
                    onChange={(e) => setFilters(f => ({ ...f, period: e.target.value }))}
                    className="bg-gray-900 border border-white/10 rounded-lg px-3 py-2 text-white text-sm focus:ring-blue-500 focus:border-blue-500 min-w-[150px]"
                >
                    <option value="today">Hoje</option>
                    <option value="next_7">Próximos 7 dias</option>
                    <option value="past_30">Últimos 30 dias</option>
                    <option value="all">Todo o período</option>
                </select>

                <div className="flex items-center gap-2 border-l border-white/10 pl-4 ml-2">
                    <span className="text-sm text-gray-500">Alertas:</span>
                    <button
                        onClick={() => setFilters(f => ({ ...f, noSales: !f.noSales }))}
                        className={`p-2 rounded-lg transition-colors ${filters.noSales ? 'bg-red-500/20 text-red-400' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                        title="Eventos sem vendas"
                    >
                        <TrendingDown className="w-4 h-4" />
                    </button>
                    {/* Placeholder for payment failures toggle */}
                    <button
                        className="p-2 rounded-lg bg-gray-800 text-gray-600 cursor-not-allowed"
                        title="Falhas de pagamento (Em breve)"
                        disabled
                    >
                        <CreditCard className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* Main Table */}
            <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                {isLoading ? (
                    <div className="p-12 text-center text-gray-500">Carregando eventos...</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase font-medium tracking-wider">
                                <tr>
                                    <th className="px-6 py-4">Data/Hora</th>
                                    <th className="px-6 py-4">Evento</th>
                                    <th className="px-6 py-4">Organização</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Saúde</th>
                                    <th className="px-6 py-4 text-right">Vendas</th>
                                    <th className="px-6 py-4 text-right">GMV</th>
                                    <th className="px-6 py-4"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300 text-sm">
                                {events.map((event: any) => (
                                    <tr key={event.id} className="hover:bg-white/5 transition-colors group">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2 text-white">
                                                <Calendar className="w-4 h-4 text-gray-500" />
                                                <span>{new Date(event.startsAt).toLocaleDateString()}</span>
                                            </div>
                                            <div className="text-xs text-gray-500 pl-6">
                                                {new Date(event.startsAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-medium text-white text-base">{event.name}</div>
                                            <div className="flex items-center gap-1 text-xs text-gray-500 mt-1">
                                                <MapPin className="w-3 h-3" />
                                                {event.city || 'Local não definido'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => handleInspectOrg(event.organizationId)}
                                                className="group/org flex items-center gap-2 hover:bg-white/10 px-2 py-1 rounded-md -ml-2 transition-colors"
                                            >
                                                <div className="w-6 h-6 rounded bg-gradient-to-br from-blue-600 to-purple-600 flex items-center justify-center text-[10px] uppercase font-bold text-white">
                                                    {event.organization.name.substring(0, 2)}
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-white group-hover/org:text-blue-400 font-medium transition-colors">
                                                        {event.organization.name}
                                                    </div>
                                                    <div className="text-[10px] text-gray-500 flex items-center gap-1">
                                                        Inspecionar <ArrowUpRight className="w-2 h-2" />
                                                    </div>
                                                </div>
                                            </button>
                                        </td>
                                        <td className="px-6 py-4">
                                            <StatusBadge status={event.status} />
                                        </td>
                                        <td className="px-6 py-4">
                                            <HealthBadge status={event.health} />
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex flex-col items-end">
                                                <span className="font-medium text-white">{event.ticketsSold}</span>
                                                <span className="text-[10px] text-gray-500 uppercase">Ingressos</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="font-medium text-green-400">
                                                R$ {event.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white" title="Mais opções">
                                                    <MoreHorizontal className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}
                                {events.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-12 text-center text-gray-500">
                                            Nenhum evento encontrado com os filtros atuais.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {pagination && pagination.totalPages > 1 && (
                            <div className="px-6 py-4 border-t border-white/5 flex items-center justify-between">
                                <span className="text-sm text-gray-400">
                                    Página {pagination.page} de {pagination.totalPages} ({pagination.total} total)
                                </span>
                                <div className="flex gap-2">
                                    <button
                                        disabled={page === 1}
                                        onClick={() => setPage(p => p - 1)}
                                        className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300 disabled:opacity-50 hover:bg-gray-700"
                                    >
                                        Anterior
                                    </button>
                                    <button
                                        disabled={page >= pagination.totalPages}
                                        onClick={() => setPage(p => p + 1)}
                                        className="px-3 py-1 bg-gray-800 rounded text-sm text-gray-300 disabled:opacity-50 hover:bg-gray-700"
                                    >
                                        Próxima
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Insights Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                {/* Insight 1: Stuck Events */}
                <div className="bg-gray-900 border border-white/10 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-amber-500 mb-2">
                            <TrendingDown className="w-4 h-4" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Eventos Parados</h3>
                        </div>
                        <p className="text-gray-400 text-sm">Publicados a mais de 7 dias sem nenhuma venda.</p>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                        <span className="text-3xl font-bold text-white">{insights.stuckEvents}</span>
                        <button className="text-xs text-blue-400 hover:underline">Ver lista</button>
                    </div>
                </div>

                {/* Insight 2: Webhook Failures */}
                <div className="bg-gray-900 border border-white/10 rounded-xl p-5 flex flex-col justify-between">
                    <div>
                        <div className="flex items-center gap-2 text-red-500 mb-2">
                            <AlertTriangle className="w-4 h-4" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Falhas Webhook (24h)</h3>
                        </div>
                        <p className="text-gray-400 text-sm">Erros de integração e notificações de pagamento.</p>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                        <span className="text-3xl font-bold text-white">{insights.webhooksFailed}</span>
                        <button className="text-xs text-blue-400 hover:underline">Auditar</button>
                    </div>
                </div>

                {/* Insight 3: Placeholder Sales Drop */}
                <div className="bg-gray-900 border border-white/10 rounded-xl p-5 flex flex-col justify-between opacity-50">
                    <div>
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                            <TrendingDown className="w-4 h-4" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Queda de Vendas</h3>
                        </div>
                        <p className="text-gray-500 text-sm">Eventos com queda brusca nas últimas 24h.</p>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                        <span className="text-3xl font-bold text-gray-600">—</span>
                        <span className="text-[10px] text-gray-600 border border-gray-700 px-2 py-0.5 rounded">Em breve</span>
                    </div>
                </div>

                {/* Insight 4: Placeholder Onboarding */}
                <div className="bg-gray-900 border border-white/10 rounded-xl p-5 flex flex-col justify-between opacity-50">
                    <div>
                        <div className="flex items-center gap-2 text-gray-500 mb-2">
                            <FileText className="w-4 h-4" />
                            <h3 className="text-sm font-semibold uppercase tracking-wider">Onboarding Travado</h3>
                        </div>
                        <p className="text-gray-500 text-sm">Orgs com muitos rascunhos e zero publicados.</p>
                    </div>
                    <div className="mt-4 flex items-end justify-between">
                        <span className="text-3xl font-bold text-gray-600">—</span>
                        <span className="text-[10px] text-gray-600 border border-gray-700 px-2 py-0.5 rounded">Em breve</span>
                    </div>
                </div>
            </div>
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const styles: Record<string, string> = {
        'PUBLISHED': 'bg-green-500/10 text-green-500 border-green-500/20',
        'DRAFT': 'bg-gray-700/50 text-gray-400 border-gray-600',
        'ENDED': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        'CANCELLED': 'bg-red-500/10 text-red-500 border-red-500/20',
    };

    const labels: Record<string, string> = {
        'PUBLISHED': 'PUBLICADO',
        'DRAFT': 'RASCUNHO',
        'ENDED': 'ENCERRADO',
        'CANCELLED': 'CANCELADO',
    };

    return (
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold border ${styles[status] || styles['DRAFT']}`}>
            {labels[status] || status}
        </span>
    );
}

function HealthBadge({ status }: { status: string }) {
    if (status === 'CRITICAL') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-red-500 text-white text-xs font-bold animate-pulse">
                <AlertTriangle className="w-3 h-3 fill-current" />
                CRÍTICO
            </span>
        );
    }
    if (status === 'ATTENTION') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-amber-500/20 text-amber-500 text-xs font-bold border border-amber-500/30">
                <AlertTriangle className="w-3 h-3" />
                ATENÇÃO
            </span>
        );
    }
    if (status === 'POOR_PERFORMANCE') {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-gray-700 text-gray-300 text-xs font-bold">
                <TrendingDown className="w-3 h-3" />
                BAIXO RETORNO
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded bg-green-500/10 text-green-500 text-xs font-bold border border-green-500/20">
            <CheckCircle className="w-3 h-3" />
            OK
        </span>
    );
}
