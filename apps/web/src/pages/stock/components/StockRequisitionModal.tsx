import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { X, Plus, Trash2, Search, Store, User, Package, AlertCircle, Loader2, Check } from 'lucide-react';
import toast from 'react-hot-toast';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../stores/auth';
import { QuantityStepper } from '../../../components/ui/QuantityStepper';
import { Combobox } from '@headlessui/react';

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
    productName: string;
    unit: string;
    currentStock: number;
}

interface CostCenter {
    id: string;
    name: string;
    type: 'RESTAURANT' | 'FIXED';
}

interface UserSummary {
    id: string;
    firstName: string;
    lastName: string;
    role: string;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export default function StockRequisitionModal({ isOpen, onClose }: Props) {
    // Stores
    const { user } = useAuthStore();
    const queryClient = useQueryClient();

    // State
    const [selectedCostCenterId, setSelectedCostCenterId] = useState('');
    const [selectedRequesterId, setSelectedRequesterId] = useState<string | null>('');
    const [requesterQuery, setRequesterQuery] = useState('');

    const [items, setItems] = useState<RequisitionItem[]>([]);

    // UI State for adding product
    const [isAdding, setIsAdding] = useState(false);
    const [isSearchFocused, setIsSearchFocused] = useState(false);
    const [searchProduct, setSearchProduct] = useState('');
    const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
    const [quantity, setQuantity] = useState('');

    // Fetch Cost Centers
    const { data: costCenters = [] } = useQuery({
        queryKey: ['cost-centers', user?.organizationId],
        queryFn: async () => {
            const res = await api.get('/api/stock/cost-centers');
            return res.data.data as CostCenter[];
        },
        enabled: isOpen && !!user,
    });

    // Fetch Users (Requesters)
    // We fetch all users in Org for the dropdown. 
    // If list is huge (>500), should implement server-side search. 
    // Assuming manageable size for now as per prompt "dropdown com scroll".
    const { data: usersData = [] } = useQuery({
        queryKey: ['users-list-simple', user?.organizationId],
        queryFn: async () => {
            const res = await api.get('/api/users?limit=1000&status=active');
            return res.data.data as UserSummary[];
        },
        enabled: isOpen && !!user,
    });

    const filteredUsers = useMemo(() => {
        if (!requesterQuery) return usersData;
        const q = requesterQuery.toLowerCase();
        return usersData.filter(u =>
            `${u.firstName} ${u.lastName}`.toLowerCase().includes(q) ||
            u.role.toLowerCase().includes(q)
        );
    }, [usersData, requesterQuery]);

    // Fetch products
    const { data: productsData, isLoading: productsLoading } = useQuery({
        queryKey: ['products-list'],
        queryFn: async () => {
            // Fetch products active. 
            // Ideally should filter by "Source Context".
            // Assuming current User context implies the Source Restaurant.
            const res = await api.get('/api/products?limit=1000&isActive=true');
            return res.data.data.data as Product[];
        },
        enabled: isOpen,
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
            // Invalidate queries with correct keys
            queryClient.invalidateQueries({ queryKey: ['stock-summary'] });
            queryClient.invalidateQueries({ queryKey: ['stock-movements'] });
            queryClient.invalidateQueries({ queryKey: ['products-list'] });
            onClose();
            // Reset
            setSelectedCostCenterId('');
            setSelectedRequesterId('');
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
                quantity: quantity
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
        if (!selectedCostCenterId || !selectedRequesterId || items.length === 0) {
            toast.error('Preencha os campos obrigatórios e adicione itens.');
            return;
        }

        const selectedCostCenter = costCenters.find(c => c.id === selectedCostCenterId);

        const payload = {
            organizationId: user?.organizationId,
            costCenterType: selectedCostCenter?.type,
            costCenterId: selectedCostCenterId,
            requesterId: selectedRequesterId,
            items: items.map(i => ({
                productId: i.productId,
                quantity: parseFloat(i.quantity)
            }))
        };

        createRequisition.mutate(payload);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in duration-200 shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/10 bg-white/5">
                    <h3 className="text-xl font-bold text-white flex items-center gap-3">
                        <div className="p-2 bg-primary-500/20 rounded-lg">
                            <Package className="w-6 h-6 text-primary-400" />
                        </div>
                        Nova Requisição (ABSTOC)
                    </h3>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                {/* Body - Scrollable */}
                <div className="p-6 overflow-y-auto flex-1 space-y-8">

                    {/* Header Fields - Grid Layout */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                        {/* Cost Center Select */}
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <Store className="w-4 h-4 text-primary-400" />
                                Centro de Custo <span className="text-red-400">*</span>
                            </label>
                            <div className="relative">
                                <select
                                    className="input w-full h-12 bg-black/20 focus:bg-black/40 border-white/10 focus:border-primary-500/50"
                                    value={selectedCostCenterId}
                                    onChange={(e) => setSelectedCostCenterId(e.target.value)}
                                >
                                    <option value="">Selecione o destino...</option>

                                    {/* Groups Flattened */}
                                    {costCenters.filter(c => c.type === 'FIXED').map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}

                                    {costCenters.filter(c => c.type === 'RESTAURANT').map(c => (
                                        <option key={c.id} value={c.id}>{c.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {/* Requester Combobox (Custom Dropdown with Scroll) */}
                        <div className="space-y-2 relative">
                            <label className="text-sm font-medium text-gray-300 flex items-center gap-2">
                                <User className="w-4 h-4 text-primary-400" />
                                Requerente <span className="text-red-400">*</span>
                            </label>

                            <Combobox value={selectedRequesterId} onChange={setSelectedRequesterId} nullable>
                                <div className="relative">
                                    <div className="relative w-full cursor-default overflow-hidden rounded-lg">
                                        <Combobox.Input
                                            className="input w-full h-12 bg-black/20 focus:bg-black/40 border-white/10 focus:border-primary-500/50 pl-4 pr-10"
                                            displayValue={(id: string) => {
                                                const u = usersData.find(u => u.id === id);
                                                return u ? `${u.firstName} ${u.lastName}` : '';
                                            }}
                                            onChange={(event) => setRequesterQuery(event.target.value)}
                                            placeholder="Buscar usuário..."
                                        />
                                        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-2">
                                            <Search className="h-4 w-4 text-gray-400" aria-hidden="true" />
                                        </Combobox.Button>
                                    </div>
                                    <Combobox.Options className="absolute mt-1 max-h-60 w-full overflow-auto rounded-md bg-gray-900 border border-white/10 py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm z-20">
                                        {filteredUsers.length === 0 && requesterQuery !== '' ? (
                                            <div className="relative cursor-default select-none py-2 px-4 text-gray-500">
                                                Nenhum usuário encontrado.
                                            </div>
                                        ) : (
                                            filteredUsers.map((person) => (
                                                <Combobox.Option
                                                    key={person.id}
                                                    className={({ active }) =>
                                                        `relative cursor-default select-none py-3 pl-10 pr-4 ${active ? 'bg-primary-500/20 text-white' : 'text-gray-300'
                                                        }`
                                                    }
                                                    value={person.id}
                                                >
                                                    {({ selected, active }) => (
                                                        <>
                                                            <div className="flex flex-col">
                                                                <span className={`block truncate ${selected ? 'font-medium' : 'font-normal'}`}>
                                                                    {person.firstName} {person.lastName}
                                                                </span>
                                                                <span className={`block truncate text-xs ${active ? 'text-primary-200' : 'text-gray-500'}`}>
                                                                    {person.role}
                                                                </span>
                                                            </div>
                                                            {selected ? (
                                                                <span className={`absolute inset-y-0 left-0 flex items-center pl-3 ${active ? 'text-white' : 'text-primary-500'}`}>
                                                                    <Check className="h-5 w-5" aria-hidden="true" />
                                                                </span>
                                                            ) : null}
                                                        </>
                                                    )}
                                                </Combobox.Option>
                                            ))
                                        )}
                                    </Combobox.Options>
                                </div>
                            </Combobox>
                        </div>
                    </div>

                    <div className="border-t border-white/10 pt-6"></div>

                    {/* Items Section */}
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <h4 className="text-lg font-bold text-white flex items-center gap-2">
                                Itens da Requisição
                                <span className="text-sm font-normal text-gray-400 px-2 py-0.5 bg-white/5 rounded-full">
                                    {items.length}
                                </span>
                            </h4>
                            {!isAdding && (
                                <button
                                    onClick={() => setIsAdding(true)}
                                    className="btn-primary text-sm py-2 px-4 shadow-lg shadow-primary-500/20"
                                >
                                    <Plus className="w-4 h-4 mr-2" /> Adicionar Item
                                </button>
                            )}
                        </div>

                        {/* Items List */}
                        <div className="space-y-3">
                            {items.length === 0 && !isAdding && (
                                <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl bg-white/5 hover:bg-white/10 transition-colors cursor-pointer" onClick={() => setIsAdding(true)}>
                                    <div className="w-16 h-16 rounded-full bg-black/20 flex items-center justify-center mx-auto mb-4">
                                        <Package className="w-8 h-8 text-gray-500 opacity-50" />
                                    </div>
                                    <p className="text-gray-400 text-sm font-medium">Sua lista está vazia.</p>
                                    <p className="text-gray-600 text-xs mt-1">Clique em "Adicionar Item" para começar.</p>
                                </div>
                            )}

                            {items.map(item => (
                                <div key={item.tempId} className="flex items-center justify-between p-4 bg-white/5 rounded-xl border border-white/5 hover:border-white/10 transition-colors group">
                                    <div className="flex items-center gap-4">
                                        <div className="p-3 rounded-lg bg-black/30 text-gray-400">
                                            <Package className="w-5 h-5" />
                                        </div>
                                        <div>
                                            <p className="text-white font-medium text-lg leading-tight">{item.productName}</p>
                                            <p className="text-xs text-gray-500 mt-1 flex items-center gap-2">
                                                <span className="w-1.5 h-1.5 rounded-full bg-green-500/50"></span>
                                                Disponível: {item.currentStock} {item.unit}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <span className="block font-mono text-xl font-bold text-white">{item.quantity}</span>
                                            <span className="text-xs text-gray-500 uppercase font-bold tracking-wider">{item.unit}</span>
                                        </div>
                                        <button
                                            onClick={() => handleRemoveItem(item.tempId)}
                                            className="p-2 text-gray-600 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                                            title="Remover item"
                                        >
                                            <Trash2 className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* Add Item Form (Inline) */}
                        {isAdding && (
                            <div className="p-6 bg-gray-900 rounded-xl border border-primary-500/50 shadow-2xl relative animate-scale-in">
                                <div className="absolute -top-3 left-6 px-2 bg-gray-900 text-primary-400 text-xs font-bold uppercase tracking-wider border border-primary-500/50 rounded">
                                    Novo Item
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-end">
                                    {/* Product Search */}
                                    <div className="md:col-span-8 relative">
                                        <label className="label text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">Produto</label>
                                        {!selectedProduct ? (
                                            <div className="relative">
                                                <Search className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                                                <input
                                                    autoFocus
                                                    className="input pl-10 h-12 bg-black/40 border-white/10 text-white placeholder-gray-600 w-full"
                                                    placeholder="Digite nome ou SKU para buscar..."
                                                    value={searchProduct}
                                                    onChange={(e) => setSearchProduct(e.target.value)}
                                                    onFocus={() => setIsSearchFocused(true)}
                                                    onBlur={() => setTimeout(() => setIsSearchFocused(false), 200)}
                                                />
                                                {/* Dropdown Results */}
                                                {(isSearchFocused || searchProduct.length > 0) && (
                                                    <div className="absolute z-20 w-full mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-2xl max-h-60 overflow-y-auto">
                                                        {productsLoading ? (
                                                            <div className="p-4 text-center text-gray-500 text-sm">Carregando...</div>
                                                        ) : filteredProducts.length > 0 ? (
                                                            filteredProducts.map(p => (
                                                                <button
                                                                    key={p.id}
                                                                    onClick={() => {
                                                                        setSelectedProduct(p);
                                                                        setSearchProduct('');
                                                                    }}
                                                                    className="w-full text-left px-4 py-3 hover:bg-white/10 text-sm border-b border-white/5 last:border-0 transition-colors flex justify-between items-center group"
                                                                >
                                                                    <div className="text-gray-200 group-hover:text-white font-medium">{p.name}</div>
                                                                    <div className="text-gray-500 font-mono text-xs bg-black/40 px-2 py-1 rounded">
                                                                        Estoque: {p.currentStock} {p.baseUnit}
                                                                    </div>
                                                                </button>
                                                            ))
                                                        ) : (
                                                            <div className="p-4 text-center text-gray-500 text-sm">Nenhum produto encontrado.</div>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="flex items-center justify-between input h-12 bg-primary-500/10 border-primary-500/50 px-4">
                                                <div className="flex items-center gap-3 overflow-hidden">
                                                    <Check className="w-5 h-5 text-primary-400 flex-shrink-0" />
                                                    <span className="font-bold text-white truncate">{selectedProduct.name}</span>
                                                </div>
                                                <button onClick={() => setSelectedProduct(null)} className="p-1 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors">
                                                    <X className="w-5 h-5" />
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quantity Stepper */}
                                    <div className="md:col-span-4">
                                        <label className="label text-xs uppercase tracking-wider font-bold text-gray-500 mb-1">
                                            Quantidade ({selectedProduct?.baseUnit || '-'})
                                        </label>
                                        <QuantityStepper
                                            value={quantity}
                                            onChange={setQuantity}
                                            unit={selectedProduct?.baseUnit}
                                            disabled={!selectedProduct}
                                        />
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex justify-end gap-3 mt-6 border-t border-white/5 pt-4">
                                    <button
                                        onClick={() => setIsAdding(false)}
                                        className="btn-ghost py-2 px-4"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        onClick={handleAddItem}
                                        disabled={!selectedProduct || !quantity}
                                        className="btn-primary py-2 px-6 shadow-lg shadow-primary-500/20"
                                    >
                                        Confirmar Item
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Disclaimer - always visible */}
                    <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                        <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-blue-200/80">
                            <p className="font-bold text-blue-400 mb-1">Política de Retirada (FEFO):</p>
                            <p className="leading-relaxed">
                                O sistema prioriza automaticamente os lotes com vencimento mais próximo
                                (First Expire, First Out). Ao confirmar, a baixa será realizada imediatamente.
                            </p>
                        </div>
                    </div>

                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 flex justify-between items-center bg-black/20">
                    <div className="text-xs text-gray-500">
                        {user?.firstName}, verifique os dados antes de salvar.
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={onClose}
                            className="btn-ghost"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleSubmit}
                            disabled={createRequisition.isPending || items.length === 0}
                            className="btn-primary min-w-[200px] h-12 shadow-xl shadow-primary-500/10"
                        >
                            {createRequisition.isPending ? (
                                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Processando...</>
                            ) : (
                                'Finalizar Requisição'
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
