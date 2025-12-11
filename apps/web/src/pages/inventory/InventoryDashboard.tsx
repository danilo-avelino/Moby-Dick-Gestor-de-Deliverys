import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ArrowLeft, Plus, History, Play, AlertCircle, CheckCircle } from 'lucide-react';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

export default function InventoryDashboard() {
    const navigate = useNavigate();
    const [notes, setNotes] = useState('');
    const [isStarting, setIsStarting] = useState(false);

    // Get Active Session
    const { data: activeSession, isLoading: isLoadingActive } = useQuery({
        queryKey: ['inventory-active'],
        queryFn: () => api.get('/api/inventory/active').then(r => r.data.data),
    });

    // Get History
    const { data: history, isLoading: isLoadingHistory } = useQuery({
        queryKey: ['inventory-history'],
        queryFn: () => api.get('/api/inventory/history').then(r => r.data.data),
    });

    const startMutation = useMutation({
        mutationFn: (data: { notes?: string }) => api.post('/api/inventory', data).then(r => r.data.data),
        onSuccess: (data) => {
            toast.success('Inventário iniciado!');
            setIsStarting(false);
            navigate(`/stock/inventory/${data.id}`);
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Erro ao iniciar inventário');
        }
    });

    if (isLoadingActive || isLoadingHistory) {
        return <div className="p-8 text-center text-gray-400">Carregando...</div>;
    }

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/stock" className="btn-ghost">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Inventário de Estoque</h1>
                        <p className="text-gray-400">Contagem física e ajustes de estoque</p>
                    </div>
                </div>
            </div>

            {/* Active Session Card */}
            {activeSession ? (
                <div className="glass-card border-l-4 border-l-green-500">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="flex items-center gap-2 mb-2">
                                <span className="badge badge-success animate-pulse">Em Andamento</span>
                                <span className="text-gray-400 text-sm">Iniciado em {formatDate(activeSession.startDate)}</span>
                            </div>
                            <h3 className="text-xl font-bold text-white">Inventário Ativo</h3>
                            <p className="text-gray-400">
                                {activeSession._count?.items || 0} itens mapeados para contagem.
                            </p>
                        </div>
                        <Link to={`/stock/inventory/${activeSession.id}`} className="btn-primary">
                            <Play className="w-5 h-5" /> Continuar Contagem
                        </Link>
                    </div>
                </div>
            ) : (
                <div className="glass-card">
                    <h3 className="text-lg font-semibold text-white mb-4">Iniciar Novo Inventário</h3>
                    <p className="text-gray-400 mb-6">
                        Ao iniciar um novo inventário, o sistema irá tirar uma "foto" do estoque atual.
                        Você poderá contar os itens por categoria.
                    </p>

                    {isStarting ? (
                        <div className="space-y-4 max-w-lg">
                            <div>
                                <label className="label">Observações (opcional)</label>
                                <textarea
                                    className="input"
                                    placeholder="Ex: Contagem mensal obrigatória"
                                    value={notes}
                                    onChange={e => setNotes(e.target.value)}
                                />
                            </div>
                            <div className="flex gap-2">
                                <button onClick={() => setIsStarting(false)} className="btn-ghost">Cancelar</button>
                                <button
                                    onClick={() => startMutation.mutate({ notes })}
                                    className="btn-primary"
                                    disabled={startMutation.isPending}
                                >
                                    {startMutation.isPending ? 'Iniciando...' : 'Confirmar Início'}
                                </button>
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setIsStarting(true)} className="btn-primary">
                            <Plus className="w-5 h-5" /> Iniciar Contagem
                        </button>
                    )}
                </div>
            )}

            {/* History */}
            <h3 className="text-lg font-semibold text-white mt-8 mb-4 flex items-center gap-2">
                <History className="w-5 h-5 text-gray-400" /> Histórico
            </h3>

            <div className="glass-card">
                <div className="table-container">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Data</th>
                                <th>Status</th>
                                <th>Precisão</th>
                                <th>Itens</th>
                                <th>Responsável</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(history || []).map((inv: any) => (
                                <tr key={inv.id}>
                                    <td className="text-white">{formatDate(inv.endDate || inv.startDate)}</td>
                                    <td>
                                        <span className={`badge ${inv.status === 'COMPLETED' ? 'badge-success' : 'badge-warning'}`}>
                                            {inv.status === 'COMPLETED' ? 'Finalizado' : inv.status}
                                        </span>
                                    </td>
                                    <td>
                                        <div className="flex items-center gap-2">
                                            <div className="w-16 h-2 bg-gray-700 rounded-full overflow-hidden">
                                                <div
                                                    className={`h-full ${inv.precision > 90 ? 'bg-green-500' : inv.precision > 70 ? 'bg-yellow-500' : 'bg-red-500'}`}
                                                    style={{ width: `${inv.precision}%` }}
                                                />
                                            </div>
                                            <span className="text-gray-400 text-sm">{Math.round(inv.precision)}%</span>
                                        </div>
                                    </td>
                                    <td className="text-gray-400">{inv.itemsCount} itens ({inv.itemsCorrect} corretos)</td>
                                    <td className="text-gray-400">Lucas Brouck</td> {/* Mock author logic for now locally or get from BE */}
                                </tr>
                            ))}
                            {(!history || history.length === 0) && (
                                <tr>
                                    <td colSpan={5} className="text-center py-8 text-gray-500">
                                        Nenhum inventário registrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
