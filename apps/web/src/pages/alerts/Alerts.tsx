import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatRelativeTime } from '../../lib/utils';
import { Bell, Check, AlertTriangle, TrendingUp, Package, Target, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

const alertIcons: Record<string, React.ElementType> = {
    STOCK_LOW: Package,
    EXPIRING_SOON: AlertTriangle,
    CMV_HIGH: TrendingUp,
    COST_INCREASE: TrendingUp,
    GOAL_ACHIEVED: Target,
};

const severityColors: Record<string, string> = {
    CRITICAL: 'border-l-red-500 bg-red-500/5',
    HIGH: 'border-l-orange-500 bg-orange-500/5',
    MEDIUM: 'border-l-yellow-500 bg-yellow-500/5',
    LOW: 'border-l-blue-500 bg-blue-500/5',
};

export default function Alerts() {
    const queryClient = useQueryClient();

    const { data, isLoading } = useQuery({
        queryKey: ['alerts'],
        queryFn: () => api.get('/api/alerts').then((r) => r.data.data),
    });

    const markRead = useMutation({
        mutationFn: (id: string) => api.patch(`/api/alerts/${id}/read`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    });

    const markAllRead = useMutation({
        mutationFn: () => api.post('/api/alerts/mark-all-read'),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['alerts'] });
            toast.success('Todos os alertas marcados como lidos');
        },
    });

    const deleteAlert = useMutation({
        mutationFn: (id: string) => api.delete(`/api/alerts/${id}`),
        onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
    });

    const alerts = data?.data || [];
    const unreadCount = data?.unreadCount || 0;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Alertas</h1>
                    <p className="text-gray-400">{unreadCount} não lido(s)</p>
                </div>
                {unreadCount > 0 && (
                    <button onClick={() => markAllRead.mutate()} className="btn-ghost">
                        <Check className="w-5 h-5" /> Marcar todos como lidos
                    </button>
                )}
            </div>

            {isLoading ? (
                <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                        <div key={i} className="glass-card animate-pulse"><div className="h-4 bg-gray-700 rounded w-2/3" /></div>
                    ))}
                </div>
            ) : alerts.length === 0 ? (
                <div className="glass-card text-center py-12">
                    <Bell className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400">Nenhum alerta no momento</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {alerts.map((alert: any) => {
                        const Icon = alertIcons[alert.type] || Bell;
                        return (
                            <div
                                key={alert.id}
                                className={`glass-card border-l-4 ${severityColors[alert.severity]} ${alert.isRead ? 'opacity-60' : ''}`}
                            >
                                <div className="flex items-start gap-4">
                                    <div className={`p-3 rounded-xl ${alert.severity === 'CRITICAL' ? 'bg-red-500/20' : 'bg-white/10'}`}>
                                        <Icon className={`w-5 h-5 ${alert.severity === 'CRITICAL' ? 'text-red-400' : 'text-gray-400'}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <h3 className="font-medium text-white">{alert.title}</h3>
                                                <p className="text-sm text-gray-400 mt-1">{alert.message}</p>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {!alert.isRead && (
                                                    <button
                                                        onClick={() => markRead.mutate(alert.id)}
                                                        className="p-2 hover:bg-white/10 rounded-lg"
                                                        title="Marcar como lido"
                                                    >
                                                        <Check className="w-4 h-4 text-gray-400" />
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => deleteAlert.mutate(alert.id)}
                                                    className="p-2 hover:bg-red-500/20 rounded-lg"
                                                    title="Excluir"
                                                >
                                                    <Trash2 className="w-4 h-4 text-gray-400" />
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">{formatRelativeTime(alert.createdAt)}</p>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
