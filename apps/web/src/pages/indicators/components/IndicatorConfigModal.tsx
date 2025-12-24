import { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Save, Users } from "lucide-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { toast } from "react-hot-toast";
import { useAuthStore } from "../../../stores/auth";
import { getInitials, cn } from "../../../lib/utils";

interface IndicatorConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
    indicator: any;
}

export function IndicatorConfigModal({ isOpen, onClose, indicator }: IndicatorConfigModalProps) {
    const [targetValue, setTargetValue] = useState(indicator.targetValue?.toString() || "");
    const [cycle, setCycle] = useState(indicator.cycle || "MONTHLY");
    const [ownerId, setOwnerId] = useState(indicator.ownerId || "");
    const [accessUserIds, setAccessUserIds] = useState<string[]>([]);

    const queryClient = useQueryClient();
    const { user } = useAuthStore();

    // Load initial access list
    useEffect(() => {
        if (indicator.access) {
            setAccessUserIds(indicator.access.map((a: any) => a.userId));
        }
    }, [indicator]);

    // Fetch Users for assignment
    const { data: usersResponse } = useQuery({
        queryKey: ['users', 'list'], // Adjust based on your user list key
        queryFn: () => api.get('/api/users').then(res => res.data),
        // Assuming /api/users returns paginated or list. We need a list of users in the Cost Center.
        // If /api/users is paginated, this might be tricky. Usually for dropdowns we have a specific endpoint or use the same list with a large limit.
        // Let's assume /api/users returns { data: [...], ... } and we filter client side or it respects scoping.
    });

    const availableUsers = usersResponse?.data || [];

    const updateMutation = useMutation({
        mutationFn: (data: any) => api.put(`/api/indicators/${indicator.id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['indicators'] });
            queryClient.invalidateQueries({ queryKey: ['indicator', indicator.id] });
            toast.success("Indicador atualizado");
            onClose();
        },
        onError: () => toast.error("Erro ao atualizar indicador")
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateMutation.mutate({
            targetValue: parseFloat(targetValue),
            cycle,
            ownerId: ownerId || null,
            accessUserIds
        });
    };

    const toggleUserAccess = (userId: string) => {
        setAccessUserIds(prev =>
            prev.includes(userId)
                ? prev.filter(id => id !== userId)
                : [...prev, userId]
        );
    };

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
                            <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-gray-900 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg border border-white/10">
                                <form onSubmit={handleSubmit}>
                                    <div className="bg-gray-900 px-4 pt-5 pb-4 sm:p-6 sm:pb-4 text-white">
                                        <div className="flex justify-between items-center mb-5">
                                            <Dialog.Title as="h3" className="text-lg font-semibold leading-6 text-white">
                                                Configurar: {indicator.name}
                                            </Dialog.Title>
                                            <button
                                                type="button"
                                                className="rounded-md bg-transparent text-gray-400 hover:text-white"
                                                onClick={onClose}
                                            >
                                                <X className="h-6 w-6" />
                                            </button>
                                        </div>

                                        <div className="space-y-4">
                                            {/* Target */}
                                            <div>
                                                <label htmlFor="target" className="block text-sm font-medium leading-6 text-gray-300">
                                                    Meta / Alvo
                                                </label>
                                                <div className="mt-1">
                                                    <input
                                                        type="number"
                                                        step="0.01"
                                                        name="target"
                                                        id="target"
                                                        className="block w-full rounded-md border-0 bg-white/5 py-1.5 text-white shadow-sm ring-1 ring-inset ring-white/10 placeholder:text-gray-500 focus:ring-2 focus:ring-inset focus:ring-indigo-500 sm:text-sm sm:leading-6"
                                                        value={targetValue}
                                                        onChange={(e) => setTargetValue(e.target.value)}
                                                    />
                                                </div>
                                            </div>

                                            {/* Cycle */}
                                            <div>
                                                <label htmlFor="cycle" className="block text-sm font-medium leading-6 text-gray-300">
                                                    Ciclo de Apuração
                                                </label>
                                                <select
                                                    id="cycle"
                                                    name="cycle"
                                                    className="mt-1 block w-full rounded-md border-0 bg-white/5 py-1.5 pl-3 pr-10 text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-indigo-500 sm:text-sm sm:leading-6 [&>option]:bg-gray-900"
                                                    value={cycle}
                                                    onChange={(e) => setCycle(e.target.value)}
                                                >
                                                    <option value="DAILY">Diário</option>
                                                    <option value="WEEKLY">Semanal</option>
                                                    <option value="MONTHLY">Mensal</option>
                                                    <option value="QUARTERLY">Trimestral</option>
                                                </select>
                                            </div>

                                            {/* Access Control */}
                                            <div>
                                                <label className="block text-sm font-medium leading-6 text-gray-300 mb-2">
                                                    Interessados (Quem visualiza?)
                                                </label>
                                                <div className="border border-white/10 rounded-md max-h-40 overflow-y-auto divide-y divide-white/10 bg-white/5">
                                                    {availableUsers.map((u: any) => (
                                                        <div
                                                            key={u.id}
                                                            className={cn(
                                                                "flex items-center px-3 py-2 cursor-pointer hover:bg-white/5 transition-colors",
                                                                accessUserIds.includes(u.id) ? "bg-indigo-500/20" : ""
                                                            )}
                                                            onClick={() => toggleUserAccess(u.id)}
                                                        >
                                                            <input
                                                                type="checkbox"
                                                                className="h-4 w-4 rounded border-white/10 bg-white/5 text-indigo-500 focus:ring-indigo-500 ring-offset-gray-900"
                                                                checked={accessUserIds.includes(u.id)}
                                                                readOnly
                                                            />
                                                            <span className="ml-3 block text-sm font-medium text-gray-300">
                                                                {u.firstName} {u.lastName}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                                <p className="text-xs text-gray-500 mt-1">Selecione quem deve acompanhar este indicador.</p>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="bg-gray-900/50 px-4 py-3 sm:flex sm:flex-row-reverse sm:px-6 border-t border-white/5">
                                        <button
                                            type="submit"
                                            disabled={updateMutation.isPending}
                                            className="inline-flex w-full justify-center rounded-md bg-indigo-600 px-3 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-500 sm:ml-3 sm:w-auto disabled:opacity-50"
                                        >
                                            {updateMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                                        </button>
                                        <button
                                            type="button"
                                            className="mt-3 inline-flex w-full justify-center rounded-md bg-transparent px-3 py-2 text-sm font-semibold text-gray-300 shadow-sm ring-1 ring-inset ring-white/10 hover:bg-white/5 hover:text-white sm:mt-0 sm:w-auto"
                                            onClick={onClose}
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </form>
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition.Root>
    );
}
