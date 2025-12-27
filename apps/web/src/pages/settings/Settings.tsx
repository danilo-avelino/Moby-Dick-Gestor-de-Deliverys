import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth';
import { useSettingsStore } from '../../stores/settings';
import { User, Building, Bell, Palette, Layers, Package, Trash2, Settings as SettingsIcon, Users, Loader2, AlertTriangle } from 'lucide-react';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import UserManagement from '../admin/UserManagement';
import { RestaurantManagement } from './RestaurantManagement';

// Sections
type SettingsSection = 'general' | 'users' | 'restaurants' | 'backup';

import { BackupSettings } from './BackupSettings';

export default function Settings() {
    const { user } = useAuthStore();
    const [activeSection, setActiveSection] = useState<SettingsSection>('general');

    return (
        <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-100px)]">
            {/* Sidebar */}
            <aside className="w-full lg:w-64 shrink-0">
                <div className="glass-card p-4 h-full">
                    <h2 className="text-lg font-semibold text-white mb-6 px-2">Configurações</h2>
                    <nav className="space-y-2">
                        <button
                            onClick={() => setActiveSection('general')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeSection === 'general' ? 'bg-primary-500/20 text-primary-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <SettingsIcon className="w-5 h-5" />
                            <span className="font-medium">Geral</span>
                        </button>
                        <button
                            onClick={() => setActiveSection('users')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeSection === 'users' ? 'bg-primary-500/20 text-primary-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <Users className="w-5 h-5" />
                            <span className="font-medium">Usuários</span>
                        </button>
                        <button
                            onClick={() => setActiveSection('restaurants')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeSection === 'restaurants' ? 'bg-primary-500/20 text-primary-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <span className="font-medium">Restaurantes</span>
                        </button>
                        <button
                            onClick={() => setActiveSection('backup')}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-colors ${activeSection === 'backup' ? 'bg-primary-500/20 text-primary-400' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                }`}
                        >
                            <SettingsIcon className="w-5 h-5" />
                            <span className="font-medium">Backup & Dados</span>
                        </button>
                    </nav>
                </div>
            </aside>

            {/* Content Area */}
            <main className="flex-1 overflow-y-auto pr-2">
                {activeSection === 'general' && <GeneralSettings user={user} />}
                {activeSection === 'users' && <UserManagement />}
                {activeSection === 'restaurants' && <RestaurantManagement />}
                {activeSection === 'backup' && <BackupSettings />}
            </main>
        </div>
    );
}

// Extracted General Settings Component to keep file clean
function GeneralSettings({ user }: any) {
    const { operationMode, setOperationMode } = useSettingsStore();

    const queryClient = useQueryClient();
    const [showDeleteAllProducts, setShowDeleteAllProducts] = useState(false);

    const deleteAllProductsMutation = useMutation({
        mutationFn: () => api.delete('/api/products/all'),
        onSuccess: (response) => {
            toast.success(response.data.data.message);
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            setShowDeleteAllProducts(false);
        },
        onError: () => {
            toast.error('Erro ao excluir produtos');
        },
    });

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl">
            <div>
                <h1 className="text-2xl font-bold text-white">Geral</h1>
                <p className="text-gray-400">Preferências e configurações da conta</p>
            </div>

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

            {/* Operation Mode */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Layers className="w-5 h-5 text-primary-400" /> Modo de Operação
                </h3>
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

            {/* Stock Section (Danger Zone) */}
            <div className="glass-card">
                <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Package className="w-5 h-5 text-primary-400" /> Estoque
                </h3>
                <div className="space-y-4">
                    <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20">
                        <h4 className="text-red-400 font-medium mb-2">Zona de Perigo</h4>
                        <p className="text-sm text-gray-400 mb-4">
                            Ações destrutivas que não podem ser desfeitas.
                        </p>
                        <button
                            onClick={() => setShowDeleteAllProducts(true)}
                            className="px-4 py-2 rounded-lg bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 transition-colors flex items-center gap-2"
                        >
                            <Trash2 className="w-4 h-4" />
                            Excluir Todos os Produtos
                        </button>
                    </div>
                </div>
            </div>

            {/* Delete All Products Confirmation Modal */}
            {showDeleteAllProducts && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
                    <div className="glass-card w-full max-w-md m-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                <AlertTriangle className="w-5 h-5 text-red-400" />
                            </div>
                            <h3 className="text-lg font-semibold text-white">Confirmar Exclusão</h3>
                        </div>

                        <p className="text-gray-300 mb-2">
                            Tem certeza que deseja excluir <span className="font-semibold text-red-400">TODOS os produtos</span>?
                        </p>
                        <p className="text-sm text-gray-400 mb-4">
                            Esta ação é <strong>irreversível</strong>. Todos os produtos, movimentações de estoque e dados relacionados serão permanentemente excluídos.
                        </p>

                        <div className="p-3 rounded-lg bg-yellow-500/10 border border-yellow-500/20 mb-6">
                            <p className="text-sm text-yellow-400">
                                ⚠️ Isso também excluirá: movimentações de estoque, lotes, itens de inventário, ingredientes de receitas e sugestões de compra.
                            </p>
                        </div>

                        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                            <button
                                onClick={() => setShowDeleteAllProducts(false)}
                                className="btn-ghost"
                                disabled={deleteAllProductsMutation.isPending}
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => deleteAllProductsMutation.mutate()}
                                disabled={deleteAllProductsMutation.isPending}
                                className="btn-primary bg-red-600 hover:bg-red-700 flex items-center gap-2"
                            >
                                {deleteAllProductsMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Excluindo...
                                    </>
                                ) : (
                                    <>
                                        <Trash2 className="w-4 h-4" />
                                        Excluir Tudo
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
