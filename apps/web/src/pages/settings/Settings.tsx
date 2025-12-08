import { useState } from 'react';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore, CUISINE_TYPES, SubRestaurant, SHIFT_PRESETS } from '../../stores/settings';
import { User, Building, Bell, Palette, Layers, Plus, Trash2, Clock, Pencil, AlertTriangle, ChevronDown } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Settings() {
    const { user } = useAuthStore();
    const { operationMode, setOperationMode, subRestaurants, addSubRestaurant, updateSubRestaurant, deleteSubRestaurant } = useSettingsStore();

    const [showNewRestaurant, setShowNewRestaurant] = useState(false);
    const [editingRestaurant, setEditingRestaurant] = useState<SubRestaurant | null>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<SubRestaurant | null>(null);
    const [newRestaurant, setNewRestaurant] = useState({
        name: '',
        cuisineType: '',
        shifts: [{ id: '1', name: 'Almoço', startTime: '11:00', endTime: '15:00' }],
    });

    const [showShiftPresets, setShowShiftPresets] = useState(false);

    const handleAddShift = () => {
        setNewRestaurant({
            ...newRestaurant,
            shifts: [...newRestaurant.shifts, { id: Date.now().toString(), name: '', startTime: '18:00', endTime: '23:00' }],
        });
    };

    const handleAddPresetShift = (preset: typeof SHIFT_PRESETS[0]) => {
        // Check if shift already exists
        const exists = newRestaurant.shifts.some(s => s.name === preset.name);
        if (exists) {
            toast.error(`Turno "${preset.name}" já adicionado`);
            return;
        }
        setNewRestaurant({
            ...newRestaurant,
            shifts: [...newRestaurant.shifts, {
                id: Date.now().toString(),
                name: preset.name,
                startTime: preset.startTime,
                endTime: preset.endTime
            }],
        });
        setShowShiftPresets(false);
    };

    const handleRemoveShift = (shiftId: string) => {
        setNewRestaurant({
            ...newRestaurant,
            shifts: newRestaurant.shifts.filter(s => s.id !== shiftId),
        });
    };

    const handleUpdateShift = (shiftId: string, field: string, value: string) => {
        setNewRestaurant({
            ...newRestaurant,
            shifts: newRestaurant.shifts.map(s => s.id === shiftId ? { ...s, [field]: value } : s),
        });
    };

    const handleCreateRestaurant = () => {
        if (!newRestaurant.name || !newRestaurant.cuisineType) {
            toast.error('Preencha nome e tipo de culinária');
            return;
        }
        addSubRestaurant({
            ...newRestaurant,
            integrations: { logistics: [], sales: [] },
        });
        toast.success('Restaurante criado com sucesso!');
        setShowNewRestaurant(false);
        setNewRestaurant({
            name: '',
            cuisineType: '',
            shifts: [{ id: '1', name: 'Almoço', startTime: '11:00', endTime: '15:00' }],
        });
    };

    const handleEditRestaurant = (rest: SubRestaurant) => {
        setEditingRestaurant(rest);
        setNewRestaurant({
            name: rest.name,
            cuisineType: rest.cuisineType,
            shifts: rest.shifts,
        });
    };

    const handleSaveEdit = () => {
        if (!editingRestaurant) return;
        if (!newRestaurant.name || !newRestaurant.cuisineType) {
            toast.error('Preencha nome e tipo de culinária');
            return;
        }
        updateSubRestaurant(editingRestaurant.id, {
            name: newRestaurant.name,
            cuisineType: newRestaurant.cuisineType,
            shifts: newRestaurant.shifts,
        });
        toast.success('Restaurante atualizado!');
        setEditingRestaurant(null);
        setNewRestaurant({
            name: '',
            cuisineType: '',
            shifts: [{ id: '1', name: 'Almoço', startTime: '11:00', endTime: '15:00' }],
        });
    };

    const handleConfirmDelete = () => {
        if (!deleteConfirm) return;
        deleteSubRestaurant(deleteConfirm.id);
        toast.success('Restaurante excluído!');
        setDeleteConfirm(null);
    };

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            <div>
                <h1 className="text-2xl font-bold text-white">Configurações</h1>
                <p className="text-gray-400">Gerencie sua conta e preferências</p>
            </div>

            {/* Operation Mode Section */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary-400" /> Modo de Operação
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                    Escolha como deseja gerenciar suas operações
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <button
                        onClick={() => setOperationMode('single')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${operationMode === 'single'
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-white/10 hover:border-white/30'
                            }`}
                    >
                        <h4 className="font-medium text-white">Operação Única</h4>
                        <p className="text-sm text-gray-400 mt-1">
                            Um único restaurante com todas as integrações centralizadas
                        </p>
                    </button>
                    <button
                        onClick={() => setOperationMode('separate')}
                        className={`p-4 rounded-xl border-2 text-left transition-all ${operationMode === 'separate'
                            ? 'border-primary-500 bg-primary-500/10'
                            : 'border-white/10 hover:border-white/30'
                            }`}
                    >
                        <h4 className="font-medium text-white">Operação Separada</h4>
                        <p className="text-sm text-gray-400 mt-1">
                            Múltiplos restaurantes, cada um com suas próprias integrações
                        </p>
                    </button>
                </div>

                {/* Sub-restaurants list (only show when separate mode) */}
                {operationMode === 'separate' && (
                    <div className="mt-6 pt-6 border-t border-white/10">
                        <div className="flex items-center justify-between mb-4">
                            <h4 className="font-medium text-white">Restaurantes ({subRestaurants.length})</h4>
                            <button onClick={() => setShowNewRestaurant(true)} className="btn-primary text-sm">
                                <Plus className="w-4 h-4" /> Criar Restaurante
                            </button>
                        </div>

                        {subRestaurants.length === 0 ? (
                            <p className="text-gray-400 text-center py-4">Nenhum restaurante criado</p>
                        ) : (
                            <div className="space-y-2">
                                {subRestaurants.map((rest) => (
                                    <div key={rest.id} className="flex items-center justify-between p-3 rounded-xl bg-white/5">
                                        <div>
                                            <p className="font-medium text-white">{rest.name}</p>
                                            <p className="text-sm text-gray-400">{rest.cuisineType} • {rest.shifts.length} turno(s)</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleEditRestaurant(rest)}
                                                className="p-2 text-primary-400 hover:bg-primary-500/20 rounded-lg"
                                                title="Editar"
                                            >
                                                <Pencil className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => setDeleteConfirm(rest)}
                                                className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                                title="Excluir"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* New Restaurant Modal */}
            {showNewRestaurant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Criar Novo Restaurante</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="label">Nome do Restaurante *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Ex: Burger House Express"
                                    value={newRestaurant.name}
                                    onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label">Tipo de Culinária *</label>
                                <select
                                    className="input"
                                    value={newRestaurant.cuisineType}
                                    onChange={(e) => setNewRestaurant({ ...newRestaurant, cuisineType: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    {CUISINE_TYPES.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="label mb-0">Turnos de Operação</label>
                                    <div className="flex gap-2">
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowShiftPresets(!showShiftPresets)}
                                                className="btn-ghost text-sm"
                                            >
                                                <ChevronDown className="w-4 h-4" /> Turno Padrão
                                            </button>
                                            {showShiftPresets && (
                                                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-gray-800 border border-white/20 shadow-xl z-50 overflow-hidden">
                                                    {SHIFT_PRESETS.map((preset) => (
                                                        <button
                                                            key={preset.id}
                                                            onClick={() => handleAddPresetShift(preset)}
                                                            className="w-full px-4 py-2 text-left hover:bg-white/10 flex items-center gap-2 text-sm text-white"
                                                        >
                                                            <span>{preset.icon}</span>
                                                            <span>{preset.name}</span>
                                                            <span className="text-gray-400 text-xs ml-auto">
                                                                {preset.startTime} - {preset.endTime}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={handleAddShift} className="btn-ghost text-sm">
                                            <Plus className="w-4 h-4" /> Personalizado
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {newRestaurant.shifts.map((shift) => (
                                        <div key={shift.id} className="p-3 rounded-xl bg-white/5 border border-white/10">
                                            <div className="flex items-center gap-3">
                                                <Clock className="w-4 h-4 text-gray-400" />
                                                <input
                                                    type="text"
                                                    className="input flex-1"
                                                    placeholder="Nome do turno"
                                                    value={shift.name}
                                                    onChange={(e) => handleUpdateShift(shift.id, 'name', e.target.value)}
                                                />
                                                <input
                                                    type="time"
                                                    className="input w-28"
                                                    value={shift.startTime}
                                                    onChange={(e) => handleUpdateShift(shift.id, 'startTime', e.target.value)}
                                                />
                                                <span className="text-gray-400">até</span>
                                                <input
                                                    type="time"
                                                    className="input w-28"
                                                    value={shift.endTime}
                                                    onChange={(e) => handleUpdateShift(shift.id, 'endTime', e.target.value)}
                                                />
                                                {newRestaurant.shifts.length > 1 && (
                                                    <button
                                                        onClick={() => handleRemoveShift(shift.id)}
                                                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button onClick={() => setShowNewRestaurant(false)} className="btn-ghost">Cancelar</button>
                            <button onClick={handleCreateRestaurant} className="btn-primary">Criar Restaurante</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Restaurant Modal */}
            {editingRestaurant && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-lg max-h-[90vh] overflow-y-auto m-4">
                        <h3 className="text-lg font-semibold text-white mb-4">Editar Restaurante</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="label">Nome do Restaurante *</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="Ex: Burger House Express"
                                    value={newRestaurant.name}
                                    onChange={(e) => setNewRestaurant({ ...newRestaurant, name: e.target.value })}
                                />
                            </div>

                            <div>
                                <label className="label">Tipo de Culinária *</label>
                                <select
                                    className="input"
                                    value={newRestaurant.cuisineType}
                                    onChange={(e) => setNewRestaurant({ ...newRestaurant, cuisineType: e.target.value })}
                                >
                                    <option value="">Selecione...</option>
                                    {CUISINE_TYPES.map((type) => (
                                        <option key={type} value={type}>{type}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <label className="label mb-0">Turnos de Operação</label>
                                    <div className="flex gap-2">
                                        <div className="relative">
                                            <button
                                                onClick={() => setShowShiftPresets(!showShiftPresets)}
                                                className="btn-ghost text-sm"
                                            >
                                                <ChevronDown className="w-4 h-4" /> Turno Padrão
                                            </button>
                                            {showShiftPresets && (
                                                <div className="absolute right-0 top-full mt-1 w-48 rounded-xl bg-gray-800 border border-white/20 shadow-xl z-50 overflow-hidden">
                                                    {SHIFT_PRESETS.map((preset) => (
                                                        <button
                                                            key={preset.id}
                                                            onClick={() => handleAddPresetShift(preset)}
                                                            className="w-full px-4 py-2 text-left hover:bg-white/10 flex items-center gap-2 text-sm text-white"
                                                        >
                                                            <span>{preset.icon}</span>
                                                            <span>{preset.name}</span>
                                                            <span className="text-gray-400 text-xs ml-auto">
                                                                {preset.startTime} - {preset.endTime}
                                                            </span>
                                                        </button>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <button onClick={handleAddShift} className="btn-ghost text-sm">
                                            <Plus className="w-4 h-4" /> Personalizado
                                        </button>
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    {newRestaurant.shifts.map((shift) => (
                                        <div key={shift.id} className="p-3 rounded-xl bg-white/5">
                                            <div className="flex items-center gap-3 flex-wrap">
                                                <input
                                                    type="text"
                                                    className="input flex-1 min-w-[120px]"
                                                    placeholder="Nome do turno"
                                                    value={shift.name}
                                                    onChange={(e) => handleUpdateShift(shift.id, 'name', e.target.value)}
                                                />
                                                <input
                                                    type="time"
                                                    className="input w-28"
                                                    value={shift.startTime}
                                                    onChange={(e) => handleUpdateShift(shift.id, 'startTime', e.target.value)}
                                                />
                                                <span className="text-gray-400">até</span>
                                                <input
                                                    type="time"
                                                    className="input w-28"
                                                    value={shift.endTime}
                                                    onChange={(e) => handleUpdateShift(shift.id, 'endTime', e.target.value)}
                                                />
                                                {newRestaurant.shifts.length > 1 && (
                                                    <button
                                                        onClick={() => handleRemoveShift(shift.id)}
                                                        className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button onClick={() => {
                                setEditingRestaurant(null);
                                setNewRestaurant({ name: '', cuisineType: '', shifts: [{ id: '1', name: 'Almoço', startTime: '11:00', endTime: '15:00' }] });
                            }} className="btn-ghost">Cancelar</button>
                            <button onClick={handleSaveEdit} className="btn-primary">Salvar Alterações</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirm && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md m-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Confirmar Exclusão</h3>
                        </div>

                        <p className="text-gray-300 mb-2">
                            Tem certeza que deseja excluir o restaurante <span className="font-semibold text-white">{deleteConfirm.name}</span>?
                        </p>
                        <p className="text-sm text-gray-400 mb-6">
                            Esta ação não pode ser desfeita. Todas as configurações e integrações deste restaurante serão perdidas.
                        </p>

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                            <button onClick={() => setDeleteConfirm(null)} className="btn-ghost">Cancelar</button>
                            <button onClick={handleConfirmDelete} className="btn-primary bg-red-600 hover:bg-red-700">
                                <Trash2 className="w-4 h-4" /> Excluir
                            </button>
                        </div>
                    </div>
                </div>
            )}


            {/* Profile Section */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <User className="w-5 h-5 text-primary-400" /> Perfil
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="label">Nome</label>
                        <input type="text" className="input" defaultValue={user?.firstName} />
                    </div>
                    <div>
                        <label className="label">Sobrenome</label>
                        <input type="text" className="input" defaultValue={user?.lastName} />
                    </div>
                    <div className="md:col-span-2">
                        <label className="label">Email</label>
                        <input type="email" className="input" defaultValue={user?.email} disabled />
                    </div>
                </div>
                <button className="btn-primary mt-4">Salvar Alterações</button>
            </div>

            {/* Restaurant Section */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Building className="w-5 h-5 text-primary-400" /> Restaurante Principal
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="label">Nome do Restaurante</label>
                        <input type="text" className="input" defaultValue={user?.restaurant?.name} />
                    </div>
                    <div>
                        <label className="label">Meta de CMV (%)</label>
                        <input type="number" step="0.1" className="input" defaultValue="30" />
                    </div>
                    <div>
                        <label className="label">Alerta de CMV (%)</label>
                        <input type="number" step="0.1" className="input" defaultValue="35" />
                    </div>
                </div>
                <button className="btn-primary mt-4">Salvar</button>
            </div>

            {/* Notifications */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Bell className="w-5 h-5 text-primary-400" /> Notificações
                </h3>
                <div className="space-y-4">
                    {[
                        { label: 'Alertas de estoque baixo', enabled: true },
                        { label: 'Alertas de produtos vencendo', enabled: true },
                        { label: 'Alertas de CMV alto', enabled: true },
                        { label: 'Sugestões de compra', enabled: false },
                        { label: 'Relatórios semanais por email', enabled: false },
                    ].map((item, i) => (
                        <div key={i} className="flex items-center justify-between">
                            <span className="text-gray-300">{item.label}</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input type="checkbox" defaultChecked={item.enabled} className="sr-only peer" />
                                <div className="w-11 h-6 bg-gray-700 peer-focus:ring-2 peer-focus:ring-primary-500 rounded-full peer peer-checked:after:translate-x-full after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary-600"></div>
                            </label>
                        </div>
                    ))}
                </div>
            </div>

            {/* Appearance */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Palette className="w-5 h-5 text-primary-400" /> Aparência
                </h3>
                <div>
                    <label className="label">Tema</label>
                    <select className="input max-w-xs">
                        <option value="dark">Escuro</option>
                        <option value="light">Claro</option>
                        <option value="system">Sistema</option>
                    </select>
                </div>
            </div>
        </div>
    );
}
