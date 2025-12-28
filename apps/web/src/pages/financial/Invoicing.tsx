
import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Plus, DollarSign, Calendar as CalendarIcon, X, TrendingUp, TrendingDown, Calendar } from 'lucide-react';
import { Dialog, Transition } from '@headlessui/react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils'; // Assuming cn exists as seen in Layout
import { NumericFormat } from 'react-number-format';

interface Revenue {
    id: string;
    startDate: string;
    endDate: string;
    totalAmount: number;
    notes?: string;
}

// COST CENTER COLORS (Visual consistency)
const getCostCenterColor = (id: string, index: number) => {
    const colors = [
        'bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500',
        'bg-pink-500', 'bg-cyan-500', 'bg-yellow-500', 'bg-red-500'
    ];
    // Hash the ID? Or simpler: just use index from the list if available
    // Return explicit class for tailwind to scan
    return colors[index % colors.length] || 'bg-primary-500';
};

// DASHBOARD COMPONENT
function InvoicingDashboard({ currentDate }: { currentDate: Date }) {
    const { data: kpis } = useQuery({
        queryKey: ['dashboard-kpis', format(currentDate, 'yyyy-MM-dd')],
        queryFn: () => api.get('/api/dashboard/kpis', {
            params: { date: currentDate.toISOString() }
        }).then(r => r.data.data)
    });

    if (!kpis) return null;

    const { revenue } = kpis;
    const { thisMonth, lastMonth, lastYearSameMonth, forecast } = revenue;

    // Comparisons
    const vsLastMonth = lastMonth > 0 ? ((thisMonth - lastMonth) / lastMonth) * 100 : 0;
    const vsLastYear = lastYearSameMonth > 0 ? ((thisMonth - lastYearSameMonth) / lastYearSameMonth) * 100 : 0;

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
            <DashboardCard
                title="Faturamento Mês Atual"
                value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(thisMonth)}
                icon={DollarSign}
                color="bg-primary-500"
            />
            <DashboardCard
                title="Previsão (Fechamento)"
                value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(forecast)}
                icon={TrendingUp}
                color="bg-purple-500"
                subtitle="Calculado pelo algoritmo"
            />
            <DashboardCard
                title="Vs Mês Anterior"
                value={`${vsLastMonth >= 0 ? '+' : ''}${vsLastMonth.toFixed(1)}%`}
                icon={Calendar}
                color={vsLastMonth >= 0 ? "bg-green-500" : "bg-red-500"}
                isPercent
            />
            <DashboardCard
                title="Vs Ano Anterior"
                value={lastYearSameMonth > 0 ? `${vsLastYear >= 0 ? '+' : ''}${vsLastYear.toFixed(1)}%` : 'N/A'}
                icon={Calendar}
                color={vsLastYear >= 0 ? "bg-green-500" : "bg-red-500"}
                isPercent
                subtitle={lastYearSameMonth > 0 ? `Ano passado: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(lastYearSameMonth)}` : 'Sem dados'}
            />
        </div>
    );
}

function DashboardCard({ title, value, icon: Icon, color, subtitle, isPercent }: any) {
    return (
        <div className="bg-white/5 border border-white/10 rounded-xl p-4 flex items-center gap-4">
            <div className={`p-3 rounded-lg ${color} bg-opacity-20 text-white`}>
                <Icon size={24} />
            </div>
            <div>
                <p className="text-gray-400 text-sm">{title}</p>
                <p className={`text-xl font-bold ${isPercent ? (parseFloat(value) >= 0 ? 'text-green-400' : 'text-red-400') : 'text-white'}`}>
                    {value}
                </p>
                {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
            </div>
        </div>
    );
}

export default function Invoicing() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [modalData, setModalData] = useState<{ startDate: Date; endDate: Date; revenues: any[] } | null>(null);
    const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
    const [modalViewMode, setModalViewMode] = useState<'LIST' | 'EDIT'>('LIST');
    const [newRevenueDate, setNewRevenueDate] = useState<Date | null>(null);

    const queryClient = useQueryClient();

    // Timezone helper: Backend returns UTC "YYYY-MM-DD". 
    // New Date("2024-01-01") in GMT-3 is "2023-12-31 21:00".
    // We want to force it to be "2024-01-01 00:00" in LOCAL time so it renders on the correct calendar square.
    const parseBackendDate = (dateStr: string | Date) => {
        if (!dateStr) return new Date();
        const d = new Date(dateStr);
        // Add offset to compensate for the "previous day" shift when parsing UTC as Local
        return new Date(d.valueOf() + d.getTimezoneOffset() * 60 * 1000);
    };

    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(currentDate);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Fetch revenues for the current month view (buffered slightly)
    const { data: revenues = [] } = useQuery<any[]>({
        queryKey: ['revenues', format(currentDate, 'yyyy-MM')], // Updated queryKey
        queryFn: async () => {
            const start = format(subMonths(monthStart, 1), 'yyyy-MM-dd');
            const end = format(addMonths(monthEnd, 1), 'yyyy-MM-dd');
            // Send allCenters=true to get everything
            const res = await api.get('/api/revenues', {
                params: { startDate: start, endDate: end, allCenters: 'true' }
            });
            return res.data.data;
        }
    });

    const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

    const handleDayClick = (day: Date) => {
        // Collect ALL revenues for this day (Daily + Overlapping Periods)
        const dayRevenues = revenues.filter(r => {
            const startDate = parseBackendDate(r.startDate);
            const endDate = parseBackendDate(r.endDate);
            return isSameDay(startDate, day) && isSameDay(endDate, day);
        });

        const periodRevenues = revenues.filter(r => {
            const start = parseBackendDate(r.startDate);
            const end = parseBackendDate(r.endDate);
            return !isSameDay(start, end) && isWithinInterval(day, { start, end });
        });

        setModalData({
            startDate: day,
            endDate: day,
            revenues: [...dayRevenues, ...periodRevenues]
        });
        setEditingRevenue(null); // Ensure no editing state when opening day view
        setModalViewMode(dayRevenues.length > 0 || periodRevenues.length > 0 ? 'LIST' : 'EDIT');
        setNewRevenueDate(day); // Set date for new entry if mode is EDIT
        setIsModalOpen(true);
    };

    const handlePeriodClick = () => {
        setModalData({
            startDate: monthStart,
            endDate: monthEnd,
            revenues: []
        });
        setEditingRevenue(null);
        setModalViewMode('EDIT'); // Always open in edit mode for period entry
        setNewRevenueDate(null); // No specific day for period entry
        setIsModalOpen(true);
    };

    const getDayContent = (day: Date) => {
        // Find daily revenues (could be multiple!)
        const dailies = revenues.filter(r => {
            const start = parseBackendDate(r.startDate);
            const end = parseBackendDate(r.endDate);
            return isSameDay(start, day) && isSameDay(end, day);
        });

        // Find periods covering this day
        const periods = revenues.filter(r => {
            const start = parseBackendDate(r.startDate);
            const end = parseBackendDate(r.endDate);
            return !isSameDay(start, end) && isWithinInterval(day, { start, end });
        });

        return { dailies, periods };
    };

    return (
        <div className="p-6 max-w-[1600px] mx-auto animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-2xl font-bold text-white">Gestão de Faturamento</h1>
                    <p className="text-gray-400">Acompanhe e registre suas receitas diárias</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={handlePeriodClick}
                        className="btn-secondary flex items-center gap-2"
                    >
                        <CalendarIcon className="w-4 h-4" />
                        Lançamento por Período
                    </button>
                    <button
                        onClick={() => handleDayClick(new Date())}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Novo Lançamento
                    </button>
                </div>
            </div>

            <InvoicingDashboard currentDate={currentDate} />

            {/* Calendar Controls */}
            <div className="flex items-center justify-between bg-gray-900/50 p-4 rounded-xl border border-white/5 mb-4">
                <button onClick={handlePrevMonth} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white">
                    <ChevronLeft className="w-5 h-5" />
                </button>
                <h2 className="text-xl font-semibold text-white capitalize">
                    {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                </h2>
                <button onClick={handleNextMonth} className="p-2 hover:bg-white/5 rounded-lg text-gray-400 hover:text-white">
                    <ChevronRight className="w-5 h-5" />
                </button>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-px bg-white/10 rounded-xl overflow-hidden border border-white/10">
                {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map(day => (
                    <div key={day} className="bg-gray-900 p-2 text-center text-sm font-medium text-gray-500">
                        {day}
                    </div>
                ))}

                {/* Empty start days */}
                {Array.from({ length: monthStart.getDay() }).map((_, i) => (
                    <div key={`empty-${i}`} className="bg-gray-900/50 min-h-[120px]" />
                ))}

                {days.map(day => {
                    const { dailies, periods } = getDayContent(day);
                    const isToday = isSameDay(day, new Date());

                    return (
                        <div
                            key={day.toISOString()}
                            onClick={() => handleDayClick(day)}
                            className={cn(
                                "bg-gray-900 min-h-[120px] p-2 cursor-pointer transition-colors hover:bg-gray-800/80 relative group flex flex-col gap-1",
                                isToday && "bg-gray-800 ring-1 ring-inset ring-primary-500"
                            )}
                        >
                            <span className={cn(
                                "text-sm font-medium w-6 h-6 flex items-center justify-center rounded-full mb-1 self-end",
                                isToday ? "bg-primary-500 text-white" : "text-gray-400 group-hover:text-white"
                            )}>
                                {format(day, 'd')}
                            </span>

                            {/* Render Multi-Revenues */}
                            {dailies.map((rev, idx) => {
                                // Deterministic color based on center ID string char sum
                                const colorIdx = rev.costCenterId.split('').reduce((a: any, b: any) => a + b.charCodeAt(0), 0);
                                const colorClass = getCostCenterColor(rev.costCenterId, colorIdx);

                                return (
                                    <div key={rev.id} className={cn("p-1.5 rounded text-left border border-white/5 relative overflow-hidden group/item", colorClass, "bg-opacity-10 hover:bg-opacity-20 transition-all")}>
                                        {/* Colored Left Border Indicator */}
                                        <div className={cn("absolute left-0 top-0 bottom-0 w-1", colorClass)}></div>

                                        <div className="pl-2">
                                            <p className="text-[10px] font-bold text-gray-300 truncate opacity-70 leading-none mb-0.5">
                                                {rev.costCenter?.name || '---'}
                                            </p>
                                            <p className="text-xs font-bold text-white leading-none">
                                                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(rev.totalAmount)}
                                            </p>
                                        </div>
                                    </div>
                                )
                            })}

                            {periods.map(rev => (
                                <div key={rev.id} className="p-1 bg-blue-500/10 border border-blue-500/20 rounded text-center">
                                    <p className="text-[9px] text-blue-400 uppercase font-bold tracking-wider truncate">
                                        {rev.costCenter?.name || 'Period'}
                                    </p>
                                </div>
                            ))}
                        </div>
                    );
                })}
            </div>

            <RevenueModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                data={modalData}
                onSuccess={() => {
                    setIsModalOpen(false);
                    queryClient.invalidateQueries({ queryKey: ['revenues'] });
                }}
            />
        </div>
    );
}

function RevenueModal({ isOpen, onClose, data, onSuccess }: {
    isOpen: boolean;
    onClose: () => void;
    data: { startDate: Date, endDate: Date, revenues: any[] } | null;
    onSuccess: () => void;
}) {
    const queryClient = useQueryClient();
    const [editingRevenue, setEditingRevenue] = useState<Revenue | null>(null);
    const [viewMode, setViewMode] = useState<'LIST' | 'EDIT'>('LIST');

    // Reset view mode when opening fresh
    React.useEffect(() => {
        if (isOpen) {
            setViewMode(data?.revenues?.length ? 'LIST' : 'EDIT');
            setEditingRevenue(null);
        }
    }, [isOpen, data]);

    const { data: costCenters = [] } = useQuery({
        queryKey: ['costCenters', 'active'],
        queryFn: async () => {
            const res = await api.get('/api/restaurants', {
                params: { status: 'active' } // Show all active resturants
            });
            return res.data.data;
        }
    });

    const { register, handleSubmit, reset, setValue, watch, getValues, formState: { errors } } = useForm({
        defaultValues: {
            startDate: '',
            endDate: '',
            totalAmount: 0,
            notes: '',
            costCenterId: ''
        }
    });

    // Populate form when editing or creating new
    React.useEffect(() => {
        if (viewMode === 'EDIT') {
            const initialDate = data?.startDate ? format(data.startDate, 'yyyy-MM-dd') : '';

            setValue('startDate', editingRevenue ? format(new Date(editingRevenue.startDate), 'yyyy-MM-dd') : initialDate);
            setValue('endDate', editingRevenue ? format(new Date(editingRevenue.endDate), 'yyyy-MM-dd') : initialDate);
            setValue('totalAmount', editingRevenue?.totalAmount || 0);
            setValue('notes', editingRevenue?.notes || '');
            setValue('costCenterId', (editingRevenue as any)?.costCenterId || (costCenters[0]?.id || ''));
        }
    }, [viewMode, editingRevenue, data, setValue, costCenters]);

    const mutation = useMutation({
        mutationFn: async (values: any) => {
            if (editingRevenue?.id) {
                return api.put(`/api/revenues/${editingRevenue.id}`, values);
            }
            return api.post('/api/revenues', values);
        },
        onSuccess: () => {
            toast.success(editingRevenue ? 'Faturamento atualizado!' : 'Faturamento registrado!');
            onSuccess();
        },
        onError: (error: any) => {
            console.error('Revenue save error:', error);
            const msg = error.response?.data?.message || error.message || 'Erro ao salvar faturamento';
            toast.error(msg);
        }
    });

    const deleteMutation = useMutation({
        mutationFn: async () => api.delete(`/api/revenues/${editingRevenue?.id}`),
        onSuccess: () => {
            toast.success('Registro removido!');
            onSuccess();
        }
    });

    const onSubmit = (formData: any) => {
        mutation.mutate({
            ...formData,
            totalAmount: Number(formData.totalAmount)
        });
    };

    return (
        <Transition appear show={isOpen} as={React.Fragment}>
            <Dialog as="div" className="relative z-50" onClose={onClose}>
                <Transition.Child
                    as={React.Fragment}
                    enter="ease-out duration-300"
                    enterFrom="opacity-0"
                    enterTo="opacity-100"
                    leave="ease-in duration-200"
                    leaveFrom="opacity-100"
                    leaveTo="opacity-0"
                >
                    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm" />
                </Transition.Child>

                <div className="fixed inset-0 overflow-y-auto">
                    <div className="flex min-h-full items-center justify-center p-4">
                        <Transition.Child
                            as={React.Fragment}
                            enter="ease-out duration-300"
                            enterFrom="opacity-0 scale-95"
                            enterTo="opacity-100 scale-100"
                            leave="ease-in duration-200"
                            leaveFrom="opacity-100 scale-100"
                            leaveTo="opacity-0 scale-95"
                        >
                            <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-gray-900 border border-white/10 p-6 shadow-xl transition-all">
                                <div className="flex items-center justify-between mb-6">
                                    <Dialog.Title as="h3" className="text-lg font-medium text-white flex gap-2 items-center">
                                        {viewMode === 'LIST' ? (
                                            <>Faturamentos do Dia <span className="text-sm text-gray-400 font-normal">({format(data?.startDate || new Date(), 'dd/MM')})</span></>
                                        ) : (
                                            <>{editingRevenue ? 'Editar Faturamento' : 'Registrar Faturamento'}</>
                                        )}
                                    </Dialog.Title>
                                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                                        <X className="w-5 h-5" />
                                    </button>
                                </div>

                                {viewMode === 'LIST' && (
                                    <div className="space-y-4">
                                        {data?.revenues.length === 0 ? (
                                            <p className="text-center text-gray-500 py-4">Nenhum faturamento registrado.</p>
                                        ) : (
                                            <div className="space-y-2">
                                                {data?.revenues.map((rev) => {
                                                    const colorIdx = rev.costCenterId.split('').reduce((a: any, b: any) => a + b.charCodeAt(0), 0);
                                                    const colorClass = getCostCenterColor(rev.costCenterId, colorIdx);

                                                    return (
                                                        <div
                                                            key={rev.id}
                                                            onClick={() => {
                                                                setEditingRevenue(rev);
                                                                setViewMode('EDIT');
                                                            }}
                                                            className="p-3 bg-white/5 hover:bg-white/10 rounded-lg flex justify-between items-center cursor-pointer transition-colors border border-white/5 hover:border-white/20 group"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className={cn("w-2 h-10 rounded-full", colorClass)}></div>
                                                                <div>
                                                                    <p className="font-bold text-white text-lg leading-tight">
                                                                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(rev.totalAmount)}
                                                                    </p>
                                                                    <div className="flex items-center gap-2">
                                                                        <span className="text-xs text-gray-400 font-medium">{rev.costCenter?.name || 'Desconhecido'}</span>
                                                                        {rev.startDate !== rev.endDate && (
                                                                            <span className="text-[10px] bg-blue-500/20 text-blue-300 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">Período</span>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                            <ChevronRight className="w-4 h-4 text-gray-500 group-hover:text-white transition-colors" />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <button
                                            onClick={() => {
                                                setEditingRevenue(null);
                                                setViewMode('EDIT');
                                            }}
                                            className="btn-primary w-full mt-4 flex items-center justify-center gap-2"
                                        >
                                            <Plus className="w-4 h-4" /> Adicionar Novo
                                        </button>
                                    </div>
                                )}

                                {viewMode === 'EDIT' && (
                                    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-200">
                                        {/* Back Button if we came from list */}
                                        {data?.revenues?.length! > 0 && (
                                            <button
                                                type="button"
                                                onClick={() => setViewMode('LIST')}
                                                className="text-xs text-primary-400 hover:text-primary-300 flex items-center gap-1 mb-2"
                                            >
                                                <ChevronLeft className="w-3 h-3" /> Voltar para lista
                                            </button>
                                        )}

                                        {/* Cost Center Selection */}
                                        <div className="col-span-2">
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Restaurante / Centro de Custo</label>
                                            <select
                                                className="input w-full"
                                                {...register('costCenterId')}
                                                disabled={!!editingRevenue} // Prevent moving CC for now to avoid complexity in permission re-check
                                            >
                                                <option value="">Selecione...</option>
                                                {costCenters.map((cc: any) => (
                                                    <option key={cc.id} value={cc.id}>
                                                        {cc.name}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-1">Data Início</label>
                                                <input
                                                    type="date"
                                                    className="input"
                                                    {...register('startDate', { required: true })}
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-400 mb-1">Data Fim</label>
                                                <input
                                                    type="date"
                                                    className="input"
                                                    {...register('endDate', { required: true })}
                                                />
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Valor Total (R$)</label>
                                            <NumericFormat
                                                className="input text-lg font-bold text-green-400"
                                                thousandSeparator="."
                                                decimalSeparator=","
                                                prefix="R$ "
                                                fixedDecimalScale
                                                value={watch('totalAmount') || ''}
                                                onValueChange={(values) => {
                                                    setValue('totalAmount', values.floatValue || 0);
                                                }}
                                                onFocus={(e) => {
                                                    if (Number(watch('totalAmount')) === 0) {
                                                        setValue('totalAmount', '' as any);
                                                    }
                                                }}
                                                onBlur={(e) => {
                                                    if (!watch('totalAmount')) {
                                                        setValue('totalAmount', 0);
                                                    }
                                                }}
                                            />
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-400 mb-1">Observações</label>
                                            <textarea
                                                className="input min-h-[80px]"
                                                placeholder="Opcional..."
                                                {...register('notes')}
                                            />
                                        </div>

                                        <div className="flex justify-end gap-3 mt-6">
                                            {editingRevenue && (
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        if (confirm('Tem certeza?')) deleteMutation.mutate();
                                                    }}
                                                    className="text-red-400 hover:text-red-300 px-4 py-2 text-sm font-medium mr-auto"
                                                >
                                                    Excluir
                                                </button>
                                            )}
                                            <button
                                                type="button"
                                                onClick={onClose}
                                                className="btn-ghost"
                                            >
                                                Cancelar
                                            </button>
                                            <button
                                                type="submit"
                                                className="btn-primary"
                                                disabled={mutation.isPending}
                                            >
                                                {mutation.isPending ? 'Salvando...' : 'Salvar'}
                                            </button>
                                        </div>
                                    </form>
                                )}
                            </Dialog.Panel>
                        </Transition.Child>
                    </div>
                </div>
            </Dialog>
        </Transition>
    );
}

