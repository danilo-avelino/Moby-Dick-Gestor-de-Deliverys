import { X, Search, Edit2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { useState } from 'react';

interface PortioningProcessListModalProps {
    onClose: () => void;
    onEdit: (process: any) => void;
}

export function PortioningProcessListModal({ onClose, onEdit }: PortioningProcessListModalProps) {
    const [search, setSearch] = useState('');

    const { data: processesData, isLoading } = useQuery({
        queryKey: ['portioning-processes'],
        queryFn: async () => {
            const res = await api.get('/api/portioning/processes');
            return res.data;
        }
    });

    const processes = processesData?.data || [];

    const filteredProcesses = processes.filter((p: any) =>
        (p.name?.toLowerCase() || '').includes(search.toLowerCase()) ||
        (p.rawProduct?.name?.toLowerCase() || '').includes(search.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-2xl p-6 shadow-2xl flex flex-col max-h-[80vh]">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white">Editar Processo</h2>
                        <p className="text-sm text-gray-400">Selecione um processo para editar</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="relative mb-4">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nome ou insumo..."
                        className="input pl-10"
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="flex-1 overflow-y-auto space-y-2 min-h-[300px]">
                    {isLoading ? (
                        <div className="text-center py-8 text-gray-500">Carregando...</div>
                    ) : filteredProcesses.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            Nenhum processo encontrado.
                            <br /><span className="text-xs text-secondary-500">
                                (Debug: {processes.length} items. Filter: {processesData?.debugInfo?.filterApplied}. Only admin sees this.)
                            </span>
                        </div>
                    ) : (
                        filteredProcesses.map((process: any) => (
                            <div
                                key={process.id}
                                className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 hover:border-primary-500/30 transition-all cursor-pointer group"
                                onClick={() => onEdit(process)}
                            >
                                <div>
                                    <h3 className="font-medium text-white group-hover:text-primary-400 transition-colors">{process.name}</h3>
                                    <p className="text-xs text-gray-400">
                                        Origem: {process.rawProduct?.name} • Rendimento: {process.yieldPercent}%
                                    </p>
                                </div>
                                <button className="p-2 text-gray-400 hover:text-primary-400 transition-colors">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
