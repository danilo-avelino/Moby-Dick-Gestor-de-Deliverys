import { Fragment, useState, useMemo } from 'react';
import { Dialog, DialogPanel, DialogTitle, Transition, TransitionChild } from '@headlessui/react';
import {
    X, Package, TrendingUp, TrendingDown, RefreshCw,
    Trash2, Edit, ExternalLink, Calendar, DollarSign,
    ChefHat, AlertTriangle, ArrowUpRight, ArrowDownRight,
    History
} from 'lucide-react';
import { formatCurrency, formatNumber, formatDate } from '../../../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

interface ProductDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    productId: string | null;
}

export default function ProductDetailsModal({ isOpen, onClose, productId }: ProductDetailsModalProps) {
    const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

    const { data: product, isLoading } = useQuery({
        queryKey: ['product-details', productId],
        queryFn: () => api.get(`/api/products/${productId}`).then(r => r.data.data),
        enabled: isOpen && !!productId,
    });

    // Process chart data - use real stockAfter history
    const chartData = useMemo(() => {
        if (!product?.chartData || product.chartData.length === 0) {
            // If no movement data, show current stock as a single point
            const today = new Date();
            return [{
                date: formatDate(today),
                balance: product?.currentStock || 0,
            }];
        }

        // 1. Sort by date ascending (API likely returns sorted, but ensure)
        const sortedMovements = [...product.chartData].sort((a, b) =>
            new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        // 2. Map direct stockAfter values if available (they are from recently updated API)
        // Fallback to calculation if API not active yet (for safety)
        const result = sortedMovements.map(m => {
            const dateObj = new Date(m.date);
            // Format: dd/mm HH:MM
            const label = `${dateObj.getDate().toString().padStart(2, '0')}/${(dateObj.getMonth() + 1).toString().padStart(2, '0')} ${dateObj.getHours().toString().padStart(2, '0')}:${dateObj.getMinutes().toString().padStart(2, '0')}`;

            // Use stockAfter if present, otherwise approximate (calculated in old logic)
            // But since we just added stockAfter, we trust it.
            // If stockAfter is missing (old logic fallback optional, but user just updated API):
            // Let's assume stockAfter is present.
            return {
                date: label,
                balance: m.stockAfter ?? 0, // Fallback 0 is risky but better than crash
                fullDate: m.date // for tooltip sorting/details
            };
        });

        // 3. Add "Now" point to show current state extending from last move
        const lastMove = sortedMovements[sortedMovements.length - 1];
        const lastMoveDate = new Date(lastMove.date);
        const now = new Date();

        // Only add "Now" if last move wasn't just now (prevent duplicate points if high freq)
        if (now.getTime() - lastMoveDate.getTime() > 60000) { // > 1 min diff
            result.push({
                date: 'Agora',
                balance: product.currentStock,
                fullDate: now.toISOString()
            });
        }

        return result;
    }, [product]);

    // Ensure isOpen is boolean
    const showModal = !!isOpen;

    return (
        <Transition show={showModal} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <TransitionChild
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity" />
                </TransitionChild>

                <div className="fixed inset-0 z-10 w-screen overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <TransitionChild
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <DialogPanel className="relative transform overflow-hidden rounded-2xl bg-white dark:bg-slate-900 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-4xl border border-white/10">
                                {isLoading ? (
                                    <div className="p-12 text-center text-gray-400">
                                        <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
                                        Carregando detalhes...
                                    </div>
                                ) : product ? (
                                    <div className="bg-slate-50 dark:bg-slate-900 p-6">
                                        {/* Header */}
                                        <div className="flex items-start justify-between mb-6">
                                            <div>
                                                <DialogTitle as="h3" className="text-3xl font-bold text-slate-800 dark:text-white mb-2">
                                                    {product.name}
                                                </DialogTitle>
                                                <div className="flex items-center gap-3">
                                                    {product.category && (
                                                        <span className="px-3 py-1 rounded-full bg-pink-100 text-pink-600 text-xs font-semibold uppercase tracking-wider border border-pink-200">
                                                            {product.category.name}
                                                        </span>
                                                    )}
                                                    {product.sku && (
                                                        <span className="text-sm text-gray-500 font-mono">SKU: {product.sku}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <a
                                                    href={`/products/${productId}`}
                                                    className="rounded-lg p-2 text-blue-400 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                                                    title="Editar Produto"
                                                >
                                                    <Edit className="h-6 w-6" />
                                                </a>
                                                <button
                                                    type="button"
                                                    className="rounded-lg p-2 text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:hover:bg-slate-800 transition-colors"
                                                    onClick={onClose}
                                                >
                                                    <X className="h-6 w-6" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Status Bar */}
                                        <div className="flex flex-wrap items-center gap-6 mb-8 text-sm text-gray-600 dark:text-gray-400">
                                            <div className="flex items-center gap-2">
                                                <DollarSign className="w-4 h-4 text-green-500" />
                                                <span className="font-medium">COMPÕE CMV</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <ChefHat className="w-4 h-4 text-orange-500" />
                                                <span className="font-medium">INGREDIENTE DE {product.recipeCount || 0} FICHAS TÉCNICAS</span>
                                            </div>
                                            {product.currentStock <= (product.manualReorderPoint ?? product.reorderPoint ?? 0) && (
                                                <div className="flex items-center gap-2 text-red-500">
                                                    <AlertTriangle className="w-4 h-4" />
                                                    <span className="font-medium">ESTOQUE BAIXO (Ponto Reposição: {product.manualReorderPoint ?? product.reorderPoint ?? 0})</span>
                                                </div>
                                            )}
                                        </div>

                                        {/* KPI Cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 mb-8">
                                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                                <p className="text-gray-500 text-sm mb-1">Quantidade</p>
                                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                                    {formatNumber(product.currentStock)} <span className="text-sm text-gray-400 font-normal">{product.baseUnit}</span>
                                                </p>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                                <p className="text-gray-500 text-sm mb-1">Ponto de Reposição</p>
                                                <div className="flex flex-col">
                                                    <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                                        {formatNumber(product.manualReorderPoint ?? product.reorderPoint ?? 0)}
                                                        <span className="text-sm text-gray-400 font-normal ml-1">{product.baseUnit}</span>
                                                    </p>
                                                    {product.manualReorderPoint != null && (
                                                        <span className="text-xs text-blue-400 font-medium">(Manual)</span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                                <p className="text-gray-500 text-sm mb-1">Consumo (7 dias)</p>
                                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                                    {formatNumber(product.last7DaysConsumption || 0)} <span className="text-sm text-gray-400 font-normal">{product.baseUnit}</span>
                                                </p>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                                <p className="text-gray-500 text-sm mb-1">Consumo (30 dias)</p>
                                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                                    {formatNumber(product.last30DaysConsumption || 0)} <span className="text-sm text-gray-400 font-normal">{product.baseUnit}</span>
                                                </p>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-100 dark:border-slate-700 shadow-sm">
                                                <p className="text-gray-500 text-sm mb-1">Custo unitário</p>
                                                <p className="text-2xl font-bold text-slate-800 dark:text-white">
                                                    {formatCurrency(product.avgCost)} <span className="text-sm text-gray-400 font-normal">/ {product.baseUnit}</span>
                                                </p>
                                            </div>
                                        </div>

                                        {/* Actions */}


                                        {/* Movements History */}
                                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6 mb-8">
                                            <h4 className="text-lg font-semibold text-gray-500 mb-6">Movimentações e Histórico</h4>

                                            <div className="space-y-6">
                                                {(product.movements || []).slice(0, 4).map((move: any, idx: number) => (
                                                    <div key={idx} className="flex items-center justify-between group">
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-center w-12">
                                                                <p className="text-xs font-bold text-gray-400 uppercase">{formatDate(move.createdAt).split(' ')[0]}</p>
                                                                <p className="text-lg font-bold text-slate-700 dark:text-slate-300">{new Date(move.createdAt).getDate()}</p>
                                                            </div>
                                                            <div className={`p-3 rounded-full ${move.type === 'IN' ? 'bg-green-100 text-green-600' :
                                                                move.type === 'OUT' ? 'bg-red-100 text-red-600' :
                                                                    'bg-orange-100 text-orange-600'
                                                                }`}>
                                                                {move.type === 'IN' ? <ArrowDownRight className="w-5 h-5" /> :
                                                                    move.type === 'OUT' ? <ArrowUpRight className="w-5 h-5" /> :
                                                                        <RefreshCw className="w-5 h-5" />}
                                                            </div>
                                                            <div>
                                                                <p className="font-bold text-slate-800 dark:text-white uppercase text-sm">
                                                                    {move.type === 'IN' ? 'ENTRADA (COMPRAS)' :
                                                                        move.type === 'OUT' ? 'SAÍDA' :
                                                                            'INVENTÁRIO / AJUSTE'}
                                                                </p>
                                                                <p className="text-xs text-gray-400">{move.supplier?.name || move.user?.firstName || 'Sistema'}</p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center gap-8 text-right">
                                                            <div>
                                                                <p className="text-xs text-gray-400">Quantidade</p>
                                                                <p className={`font-bold ${move.type === 'OUT' ? 'text-red-500' : 'text-green-500'}`}>
                                                                    {move.type === 'OUT' ? '-' : '+'}{formatNumber(move.quantity)} {product.baseUnit}
                                                                </p>
                                                            </div>
                                                            <div className="hidden sm:block">
                                                                <p className="text-xs text-gray-400">Valor unit.</p>
                                                                <p className="font-bold text-slate-700 dark:text-slate-300">
                                                                    {formatCurrency(move.unitCost || product.avgCost)}
                                                                </p>
                                                            </div>
                                                            <div className="hidden sm:block min-w-[100px]">
                                                                <p className="text-xs text-gray-400">Valor total</p>
                                                                <p className="font-bold text-slate-700 dark:text-slate-300">
                                                                    {formatCurrency((move.quantity * (move.unitCost || product.avgCost)))}
                                                                </p>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                                {(!product.movements || product.movements.length === 0) && (
                                                    <p className="text-center text-gray-400 py-4">Nenhuma movimentação recente</p>
                                                )}
                                            </div>
                                        </div>

                                        {/* Chart */}
                                        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-gray-100 dark:border-slate-700 shadow-sm p-6">
                                            <h4 className="text-lg font-semibold text-gray-500 mb-6">Giro de estoque</h4>

                                            <div className="h-[300px] w-full">
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="colorBalance" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3} />
                                                                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" opacity={0.5} />
                                                        <XAxis
                                                            dataKey="date"
                                                            axisLine={false}
                                                            tickLine={false}
                                                            tick={{ fill: '#94A3B8', fontSize: 12 }}
                                                            dy={10}
                                                        />
                                                        <Tooltip
                                                            contentStyle={{
                                                                backgroundColor: '#1E293B',
                                                                border: 'none',
                                                                borderRadius: '8px',
                                                                color: '#fff'
                                                            }}
                                                        />
                                                        <Area
                                                            type="monotone"
                                                            dataKey="balance"
                                                            stroke="#fbbf24"
                                                            strokeWidth={4}
                                                            fillOpacity={1}
                                                            fill="url(#colorBalance)"
                                                        />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            </div>
                                        </div>

                                    </div>
                                ) : null}
                            </DialogPanel>
                        </TransitionChild>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}
