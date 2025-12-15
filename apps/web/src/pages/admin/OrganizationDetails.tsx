import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import {
    ArrowLeft, Building, Users, Store, CreditCard, Shield,
    Activity, CheckCircle, AlertTriangle, Clock, Ban, Terminal,
    ExternalLink
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../../stores/auth';

type Tab = 'overview' | 'users' | 'restaurants' | 'billing' | 'security' | 'audit';

export default function OrganizationDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<Tab>('overview');

    const { data: org, isLoading } = useQuery({
        queryKey: ['organization', id],
        queryFn: () => api.get(`/api/organizations/${id}`).then(r => r.data.data),
    });

    const impersonateMutation = useMutation({
        mutationFn: async (orgId: string) => {
            const res = await api.post(`/api/organizations/${orgId}/impersonate`);
            return res.data;
        },
        onSuccess: (data) => {
            if (data.success && data.data) {
                const { accessToken, user: impersonatedUser } = data.data;
                api.defaults.headers.common['Authorization'] = `Bearer ${accessToken}`;
                useAuthStore.setState({ accessToken, user: impersonatedUser, isAuthenticated: true });
                toast.success(`Impersonando organização: ${impersonatedUser.organizationId}`);
                window.location.href = '/';
            }
        },
        onError: (error: any) => toast.error(error.message || 'Falha ao iniciar impersonação')
    });

    if (isLoading) return <div className="p-8 text-white">Carregando detalhes...</div>;
    if (!org) return <div className="p-8 text-red-500">Organização não encontrada</div>;

    const TabButton = ({ id, label, icon: Icon }: { id: Tab, label: string, icon: any }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${activeTab === id
                    ? 'border-primary-500 text-primary-500'
                    : 'border-transparent text-gray-400 hover:text-white hover:border-gray-700'
                }`}
        >
            <Icon className="w-4 h-4" />
            {label}
        </button>
    );

    return (
        <div className="space-y-6 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button onClick={() => navigate('/admin/organizations')} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-2xl font-bold text-white">{org.name}</h1>
                            <span className={`px-2 py-0.5 rounded text-xs font-bold ${org.billingStatus === 'ACTIVE' ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'
                                }`}>{org.billingStatus}</span>
                        </div>
                        <p className="text-gray-400 font-mono text-sm">{org.id} • {org.slug}</p>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={() => impersonateMutation.mutate(org.id)}
                        className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border border-amber-500/20 rounded-lg transition-colors"
                    >
                        <Shield className="w-4 h-4" />
                        Impersonar
                    </button>
                </div>
            </div>

            {/* Navigation */}
            <div className="border-b border-white/10 flex overflow-x-auto">
                <TabButton id="overview" label="Visão Geral" icon={Activity} />
                <TabButton id="users" label="Usuários" icon={Users} />
                <TabButton id="restaurants" label="Restaurantes" icon={Store} />
                <TabButton id="billing" label="Cobrança" icon={CreditCard} />
                <TabButton id="security" label="Segurança" icon={Shield} />
                <TabButton id="audit" label="Auditoria" icon={Terminal} />
            </div>

            {/* Content */}
            <div className="min-h-[400px]">
                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* KPI Cards */}
                        <div className="lg:col-span-3 grid grid-cols-1 md:grid-cols-4 gap-4">
                            <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
                                <span className="text-gray-400 text-xs uppercase font-bold">Saúde</span>
                                <div className={`mt-2 text-xl font-bold flex items-center gap-2 ${org.health === 'OK' ? 'text-green-500' : 'text-red-500'
                                    }`}>
                                    {org.health === 'OK' ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                                    {org.health}
                                </div>
                            </div>
                            <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
                                <span className="text-gray-400 text-xs uppercase font-bold">Plano</span>
                                <div className="mt-2 text-xl font-bold text-white capitalize">
                                    {org.plan?.replace('_', ' ')}
                                </div>
                                <div className="text-xs text-gray-500 mt-1">Expira em {org.nextBillingDate ? new Date(org.nextBillingDate).toLocaleDateString() : 'Nunca'}</div>
                            </div>
                            <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
                                <span className="text-gray-400 text-xs uppercase font-bold">Diretor</span>
                                <div className="mt-2 text-white font-medium truncate">{org.directorName}</div>
                                <div className="text-xs text-gray-500 truncate">{org.directorEmail || 'Não definido'}</div>
                            </div>
                            <div className="bg-gray-900 border border-white/10 rounded-xl p-4">
                                <span className="text-gray-400 text-xs uppercase font-bold">Uso</span>
                                <div className="mt-2 text-white flex gap-4 text-sm">
                                    <span>{org.stats?.restaurants || 0} rests</span>
                                    <span>{org.stats?.users || 0} users</span>
                                </div>
                            </div>
                        </div>

                        {/* Onboarding Checklist */}
                        <div className="bg-gray-900 border border-white/10 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Checklist de Onboarding</h3>
                            <div className="space-y-3">
                                <CheckItem label="Diretor Definido" checked={!!org.directorEmail} />
                                <CheckItem label="Restaurante Criado" checked={org.stats?.restaurants > 0} />
                                <CheckItem label="Integração Ativa" checked={false} /> {/* Placeholder logic */}
                                <CheckItem label="Primeiro Login" checked={!!org.directorEmail} />
                            </div>
                        </div>

                        {/* Recent Activity */}
                        <div className="lg:col-span-2 bg-gray-900 border border-white/10 rounded-xl p-6">
                            <h3 className="text-lg font-bold text-white mb-4">Atividade Recente</h3>
                            <div className="space-y-4">
                                {org.impersonationLogs?.length === 0 ? (
                                    <p className="text-gray-500 text-sm">Nenhuma atividade registrada.</p>
                                ) : (
                                    org.impersonationLogs?.map((log: any) => (
                                        <div key={log.id} className="flex items-start gap-3 text-sm border-b border-white/5 pb-3 last:border-0 last:pb-0">
                                            <div className="p-1.5 bg-gray-800 rounded text-gray-400">
                                                <Terminal className="w-3 h-3" />
                                            </div>
                                            <div>
                                                <p className="text-white"><span className="text-primary-400 font-medium">{log.action}</span> por Super Admin</p>
                                                <p className="text-gray-500 text-xs">{new Date(log.timestamp).toLocaleString()}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === 'users' && (
                    <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead className="bg-gray-800 text-gray-400 text-xs uppercase font-bold">
                                <tr>
                                    <th className="px-6 py-3">Nome</th>
                                    <th className="px-6 py-3">Papel</th>
                                    <th className="px-6 py-3">Status</th>
                                    <th className="px-6 py-3">Último Login</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5 text-gray-300">
                                {org.users?.map((user: any) => (
                                    <tr key={user.id} className="hover:bg-white/5">
                                        <td className="px-6 py-4">
                                            <div>
                                                <div className="text-white font-medium">{user.firstName} {user.lastName}</div>
                                                <div className="text-xs text-gray-500">{user.email}</div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="px-2 py-1 bg-gray-800 rounded text-xs font-mono">{user.role}</span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={`text-xs ${user.isActive ? 'text-green-500' : 'text-red-500'}`}>
                                                {user.isActive ? 'Ativo' : 'Bloqueado'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-gray-500">
                                            {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleString() : 'Nunca'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* Restaurants Tab */}
                {activeTab === 'restaurants' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {org.restaurants?.map((rest: any) => (
                            <div key={rest.id} className="bg-gray-900 border border-white/10 rounded-xl p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center text-gray-400">
                                            <Store className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <h4 className="text-white font-bold">{rest.name}</h4>
                                            <p className="text-xs text-gray-500">{rest.id}</p>
                                        </div>
                                    </div>
                                    <button className="text-xs bg-white/5 hover:bg-white/10 px-3 py-1.5 rounded transition-colors text-white">
                                        Abrir
                                    </button>
                                </div>
                                <div className="space-y-2">
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Plano</span>
                                        <span className="text-white capitalize">{rest.plan}</span>
                                    </div>
                                    <div className="flex justify-between text-sm">
                                        <span className="text-gray-500">Integrações</span>
                                        <span className="text-white">{rest.integrations?.length || 0} ativas</span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Placeholder Tabs */}
                {['billing', 'security', 'audit'].includes(activeTab) && (
                    <div className="bg-gray-900/50 border border-white/10 border-dashed rounded-xl p-12 text-center">
                        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                            <Clock className="w-8 h-8" />
                        </div>
                        <h3 className="text-lg font-medium text-white">Em Desenvolvimento</h3>
                        <p className="text-gray-500 mt-2">Esta funcionalidade estará disponível em breve.</p>
                    </div>
                )}
            </div>
        </div>
    );
}

function CheckItem({ label, checked }: { label: string, checked: boolean }) {
    return (
        <div className="flex items-center gap-3">
            <div className={`w-5 h-5 rounded-full flex items-center justify-center ${checked ? 'bg-green-500/20 text-green-500' : 'bg-gray-800 text-gray-600'
                }`}>
                <CheckCircle className="w-3.5 h-3.5" />
            </div>
            <span className={`text-sm ${checked ? 'text-white' : 'text-gray-500'}`}>{label}</span>
        </div>
    );
}
