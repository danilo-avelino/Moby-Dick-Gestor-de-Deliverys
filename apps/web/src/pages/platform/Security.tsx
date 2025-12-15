

import { useState } from 'react';
import { Shield, Eye, User, Lock, Search, Filter, AlertOctagon } from "lucide-react";

export default function PlatformSecurity() {
    // TODO: Connect to real API GET /api/platform/audit-logs
    const mockAuditLogs = [
        { id: 1, action: 'IMPERSONATE_ORG', actor: 'Danilo Avelino', target: 'Moby Dick Org', timestamp: '10 minutos atrás', severity: 'HIGH' },
        { id: 2, action: 'UPDATE_PLAN_LIMITS', actor: 'Danilo Avelino', target: 'Plano Pro', timestamp: '2 horas atrás', severity: 'MEDIUM' },
        { id: 3, action: 'SUSPEND_ORG', actor: 'System Admin', target: 'Restaurante Exemplo', timestamp: '1 dia atrás', severity: 'CRITICAL' },
        { id: 4, action: 'LOGIN_SUCCESS', actor: 'Danilo Avelino', target: 'Platform Console', timestamp: '1 dia atrás', severity: 'LOW' },
        { id: 5, action: 'CREATE_ORG', actor: 'Danilo Avelino', target: 'Nova Franquia SP', timestamp: '2 dias atrás', severity: 'MEDIUM' },
    ];

    return (
        <div className="space-y-8 pb-20">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Segurança & Auditoria</h1>
                <p className="text-gray-400">Rastreabilidade completa de ações administrativas.</p>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-gray-900 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-blue-500/10 rounded-lg text-blue-500">
                        <Shield className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">Ações de Admin (24h)</p>
                        <p className="text-2xl font-bold text-white">24</p>
                    </div>
                </div>
                <div className="bg-gray-900 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-purple-500/10 rounded-lg text-purple-500">
                        <Eye className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">Impersonações Ativas</p>
                        <p className="text-2xl font-bold text-white">1</p>
                    </div>
                </div>
                <div className="bg-gray-900 border border-white/10 rounded-xl p-4 flex items-center gap-4">
                    <div className="p-3 bg-red-500/10 rounded-lg text-red-500">
                        <AlertOctagon className="w-6 h-6" />
                    </div>
                    <div>
                        <p className="text-sm text-gray-400">Alertas de Segurança</p>
                        <p className="text-2xl font-bold text-white">0</p>
                    </div>
                </div>
            </div>

            {/* Audit Log Table */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Logs de Auditoria</h2>
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                            <input
                                type="text"
                                placeholder="Buscar nos logs..."
                                className="bg-gray-900 border border-white/10 rounded-lg pl-10 pr-4 py-1.5 text-sm text-white focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                        <button className="p-2 bg-gray-900 border border-white/10 rounded-lg text-gray-400 hover:text-white">
                            <Filter className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase font-medium tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Ação</th>
                                <th className="px-6 py-4">Ator (Admin)</th>
                                <th className="px-6 py-4">Alvo</th>
                                <th className="px-6 py-4">Gravidade</th>
                                <th className="px-6 py-4">Horário</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-300">
                            {mockAuditLogs.map((log) => (
                                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="font-medium text-white">{log.action}</div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <User className="w-3 h-3 text-gray-500" />
                                            <span className="text-sm">{log.actor}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-gray-400">{log.target}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${log.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-500' :
                                                log.severity === 'HIGH' ? 'bg-amber-500/20 text-amber-500' :
                                                    log.severity === 'MEDIUM' ? 'bg-blue-500/20 text-blue-500' :
                                                        'bg-gray-700 text-gray-400'
                                            }`}>
                                            {log.severity}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-xs text-gray-500">
                                        {log.timestamp}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}
