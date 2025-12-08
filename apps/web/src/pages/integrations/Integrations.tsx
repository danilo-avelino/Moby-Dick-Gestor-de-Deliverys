import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSettingsStore, SubRestaurant } from '../../stores/settings';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import {
    Plug, Truck, ShoppingCart, Check, ChevronDown, ChevronUp, Building,
    Plus, X, Loader2, RefreshCw, Settings, AlertCircle, CheckCircle
} from 'lucide-react';

interface Platform {
    id: string;
    name: string;
    logo: string;
    type: 'sales' | 'logistics';
    category: string;
    description: string;
    fields: string[];
    isConnected: boolean;
}

interface Integration {
    id: string;
    platform: string;
    name: string;
    status: string;
    lastSyncAt?: string;
    platformInfo?: Platform;
}

export default function Integrations() {
    const { operationMode, subRestaurants } = useSettingsStore();
    const queryClient = useQueryClient();
    const [selectedRestaurant, setSelectedRestaurant] = useState<string>(
        subRestaurants.length > 0 ? subRestaurants[0].id : ''
    );
    const [showCredentialModal, setShowCredentialModal] = useState<Platform | null>(null);
    const [credentials, setCredentials] = useState<Record<string, string>>({});

    // Single operation mode - show traditional integrations page
    if (operationMode === 'single') {
        return <SingleModeIntegrations />;
    }

    // Fetch available platforms
    const { data: platformsData } = useQuery({
        queryKey: ['integration-platforms'],
        queryFn: async () => {
            const res = await api.get('/api/integrations/platforms');
            return res.data.data as { sales: Platform[]; logistics: Platform[] };
        },
    });

    // Fetch integrations for selected restaurant
    const { data: integrations, refetch } = useQuery({
        queryKey: ['integrations', selectedRestaurant],
        queryFn: async () => {
            if (!selectedRestaurant) return [];
            const res = await api.get(`/api/integrations?subRestaurantId=${selectedRestaurant}`);
            return res.data.data as Integration[];
        },
        enabled: !!selectedRestaurant,
    });

    // Connect integration mutation
    const connectMutation = useMutation({
        mutationFn: async (data: { platform: string; name: string; credentials: Record<string, string>; subRestaurantId: string }) => {
            const res = await api.post('/api/integrations', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Integração conectada!');
            setShowCredentialModal(null);
            setCredentials({});
            queryClient.invalidateQueries({ queryKey: ['integrations', selectedRestaurant] });
            queryClient.invalidateQueries({ queryKey: ['integration-platforms'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error?.message || 'Erro ao conectar');
        },
    });

    const selectedRestaurantData = subRestaurants.find(r => r.id === selectedRestaurant);

    const handleConnect = (platform: Platform) => {
        setCredentials({});
        setShowCredentialModal(platform);
    };

    const handleSubmitCredentials = () => {
        if (!showCredentialModal || !selectedRestaurantData) return;

        const missingFields = showCredentialModal.fields.filter(f => !credentials[f]);
        if (missingFields.length > 0) {
            toast.error(`Preencha: ${missingFields.join(', ')}`);
            return;
        }

        connectMutation.mutate({
            platform: showCredentialModal.id,
            name: `${showCredentialModal.name} - ${selectedRestaurantData.name}`,
            credentials,
            subRestaurantId: selectedRestaurant,
        });
    };

    const getIntegrationForPlatform = (platformId: string) => {
        return integrations?.find(i => i.platform === platformId);
    };

    // Separate operation mode - show Nova Integração section
    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Integrações</h1>
                    <p className="text-gray-400">Configure as integrações para seus restaurantes</p>
                </div>
                <button onClick={() => refetch()} className="btn-ghost">
                    <RefreshCw className="w-4 h-4" /> Atualizar
                </button>
            </div>

            {subRestaurants.length === 0 ? (
                <div className="glass-card text-center py-12">
                    <Building className="w-12 h-12 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-400 mb-2">Nenhum restaurante criado</p>
                    <p className="text-sm text-gray-500">
                        Vá em <span className="text-primary-400">Configurações</span> para criar restaurantes
                    </p>
                </div>
            ) : (
                <>
                    {/* Restaurant Selector */}
                    <div className="glass-card">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Building className="w-5 h-5 text-primary-400" />
                            Selecione o Restaurante
                        </h3>
                        <select
                            value={selectedRestaurant}
                            onChange={(e) => setSelectedRestaurant(e.target.value)}
                            className="input"
                        >
                            {subRestaurants.map((restaurant) => (
                                <option key={restaurant.id} value={restaurant.id}>
                                    {restaurant.name} ({restaurant.cuisineType})
                                </option>
                            ))}
                        </select>
                        {selectedRestaurantData && (
                            <div className="mt-3 flex flex-wrap gap-2">
                                {selectedRestaurantData.shifts.map((shift) => (
                                    <span key={shift.id} className="badge badge-purple">
                                        {shift.name || 'Turno'}: {shift.startTime} - {shift.endTime}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Active Integrations for selected restaurant */}
                    {integrations && integrations.length > 0 && (
                        <div className="glass-card">
                            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                                <Plug className="w-5 h-5 text-green-400" />
                                Integrações Ativas ({integrations.length})
                            </h3>
                            <div className="space-y-3">
                                {integrations.map((integration) => (
                                    <div key={integration.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{integration.platformInfo?.logo || '🔌'}</span>
                                            <div>
                                                <p className="font-medium text-white">{integration.name}</p>
                                                <StatusBadge status={integration.status} />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Sales Integrations */}
                    <div className="glass-card">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <ShoppingCart className="w-5 h-5 text-green-400" />
                            Vendas
                        </h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Plataformas de pedidos e marketplaces de delivery
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                            {platformsData?.sales.map((platform) => (
                                <IntegrationCard
                                    key={platform.id}
                                    platform={platform}
                                    integration={getIntegrationForPlatform(platform.id)}
                                    onConnect={() => handleConnect(platform)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Logistics Integrations */}
                    <div className="glass-card">
                        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                            <Truck className="w-5 h-5 text-blue-400" />
                            Logística
                        </h3>
                        <p className="text-sm text-gray-400 mb-4">
                            Plataformas de gestão de entregas e logística
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {platformsData?.logistics.map((platform) => (
                                <IntegrationCard
                                    key={platform.id}
                                    platform={platform}
                                    integration={getIntegrationForPlatform(platform.id)}
                                    onConnect={() => handleConnect(platform)}
                                />
                            ))}
                        </div>
                    </div>
                </>
            )}

            {/* Credential Modal */}
            {showCredentialModal && selectedRestaurantData && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md m-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <span className="text-2xl">{showCredentialModal.logo}</span>
                                Conectar {showCredentialModal.name}
                            </h3>
                            <button onClick={() => setShowCredentialModal(null)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-sm text-gray-400 mb-4">
                            Conectando ao restaurante <strong className="text-white">{selectedRestaurantData.name}</strong>
                        </p>

                        <div className="space-y-4">
                            {showCredentialModal.fields.map((field) => (
                                <div key={field}>
                                    <label className="label">{formatFieldLabel(field)}</label>
                                    <input
                                        type={field.includes('secret') || field.includes('token') ? 'password' : 'text'}
                                        className="input"
                                        placeholder={`Digite ${formatFieldLabel(field).toLowerCase()}`}
                                        value={credentials[field] || ''}
                                        onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button onClick={() => setShowCredentialModal(null)} className="btn-ghost">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmitCredentials}
                                disabled={connectMutation.isPending}
                                className="btn-primary"
                            >
                                {connectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Conectar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Component for single operation mode
function SingleModeIntegrations() {
    const queryClient = useQueryClient();
    const [showCredentialModal, setShowCredentialModal] = useState<Platform | null>(null);
    const [credentials, setCredentials] = useState<Record<string, string>>({});

    // Fetch available platforms
    const { data: platformsData } = useQuery({
        queryKey: ['integration-platforms'],
        queryFn: async () => {
            const res = await api.get('/api/integrations/platforms');
            return res.data.data as { sales: Platform[]; logistics: Platform[] };
        },
    });

    // Fetch current integrations
    const { data: integrations, refetch } = useQuery({
        queryKey: ['integrations'],
        queryFn: async () => {
            const res = await api.get('/api/integrations');
            return res.data.data as Integration[];
        },
    });

    // Connect integration mutation
    const connectMutation = useMutation({
        mutationFn: async (data: { platform: string; name: string; credentials: Record<string, string> }) => {
            const res = await api.post('/api/integrations', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Integração conectada!');
            setShowCredentialModal(null);
            setCredentials({});
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
            queryClient.invalidateQueries({ queryKey: ['integration-platforms'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error?.message || 'Erro ao conectar');
        },
    });

    // Disconnect integration mutation
    const disconnectMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.delete(`/api/integrations/${id}`);
        },
        onSuccess: () => {
            toast.success('Integração desconectada');
            queryClient.invalidateQueries({ queryKey: ['integrations'] });
            queryClient.invalidateQueries({ queryKey: ['integration-platforms'] });
        },
    });

    // Sync mutation
    const syncMutation = useMutation({
        mutationFn: async (id: string) => {
            await api.post(`/api/integrations/${id}/sync`);
        },
        onSuccess: () => {
            toast.success('Sincronização iniciada');
        },
    });

    const handleConnect = (platform: Platform) => {
        setCredentials({});
        setShowCredentialModal(platform);
    };

    const handleSubmitCredentials = () => {
        if (!showCredentialModal) return;

        // Check all required fields
        const missingFields = showCredentialModal.fields.filter(f => !credentials[f]);
        if (missingFields.length > 0) {
            toast.error(`Preencha: ${missingFields.join(', ')}`);
            return;
        }

        connectMutation.mutate({
            platform: showCredentialModal.id,
            name: showCredentialModal.name,
            credentials,
        });
    };

    const getIntegrationForPlatform = (platformId: string) => {
        return integrations?.find(i => i.platform === platformId);
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-white">Integrações</h1>
                    <p className="text-gray-400">Conecte seu restaurante a plataformas de delivery e logística</p>
                </div>
                <button onClick={() => refetch()} className="btn-ghost">
                    <RefreshCw className="w-4 h-4" /> Atualizar
                </button>
            </div>

            {/* Active Integrations */}
            {integrations && integrations.length > 0 && (
                <div className="glass-card">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Plug className="w-5 h-5 text-green-400" /> Integrações Ativas ({integrations.length})
                    </h3>
                    <div className="space-y-3">
                        {integrations.map((integration) => (
                            <div key={integration.id} className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{integration.platformInfo?.logo || '🔌'}</span>
                                    <div>
                                        <p className="font-medium text-white">{integration.name}</p>
                                        <div className="flex items-center gap-2">
                                            <StatusBadge status={integration.status} />
                                            {integration.lastSyncAt && (
                                                <span className="text-xs text-gray-500">
                                                    Último sync: {new Date(integration.lastSyncAt).toLocaleString('pt-BR')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => syncMutation.mutate(integration.id)}
                                        disabled={integration.status !== 'ACTIVE'}
                                        className="btn-ghost text-sm"
                                    >
                                        <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                                    </button>
                                    <button
                                        onClick={() => disconnectMutation.mutate(integration.id)}
                                        className="btn-ghost text-red-400 hover:bg-red-500/20 text-sm"
                                    >
                                        Desconectar
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Sales Integrations */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <ShoppingCart className="w-5 h-5 text-green-400" /> Vendas
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                    Plataformas de pedidos e marketplaces de delivery
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {platformsData?.sales.map((platform) => (
                        <IntegrationCard
                            key={platform.id}
                            platform={platform}
                            integration={getIntegrationForPlatform(platform.id)}
                            onConnect={() => handleConnect(platform)}
                        />
                    ))}
                </div>
            </div>

            {/* Logistics Integrations */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Truck className="w-5 h-5 text-blue-400" /> Logística
                </h3>
                <p className="text-sm text-gray-400 mb-4">
                    Plataformas de gestão de entregas e logística
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {platformsData?.logistics.map((platform) => (
                        <IntegrationCard
                            key={platform.id}
                            platform={platform}
                            integration={getIntegrationForPlatform(platform.id)}
                            onConnect={() => handleConnect(platform)}
                        />
                    ))}
                </div>
            </div>

            {/* Credential Modal */}
            {showCredentialModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md m-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <span className="text-2xl">{showCredentialModal.logo}</span>
                                Conectar {showCredentialModal.name}
                            </h3>
                            <button onClick={() => setShowCredentialModal(null)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-sm text-gray-400 mb-4">
                            Insira as credenciais para conectar com {showCredentialModal.name}
                        </p>

                        <div className="space-y-4">
                            {showCredentialModal.fields.map((field) => (
                                <div key={field}>
                                    <label className="label">{formatFieldLabel(field)}</label>
                                    <input
                                        type={field.includes('secret') || field.includes('token') ? 'password' : 'text'}
                                        className="input"
                                        placeholder={`Digite ${formatFieldLabel(field).toLowerCase()}`}
                                        value={credentials[field] || ''}
                                        onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button onClick={() => setShowCredentialModal(null)} className="btn-ghost">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmitCredentials}
                                disabled={connectMutation.isPending}
                                className="btn-primary"
                            >
                                {connectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Conectar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Restaurant with expandable integrations for separate mode
interface RestaurantIntegrationsProps {
    restaurant: SubRestaurant;
    isExpanded: boolean;
    onToggle: () => void;
}

function RestaurantIntegrations({ restaurant, isExpanded, onToggle }: RestaurantIntegrationsProps) {
    const queryClient = useQueryClient();
    const [showCredentialModal, setShowCredentialModal] = useState<Platform | null>(null);
    const [credentials, setCredentials] = useState<Record<string, string>>({});

    const { data: platformsData } = useQuery({
        queryKey: ['integration-platforms'],
        queryFn: async () => {
            const res = await api.get('/api/integrations/platforms');
            return res.data.data as { sales: Platform[]; logistics: Platform[] };
        },
    });

    const { data: integrations } = useQuery({
        queryKey: ['integrations', restaurant.id],
        queryFn: async () => {
            const res = await api.get(`/api/integrations?subRestaurantId=${restaurant.id}`);
            return res.data.data as Integration[];
        },
    });

    // Connect integration mutation
    const connectMutation = useMutation({
        mutationFn: async (data: { platform: string; name: string; credentials: Record<string, string>; subRestaurantId: string }) => {
            const res = await api.post('/api/integrations', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Integração conectada!');
            setShowCredentialModal(null);
            setCredentials({});
            queryClient.invalidateQueries({ queryKey: ['integrations', restaurant.id] });
            queryClient.invalidateQueries({ queryKey: ['integration-platforms'] });
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.error?.message || 'Erro ao conectar');
        },
    });

    const handleConnect = (platform: Platform) => {
        setCredentials({});
        setShowCredentialModal(platform);
    };

    const handleSubmitCredentials = () => {
        if (!showCredentialModal) return;

        // Check all required fields
        const missingFields = showCredentialModal.fields.filter(f => !credentials[f]);
        if (missingFields.length > 0) {
            toast.error(`Preencha: ${missingFields.join(', ')}`);
            return;
        }

        connectMutation.mutate({
            platform: showCredentialModal.id,
            name: `${showCredentialModal.name} - ${restaurant.name}`,
            credentials,
            subRestaurantId: restaurant.id,
        });
    };

    const activeCount = integrations?.filter(i => i.status === 'ACTIVE').length || 0;

    return (
        <div className="glass rounded-2xl overflow-hidden">
            <button
                type="button"
                onClick={onToggle}
                className="w-full flex items-center justify-between p-4 cursor-pointer hover:bg-white/5 rounded-xl transition-colors"
            >
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary-500/20 to-secondary-500/20 flex items-center justify-center">
                        <Building className="w-5 h-5 text-primary-400" />
                    </div>
                    <div className="text-left">
                        <h3 className="font-semibold text-white">{restaurant.name}</h3>
                        <p className="text-sm text-gray-400">
                            {restaurant.cuisineType} • {restaurant.shifts.length} turno(s) •{' '}
                            {activeCount} integração(ões) ativas
                        </p>
                    </div>
                </div>
                {isExpanded ? (
                    <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                    <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
            </button>

            {isExpanded && platformsData && (
                <div className="px-4 pb-4 pt-2 border-t border-white/10 space-y-6">
                    {/* Shifts info */}
                    <div className="p-3 rounded-xl bg-white/5">
                        <p className="text-sm text-gray-400 mb-2">Turnos:</p>
                        <div className="flex flex-wrap gap-2">
                            {restaurant.shifts.map((shift) => (
                                <span key={shift.id} className="badge badge-purple">
                                    {shift.name || 'Turno'}: {shift.startTime} - {shift.endTime}
                                </span>
                            ))}
                        </div>
                    </div>

                    {/* Logistics */}
                    <div>
                        <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                            <Truck className="w-4 h-4 text-blue-400" /> Logística
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                            {platformsData.logistics.map((platform) => (
                                <IntegrationCard
                                    key={platform.id}
                                    platform={platform}
                                    integration={integrations?.find(i => i.platform === platform.id)}
                                    compact
                                    onConnect={() => handleConnect(platform)}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Sales */}
                    <div>
                        <h4 className="font-medium text-white mb-3 flex items-center gap-2">
                            <ShoppingCart className="w-4 h-4 text-green-400" /> Vendas
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            {platformsData.sales.map((platform) => (
                                <IntegrationCard
                                    key={platform.id}
                                    platform={platform}
                                    integration={integrations?.find(i => i.platform === platform.id)}
                                    compact
                                    onConnect={() => handleConnect(platform)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* Credential Modal */}
            {showCredentialModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md m-4">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <span className="text-2xl">{showCredentialModal.logo}</span>
                                Conectar {showCredentialModal.name}
                            </h3>
                            <button onClick={() => setShowCredentialModal(null)} className="text-gray-400 hover:text-white">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <p className="text-sm text-gray-400 mb-4">
                            Insira as credenciais para conectar {showCredentialModal.name} ao restaurante <strong>{restaurant.name}</strong>
                        </p>

                        <div className="space-y-4">
                            {showCredentialModal.fields.map((field) => (
                                <div key={field}>
                                    <label className="label">{formatFieldLabel(field)}</label>
                                    <input
                                        type={field.includes('secret') || field.includes('token') ? 'password' : 'text'}
                                        className="input"
                                        placeholder={`Digite ${formatFieldLabel(field).toLowerCase()}`}
                                        value={credentials[field] || ''}
                                        onChange={(e) => setCredentials({ ...credentials, [field]: e.target.value })}
                                    />
                                </div>
                            ))}
                        </div>

                        <div className="flex justify-end gap-3 mt-6 pt-4 border-t border-white/10">
                            <button onClick={() => setShowCredentialModal(null)} className="btn-ghost">
                                Cancelar
                            </button>
                            <button
                                onClick={handleSubmitCredentials}
                                disabled={connectMutation.isPending}
                                className="btn-primary"
                            >
                                {connectMutation.isPending && <Loader2 className="w-4 h-4 animate-spin" />}
                                Conectar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// Integration card component
interface IntegrationCardProps {
    platform: Platform;
    integration?: Integration;
    onConnect?: () => void;
    compact?: boolean;
}

function IntegrationCard({ platform, integration, onConnect, compact }: IntegrationCardProps) {
    const isActive = integration?.status === 'ACTIVE';
    const isConnected = !!integration;

    return (
        <button
            onClick={onConnect}
            disabled={isConnected}
            className={`${compact ? 'p-3' : 'p-4'} rounded-xl border-2 text-left transition-all ${isActive
                ? 'border-green-500 bg-green-500/10'
                : isConnected
                    ? 'border-yellow-500/50 bg-yellow-500/10'
                    : 'border-white/10 hover:border-white/30 bg-white/5'
                } ${isConnected ? 'cursor-default' : 'cursor-pointer'}`}
        >
            <div className="flex items-center gap-3">
                <span className={compact ? 'text-xl' : 'text-2xl'}>{platform.logo}</span>
                <div className="flex-1 min-w-0">
                    <h4 className={`font-medium text-white ${compact ? 'text-sm' : ''}`}>{platform.name}</h4>
                    {integration && (
                        <StatusBadge status={integration.status} small />
                    )}
                </div>
                {isActive && (
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                    </div>
                )}
            </div>
        </button>
    );
}

// Status badge component
function StatusBadge({ status, small }: { status: string; small?: boolean }) {
    const config: Record<string, { color: string; icon: any; label: string }> = {
        ACTIVE: { color: 'green', icon: CheckCircle, label: 'Ativa' },
        INACTIVE: { color: 'gray', icon: AlertCircle, label: 'Inativa' },
        PENDING_AUTH: { color: 'yellow', icon: Settings, label: 'Pendente' },
        SYNCING: { color: 'blue', icon: RefreshCw, label: 'Sincronizando' },
        ERROR: { color: 'red', icon: AlertCircle, label: 'Erro' },
    };

    const cfg = config[status] || config.INACTIVE;
    const Icon = cfg.icon;

    return (
        <span className={`inline-flex items-center gap-1 ${small ? 'text-xs' : 'text-sm'} text-${cfg.color}-400`}>
            <Icon className={`${small ? 'w-3 h-3' : 'w-4 h-4'} ${status === 'SYNCING' ? 'animate-spin' : ''}`} />
            {cfg.label}
        </span>
    );
}

// Helper to format field labels
function formatFieldLabel(field: string): string {
    const labels: Record<string, string> = {
        clientId: 'Client ID',
        clientSecret: 'Client Secret',
        apiToken: 'Token de API',
        merchantId: 'Merchant ID',
        storeId: 'Store ID',
    };
    return labels[field] || field.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}
