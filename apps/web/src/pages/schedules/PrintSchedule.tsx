
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { getDaysInMonth, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Loader2, ArrowLeft, Printer } from 'lucide-react';

export default function PrintSchedule() {
    const { id } = useParams();
    const navigate = useNavigate();

    const { data: schedule, isLoading, error } = useQuery({
        queryKey: ['schedule', id],
        queryFn: () => api.get(`/api/schedules/${id}`).then(res => res.data),
        enabled: !!id
    });

    if (isLoading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-white">
                <Loader2 className="w-8 h-8 text-primary-600 animate-spin" />
            </div>
        );
    }

    if (error || !schedule) {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-white text-red-600 gap-4">
                <p>Erro ao carregar escala. Tente novamente.</p>
                <button
                    onClick={() => navigate('/schedules')}
                    className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-900 flex items-center gap-2"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
            </div>
        );
    }

    // Assuming we are printing the first sector output for now, 
    // or we might want to print ALL sectors if the schedule contains multiple.
    // Based on the data model, Schedule has many SectorOutputs.
    // For V1 let's iterate and print all, or just the first one.
    // Since the user typically creates/finalizes one sector at a time, 
    // it usually has one. But if they finalize multiple, we can show multiple tables.

    // However, the `simulate/finalize` flow is per sector.

    const { year, month } = schedule;
    const dateRef = new Date(year, month - 1, 1);
    const monthName = format(dateRef, 'MMMM', { locale: ptBR });
    const daysInMonth = getDaysInMonth(dateRef);
    const daysArray = Array.from({ length: daysInMonth }, (_, i) => i + 1);

    return (
        <div className="min-h-screen bg-white text-black p-8 print:p-0">
            {/* No-Print Toolbar */}
            <div className="print:hidden flex justify-between items-center mb-8 max-w-[297mm] mx-auto">
                <button
                    onClick={() => navigate('/schedules')}
                    className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200 text-gray-900 flex items-center gap-2 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> Voltar
                </button>
                <button
                    onClick={() => window.print()}
                    className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 shadow-sm flex items-center gap-2 font-medium transition-colors"
                >
                    <Printer className="w-4 h-4" /> Imprimir
                </button>
            </div>

            {/* Print Content (A4 Landscape approx width) */}
            <div className="max-w-[297mm] mx-auto print:max-w-none">
                {schedule.sectorOutputs.map((output: any) => (
                    <div key={output.id} className="mb-8 break-inside-avoid page-break-after-always last:page-break-after-auto">
                        {/* Header */}
                        <div className="flex justify-between items-end border-b-2 border-black pb-4 mb-6">
                            <div>
                                <h1 className="text-2xl font-bold uppercase tracking-wide">Escala de Trabalho</h1>
                                <p className="text-lg text-gray-600 mt-1 capitalize">
                                    {output.sector.name} — {monthName} / {year}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-sm text-gray-500">Gerado em {format(new Date(schedule.createdAt), 'dd/MM/yyyy HH:mm')}</p>
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="w-full overflow-x-auto">
                            <table className="w-full border-collapse text-xs">
                                <thead>
                                    <tr>
                                        <th className="border border-gray-400 p-2 text-left min-w-[150px] bg-gray-100">Funcionário</th>
                                        {daysArray.map(d => {
                                            const dayDate = new Date(year, month - 1, d);
                                            const dayWeek = dayDate.getDay();
                                            const isWeekend = dayWeek === 0 || dayWeek === 6;
                                            return (
                                                <th key={d} className={`border border-gray-400 p-1 w-8 text-center ${isWeekend ? 'bg-gray-200' : ''}`}>
                                                    <div>{d}</div>
                                                    <div className="font-normal text-[10px] uppercase text-gray-500">
                                                        {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][dayWeek]}
                                                    </div>
                                                </th>
                                            );
                                        })}
                                    </tr>
                                </thead>
                                <tbody>
                                    {Object.entries(output.data as Record<string, Record<string, string>>).map(([userId, days]) => (
                                        <tr key={userId}>
                                            {/* TODO: Resolve User Name from ID. For now using ID/Mock */}
                                            <td className="border border-gray-400 p-2 font-medium truncate max-w-[150px]">
                                                {(schedule.employees && schedule.employees[userId])
                                                    ? schedule.employees[userId].name
                                                    : userId}
                                            </td>
                                            {daysArray.map(d => {
                                                const val = days[d] || '';
                                                let content = val;
                                                let cellClass = '';

                                                if (val === 'T') {
                                                    content = '●'; // Dot for work
                                                    cellClass = 'text-black font-bold text-center';
                                                } else if (val === 'F') {
                                                    content = 'F';
                                                    cellClass = 'bg-gray-100 text-gray-400 text-center';
                                                } else if (val === 'FE') {
                                                    content = 'FE';
                                                    cellClass = 'bg-gray-300 font-bold text-center';
                                                }

                                                return (
                                                    <td key={d} className={`border border-gray-400 p-1 ${cellClass}`}>
                                                        {content}
                                                    </td>
                                                );
                                            })}
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        {/* Footer / Signatures */}
                        <div className="mt-12 grid grid-cols-2 gap-12">
                            <div className="border-t border-black pt-2">
                                <p className="text-center text-sm font-medium">Assinatura do Gerente</p>
                            </div>
                            <div className="border-t border-black pt-2">
                                <p className="text-center text-sm font-medium">De acordo (Representante da Equipe)</p>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            <style>{`
                @media print {
                    @page {
                        size: landscape;
                        margin: 10mm;
                    }
                    body {
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            `}</style>
        </div>
    );
}
