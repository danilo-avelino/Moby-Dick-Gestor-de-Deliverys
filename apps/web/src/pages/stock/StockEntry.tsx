import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { formatCurrency } from '../../lib/utils';
import { ArrowLeft, Plus, Trash2, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface EntryItem {
    productId: string;
    productName: string;
    quantity: number;
    unit: string;
    costPerUnit: number;
    batchNumber?: string;
    expirationDate?: string;
}

export default function StockEntry() {
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const [items, setItems] = useState<EntryItem[]>([]);
    const [selectedProduct, setSelectedProduct] = useState('');

    const { data: products } = useQuery({
        queryKey: ['products-simple'],
        queryFn: () => api.get('/api/products?limit=100').then((r) => r.data.data.data),
    });



    const mutation = useMutation({
        mutationFn: (data: any) => api.post('/api/stock/movements/bulk-entry', data),
        onSuccess: () => {
            // Invalidate all stock and product-related queries for immediate update
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['products-simple'] });
            queryClient.invalidateQueries({ queryKey: ['product-details'] });
            toast.success('Entrada registrada com sucesso!');
            navigate('/stock');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.error?.message || 'Erro ao registrar entrada');
        },
    });

    const addItem = () => {
        if (!selectedProduct) return;
        const product = (products || []).find((p: any) => p.id === selectedProduct);
        if (!product) return;

        setItems([...items, {
            productId: product.id,
            productName: product.name,
            quantity: 1,
            unit: product.baseUnit,
            costPerUnit: Number(product.lastPurchasePrice) || Number(product.avgCost) || 0,
        }]);
        setSelectedProduct('');
    };

    const updateItem = (index: number, field: keyof EntryItem, value: any) => {
        const newItems = [...items];
        (newItems[index] as any)[field] = value;
        setItems(newItems);
    };

    const removeItem = (index: number) => {
        setItems(items.filter((_, i) => i !== index));
    };

    const totalValue = items.reduce((sum, item) => sum + item.quantity * item.costPerUnit, 0);

    const handleSubmit = () => {
        if (items.length === 0) {
            toast.error('Adicione pelo menos um item');
            return;
        }
        mutation.mutate({
            items: items.map((i) => ({
                productId: i.productId,
                quantity: i.quantity,
                unit: i.unit,
                costPerUnit: i.costPerUnit,
                batchNumber: i.batchNumber,
                expirationDate: i.expirationDate,
            })),
        });
    };

    return (
        <div className="max-w-4xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-lg">
                    <ArrowLeft className="w-5 h-5 text-gray-400" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">Nova Entrada de Estoque</h1>
                    <p className="text-gray-400">Registre uma compra ou entrada de produtos</p>
                </div>
            </div>



            {/* Add Product */}
            <div className="glass-card">
                <h3 className="font-semibold text-white mb-4">Adicionar Produto</h3>
                <div className="flex gap-4">
                    <select value={selectedProduct} onChange={(e) => setSelectedProduct(e.target.value)} className="input flex-1">
                        <option value="">Selecione um produto...</option>
                        {(products || []).map((p: any) => (
                            <option key={p.id} value={p.id}>{p.name} ({p.baseUnit})</option>
                        ))}
                    </select>
                    <button onClick={addItem} disabled={!selectedProduct} className="btn-primary">
                        <Plus className="w-5 h-5" /> Adicionar
                    </button>
                </div>
            </div>

            {/* Items List */}
            {items.length > 0 && (
                <div className="glass-card">
                    <h3 className="font-semibold text-white mb-4">Itens ({items.length})</h3>
                    <div className="space-y-4">
                        {items.map((item, index) => (
                            <div key={index} className="p-4 rounded-xl bg-white/5 border border-white/10">
                                <div className="flex items-start justify-between mb-4">
                                    <h4 className="font-medium text-white">{item.productName}</h4>
                                    <button onClick={() => removeItem(index)} className="text-red-400 hover:text-red-300">
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div>
                                        <label className="label">Quantidade</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={item.quantity}
                                            onChange={(e) => updateItem(index, 'quantity', parseFloat(e.target.value) || 0)}
                                            className="input"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Custo Unitário</label>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={item.costPerUnit}
                                            onChange={(e) => updateItem(index, 'costPerUnit', parseFloat(e.target.value) || 0)}
                                            className="input"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Lote</label>
                                        <input
                                            type="text"
                                            value={item.batchNumber || ''}
                                            onChange={(e) => updateItem(index, 'batchNumber', e.target.value)}
                                            className="input"
                                            placeholder="Opcional"
                                        />
                                    </div>
                                    <div>
                                        <label className="label">Validade</label>
                                        <input
                                            type="date"
                                            value={item.expirationDate || ''}
                                            onChange={(e) => updateItem(index, 'expirationDate', e.target.value)}
                                            className="input"
                                        />
                                    </div>
                                </div>
                                <div className="mt-3 text-right">
                                    <span className="text-gray-400">Subtotal: </span>
                                    <span className="font-medium text-white">{formatCurrency(item.quantity * item.costPerUnit)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 pt-4 border-t border-white/10 flex items-center justify-between">
                        <div>
                            <span className="text-gray-400">Total da Entrada: </span>
                            <span className="text-2xl font-bold text-white">{formatCurrency(totalValue)}</span>
                        </div>
                        <button onClick={handleSubmit} disabled={mutation.isPending} className="btn-primary">
                            {mutation.isPending ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                            Registrar Entrada
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
