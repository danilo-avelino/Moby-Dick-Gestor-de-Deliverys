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
    const [activeTab, setActiveTab] = useState<'details' | 'history' | 'chat'>('details');
    const [chatMessage, setChatMessage] = useState("");
    const [isConfigOpen, setIsConfigOpen] = useState(false);

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
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                                {isLoading ? (
                                    <div className="p-8 flex justify-center">
                                        <div className="animate-spin h-8 w-8 border-4 border-indigo-500 rounded-full border-t-transparent"></div>
                                    </div>
                                ) : (
                                    <>
                                        {/* Header */}
                                        <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4 border-b border-gray-200 flex justify-between items-start">
                                            <div>
                                                <Dialog.Title as="h3" className="text-xl font-semibold leading-6 text-gray-900">
                                                    {indicator.name}
                                                </Dialog.Title>
                                                <p className="mt-1 text-sm text-gray-500">{indicator.description}</p>
                                            </div>
                                            <div className="flex items-center space-x-2">
                                                {canConfigure && (
                                                    <button
                                                        onClick={() => setIsConfigOpen(true)}
                                                        className="p-2 text-gray-400 hover:text-indigo-600 transition-colors"
                                                        title="Configurar"
                                                    >
                                                        <Settings className="w-5 h-5" />
                                                    </button>
                                                )}
                                                <button
                                                    type="button"
                                                    className="rounded-md bg-white text-gray-400 hover:text-gray-500"
                                                    onClick={onClose}
                                                >
                                                    <span className="sr-only">Close</span>
                                                    <X className="h-6 w-6" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Tabs */}
                                        <div className="border-b border-gray-200">
                                            <nav className="-mb-px flex space-x-8 px-6" aria-label="Tabs">
                                                {[
                                                    { id: 'details', name: 'Detalhes', icon: TrendingUp },
                                                    { id: 'history', name: 'Histórico', icon: History },
                                                    { id: 'chat', name: 'Chat', icon: MessageSquare, count: indicator.comments?.length }
                                                ].map((tab) => (
                                                    <button
                                                        key={tab.id}
                                                        onClick={() => setActiveTab(tab.id as any)}
                                                        className={cn(
                                                            activeTab === tab.id
                                                                ? 'border-indigo-500 text-indigo-600'
                                                                : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700',
                                                            'group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium'
                                                        )}
                                                    >
                                                        <tab.icon className={cn(
                                                            activeTab === tab.id ? 'text-indigo-500' : 'text-gray-400 group-hover:text-gray-500',
                                                            '-ml-0.5 mr-2 h-5 w-5'
                                                        )} />
                                                        {tab.name}
                                                        {tab.count ? (
                                                            <span className={cn(
                                                                activeTab === tab.id ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-900',
                                                                'ml-3 hidden rounded-full py-0.5 px-2.5 text-xs font-medium md:inline-block'
                                                            )}>
                                                                {tab.count}
                                                            </span>
                                                        ) : null}
                                                    </button>
                                                ))}
                                            </nav>
                                        </div>

                                        {/* Content */}
                                        <div className="p-6 min-h-[300px] max-h-[60vh] overflow-y-auto">
                                            {activeTab === 'details' && (
                                                <div className="space-y-6">
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="p-4 bg-gray-50 rounded-lg">
                                                            <p className="text-sm font-medium text-gray-500">Resultado Atual</p>
                                                            <p className="text-2xl font-bold text-gray-900 mt-1">{indicator.currentValue?.toLocaleString('pt-BR')}</p>
                                                        </div>
                                                        <div className="p-4 bg-gray-50 rounded-lg">
                                                            <p className="text-sm font-medium text-gray-500">Meta ({indicator.cycle})</p>
                                                            <p className="text-2xl font-bold text-gray-900 mt-1">{indicator.targetValue?.toLocaleString('pt-BR')}</p>
                                                        </div>
                                                    </div>

                                                    <div className="p-4 bg-blue-50 text-blue-800 rounded-lg text-sm flex items-start">
                                                        <Info className="w-5 h-5 mr-3 flex-shrink-0" />
                                                        <p>Os dados deste indicador são coletados automaticamente. Lançamentos manuais não são permitidos.</p>
                                                    </div>

                                                    <div>
                                                        <h4 className="text-sm font-medium text-gray-900 mb-2">Interessados (Acesso)</h4>
                                                        <div className="flex -space-x-2 overflow-hidden">
                                                            {indicator.access?.map((access: any) => (
                                                                <div key={access.user.id} className="relative inline-block h-8 w-8 rounded-full ring-2 ring-white bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-500" title={`${access.user.firstName} ${access.user.lastName}`}>
                                                                    {access.user.avatarUrl ? (
                                                                        <img className="h-full w-full rounded-full object-cover" src={access.user.avatarUrl} alt="" />
                                                                    ) : getInitials(access.user.firstName, access.user.lastName)}
                                                                </div>
                                                            ))}
                                                            {indicator.access?.length === 0 && <span className="text-sm text-gray-500 italic">Nenhum interessado definido.</span>}
                                                        </div>
                                                    </div>
                                                </div>
                                            )}

                                            {activeTab === 'history' && (
                                                <div className="flow-root">
                                                    <ul role="list" className="-mb-8">
                                                        {indicator.results?.map((result: any, resultIdx: number) => (
                                                            <li key={result.id}>
                                                                <div className="relative pb-8">
                                                                    {resultIdx !== indicator.results.length - 1 ? (
                                                                        <span className="absolute left-4 top-4 -ml-px h-full w-0.5 bg-gray-200" aria-hidden="true" />
                                                                    ) : null}
                                                                    <div className="relative flex space-x-3">
                                                                        <div>
                                                                            <span className={cn(
                                                                                result.value >= (result.targetSnapshot || 0) ? 'bg-green-500' : 'bg-red-500',
                                                                                'h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white'
                                                                            )}>
                                                                                <History className="h-5 w-5 text-white" aria-hidden="true" />
                                                                            </span>
                                                                        </div>
                                                                        <div className="flex min-w-0 flex-1 justify-between space-x-4 pt-1.5">
                                                                            <div>
                                                                                <p className="text-sm text-gray-500">
                                                                                    Resultado: <span className="font-medium text-gray-900">{result.value}</span>
                                                                                    <span className="mx-2 text-gray-300">|</span>
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
                                                            <p className="text-center text-gray-500 py-4">Nenhum histórico disponível.</p>
                                                        )}
                                                    </ul>
                                                </div>
                                            )}

                                            {activeTab === 'chat' && (
                                                <div className="flex flex-col h-full">
                                                    <div className="flex-1 space-y-4 mb-4">
                                                        {indicator.comments?.map((comment: any) => (
                                                            <div key={comment.id} className="flex space-x-3">
                                                                <div className="flex-shrink-0">
                                                                    <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center text-xs">
                                                                        {getInitials(comment.user.firstName, comment.user.lastName)}
                                                                    </div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-sm">
                                                                        <span className="font-medium text-gray-900">{comment.user.firstName}</span>
                                                                        <span className="text-gray-500 ml-2 text-xs">{new Date(comment.createdAt).toLocaleString()}</span>
                                                                    </div>
                                                                    <div className="mt-1 text-sm text-gray-700">
                                                                        <p>{comment.message}</p>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                        {indicator.comments?.length === 0 && (
                                                            <p className="text-center text-gray-500 py-8 italic">Nenhuma mensagem ainda.</p>
                                                        )}
                                                    </div>
                                                    <form onSubmit={handleSendMessage} className="mt-auto relative">
                                                        <div className="overflow-hidden rounded-lg shadow-sm ring-1 ring-inset ring-gray-300 focus-within:ring-2 focus-within:ring-indigo-600">
                                                            <label htmlFor="comment" className="sr-only">Add your comment</label>
                                                            <textarea
                                                                rows={2}
                                                                name="comment"
                                                                id="comment"
                                                                className="block w-full resize-none border-0 bg-transparent py-1.5 text-gray-900 placeholder:text-gray-400 focus:ring-0 sm:text-sm sm:leading-6"
                                                                placeholder="Adicione um comentário..."
                                                                value={chatMessage}
                                                                onChange={(e) => setChatMessage(e.target.value)}
                                                            />

                                                            {/* Simple Send Button - could be fancier */}
                                                            <div className="py-2 px-3 flex justify-end">
                                                                <button
                                                                    type="submit"
                                                                    disabled={chatMutation.isPending || !chatMessage.trim()}
                                                                    className="inline-flex items-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-50"
                                                                >
                                                                    Enviar
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </form>
                                                </div>
                                            )}
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
