import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import {
    ShoppingCart, Plus, Settings, RefreshCw, Loader2, ChevronRight,
    Package, Calendar, AlertTriangle, CheckCircle, Clock, X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

interface PurchaseList {
    id: string;
    triggerType: 'MANUAL' | 'POS_INVENTARIO' | 'ESTOQUE_CRITICO' | 'DATA_FIXA';
    description: string | null;
    status: 'ABERTA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
    createdAt: string;
    completedAt: string | null;
    _count: { items: number };
    createdBy: { firstName: string; lastName: string };
}

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    ABERTA: { label: 'Aberta', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    EM_ANDAMENTO: { label: 'Em Andamento', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    CONCLUIDA: { label: 'Concluída', color: 'text-green-400', bg: 'bg-green-500/20' },
    CANCELADA: { label: 'Cancelada', color: 'text-red-400', bg: 'bg-red-500/20' },
};

const triggerConfig: Record<string, { label: string; icon: any }> = {
    MANUAL: { label: 'Manual', icon: ShoppingCart },
    POS_INVENTARIO: { label: 'Pós Inventário', icon: Package },
    ESTOQUE_CRITICO: { label: 'Estoque Crítico', icon: AlertTriangle },
    DATA_FIXA: { label: 'Agenda', icon: Calendar },
};

export default function PurchaseLists() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [statusFilter, setStatusFilter] = useState('');
    const [showGenerateModal, setShowGenerateModal] = useState(false);
    const [showConfigModal, setShowConfigModal] = useState(false);
    const [generateDescription, setGenerateDescription] = useState('');

    // Fetch purchase lists
    const { data, isLoading } = useQuery({
        queryKey: ['purchase-lists', statusFilter],
        queryFn: async () => {
            const params = new URLSearchParams();
            if (statusFilter) params.set('status', statusFilter);
            const res = await api.get(`/api/purchase-lists?${params}`);
            return res.data.data;
        },
    });

    // Fetch config
    const { data: config } = useQuery({
        queryKey: ['purchase-config'],
        queryFn: async () => {
            const res = await api.get('/api/purchase-config');
            return res.data.data;
        },
    });

    // Generate mutation
    const generateMutation = useMutation({
        mutationFn: async () => {
            const res = await api.post('/api/purchase-lists/generate', {
                description: generateDescription || undefined
            });
            return res.data;
        },
        onSuccess: (data) => {
            if (data.data) {
                toast.success(`Lista criada com ${data.data.items.length} itens`);
                navigate(`/purchases/${data.data.id}`);
            } else {
                toast.success(data.message || 'Nenhum produto precisa de reposição');
            }
            queryClient.invalidateQueries({ queryKey: ['purchase-lists'] });
            setShowGenerateModal(false);
            setGenerateDescription('');
        },
        onError: () => {
            toast.error('Erro ao gerar lista');
        }
    });

    // Update config mutation
    const updateConfigMutation = useMutation({
        mutationFn: async (newConfig: any) => {
            await api.put('/api/purchase-config', newConfig);
        },
        onSuccess: () => {
            toast.success('Configurações salvas');
            queryClient.invalidateQueries({ queryKey: ['purchase-config'] });
            setShowConfigModal(false);
        }
    });

    const lists: PurchaseList[] = data?.data || [];

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                        <ShoppingCart className="w-7 h-7 text-primary-400" />
                        Lista de Compras
                    </h1>
                    <p className="text-gray-400">Gerencie suas listas de compras e reposição de estoque</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowConfigModal(true)}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <Settings className="w-4 h-4" />
                        Configurações
                    </button>
                    <button
                        onClick={() => setShowGenerateModal(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-5 h-5" />
                        Gerar Lista de Compras
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="flex gap-4">
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="input w-48"
                >
                    <option value="">Todos os status</option>
                    <option value="ABERTA">Abertas</option>
                    <option value="EM_ANDAMENTO">Em Andamento</option>
                    <option value="CONCLUIDA">Concluídas</option>
                    <option value="CANCELADA">Canceladas</option>
                </select>
            </div>

            {/* Lists */}
            <div className="card">
                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
                    </div>
                ) : lists.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-500">
                        <Package className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium">Nenhuma lista de compras encontrada</p>
                        <p className="text-sm">Clique em "Gerar Lista de Compras" para criar uma</p>
                    </div>
                ) : (
                    <div className="divide-y divide-white/5">
                        {lists.map((list) => {
                            const statusInfo = statusConfig[list.status];
                            const triggerInfo = triggerConfig[list.triggerType];
                            const TriggerIcon = triggerInfo?.icon || ShoppingCart;

                            return (
                                <div
                                    key={list.id}
                                    onClick={() => navigate(`/purchases/${list.id}`)}
                                    className="p-4 hover:bg-white/5 cursor-pointer flex items-center justify-between gap-4"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="p-2 rounded-lg bg-primary-500/20">
                                            <TriggerIcon className="w-5 h-5 text-primary-400" />
                                        </div>
                                        <div>
                                            <h3 className="font-medium text-white">
                                                {list.description || `Lista de ${formatDate(list.createdAt)}`}
                                            </h3>
                                            <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                                                <span>{triggerInfo?.label}</span>
                                                <span>•</span>
                                                <span>{list._count.items} itens</span>
                                                <span>•</span>
                                                <span>Por {list.createdBy.firstName}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-4">
                                        <span className={cn('px-2 py-1 rounded text-xs font-medium', statusInfo.bg, statusInfo.color)}>
                                            {statusInfo.label}
                                        </span>
                                        <span className="text-sm text-gray-400">
                                            {formatDate(list.createdAt)}
                                        </span>
                                        <ChevronRight className="w-5 h-5 text-gray-500" />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Generate Modal */}
            {showGenerateModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-gray-900 rounded-xl w-full max-w-md p-6">
                        <h2 className="text-xl font-bold text-white mb-4">Gerar Lista de Compras</h2>
                        <p className="text-gray-400 mb-4">
                            Uma nova lista será gerada com todos os produtos que estão abaixo do ponto de reposição.
                        </p>
                        <div className="mb-4">
                            <label className="block text-sm text-gray-400 mb-2">Descrição (opcional)</label>
                            <input
                                type="text"
                                value={generateDescription}
                                onChange={(e) => setGenerateDescription(e.target.value)}
                                placeholder="Ex: Lista semanal, Reposição urgente..."
                                className="input w-full"
                            />
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={() => setShowGenerateModal(false)}
                                className="btn-secondary flex-1"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => generateMutation.mutate()}
                                disabled={generateMutation.isPending}
                                className="btn-primary flex-1 flex items-center justify-center gap-2"
                            >
                                {generateMutation.isPending ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <RefreshCw className="w-5 h-5" />
                                )}
                                Gerar Lista
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Config Modal */}
            {showConfigModal && config && (
                <ConfigModal
                    config={config}
                    onClose={() => setShowConfigModal(false)}
                    onSave={(newConfig) => updateConfigMutation.mutate(newConfig)}
                    isPending={updateConfigMutation.isPending}
                />
            )}
        </div>
    );
}

// Config Modal Component
function ConfigModal({
    config,
    onClose,
    onSave,
    isPending
}: {
    config: any;
    onClose: () => void;
    onSave: (config: any) => void;
    isPending: boolean;
}) {
    const [triggerPostInventory, setTriggerPostInventory] = useState(config.triggerPostInventory);
    const [triggerCriticalStock, setTriggerCriticalStock] = useState(config.triggerCriticalStock);
    const [criticalStockPercentage, setCriticalStockPercentage] = useState(config.criticalStockPercentage);
    const [triggerFixedDates, setTriggerFixedDates] = useState(config.triggerFixedDates);
    const [recurrenceType, setRecurrenceType] = useState(config.recurrenceType || 'NENHUM');
    const [weekDays, setWeekDays] = useState<number[]>(config.weekDays || []);
    const [monthDays, setMonthDays] = useState<number[]>(config.monthDays || []);

    const handleSave = () => {
        onSave({
            triggerPostInventory,
            triggerCriticalStock,
            criticalStockPercentage,
            triggerFixedDates,
            recurrenceType,
            weekDays,
            monthDays
        });
    };

    const dayNames = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
                <h2 className="text-xl font-bold text-white mb-6">Configurações de Compras Automáticas</h2>

                {/* Post-Inventory */}
                <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={triggerPostInventory}
                            onChange={(e) => setTriggerPostInventory(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500"
                        />
                        <div>
                            <span className="text-white font-medium">Gerar lista após inventário</span>
                            <p className="text-sm text-gray-400">Automaticamente cria uma lista de compras ao concluir um inventário</p>
                        </div>
                    </label>
                </div>

                {/* Critical Stock */}
                <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer mb-3">
                        <input
                            type="checkbox"
                            checked={triggerCriticalStock}
                            onChange={(e) => setTriggerCriticalStock(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500"
                        />
                        <div>
                            <span className="text-white font-medium">Alertar estoque crítico</span>
                            <p className="text-sm text-gray-400">Alerta quando itens ficam abaixo do limite crítico</p>
                        </div>
                    </label>
                    {triggerCriticalStock && (
                        <div className="ml-8 mt-3">
                            <label className="block text-sm text-gray-400 mb-1">
                                Percentual abaixo do ponto de reposição
                            </label>
                            <div className="flex items-center gap-2">
                                <input
                                    type="number"
                                    value={criticalStockPercentage}
                                    onChange={(e) => setCriticalStockPercentage(parseFloat(e.target.value))}
                                    className="input w-24"
                                    min={0}
                                    max={100}
                                />
                                <span className="text-gray-400">%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Padrão: 20%. Estoque crítico = Ponto de reposição × {(100 - criticalStockPercentage) / 100}
                            </p>
                        </div>
                    )}
                </div>

                {/* Fixed Dates */}
                <div className="mb-6 p-4 bg-gray-800/50 rounded-lg">
                    <label className="flex items-center gap-3 cursor-pointer mb-3">
                        <input
                            type="checkbox"
                            checked={triggerFixedDates}
                            onChange={(e) => setTriggerFixedDates(e.target.checked)}
                            className="w-5 h-5 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500"
                        />
                        <div>
                            <span className="text-white font-medium">Gerar em datas fixas</span>
                            <p className="text-sm text-gray-400">Cria lista automaticamente em dias configurados</p>
                        </div>
                    </label>
                    {triggerFixedDates && (
                        <div className="ml-8 mt-3 space-y-4">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Tipo de recorrência</label>
                                <select
                                    value={recurrenceType}
                                    onChange={(e) => setRecurrenceType(e.target.value)}
                                    className="input w-full"
                                >
                                    <option value="NENHUM">Nenhum</option>
                                    <option value="SEMANAL">Semanal</option>
                                    <option value="MENSAL">Mensal</option>
                                </select>
                            </div>

                            {recurrenceType === 'SEMANAL' && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Dias da semana</label>
                                    <div className="flex gap-2">
                                        {dayNames.map((day, idx) => (
                                            <button
                                                key={idx}
                                                onClick={() => {
                                                    if (weekDays.includes(idx)) {
                                                        setWeekDays(weekDays.filter(d => d !== idx));
                                                    } else {
                                                        setWeekDays([...weekDays, idx]);
                                                    }
                                                }}
                                                className={cn(
                                                    'px-3 py-1 rounded text-sm font-medium',
                                                    weekDays.includes(idx)
                                                        ? 'bg-primary-500 text-white'
                                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                                )}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {recurrenceType === 'MENSAL' && (
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Dias do mês</label>
                                    <div className="flex flex-wrap gap-1">
                                        {Array.from({ length: 31 }, (_, i) => i + 1).map((day) => (
                                            <button
                                                key={day}
                                                onClick={() => {
                                                    if (monthDays.includes(day)) {
                                                        setMonthDays(monthDays.filter(d => d !== day));
                                                    } else {
                                                        setMonthDays([...monthDays, day]);
                                                    }
                                                }}
                                                className={cn(
                                                    'w-8 h-8 rounded text-sm font-medium',
                                                    monthDays.includes(day)
                                                        ? 'bg-primary-500 text-white'
                                                        : 'bg-gray-700 text-gray-400 hover:bg-gray-600'
                                                )}
                                            >
                                                {day}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <p className="text-xs text-yellow-400 flex items-center gap-1">
                                <AlertTriangle className="w-3 h-3" />
                                Nota: A geração automática por data requer configuração de job scheduler (TODO)
                            </p>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                    <button onClick={onClose} className="btn-secondary flex-1">
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isPending}
                        className="btn-primary flex-1 flex items-center justify-center gap-2"
                    >
                        {isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle className="w-5 h-5" />}
                        Salvar Configurações
                    </button>
                </div>
            </div>
        </div>
    );
}
