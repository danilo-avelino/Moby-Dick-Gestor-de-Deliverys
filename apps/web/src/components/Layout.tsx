import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import {
    LayoutDashboard, Package, Warehouse, TrendingUp, PieChart, BookOpen,
    Bell, Target, Plug, ShoppingCart, Settings, LogOut, Menu, X, User, Clock,
    MessageSquare, ClipboardList, ClipboardCheck, Apple, Users, ShoppingBag, CreditCard, History,
    Building, RefreshCw, Calendar, DollarSign
} from 'lucide-react';
import { useState, Fragment } from 'react';
import { cn, getInitials } from '../lib/utils';
import { Menu as HeadlessMenu, Transition } from '@headlessui/react';
import { api } from '../lib/api';
import { useQuery, useMutation } from '@tanstack/react-query';
import { UserRole } from 'types';
import toast from 'react-hot-toast';

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: [UserRole.DIRETOR, UserRole.ESTOQUE, UserRole.CHEF_DE_COZINHA, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'PDV', href: '/pdv', icon: ShoppingBag, roles: [UserRole.DIRETOR, UserRole.LIDER_DESPACHO, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Produtos', href: '/products', icon: Package, roles: [UserRole.DIRETOR, UserRole.ESTOQUE, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Estoque', href: '/stock', icon: Warehouse, roles: [UserRole.DIRETOR, UserRole.ESTOQUE, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER], end: true },
    { name: 'Requisição (Chef)', href: '/stock/my-requests', icon: ClipboardList, roles: [UserRole.CHEF_DE_COZINHA] },
    { name: 'Requisições (Gestão)', href: '/stock/requests', icon: ClipboardCheck, badge: true, roles: [UserRole.DIRETOR, UserRole.ESTOQUE, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Fichas Técnicas', href: '/recipes', icon: BookOpen, roles: [UserRole.DIRETOR, UserRole.CHEF_DE_COZINHA, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'CMV', href: '/cmv', icon: TrendingUp, roles: [UserRole.DIRETOR, UserRole.ESTOQUE, UserRole.CHEF_DE_COZINHA, UserRole.LIDER_DESPACHO, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Análise Cardápio', href: '/menu-analysis', icon: PieChart, roles: [UserRole.DIRETOR, UserRole.CHEF_DE_COZINHA, UserRole.LIDER_DESPACHO, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Cardápio', href: '/menu', icon: Menu, roles: [UserRole.DIRETOR, UserRole.CHEF_DE_COZINHA, UserRole.LIDER_DESPACHO, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Escalas', href: '/schedules', icon: Calendar, roles: [UserRole.DIRETOR, UserRole.MANAGER, UserRole.SUPER_ADMIN, UserRole.ADMIN] },
    { name: 'Tempos de Trabalho', href: '/work-times', icon: Clock, roles: [UserRole.DIRETOR, UserRole.CHEF_DE_COZINHA, UserRole.LIDER_DESPACHO, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Alertas', href: '/alerts', icon: Bell, badge: true, roles: [UserRole.DIRETOR, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Indicadores', href: '/indicators', icon: Target, roles: [UserRole.DIRETOR, UserRole.ESTOQUE, UserRole.CHEF_DE_COZINHA, UserRole.LIDER_DESPACHO, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Faturamento', href: '/financial/invoicing', icon: DollarSign, roles: [UserRole.DIRETOR, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Integrações', href: '/integrations', icon: Plug, roles: [UserRole.DIRETOR, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Lista de compras', href: '/purchases', icon: ShoppingCart, roles: [UserRole.DIRETOR, UserRole.ESTOQUE, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'NPS', href: '/nps', icon: MessageSquare, roles: [UserRole.DIRETOR, UserRole.CHEF_DE_COZINHA, UserRole.LIDER_DESPACHO, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
    { name: 'Gestão de Usuários', href: '/admin/users', icon: Users, roles: [UserRole.DIRETOR, UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.MANAGER] },
];

export default function Layout() {
    const { user, logout, switchRestaurant } = useAuthStore();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Fetch pending requests count for badge
    const { data: requestStats } = useQuery({
        queryKey: ['stock-requests'],
        queryFn: () => api.get('/api/stock-requests').then(r => r.data.data),
        select: (data: any[]) => {
            const list = data || [];
            const pending = list.filter((l: any) => l.status === 'PENDING').length;
            return { pending };
        },
        enabled: !!user && (user.role === UserRole.DIRETOR || user.role === UserRole.ESTOQUE || user.role === UserRole.ADMIN || user.role === UserRole.SUPER_ADMIN || user.role === UserRole.MANAGER),
    });

    // Fetch restaurants for switcher
    const { data: restaurants } = useQuery({
        queryKey: ['my-restaurants'],
        queryFn: () => api.get('/api/restaurants').then(r => r.data.data),
        enabled: !!user && (user.scope === 'ORG' || (user.permissions?.allowedRestaurantIds !== undefined && user.permissions.allowedRestaurantIds.length > 1)),
    });

    // Fetch organization details
    const { data: organization } = useQuery({
        queryKey: ['organization', user?.organizationId],
        queryFn: () => api.get(`/api/organizations/${user?.organizationId}`).then(r => r.data.data),
        enabled: !!user?.organizationId,
        staleTime: 1000 * 60 * 60, // 1 hour
    });

    const switchMutation = useMutation({
        mutationFn: switchRestaurant,
        onSuccess: () => {
            toast.success('Troca de restaurante realizada!');
            window.location.reload(); // Force reload to clear query caches completely
        },
        onError: () => toast.error('Erro ao trocar restaurante')
    });

    const alertCount = 3; // Mock
    const requestCount = requestStats?.pending || 0;

    const filteredNavigation = navigation.filter(item => {
        // Always allow access if impersonating or if no roles defined
        if (user?.impersonatedBy || !item.roles) return true;
        return item.roles.includes(user?.role as any);
    });

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen overflow-hidden bg-gray-950">
            {/* Impersonation Banner */}
            {user?.impersonatedBy && (
                <div className="fixed top-0 left-0 right-0 h-8 bg-amber-500 text-black text-xs font-bold flex items-center justify-center z-[60] shadow-md">
                    <Users className="w-3 h-3 mr-2" />
                    VOCÊ ESTÁ INSPECIONANDO UMA ORGANIZAÇÃO
                    <button
                        onClick={() => {
                            useAuthStore.getState().stopImpersonation();
                            navigate('/platform/organizations');
                        }}
                        className="ml-2 underline hover:text-white"
                    >
                        Sair da inspeção
                    </button>
                </div>
            )}

            {/* Mobile sidebar backdrop */}
            {sidebarOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden"
                    onClick={() => setSidebarOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside className={cn(
                'fixed inset-y-0 left-0 z-50 w-72 bg-gray-900/95 backdrop-blur-xl border-r border-white/5',
                'transform transition-transform duration-300 lg:translate-x-0 lg:static',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full',
                user?.impersonatedBy ? 'mt-8 h-[calc(100vh-2rem)]' : 'h-full' // Adjust for banner
            )}>
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between h-16 px-6 border-b border-white/5">
                        <div className="flex items-center gap-3">
                            <div className="w-12 h-12 rounded-xl flex items-center justify-center">
                                <img src="/moby-dick-logo.png" alt="Moby Dick Logo" className="w-12 h-12 object-contain" />
                            </div>
                            <div>
                                <h1 className="font-bold text-white">Moby Dick</h1>
                                <p className="text-xs text-gray-500">Gestão por indicadores</p>
                            </div>
                        </div>
                        <button
                            onClick={() => setSidebarOpen(false)}
                            className="lg:hidden text-gray-400 hover:text-white"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Navigation */}
                    <nav className="flex-1 px-4 py-6 space-y-1 overflow-y-auto">
                        {filteredNavigation.map((item) => (
                            <NavLink
                                key={item.href}
                                to={item.href}
                                end={(item as any).end}
                                onClick={() => setSidebarOpen(false)}
                                className={({ isActive }) => cn('sidebar-link', isActive && 'active')}
                            >
                                <item.icon className="w-5 h-5" />
                                <span>{item.name}</span>
                                {item.badge && item.name === 'Alertas' && alertCount > 0 && (
                                    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                        {alertCount}
                                    </span>
                                )}
                                {item.badge && (item.name.includes('Requisições')) && requestCount > 0 && (
                                    <span className="ml-auto bg-amber-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                                        {requestCount}
                                    </span>
                                )}
                            </NavLink>
                        ))}
                    </nav>

                    {/* User section */}
                    <div className="p-4 border-t border-white/5">
                        {user?.role === UserRole.DIRETOR && (
                            <NavLink
                                to="/settings"
                                className={({ isActive }) => cn('sidebar-link mb-2', isActive && 'active')}
                            >
                                <Settings className="w-5 h-5" />
                                <span>Configurações</span>
                            </NavLink>
                        )}
                        <button
                            onClick={handleLogout}
                            className="sidebar-link w-full text-red-400 hover:text-red-300 hover:bg-red-500/10"
                        >
                            <LogOut className="w-5 h-5" />
                            <span>Sair</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className={cn(
                "flex-1 flex flex-col overflow-hidden",
                user?.impersonatedBy ? 'mt-8 h-[calc(100vh-2rem)]' : 'h-full'
            )}>
                {/* Header */}
                <header className="h-16 bg-gray-900/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden text-gray-400 hover:text-white"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    {/* Organization & Restaurant Switcher */}
                    <div className="flex-1 flex items-center pl-4 gap-4">
                        {/* Organization Badge */}
                        {organization && (
                            <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/5">
                                <Building className="w-4 h-4 text-primary-400" />
                                <span className="text-sm font-medium text-white">{organization.name}</span>
                            </div>
                        )}

                    </div>

                    <div className="flex items-center gap-4">
                        {/* Alerts */}
                        <NavLink
                            to="/alerts"
                            className="relative p-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <Bell className="w-5 h-5" />
                            {alertCount > 0 && (
                                <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                                    {alertCount}
                                </span>
                            )}
                        </NavLink>

                        {/* User menu */}
                        <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-white">
                                    {user?.firstName} {user?.lastName}
                                </p>
                                <p className="text-xs text-gray-500">{user?.role}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary-500 to-secondary-500 flex items-center justify-center">
                                {user?.firstName ? (
                                    <span className="text-white font-semibold">
                                        {getInitials(user.firstName, user.lastName)}
                                    </span>
                                ) : (
                                    <User className="w-5 h-5 text-white" />
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-6">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
