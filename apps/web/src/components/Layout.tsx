import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import {
    LayoutDashboard, Package, Warehouse, TrendingUp, PieChart, BookOpen,
    Bell, Target, Plug, ShoppingCart, Settings, LogOut, Menu, X, User, Clock,
    MessageSquare, ClipboardList, ClipboardCheck, Apple, Users, ShoppingBag, CreditCard, History
} from 'lucide-react';
import { useState } from 'react';
import { cn, getInitials } from '../lib/utils';

import { api } from '../lib/api';
import { useQuery } from '@tanstack/react-query';

const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard, roles: ['DIRETOR', 'ESTOQUE', 'CHEF_DE_COZINHA', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'PDV', href: '/pdv', icon: ShoppingBag, roles: ['DIRETOR', 'LIDER_DESPACHO', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'Produtos', href: '/products', icon: Package, roles: ['DIRETOR', 'ESTOQUE', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'Estoque', href: '/stock', icon: Warehouse, roles: ['DIRETOR', 'ESTOQUE', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'], end: true },
    { name: 'Requisição (Chef)', href: '/stock/my-requests', icon: ClipboardList, roles: ['CHEF_DE_COZINHA'] },
    { name: 'Requisições (Gestão)', href: '/stock/requests', icon: ClipboardCheck, badge: true, roles: ['DIRETOR', 'ESTOQUE', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'Fichas Técnicas', href: '/recipes', icon: BookOpen, roles: ['DIRETOR', 'CHEF_DE_COZINHA', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'CMV', href: '/cmv', icon: TrendingUp, roles: ['DIRETOR', 'ESTOQUE', 'CHEF_DE_COZINHA', 'LIDER_DESPACHO', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'Análise Cardápio', href: '/menu-analysis', icon: PieChart, roles: ['DIRETOR', 'CHEF_DE_COZINHA', 'LIDER_DESPACHO', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'Tempos de Trabalho', href: '/work-times', icon: Clock, roles: ['DIRETOR', 'CHEF_DE_COZINHA', 'LIDER_DESPACHO', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'Alertas', href: '/alerts', icon: Bell, badge: true, roles: ['DIRETOR', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'Metas', href: '/goals', icon: Target, roles: ['DIRETOR', 'ESTOQUE', 'CHEF_DE_COZINHA', 'LIDER_DESPACHO', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'Integrações', href: '/integrations', icon: Plug, roles: ['DIRETOR', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'Lista de compras', href: '/purchases', icon: ShoppingCart, roles: ['DIRETOR', 'ESTOQUE', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'NPS', href: '/nps', icon: MessageSquare, roles: ['DIRETOR', 'CHEF_DE_COZINHA', 'LIDER_DESPACHO', 'SUPER_ADMIN', 'ADMIN', 'MANAGER'] },
    { name: 'Gestão de Usuários', href: '/admin/users', icon: Users, roles: ['DIRETOR', 'SUPER_ADMIN'] },
];

export default function Layout() {
    const { user, logout } = useAuthStore();
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
        enabled: !!user && (user.role === 'DIRETOR' || user.role === 'ESTOQUE' || user.role === 'ADMIN' || user.role === 'SUPER_ADMIN' || user.role === 'MANAGER'),
    });

    const alertCount = 3; // Mock
    const requestCount = requestStats?.pending || 0;

    const filteredNavigation = navigation.filter(item => {
        if (!item.roles) return true;
        return item.roles.includes(user?.role as any);
    });

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    return (
        <div className="flex h-screen overflow-hidden bg-gray-950">
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
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
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
                        {user?.role === 'DIRETOR' && (
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
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-gray-900/50 backdrop-blur-xl border-b border-white/5 flex items-center justify-between px-6">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden text-gray-400 hover:text-white"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    <div className="flex-1" />

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
