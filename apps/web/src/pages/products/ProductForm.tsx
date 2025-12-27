import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { api } from '../../lib/api';
import { ArrowLeft, Save, Loader2, Calendar, DollarSign, Package, Trash2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function ProductForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const isEdit = !!id;

    const { data: product, isLoading: loadingProduct } = useQuery({
        queryKey: ['product', id],
        queryFn: () => api.get(`/api/products/${id}`).then((r) => r.data.data),
        enabled: isEdit,
    });

    const { data: categories } = useQuery({
        queryKey: ['categories-flat'],
        queryFn: () => api.get('/api/categories/flat').then((r) => r.data.data),
    });

    const { data: suppliers } = useQuery({
        queryKey: ['suppliers'],
        queryFn: () => api.get('/api/suppliers').then((r) => r.data.data),
    });

    const { register, handleSubmit, watch, reset, formState: { errors } } = useForm({
        defaultValues: product || { countsCMV: true }, // CMV true by default
    });

    const countsCMV = watch('countsCMV', product?.countsCMV ?? true);
    const isPerishable = watch('isPerishable', product?.isPerishable ?? false);

    const deleteMutation = useMutation({
        mutationFn: () => api.delete(`/api/products/${id}`),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success('Produto excluído com sucesso!');
            navigate('/products');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error?.message || 'Erro ao excluir');
        },
    });

    const handleDelete = () => {
        if (window.confirm('Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.')) {
            deleteMutation.mutate();
        }
    };

    const mutation = useMutation({
        mutationFn: (data: any) => isEdit
            ? api.patch(`/api/products/${id}`, data)
            : api.post('/api/products', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
            toast.success(isEdit ? 'Produto atualizado!' : 'Produto criado!');
            navigate('/products');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error?.message || 'Erro ao salvar');
        },
    });

    // Update form values when product data loads
    useEffect(() => {
        if (product) {
            reset(product);
        }
    }, [product, reset]);

    if (isEdit && loadingProduct) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-lg">
                    <ArrowLeft className="w-5 h-5 text-gray-400" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">{isEdit ? 'Editar Produto' : 'Novo Produto'}</h1>
                    <p className="text-gray-400">Preencha as informações do produto</p>
                </div>
            </div>

            <form onSubmit={handleSubmit((data) => mutation.mutate(data))} className="space-y-4">
                {/* Informações Básicas */}
                <div className="glass-card">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-primary-400" /> Informações Básicas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="md:col-span-2">
                            <label className="label">Nome do Produto *</label>
                            <input
                                {...register('name', { required: true })}
                                className="input"
                                placeholder="Ex: Carne Moída Premium"
                                defaultValue={product?.name}
                            />
                            {errors.name && <p className="text-xs text-red-400 mt-1">Campo obrigatório</p>}
                        </div>

                        <div>
                            <label className="label">SKU (Código Interno)</label>
                            <input
                                {...register('sku')}
                                className="input"
                                placeholder="PROT001"
                                defaultValue={product?.sku}
                            />
                        </div>

                        <div>
                            <label className="label">Código de Barras (EAN)</label>
                            <input
                                {...register('barcode')}
                                className="input"
                                placeholder="7891234567890"
                                defaultValue={product?.barcode}
                            />
                        </div>

                        <div>
                            <label className="label">Categoria</label>
                            <select {...register('categoryId')} className="input" defaultValue={product?.categoryId}>
                                <option value="">Nenhuma</option>
                                {(categories || []).map((c: any) => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="label">Fornecedor Padrão</label>
                            <select {...register('defaultSupplierId')} className="input" defaultValue={product?.defaultSupplierId}>
                                <option value="">Nenhum</option>
                                {(suppliers || []).map((s: any) => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Preço de Compra */}
                <div className="glass-card">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-400" /> Preço de Compra
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label">Preço de Compra (R$)</label>
                            <input
                                type="number"
                                step="0.01"
                                {...register('lastPurchasePrice', { valueAsNumber: true })}
                                className="input"
                                placeholder="0.00"
                                defaultValue={product?.lastPurchasePrice}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Último preço de compra do produto.
                            </p>
                        </div>

                        {!isEdit && (
                            <div>
                                <label className="label">Estoque Inicial (Atual)</label>
                                <input
                                    type="number"
                                    step="0.001"
                                    {...register('currentStock', { valueAsNumber: true })}
                                    className="input"
                                    placeholder="0"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Quantidade atual em estoque. Será criado um movimento inicial.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Estoque e Medidas */}
                <div className="glass-card">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <Package className="w-5 h-5 text-blue-400" /> Estoque e Medidas
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="label">Unidade de Medida *</label>
                            <select {...register('baseUnit', { required: true })} className="input" defaultValue={product?.baseUnit || 'un'}>
                                <option value="un">Unidade (un)</option>
                                <option value="kg">Quilograma (kg)</option>
                                <option value="g">Grama (g)</option>
                                <option value="L">Litro (L)</option>
                                <option value="ml">Mililitro (ml)</option>
                                <option value="cx">Caixa (cx)</option>
                                <option value="pct">Pacote (pct)</option>
                            </select>
                        </div>

                        <div>
                            <label className="label">Ponto de Reposição (Calculado)</label>
                            <input
                                type="number"
                                step="0.01"
                                {...register('reorderPoint', { valueAsNumber: true })}
                                className="input bg-gray-700/50 cursor-not-allowed"
                                placeholder="Auto"
                                defaultValue={product?.reorderPoint || 0}
                                readOnly
                            />
                            <p className="text-xs text-gray-500 mt-1">Calculado automaticamente</p>
                        </div>

                        <div>
                            <label className="label">Ponto de Reposição (Manual)</label>
                            <input
                                type="number"
                                step="0.01"
                                {...register('manualReorderPoint', { valueAsNumber: true })}
                                className="input"
                                placeholder="Opcional"
                                defaultValue={product?.manualReorderPoint}
                            />
                            <p className="text-xs text-gray-500 mt-1">Sobrescreve o automático</p>
                        </div>



                        <div>
                            <label className="label">Lead Time (dias)</label>
                            <input
                                type="number"
                                {...register('leadTimeDays', { valueAsNumber: true })}
                                className="input"
                                placeholder="3"
                                defaultValue={product?.leadTimeDays || 1}
                            />
                            <p className="text-xs text-gray-500 mt-1">Tempo de reposição</p>
                        </div>

                        {isPerishable && (
                            <div>
                                <label className="label">Validade Padrão (dias)</label>
                                <input
                                    type="number"
                                    {...register('defaultShelfLifeDays', { valueAsNumber: true })}
                                    className="input"
                                    placeholder="7"
                                    defaultValue={product?.defaultShelfLifeDays || 7}
                                />
                                <p className="text-xs text-gray-500 mt-1">Shelf life médio</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* CMV e Configurações Especiais */}
                <div className="glass-card">
                    <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                        <DollarSign className="w-5 h-5 text-green-400" /> CMV e Configurações
                    </h3>

                    <div className="space-y-4">
                        {/* CMV Toggle - DESTAQUE */}
                        <div className={`p-4 rounded-xl border-2 transition-all ${countsCMV
                            ? 'bg-green-500/10 border-green-500/30'
                            : 'bg-gray-800/50 border-gray-700/30'
                            }`}>
                            <div className="flex items-start gap-3">
                                <input
                                    type="checkbox"
                                    id="countsCMV"
                                    {...register('countsCMV')}
                                    defaultChecked={product?.countsCMV ?? true}
                                    className="w-5 h-5 mt-0.5 rounded accent-green-500"
                                />
                                <div className="flex-1">
                                    <label htmlFor="countsCMV" className="font-medium text-white cursor-pointer flex items-center gap-2">
                                        <DollarSign className="w-4 h-4 text-green-400" />
                                        Compõe o CMV (Custo de Mercadoria Vendida)
                                    </label>
                                    <p className="text-sm text-gray-400 mt-1">
                                        {countsCMV
                                            ? "✓ Este produto será contabilizado no cálculo do CMV e custos das receitas"
                                            : "✗ Este produto NÃO afetará o CMV (útil para materiais de limpeza, embalagens, etc.)"}
                                    </p>
                                    {countsCMV && (
                                        <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                                            <p className="text-xs text-green-300">
                                                💡 <strong>Importante:</strong> Produtos que compõem o CMV afetam diretamente a rentabilidade do seu negócio
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Other Toggles */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className={`p-3 rounded-xl border transition-all ${isPerishable
                                ? 'bg-yellow-500/10 border-yellow-500/30'
                                : 'bg-white/5 border-white/10'
                                }`}>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="perishable"
                                        {...register('isPerishable')}
                                        defaultChecked={product?.isPerishable}
                                        className="w-4 h-4 rounded accent-yellow-500"
                                    />
                                    <label htmlFor="perishable" className="font-medium text-white cursor-pointer flex items-center gap-2">
                                        <Calendar className="w-4 h-4 text-yellow-400" />
                                        Produto Perecível
                                    </label>
                                </div>
                                {isPerishable && (
                                    <p className="text-xs text-yellow-300 mt-2 ml-7">Controle de validade ativado</p>
                                )}
                            </div>

                            <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                <div className="flex items-center gap-3">
                                    <input
                                        type="checkbox"
                                        id="fractional"
                                        {...register('allowFractional')}
                                        defaultChecked={product?.allowFractional}
                                        className="w-4 h-4 rounded"
                                    />
                                    <label htmlFor="fractional" className="font-medium text-white cursor-pointer">
                                        Permitir Fracionamento
                                    </label>
                                </div>
                                <p className="text-xs text-gray-400 mt-2 ml-7">Ex: 1.5 kg, 0.250 L</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Observações */}
                <div className="glass-card">
                    <label className="label">Observações / Notas</label>
                    <textarea
                        {...register('notes')}
                        className="input min-h-[80px]"
                        placeholder="Informações adicionais sobre o produto..."
                        defaultValue={product?.notes}
                    />
                </div>

                {/* Actions */}
                <div className="flex justify-end gap-3 pt-4">
                    {isEdit && (
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="btn-ghost text-red-400 hover:text-red-300 hover:bg-red-500/10"
                            disabled={deleteMutation.isPending}
                        >
                            {deleteMutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5 mr-2" />}
                            {!deleteMutation.isPending && 'Deletar Produto'}
                        </button>
                    )}
                    <button type="button" onClick={() => navigate(-1)} className="btn-ghost">Cancelar</button>
                    <button type="submit" disabled={mutation.isPending} className="btn-primary">
                        {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                        {isEdit ? 'Atualizar Produto' : 'Criar Produto'}
                    </button>
                </div>
            </form>
        </div>
    );
}
