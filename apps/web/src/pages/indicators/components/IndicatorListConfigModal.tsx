import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Check, Search, AlertCircle, ToggleLeft, ToggleRight } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { toast } from "react-hot-toast";
import { cn } from "../../../lib/utils";

interface IndicatorListConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    indicators: any[];
}

export function IndicatorListConfigModal({ isOpen, onClose, indicators }: IndicatorListConfigModalProps) {
    const [searchTerm, setSearchTerm] = useState("");
    const queryClient = useQueryClient();

    const toggleMutation = useMutation({
        mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
            return api.put(`/api/indicators/${id}`, { isActive });
        },
        onMutate: async ({ id, isActive }) => {
            // Cancel any outgoing refetches (so they don't overwrite our optimistic update)
            await queryClient.cancelQueries({ queryKey: ["indicators"] });

            // Snapshot the previous value
            const previousIndicators = queryClient.getQueryData(["indicators"]);

            // Optimistically update to the new value
            queryClient.setQueryData(["indicators"], (old: any[]) => {
                return old?.map((ind) =>
                    ind.id === id ? { ...ind, isActive } : ind
                );
            });

            // Return a context object with the snapshotted value
            return { previousIndicators };
        },
        onError: (err, newTodo, context) => {
            // If the mutation fails, use the context returned from onMutate to roll back
            queryClient.setQueryData(["indicators"], context?.previousIndicators);
            toast.error("Erro ao atualizar status");
        },
        onSettled: () => {
            // Always refetch after error or success:
            queryClient.invalidateQueries({ queryKey: ["indicators"] });
        },
        onSuccess: () => {
            toast.success("Status atualizado");
        },
    });

    const filteredIndicators = indicators.filter((ind) =>
        ind.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <Transition.Root show={isOpen} as={Fragment}>
            <Dialog as="div" className="relative z-[60]" onClose={onClose}>
                <Transition.Child
                    as={Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-gray-900/80 transition-opacity backdrop-blur-sm" />
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
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-gray-900 border border-white/10 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-2xl">
                                <div className="bg-gray-900 px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                                    <div className="flex justify-between items-center mb-6">
                                        <div>
                                            <Dialog.Title as="h3" className="text-xl font-semibold leading-6 text-white">
                                                Configurar Acompanhamento
                                            </Dialog.Title>
                                            <p className="mt-1 text-sm text-gray-400">
                                                Selecione os indicadores que devem ser monitorados no painel.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="rounded-md bg-transparent text-gray-400 hover:text-white"
                                            onClick={onClose}
                                        >
                                            <span className="sr-only">Close</span>
                                            <X className="h-6 w-6" />
                                        </button>
                                    </div>

                                    {/* Search */}
                                    <div className="relative mb-6">
                                        <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                                            <Search className="h-5 w-5 text-gray-400" aria-hidden="true" />
                                        </div>
                                        <input
                                            type="text"
                                            className="block w-full rounded-md border-0 bg-white/5 py-2 pl-10 text-white ring-1 ring-inset ring-white/10 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                            placeholder="Buscar indicadores..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                        />
                                    </div>

                                    {/* List */}
                                    <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2 custom-scrollbar">
                                        {filteredIndicators.map((indicator) => {
                                            const isActive = indicator.isActive !== false; // Default to true if undefined? Schema says optional boolean.
                                            return (
                                                <div
                                                    key={indicator.id}
                                                    className="flex items-center justify-between p-4 rounded-lg bg-white/5 border border-white/5 hover:bg-white/10 transition-colors"
                                                >
                                                    <div className="flex-1 min-w-0 mr-4">
                                                        <h4 className="text-sm font-medium text-white truncate">
                                                            {indicator.name}
                                                        </h4>
                                                        <p className="text-xs text-gray-400 truncate mt-0.5">
                                                            {indicator.description || "Sem descrição"}
                                                        </p>
                                                    </div>
                                                    <div className="flex items-center">
                                                        <button
                                                            onClick={() => toggleMutation.mutate({ id: indicator.id, isActive: !isActive })}
                                                            disabled={toggleMutation.isPending}
                                                            className={cn(
                                                                "relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-600 focus:ring-offset-2 focus:ring-offset-gray-900",
                                                                isActive ? "bg-indigo-600" : "bg-gray-700"
                                                            )}
                                                        >
                                                            <span
                                                                className={cn(
                                                                    "pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out",
                                                                    isActive ? "translate-x-5" : "translate-x-0"
                                                                )}
                                                            />
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}

                                        {filteredIndicators.length === 0 && (
                                            <div className="text-center py-12 text-gray-500">
                                                <AlertCircle className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                <p className="text-lg font-medium">Nenhum indicador encontrado.</p>
                                                <p className="text-sm mt-1">Verifique se você selecionou um Centro de Custo válido.</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="bg-gray-900/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-white/5">
                                    <button
                                        type="button"
                                        className="inline-flex w-full justify-center rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-100 sm:ml-3 sm:w-auto"
                                        onClick={onClose}
                                    >
                                        Concluir
                                    </button>
                                </div>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
}
