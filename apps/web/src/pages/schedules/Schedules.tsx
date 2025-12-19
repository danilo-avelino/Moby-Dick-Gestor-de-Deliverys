
import React, { useState } from 'react';
import { ScheduleView } from './components/ScheduleView';
import { SectorList } from './components/SectorList';
import { EmployeeList } from './components/EmployeeList';
import { MonthConfig } from './components/MonthConfig';
import { useScheduleStore } from '../../stores/useScheduleStore';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Schedules() {
    const [activeTab, setActiveTab] = useState<'view' | 'sectors' | 'employees' | 'config'>('view');
    const { year, month, setMonth } = useScheduleStore();

    const handleYearChange = (delta: number) => {
        setMonth(year + delta, month);
    };

    const handleMonthSelect = (m: number) => {
        setMonth(year, m);
    };

    const months = [
        'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
        'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'
    ];

    return (
        <div className="space-y-6 animate-fade-in p-6">
            <div className="flex justify-between items-center">
                <h1 className="text-2xl font-bold text-white">Escalas de Trabalho</h1>

                {/* Year Selector (Top Right) */}
                <div className="flex items-center gap-4 bg-white/5 p-2 rounded-lg border border-white/10">
                    <button onClick={() => handleYearChange(-1)} className="p-2 hover:bg-white/10 rounded-full text-white">
                        <ChevronLeft size={20} />
                    </button>
                    <span className="font-bold text-lg w-20 text-center text-white">
                        {year}
                    </span>
                    <button onClick={() => handleYearChange(1)} className="p-2 hover:bg-white/10 rounded-full text-white">
                        <ChevronRight size={20} />
                    </button>
                </div>
            </div>

            {/* Navigation Tabs */}
            <div className="flex gap-2 border-b border-white/10 pb-1">
                <button
                    onClick={() => setActiveTab('view')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${activeTab === 'view'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Visualizar Escala
                </button>
                <button
                    onClick={() => setActiveTab('sectors')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${activeTab === 'sectors'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Setores
                </button>
                <button
                    onClick={() => setActiveTab('employees')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${activeTab === 'employees'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Funcionários
                </button>
                <button
                    onClick={() => setActiveTab('config')}
                    className={`px-4 py-2 rounded-t-lg font-medium transition-colors ${activeTab === 'config'
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                        }`}
                >
                    Configurações
                </button>
            </div>

            {/* Month Selector (Access to all months) */}
            {/* Month Selector (Access to all months) */}
            {(activeTab === 'view' || activeTab === 'config') && (
                <div className="grid grid-cols-6 sm:grid-cols-12 gap-2">
                    {months.map((name, idx) => {
                        const mNum = idx + 1;
                        const isActive = month === mNum;
                        return (
                            <button
                                key={mNum}
                                onClick={() => handleMonthSelect(mNum)}
                                className={`px-2 py-2 rounded-lg text-xs font-medium transition-all ${isActive
                                    ? 'bg-white/20 text-white border border-white/20'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-transparent'
                                    }`}
                            >
                                {name.substring(0, 3)}
                            </button>
                        );
                    })}
                </div>
            )}

            {/* Content Area */}
            <div className="glass-card min-h-[500px]">
                {activeTab === 'view' && <ScheduleView />}
                {activeTab === 'sectors' && <SectorList />}
                {activeTab === 'employees' && <EmployeeList />}
                {activeTab === 'config' && <MonthConfig />}
            </div>
        </div>
    );
}
