import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatDate, formatNumber, cn } from '../../lib/utils';
import {
    ArrowLeft, Package, CheckCircle, XCircle, Clock, Loader2,
    ChevronDown, ChevronUp, AlertTriangle, Check, X, Share2
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PurchaseListItem {
    id: string;
    productId: string;
    productNameSnapshot: string;
    unitSnapshot: string;
    reorderPointSnapshot: number;
    currentStockSnapshot: number;
    suggestedQuantity: number;
    confirmedQuantity: number | null;
    status: 'PENDENTE' | 'CHEGOU' | 'PARCIAL' | 'CANCELADO';
    confirmedAt: string | null;
    confirmedBy: { firstName: string; lastName: string } | null;
    product: {
        id: string;
        name: string;
        baseUnit: string;
        imageUrl: string | null;
        currentStock: number;
        category: {
            id: string;
            name: string;
        } | null;
    };
}

interface PurchaseListDetail {
    id: string;
    triggerType: string;
    description: string | null;
    notes: string | null;
    status: 'ABERTA' | 'EM_ANDAMENTO' | 'CONCLUIDA' | 'CANCELADA';
    createdAt: string;
    completedAt: string | null;
    createdBy: { firstName: string; lastName: string };
    items: PurchaseListItem[];
}

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: any }> = {
    PENDENTE: { label: 'Pendente', color: 'text-gray-400', bg: 'bg-gray-500/20', icon: Clock },
    CHEGOU: { label: 'Chegou', color: 'text-green-400', bg: 'bg-green-500/20', icon: CheckCircle },
    PARCIAL: { label: 'Parcial', color: 'text-yellow-400', bg: 'bg-yellow-500/20', icon: AlertTriangle },
    CANCELADO: { label: 'Cancelado', color: 'text-red-400', bg: 'bg-red-500/20', icon: XCircle },
};

const listStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
    ABERTA: { label: 'Aberta', color: 'text-blue-400', bg: 'bg-blue-500/20' },
    EM_ANDAMENTO: { label: 'Em Andamento', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    CONCLUIDA: { label: 'Concluída', color: 'text-green-400', bg: 'bg-green-500/20' },
    CANCELADA: { label: 'Cancelada', color: 'text-red-400', bg: 'bg-red-500/20' },
};

export default function PurchaseListDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [expandedItem, setExpandedItem] = useState<string | null>(null);
    const [confirmQuantity, setConfirmQuantity] = useState<number>(0);

    // Fetch list details
    const { data: list, isLoading } = useQuery<PurchaseListDetail>({
        queryKey: ['purchase-list', id],
        queryFn: async () => {
            const res = await api.get(`/api/purchase-lists/${id}`);
            return res.data.data;
        },
        enabled: !!id,
    });

    // Confirm item mutation
    const confirmMutation = useMutation({
        mutationFn: async ({ itemId, quantity }: { itemId: string; quantity: number }) => {
            await api.post(`/api/purchase-lists/${id}/items/${itemId}/confirm`, {
                confirmedQuantity: quantity
            });
        },
        onSuccess: () => {
            toast.success('Entrada de estoque registrada');
            queryClient.invalidateQueries({ queryKey: ['purchase-list', id] });
            setExpandedItem(null);
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao confirmar');
        }
    });

    // Cancel item mutation
    const cancelItemMutation = useMutation({
        mutationFn: async (itemId: string) => {
            await api.delete(`/api/purchase-lists/${id}/items/${itemId}`);
        },
        onSuccess: () => {
            toast.success('Item cancelado');
            queryClient.invalidateQueries({ queryKey: ['purchase-list', id] });
        }
    });

    // Update list status mutation
    const updateStatusMutation = useMutation({
        mutationFn: async (status: string) => {
            await api.patch(`/api/purchase-lists/${id}`, { status });
        },
        onSuccess: () => {
            toast.success('Status atualizado');
            queryClient.invalidateQueries({ queryKey: ['purchase-list', id] });
            queryClient.invalidateQueries({ queryKey: ['purchase-lists'] });
        }
    });

    // WhatsApp Share Handler
    const handleShareWhatsApp = () => {
        if (!list) return;

        const title = `🛒 *Lista de Compras - ${list.description || formatDate(list.createdAt || new Date().toISOString())}*`;

        // Filter pending/partial items
        const activeItems = list.items.filter(i => i.status === 'PENDENTE' || i.status === 'PARCIAL');

        if (activeItems.length === 0) {
            toast.error('Não há itens pendentes para compartilhar');
            return;
        }

        // Group items by category (Reuse logic or duplicate for simplicity inside handler)
        const grouped = activeItems.reduce((acc, item) => {
            const cat = item.product.category?.name || 'OUTROS';
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(item);
            return acc;
        }, {} as Record<string, typeof activeItems>);

        // Sort categories including "OUTROS" at the end
        const sortedCats = Object.keys(grouped).sort((a, b) => {
            if (a === 'OUTROS') return 1;
            if (b === 'OUTROS') return -1;
            return a.localeCompare(b);
        });

        // Build message body
        let itemsText = '';
        sortedCats.forEach(cat => {
            itemsText += `\n*${cat.toUpperCase()}*\n`;
            grouped[cat].forEach(item => {
                const qtd = formatNumber(item.suggestedQuantity);
                itemsText += `- ${item.productNameSnapshot}: Compra mínima ${qtd} ${item.unitSnapshot}\n`;
            });
        });

        const footer = `\nGerado por Moby Dick em ${formatDate(new Date().toISOString())}`;
        const message = `${title}\n${itemsText}${footer}`;

        const encodedMessage = encodeURIComponent(message);
        window.open(`https://wa.me/?text=${encodedMessage}`, '_blank');
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <Loader2 className="w-8 h-8 animate-spin text-primary-500" />
            </div>
        );
    }

    if (!list) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-500">
                <XCircle className="w-16 h-16 mb-4" />
                <p>Lista não encontrada</p>
            </div>
        );
    }

    const listStatus = listStatusConfig[list.status];
    const pendingCount = list.items.filter(i => i.status === 'PENDENTE').length;
    const completedCount = list.items.filter(i => i.status === 'CHEGOU' || i.status === 'PARCIAL').length;

    // Group items by category
    const groupedItems = list.items.reduce((acc, item) => {
        const categoryName = item.product.category?.name || 'Sem Categoria';
        if (!acc[categoryName]) {
            acc[categoryName] = [];
        }
        acc[categoryName].push(item);
        return acc;
    }, {} as Record<string, PurchaseListItem[]>);

    const categories = Object.keys(groupedItems).sort((a, b) => {
        if (a === 'Sem Categoria') return 1;
        if (b === 'Sem Categoria') return -1;
        return a.localeCompare(b);
    });

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/purchases')}
                        className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            {list.description || `Lista de ${formatDate(list.createdAt)}`}
                        </h1>
                        <div className="flex items-center gap-3 text-sm text-gray-400 mt-1">
                            <span className={cn('px-2 py-0.5 rounded text-xs font-medium', listStatus.bg, listStatus.color)}>
                                {listStatus.label}
                            </span>
                            <span>Criada por {list.createdBy.firstName} em {formatDate(list.createdAt)}</span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleShareWhatsApp}
                        className="btn-secondary flex items-center gap-2 bg-green-500/10 text-green-400 hover:bg-green-500/20 border-green-500/20"
                    >
                        <Share2 className="w-4 h-4" />
                        Enviar Whatsapp
                    </button>
                    {list.status === 'ABERTA' && (
                        <button
                            onClick={() => updateStatusMutation.mutate('CANCELADA')}
                            className="btn-secondary flex items-center gap-2 text-red-400"
                        >
                            <X className="w-4 h-4" />
                            Cancelar Lista
                        </button>
                    )}
                    {(list.status === 'ABERTA' || list.status === 'EM_ANDAMENTO') && pendingCount === 0 && (
                        <button
                            onClick={() => updateStatusMutation.mutate('CONCLUIDA')}
                            className="btn-primary flex items-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Marcar como Concluída
                        </button>
                    )}
                </div>
            </div>

            {/* Summary */}
            <div className="grid grid-cols-3 gap-4">
                <div className="card p-4 text-center">
                    <div className="text-3xl font-bold text-white">{list.items.length}</div>
                    <div className="text-sm text-gray-400">Total de Itens</div>
                </div>
                <div className="card p-4 text-center">
                    <div className="text-3xl font-bold text-yellow-400">{pendingCount}</div>
                    <div className="text-sm text-gray-400">Pendentes</div>
                </div>
                <div className="card p-4 text-center">
                    <div className="text-3xl font-bold text-green-400">{completedCount}</div>
                    <div className="text-sm text-gray-400">Confirmados</div>
                </div>
            </div>

            {/* Items List */}
            <div className="card">
                <div className="p-4 border-b border-white/10">
                    <h2 className="text-lg font-semibold text-white">Itens da Lista</h2>
                </div>
                <div className="divide-y divide-white/5">
                    {list.items.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>Nenhum item na lista no momento.</p>
                        </div>
                    ) : (
                        categories.map(categoryName => (
                            <div key={categoryName}>
                                <div className="bg-gray-800/80 px-4 py-2 border-b border-white/5 flex items-center gap-2 sticky top-[72px] z-10 backdrop-blur-sm">
                                    <div className="w-1 h-4 bg-primary-500 rounded-full"></div>
                                    <h3 className="font-bold text-sm text-gray-200 uppercase tracking-wider">{categoryName}</h3>
                                    <span className="text-xs text-gray-500 bg-gray-700/50 px-2 py-0.5 rounded-full">
                                        {groupedItems[categoryName].length}
                                    </span>
                                </div>
                                <div>
                                    {groupedItems[categoryName].map((item) => {
                                        const itemStatus = statusConfig[item.status];
                                        const StatusIcon = itemStatus.icon;
                                        const isExpanded = expandedItem === item.id;

                                        return (
                                            <div key={item.id} className="group border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                                <div
                                                    className="p-4 flex items-center justify-between cursor-pointer"
                                                    onClick={() => {
                                                        if (item.status === 'PENDENTE') {
                                                            setExpandedItem(isExpanded ? null : item.id);
                                                            setConfirmQuantity(item.suggestedQuantity);
                                                        }
                                                    }}
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-lg bg-gray-700 flex items-center justify-center">
                                                            {item.product.imageUrl ? (
                                                                <img src={item.product.imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
                                                            ) : (
                                                                <Package className="w-5 h-5 text-gray-500" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-medium text-white">{item.productNameSnapshot}</h3>
                                                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                                                <span>
                                                                    Compra mínima: {formatNumber(item.suggestedQuantity)} {item.unitSnapshot}
                                                                </span>
                                                                {item.confirmedQuantity !== null && (
                                                                    <>
                                                                        <span>•</span>
                                                                        <span className="text-green-400">
                                                                            Confirmado: {formatNumber(item.confirmedQuantity)} {item.unitSnapshot}
                                                                        </span>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-4">
                                                        <span className={cn('px-2 py-1 rounded text-xs font-medium flex items-center gap-1', itemStatus.bg, itemStatus.color)}>
                                                            <StatusIcon className="w-3 h-3" />
                                                            {itemStatus.label}
                                                        </span>
                                                        {item.status === 'PENDENTE' && (
                                                            isExpanded ? (
                                                                <ChevronUp className="w-5 h-5 text-gray-500" />
                                                            ) : (
                                                                <ChevronDown className="w-5 h-5 text-gray-500" />
                                                            )
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Expanded Confirmation Panel */}
                                                {isExpanded && item.status === 'PENDENTE' && (
                                                    <div className="px-4 pb-4 pt-0">
                                                        <div className="bg-gray-800/50 rounded-lg p-4 ml-14">
                                                            <div className="grid grid-cols-3 gap-4 mb-4 text-sm">
                                                                <div>
                                                                    <span className="text-gray-400">Ponto de reposição:</span>
                                                                    <span className="ml-2 text-white">{formatNumber(item.reorderPointSnapshot)} {item.unitSnapshot}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-400">Estoque na geração:</span>
                                                                    <span className="ml-2 text-white">{formatNumber(item.currentStockSnapshot)} {item.unitSnapshot}</span>
                                                                </div>
                                                                <div>
                                                                    <span className="text-gray-400">Estoque atual:</span>
                                                                    <span className="ml-2 text-white">{formatNumber(item.product.currentStock)} {item.unitSnapshot}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-end gap-4">
                                                                <div className="flex-1">
                                                                    <label className="block text-sm text-gray-400 mb-1">
                                                                        Quantidade que chegou
                                                                    </label>
                                                                    <div className="flex items-center gap-2">
                                                                        <input
                                                                            type="number"
                                                                            value={confirmQuantity}
                                                                            onChange={(e) => setConfirmQuantity(parseFloat(e.target.value) || 0)}
                                                                            className="input w-32"
                                                                            min={0}
                                                                            step={0.01}
                                                                        />
                                                                        <span className="text-gray-400">{item.unitSnapshot}</span>
                                                                    </div>
                                                                </div>
                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            cancelItemMutation.mutate(item.id);
                                                                        }}
                                                                        className="btn-secondary text-red-400"
                                                                    >
                                                                        <X className="w-4 h-4" />
                                                                        Cancelar Item
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            confirmMutation.mutate({ itemId: item.id, quantity: confirmQuantity });
                                                                        }}
                                                                        disabled={confirmMutation.isPending || confirmQuantity <= 0}
                                                                        className="btn-primary flex items-center gap-2"
                                                                    >
                                                                        {confirmMutation.isPending ? (
                                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <Check className="w-4 h-4" />
                                                                        )}
                                                                        Confirmar Chegada
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                                {/* Confirmed info */}
                                                {item.confirmedAt && item.confirmedBy && (
                                                    <div className="px-4 pb-4 pt-0 ml-14 text-sm text-gray-500">
                                                        Confirmado por {item.confirmedBy.firstName} em {formatDate(item.confirmedAt)}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
