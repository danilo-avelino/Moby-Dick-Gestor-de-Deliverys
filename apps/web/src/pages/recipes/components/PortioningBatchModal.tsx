import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { formatCurrency, formatPercent, formatNumber } from '../../../lib/utils';
import {
    X, Search, Plus, User, Truck, Scale,
    ArrowRight, AlertCircle, Save, Loader2, Calculator, Package
} from 'lucide-react';
import toast from 'react-hot-toast';

interface PortioningBatchModalProps {
    isOpen: boolean;
    onClose: () => void;
    onAddNewProcess: () => void;
}

export function PortioningBatchModal({ isOpen, onClose, onAddNewProcess }: PortioningBatchModalProps) {
    const queryClient = useQueryClient();
    const [step, setStep] = useState<'select-process' | 'batch-data'>('select-process');
    const [selectedProcess, setSelectedProcess] = useState<any>(null);
    const [search, setSearch] = useState('');

    // Form Data
    const [formData, setFormData] = useState({
        initialWeight: '',
        initialUnit: 'kg',
        operatorId: '',
        supplierId: '',
        outputs: [] as {
            name: string;
            unit: string;
            actualWeight: string;
            quantity?: string;
            useStandardWeight?: boolean;
            standardWeight?: number;
        }[]
    });

    // Reset when opening
    useEffect(() => {
        if (isOpen) {
            setStep('select-process');
            setSelectedProcess(null);
            setSearch('');
            setFormData({
                initialWeight: '',
                initialUnit: 'kg',
                operatorId: '',
                supplierId: '',
                outputs: []
            });
        }
    }, [isOpen]);

    // Initialize/Update Sub-products when process selected
    useEffect(() => {
        if (selectedProcess) {
            setFormData(prev => ({
                ...prev,
                outputs: selectedProcess.outputs.map((out: any) => ({
                    name: out.name,
                    unit: out.unit || 'kg',
                    actualWeight: '',
                    quantity: '',
                    useStandardWeight: out.useStandardWeight,
                    standardWeight: out.standardWeight
                }))
            }));
        }
    }, [selectedProcess]);

    // Data Fetching
    const { data: processesData } = useQuery({
        queryKey: ['portioning-processes'],
        queryFn: async () => {
            const res = await api.get('/api/portioning/processes');
            return res.data;
        },
        enabled: isOpen
    });

    const { data: usersData } = useQuery({
        queryKey: ['users'],
        queryFn: async () => {
            const res = await api.get('/api/users');
            return res.data;
        },
        enabled: isOpen && step === 'batch-data'
    });

    const { data: suppliersData } = useQuery({
        queryKey: ['suppliers'],
        queryFn: async () => {
            const res = await api.get('/api/suppliers');
            return res.data;
        },
        enabled: isOpen && step === 'batch-data'
    });

    const processes = processesData?.data || [];
    const users = usersData?.data || [];
    const suppliers = suppliersData?.data || [];

    // Filtering
    const filteredProcesses = useMemo(() => {
        if (!search) return processes;
        const lowerSearch = search.toLowerCase();
        return processes.filter((p: any) =>
            p.name.toLowerCase().includes(lowerSearch) ||
            p.rawProduct?.name?.toLowerCase().includes(lowerSearch)
        );
    }, [processes, search]);

    // Calculated Total Yield (Normalized to KG)
    const totalYieldWeight = useMemo(() => {
        return formData.outputs.reduce((acc, curr) => {
            let w = parseFloat(curr.actualWeight.replace(',', '.') || '0');
            if (isNaN(w)) w = 0;

            // Normalize to KG
            if (curr.unit === 'g' || curr.unit === 'ml') {
                w = w / 1000;
            }

            return acc + w;
        }, 0);
    }, [formData.outputs]);

    const yieldPercentage = useMemo(() => {
        const initial = parseFloat(formData.initialWeight.replace(',', '.') || '0');
        if (!initial || initial === 0) return 0;
        return (totalYieldWeight / initial) * 100;
    }, [formData.initialWeight, totalYieldWeight]);

    // Mutation
    const createBatchMutation = useMutation({
        mutationFn: async (data: any) => {
            return api.post('/api/portioning/batches', data);
        },
        onSuccess: () => {
            toast.success('Lote registrado com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['portioning-dashboard'] });
            // queryClient.invalidateQueries({ queryKey: ['product-stock'] }); // If we implemented stock update
            onClose();
        },
        onError: (error: any) => {
            toast.error(error.response?.data?.message || 'Erro ao registrar lote');
        }
    });

    const handleSubmit = () => {
        if (!selectedProcess) return;

        // Validation
        if (!formData.initialWeight || !formData.operatorId || !formData.supplierId) {
            toast.error('Preencha os campos obrigatórios');
            return;
        }

        const initialWeight = parseFloat(formData.initialWeight.replace(',', '.'));

        // Final weight is the SUM of all outputs
        const finalWeight = totalYieldWeight;

        const payload = {
            processId: selectedProcess.id,
            operatorId: formData.operatorId,
            supplierId: formData.supplierId,
            initialWeight: initialWeight,
            finalWeight: finalWeight,
            // portionCount/portionWeight are less relevant globally now, 
            // but we could store them if the backend supported per-output metadata, 
            // but currently the Schema for BatchOutput supports name/actualWeight/unit.
            // We'll trust the outputs map.
            outputs: formData.outputs.map(out => ({
                name: out.name,
                unit: out.unit,
                actualWeight: out.actualWeight ? parseFloat(out.actualWeight.replace(',', '.')) : 0
            }))
        };

        if (finalWeight <= 0) {
            toast.error('Informe o peso obtido nos subprodutos');
            return;
        }

        createBatchMutation.mutate(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="bg-gray-900 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col border border-white/10 shadow-2xl">

                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <div>
                        <h2 className="text-xl font-bold text-white">Registrar lote de porcionamento</h2>
                        {step === 'select-process' && <p className="text-sm text-gray-400">Selecione o processo para iniciar</p>}
                        {step === 'batch-data' && <p className="text-sm text-gray-400">Preencha os dados do lote para {selectedProcess?.name}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">

                    {step === 'select-process' && (
                        <div className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Buscar processo..."
                                    value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    className="w-full bg-gray-800 border border-white/10 rounded-lg pl-10 pr-4 py-3 text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
                                    autoFocus
                                />
                            </div>

                            <div className="space-y-2 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {filteredProcesses.map((process: any) => (
                                    <button
                                        key={process.id}
                                        onClick={() => {
                                            setSelectedProcess(process);
                                            setStep('batch-data');
                                        }}
                                        className="w-full bg-white/5 hover:bg-white/10 border border-white/5 hover:border-primary-500/50 rounded-xl p-4 text-left transition-all group flex items-center justify-between"
                                    >
                                        <div>
                                            <h3 className="font-semibold text-white group-hover:text-primary-400 transition-colors">
                                                {process.name}
                                            </h3>
                                            <div className="flex items-center gap-3 mt-1 text-sm text-gray-400">
                                                <span>{process.rawProduct?.name}</span>
                                            </div>
                                        </div>
                                        <ArrowRight className="w-5 h-5 text-gray-600 group-hover:text-primary-500" />
                                    </button>
                                ))}
                                {filteredProcesses.length === 0 && (
                                    <div className="text-center py-8 text-gray-500">
                                        Nenhum processo encontrado
                                    </div>
                                )}
                            </div>

                            <button
                                onClick={onAddNewProcess}
                                className="w-full py-3 border-2 border-dashed border-white/10 hover:border-primary-500/50 hover:bg-white/5 rounded-xl text-gray-400 hover:text-primary-400 transition-all flex items-center justify-center gap-2 font-medium"
                            >
                                <Plus className="w-5 h-5" />
                                Adicionar novo processo
                            </button>
                        </div>
                    )}

                    {step === 'batch-data' && selectedProcess && (
                        <div className="space-y-8">
                            {/* Mandatory Fields */}
                            <div className="space-y-6">
                                <h4 className="text-sm font-uppercase tracking-wider text-gray-500 font-bold">Dados Principais</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-300">Peso Bruto (kg) *</label>
                                        <div className="relative">
                                            <Scale className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <input
                                                type="number"
                                                value={formData.initialWeight}
                                                onChange={e => setFormData({ ...formData, initialWeight: e.target.value })}
                                                className="w-full bg-gray-800 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none"
                                                placeholder="0.00"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        <label className="text-sm text-gray-300">Operador *</label>
                                        <div className="relative">
                                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <select
                                                value={formData.operatorId}
                                                onChange={e => setFormData({ ...formData, operatorId: e.target.value })}
                                                className="w-full bg-gray-800 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
                                            >
                                                <option value="">Selecione...</option>
                                                {users.map((u: any) => (
                                                    <option key={u.id} value={u.id}>{u.firstName} {u.lastName}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="space-y-2 sm:col-span-2">
                                        <label className="text-sm text-gray-300">Fornecedor *</label>
                                        <div className="relative">
                                            <Truck className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <select
                                                value={formData.supplierId}
                                                onChange={e => setFormData({ ...formData, supplierId: e.target.value })}
                                                className="w-full bg-gray-800 border border-white/10 rounded-lg pl-10 pr-4 py-2 text-white focus:ring-2 focus:ring-primary-500 outline-none appearance-none"
                                            >
                                                <option value="">Selecione...</option>
                                                {suppliers.map((s: any) => (
                                                    <option key={s.id} value={s.id}>{s.name} {s.tradeName && `(${s.tradeName})`}</option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Sub-products (Outputs) */}
                            {formData.outputs.length > 0 && (
                                <div className="space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-uppercase tracking-wider text-gray-500 font-bold">Rendimento por Subproduto</h4>
                                        <span className="text-xs text-primary-400 bg-primary-500/10 px-2 py-1 rounded-full border border-primary-500/20">
                                            Total: {formatNumber(totalYieldWeight)} kg
                                        </span>
                                    </div>
                                    <div className="bg-white/5 rounded-xl p-4 space-y-4">
                                        {formData.outputs.map((out, idx) => (
                                            <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 hover:bg-white/5 rounded-lg transition-colors border border-transparent hover:border-white/5">
                                                <div className="flex-1 min-w-[150px]">
                                                    <span className="text-white font-medium block flex items-center gap-2">
                                                        {out.name}
                                                        {out.useStandardWeight && (
                                                            <span className="text-xs font-normal text-primary-400 flex items-center gap-1 bg-primary-400/10 px-1.5 py-0.5 rounded">
                                                                <Package className="w-3 h-3" />
                                                                Peso Padrão: {formatNumber(out.standardWeight || 0)} {out.unit}
                                                            </span>
                                                        )}
                                                    </span>
                                                    <span className="text-xs text-gray-500 uppercase">{out.unit || 'kg'}</span>
                                                </div>

                                                <div className="flex items-center gap-4">
                                                    {/* If Standard Weight, show Quantity Input */}
                                                    {out.useStandardWeight ? (
                                                        <>
                                                            <div className="relative w-28">
                                                                <label className="text-[10px] text-gray-500 absolute -top-4 left-0">Qtd. Porções</label>
                                                                <input
                                                                    type="number"
                                                                    placeholder="0"
                                                                    value={out.quantity}
                                                                    onChange={e => {
                                                                        const qty = e.target.value;
                                                                        const newOutputs = [...formData.outputs];
                                                                        newOutputs[idx].quantity = qty;
                                                                        // Calculate Weight: Qty * Standard
                                                                        if (qty && out.standardWeight) {
                                                                            const weight = parseFloat(qty) * out.standardWeight;
                                                                            newOutputs[idx].actualWeight = weight.toFixed(3);
                                                                        } else {
                                                                            newOutputs[idx].actualWeight = '';
                                                                        }
                                                                        setFormData({ ...formData, outputs: newOutputs });
                                                                    }}
                                                                    className="w-full bg-gray-900 border border-white/10 rounded-lg pl-3 pr-2 py-2 text-white text-sm focus:ring-1 focus:ring-primary-500 outline-none text-right font-mono"
                                                                />
                                                            </div>
                                                            <div className="flex flex-col items-end min-w-[80px]">
                                                                <div className="text-[10px] text-gray-500 mb-1">Total (Calc)</div>
                                                                <div className="font-mono text-white text-sm">
                                                                    {out.actualWeight ? formatNumber(parseFloat(out.actualWeight)) : '0.00'} {out.unit}
                                                                </div>
                                                            </div>
                                                        </>
                                                    ) : (
                                                        <div className="relative w-40">
                                                            <label className="text-[10px] text-gray-500 absolute -top-4 left-0">Peso Obtido</label>
                                                            <input
                                                                type="number"
                                                                placeholder="0.00"
                                                                value={out.actualWeight}
                                                                onChange={e => {
                                                                    const newOutputs = [...formData.outputs];
                                                                    newOutputs[idx].actualWeight = e.target.value;
                                                                    setFormData({ ...formData, outputs: newOutputs });
                                                                }}
                                                                className="w-full bg-gray-900 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-white text-sm focus:ring-1 focus:ring-primary-500 outline-none text-right font-mono"
                                                            />
                                                            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 text-xs font-medium">
                                                                {out.unit || 'kg'}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Yield Summary */}
                            <div className="p-4 rounded-xl border border-white/10 bg-gradient-to-br from-gray-800 to-gray-900/50">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-gray-400 text-sm">Rendimento Total</span>
                                    <Calculator className="w-4 h-4 text-gray-500" />
                                </div>
                                <div className="flex items-end gap-2">
                                    <span className="text-3xl font-bold text-white tracking-tight">
                                        {formatNumber(totalYieldWeight)}
                                        <span className="text-lg font-medium text-gray-500 ml-1">kg</span>
                                    </span>
                                    {yieldPercentage > 0 && (
                                        <span className={`mb-1.5 px-2 py-0.5 rounded text-xs font-bold border ${yieldPercentage >= 95 && yieldPercentage <= 105
                                                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                                : 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20'
                                            }`}>
                                            {formatNumber(yieldPercentage)}%
                                        </span>
                                    )}
                                </div>
                            </div>

                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-end gap-3">
                    {step === 'batch-data' ? (
                        <>
                            <button
                                onClick={() => setStep('select-process')}
                                className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                            >
                                Voltar
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={createBatchMutation.isPending}
                                className="btn-primary"
                            >
                                {createBatchMutation.isPending ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                        Salvando...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4 mr-2" />
                                        Salvar Lote
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <button onClick={onClose} className="px-4 py-2 text-gray-400 hover:text-white">
                            Cancelar
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
