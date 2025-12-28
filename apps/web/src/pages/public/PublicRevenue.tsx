
import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import toast, { Toaster } from 'react-hot-toast';
import { NumericFormat } from 'react-number-format';
import { api } from '../../lib/api';
import { format, startOfMonth, startOfWeek, endOfMonth, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, DollarSign, Calendar as CalendarIcon } from 'lucide-react';
import { cn } from '../../lib/utils';

interface RestaurantInfo {
    id: string;
    name: string;
    tradeName?: string;
    logoUrl?: string;
    currency?: string;
}

interface Stats {
    currentMonth: number;
    lastMonth: number;
    forecast: number;
    monthName: string;
    lastMonthName: string;
}

interface Revenue {
    id: string;
    startDate: string;
    totalAmount: number;
}

export default function PublicRevenue() {
    const { costCenterId } = useParams<{ costCenterId: string }>();
    const [restaurant, setRestaurant] = useState<RestaurantInfo | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState(false);

    // Calendar State
    const [currentDate, setCurrentDate] = useState(new Date());
    const [calendarRevenues, setCalendarRevenues] = useState<Revenue[]>([]);

    const { register, handleSubmit, setValue, watch, reset, formState: { errors, isSubmitting } } = useForm({
        defaultValues: {
            date: format(new Date(), 'yyyy-MM-dd'),
            amount: 0,
            notes: ''
        }
    });

    const fetchInfo = async () => {
        if (!costCenterId) return;
        try {
            const [infoRes, statsRes] = await Promise.all([
                api.get(`/api/public/revenues/${costCenterId}/info`),
                api.get(`/api/public/revenues/${costCenterId}/stats`)
            ]);
            setRestaurant(infoRes.data.data);
            setStats(statsRes.data.data);
        } catch (err) {
            console.error('Error fetching restaurant info:', err);
            setError('Restaurante não encontrado ou link expirado.');
        } finally {
            setLoading(false);
        }
    };

    const fetchCalendar = async () => {
        if (!costCenterId) return;
        try {
            const monthStr = format(currentDate, 'yyyy-MM');
            const res = await api.get(`/api/public/revenues/${costCenterId}/list`, { params: { month: monthStr } });
            setCalendarRevenues(res.data.data);
        } catch (err) {
            console.error('Error fetching calendar:', err);
        }
    };

    useEffect(() => {
        fetchInfo();
    }, [costCenterId]);

    useEffect(() => {
        fetchCalendar();
    }, [costCenterId, currentDate]);

    const onSubmit = async (data: any) => {
        if (!costCenterId) return;

        try {
            await api.post(`/api/public/revenues/${costCenterId}`, {
                date: data.date,
                amount: Number(data.amount),
                notes: data.notes
            });
            setSuccess(true);
            toast.success('Faturamento registrado com sucesso!');
            reset({
                date: format(new Date(), 'yyyy-MM-dd'),
                amount: 0,
                notes: ''
            });
            // Refresh stats and calendar
            fetchInfo();
            fetchCalendar();
        } catch (err: any) {
            console.error('Error submitting revenue:', err);
            const msg = err.response?.data?.message || 'Erro ao registrar faturamento';
            toast.error(msg);
        }
    };

    // Helper for Calendar
    const getDaysInMonth = (date: Date) => {
        const start = startOfWeek(startOfMonth(date));
        const end = endOfWeek(endOfMonth(date));
        return eachDayOfInterval({ start, end });
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500"></div>
            </div>
        );
    }

    if (error || !restaurant) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
                <div className="bg-gray-900 border border-white/10 rounded-2xl p-8 max-w-md w-full text-center">
                    <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">⚠️</span>
                    </div>
                    <h1 className="text-xl font-bold text-white mb-2">Link Inválido</h1>
                    <p className="text-gray-400">{error || 'Não foi possível carregar as informações do restaurante.'}</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center p-4 md:p-8">
            <Toaster position="top-right" />

            <div className="w-full max-w-4xl space-y-8">
                {/* Header */}
                <div className="text-center">
                    {restaurant.logoUrl ? (
                        <img src={restaurant.logoUrl} alt={restaurant.name} className="h-16 w-auto mx-auto mb-4 rounded-lg" />
                    ) : (
                        <div className="h-16 w-16 bg-primary-500/20 rounded-xl flex items-center justify-center mx-auto mb-4 text-primary-400 font-bold text-2xl">
                            {restaurant.name.charAt(0)}
                        </div>
                    )}
                    <h1 className="text-2xl font-bold text-white mb-1">{restaurant.name}</h1>
                    <p className="text-gray-400 text-sm">Registro de Faturamento Diário</p>
                </div>

                {/* KPI Cards */}
                {stats && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="bg-gray-900 border border-white/10 rounded-xl p-4 flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <DollarSign className="w-16 h-16 text-green-500" />
                            </div>
                            <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">Faturamento Atual</span>
                            <span className="text-2xl font-bold text-green-400 mt-1">{formatCurrency(stats.currentMonth)}</span>
                            <span className="text-xs text-gray-500 mt-2">Referente a {stats.monthName}</span>
                        </div>

                        <div className="bg-gray-900 border border-white/10 rounded-xl p-4 flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <TrendingUp className="w-16 h-16 text-blue-500" />
                            </div>
                            <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">Previsão</span>
                            <span className="text-2xl font-bold text-blue-400 mt-1">{formatCurrency(stats.forecast)}</span>
                            <span className="text-xs text-gray-500 mt-2">Estimado para o final do mês</span>
                        </div>

                        <div className="bg-gray-900 border border-white/10 rounded-xl p-4 flex flex-col relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-5">
                                <CalendarIcon className="w-16 h-16 text-purple-500" />
                            </div>
                            <span className="text-gray-400 text-sm font-medium uppercase tracking-wider">Mês Anterior</span>
                            <span className="text-2xl font-bold text-purple-400 mt-1">{formatCurrency(stats.lastMonth)}</span>
                            <div className="flex items-center gap-2 mt-2">
                                <span className={cn(
                                    "text-xs font-medium px-1.5 py-0.5 rounded",
                                    stats.currentMonth > stats.lastMonth
                                        ? "bg-green-500/10 text-green-400"
                                        : "bg-red-500/10 text-red-400"
                                )}>
                                    {stats.lastMonth > 0 ? ((stats.currentMonth - stats.lastMonth) / stats.lastMonth * 100).toFixed(1) : 0}%
                                </span>
                                <span className="text-xs text-gray-500">{stats.lastMonthName}</span>
                            </div>
                        </div>
                    </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    {/* Input Form */}
                    <div className="md:col-span-1">
                        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6 shadow-xl sticky top-8">
                            <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <PlusIcon /> Novo Lançamento
                            </h2>

                            {success && (
                                <div className="bg-green-500/10 border border-green-500/20 text-green-400 p-4 rounded-lg mb-6 text-sm flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                                    <CheckIcon />
                                    <span>Lançamento salvo com sucesso!</span>
                                    <button onClick={() => setSuccess(false)} className="ml-auto hover:text-green-300"><XIcon /></button>
                                </div>
                            )}

                            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Data</label>
                                    <input
                                        type="date"
                                        className="input w-full bg-gray-950/50"
                                        {...register('date', { required: true })}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Valor do Faturamento</label>
                                    <NumericFormat
                                        className="input w-full text-2xl font-bold text-green-400 bg-gray-950/50 h-14"
                                        thousandSeparator="."
                                        decimalSeparator=","
                                        prefix="R$ "
                                        fixedDecimalScale
                                        placeholder="R$ 0,00"
                                        value={watch('amount') || ''}
                                        onValueChange={(values) => {
                                            setValue('amount', values.floatValue || 0);
                                        }}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-400 mb-1">Observações</label>
                                    <textarea
                                        className="input w-full bg-gray-950/50 min-h-[80px]"
                                        placeholder="Diferença de caixa, evento especial, etc."
                                        {...register('notes')}
                                    />
                                </div>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || !watch('amount')}
                                    className="btn-primary w-full h-12 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? 'Salvando...' : 'Confirmar Faturamento'}
                                </button>
                            </form>
                        </div>
                    </div>

                    {/* Calendar */}
                    <div className="md:col-span-2">
                        <div className="bg-gray-900 border border-white/10 rounded-2xl p-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                    <CalendarIcon className="w-5 h-5 text-gray-400" />
                                    Calendário
                                </h2>
                                <div className="flex items-center gap-2 bg-gray-950 rounded-lg p-1 border border-white/5">
                                    <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors">
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    <span className="text-sm font-medium text-white min-w-[100px] text-center capitalize">
                                        {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
                                    </span>
                                    <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1.5 hover:bg-white/10 rounded-md text-gray-400 hover:text-white transition-colors">
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-7 gap-px bg-white/5 border border-white/5 rounded-lg overflow-hidden">
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((day) => (
                                    <div key={day} className="bg-gray-900 p-2 text-center text-xs font-medium text-gray-500 uppercase">
                                        {day}
                                    </div>
                                ))}

                                {getDaysInMonth(currentDate).map((day, idx) => {
                                    const dayRevenues = calendarRevenues.filter(r => isSameDay(new Date(r.startDate), day));
                                    const dailyTotal = dayRevenues.reduce((acc, curr) => acc + curr.totalAmount, 0);
                                    const isCurrentMonth = isSameMonth(day, currentDate);
                                    const isToday = isSameDay(day, new Date());

                                    return (
                                        <div
                                            key={day.toISOString()}
                                            className={cn(
                                                "bg-gray-900/50 p-2 min-h-[80px] flex flex-col transition-colors hover:bg-white/5",
                                                !isCurrentMonth && "opacity-30 bg-gray-950",
                                                isToday && "bg-primary-500/5 ring-1 ring-inset ring-primary-500/50"
                                            )}
                                        >
                                            <span className={cn(
                                                "text-xs font-medium mb-1 w-6 h-6 flex items-center justify-center rounded-full",
                                                isToday ? "bg-primary-500 text-white" : "text-gray-400"
                                            )}>
                                                {format(day, 'd')}
                                            </span>

                                            {dailyTotal > 0 && (
                                                <div className="mt-auto">
                                                    <div className="text-xs font-bold text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded truncate">
                                                        {new Intl.NumberFormat('pt-BR', { notation: 'compact', style: 'currency', currency: 'BRL' }).format(dailyTotal)}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>

                <p className="text-center text-gray-600 text-xs">
                    {new Date().getFullYear()} © Moby Dick. Acesso Restrito.
                </p>
            </div>
        </div>
    );
}

function PlusIcon() {
    return <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
}

function CheckIcon() {
    return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
}

function XIcon() {
    return <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
}
