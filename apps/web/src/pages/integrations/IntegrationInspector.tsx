
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import {
    Search, RefreshCw, CheckCircle, AlertCircle, Clock,
    ChevronLeft, ChevronRight, Eye, Play
} from 'lucide-react';

interface InboxItem {
    id: string;
    integrationId: string;
    source: string;
    event: string;
    status: 'PENDING' | 'PROCESSED' | 'FAILED' | 'IGNORED';
    errorMessage?: string;
    receivedAt: string;
    processedAt?: string;
    rawPayload: any;
    integration: {
        name: string;
        platform: string;
    };
}

export default function IntegrationInspector() {
    const queryClient = useQueryClient();
    const [page, setPage] = useState(1);
    const [statusFilter, setStatusFilter] = useState<string>('');
    const [selectedItem, setSelectedItem] = useState<InboxItem | null>(null);

    const { data: inboxData, isLoading, refetch } = useQuery({
        queryKey: ['integration-inbox', page, statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            params.append('page', page.toString());
            params.append('limit', '50');
            if (statusFilter) params.append('status', statusFilter);

            const res = await api.get(`/api/integrations/inbox?${params.toString()}`);
            return res.data.data as { items: InboxItem[], total: number, page: number, totalPages: number };
        }
    });

    const reprocessMutation = useMutation({
        mutationFn: async (itemId: string) => {
            await api.post(`/api/integrations/inbox/${itemId}/reprocess`);
        },
        onSuccess: () => {
            toast.success('Item reprocessado com sucesso');
            refetch();
            if (selectedItem) setSelectedItem(null);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error?.message || 'Falha ao reprocessar');
        }
    });

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Inspetor de Integrações</h1>
                    <p className="text-gray-400">Monitoramento de eventos recebidos (Inbox)</p>
                </div>
                <button onClick={() => refetch()} className="btn-ghost">
                    <RefreshCw className="w-4 h-4" /> Atualizar
                </button>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 flex gap-4">
                <select
                    className="input max-w-xs"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                >
                    <option value="">Todos os Status</option>
                    <option value="PENDING">Pendente</option>
                    <option value="PROCESSED">Processado</option>
                    <option value="FAILED">Falha</option>
                    <option value="IGNORED">Ignorado</option>
                </select>
            </div>

            {/* List */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="text-left text-xs uppercase text-gray-400 bg-white/5">
                            <tr>
                                <th className="p-4">Data/Hora</th>
                                <th className="p-4">Integração</th>
                                <th className="p-4">Evento</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/10">
                            {isLoading ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">Carregando...</td>
                                </tr>
                            ) : inboxData?.items.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-gray-400">Nenhum item encontrado</td>
                                </tr>
                            ) : (
                                inboxData?.items.map((item) => (
                                    <tr key={item.id} className="hover:bg-white/5 transition-colors">
                                        <td className="p-4 text-sm">
                                            {new Date(item.receivedAt).toLocaleString('pt-BR')}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="text-white font-medium">{item.integration?.name || 'Desconhecida'}</span>
                                                <span className="text-xs text-gray-500">{item.source}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-300">{item.event}</td>
                                        <td className="p-4">
                                            <StatusBadge status={item.status} />
                                            {item.errorMessage && (
                                                <p className="text-xs text-red-400 mt-1 max-w-xs truncate" title={item.errorMessage}>
                                                    {item.errorMessage}
                                                </p>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            <button
                                                onClick={() => setSelectedItem(item)}
                                                className="btn-ghost p-2"
                                                title="Ver Detalhes"
                                            >
                                                <Eye className="w-4 h-4 text-primary-400" />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {inboxData && inboxData.totalPages > 1 && (
                    <div className="p-4 border-t border-white/10 flex justify-between items-center">
                        <span className="text-sm text-gray-400">
                            Página {inboxData.page} de {inboxData.totalPages}
                        </span>
                        <div className="flex gap-2">
                            <button
                                disabled={page === 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                className="btn-ghost disabled:opacity-50"
                            >
                                <ChevronLeft className="w-4 h-4" />
                            </button>
                            <button
                                disabled={page === inboxData.totalPages}
                                onClick={() => setPage(p => p + 1)}
                                className="btn-ghost disabled:opacity-50"
                            >
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            {/* Detail Modal */}
            {selectedItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="glass-card w-full max-w-4xl max-h-[90vh] flex flex-col">
                        <div className="p-6 border-b border-white/10 flex justify-between items-center">
                            <h3 className="text-xl font-bold text-white">Detalhes do Evento</h3>
                            <button onClick={() => setSelectedItem(null)} className="text-gray-400 hover:text-white">
                                Fechar
                            </button>
                        </div>

                        <div className="p-6 overflow-y-auto flex-1 space-y-6">
                            <div className="grid grid-cols-2 gap-4 text-sm">
                                <div>
                                    <p className="text-gray-400">ID</p>
                                    <p className="text-white font-mono select-all">{selectedItem.id}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400">External ID</p>
                                    <p className="text-white font-mono select-all">{selectedItem.rawPayload.id || 'N/A'}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400">Recebido em</p>
                                    <p className="text-white">{new Date(selectedItem.receivedAt).toLocaleString()}</p>
                                </div>
                                <div>
                                    <p className="text-gray-400">Processado em</p>
                                    <p className="text-white">
                                        {selectedItem.processedAt ? new Date(selectedItem.processedAt).toLocaleString() : '-'}
                                    </p>
                                </div>
                            </div>

                            <div className="p-4 bg-black/40 rounded-lg">
                                <h4 className="text-sm font-semibold text-gray-400 mb-2">Payload Raw</h4>
                                <pre className="text-xs text-green-400 font-mono overflow-x-auto whitespace-pre-wrap">
                                    {JSON.stringify(selectedItem.rawPayload, null, 2)}
                                </pre>
                            </div>

                            {selectedItem.errorMessage && (
                                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                                    <h4 className="text-sm font-semibold text-red-400 mb-1">Erro</h4>
                                    <p className="text-sm text-red-300">{selectedItem.errorMessage}</p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                            <button onClick={() => setSelectedItem(null)} className="btn-ghost">
                                Fechar
                            </button>
                            <button
                                onClick={() => reprocessMutation.mutate(selectedItem.id)}
                                disabled={reprocessMutation.isPending}
                                className="btn-primary flex items-center gap-2"
                            >
                                {reprocessMutation.isPending ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                                Reprocessar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatusBadge({ status }: { status: string }) {
    const config: Record<string, { color: string; icon: any; label: string }> = {
        PROCESSED: { color: 'green', icon: CheckCircle, label: 'Processado' },
        PENDING: { color: 'yellow', icon: Clock, label: 'Pendente' },
        FAILED: { color: 'red', icon: AlertCircle, label: 'Falha' },
        IGNORED: { color: 'gray', icon: AlertCircle, label: 'Ignorado' },
    };

    const cfg = config[status] || config.PENDING;
    const Icon = cfg.icon;

    return (
        <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-${cfg.color}-500/10 text-${cfg.color}-400 border border-${cfg.color}-500/20`}>
            <Icon className="w-3 h-3" />
            {cfg.label}
        </span>
    );
}
