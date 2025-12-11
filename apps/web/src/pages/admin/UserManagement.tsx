import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Plus, Search, Filter, Pencil, Power, User, Shield, Check, X, Lock } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate, cn } from '../../lib/utils';
import { useAuthStore } from '../../stores/auth';

const ROLES = [
    { value: 'DIRETOR', label: 'Diretor' },
    { value: 'ESTOQUE', label: 'Estoque' },
    { value: 'CHEF_DE_COZINHA', label: 'Chef de Cozinha' },
    { value: 'LIDER_DESPACHO', label: 'Líder de Despacho' },
];

export default function UserManagement() {
    const { user: currentUser } = useAuthStore();
    const queryClient = useQueryClient();

    // Filters
    const [search, setSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('');
    const [restaurantFilter, setRestaurantFilter] = useState('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<any>(null);

    // Data Fetching
    const { data: users, isLoading } = useQuery({
        queryKey: ['users', search, roleFilter, statusFilter, restaurantFilter],
        queryFn: () => api.get('/api/users', { params: { search, role: roleFilter, status: statusFilter, restaurantId: restaurantFilter } }).then(r => r.data.data),
        enabled: currentUser?.role === 'DIRETOR',
    });

    const { data: restaurants } = useQuery({
        queryKey: ['restaurants'],
        queryFn: () => api.get('/api/restaurants').then(r => r.data.data),
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: any) => api.post('/api/users', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsModalOpen(false);
            setEditingUser(null);
            toast.success('Usuário criado com sucesso!');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao criar usuário'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/api/users/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            setIsModalOpen(false);
            setEditingUser(null);
            toast.success('Usuário atualizado com sucesso!');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao atualizar usuário'),
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/api/users/${id}/status`, { isActive }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['users'] });
            toast.success('Status atualizado!');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao alterar status'),
    });

    const handleEdit = (user: any) => {
        setEditingUser(user);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingUser(null);
        setIsModalOpen(true);
    };

    const handleToggleStatus = (user: any) => {
        if (user.isActive) {
            if (!confirm(`Tem certeza que deseja desativar ${user.firstName}? Ele perderá acesso ao sistema.`)) return;
        }
        toggleStatusMutation.mutate({ id: user.id, isActive: !user.isActive });
    };

    if (currentUser?.role !== 'DIRETOR') {
        return (
            <div className="flex flex-col items-center justify-center h-[60vh] text-center">
                <Shield className="w-16 h-16 text-gray-600 mb-4" />
                <h2 className="text-xl font-bold text-white">Acesso Restrito</h2>
                <p className="text-gray-400">Apenas Diretores podem acessar esta página.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-white">Gestão de Usuários</h1>
                    <p className="text-gray-400">Controle de acesso e cargos da equipe</p>
                </div>
                <button onClick={handleCreate} className="btn-primary">
                    <Plus className="w-5 h-5 mr-2" />
                    Novo Usuário
                </button>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou email..."
                        className="input pl-10 w-full"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="input md:w-48"
                    value={roleFilter}
                    onChange={e => setRoleFilter(e.target.value)}
                >
                    <option value="">Todos os Cargos</option>
                    {ROLES.map(r => (
                        <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                </select>

                {/* Restaurant Filter */}
                <select
                    className="input md:w-48"
                    value={restaurantFilter}
                    onChange={e => setRestaurantFilter(e.target.value)}
                >
                    <option value="">Todos Restaurantes</option>
                    {restaurants?.map((r: any) => (
                        <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                </select>

                <select
                    className="input md:w-48"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                >
                    <option value="">Todos os Status</option>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
                {
                    (search || roleFilter || statusFilter || restaurantFilter) && (
                        <button
                            onClick={() => { setSearch(''); setRoleFilter(''); setStatusFilter(''); setRestaurantFilter(''); }}
                            className="btn-ghost"
                        >
                            Limpar
                        </button>
                    )
                }
            </div >

            {/* Table */}
            < div className="glass-card overflow-hidden" >
                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left p-4 text-gray-400 font-medium">Usuário</th>
                                <th className="text-left p-4 text-gray-400 font-medium">Cargo</th>
                                <th className="text-left p-4 text-gray-400 font-medium">Restaurante</th>
                                <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                                <th className="text-right p-4 text-gray-400 font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={5} className="p-12 text-center text-gray-500">Carregando usuários...</td></tr>
                            ) : users?.length === 0 ? (
                                <tr><td colSpan={5} className="p-12 text-center text-gray-500">Nenhum usuário encontrado.</td></tr>
                            ) : (
                                users?.map((u: any) => (
                                    <tr key={u.id} className="hover:bg-white/5 border-b border-white/5 last:border-0 group transition-colors">
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
                                                    <User className="w-5 h-5 text-gray-400" />
                                                </div>
                                                <div>
                                                    <p className="font-medium text-white">{u.firstName} {u.lastName}</p>
                                                    <p className="text-xs text-gray-500">{u.email}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "px-2 py-1 rounded text-xs font-bold uppercase tracking-wider",
                                                u.role === 'DIRETOR' ? "bg-purple-500/20 text-purple-400" :
                                                    u.role === 'ESTOQUE' ? "bg-blue-500/20 text-blue-400" :
                                                        u.role === 'CHEF_DE_COZINHA' ? "bg-amber-500/20 text-amber-400" :
                                                            "bg-gray-500/20 text-gray-400"
                                            )}>
                                                {ROLES.find(r => r.value === u.role)?.label || u.role}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-400">
                                            {u.restaurant?.name || '---'}
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "flex items-center gap-1.5 text-xs font-medium w-fit px-2 py-1 rounded-full",
                                                u.isActive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                                            )}>
                                                <span className={cn("w-1.5 h-1.5 rounded-full", u.isActive ? "bg-green-500" : "bg-red-500")} />
                                                {u.isActive ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(u)}
                                                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(u)}
                                                    className={cn(
                                                        "p-2 rounded-lg transition-colors",
                                                        u.isActive ? "text-red-400 hover:bg-red-500/10" : "text-green-400 hover:bg-green-500/10"
                                                    )}
                                                    title={u.isActive ? "Desativar" : "Ativar"}
                                                >
                                                    <Power className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div >

            {/* Modal */}
            {
                isModalOpen && (
                    <UserFormModal
                        user={editingUser}
                        isOpen={isModalOpen}
                        onClose={() => setIsModalOpen(false)}
                        onSubmit={(data: any) => editingUser
                            ? updateMutation.mutate({ id: editingUser.id, data })
                            : createMutation.mutate(data)
                        }
                        isLoading={createMutation.isPending || updateMutation.isPending}
                        currentUserRole={currentUser?.role}
                    />
                )
            }
        </div >
    );
}

function UserFormModal({ user, isOpen, onClose, onSubmit, isLoading }: any) {
    // Form State
    const [formData, setFormData] = useState({
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        role: user?.role || 'ESTOQUE',
        restaurantId: user?.restaurantId || '',
        password: '', // Only for new or reset
        isActive: user?.isActive ?? true,
    });

    const { data: restaurants } = useQuery({
        queryKey: ['restaurants-list'],
        queryFn: () => api.get('/api/restaurants').then(r => Array.isArray(r.data.data) ? r.data.data : [r.data.data]),
    });

    const isChef = formData.role === 'CHEF_DE_COZINHA';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (isChef && !formData.restaurantId) {
            toast.error('Selecione um restaurante para o Chef de Cozinha');
            return;
        }

        // Block if Chef and no restaurants available to pick
        if (isChef && (!restaurants || restaurants.length === 0)) {
            toast.error('Cadastre um restaurante nas Configurações primeiro.');
            return;
        }

        const payload: any = { ...formData };
        if (!payload.password) delete payload.password; // Don't send empty password on edit

        // Convert empty string to null for Prisma
        if (payload.restaurantId === '') {
            payload.restaurantId = null;
        }

        onSubmit(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-md animate-scale-in border border-white/10 shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                    <h2 className="text-xl font-bold text-white">
                        {user ? 'Editar Usuário' : 'Novo Usuário'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">Nome *</label>
                            <input
                                required
                                className="input w-full"
                                value={formData.firstName}
                                onChange={e => setFormData({ ...formData, firstName: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="label">Sobrenome *</label>
                            <input
                                required
                                className="input w-full"
                                value={formData.lastName}
                                onChange={e => setFormData({ ...formData, lastName: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label">Email / Login *</label>
                        <input
                            required
                            type="email"
                            className="input w-full"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    {!user && (
                        <div>
                            <label className="label">Senha Inicial *</label>
                            <input
                                required
                                type="password"
                                className="input w-full"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                minLength={6}
                            />
                        </div>
                    )}

                    {user && (
                        <div>
                            <label className="label">Nova Senha (Opcional)</label>
                            <input
                                type="password"
                                className="input w-full"
                                placeholder="Deixe em branco para manter"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                minLength={6}
                            />
                        </div>
                    )}

                    <div>
                        <label className="label">Cargo *</label>
                        <select
                            className="input w-full"
                            value={formData.role}
                            onChange={e => setFormData({ ...formData, role: e.target.value })}
                        >
                            {ROLES.map(r => (
                                <option key={r.value} value={r.value}>{r.label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Logic to show Restaurant Select for ALL Users */}
                    <div className="animate-fade-in">
                        <label className="label">
                            Restaurante Vinculado
                            {isChef && <span className="text-red-500 ml-1">*</span>}
                        </label>

                        {restaurants && restaurants.length > 0 ? (
                            <select
                                required={isChef}
                                className={cn(
                                    "input w-full",
                                    !formData.restaurantId && isChef && "border-amber-500"
                                )}
                                value={formData.restaurantId || ''}
                                onChange={e => setFormData({ ...formData, restaurantId: e.target.value })}
                            >
                                <option value="">
                                    {isChef ? "Selecione um restaurante..." : "Sem vínculo (Global)"}
                                </option>
                                {restaurants.map((r: any) => (
                                    <option key={r.id} value={r.id}>{r.name}</option>
                                ))}
                            </select>
                        ) : (
                            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-200">
                                <p className="font-bold mb-1">Nenhum restaurante encontrado!</p>
                                <p>É necessário cadastrar um restaurante nas Configurações para vincular usuários.</p>
                                {isChef && (
                                    <p className="mt-2 text-xs text-red-400 font-medium">
                                        Impossível criar Chef sem restaurante.
                                    </p>
                                )}
                            </div>
                        )}

                        {isChef && <p className="text-xs text-amber-500 mt-1">Obrigatório para Chefs.</p>}
                        {!isChef && <p className="text-xs text-gray-500 mt-1">Opcional. Vincule para restringir acesso.</p>}
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="rounded bg-white/10 border-white/20 text-primary-500 focus:ring-primary-500"
                                checked={formData.isActive}
                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                            />
                            <span className="text-sm text-gray-300">Usuário Ativo (Pode acessar o sistema)</span>
                        </label>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t border-white/10 mt-6">
                        <button type="button" onClick={onClose} className="btn-ghost" disabled={isLoading}>
                            Cancelar
                        </button>
                        <button type="submit" className="btn-primary min-w-[120px]" disabled={isLoading}>
                            {isLoading ? 'Salvando...' : 'Salvar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
