import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Search, Store, User, Package, AlertCircle, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import { useSettingsStore } from '../../../stores/settings';

// Types
interface Product {
    id: string;
    name: string;
    sku: string;
    baseUnit: string;
    currentStock: number;
    avgCost: number;
}

interface RequisitionItem {
    tempId: string;
    productId: string;
    quantity: string;
    type: 'raw' | 'portioned';
    productName?: string; // Cache for display
    unit?: string;
    currentStock?: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function StockRequisitionModal({ isOpen, onClose }: Props) {
    // Stores
    const { subRestaurants } = useSettingsStore();

    // State
    const [costCenter, setCostCenter] = useState('');
    const [requester, setRequester] = useState('');
    const [items, setItems] = useState<RequisitionItem[]>([]);

    // UI State for adding product
    const [isAdding, setIsAdding] = useState(false);
    const [newItemType, setNewItemType] = useState<'raw' | 'portioned'>('raw');
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [searchProduct, setSearchProduct] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState('');

    const queryClient = useQueryClient();

    // Fetch products
    const { data: productsData, isLoading: productsLoading } = useQuery({
        queryKey: ['products-list'],
        queryFn: async () => {
            const res = await api.get('/api/products?limit=1000&isActive=true'); // Limit high for MVP dropdown
            return res.data.data.data as Product[];
        },
        enabled: isOpen, // Only fetch when open
    });

    // Filtered products for search
    const filteredProducts = useMemo(() => {
        if (!productsData) return [];
        return productsData.filter(p =>
            p.name.toLowerCase().includes(searchProduct.toLowerCase()) ||
            (p.sku && p.sku.toLowerCase().includes(searchProduct.toLowerCase()))
        );
    }, [productsData, searchProduct]);

    // Mutation
    const createRequisition = useMutation({
        mutationFn: async (data: any) => {
            return api.post('/api/stock/movements/requisition', data);
        },
        onSuccess: () => {
            toast.success('Requisição realizada com sucesso!');
            // Invalidate all stock and product queries for immediate update
            queryClient.invalidateQueries({ queryKey: ['stock'] });
            queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
            queryClient.invalidateQueries({ queryKey: ['products'] });
            queryClient.invalidateQueries({ queryKey: ['products-list'] });
            queryClient.invalidateQueries({ queryKey: ['products-simple'] });
            queryClient.invalidateQueries({ queryKey: ['product-details'] });
            onClose();
            // Reset
            setCostCenter('');
            setRequester('');
            setItems([]);
        },
        onError: (error: any) => {
            const msg = error.response?.data?.error?.message || error.response?.data?.message || 'Erro ao processar requisição';
            toast.error(msg);
        }
    });

    // Handlers
    const handleAddItem = () => {
        if (!selectedProduct || !quantity) return;

        const qtyNum = parseFloat(quantity);
        if (isNaN(qtyNum) || qtyNum <= 0) {
            toast.error('Quantidade inválida');
            return;
        }

        if (qtyNum > selectedProduct.currentStock) {
            toast.error(`Estoque insuficiente. Disponível: ${selectedProduct.currentStock}`);
            return;
        }

        setItems(prev => [
            ...prev,
            {
                tempId: crypto.randomUUID(),
                productId: selectedProduct.id,
                productName: selectedProduct.name,
                unit: selectedProduct.baseUnit,
                currentStock: selectedProduct.currentStock,
                quantity: quantity,
                type: newItemType
            }
        ]);

        // Reset item form
        setIsAdding(false);
        setSelectedProduct(null);
        setQuantity('');
        setSearchProduct('');
    };

    const handleRemoveItem = (id: string) => {
        setItems(prev => prev.filter(i => i.tempId !== id));
    };

    const handleSubmit = () => {
        if (!costCenter || !requester || items.length === 0) {
            toast.error('Preencha os campos obrigatórios e adicione itens.');
            return;
        }

        const payload = {
            costCenter,
            requester,
            items: items.map(i => ({
                productId: i.productId,
                quantity: parseFloat(i.quantity),
                type: i.type
            }))
        };

        createRequisition.mutate(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10">
                    <h3 className="text-xl font-semibold text-white flex items-center gap-2">
                        <Package className="w-6 h-6 text-primary-400" /> Nova Requisição de Retirada
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 overflow-y-auto flex-1 space-y-6">

                    {/* Header Fields */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="label flex items-center gap-2">
                                <Store className="w-4 h-4" /> Centro de Custo <span className="text-red-400">*</span>
                            </label>
                            <select
                                className="input"
                                value={costCenter}
                                onChange={(e) => setCostCenter(e.target.value)}
                            >
                                <option value="">Selecione...</option>
                                <option value="Operação Compartilhada">Operação Compartilhada</option>
                                <option value="Alimentação Funcionários">Alimentação Funcionários</option>
                                <option value="Serviços Gerais">Serviços Gerais</option>
                                {subRestaurants.length > 0 && subRestaurants.map(r => (
                                    <option key={r.id} value={r.name}>{r.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="label flex items-center gap-2">
                                <User className="w-4 h-4" /> Requerente <span className="text-red-400">*</span>
                            </label>
                            <input
                                type="text"
                                className="input"
                                placeholder="Nome do solicitante"
                                value={requester}
                                onChange={(e) => setRequester(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between">
                            <h4 className="text-sm font-medium text-gray-300">Itens da Requisição</h4>
                            {!isAdding && (
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="btn-ghost text-primary-400 text-sm py-1 px-3"
                                >
                                    <Plus className="w-4 h-4 mr-1" /> Adicionar Produto
                                </button>
                            )}
                        </div>

                        {items.length === 0 && !isAdding && (
                            <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-xl bg-white/5">
                                <Package className="w-8 h-8 text-gray-500 mx-auto mb-2 opacity-50" />
                                <p className="text-gray-500 text-sm">Nenhum item adicionado à requisição.</p>
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="mt-3 text-primary-400 text-sm font-medium hover:underline"
                                >
                                    Clique para adicionar
                                </button>
                            </div>
                        )}

                        {items.map(item => (
                            <div key={item.tempId} className="flex items-center justify-between p-3 bg-white/5 rounded-lg border border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className={`p-2 rounded-lg ${item.type === 'raw' ? 'bg-green-500/20 text-green-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                        <Package className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <p className="text-white font-medium">{item.productName}</p>
                                        <p className="text-xs text-gray-400">
                                            {item.type === 'raw' ? 'Insumo Bruto' : 'Insumo Porcionado'} • Estoque Atual: {item.currentStock} {item.unit}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    <span className="font-mono text-lg text-white">{item.quantity} <span className="text-xs text-gray-500">{item.unit}</span></span>
                                    <button
                                        onClick={() => handleRemoveItem(item.tempId)}
                                        className="text-gray-500 hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))}

                        {/* Add Item Form */}
                        {isAdding && (
                            <div className="p-4 bg-gray-800/50 rounded-xl border border-primary-500/30 animate-in fade-in slide-in-from-top-2">
                                <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                                    {/* Type Selection */}
                                    <div className="md:col-span-3">
                                        <label className="label text-xs">Tipo</label>
                                        <select
                                            className="input text-sm py-2"
                                            value={newItemType}
                                            onChange={(e) => setNewItemType(e.target.value as any)}
                                        >
                                            <option value="raw">Insumo Bruto</option>
                                            <option value="portioned">Porcionado</option>
                                        </select>
                                    </div>

                                    {/* Product Search */}
                                    <div className="md:col-span-6 relative">
                                        <label className="label text-xs">Produto</label>
                                        {!selectedProduct ? (
                                            <div className="relative">
                                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                                <input
                                                    autoFocus
                                                    className="input pl-9 text-sm py-2"
                                                    placeholder="Buscar por nome ou SKU..."
                                                    value={searchProduct}
                                                    onChange={(e) => setSearchProduct(e.target.value)}
                                                    onFocus={() => setIsSearchFocused(true)}
                                                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                                />
                                                {/* Dropdown Results */}
                                                {(isSearchFocused || searchProduct.length > 0) && (
                                                    <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg shadow-xl max-h-48 overflow-y-auto">
                                                        {productsLoading ? (
                                                            <div className="p-3 text-center text-gray-500 text-xs">Carregando...</div>
                                                        ) : filteredProducts.length > 0 ? (
                                                            filteredProducts.map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => {
                                                                        setSelectedProduct(p);
                                                                        setSearchProduct('');
                                                                    }}
                                                                    className="w-full text-left px-3 py-2 hover:bg-gray-700 text-sm text-gray-200 border-b border-gray-700/50 last:border-0"
                                                                >
                                                                    <div className="flex justify-between">
                                                                        <span>{p.name}</span>
                                                                        <span className="text-gray-500 font-mono text-xs">{p.currentStock} {p.baseUnit}</span>
                                                                    </div>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="p-3 text-center text-gray-500 text-xs">Nenhum produto encontrado.</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between input py-1 bg-primary-500/10 border-primary-500/30">
                                                <span className="text-sm font-medium text-white truncate">{selectedProduct.name}</span>
                                                <button onClick={() => setSelectedProduct(null)} className="text-gray-400 hover:text-white">
                                                    <X className="w-4 h-4" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quantity */}
                                    <div className="md:col-span-3">
                                        <label className="label text-xs">Qtd ({selectedProduct?.baseUnit || '-'})</label>
                                        <input
                                            type="number"
                                            className="input text-sm py-2"
                                            placeholder="0.00"
                                            value={quantity}
                                            onChange={(e) => setQuantity(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                                        />
                                    </div>
                                </div>

                                <div className="flex justify-end gap-2 mt-3">
                                    <button
                                        onClick={() => setIsAdding(false)}
                                        className="btn-ghost text-xs py-1"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleAddItem}
                                        disabled={!selectedProduct || !quantity}
                                        className="btn-primary text-xs py-1 px-4"
                                    >
                                        Adicionar
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Disclaimer */}
                    <div className="flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                        <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                        <div className="text-xs text-yellow-200/80">
                            <p className="font-semibold text-yellow-400 mb-1">Atenção ao Retirar:</p>
                            <p>O sistema utilizará automaticamente a lógica <strong>FEFO (First Expire, First Out)</strong>. Os lotes com validade mais próxima serão consumidos primeiro.</p>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-end gap-3 bg-black/20">
                    <button
                        onClick={onClose}
                        className="btn-ghost"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={createRequisition.isPending || items.length === 0}
                        className="btn-primary min-w-[150px]"
                    >
                        {createRequisition.isPending ? (
                            <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Salvando...</>
                        ) : (
                            'Confirmar Requisição'
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}
