
import React, { useEffect, useState } from 'react';
import { useScheduleStore } from '../../../stores/useScheduleStore';
import { getDaysInMonth, format, setDate } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { api } from '../../../lib/api';

import { OptimizeChatModal } from './OptimizeChatModal';

export function ScheduleView() {
    const {
        year, month, sectors, selectedSectorId, selectSector,
        matrix, stats, simulate, optimize, finalize, isSimulating, isLoading, error,
        updateCell, deleteSchedule, fetchSectors
    } = useScheduleStore();

    const [isChatOpen, setIsChatOpen] = useState(false);

    useEffect(() => {
        if (sectors.length === 0) fetchSectors();
    }, []);

    const currentSector = sectors.find((s: any) => s.id === selectedSectorId);
    const employees = currentSector?.employees || [];

    const getEmployeeName = (id: string) => {
        const emp = employees.find((e: any) => e.id === id);
        return emp ? emp.name : id.substring(0, 8) + '...';
    };

    const handleCellClick = (userId: string, day: number, currentVal: string) => {
        // Cycle: ''/undefined -> 'T' -> 'F' -> 'FE' -> 'T' ...
        let nextVal = 'T';
        if (currentVal === 'T') nextVal = 'F';
        else if (currentVal === 'F') nextVal = 'FE';
        else if (currentVal === 'FE') nextVal = 'T';

        updateCell(userId, day, nextVal);
    };

    // month in store is 1-12. Date ctor expects 0-11 for month.
    // Create date for the 1st of the month
    const dateRef = new Date(year, month - 1, 1);
    const daysInMonth = getDaysInMonth(dateRef);
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <div>
            {/* Sector Selector */}
            <div className="flex gap-4 mb-6 overflow-x-auto pb-2 scrollbar-thin">
                {sectors.map((s: any) => (
                    <button
                        key={s.id}
                        onClick={() => selectSector(s.id)}
                        className={`px-4 py-2 rounded-full whitespace-nowrap transition-all border ${selectedSectorId === s.id
                            ? 'bg-primary-600 border-primary-500 text-white shadow-lg shadow-primary-500/20'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                            }`}
                    >
                        {s.name}
                    </button>
                ))}
            </div>

            {/* Actions Toolbar */}
            <div className="flex gap-3 mb-6">
                <button
                    onClick={() => simulate()}
                    disabled={isSimulating || !selectedSectorId}
                    className="btn btn-primary relative overflow-hidden group"
                >
                    <span className="relative z-10 flex items-center gap-2">
                        {isSimulating ? (
                            <>
                                <div className="animate-spin h-4 w-4 border-2 border-white/30 border-t-white rounded-full"></div>
                                Gerando com IA...
                            </>
                        ) : (
                            <>
                                {/* Sparkle Icon */}
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-sparkles"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" /></svg>
                                Gerar escala com IA
                            </>
                        )}
                    </span>
                    {/* Gradient Animation Effect */}
                    {!isSimulating && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>}
                </button>

                <button
                    onClick={() => setIsChatOpen(true)}
                    disabled={!selectedSectorId || Object.keys(matrix).length === 0}
                    className="btn btn-secondary flex items-center gap-2"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-message-square-more"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    Otimizar
                </button>

                <div className="flex-1"></div>

                <button
                    onClick={() => deleteSchedule()}
                    disabled={isLoading || !selectedSectorId}
                    className="btn bg-red-500/10 text-red-500 hover:bg-red-500/20 border border-red-500/20"
                    title="Excluir escala salva"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2"><path d="M3 6h18" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
                </button>

                <button
                    onClick={async () => {
                        const result = await finalize();
                        if (result && result.scheduleId) {
                            // Navigate to print view
                            // We need to use useNavigate hook from react-router-dom, but this is inside a component.
                            // We should hoist useNavigate.
                            window.open(`/schedules/print/${result.scheduleId}`, '_blank');
                        }
                    }}
                    disabled={isLoading || !stats}
                    className="btn bg-green-600 text-white hover:bg-green-500 focus:ring-green-500 shadow-lg shadow-green-500/20"
                >
                    Finalizar & Imprimir
                </button>
            </div>

            {/* Stats / Warnings */}
            {stats && (
                <div className="mb-6 p-4 bg-white/5 border border-white/10 rounded-xl">
                    <div className="flex justify-between items-center mb-2">
                        <span className="font-bold text-lg text-white">Score: <span className={stats.score > 80 ? 'text-green-400' : 'text-yellow-400'}>{stats.score.toFixed(1)}</span></span>
                    </div>
                    {stats.warnings.length > 0 ? (
                        <ul className="text-sm space-y-1 max-h-32 overflow-y-auto pr-2">
                            {stats.warnings.map((w: string, idx: number) => (
                                <li key={idx} className="text-red-400 flex items-start gap-2">
                                    <span>•</span> {w}
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-green-400 text-sm">Nenhum aviso encontrado. Escala válida.</p>
                    )}
                </div>
            )}

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-400"><circle cx="12" cy="12" r="10" /><line x1="12" x2="12" y1="8" y2="12" /><line x1="12" x2="12.01" y1="16" y2="16" /></svg>
                    <span className="text-red-400 font-medium">{error}</span>
                </div>
            )}

            {/* Grid */}
            <div className="table-container max-h-[600px]">
                <table className="table min-w-full text-xs border-collapse">
                    <thead className="bg-gray-900/95 backdrop-blur sticky top-0 z-10 shadow-sm shadow-black/20">
                        <tr>
                            <th className="p-3 min-w-[150px] text-left border-b border-white/10 text-gray-300">Funcionário</th>
                            {daysArray.map(d => {
                                const currentDate = new Date(year, month - 1, d);
                                const dayOfWeek = currentDate.getDay(); // 0 (Sun) - 6 (Sat)
                                const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
                                return (
                                    <th key={d} className={`p-1 w-10 text-center border-b border-white/10 border-l border-white/5 ${isWeekend ? 'bg-white/5' : ''}`}>
                                        <div className="font-bold text-white">{d}</div>
                                        <div className="font-normal text-[10px] text-gray-500">{['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][dayOfWeek]}</div>
                                    </th>
                                );
                            })}
                        </tr>
                    </thead>
                    <tbody>
                        {Object.keys(matrix).length === 0 && (
                            <tr><td colSpan={daysInMonth + 1} className="p-8 text-center text-gray-500">Nenhuma escala gerada. Selecione um setor e clique em Gerar Escala.</td></tr>
                        )}

                        {(() => {
                            const hasShifts = currentSector?.numberOfShifts === 2;

                            const renderRow = (userId: string, keySuffix: string = '') => (
                                <tr key={userId + keySuffix} className="group hover:bg-white/[0.02] border-b border-white/5">
                                    <td className="p-3 font-medium truncate sticky left-0 bg-slate-900 z-5 group-hover:bg-slate-800 border-r border-white/10 text-gray-300">
                                        {getEmployeeName(userId)}
                                    </td>
                                    {daysArray.map(d => {
                                        const val = matrix[userId]?.[d] || '';
                                        let bg = 'text-gray-500'; // Default empty/unknown

                                        // Style nuances
                                        if (val === 'T') bg = 'bg-green-500/20 text-green-400 font-bold';
                                        if (val === 'F') bg = 'bg-white/5 text-gray-500';
                                        if (val === 'FE') bg = 'bg-blue-500/20 text-blue-400 font-bold';

                                        return (
                                            <td
                                                key={d}
                                                className={`p-1 text-center border-r border-white/5 cursor-pointer hover:opacity-80 transition-opacity select-none ${bg}`}
                                                onClick={() => handleCellClick(userId, d, val)}
                                                title="Clique para alterar"
                                            >
                                                {val}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );

                            if (!hasShifts) {
                                return Object.keys(matrix).map(id => renderRow(id));
                            }

                            // Grouping Logic
                            const shift1: string[] = [];
                            const shift2: string[] = [];
                            const others: string[] = [];

                            Object.keys(matrix).forEach(userId => {
                                const emp = employees.find((e: any) => e.id === userId);
                                if (emp?.scheduleType === '12x36') {
                                    shift1.push(userId);
                                    shift2.push(userId);
                                }
                                else if (emp?.shift === '1') shift1.push(userId);
                                else if (emp?.shift === '2') shift2.push(userId);
                                else others.push(userId);
                            });

                            return (
                                <>
                                    {shift1.length > 0 && (
                                        <>
                                            <tr className="bg-slate-800/50">
                                                <td colSpan={daysInMonth + 1} className="p-2 font-bold text-blue-200 uppercase text-xs tracking-wider border-y border-white/10 sticky left-0 z-10">
                                                    1º Turno {shift2.length > 0 && '(e 12x36)'}
                                                </td>
                                            </tr>
                                            {shift1.map(id => renderRow(id, '_s1'))}
                                        </>
                                    )}

                                    {shift2.length > 0 && (
                                        <>
                                            <tr className="bg-slate-800/50">
                                                <td colSpan={daysInMonth + 1} className="p-2 font-bold text-purple-200 uppercase text-xs tracking-wider border-y border-white/10 sticky left-0 z-10">
                                                    2º Turno {shift1.length > 0 && '(e 12x36)'}
                                                </td>
                                            </tr>
                                            {shift2.map(id => renderRow(id, '_s2'))}
                                        </>
                                    )}

                                    {others.length > 0 && (
                                        <>
                                            <tr className="bg-slate-800/50">
                                                <td colSpan={daysInMonth + 1} className="p-2 font-bold text-gray-400 uppercase text-xs tracking-wider border-y border-white/10 sticky left-0 z-10">
                                                    Outros
                                                </td>
                                            </tr>
                                            {others.map(id => renderRow(id, '_other'))}
                                        </>
                                    )}
                                </>
                            );
                        })()}
                    </tbody>
                </table>
            </div>

            <OptimizeChatModal
                isOpen={isChatOpen}
                onClose={() => setIsChatOpen(false)}
                sectorId={selectedSectorId || ''}
                onApplyChanges={(ops) => console.log('Apply changes', ops)}
            />
        </div >
    );
}
