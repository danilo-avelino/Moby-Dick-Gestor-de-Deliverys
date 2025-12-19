import React, { useState, useEffect } from 'react';
import { useScheduleStore } from '../../../stores/useScheduleStore';
import { api } from '../../../lib/api';
import { Save } from 'lucide-react';
import { format, getDaysInMonth } from 'date-fns';

export function MonthConfig() {
    const { year, month, monthConfig, fetchMonthConfig } = useScheduleStore();
    const [teamExtraDaysOff, setTeamExtraDaysOff] = useState(1);
    const [blockedDates, setBlockedDates] = useState<string[]>([]);

    useEffect(() => {
        fetchMonthConfig();
    }, [year, month]);

    useEffect(() => {
        if (monthConfig && monthConfig.blockedDates) {
            setTeamExtraDaysOff(monthConfig.teamExtraDaysOff ?? 1);
            setBlockedDates(monthConfig.blockedDates);
        } else {
            // Default: Block all Weekends (Sat/Sun) if no config exists
            setTeamExtraDaysOff(monthConfig?.teamExtraDaysOff ?? 1); // Preserve if exists

            const weekends: string[] = [];
            const daysInMonth = getDaysInMonth(new Date(year, month - 1));

            for (let d = 1; d <= daysInMonth; d++) {
                const date = new Date(year, month - 1, d);
                const dayOfWeek = date.getDay(); // 0 = Sun, 6 = Sat
                if (dayOfWeek === 0 || dayOfWeek === 6) {
                    weekends.push(format(date, 'yyyy-MM-dd'));
                }
            }
            setBlockedDates(weekends);
        }
    }, [monthConfig, year, month]);

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.put('/api/schedules/month-config', {
                year,
                month,
                teamExtraDaysOff: Number(teamExtraDaysOff),
                blockedDates
            });
            await fetchMonthConfig();
            alert('Configuração Salva!');
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar configuração');
        }
    };

    const toggleDate = (day: number) => {
        // Construct YYYY-MM-DD
        // month is 1-12, Date uses 0-11
        const dateStr = format(new Date(year, month - 1, day), 'yyyy-MM-dd');

        setBlockedDates(prev => {
            if (prev.includes(dateStr)) {
                return prev.filter(d => d !== dateStr);
            } else {
                return [...prev, dateStr];
            }
        });
    };

    // Calendar Grid
    const dateRef = new Date(year, month - 1, 1);
    const daysInMonth = getDaysInMonth(dateRef);
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <div className="max-w-4xl">
            <h2 className="text-xl font-bold mb-6 text-white">Configuração: {month}/{year}</h2>

            <form onSubmit={handleSave} className="space-y-6">
                <div className="glass-card border border-white/5 space-y-6 p-6 from-slate-800 to-slate-900 bg-gradient-to-br">
                    <div>
                        <label className="label">Folgas Extras (Equipe)</label>
                        <input
                            type="number"
                            min="0"
                            className="input md:w-1/2"
                            value={teamExtraDaysOff}
                            onChange={e => setTeamExtraDaysOff(parseInt(e.target.value))}
                        />
                        <p className="text-xs text-gray-500 mt-2">Número padrão de folgas adicionais (além da escala normal) que cada funcionário deve ter neste mês.</p>
                    </div>

                    <div>
                        <label className="label mb-4">Datas Bloqueadas (Geral)</label>
                        <div className="bg-slate-900/50 p-4 rounded-xl border border-white/5">
                            <p className="text-sm text-gray-400 mb-4 flex items-center gap-2">
                                <span className="w-4 h-4 rounded bg-red-500/20 border border-red-500/50 inline-block"></span>
                                Clique nos dias para bloquear/desbloquear. Dias vermelhos não terão folgas.
                            </p>

                            <div className="grid grid-cols-7 gap-2 max-w-lg">
                                {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(d => (
                                    <div key={d} className="text-center text-xs font-bold text-gray-500 uppercase py-2">{d}</div>
                                ))}

                                {/* Padding for starting day of week */}
                                {Array.from({ length: dateRef.getDay() }).map((_, i) => (
                                    <div key={`empty-${i}`} />
                                ))}

                                {daysArray.map(day => {
                                    const dateStr = format(new Date(year, month - 1, day), 'yyyy-MM-dd');
                                    const isBlocked = blockedDates.includes(dateStr);

                                    return (
                                        <button
                                            key={day}
                                            type="button"
                                            onClick={() => toggleDate(day)}
                                            className={`
                                                aspect-square rounded-lg flex items-center justify-center text-sm font-medium transition-all
                                                ${isBlocked
                                                    ? 'bg-red-500/20 text-red-500 border border-red-500/50 hover:bg-red-500/30 shadow-[0_0_10px_rgba(239,68,68,0.2)]'
                                                    : 'bg-white/5 text-gray-300 border border-white/5 hover:bg-white/10 hover:border-white/20'
                                                }
                                            `}
                                        >
                                            {day}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-2">Datas em que NENHUM funcionário deve folgar.</p>
                    </div>
                </div>

                <div className="flex justify-end">
                    <button type="submit" className="btn btn-primary">
                        <Save size={18} /> Salvar Configurações
                    </button>
                </div>
            </form>
        </div>
    );
}
