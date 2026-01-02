import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, MessageSquare, History, TrendingUp, Settings, Info } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { toast } from "react-hot-toast";
import { useAuthStore } from "../../../stores/auth";
import { IndicatorConfigModal } from "./IndicatorConfigModal"; // Will create next
import { cn, getInitials } from "../../../lib/utils";
import { UserRole } from "types";

interface IndicatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    indicatorId: string;
}

export function IndicatorModal({ isOpen, onClose, indicatorId }: IndicatorModalProps) {
    const [chatMessage, setChatMessage] = useState("");
    const [isConfigOpen, setIsConfigOpen] = useState(false);
    const [manualValue, setManualValue] = useState("");

    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    // Fetch details
    const { data: indicator, isLoading } = useQuery({
        queryKey: ['indicator', indicatorId],
        queryFn: () => api.get(`/api/indicators/${indicatorId}`).then(res => res.data),
        enabled: !!indicatorId && isOpen
    });

    const chatMutation = useMutation({
        mutationFn: (message: string) => api.post(`/api/indicators/${indicatorId}/chat`, { message }),
        onSuccess: () => {
            setChatMessage("");
            queryClient.invalidateQueries({ queryKey: ['indicator', indicatorId] });
            toast.success("Mensagem enviada");
        },
        onError: () => toast.error("Erro ao enviar mensagem")
    });

    const manualReadingMutation = useMutation({
        mutationFn: (data: { value: number; month: string }) => api.post('/api/dashboard/manual-readings', {
            type: indicator.type === 'MANUAL_RATING' ? 'ifoodRating' : indicator.type, // Map type
            value: data.value,
            month: data.month
        }),
        onSuccess: () => {
            setManualValue("");
            queryClient.invalidateQueries({ queryKey: ['indicator', indicatorId] });
            queryClient.invalidateQueries({ queryKey: ['indicators'] }); // Also update dashboard
            toast.success("Leitura salva com sucesso");
        },
        onError: () => toast.error("Erro ao salvar leitura")
    });

    const handleSaveManual = () => {
        if (!manualValue) return;
        const val = parseFloat(manualValue.replace(',', '.'));
        if (isNaN(val)) {
            toast.error("Valor inválido");
            return;
        }

        const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
        manualReadingMutation.mutate({ value: val, month: currentMonth });
    };

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatMessage.trim()) return;
        chatMutation.mutate(chatMessage);
    };

    const canConfigure =
        user?.role === UserRole.DIRETOR ||
        user?.role === UserRole.MANAGER ||
        user?.role === UserRole.ADMIN ||
        user?.role === UserRole.SUPER_ADMIN;

    if (!isOpen) return null;

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
                </Transition.Child>

                <div className="fixed inset-0 z-10 overflow-y-auto">
                    <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
                        <Transition.Child
                            as={Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                            enterTo="opacity-100 translate-y-0 sm:scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 translate-y-0 sm:scale-100"
                            leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
                        >
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-gray-900 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl border border-white/10">
                                {isLoading ? (
                                    <div className="p-8 flex justify-center">
                                        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Header */}
                                        <div className="bg-gray-900 px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-white/10 flex justify-between items-start">
                                            <div>
                                                <Dialog.Title as="h3" className="text-xl font-semibold leading-6 text-white">
                                                    {indicator.name}
                                                </Dialog.Title>
                                                <p className="mt-1 text-sm text-gray-400">{indicator.description}</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                {canConfigure && (
                                                    <button
                                                        onClick={() => setIsConfigOpen(true)}
                                                        className="p-2 text-gray-400 hover:text-indigo-400 transition-colors"
                                                        title="Configurar"
                                                    >
                                                        <Settings className="w-5 h-5" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="rounded-md bg-transparent text-gray-400 hover:text-white"
                                                    onClick={onClose}
                                                >
                                                    <span className="sr-only">Close</span>
                                                    <X className="h-6 w-6" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Content */}
                                        <div className="p-6 max-h-[85vh] overflow-y-auto">
                                            {/* Details Section */}
                                            <div className="space-y-6 mb-8">
                                                <div className="grid grid-cols-2 gap-4">
                                                    <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                                                        <p className="text-sm font-medium text-gray-400">Resultado Atual</p>
                                                        <p className="text-3xl font-bold text-white mt-2">{indicator.currentValue?.toLocaleString('pt-BR')}</p>
                                                    </div>
                                                    <div className="p-4 bg-white/5 rounded-lg border border-white/5">
                                                        <p className="text-sm font-medium text-gray-400">Meta ({indicator.cycle})</p>
                                                        <p className="text-3xl font-bold text-white mt-2">{indicator.targetValue?.toLocaleString('pt-BR')}</p>
                                                    </div>
                                                </div>

                                                {indicator.type === 'MANUAL_RATING' ? (
                                                    <div className="bg-indigo-500/10 border border-indigo-500/20 rounded-lg p-4">
                                                        <div className="flex items-center justify-between mb-2">
                                                            <p className="text-sm font-medium text-indigo-300">Lançamento Manual ({new Date().toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })})</p>
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="number"
                                                                step="0.1"
                                                                placeholder="Digite o valor..."
                                                                className="flex-1 bg-gray-900/50 border border-white/10 rounded-lg px-3 py-2 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                                value={manualValue}
                                                                onChange={(e) => setManualValue(e.target.value)}
                                                            />
                                                            <button
                                                                onClick={handleSaveManual}
                                                                disabled={manualReadingMutation.isPending || !manualValue}
                                                                className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {manualReadingMutation.isPending ? 'Salvando...' : 'Salvar'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <div className="flex justify-between items-center bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-lg p-4 text-sm">
                                                        <div className="flex items-start">
                                                            <Info className="w-5 h-5 mr-3 flex-shrink-0 mt-0.5" />
                                                            <p>Os dados são coletados automaticamente. Lançamentos manuais proibidos.</p>
                                                        </div>

                                                        <div className="flex -space-x-2 overflow-hidden ml-4">
                                                            {indicator.access?.map((access: any) => (
                                                                <div key={access.user.id} className="relative inline-block h-8 w-8 rounded-full ring-2 ring-gray-900 bg-gray-800 flex items-center justify-center text-xs font-bold text-gray-400" title={`${access.user.firstName} ${access.user.lastName}`}>
                                                                    {access.user.avatarUrl ? (
                                                                        <img className="h-full w-full rounded-full object-cover" src={access.user.avatarUrl} alt="" />
                                                                    ) : getInitials(access.user.firstName, access.user.lastName)}
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Grid layout for History and Chat */}
                                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 border-t border-white/10 pt-8">
                                                {/* History Section */}
                                                <div>
                                                    <div className="flex items-center mb-4">
                                                        <History className="w-5 h-5 text-indigo-400 mr-2" />
                                                        <h4 className="text-lg font-medium text-white">Histórico</h4>
                                                    </div>
                                                    <div className="flow-root max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                                        <ul role="list" className="-mb-8">
                                                            {indicator.results?.map((result: any, resultIdx: number) => (
                                                                <li key={result.id}>
                                                                    <div className="relative pb-8">
                                                                        {resultIdx !== indicator.results.length - 1 ? (
                                                                            <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-white/10" aria-hidden="true" />
                                                                        ) : null}
                                                                        <div className="relative flex space-x-3">
                                                                            <div>
                                                                                <span className={cn(
                                                                                    result.value >= (result.targetSnapshot || 0) ? 'bg-emerald-500' : 'bg-red-500',
                                                                                    'h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-gray-900'
                                                                                )}>
                                                                                    <TrendingUp className="h-4 w-4 text-white" aria-hidden="true" />
                                                                                </span>
                                                                            </div>
                                                                            <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                                                                <div>
                                                                                    <p className="text-sm text-gray-400">
                                                                                        <span className="font-medium text-white">{result.value}</span>
                                                                                        <span className="mx-2 text-gray-600">|</span>
                                                                                        Meta: {result.targetSnapshot}
                                                                                    </p>
                                                                                </div>
                                                                                <div className="whitespace-nowrap text-right text-sm text-gray-500">
                                                                                    <time dateTime={result.date}>{new Date(result.date).toLocaleDateString()}</time>
                                                                                </div>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                </li>
                                                            ))}
                                                            {indicator.results?.length === 0 && (
                                                                <p className="text-center text-gray-500 py-4 text-sm">Nenhum histórico disponível.</p>
                                                            )}
                                                        </ul>
                                                    </div>
                                                </div>

                                                {/* Chat Section */}
                                                <div className="flex flex-col h-[500px] bg-white/5 rounded-lg border border-white/5 overflow-hidden">
                                                    <div className="p-4 border-b border-white/5 bg-white/5 flex items-center">
                                                        <MessageSquare className="w-4 h-4 text-gray-400 mr-2" />
                                                        <span className="text-sm font-medium text-gray-300">Comentários</span>
                                                    </div>

                                                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                                                        {indicator.comments?.map((comment: any) => (
                                                            <div key={comment.id} className="flex space-x-3">
                                                                <div className="flex-shrink-0">
                                                                    <div className="h-8 w-8 rounded-full bg-gray-800 flex items-center justify-center text-xs text-white border border-white/10">
                                                                        {getInitials(comment.user.firstName, comment.user.lastName)}
                                                                    </div>
                                                                </div>
                                                                <div className="flex-1">
                                                                    <div className="flex items-center justify-between">
                                                                        <span className="text-sm font-medium text-white">{comment.user.firstName}</span>
                                                                        <span className="text-xs text-gray-500">{new Date(comment.createdAt).toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="mt-1 text-sm text-gray-300 bg-white/5 p-2 rounded-lg rounded-tl-none">
                                                                        <p>{comment.message}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {indicator.comments?.length === 0 && (
                                                            <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm">
                                                                <MessageSquare className="w-8 h-8 mb-2 opacity-20" />
                                                                <p>Nenhuma mensagem.</p>
                                                            </div>
                                                        )}
                                                    </div>

                                                    <div className="p-4 bg-gray-900 border-t border-white/10">
                                                        <form onSubmit={handleSendMessage} className="relative">
                                                            <input
                                                                type="text"
                                                                className="block w-full rounded-full border-0 bg-white/10 py-3 pl-4 pr-12 text-white placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                                                placeholder="Escreva um comentário..."
                                                                value={chatMessage}
                                                                onChange={(e) => setChatMessage(e.target.value)}
                                                            />
                                                            <button
                                                                type="submit"
                                                                disabled={chatMutation.isPending || !chatMessage.trim()}
                                                                className="absolute right-2 top-1.5 p-1.5 text-indigo-400 hover:text-indigo-300 disabled:opacity-50 transition-colors"
                                                            >
                                                                <div className={cn("p-1 rounded-full", chatMessage.trim() ? "bg-indigo-600 text-white" : "")}>
                                                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                                                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                                                                    </svg>
                                                                </div>
                                                            </button>
                                                        </form>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>

            {isConfigOpen && (
                <IndicatorConfigModal
                    isOpen={isConfigOpen}
                    onClose={() => setIsConfigOpen(false)}
                    indicator={indicator}
                />
            )}
        </Transition.Root>
    );
}
