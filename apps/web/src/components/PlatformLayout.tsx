
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/auth';
import {
    LayoutDashboard, Building, Calendar, CreditCard, Plug, Shield, Settings,
    LogOut, Menu, X, User, Search, Bell, AlertTriangle, Plus
} from 'lucide-react';
import { useState } from 'react';
import { cn, getInitials } from '../lib/utils';
import { UserRole } from 'types';

const platformNavigation = [
    { name: 'Visão Geral', href: '/platform/overview', icon: LayoutDashboard },
    { name: 'Organizações', href: '/platform/organizations', icon: Building },
    { name: 'Eventos (Global)', href: '/platform/events', icon: Calendar },
    { name: 'Financeiro', href: '/platform/billing', icon: CreditCard },
    { name: 'Integrações', href: '/platform/integrations', icon: Plug },
    { name: 'Segurança & logs', href: '/platform/security', icon: Shield },
    { name: 'Configurações', href: '/platform/settings', icon: Settings },
];

export default function PlatformLayout() {
    const { user, logout } = useAuthStore();
    const navigate = useNavigate();
    const [sidebarOpen, setSidebarOpen] = useState(false);

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
                'fixed inset-y-0 left-0 z-50 w-72 bg-black border-r border-white/10',
                'transform transition-transform duration-300 lg:translate-x-0 lg:static',
                sidebarOpen ? 'translate-x-0' : '-translate-x-full'
            )}>
                <div className="flex flex-col h-full">
                    {/* Logo */}
                    <div className="flex items-center justify-between h-16 px-6 border-b border-white/10 bg-gray-900/50">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-blue-600 flex items-center justify-center">
                                <span className="text-white font-bold text-xl">P</span>
                            </div>
                            <div>
                                <h1 className="font-bold text-white leading-tight">Platform</h1>
                                <p className="text-[10px] text-gray-500 uppercase tracking-wider">Console</p>
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
                        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4 px-2">
                            Moby Dick SaaS
                        </div>
                        {platformNavigation.map((item) => (
                            <NavLink
                                key={item.href}
                                to={item.href}
                                onClick={() => setSidebarOpen(false)}
                                className={({ isActive }) => cn(
                                    'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
                                    isActive
                                        ? 'bg-blue-600/10 text-blue-400 border border-blue-600/20'
                                        : 'text-gray-400 hover:bg-white/5 hover:text-white'
                                )}
                            >
                                <item.icon className="w-5 h-5" />
                                <span>{item.name}</span>
                            </NavLink>
                        ))}
                    </nav>

                    {/* User section */}
                    <div className="p-4 border-t border-white/10 bg-gray-900/30">
                        <button
                            onClick={handleLogout}
                            className="flex items-center gap-3 w-full px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-lg transition-colors"
                        >
                            <LogOut className="w-5 h-5" />
                            <span>Sair do Console</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* Main content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="h-16 bg-gray-900/80 backdrop-blur-xl border-b border-white/10 flex items-center justify-between px-6 z-10">
                    <button
                        onClick={() => setSidebarOpen(true)}
                        className="lg:hidden text-gray-400 hover:text-white"
                    >
                        <Menu className="w-6 h-6" />
                    </button>

                    {/* Global Search */}
                    <div className="flex-1 max-w-xl px-4">
                        <div className="relative group">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-focus-within:text-blue-400 transition-colors" />
                            <input
                                type="text"
                                placeholder="Buscar organização, evento, usuário ou transação..."
                                className="w-full bg-gray-950 border border-white/10 rounded-lg py-2 pl-10 pr-4 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="flex items-center gap-4">
                        {/* Quick Actions */}
                        <div className="hidden md:flex items-center gap-2 mr-2">
                            <button className="px-3 py-1.5 text-xs font-medium text-blue-400 bg-blue-500/10 border border-blue-500/20 rounded-lg hover:bg-blue-500/20 transition-colors flex items-center gap-2">
                                <Plus className="w-3 h-3" />
                                Org
                            </button>
                            <button className="px-3 py-1.5 text-xs font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-lg hover:bg-emerald-500/20 transition-colors flex items-center gap-2">
                                <Plus className="w-3 h-3" />
                                Plano
                            </button>
                            <button className="px-3 py-1.5 text-xs font-medium text-amber-400 bg-amber-500/10 border border-amber-500/20 rounded-lg hover:bg-amber-500/20 transition-colors flex items-center gap-2">
                                <Plus className="w-3 h-3" />
                                Incidente
                            </button>
                        </div>

                        {/* Notifications */}
                        <button className="relative p-2 text-gray-400 hover:text-white transition-colors">
                            <Bell className="w-5 h-5" />
                        </button>

                        <div className="h-6 w-px bg-white/10 mx-2" />

                        {/* Admin User */}
                        <div className="flex items-center gap-3">
                            <div className="text-right hidden sm:block">
                                <p className="text-sm font-medium text-white">
                                    {user?.firstName} {user?.lastName}
                                </p>
                                <p className="text-xs text-blue-400 font-bold tracking-wide">SUPER ADMIN</p>
                            </div>
                            <div className="w-9 h-9 rounded-full bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center ring-2 ring-black">
                                <span className="text-white font-bold text-xs">
                                    {getInitials(user?.firstName || '', user?.lastName || '')}
                                </span>
                            </div>
                        </div>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto bg-gray-950 p-6 relative">
                    {/* Background Pattern */}
                    <div className="absolute inset-0 z-0 opacity-20 pointer-events-none"
                        style={{ backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(37, 99, 235, 0.1) 0%, transparent 20%), radial-gradient(circle at 90% 80%, rgba(139, 92, 246, 0.1) 0%, transparent 20%)' }}
                    />
                    <div className="relative z-10">
                        <Outlet />
                    </div>
                </main>
            </div>
        </div>
    );
}
