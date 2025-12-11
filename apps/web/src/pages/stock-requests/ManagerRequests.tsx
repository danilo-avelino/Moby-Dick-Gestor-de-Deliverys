import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Printer, X, Search, Filter, Calendar, MessageSquare, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate, formatNumber, cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth';

export default function ManagerRequests() {
    const { user } = useAuthStore();
    const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [searchTerm, setSearchTerm] = useState('');

    const { data: requests, isLoading } = useQuery({
        queryKey: ['stock-requests'],
        queryFn: () => api.get('/api/stock-requests').then(r => r.data.data),
    });

    const filteredRequests = requests?.filter((req: any) => {
        const matchesStatus = filterStatus === 'all' || req.status === filterStatus.toUpperCase();
        const matchesSearch =
            req.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            req.createdBy?.firstName?.toLowerCase().includes(searchTerm.toLowerCase());
        return matchesStatus && matchesSearch;
    });

    return (
        <div className="space-y-6 animate-fade-in pl-0 sm:pl-0">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Gerenciamento de Requisições</h1>
                    <p className="text-gray-400">Aprovação e controle de pedidos internos</p>
                </div>

                {/* Search Bar */}
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por código ou solicitante..."
                        className="input pl-10 w-full md:w-64"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2">
                <Filter className="w-5 h-5 text-gray-500 mr-2 shrink-0" />
                <button
                    onClick={() => setFilterStatus('all')}
                    className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                        filterStatus === 'all' ? "bg-white text-black" : "bg-white/5 text-gray-400 hover:text-white"
                    )}
                >
                    Todas
                </button>
                <button
                    onClick={() => setFilterStatus('pending')}
                    className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2",
                        filterStatus === 'pending' ? "bg-amber-500 text-black" : "bg-white/5 text-amber-500 hover:bg-white/10"
                    )}
                >
                    Pendentes
                    {requests?.some((r: any) => r.status === 'PENDING') && (
                        <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    )}
                </button>
                <button
                    onClick={() => setFilterStatus('approved')}
                    className={cn(
                        "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                        filterStatus === 'approved' ? "bg-green-500 text-black" : "bg-white/5 text-green-500 hover:bg-white/10"
                    )}
                >
                    Aprovadas
                </button>
            </div>

            {/* List */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left p-4 text-gray-400">Código</th>
                                <th className="text-left p-4 text-gray-400">Data</th>
                                <th className="text-left p-4 text-gray-400">Solicitante</th>
                                <th className="text-left p-4 text-gray-400">Status</th>
                                <th className="text-left p-4 text-gray-400">Itens</th>
                                <th className="text-right p-4 text-gray-400">Ação</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Carregando...</td></tr>
                            ) : filteredRequests?.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-gray-500">Nenhuma requisição encontrada.</td></tr>
                            ) : (
                                filteredRequests?.map((req: any) => (
                                    <tr key={req.id} className="hover:bg-white/5 border-b border-white/5 last:border-0 transition-colors">
                                        <td className="p-4 font-mono text-primary-400 font-medium">{req.code}</td>
                                        <td className="p-4 text-gray-300">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4 text-gray-600" />
                                                {formatDate(req.createdAt)}
                                            </div>
                                        </td>
                                        <td className="p-4 text-white font-medium">
                                            {req.createdBy?.firstName} {req.createdBy?.lastName}
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded text-xs font-bold uppercase tracking-wider",
                                                req.status === 'APPROVED' ? "bg-green-500/20 text-green-400" :
                                                    req.status === 'REJECTED' ? "bg-red-500/20 text-red-400" :
                                                        "bg-amber-500/20 text-amber-400"
                                            )}>
                                                {req.status === 'APPROVED' ? 'Aprovada' : req.status === 'REJECTED' ? 'Rejeitada' : 'Pendente'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-gray-400 text-sm">
                                            {req._count?.items || 0} itens
                                        </td>
                                        <td className="p-4 text-right">
                                            <button
                                                onClick={() => setSelectedRequestId(req.id)}
                                                className="btn-ghost text-xs py-1.5 px-3 uppercase tracking-wider font-bold"
                                            >
                                                Detalhes
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {selectedRequestId && (
                <DetailModal
                    requestId={selectedRequestId}
                    onClose={() => setSelectedRequestId(null)}
                    userRole={user?.role}
                />
            )}
        </div>
    );
}

function DetailModal({ requestId, onClose, userRole }: any) {
    const queryClient = useQueryClient();
    const printRef = useRef<HTMLDivElement>(null);
    const [comment, setComment] = useState('');
    const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
    const [rejectReason, setRejectReason] = useState('');
    const [approvalData, setApprovalData] = useState<Record<string, number>>({});

    const { data: request, isLoading } = useQuery({
        queryKey: ['stock-request', requestId],
        queryFn: () => api.get(`/api/stock-requests/${requestId}`).then(r => r.data.data),
    });

    const approveMutation = useMutation({
        mutationFn: (data: any) => api.post(`/api/stock-requests/${requestId}/approve`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
            queryClient.invalidateQueries({ queryKey: ['stock-request', requestId] });
            toast.success('Requisição aprovada com sucesso!');
            onClose();
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao aprovar')
    });

    const rejectMutation = useMutation({
        mutationFn: (reason: string) => api.post(`/api/stock-requests/${requestId}/reject`, { reason }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
            queryClient.invalidateQueries({ queryKey: ['stock-request', requestId] });
            toast.success('Requisição rejeitada com sucesso!');
            setIsRejectModalOpen(false);
            onClose(); // Close main modal? Or keep open? Usually close to list.
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao rejeitar')
    });

    const commentMutation = useMutation({
        mutationFn: (msg: string) => api.post(`/api/stock-requests/${requestId}/comments`, { message: msg }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-request', requestId] });
            setComment('');
            toast.success('Comentário enviado');
        }
    });

    const handlePrint = () => {
        // Use a hidden iframe or specific print styles
        window.print();
    };

    const handleApprove = () => {
        if (!confirm('Confirma a aprovação e a baixa automática do estoque?')) return;

        const itemsToApprove = request.items.map((item: any) => ({
            itemId: item.id,
            quantityApproved: approvalData[item.id] ?? item.quantityRequested
        }));
        approveMutation.mutate({ items: itemsToApprove, comment });
    };

    if (isLoading || !request) return null;

    const isPending = request.status === 'PENDING';
    const canSeeStock = userRole !== 'ESTOQUE'; // Manager/Admin/Director can see. Stock role CANNOT.
    // wait, actually Director CAN see, Stock Manager CANNOT?
    // "Para cargo ESTOQUE: Não exibir coluna de estoque atual"
    // "Para cargo DIRETOR: Se julgar adequado, pode mostrar estoque atual"
    // So logic: if role === ESTOQUE, hide. Else show (assuming others like Admin are superusers).

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-6xl h-[90vh] flex flex-col animate-scale-in shadow-2xl">

                {/* Header */}
                <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-white">{request.code}</h2>
                            <span className={cn(
                                "badge text-sm px-3 py-1",
                                request.status === 'APPROVED' ? "bg-green-500/20 text-green-400" :
                                    request.status === 'REJECTED' ? "bg-red-500/20 text-red-400" :
                                        "bg-amber-500/20 text-amber-400"
                            )}>
                                {request.status === 'APPROVED' ? 'Aprovada' : request.status === 'REJECTED' ? 'Rejeitada' : 'Pendente'}
                            </span>
                        </div>
                        <p className="text-gray-400 text-sm mt-1">
                            Solicitado por <span className="text-white font-medium">{request.createdBy?.firstName} {request.createdBy?.lastName}</span> em {formatDate(request.createdAt)}
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        {request.status === 'APPROVED' && (
                            <button onClick={handlePrint} className="btn-ghost flex items-center gap-2">
                                <Printer className="w-5 h-5" />
                                Imprimir
                            </button>
                        )}
                        <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                            <X className="w-6 h-6 text-gray-400" />
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex overflow-hidden">
                    {/* Main Content (Items Printable) */}
                    <div className="flex-1 p-6 overflow-y-auto border-r border-white/10 bg-black/20">
                        <div ref={printRef} className="print-content">
                            {/* Hidden Print Header */}
                            <div className="hidden print:block mb-8 border-b pb-4">
                                <div className="flex justify-between items-center mb-4">
                                    <h1 className="text-3xl font-bold">Requisição de Estoque</h1>
                                    <span className="text-xl font-mono border px-2 py-1">{request.code}</span>
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                    <p><strong>Solicitante:</strong> {request.createdBy?.firstName} {request.createdBy?.lastName}</p>
                                    <p><strong>Data Solicitação:</strong> {formatDate(request.createdAt)}</p>
                                    <p><strong>Aprovado por:</strong> {request.approvedBy ? `${request.approvedBy.firstName} ${request.approvedBy.lastName}` : '-'}</p>
                                    <p><strong>Data Aprovação:</strong> {request.approvedAt ? formatDate(request.approvedAt) : '-'}</p>
                                </div>
                            </div>

                            <table className="table w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left text-gray-400 pb-3 font-medium">Produto</th>
                                        <th className="text-right text-gray-400 pb-3 font-medium">Qtd. Solicitada</th>
                                        {isPending && (
                                            <th className="text-right text-gray-400 pb-3 font-medium w-32 bg-primary-500/10 rounded-t px-2">
                                                Aprovar
                                            </th>
                                        )}
                                        {!isPending && <th className="text-right text-gray-400 pb-3 font-medium">Qtd. Aprovada</th>}
                                        {canSeeStock && <th className="text-right text-gray-400 pb-3 font-medium text-xs print:hidden">Estoque Atual</th>}
                                    </tr>
                                </thead>
                                <tbody>
                                    {request.items.map((item: any) => (
                                        <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/5">
                                            <td className="py-4">
                                                <p className="font-medium text-white print:text-black">{item.productNameSnapshot}</p>
                                                {item.notes && <p className="text-xs text-yellow-400 mt-1 print:text-gray-600">Obs: {item.notes}</p>}
                                                {item.product?.sku && <p className="text-[10px] text-gray-500 print:text-gray-500">SKU: {item.product.sku}</p>}
                                            </td>
                                            <td className="py-4 text-right text-gray-300 print:text-black">
                                                {formatNumber(item.quantityRequested)} {item.unitSnapshot}
                                            </td>

                                            {isPending ? (
                                                <td className="py-4 bg-primary-500/5">
                                                    <input
                                                        type="number"
                                                        className="input text-right w-full h-8 font-bold text-green-400 border-primary-500/30 focus:border-primary-500"
                                                        placeholder={item.quantityRequested.toString()}
                                                        onChange={(e) => setApprovalData(prev => ({ ...prev, [item.id]: parseFloat(e.target.value) }))}
                                                        defaultValue={item.quantityRequested}
                                                    />
                                                </td>
                                            ) : (
                                                <td className="py-4 text-right font-bold text-green-400 print:text-black">
                                                    {formatNumber(item.quantityApproved)} {item.unitSnapshot}
                                                </td>
                                            )}

                                            {canSeeStock && (
                                                <td className="py-4 text-right text-xs text-gray-500 font-mono print:hidden">
                                                    {item.product?.currentStock !== undefined ? formatNumber(item.product.currentStock) : '---'}
                                                </td>
                                            )}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>

                            {request.chefObservation && (
                                <div className="mt-8 bg-white/5 p-4 rounded border-l-4 border-amber-500 print:border-gray-400 print:bg-gray-100">
                                    <h4 className="font-bold text-amber-500 text-sm mb-1 uppercase tracking-wider print:text-black">Observação do Chef</h4>
                                    <p className="text-white text-sm print:text-black">{request.chefObservation}</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Sidebar (Comments & Actions) - Hidden on Print */}
                    <div className="w-96 flex flex-col bg-gray-900 border-l border-white/10 print:hidden">
                        {/* Actions Panel */}
                        {isPending && (
                            <div className="p-6 border-b border-white/10 bg-primary-500/5">
                                <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-primary-400" />
                                    Aprovação
                                </h3>
                                <div className="space-y-4">
                                    <div className="text-xs text-gray-400 bg-black/20 p-3 rounded">
                                        <p>1. Verifique o estoque atual (se visível).</p>
                                        <p>2. Ajuste as quantidades se necessário.</p>
                                        <p>3. Clique em aprovar para efetivar a baixa.</p>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => setIsRejectModalOpen(true)}
                                            disabled={approveMutation.isPending || rejectMutation.isPending}
                                            className="btn-danger flex-1 justify-center shadow-lg shadow-red-500/20"
                                        >
                                            Negar
                                        </button>
                                        <button
                                            onClick={handleApprove}
                                            disabled={approveMutation.isPending || rejectMutation.isPending}
                                            className="btn-primary flex-[2] justify-center py-3 shadow-lg shadow-primary-500/20"
                                        >
                                            {approveMutation.isPending ? 'Processando...' : 'Aprovar'}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Comments Panel */}
                        <div className="flex-1 flex flex-col p-6 overflow-hidden">
                            <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                Linha do Tempo
                            </h3>

                            <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1 scrollbar-thin">
                                {request.comments?.length === 0 && <p className="text-gray-500 text-sm italic text-center py-4">Nenhum comentário registrado.</p>}
                                {request.comments?.map((c: any) => (
                                    <div key={c.id} className="bg-white/5 rounded p-3 text-sm border border-white/5">
                                        <div className="flex justify-between items-baseline mb-1">
                                            <span className="font-bold text-xs text-primary-400">{c.user?.firstName}</span>
                                            <span className="text-[10px] text-gray-500">{formatDate(c.createdAt)}</span>
                                        </div>
                                        <p className="text-gray-300 leading-relaxed">{c.message}</p>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-auto pt-4 border-t border-white/10">
                                <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Novo Comentário</label>
                                <textarea
                                    className="input w-full text-sm resize-none bg-black/20 focus:bg-black/40"
                                    rows={3}
                                    placeholder="Escreva uma observação..."
                                    value={comment}
                                    onChange={e => setComment(e.target.value)}
                                />
                                <button
                                    onClick={() => commentMutation.mutate(comment)}
                                    disabled={!comment.trim() || commentMutation.isPending}
                                    className="btn-ghost w-full mt-2 text-sm border border-white/10 hover:bg-white/5"
                                >
                                    Enviar Comentário
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <style>{`
                @media print {
                    @page { margin: 1cm; size: A4; }
                    body { background: white; color: black; }
                    body * {
                        visibility: hidden;
                    }
                    .print-content, .print-content * {
                        visibility: visible;
                    }
                    .print-content {
                        position: fixed;
                        left: 0;
                        top: 0;
                        width: 100%;
                        height: 100%;
                        color: black !important;
                        background: white;
                        padding: 20px;
                        overflow: visible;
                        
                    }
                    .print-content table { width: 100%; border-collapse: collapse; }
                    .print-content th { border-bottom: 2px solid #ddd; text-align: left; }
                    .print-content td { border-bottom: 1px solid #eee; }
                    .print-content p, .print-content h1, .print-content h2, .print-content h4 { color: black !important; }
                    .glass-card { box-shadow: none; border: none; background: white; }
                }
            `}</style>

            {/* Reject Modal */}
            {isRejectModalOpen && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-gray-900 border border-white/10 rounded-xl w-full max-w-md p-6 shadow-2xl animate-scale-in">
                        <h3 className="text-xl font-bold text-white mb-2">Rejeitar Requisição</h3>
                        <p className="text-gray-400 text-sm mb-4">É obrigatório informar o motivo da rejeição.</p>

                        <textarea
                            className="input w-full h-32 resize-none mb-4"
                            placeholder="Descreva o motivo..."
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            autoFocus
                        />

                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setIsRejectModalOpen(false)}
                                className="btn-ghost"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => rejectMutation.mutate(rejectReason)}
                                disabled={!rejectReason.trim() || rejectMutation.isPending}
                                className="btn-danger"
                            >
                                {rejectMutation.isPending ? 'Rejeitando...' : 'Confirmar Rejeição'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
