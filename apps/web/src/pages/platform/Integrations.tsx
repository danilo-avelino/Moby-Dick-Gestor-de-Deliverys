

import { useState } from 'react';
import { Plug, CheckCircle, AlertTriangle, RefreshCw, ExternalLink, Activity, Clock } from "lucide-react";

export default function PlatformIntegrations() {
    // TODO: Connect to real API GET /api/platform/integrations
    const mockProviders = [
        { id: 'stripe', name: 'Stripe Payments', status: 'OPERATIONAL', successRate: 99.8, latency: 245, failures24h: 2 },
        { id: 'whatsapp', name: 'WhatsApp Gateway', status: 'DEGRADED', successRate: 92.5, latency: 1200, failures24h: 154 },
        { id: 'aws-ses', name: 'Amazon SES (Email)', status: 'OPERATIONAL', successRate: 99.9, latency: 120, failures24h: 0 },
        { id: 'pdf-gen', name: 'PDF Generator', status: 'OPERATIONAL', successRate: 98.2, latency: 4500, failures24h: 12 },
    ];

    const mockWebhooks = [
        { id: 1, provider: 'stripe', endpoint: '/api/webhooks/stripe', status: 'SUCCESS', attempts: 1, timestamp: '10:42:30' },
        { id: 2, provider: 'stripe', endpoint: '/api/webhooks/stripe', status: 'SUCCESS', attempts: 1, timestamp: '10:41:15' },
        { id: 3, provider: 'whatsapp', endpoint: '/api/webhooks/wpp', status: 'FAILURE', attempts: 3, timestamp: '10:40:00', error: 'Timeout waiting for gateway' },
        { id: 4, provider: 'aws-ses', endpoint: '/api/webhooks/email', status: 'SUCCESS', attempts: 1, timestamp: '10:39:22' },
        { id: 5, provider: 'whatsapp', endpoint: '/api/webhooks/wpp', status: 'FAILURE', attempts: 3, timestamp: '10:38:55', error: 'Invalid payload signature' },
    ];

    return (
        <div className="space-y-8 pb-20">
            <div>
                <h1 className="text-2xl font-bold text-white tracking-tight">Integrações & Webhooks</h1>
                <p className="text-gray-400">Monitoramento de serviços externos e gateways.</p>
            </div>

            {/* Provider Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {mockProviders.map((provider) => (
                    <div key={provider.id} className="bg-gray-900 border border-white/10 rounded-xl p-5 hover:border-white/20 transition-colors">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-white/5 rounded-lg">
                                    <Plug className="w-4 h-4 text-white" />
                                </div>
                                <span className="font-medium text-white">{provider.name}</span>
                            </div>
                            <div className={`w-2 h-2 rounded-full ${provider.status === 'OPERATIONAL' ? 'bg-green-500' : 'bg-amber-500 animate-pulse'
                                }`} />
                        </div>

                        <div className="grid grid-cols-2 gap-4 mt-4">
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Sucesso (24h)</p>
                                <span className={`text-sm font-bold ${provider.successRate > 99 ? 'text-green-500' : 'text-amber-500'
                                    }`}>
                                    {provider.successRate}%
                                </span>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500 mb-1">Latência</p>
                                <span className="text-sm font-bold text-gray-300">
                                    {provider.latency}ms
                                </span>
                            </div>
                        </div>

                        {provider.failures24h > 0 && (
                            <div className="mt-4 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-2 py-1.5 rounded-lg">
                                <AlertTriangle className="w-3 h-3" />
                                {provider.failures24h} falhas nas últimas 24h
                            </div>
                        )}
                    </div>
                ))}
            </div>

            {/* Webhook Logs */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-lg font-bold text-white">Webhooks Recentes</h2>
                    <button className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 transition-colors">
                        <RefreshCw className="w-4 h-4" />
                        Atualizar
                    </button>
                </div>

                <div className="bg-gray-900 border border-white/10 rounded-xl overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-800/50 text-gray-400 text-xs uppercase font-medium tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Status</th>
                                <th className="px-6 py-4">Provedor</th>
                                <th className="px-6 py-4">Endpoint</th>
                                <th className="px-6 py-4">Tentativas</th>
                                <th className="px-6 py-4">Horário</th>
                                <th className="px-6 py-4 text-right">Ações</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5 text-gray-300">
                            {mockWebhooks.map((log) => (
                                <tr key={log.id} className="hover:bg-white/5 transition-colors">
                                    <td className="px-6 py-4">
                                        {log.status === 'SUCCESS' ? (
                                            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-500/10 text-green-500">
                                                <CheckCircle className="w-3 h-3" />
                                                Sucesso
                                            </span>
                                        ) : (
                                            <div className="flex flex-col gap-1">
                                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-500/10 text-red-500 w-fit">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Falha
                                                </span>
                                                <span className="text-[10px] text-red-400">{log.error}</span>
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-white capitalize">{log.provider}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <code className="text-xs bg-black px-1.5 py-0.5 rounded text-gray-400 font-mono">POST</code>
                                            <span className="text-xs text-gray-400 font-mono">{log.endpoint}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="text-sm text-gray-400">{log.attempts}</span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-gray-400">
                                            <Clock className="w-3 h-3" />
                                            {log.timestamp}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button className="text-gray-400 hover:text-white p-2" title="Ver Payload">
                                            <ExternalLink className="w-4 h-4" />
                                        </button>
                                        {log.status === 'FAILURE' && (
                                            <button className="text-blue-400 hover:text-blue-300 p-2" title="Reprocessar">
                                                <RefreshCw className="w-4 h-4" />
                                            </button>
                                        )}
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
