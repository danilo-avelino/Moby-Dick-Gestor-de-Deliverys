import { useState, useEffect } from 'react';
import { X, Plus, Trash2, Save, Scale, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import toast from 'react-hot-toast';

interface PortioningProductModalProps {
    onClose: () => void;
    initialData?: any;
}

interface Product {
    id: string;
    name: string;
    unit: string;
}

interface PortioningOutput {
    id: string; // temp id for UI (or real ID for edit)
    name: string;
    useStandardWeight: boolean;
    standardWeight?: number;
    unit: string;
    isActive: boolean;
}

export function PortioningProductModal({ onClose, initialData }: PortioningProductModalProps) {
    const queryClient = useQueryClient();
    const [name, setName] = useState(initialData?.name || '');
    const [rawProductId, setRawProductId] = useState(initialData?.rawProductId || '');
    const [quantityUsed, setQuantityUsed] = useState<number | undefined>(initialData?.quantityUsed);
    const [yieldPercent, setYieldPercent] = useState<number>(initialData?.yieldPercent || 100);

    // Sub-products state
    const [outputs, setOutputs] = useState<PortioningOutput[]>(
        initialData?.outputs?.map((o: any) => ({
            id: o.id,
            name: o.name,
            useStandardWeight: o.useStandardWeight,
            standardWeight: o.standardWeight,
            unit: o.unit,
            isActive: o.isActive
        })) || []
    );

    // Fetch products for raw material selection
    const { data: productsData, isLoading: isLoadingProducts } = useQuery({
        queryKey: ['products-list'],
        queryFn: async () => {
            const res = await api.get('/api/products');
            return res.data;
        }
    });

    const products: Product[] = productsData?.data?.data || [];
    const selectedProduct = products.find(p => p.id === rawProductId);

    const handleAddOutput = () => {
        setOutputs([
            ...outputs,
            {
                id: Math.random().toString(36).substr(2, 9),
                name: '',
                useStandardWeight: false,
                standardWeight: undefined,
                unit: 'g',
                isActive: true
            }
        ]);
    };

    const handleUpdateOutput = (id: string, field: keyof PortioningOutput, value: any) => {
        setOutputs(outputs.map(out => {
            if (out.id === id) {
                return { ...out, [field]: value };
            }
            return out;
        }));
    };

    const handleRemoveOutput = (id: string) => {
        setOutputs(outputs.filter(out => out.id !== id));
    };

    const createMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await api.post('/api/portioning/processes', data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Produto de porcionamento cadastrado com sucesso!');
            queryClient.invalidateQueries({ queryKey: ['portioning-processes'] });
            onClose();
        },
        onError: (err) => {
            console.error(err);
            toast.error('Erro ao cadastrar produto.');
        }
    });

    const updateMutation = useMutation({
        mutationFn: async (data: any) => {
            const res = await api.put(`/api/portioning/processes/${initialData.id}`, data);
            return res.data;
        },
        onSuccess: () => {
            toast.success('Produto de porcionamento atualizado!');
            queryClient.invalidateQueries({ queryKey: ['portioning-processes'] });
            onClose();
        },
        onError: (err) => {
            console.error(err);
            toast.error('Erro ao atualizar produto.');
        }
    });

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (!name || !rawProductId || !yieldPercent || !quantityUsed) {
            return toast.error('Preencha os campos obrigatórios.');
        }

        if (outputs.length === 0) {
            return toast.error('Adicione pelo menos um subproduto (saída).');
        }

        // Validate outputs
        for (const out of outputs) {
            if (!out.name) return toast.error('Nome do subproduto é obrigatório.');
            if (out.useStandardWeight && !out.standardWeight) return toast.error(`Peso padrão inválido para ${out.name}`);
        }

        const payload = {
            name,
            rawProductId,
            quantityUsed,
            yieldPercent,
            outputs: outputs.map(({ id, ...rest }) => {
                if (!initialData) return rest;
                const originalOutput = initialData.outputs.find((o: any) => o.id === id);
                return originalOutput ? { id, ...rest } : rest;
            })
        };

        if (initialData) {
            updateMutation.mutate(payload);
        } else {
            createMutation.mutate(payload);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-3xl p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Scale className="w-5 h-5 text-primary-400" />
                            {initialData ? 'Editar Produto de Porcionamento' : 'Novo Produto de Porcionamento'}
                        </h2>
                        <p className="text-sm text-gray-400">Defina o insumo origem e os subprodutos gerados</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Main Info */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Nome do Processo/Produto</label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Ex: Peça de Alcatra Limpa"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="label">Insumo Origem (Matéria Prima)</label>
                            <select
                                className="input"
                                value={rawProductId}
                                onChange={e => setRawProductId(e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                {isLoadingProducts ? (
                                    <option disabled>Carregando...</option>
                                ) : (
                                    products.map(p => (
                                        <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
                                    ))
                                )}
                            </select>
                        </div>
                        <div>
                            <label className="label">Quantidade Utilizada</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    className="input pr-12"
                                    placeholder="0.000"
                                    step="0.001"
                                    value={quantityUsed || ''}
                                    onChange={e => setQuantityUsed(parseFloat(e.target.value))}
                                />
                                {selectedProduct && (
                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">
                                        {selectedProduct.unit}
                                    </span>
                                )}
                            </div>
                        </div>
                        <div>
                            <label className="label">Meta de Rendimento (%)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    className="input pr-8"
                                    min="0"
                                    max="100"
                                    step="0.1"
                                    value={yieldPercent}
                                    onChange={e => setYieldPercent(parseFloat(e.target.value))}
                                />
                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">%</span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">Quanto se espera aproveitar da peça original</p>
                        </div>
                    </div>

                    <div className="h-px bg-white/10" />

                    {/* Sub Products */}
                    <div>
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-lg font-semibold text-white">Subprodutos (Saídas)</h3>
                            <button
                                type="button"
                                onClick={handleAddOutput}
                                className="btn-secondary text-xs"
                            >
                                <Plus className="w-4 h-4 mr-1" /> Adicionar Subproduto
                            </button>
                        </div>

                        {outputs.length === 0 ? (
                            <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-xl">
                                <p className="text-gray-500">Nenhum subproduto adicionado.</p>
                                <button type="button" onClick={handleAddOutput} className="text-primary-400 hover:underline mt-2 text-sm">
                                    Adicionar o primeiro
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {outputs.map((out, index) => (
                                    <div key={out.id} className="p-4 rounded-xl bg-white/5 border border-white/10 animate-fade-in">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="grid grid-cols-1 md:grid-cols-12 gap-4 flex-1">
                                                <div className="md:col-span-5">
                                                    <label className="text-xs text-gray-400 mb-1 block">Nome do Subproduto</label>
                                                    <input
                                                        type="text"
                                                        className="input h-9 text-sm"
                                                        placeholder="Ex: Bife 200g"
                                                        value={out.name}
                                                        onChange={e => handleUpdateOutput(out.id, 'name', e.target.value)}
                                                    />
                                                </div>

                                                <div className="md:col-span-3">
                                                    <label className="text-xs text-gray-400 mb-1 block">Usar Peso Padrão?</label>
                                                    <button
                                                        type="button"
                                                        onClick={() => handleUpdateOutput(out.id, 'useStandardWeight', !out.useStandardWeight)}
                                                        className={`w-full h-9 rounded-lg text-sm font-medium transition-colors border ${out.useStandardWeight
                                                            ? 'bg-primary-500/20 border-primary-500/50 text-primary-400'
                                                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                                            }`}
                                                    >
                                                        {out.useStandardWeight ? 'Sim' : 'Não'}
                                                    </button>
                                                </div>

                                                {out.useStandardWeight && (
                                                    <div className="md:col-span-4 flex gap-2">
                                                        <div className="flex-1">
                                                            <label className="text-xs text-gray-400 mb-1 block">Peso</label>
                                                            <input
                                                                type="number"
                                                                step="0.001"
                                                                className="input h-9 text-sm"
                                                                value={out.standardWeight || ''}
                                                                onChange={e => handleUpdateOutput(out.id, 'standardWeight', parseFloat(e.target.value))}
                                                            />
                                                        </div>
                                                        <div className="w-24">
                                                            <label className="text-xs text-gray-400 mb-1 block">Unidade</label>
                                                            <select
                                                                className="input h-9 text-sm pl-3 pr-8 bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20fill%3D%22none%22%20viewBox%3D%220%200%2020%2020%22%3E%3Cpath%20stroke%3D%22%236b7280%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%20stroke-width%3D%221.5%22%20d%3D%22m6%208%204%204%204-4%22%2F%3E%3C%2Fsvg%3E')] bg-[length:1.25rem_1.25rem] bg-no-repeat bg-[right_0.5rem_center] appearance-none"
                                                                value={out.unit}
                                                                onChange={e => handleUpdateOutput(out.id, 'unit', e.target.value)}
                                                            >
                                                                <option value="kg">kg</option>
                                                                <option value="g">g</option>
                                                                <option value="l">l</option>
                                                                <option value="ml">ml</option>
                                                                <option value="un">un</option>
                                                            </select>
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="md:col-span-12 flex items-center gap-4 mt-2">
                                                    <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer select-none">
                                                        <input
                                                            type="checkbox"
                                                            className="rounded bg-white/10 border-white/20 text-primary-500 focus:ring-primary-500 focus:ring-offset-0"
                                                            checked={out.isActive}
                                                            onChange={e => handleUpdateOutput(out.id, 'isActive', e.target.checked)}
                                                        />
                                                        Ativo
                                                    </label>
                                                </div>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => handleRemoveOutput(out.id)}
                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                                                title="Remover"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end gap-3 pt-6 border-t border-white/10">
                        <button type="button" onClick={onClose} className="btn-ghost">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={createMutation.isPending || updateMutation.isPending}
                            className="btn-primary"
                        >
                            {createMutation.isPending || updateMutation.isPending ? 'Salvando...' : (
                                <>
                                    <Save className="w-4 h-4 mr-2" /> {initialData ? 'Salvar Alterações' : 'Salvar Produto'}
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
