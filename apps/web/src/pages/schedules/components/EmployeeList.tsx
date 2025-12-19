
import React, { useState, useEffect } from 'react';
import { useScheduleStore } from '../../../stores/useScheduleStore';
import { api } from '../../../lib/api';
import { Plus, X, Pencil, Trash2 } from 'lucide-react';

// Modal
function EmployeeModal({ sector, onClose, onSubmit, employee }: { sector: any, onClose: () => void, onSubmit: (data: any) => void, employee?: any }) {
    const [name, setName] = useState(employee?.name || '');
    const [scheduleType, setScheduleType] = useState(employee?.scheduleType || '6x1'); // '6x1' | '12x36'
    const [extraDaysOffPerMonth, setExtraDaysOffPerMonth] = useState(employee?.extraDaysOffPerMonth?.toString() || '0');
    const [shift, setShift] = useState(employee?.shift || '');

    // Restrictions
    const [fixedOffDates, setFixedOffDates] = useState(employee?.fixedOffDates ? employee.fixedOffDates.join(', ') : '');
    const [unavailableWeekdays, setUnavailableWeekdays] = useState<number[]>(employee?.unavailableWeekdays || []);

    const toggleWeekday = (day: number) => {
        if (unavailableWeekdays.includes(day)) {
            setUnavailableWeekdays(prev => prev.filter(d => d !== day));
        } else {
            setUnavailableWeekdays(prev => [...prev, day]);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        const is12x36 = scheduleType === '12x36';

        onSubmit({
            sectorId: sector.id,
            name,
            scheduleType,
            shift: sector.numberOfShifts === 2 ? shift : undefined,
            extraDaysOffPerMonth: is12x36 ? 0 : parseInt(extraDaysOffPerMonth),
            workDaysPerWeek: is12x36 ? 4 : 6,
            fixedOffDates: fixedOffDates.split(',').map((d: string) => d.trim()).filter(Boolean),
            unavailableWeekdays: is12x36 ? [] : unavailableWeekdays
        });
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in">
            <div className="glass-card w-full max-w-md border border-white/10 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X size={20} />
                </button>

                <h3 className="text-xl font-bold mb-6 text-white">{employee ? 'Editar Funcionário' : 'Novo Funcionário'}</h3>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="label">Nome</label>
                        <input className="input" value={name} onChange={e => setName(e.target.value)} required placeholder="Nome completo" />
                    </div>

                    {/* Shift Selection if Sector has 2 shifts AND not 12x36 */}
                    {sector.numberOfShifts === 2 && scheduleType !== '12x36' && (
                        <div>
                            <label className="label">Turno de Trabalho</label>
                            <select className="input" value={shift} onChange={e => setShift(e.target.value)} required>
                                <option value="">Selecione...</option>
                                <option value="1">1º Turno (Dia)</option>
                                <option value="2">2º Turno (Noite)</option>
                            </select>
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Tipo de Escala</label>
                            <select className="input" value={scheduleType} onChange={e => setScheduleType(e.target.value)}>
                                <option value="6x1">6x1</option>
                                <option value="12x36">12x36</option>
                            </select>
                        </div>
                        {scheduleType === '6x1' && (
                            <div>
                                <label className="label">Folgas Extras / Mês</label>
                                <input type="number" min="0" className="input" value={extraDaysOffPerMonth} onChange={e => setExtraDaysOffPerMonth(e.target.value)} />
                            </div>
                        )}
                    </div>

                    {scheduleType === '6x1' && (
                        <>
                            <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-300">
                                <p><strong>Escala 6x1:</strong> 1 folga fixa semanal obrigatória + {extraDaysOffPerMonth} folgas extras no mês.</p>
                            </div>

                            <div>
                                <label className="label">Dias da semana Indisponíveis (Preferência de Folga)</label>
                                <div className="flex gap-2 mt-2">
                                    {['D', 'S', 'T', 'Q', 'Q', 'S', 'S'].map((label, idx) => (
                                        <button
                                            key={idx}
                                            type="button"
                                            onClick={() => toggleWeekday(idx)}
                                            className={`w-9 h-9 rounded-lg font-bold transition-all ${unavailableWeekdays.includes(idx)
                                                ? 'bg-red-500 text-white shadow-lg shadow-red-500/25'
                                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                                                }`}
                                        >
                                            {label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}

                    {scheduleType === '12x36' && (
                        <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20 text-sm text-purple-300">
                            <p><strong>Escala 12x36:</strong> Trabalho dia sim, dia não.</p>
                        </div>
                    )}

                    <div>
                        <label className="label">Folgas/Bloqueios Fixos (YYYY-MM-DD)</label>
                        <input className="input" value={fixedOffDates} onChange={e => setFixedOffDates(e.target.value)} placeholder="Ex: 2025-01-01, 2025-01-02" />
                        <p className="text-xs text-gray-500 mt-1">Separe datas por vírgula.</p>
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

export function EmployeeList() {
    const { sectors, selectedSectorId, selectSector } = useScheduleStore();
    const [employees, setEmployees] = useState<any[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingEmployee, setEditingEmployee] = useState<any>(null);

    const fetchEmployees = async () => {
        if (!selectedSectorId) return;
        try {
            const res = await api.get('/api/schedules/employees', { params: { sectorId: selectedSectorId } });
            setEmployees(res.data);
        } catch (error) {
            console.error(error);
        }
    };

    useEffect(() => {
        fetchEmployees();
    }, [selectedSectorId]);

    const handleSave = async (data: any) => {
        try {
            if (editingEmployee) {
                await api.put(`/api/schedules/employees/${editingEmployee.id}`, data);
            } else {
                await api.post('/api/schedules/employees', data);
            }
            fetchEmployees();
            setIsModalOpen(false);
            setEditingEmployee(null);
        } catch (error) {
            console.error(error);
            alert('Erro ao salvar funcionário');
        }
    };

    const handleEdit = (emp: any) => {
        setEditingEmployee(emp);
        setIsModalOpen(true);
    };

    const handleNew = () => {
        setEditingEmployee(null);
        setIsModalOpen(true);
    };

    if (sectors.length === 0) return <div className="p-8 text-center text-gray-500">Crie um setor primeiro para gerenciar funcionários.</div>;

    const selectedSector = sectors.find((s: any) => s.id === selectedSectorId);

    return (
        <div>
            {/* Sector Tabs */}
            <div className="flex gap-4 mb-8 overflow-x-auto pb-2 scrollbar-thin">
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

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Funcionários do Setor</h2>
                <button
                    onClick={handleNew}
                    disabled={!selectedSectorId}
                    className="btn btn-primary"
                >
                    <Plus size={18} /> Novo Funcionário
                </button>
            </div>

            <div className="table-container">
                <table className="table min-w-full">
                    <thead>
                        <tr>
                            <th>Nome</th>
                            <th>Tipo Escala</th>
                            {selectedSector?.numberOfShifts === 2 && <th>Turno</th>}
                            <th>Restrições</th>
                            <th className="text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody>
                        {employees.map((emp: any) => (
                            <tr key={emp.id}>
                                <td className="font-medium text-white">{emp.name}</td>
                                <td>
                                    <span className={`badge ${emp.scheduleType === '12x36' ? 'badge-purple' : 'badge-info'}`}>
                                        {emp.scheduleType || '6x1'}
                                    </span>
                                    {emp.scheduleType !== '12x36' && emp.extraDaysOffPerMonth > 0 && (
                                        <span className="ml-2 text-xs text-green-400">
                                            + {emp.extraDaysOffPerMonth} extra(s)
                                        </span>
                                    )}
                                </td>
                                {selectedSector?.numberOfShifts === 2 && (
                                    <td>
                                        <span className="bg-white/5 px-2 py-1 rounded text-xs text-gray-300">
                                            {emp.scheduleType === '12x36'
                                                ? '1º e 2º Turno'
                                                : emp.shift === '1' ? '1º Turno' : emp.shift === '2' ? '2º Turno' : '-'}
                                        </span>
                                    </td>
                                )}
                                <td className="text-sm text-gray-400">
                                    <div className="flex gap-2 flex-wrap">
                                        {emp.unavailableWeekdays?.length > 0 && (
                                            <span className="badge badge-warning">
                                                Indisp: {emp.unavailableWeekdays.join(', ')}
                                            </span>
                                        )}
                                        {emp.fixedOffDates?.length > 0 && (
                                            <span className="badge badge-purple">
                                                {emp.fixedOffDates.length} Folga(s) Fixa(s)
                                            </span>
                                        )}
                                    </div>
                                </td>
                                <td className="text-right flex justify-end gap-2">
                                    <button onClick={() => handleEdit(emp)} className="text-blue-400 hover:text-blue-300 p-2 hover:bg-blue-500/10 rounded-lg transition-colors">
                                        <Pencil size={18} />
                                    </button>
                                    <button
                                        onClick={async () => {
                                            if (confirm('Tem certeza que deseja excluir este funcionário?')) {
                                                try {
                                                    await api.delete(`/api/schedules/employees/${emp.id}`);
                                                    fetchEmployees();
                                                } catch (error) {
                                                    console.error(error);
                                                    alert('Erro ao excluir funcionário');
                                                }
                                            }
                                        }}
                                        className="text-red-400 hover:text-red-300 p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {employees.length === 0 && <p className="text-center p-8 text-gray-500">Nenhum funcionário cadastrado neste setor.</p>}
            </div>

            {isModalOpen && selectedSector && (
                <EmployeeModal
                    sector={selectedSector}
                    employee={editingEmployee}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={handleSave}
                />
            )}
        </div>
    );
}
