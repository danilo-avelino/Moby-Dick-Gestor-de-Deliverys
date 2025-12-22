import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { formatNumber, formatPercent } from '../../../lib/utils';
import {
    LayoutDashboard, TrendingUp, TrendingDown, Scale,
    Calendar, Filter, AlertTriangle
} from 'lucide-react';

export function PortioningDashboard() {
    const today = new Date();
    const [month, setMonth] = useState(today.getMonth() + 1);
    const [year, setYear] = useState(today.getFullYear());
    const [processId, setProcessId] = useState('');
    const [supplierId, setSupplierId] = useState('');

    // Fetch Auxiliary Data (Processes & Suppliers)
    const { data: processesData } = useQuery({
        queryKey: ['portioning-processes-list'],
        queryFn: async () => {
            const res = await api.get('/api/portioning/processes');
            return res.data;
        }
    });

    const { data: suppliersData } = useQuery({
        queryKey: ['suppliers-list'],
        queryFn: async () => {
            const res = await api.get('/api/suppliers');
            return res.data;
        }
    });

    const processes = processesData?.data || [];
    const suppliers = suppliersData?.data || [];

    // Fetch Dashboard Data
    const { data: dashboardData, isLoading } = useQuery({
        queryKey: ['portioning-dashboard', month, year, processId, supplierId],
        queryFn: async () => {
            const params: any = { month, year };
            if (processId) params.processId = processId;
            if (supplierId) params.supplierId = supplierId;

            const res = await api.get('/api/portioning/dashboard', { params });
            return res.data;
        }
    });

    const kpis = dashboardData?.data?.kpis;
    const batches = dashboardData?.data?.batches || [];

    // Helper for visual indicators
    const getAccuracyColor = (acc: number) => {
        if (acc < 95) return 'text-red-400';
        if (acc > 105) return 'text-blue-400';
        return 'text-emerald-400'; // Green
    };

    const getAccuracyBagde = (acc: number) => {
        if (acc < 95) return 'bg-red-500/10 text-red-400 border-red-500/20';
        if (acc > 105) return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    };

    if (isLoading) {
        return <div className="p-12 text-center text-gray-500">Carregando indicadores...</div>;
    }

    return (
        <div className="space-y-6">
            {/* Filters & Header */}
            <div className="flex flex-col xl:flex-row items-start xl:items-center justify-between gap-4">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                    <LayoutDashboard className="w-5 h-5 text-primary-400" />
                    Visão Geral de Porcionamento
                </h3>

                <div className="flex flex-col sm:flex-row gap-3 w-full xl:w-auto">
                    {/* Filter Group 1: Process & Supplier */}
                    <div className="flex items-center gap-2 bg-gray-900/50 p-1 rounded-lg border border-white/10 flex-1 sm:flex-none">
                        <Filter className="w-4 h-4 text-gray-400 ml-2" />

                        <select
                            value={processId}
                            onChange={e => setProcessId(e.target.value)}
                            className="bg-transparent text-sm text-white focus:outline-none py-1 max-w-[140px] truncate"
                        >
                            <option value="" className="bg-gray-800">Todos os Processos</option>
                            {processes.map((p: any) => (
                                <option key={p.id} value={p.id} className="bg-gray-800">{p.name}</option>
                            ))}
                        </select>
                        <div className="w-px h-4 bg-white/10 mx-1" />
                        <select
                            value={supplierId}
                            onChange={e => setSupplierId(e.target.value)}
                            className="bg-transparent text-sm text-white focus:outline-none py-1 pr-2 max-w-[140px] truncate"
                        >
                            <option value="" className="bg-gray-800">Todos os Fornecedores</option>
                            {suppliers.map((s: any) => (
                                <option key={s.id} value={s.id} className="bg-gray-800">
                                    {s.tradeName || s.name}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Filter Group 2: Date */}
                    <div className="flex items-center gap-2 bg-gray-900/50 p-1 rounded-lg border border-white/10 flex-1 sm:flex-none">
                        <Calendar className="w-4 h-4 text-gray-400 ml-2" />
                        <select
                            value={month}
                            onChange={e => setMonth(parseInt(e.target.value))}
                            className="bg-transparent text-sm text-white focus:outline-none py-1"
                        >
                            {Array.from({ length: 12 }, (_, i) => (
                                <option key={i + 1} value={i + 1} className="bg-gray-800">
                                    {new Date(2000, i, 1).toLocaleString('pt-BR', { month: 'long' })}
                                </option>
                            ))}
                        </select>
                        <select
                            value={year}
                            onChange={e => setYear(parseInt(e.target.value))}
                            className="bg-transparent text-sm text-white focus:outline-none py-1 pr-2"
                        >
                            {[2024, 2025, 2026].map(y => (
                                <option key={y} value={y} className="bg-gray-800">{y}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="glass-card p-6 border-l-4 border-l-primary-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Meta de Rendimento</span>
                        <Scale className="w-5 h-5 text-gray-600" />
                    </div>
                    <div className="text-2xl font-bold text-white">
                        {formatNumber(kpis?.averageTargetYield || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                    </div>
                </div>

                <div className="glass-card p-6 border-l-4 border-l-blue-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Rendimento Atingido</span>
                        <Scale className="w-5 h-5 text-gray-600" />
                    </div>
                    {/* Logic: Green if >= target, Red if < target. Comparing aggregates here. */}
                    <div className={`text-2xl font-bold ${(kpis?.averageRealYield || 0) >= (kpis?.averageTargetYield || 0) ? 'text-emerald-400' : 'text-red-400'}`}>
                        {formatNumber(kpis?.averageRealYield || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                    </div>
                </div>

                <div className="glass-card p-6 border-l-4 border-l-emerald-500">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm">Diferença da Meta</span>
                        {(kpis?.yieldDiff || 0) < 0 ? (
                            <TrendingDown className="w-5 h-5 text-red-500" />
                        ) : (
                            <TrendingUp className="w-5 h-5 text-emerald-500" />
                        )}
                    </div>
                    <div className={`text-2xl font-bold ${(kpis?.yieldDiff || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                        {(kpis?.yieldDiff || 0) > 0 ? '+' : ''}{formatNumber(kpis?.yieldDiff || 0, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                    </div>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card overflow-hidden">
                <div className="p-4 border-b border-white/10 flex justify-between items-center">
                    <h4 className="font-medium text-white">Detalhamento por Lote</h4>
                    <span className="text-xs text-gray-500">
                        Mostrando {batches.length} registro(s)
                    </span>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/5 text-gray-400 font-medium">
                            <tr>
                                <th className="p-4">Data</th>
                                <th className="p-4">Processo / Proteína</th>
                                <th className="p-4 text-right">Meta de Rendimento</th>
                                <th className="p-4 text-right">Rendimento Atingido</th>
                                <th className="p-4 text-right">Diferença</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-300">
                            {batches.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-500">
                                        Nenhum lote registrado neste período com os filtros selecionados.
                                    </td>
                                </tr>
                            ) : (
                                batches.map((batch: any) => (
                                    <tr key={batch.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            {new Date(batch.date).toLocaleDateString('pt-BR')}
                                            <div className="text-xs text-gray-500">
                                                {new Date(batch.date).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="font-medium text-white">{batch.processName}</div>
                                            <div className="text-xs text-gray-500">{batch.proteinName}</div>
                                        </td>
                                        <td className="p-4 text-right font-mono">
                                            {formatNumber(batch.targetYield, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                                        </td>
                                        <td className={`p-4 text-right font-mono font-bold ${batch.realYield >= batch.targetYield ? 'text-emerald-400' : 'text-red-400'}`}>
                                            {formatNumber(batch.realYield, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                                        </td>
                                        <td className="p-4 text-right">
                                            <span className={`px-2 py-1 rounded text-xs font-bold border ${batch.diff >= 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                                {batch.diff > 0 ? '+' : ''}{formatNumber(batch.diff, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
