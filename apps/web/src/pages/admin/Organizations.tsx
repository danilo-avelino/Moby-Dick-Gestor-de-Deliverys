import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Building, Shield, Plus, Users, Store, AlertTriangle, CheckCircle, Wallet, Ban, Search, Filter } from 'lucide-react';
import { useAuthStore } from '../../stores/auth';
import toast from 'react-hot-toast';
import { UserRole } from 'types';
import { CreateOrganizationModal } from './CreateOrganizationModal';
import { EditOrganizationModal } from './EditOrganizationModal';
import { useNavigate } from 'react-router-dom';

export default function Organizations() {
    const { user } = useAuthStore();
    const navigate = useNavigate();
    const [impersonatingId, setImpersonatingId] = useState<string | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [editingOrg, setEditingOrg] = useState<any>(null);

    // Filters
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string | null>(null);

    const { data: organizations, isLoading } = useQuery({
        queryKey: ['organizations'],
        queryFn: () => api.get('/api/organizations').then(r => r.data.data),
    });

    // Compute Dashboard KPIs
    const kpis = useMemo(() => {
        if (!organizations) return { active: 0, trial: 0, faults: 0, incomplete: 0, mrr: 0 };
        return organizations.reduce((acc: any, org: any) => {
            if (org.status === 'ACTIVE') acc.active++;
            if (org.plan === 'free_trial' || org.plan === 'trial') acc.trial++;
            if (org.health === 'CRITICAL' || org.health === 'WARNING') acc.faults++;
            if (org.onboardingStatus === 'PENDING') acc.incomplete++;

            // Dummy MRR calculation
            if (org.plan === 'pro') acc.mrr += 199;
            if (org.plan === 'basic') acc.mrr += 99;

            return acc;
        }, { active: 0, trial: 0, faults: 0, incomplete: 0, mrr: 0 });
    }, [organizations]);

    const filteredOrgs = useMemo(() => {
        if (!organizations) return [];
        return organizations.filter((org: any) => {
            const matchesSearch =
                org.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                org.slug.toLowerCase().includes(searchTerm.toLowerCase()) ||
                org.directorName?.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesFilter = filterStatus ? org.health === filterStatus || org.status === filterStatus : true;

            return matchesSearch && matchesFilter;
        });
    }, [organizations, searchTerm, filterStatus]);


    const impersonateMutation = useMutation({
        mutationFn: async (orgId: string) => {
            const res = await api.post(`/api/organizations/${orgId}/impersonate`);
            return res.data;
        },
        onSuccess: (data) => {
            if (data.success && data.data) {
                const { accessToken, user: impersonatedUser } = data.data;

                api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;

                useAuthStore.setState({
                    accessToken: accessToken,
                    user: impersonatedUser,
                    isAuthenticated: true
                });

                toast.success(`Impersonando organização: ${impersonatedUser.organizationId}`);
                window.location.href = '/';
            }
        },
        onError: (error: any) => {
            toast.error(error.message || 'Falha ao iniciar impersonação');
        }
    });

    if (isLoading) {
        return <div className="p-8 text-white flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-primary-500 border-t-transparent rounded-full animate-spin"></div>
                <p className="text-gray-400">Carregando painel administrativo...</p>
            </div>
        </div>;
    }

    if (user?.role !== UserRole.SUPER_ADMIN) {
        return <div className="p-8 text-red-500">Acesso Negado</div>;
    }

    return (
        <div className="space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Administração de Organizações</h1>
                    <p className="text-gray-400">Visão Geral e Governança</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors shadow-lg shadow-primary-500/20"
                >
                    <Plus className="w-4 h-4" />
                    Nova Organização
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-gray-900 border border-white/10 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm font-medium">Ativas / Trial</span>
                        <CheckCircle className="w-5 h-5 text-green-500" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-white">{kpis.active}</span>
                        <span className="text-sm text-gray-500 mb-1">/ {kpis.trial} em trial</span>
                    </div>
                </div>

                <div className="bg-gray-900 border border-white/10 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm font-medium">MRR Estimado</span>
                        <Wallet className="w-5 h-5 text-blue-500" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-white">R$ {kpis.mrr.toLocaleString()}</span>
                        <span className="text-sm text-green-500 mb-1">+12%</span>
                    </div>
                </div>

                <div className="bg-gray-900 border border-white/10 rounded-xl p-5 cursor-pointer hover:border-red-500/50 transition-colors" onClick={() => setFilterStatus('CRITICAL')}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm font-medium">Atenção / Crítico</span>
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-amber-500">{kpis.faults}</span>
                        <span className="text-sm text-gray-500 mb-1">orgs</span>
                    </div>
                </div>

                <div className="bg-gray-900 border border-white/10 rounded-xl p-5 cursor-pointer hover:border-purple-500/50 transition-colors" onClick={() => setFilterStatus('PENDING')}>
                    <div className="flex items-center justify-between mb-2">
                        <span className="text-gray-400 text-sm font-medium">Incompletas</span>
                        <Ban className="w-5 h-5 text-gray-400" />
                    </div>
                    <div className="flex items-end gap-2">
                        <span className="text-3xl font-bold text-gray-400">{kpis.incomplete}</span>
                        <span className="text-sm text-gray-500 mb-1">onboarding</span>
                    </div>
                </div>
            </div>

            {/* Filters & Actions */}
            <div className="flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome, slug ou diretor..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full bg-gray-900 border border-white/10 rounded-lg pl-10 pr-4 py-2.5 text-white focus:ring-primary-500 focus:border-primary-500"
                    />
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => setFilterStatus(null)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border border-white/10 transition-colors ${!filterStatus ? 'bg-white/10 text-white' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
                        Todos
                    </button>
                    <button
                        onClick={() => setFilterStatus('active')}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border border-white/10 transition-colors ${filterStatus === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/50' : 'bg-gray-900 text-gray-400 hover:text-white'}`}>
                        Ativos
                    </button>

                    <button className="px-4 py-2 bg-gray-900 border border-white/10 rounded-lg text-gray-400 hover:text-white flex items-center gap-2">
                        <Filter className="w-4 h-4" />
                        Filtros
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden shadow-xl">
                <table className="w-full text-left">
                    <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase font-medium tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Organização</th>
                            <th className="px-6 py-4">Plano & Status</th>
                            <th className="px-6 py-4">Diretor</th>
                            <th className="px-6 py-4 text-center">Métricas</th>
                            <th className="px-6 py-4 text-center">Saúde</th>
                            <th className="px-6 py-4">Onboarding</th>
                            <th className="px-6 py-4 text-right">Ações</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5 text-gray-300">
                        {filteredOrgs?.map((org: any) => (
                            <tr key={org.id} className="hover:bg-white/5 transition-colors group">
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center text-primary-500 group-hover:bg-primary-500/20 transition-colors">
                                            <Building className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <span className="font-medium text-white block">{org.name}</span>
                                            <span className="text-xs text-gray-500 font-mono">/{org.slug}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-sm font-medium text-white capitalize">{org.plan?.replace('_', ' ')}</span>
                                        <span className={`text-xs ${org.billingStatus === 'ACTIVE' ? 'text-green-500' :
                                            org.billingStatus === 'PAST_DUE' ? 'text-red-500' : 'text-gray-500'
                                            }`}>
                                            {org.billingStatus}
                                        </span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex flex-col">
                                        <span className={`text-sm ${!org.directorEmail ? 'text-red-400 font-medium' : 'text-white'}`}>
                                            {org.directorName}
                                        </span>
                                        <span className="text-xs text-gray-500">{org.directorEmail || 'Sem e-mail'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center justify-center gap-4 text-xs text-gray-500">
                                        <div className="flex flex-col items-center">
                                            <Store className="w-4 h-4 text-gray-400 mb-0.5" />
                                            <span>{org.counts?.restaurants || 0}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <Users className="w-4 h-4 text-gray-400 mb-0.5" />
                                            <span>{org.counts?.users || 0}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-6 py-4 text-center">
                                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${org.health === 'OK' ? 'bg-green-500/10 text-green-500' :
                                        org.health === 'WARNING' ? 'bg-amber-500/10 text-amber-500' :
                                            'bg-red-500/10 text-red-500'
                                        }`}>
                                        {org.health}
                                    </span>
                                    {org.healthIssues?.length > 0 && (
                                        <div className="text-[10px] text-red-400 mt-1 truncate max-w-[100px] mx-auto">
                                            {org.healthIssues[0]}
                                        </div>
                                    )}
                                </td>
                                <td className="px-6 py-4">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${org.onboardingStatus === 'COMPLETE' ? 'bg-green-500' : 'bg-gray-600'
                                            }`} />
                                        <span className="text-sm text-gray-400 capitalize">
                                            {org.onboardingStatus.toLowerCase()}
                                        </span>
                                    </div>
                                    <span className="text-xs text-gray-600">Since {new Date(org.createdAt).toLocaleDateString()}</span>
                                </td>
                                <td className="px-6 py-4 text-right">
                                    <div className="flex items-center justify-end gap-2">
                                        <button
                                            onClick={() => impersonateMutation.mutate(org.id)}
                                            disabled={impersonateMutation.isPending}
                                            className="p-2 text-gray-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-colors"
                                            title="Impersonar"
                                        >
                                            <Shield className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => setEditingOrg(org)}
                                            className="px-3 py-1.5 text-xs font-medium bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors border border-white/10"
                                        >
                                            Editar
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                        {(!filteredOrgs || filteredOrgs.length === 0) && (
                            <tr>
                                <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                                    <div className="flex flex-col items-center gap-2">
                                        <Search className="w-8 h-8 opacity-20" />
                                        <p>Nenhuma organização encontrada com os filtros atuais.</p>
                                    </div>
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            <CreateOrganizationModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
            />

            <EditOrganizationModal
                isOpen={!!editingOrg}
                onClose={() => setEditingOrg(null)}
                organization={editingOrg}
            />
        </div >
    );
}
