
import React, { useState, useEffect } from 'react';
import { useScheduleStore } from '../../../stores/useScheduleStore';
import { api } from '../../../lib/api';
import { Trash2, Plus, X, Pencil } from 'lucide-react';

// Modal for creating/editing sector
// Modal
function SectorModal({ sector, onClose, onSubmit }: { sector?: any, onClose: () => void, onSubmit: (data: any) => void }) {
    const [name, setName] = useState(sector?.name || '');
    const [numberOfShifts, setNumberOfShifts] = useState(sector?.numberOfShifts || 1);

    // minStaffByWeekday state: defaults to simple "2" or loads object
    // Structure: { "0": 2, "1": 3 } OR { "0": { "1": 2, "2": 3 } }
    const [minStaffState, setMinStaffState] = useState<any>({});

    useEffect(() => {
        if (sector) {
            setName(sector.name);
            setNumberOfShifts(sector.numberOfShifts || 1);
            if (sector.minStaffByWeekday) {
                setMinStaffState(sector.minStaffByWeekday);
            }
        } else {
            // Default initialization
            const initial: any = {};
            for (let i = 0; i < 7; i++) initial[String(i)] = 2; // Default 2 staff
            setMinStaffState(initial);
        }
    }, [sector]);

    const handleMinStaffChange = (day: string, value: string, shift?: string) => {
        const val = parseInt(value) || 0;
        setMinStaffState((prev: any) => {
            const newState = { ...prev };
            if (shift) {
                // Nested structure logic
                // If current state is number (or undefined), assume it applies to both shifts initially (as per getMinStaffValue fallback)
                // If it is already object, copy it to avoid mutation
                let currentDayState: any;

                if (typeof newState[day] === 'object' && newState[day] !== null) {
                    currentDayState = { ...newState[day] };
                } else {
                    const oldVal = typeof newState[day] === 'number' ? newState[day] : 0;
                    currentDayState = { '1': oldVal, '2': oldVal };
                }

                currentDayState[shift] = val;
                newState[day] = currentDayState;
            } else {
                // Simple structure
                newState[day] = val;
            }
            return newState;
        });
    };

    // Helper to extract value safely
    const getMinStaffValue = (day: string, shift?: string) => {
        const entry = minStaffState[day];
        if (shift) {
            if (typeof entry === 'object') return entry[shift] || 0;
            return entry || 0; // Fallback
        }
        if (typeof entry === 'object') return (entry['1'] || 0) + (entry['2'] || 0); // Sum if showing single input for multi-shift (not ideal but fallback)
        return entry || 0;
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        // Clean up formatting
        const minStaffFinal: any = {};
        for (let i = 0; i < 7; i++) {
            const d = String(i);
            if (numberOfShifts === 2) {
                // Ensure object structure { "1": x, "2": y }
                const val1 = typeof minStaffState[d] === 'object' ? minStaffState[d]['1'] || 0 : minStaffState[d] || 0;
                const val2 = typeof minStaffState[d] === 'object' ? minStaffState[d]['2'] || 0 : minStaffState[d] || 0; // Or default?
                minStaffFinal[d] = { '1': val1, '2': val2 };
            } else {
                // Ensure number
                const val = typeof minStaffState[d] === 'object' ? (minStaffState[d]['1'] || 0) : minStaffState[d];
                minStaffFinal[d] = Number(val) || 0;
            }
        }

        onSubmit({
            name,
            minStaffByWeekday: minStaffFinal,
            numberOfShifts: Number(numberOfShifts)
        });
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-slate-800 p-6 rounded-xl w-full max-w-lg">
                <div className="flex justify-between items-center mb-6">
                    <h3 className="text-lg font-bold text-white">{sector ? 'Editar Setor' : 'Novo Setor'}</h3>
                    <button onClick={onClose}><X className="text-gray-400" /></button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label">Nome do Setor</label>
                        <input className="input" value={name} onChange={e => setName(e.target.value)} required />
                    </div>

                    <div>
                        <label className="label">Turnos</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 text-gray-300">
                                <input
                                    type="radio"
                                    name="shifts"
                                    checked={numberOfShifts === 1}
                                    onChange={() => setNumberOfShifts(1)}
                                /> 1 Turno
                            </label>
                            <label className="flex items-center gap-2 text-gray-300">
                                <input
                                    type="radio"
                                    name="shifts"
                                    checked={numberOfShifts === 2}
                                    onChange={() => setNumberOfShifts(2)}
                                /> 2 Turnos
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="label mb-2">Mínimo de Funcionários por Dia</label>
                        <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto pr-2">
                            {['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'].map((day, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-slate-900/50 p-2 rounded">
                                    <span className="text-sm text-gray-300 w-24">{day}</span>

                                    {numberOfShifts === 1 ? (
                                        <input
                                            type="number"
                                            min="0"
                                            className="input w-20 text-center py-1"
                                            value={getMinStaffValue(String(idx))}
                                            onChange={e => handleMinStaffChange(String(idx), e.target.value)}
                                        />
                                    ) : (
                                        <div className="flex gap-2">
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-gray-500 uppercase">T1</span>
                                                <input
                                                    type="number" min="0"
                                                    className="input w-16 text-center py-1 text-sm"
                                                    value={getMinStaffValue(String(idx), '1')}
                                                    onChange={e => handleMinStaffChange(String(idx), e.target.value, '1')}
                                                />
                                            </div>
                                            <div className="flex flex-col items-center">
                                                <span className="text-[10px] text-gray-500 uppercase">T2</span>
                                                <input
                                                    type="number" min="0"
                                                    className="input w-16 text-center py-1 text-sm"
                                                    value={getMinStaffValue(String(idx), '2')}
                                                    onChange={e => handleMinStaffChange(String(idx), e.target.value, '2')}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="flex justify-end gap-2 mt-6">
                        <button type="button" onClick={onClose} className="btn btn-ghost">Cancelar</button>
                        <button type="submit" className="btn btn-primary">Salvar</button>
                    </div>
                </form>
            </div>
        </div>
    );
}

export function SectorList() {
    const { sectors, fetchSectors } = useScheduleStore();
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSector, setEditingSector] = useState<any>(null);

    useEffect(() => {
        fetchSectors();
    }, []);

    const handleSave = async (data: any) => {
        try {
            if (editingSector) {
                await api.put(`/api/schedules/sectors/${editingSector.id}`, data);
            } else {
                await api.post('/api/schedules/sectors', data);
            }
            await fetchSectors();
            setIsModalOpen(false);
            setEditingSector(null);
        } catch (error: any) {
            console.error(error);
            alert(error.response?.data?.error || 'Erro ao salvar setor');
        }
    };

    const handleEdit = (sector: any) => {
        setEditingSector(sector);
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setEditingSector(null);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Tem certeza?')) return;
        try {
            await api.delete(`/api/schedules/sectors/${id}`);
            await fetchSectors();
        } catch (error) {
            console.error(error);
            alert('Erro ao deletar');
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Gerenciar Setores</h2>
                <button onClick={handleNew} className="btn btn-primary">
                    <Plus size={18} /> Novo Setor
                </button>
            </div>

            <div className="table-container">
                <table className="table min-w-full">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Turnos</th>
                            <th className="max-w-md">Funcionários</th>
                            <th className="text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sectors.map((sector: any) => (
                            <tr key={sector.id}>
                                <td className="font-medium text-white">{sector.name}</td>
                                <td>
                                    <span className="bg-white/5 px-2 py-1 rounded text-xs text-gray-300">
                                        {sector.numberOfShifts || 1}
                                    </span>
                                </td>
                                <td className="max-w-md">
                                    <div className="flex flex-wrap gap-1">
                                        {sector.employees && sector.employees.length > 0 ? (
                                            sector.employees.map((emp: any, idx: number) => (
                                                <span key={idx} className="text-xs text-gray-400">
                                                    {emp.name}{idx < sector.employees.length - 1 ? ' - ' : ''}
                                                </span>
                                            ))
                                        ) : (
                                            <span className="text-xs text-gray-600 italic">Sem funcionários</span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-right flex justify-end gap-2">
                                    <button onClick={() => handleEdit(sector)} className="text-blue-400 hover:text-blue-300 p-2 hover:bg-blue-500/10 rounded-lg transition-colors">
                                        <Pencil size={18} />
                                    </button>
                                    <button onClick={() => handleDelete(sector.id)} className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition-colors">
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {sectors.length === 0 && <p className="text-center p-8 text-gray-500">Nenhum setor cadastrado.</p>}
            </div>

            {isModalOpen && <SectorModal sector={editingSector} onClose={() => setIsModalOpen(false)} onSubmit={handleSave} />}
        </div>
    );
}
