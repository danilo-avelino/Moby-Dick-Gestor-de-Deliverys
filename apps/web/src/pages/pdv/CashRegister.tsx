import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import {
    CreditCard, DollarSign, TrendingDown, TrendingUp, Clock,
    X, Plus, History, RefreshCw, ArrowLeft
} from 'lucide-react';
import { cn } from '../../lib/utils';

interface CashSession {
    id: string;
    status: 'ABERTO' | 'FECHADO';
    openedAt: string;
    openingBalance: number;
    closingBalance?: number;
    totalSales: number;
    totalCashSales: number;
    totalCardSales: number;
    totalPixSales: number;
    totalSangrias: number;
    totalSuprimentos: number;
    expectedBalance: number;
    difference?: number;
    openedBy: { firstName: string; lastName: string };
    movements: CashMovement[];
}

interface CashMovement {
    id: string;
    type: 'VENDA' | 'SANGRIA' | 'SUPRIMENTO' | 'AJUSTE';
    description: string;
    amount: number;
    paymentMethod?: string;
    orderCode?: string;
    createdAt: string;
    user: { firstName: string; lastName: string };
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

function formatDateTime(dateString: string): string {
    return new Date(dateString).toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
    });
}

export default function CashRegister() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [showOpenModal, setShowOpenModal] = useState(false);
    const [showCloseModal, setShowCloseModal] = useState(false);
    const [showMovementModal, setShowMovementModal] = useState<'SANGRIA' | 'SUPRIMENTO' | null>(null);
    const [typeFilter, setTypeFilter] = useState<string>('');

    // Fetch current session
    const { data: session, isLoading } = useQuery<CashSession | null>({
        queryKey: ['cash-session'],
        queryFn: async () => {
            const res = await api.get('/api/pdv/cash/current');
            return res.data.data;
        },
    });

    // Filter movements
    const filteredMovements = session?.movements.filter(m =>
        !typeFilter || m.type === typeFilter
    ) || [];

    const typeConfig: Record<string, { label: string; color: string; bg: string }> = {
        VENDA: { label: 'Venda', color: 'text-green-400', bg: 'bg-green-500/20' },
        SANGRIA: { label: 'Sangria', color: 'text-red-400', bg: 'bg-red-500/20' },
        SUPRIMENTO: { label: 'Suprimento', color: 'text-blue-400', bg: 'bg-blue-500/20' },
        AJUSTE: { label: 'Ajuste', color: 'text-yellow-400', bg: 'bg-yellow-500/20' },
    };

    if (isLoading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    // No session open
    if (!session) {
        return (
            <div className="h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-6">
                        <button
                            onClick={() => navigate('/pdv')}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                            Voltar
                        </button>
                        <div>
                            <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                                <CreditCard className="w-7 h-7 text-primary-400" />
                                Caixa
                            </h1>
                            <p className="text-gray-400 text-sm mt-1">Nenhum caixa aberto</p>
                        </div>
                    </div>
                </div>

                <div className="flex-1 flex items-center justify-center">
                    <div className="text-center">
                        <CreditCard className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                        <h2 className="text-xl font-bold text-white mb-2">Caixa Fechado</h2>
                        <p className="text-gray-400 mb-6">Abra um caixa para começar a registrar vendas</p>
                        <button
                            onClick={() => setShowOpenModal(true)}
                            className="btn-primary flex items-center gap-2 mx-auto"
                        >
                            <Plus className="w-5 h-5" />
                            ABRIR CAIXA
                        </button>
                    </div>
                </div>

                {showOpenModal && (
                    <OpenCashModal
                        onClose={() => setShowOpenModal(false)}
                        onSuccess={() => {
                            queryClient.invalidateQueries({ queryKey: ['cash-session'] });
                            setShowOpenModal(false);
                        }}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="h-full flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => navigate('/pdv')}
                        className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                        Voltar
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
                            <CreditCard className="w-7 h-7 text-primary-400" />
                            Caixa
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">
                            Aberto às {formatDateTime(session.openedAt)} por {session.openedBy.firstName}
                        </p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setShowMovementModal('SANGRIA')}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <TrendingDown className="w-4 h-4" />
                        Sangria
                    </button>
                    <button
                        onClick={() => setShowMovementModal('SUPRIMENTO')}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <TrendingUp className="w-4 h-4" />
                        Suprimento
                    </button>
                    <button
                        onClick={() => setShowCloseModal(true)}
                        className="btn-primary flex items-center gap-2"
                    >
                        <X className="w-4 h-4" />
                        FECHAR CAIXA
                    </button>
                </div>
            </div>

            <div className="flex gap-6 flex-1 min-h-0">
                {/* Movements Table */}
                <div className="flex-1 flex flex-col card">
                    {/* Filters */}
                    <div className="p-4 border-b border-white/10 flex items-center gap-4">
                        <select
                            value={typeFilter}
                            onChange={(e) => setTypeFilter(e.target.value)}
                            className="input w-48"
                        >
                            <option value="">Todos os tipos</option>
                            <option value="VENDA">Vendas</option>
                            <option value="SANGRIA">Sangrias</option>
                            <option value="SUPRIMENTO">Suprimentos</option>
                        </select>
                        <button
                            onClick={() => queryClient.invalidateQueries({ queryKey: ['cash-session'] })}
                            className="p-2 hover:bg-white/10 rounded-lg"
                        >
                            <RefreshCw className="w-4 h-4 text-gray-400" />
                        </button>
                    </div>

                    {/* Table */}
                    <div className="flex-1 overflow-y-auto">
                        <table className="w-full">
                            <thead className="bg-gray-800/50 sticky top-0">
                                <tr>
                                    <th className="text-left p-3 text-gray-400 font-medium text-sm">Data/Hora</th>
                                    <th className="text-left p-3 text-gray-400 font-medium text-sm">Descrição</th>
                                    <th className="text-right p-3 text-gray-400 font-medium text-sm">Valor</th>
                                    <th className="text-center p-3 text-gray-400 font-medium text-sm">Tipo</th>
                                    <th className="text-left p-3 text-gray-400 font-medium text-sm">Usuário</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredMovements.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-gray-500">
                                            Nenhuma movimentação encontrada
                                        </td>
                                    </tr>
                                ) : (
                                    filteredMovements.map((movement) => {
                                        const config = typeConfig[movement.type];
                                        return (
                                            <tr key={movement.id} className="border-b border-white/5 hover:bg-white/5">
                                                <td className="p-3 text-gray-400 text-sm">
                                                    {formatDateTime(movement.createdAt)}
                                                </td>
                                                <td className="p-3 text-white">
                                                    {movement.description}
                                                    {movement.orderCode && (
                                                        <span className="text-gray-500 text-sm ml-2">
                                                            #{movement.orderCode}
                                                        </span>
                                                    )}
                                                </td>
                                                <td className={cn(
                                                    'p-3 text-right font-medium',
                                                    movement.type === 'SANGRIA' ? 'text-red-400' : 'text-green-400'
                                                )}>
                                                    {movement.type === 'SANGRIA' ? '-' : '+'}{formatCurrency(movement.amount)}
                                                </td>
                                                <td className="p-3 text-center">
                                                    <span className={cn('px-2 py-1 rounded text-xs font-medium', config.bg, config.color)}>
                                                        {config.label}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-gray-400 text-sm">
                                                    {movement.user.firstName}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Summary Panel */}
                <div className="w-80 card p-4">
                    <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-primary-400" />
                        Resumo
                    </h3>

                    <div className="space-y-3">
                        <div className="flex justify-between">
                            <span className="text-gray-400">Saldo Inicial</span>
                            <span className="text-white">{formatCurrency(session.openingBalance)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Suprimentos</span>
                            <span className="text-blue-400">+{formatCurrency(session.totalSuprimentos)}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-gray-400">Sangrias</span>
                            <span className="text-red-400">-{formatCurrency(session.totalSangrias)}</span>
                        </div>

                        <div className="border-t border-white/10 pt-3">
                            <div className="flex justify-between text-lg font-bold">
                                <span className="text-white">Valor em Caixa</span>
                                <span className="text-primary-400">{formatCurrency(session.expectedBalance)}</span>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10">
                        <h4 className="text-sm font-medium text-gray-400 mb-3">Vendas por Forma de Pagamento</h4>
                        <div className="space-y-2">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Dinheiro</span>
                                <span className="text-white">{formatCurrency(session.totalCashSales)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Cartão</span>
                                <span className="text-white">{formatCurrency(session.totalCardSales)}</span>
                            </div>
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">PIX</span>
                                <span className="text-white">{formatCurrency(session.totalPixSales)}</span>
                            </div>
                            <div className="flex justify-between font-medium pt-2 border-t border-white/10">
                                <span className="text-gray-400">Total Vendas</span>
                                <span className="text-green-400">{formatCurrency(session.totalSales)}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showCloseModal && (
                <CloseCashModal
                    session={session}
                    onClose={() => setShowCloseModal(false)}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['cash-session'] });
                        setShowCloseModal(false);
                    }}
                />
            )}

            {showMovementModal && (
                <MovementModal
                    type={showMovementModal}
                    onClose={() => setShowMovementModal(null)}
                    onSuccess={() => {
                        queryClient.invalidateQueries({ queryKey: ['cash-session'] });
                        setShowMovementModal(null);
                    }}
                />
            )}
        </div>
    );
}

// Open Cash Modal
function OpenCashModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
    const [openingBalance, setOpeningBalance] = useState(0);

    const mutation = useMutation({
        mutationFn: async () => {
            await api.post('/api/pdv/cash/open', { openingBalance });
        },
        onSuccess,
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-white mb-4">Abrir Caixa</h2>
                <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">Saldo Inicial</label>
                    <input
                        type="number"
                        value={openingBalance}
                        onChange={(e) => setOpeningBalance(parseFloat(e.target.value) || 0)}
                        className="input w-full"
                        step="0.01"
                        autoFocus
                    />
                </div>
                <div className="flex gap-2">
                    <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
                    <button
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending}
                        className="btn-primary flex-1"
                    >
                        {mutation.isPending ? 'Abrindo...' : 'Abrir Caixa'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Close Cash Modal
function CloseCashModal({ session, onClose, onSuccess }: { session: CashSession; onClose: () => void; onSuccess: () => void }) {
    const [closingBalance, setClosingBalance] = useState(session.expectedBalance);

    const mutation = useMutation({
        mutationFn: async () => {
            await api.post('/api/pdv/cash/close', { closingBalance });
        },
        onSuccess,
    });

    const difference = closingBalance - session.expectedBalance;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-white mb-4">Fechar Caixa</h2>

                <div className="mb-4 p-3 bg-gray-800 rounded-lg">
                    <div className="flex justify-between text-sm mb-1">
                        <span className="text-gray-400">Valor Esperado</span>
                        <span className="text-white">{formatCurrency(session.expectedBalance)}</span>
                    </div>
                </div>

                <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">Valor Contado</label>
                    <input
                        type="number"
                        value={closingBalance}
                        onChange={(e) => setClosingBalance(parseFloat(e.target.value) || 0)}
                        className="input w-full"
                        step="0.01"
                    />
                </div>

                {difference !== 0 && (
                    <div className={cn(
                        'mb-4 p-3 rounded-lg',
                        difference > 0 ? 'bg-green-500/20' : 'bg-red-500/20'
                    )}>
                        <span className={difference > 0 ? 'text-green-400' : 'text-red-400'}>
                            Diferença: {difference > 0 ? '+' : ''}{formatCurrency(difference)}
                        </span>
                    </div>
                )}

                <div className="flex gap-2">
                    <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
                    <button
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending}
                        className="btn-primary flex-1"
                    >
                        {mutation.isPending ? 'Fechando...' : 'Fechar Caixa'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// Movement Modal
function MovementModal({ type, onClose, onSuccess }: { type: 'SANGRIA' | 'SUPRIMENTO'; onClose: () => void; onSuccess: () => void }) {
    const [amount, setAmount] = useState(0);
    const [description, setDescription] = useState('');

    const mutation = useMutation({
        mutationFn: async () => {
            await api.post('/api/pdv/cash/movements', { type, amount, description });
        },
        onSuccess,
    });

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl w-full max-w-md p-6">
                <h2 className="text-xl font-bold text-white mb-4">
                    {type === 'SANGRIA' ? 'Registrar Sangria' : 'Registrar Suprimento'}
                </h2>

                <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">Valor</label>
                    <input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(parseFloat(e.target.value) || 0)}
                        className="input w-full"
                        step="0.01"
                        autoFocus
                    />
                </div>

                <div className="mb-4">
                    <label className="block text-sm text-gray-400 mb-2">Descrição</label>
                    <input
                        type="text"
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        className="input w-full"
                        placeholder={type === 'SANGRIA' ? 'Ex: Pagamento fornecedor' : 'Ex: Troco adicional'}
                    />
                </div>

                <div className="flex gap-2">
                    <button onClick={onClose} className="btn-secondary flex-1">Cancelar</button>
                    <button
                        onClick={() => mutation.mutate()}
                        disabled={mutation.isPending || amount <= 0 || !description}
                        className="btn-primary flex-1"
                    >
                        {mutation.isPending ? 'Registrando...' : 'Confirmar'}
                    </button>
                </div>
            </div>
        </div>
    );
}
