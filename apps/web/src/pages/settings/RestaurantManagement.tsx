import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Plus, Search, Pencil, Trash2, Building, MapPin, Power, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '../../lib/utils';

export function RestaurantManagement() {
    const queryClient = useQueryClient();
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'active' | 'inactive' | ''>('');

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRestaurant, setEditingRestaurant] = useState<any>(null);

    // Data Fetching
    const { data: restaurants, isLoading } = useQuery({
        queryKey: ['admin-restaurants', search, statusFilter],
        queryFn: () => api.get('/api/restaurants', { params: { search, status: statusFilter } }).then(r => r.data.data),
    });

    // Mutations
    const createMutation = useMutation({
        mutationFn: (data: any) => api.post('/api/restaurants', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
            setIsModalOpen(false);
            setEditingRestaurant(null);
            toast.success('Restaurante criado com sucesso!');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao criar restaurante'),
    });

    const updateMutation = useMutation({
        mutationFn: ({ id, data }: { id: string; data: any }) => api.put(`/api/restaurants/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
            setIsModalOpen(false);
            setEditingRestaurant(null);
            toast.success('Restaurante atualizado com sucesso!');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao atualizar restaurante'),
    });

    const toggleStatusMutation = useMutation({
        mutationFn: ({ id, isActive }: { id: string; isActive: boolean }) => api.patch(`/api/restaurants/${id}/status`, { isActive }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-restaurants'] });
            toast.success('Status atualizado!');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao alterar status'),
    });

    const handleEdit = (restaurant: any) => {
        setEditingRestaurant(restaurant);
        setIsModalOpen(true);
    };

    const handleCreate = () => {
        setEditingRestaurant(null);
        setIsModalOpen(true);
    };

    const handleToggleStatus = (restaurant: any) => {
        if (restaurant.isActive) {
            if (!confirm(`Desativar o restaurante ${restaurant.name}? Usuários vinculados podem perder acesso.`)) return;
        }
        toggleStatusMutation.mutate({ id: restaurant.id, isActive: !restaurant.isActive });
    };

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-white">Restaurantes</h2>
                    <p className="text-gray-400">Gerencie as unidades e filiais</p>
                </div>
                <button onClick={handleCreate} className="btn-primary">
                    <Plus className="w-5 h-5 mr-2" />
                    Adicionar Restaurante
                </button>
            </div>

            {/* Filters */}
            <div className="glass-card p-4 flex flex-col md:flex-row gap-4">
                <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome..."
                        className="input pl-10 w-full"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <select
                    className="input md:w-48"
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                >
                    <option value="">Todos os Status</option>
                    <option value="active">Ativo</option>
                    <option value="inactive">Inativo</option>
                </select>
                {(search || statusFilter) && (
                    <button
                        onClick={() => { setSearch(''); setStatusFilter(''); }}
                        className="btn-ghost"
                    >
                        Limpar
                    </button>
                )}
            </div>

            {/* List */}
            <div className="glass-card overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="table w-full">
                        <thead>
                            <tr className="border-b border-white/5">
                                <th className="text-left p-4 text-gray-400 font-medium">Restaurante</th>
                                <th className="text-left p-4 text-gray-400 font-medium">Localização</th>
                                <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                                <th className="text-left p-4 text-gray-400 font-medium">Usuários</th>
                                <th className="text-right p-4 text-gray-400 font-medium">Ações</th>
                            </tr>
                        </thead>
                        <tbody>
                            {isLoading ? (
                                <tr><td colSpan={5} className="p-12 text-center text-gray-500">Carregando...</td></tr>
                            ) : restaurants?.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center">
                                        <div className="flex flex-col items-center gap-2">
                                            <Building className="w-8 h-8 text-gray-600" />
                                            <p className="text-gray-400">Nenhum restaurante cadastrado.</p>
                                            <button onClick={handleCreate} className="text-primary-400 hover:text-primary-300 text-sm">
                                                Cadastrar o primeiro
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                restaurants?.map((r: any) => (
                                    <tr key={r.id} className="hover:bg-white/5 border-b border-white/5 last:border-0 group transition-colors">
                                        <td className="p-4">
                                            <div>
                                                <p className="font-medium text-white">{r.name}</p>
                                                <p className="text-xs text-gray-500">{r.cnpj || 'Sem CNPJ'}</p>
                                            </div>
                                        </td>
                                        <td className="p-4 text-sm text-gray-400">
                                            <div className="flex items-center gap-1">
                                                <MapPin className="w-3 h-3" />
                                                {r.city ? `${r.city}/${r.state}` : 'Endereço não inf.'}
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <span className={cn(
                                                "flex items-center gap-1.5 text-xs font-medium w-fit px-2 py-1 rounded-full",
                                                r.isActive ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                                            )}>
                                                <span className={cn("w-1.5 h-1.5 rounded-full", r.isActive ? "bg-green-500" : "bg-red-500")} />
                                                {r.isActive ? 'Ativo' : 'Inativo'}
                                            </span>
                                        </td>
                                        <td className="p-4 text-sm text-gray-400">
                                            {r._count?.users || 0} usuários
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(r)}
                                                    className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                                                    title="Editar"
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleToggleStatus(r)}
                                                    className={cn(
                                                        "p-2 rounded-lg transition-colors",
                                                        r.isActive ? "text-red-400 hover:bg-red-500/10" : "text-green-400 hover:bg-green-500/10"
                                                    )}
                                                    title={r.isActive ? "Desativar" : "Ativar"}
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
            </div>

            {/* Modal */}
            {isModalOpen && (
                <RestaurantFormModal
                    restaurant={editingRestaurant}
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSubmit={(data: any) => editingRestaurant
                        ? updateMutation.mutate({ id: editingRestaurant.id, data })
                        : createMutation.mutate(data)
                    }
                    isLoading={createMutation.isPending || updateMutation.isPending}
                />
            )}
        </div>
    );
}

function RestaurantFormModal({ restaurant, isOpen, onClose, onSubmit, isLoading }: any) {
    const [formData, setFormData] = useState({
        name: restaurant?.name || '',
        cnpj: restaurant?.cnpj || '',
        phone: restaurant?.phone || '',
        email: restaurant?.email || '',
        street: restaurant?.address?.street || '', // Adjusted for potential structure difference? No, flat in body usually
        number: restaurant?.address?.number || '',
        city: restaurant?.city || '',
        state: restaurant?.state || '',
        isActive: restaurant?.isActive ?? true,
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name) return toast.error('Nome é obrigatório');
        onSubmit(formData);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-lg animate-scale-in border border-white/10 shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                    <h2 className="text-xl font-bold text-white">
                        {restaurant ? 'Editar Restaurante' : 'Novo Restaurante'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="label">Nome do Restaurante *</label>
                        <div className="relative">
                            <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                required
                                className="input w-full pl-10"
                                placeholder="Ex: Burger House Matriz"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="label">CNPJ (Opcional)</label>
                            <input
                                className="input w-full"
                                value={formData.cnpj}
                                onChange={e => setFormData({ ...formData, cnpj: e.target.value })}
                            />
                        </div>
                        <div>
                            <label className="label">Telefone (Opcional)</label>
                            <input
                                className="input w-full"
                                value={formData.phone}
                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="label">Email (Opcional)</label>
                        <input
                            type="email"
                            className="input w-full"
                            value={formData.email}
                            onChange={e => setFormData({ ...formData, email: e.target.value })}
                        />
                    </div>

                    <div className="border-t border-white/10 pt-4 mt-2">
                        <h4 className="text-sm font-medium text-gray-300 mb-3">Endereço (Opcional)</h4>
                        <div className="grid grid-cols-6 gap-3">
                            <div className="col-span-4">
                                <label className="label text-xs">Cidade</label>
                                <input
                                    className="input w-full"
                                    value={formData.city}
                                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                                />
                            </div>
                            <div className="col-span-2">
                                <label className="label text-xs">Estado</label>
                                <input
                                    className="input w-full"
                                    placeholder="UF"
                                    maxLength={2}
                                    value={formData.state}
                                    onChange={e => setFormData({ ...formData, state: e.target.value.toUpperCase() })}
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3 pt-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                className="rounded bg-white/10 border-white/20 text-primary-500 focus:ring-primary-500"
                                checked={formData.isActive}
                                onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                            />
                            <span className="text-sm text-gray-300">Restaurante Ativo</span>
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
