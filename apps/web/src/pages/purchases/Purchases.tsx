import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency, formatNumber, formatDate } from '../../lib/utils';
import { ShoppingCart, AlertTriangle, Check, X, RefreshCw, Loader2, Brain } from 'lucide-react';
import toast from 'react-hot-toast';

const priorityColors = {
    URGENT: 'border-l-red-500 bg-red-500/10',
    HIGH: 'border-l-orange-500 bg-orange-500/10',
    MEDIUM: 'border-l-yellow-500 bg-yellow-500/10',
    LOW: 'border-l-blue-500 bg-blue-500/10',
};

export default function Purchases() {
    const queryClient = useQueryClient();

    const { data: suggestions, isLoading } = useQuery({
        queryKey: ['purchase-suggestions'],
        queryFn: () => api.get('/api/purchases/suggestions').then((r) => r.data.data),
    });

    const { data: anomalies } = useQuery({
        queryKey: ['consumption-anomalies'],
        queryFn: () => api.get('/api/purchases/anomalies').then((r) => r.data.data),
    });

    const generateMutation = useMutation({
        mutationFn: () => api.post('/api/purchases/suggestions/generate'),
        onSuccess: (res) => {
            toast.success(`${res.data.data.generated} sugestões geradas`);
            queryClient.invalidateQueries({ queryKey: ['purchase-suggestions'] });
        },
    });

    const acceptMutation = useMutation({
        mutationFn: ({ id, accepted }: { id: string; accepted: boolean }) =>
            api.patch(`/api/purchases/suggestions/${id}`, { accepted }),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['purchase-suggestions'] }),
    });

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <Brain className="w-7 h-7 text-primary-400" />
                        Compras Inteligentes
                    </h1>
                    <p className="text-gray-400">Sugestões de compra baseadas em IA</p>
                </div>
                <button
                    onClick={() => generateMutation.mutate()}
                    disabled={generateMutation.isPending}
                    className="btn-primary"
                >
                    {generateMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <RefreshCw className="w-5 h-5" />}
                    Gerar Sugestões
                </button>
            </div>

            {/* Suggestions */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4">
                    <ShoppingCart className="w-5 h-5 inline mr-2 text-primary-400" />
                    Sugestões de Compra
                </h3>
                {isLoading ? (
                    <div className="flex justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>
                ) : (suggestions || []).length === 0 ? (
                    <p className="text-gray-400 text-center py-8">Nenhuma sugestão no momento</p>
                ) : (
                    <div className="space-y-4">
                        {(suggestions || []).map((sug: any) => (
                            <div key={sug.id} className={`p-4 rounded-xl border-l-4 ${priorityColors[sug.priority as keyof typeof priorityColors]}`}>
                                <div className="flex items-start justify-between gap-4">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-medium text-white">{sug.product?.name}</h4>
                                            <span className={`badge ${sug.priority === 'URGENT' ? 'badge-danger' :
                                                    sug.priority === 'HIGH' ? 'badge-warning' : 'badge-info'
                                                }`}>
                                                {sug.priority}
                                            </span>
                                        </div>
                                        <p className="text-sm text-gray-400 mb-2">{sug.reasoning}</p>
                                        <div className="flex flex-wrap gap-4 text-sm">
                                            <span className="text-gray-400">
                                                Estoque: <span className="text-white">{formatNumber(sug.currentStock)} {sug.product?.baseUnit}</span>
                                            </span>
                                            <span className="text-gray-400">
                                                Sugestão: <span className="text-white">{formatNumber(sug.suggestedQuantity)} {sug.suggestedUnit}</span>
                                            </span>
                                            <span className="text-gray-400">
                                                Custo est.: <span className="text-white">{formatCurrency(sug.estimatedCost)}</span>
                                            </span>
                                            {sug.daysUntilRunout && (
                                                <span className={`${sug.daysUntilRunout <= 2 ? 'text-red-400' : 'text-gray-400'}`}>
                                                    Acaba em: <span className="font-medium">{sug.daysUntilRunout} dias</span>
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => acceptMutation.mutate({ id: sug.id, accepted: true })}
                                            className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400"
                                            title="Aceitar"
                                        >
                                            <Check className="w-5 h-5" />
                                        </button>
                                        <button
                                            onClick={() => acceptMutation.mutate({ id: sug.id, accepted: false })}
                                            className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/30 text-red-400"
                                            title="Rejeitar"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Anomalies */}
            {(anomalies || []).length > 0 && (
                <div className="glass-card">
                    <h3 className="text-lg font-semibold text-white mb-4">
                        <AlertTriangle className="w-5 h-5 inline mr-2 text-yellow-400" />
                        Anomalias Detectadas
                    </h3>
                    <div className="space-y-3">
                        {(anomalies || []).slice(0, 5).map((a: any) => (
                            <div key={a.id} className="p-3 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h4 className="font-medium text-white">{a.product?.name}</h4>
                                        <p className="text-sm text-gray-400">{a.aiAnalysis}</p>
                                    </div>
                                    <span className={`badge ${a.severity === 'HIGH' ? 'badge-danger' : 'badge-warning'}`}>
                                        {a.anomalyType}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
