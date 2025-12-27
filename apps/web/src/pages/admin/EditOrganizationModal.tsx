import { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { X, Loader2 } from 'lucide-react';

interface EditOrganizationModalProps {
    isOpen: boolean;
    onClose: () => void;
    organization: any;
}

export function EditOrganizationModal({ isOpen, onClose, organization }: EditOrganizationModalProps) {
    const queryClient = useQueryClient();
    const [formData, setFormData] = useState({
        // Organization
        name: '',
        slug: '',

        // Address
        street: '',
        number: '',
        neighborhood: '',
        city: '',
        state: '',
        zipCode: '',

        // Plan
        plan: 'free_trial',

        // Director
        directorName: '',
        directorEmail: '',
    });

    useEffect(() => {
        if (organization) {
            // Get address info from the first cost center or empty defaults
            const primaryCostCenter = organization.costCenters?.[0] || {};

            setFormData({
                name: organization.name || '',
                slug: organization.slug || '',

                // Address
                street: primaryCostCenter.street || '',
                number: primaryCostCenter.number || '',
                neighborhood: primaryCostCenter.neighborhood || '',
                city: primaryCostCenter.city || '',
                state: primaryCostCenter.state || '',
                zipCode: primaryCostCenter.zipCode || '',

                // Plan
                plan: primaryCostCenter.plan || 'free_trial',

                directorName: organization.directorName === 'Não definido' ? '' : organization.directorName || '',
                directorEmail: organization.directorEmail || '',
            });
        }
    }, [organization]);

    const updateMutation = useMutation({
        mutationFn: async (data: typeof formData) => {
            const res = await api.put(`/api/organizations/${organization.id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Organização atualizada com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['organizations'] });
            onClose();
        },
        onError: (error: any) => {
            const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || 'Erro ao atualizar organização';
            toast.error(errorMessage);
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        updateMutation.mutate(formData);
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    if (!isOpen || !organization) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-6 border-b border-white/10 sticky top-0 bg-gray-900 z-10">
                    <h2 className="text-xl font-bold text-white">Editar Organização</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    {/* Organization Info */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white/90 border-b border-white/10 pb-2">Dados da Organização</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-400 mb-1">Nome da Organização</label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-400 mb-1">Slug (URL)</label>
                                <input
                                    type="text"
                                    name="slug"
                                    required
                                    value={formData.slug}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Address */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white/90 border-b border-white/10 pb-2">Endereço</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-400 mb-1">Logradouro</label>
                                <input
                                    type="text"
                                    name="street"
                                    value={formData.street}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Número</label>
                                <input
                                    type="text"
                                    name="number"
                                    value={formData.number}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Bairro</label>
                                <input
                                    type="text"
                                    name="neighborhood"
                                    value={formData.neighborhood}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Cidade</label>
                                <input
                                    type="text"
                                    name="city"
                                    value={formData.city}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">Estado (UF)</label>
                                <input
                                    type="text"
                                    name="state"
                                    maxLength={2}
                                    value={formData.state}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">CEP</label>
                                <input
                                    type="text"
                                    name="zipCode"
                                    value={formData.zipCode}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Plan */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white/90 border-b border-white/10 pb-2">Plano</h3>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Selecione o Plano</label>
                            <select
                                name="plan"
                                value={formData.plan}
                                onChange={handleChange}
                                className="w-full bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                            >
                                <option value="free_trial">Teste Grátis (30 dias)</option>
                                <option value="basic">Basic</option>
                                <option value="pro">Pro</option>
                            </select>
                        </div>
                    </div>

                    {/* Director */}
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white/90 border-b border-white/10 pb-2">Diretor</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-400 mb-1">Nome Completo</label>
                                <input
                                    type="text"
                                    name="directorName"
                                    required
                                    value={formData.directorName}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                            <div className="md:col-span-2">
                                <label className="block text-sm font-medium text-gray-400 mb-1">E-mail</label>
                                <input
                                    type="email"
                                    name="directorEmail"
                                    required
                                    value={formData.directorEmail}
                                    onChange={handleChange}
                                    className="w-full bg-gray-800 border-gray-700 text-white rounded-lg focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={updateMutation.isPending}
                            className="flex items-center gap-2 px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                            Salvar Alterações
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
