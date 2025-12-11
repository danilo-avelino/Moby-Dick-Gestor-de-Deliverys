
import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/auth';
import { api } from '../../lib/api';
import { Plus, Search, Minus, Trash2, Check, X, AlertTriangle, FileText, ChevronDown, ChevronRight, Edit2, MessageSquare, Calendar, CheckCircle, Sun, Moon, Settings, Filter } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDate, formatNumber, cn } from '../../lib/utils';
import { ErrorBoundary } from '../../components/ErrorBoundary';

export default function ChefRequests() {
    const queryClient = useQueryClient();
    const [isNewRequestOpen, setIsNewRequestOpen] = useState(false);
    const [isTemplateOpen, setIsTemplateOpen] = useState(false);
    const [selectedRequest, setSelectedRequest] = useState<any>(null);
    const [requestToEdit, setRequestToEdit] = useState<any>(null); // State for editing
    const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved'>('all');

    // Queries
    const { data: requests, isLoading } = useQuery({
        queryKey: ['stock-requests'],
        queryFn: () => api.get('/api/stock-requests').then(r => r.data.data),
    });

    const { data: products } = useQuery({
        queryKey: ['products'],
        queryFn: () => api.get('/api/products', { params: { limit: 1000 } }).then(r => r.data.data.data),
    });

    const { data: template } = useQuery({
        queryKey: ['stock-request-template'],
        queryFn: () => api.get('/api/stock-requests/template').then(r => r.data.data),
    });

    // Mutations
    const createRequest = useMutation({
        mutationFn: (data: any) => api.post('/api/stock-requests', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
            setIsNewRequestOpen(false);
            toast.success('Requisição enviada com sucesso!');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao enviar'),
    });

    const updateRequest = useMutation({
        mutationFn: ({ id, data }: { id: string, data: any }) => api.put(`/api/stock-requests/${id}`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-requests'] });
            setRequestToEdit(null); // Close edit modal
            toast.success('Requisição atualizada com sucesso!');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao atualizar'),
    });

    const saveTemplate = useMutation({
        mutationFn: (data: any) => api.post('/api/stock-requests/template', data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-request-template'] });
            setIsTemplateOpen(false);
            toast.success('Lista padrão salva com sucesso!');
        },
        onError: (err: any) => toast.error(err.response?.data?.message || 'Erro ao salvar'),
    });

    const filteredRequests = requests?.filter((req: any) => {
        if (filterStatus === 'all') return true;
        return req.status === filterStatus.toUpperCase();
    });

    const handleEditRequest = (req: any, e: React.MouseEvent) => {
        e.stopPropagation(); // Prevent opening detail
        // Fetch full details if needed, or pass current object if it has items?
        // The list query includes `_count`, so we might need to fetch details or rely on detail view logic.
        // Wait, the list query only has `_count`. We need to fetch the request detail first or let the modal verify.
        // Let's assume we can fetch it or we pass the ID and let the modal/wrapper fetch it.
        // Actually simplest is to open a modal that fetches the ID.
        // But `RequestFormModal` expects `products` and `template`.
        // Let's fetch detail then open. Or simpler:
        // We will call the detail API when opening the edit modal?
        // Let's pass the request ID and let the PARENT fetch it? Or just fetch it.

        // Let's do a quick fetch here?
        api.get(`/api/stock-requests/${req.id}`).then(r => {
            setRequestToEdit(r.data.data);
        }).catch(() => toast.error('Erro ao carregar detalhes'));
    };

    return (
        <div className="space-y-6 animate-fade-in">
            <ErrorBoundary>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <h1 className="text-2xl font-bold text-white">Minhas Requisições</h1>
                        <p className="text-gray-400">Gerencie seus pedidos de insumos para a cozinha</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setIsTemplateOpen(true)}
                            className="btn-ghost text-sm"
                        >
                            <Settings className="w-4 h-4 mr-2" />
                            Configurar Padrão
                        </button>
                        <button
                            onClick={() => setIsNewRequestOpen(true)}
                            className="btn-primary"
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Nova Requisição
                        </button>
                    </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2 overflow-x-auto pb-2">
                    <Filter className="w-5 h-5 text-gray-500 mr-2 shrink-0" />
                    <button
                        onClick={() => setFilterStatus('all')}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                            filterStatus === 'all'
                                ? "bg-white text-black"
                                : "bg-white/5 text-gray-400 hover:text-white hover:bg-white/10"
                        )}
                    >
                        Todas
                    </button>
                    <button
                        onClick={() => setFilterStatus('pending')}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap flex items-center gap-2",
                            filterStatus === 'pending'
                                ? "bg-amber-500 text-black"
                                : "bg-white/5 text-amber-500 hover:bg-white/10"
                        )}
                    >
                        Pendentes
                    </button>
                    <button
                        onClick={() => setFilterStatus('approved')}
                        className={cn(
                            "px-4 py-2 rounded-full text-sm font-medium transition-all whitespace-nowrap",
                            filterStatus === 'approved'
                                ? "bg-green-500 text-black"
                                : "bg-white/5 text-green-500 hover:bg-white/10"
                        )}
                    >
                        Aprovadas
                    </button>
                </div>

                {/* History Table */}
                <div className="glass-card overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="table w-full">
                            <thead>
                                <tr className="border-b border-white/5">
                                    <th className="text-left p-4 text-gray-400 font-medium">Código</th>
                                    <th className="text-left p-4 text-gray-400 font-medium">Data Solicitação</th>
                                    <th className="text-left p-4 text-gray-400 font-medium">Status</th>
                                    <th className="text-left p-4 text-gray-400 font-medium">Itens</th>
                                    <th className="text-left p-4 text-gray-400 font-medium">Conclusão</th>
                                    <th className="w-10"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {isLoading ? (
                                    <tr><td colSpan={6} className="p-12 text-center text-gray-500">Carregando histórico...</td></tr>
                                ) : filteredRequests?.length === 0 ? (
                                    <tr><td colSpan={6} className="p-12 text-center text-gray-500">Nenhuma requisição encontrada com este filtro.</td></tr>
                                ) : (
                                    filteredRequests?.map((req: any) => (
                                        <tr
                                            key={req.id}
                                            onClick={() => setSelectedRequest(req)}
                                            className="hover:bg-white/5 cursor-pointer transition-colors border-b border-white/5 last:border-0 group"
                                        >
                                            <td className="p-4 font-mono text-primary-400 font-medium">{req.code}</td>
                                            <td className="p-4 text-gray-300">
                                                <div className="flex items-center gap-2">
                                                    <Calendar className="w-4 h-4 text-gray-600" />
                                                    {formatDate(req.createdAt)}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={cn(
                                                    "px-2 py-1 rounded text-xs font-bold uppercase tracking-wider",
                                                    req.status === 'APPROVED' ? "bg-green-500/20 text-green-400" :
                                                        req.status === 'REJECTED' ? "bg-red-500/20 text-red-400" :
                                                            "bg-amber-500/20 text-amber-400"
                                                )}>
                                                    {req.status === 'APPROVED' ? 'Aprovada' : req.status === 'REJECTED' ? 'Rejeitada' : 'Pendente'}
                                                </span>
                                            </td>
                                            <td className="p-4 text-gray-300">{req._count?.items || 0} itens</td>
                                            <td className="p-4 text-gray-400 text-sm">
                                                {req.approvedAt ? formatDate(req.approvedAt) : '-'}
                                            </td>
                                            <td className="p-4 text-right flex items-center justify-end gap-2">
                                                {req.status === 'PENDING' && (
                                                    <button
                                                        onClick={(e) => handleEditRequest(req, e)}
                                                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg group-hover:opacity-100 transition-all opacity-0"
                                                        title="Editar"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                )}
                                                <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-white transition-colors" />
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Modals */}
                {isNewRequestOpen && (
                    <RequestFormModal
                        onClose={() => setIsNewRequestOpen(false)}
                        onSubmit={(data: any) => createRequest.mutate(data)}
                        isLoading={createRequest.isPending}
                        products={products || []}
                        template={template}
                    />
                )}

                {requestToEdit && (
                    <RequestFormModal
                        onClose={() => setRequestToEdit(null)}
                        onSubmit={(data: any) => updateRequest.mutate({ id: requestToEdit.id, data })}
                        isLoading={updateRequest.isPending}
                        products={products || []}
                        template={null} // Don't use template, use initialData
                        initialData={requestToEdit}
                    />
                )}

                {isTemplateOpen && (
                    <TemplateFormModal
                        onClose={() => setIsTemplateOpen(false)}
                        onSubmit={(data: any) => saveTemplate.mutate(data)}
                        isLoading={saveTemplate.isPending}
                        products={products || []}
                        currentTemplate={template}
                    />
                )}

                {selectedRequest && (
                    <RequestDetailModal
                        requestId={selectedRequest.id}
                        onClose={() => setSelectedRequest(null)}
                    />
                )}
            </ErrorBoundary>
        </div>
    );
}

function RequestFormModal({ onClose, onSubmit, isLoading, products, template, initialData }: any) {
    const [items, setItems] = useState<any[]>([]);
    const initialized = useRef(false);

    useEffect(() => {
        if (!initialized.current) {
            if (initialData) {
                // Pre-fill from existing request
                setItems(initialData.items.map((t: any) => {
                    // Try to find in products list, fallback to item details
                    const prod = products.find((p: any) => p.id === t.productId);
                    return {
                        productId: t.productId,
                        // For edit, show previously requested amount
                        quantity: t.quantityRequested || t.quantity || 0,
                        notes: t.notes || '',
                        productName: prod?.name || t.product?.name || t.productNameSnapshot,
                        sku: prod?.sku || t.product?.sku,
                        baseUnit: prod?.baseUnit || t.product?.baseUnit || t.unitSnapshot,
                        currentStock: prod?.currentStock
                    };
                }));
                setChefObservation(initialData.chefObservation || '');
            } else if (template?.items) {
                // Pre-fill from template
                setItems(template.items.map((t: any) => {
                    // Try to find in products list, fallback to template details
                    const prod = products.find((p: any) => p.id === t.productId);
                    return {
                        productId: t.productId,
                        quantity: '', // Initialize empty as requested
                        notes: '',
                        productName: prod?.name || t.product?.name,
                        sku: prod?.sku || t.product?.sku,
                        baseUnit: prod?.baseUnit || t.product?.baseUnit,
                        currentStock: prod?.currentStock
                    };
                }));
            }
            initialized.current = true;
        }
    }, [template, products, initialData]);
    const [chefObservation, setChefObservation] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const handleAddItem = (productId: string) => {
        if (!items.find(i => i.productId === productId)) {
            const productToAdd = products.find((p: any) => p.id === productId);
            if (productToAdd) {
                setItems([...items, { productId, quantity: '', notes: '', productName: productToAdd.name }]);
            }
        }
        setSearchTerm('');
    };

    const handleRemoveItem = (index: number) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    const updateItem = (index: number, field: string, value: any) => {
        const newItems = [...items];
        newItems[index] = { ...newItems[index], [field]: value };
        setItems(newItems);
    };

    const handleSubmit = () => {
        const validItems = items.filter(i => i.quantity > 0);
        if (validItems.length === 0) {
            toast.error('Adicione pelo menos um item com quantidade válida');
            return;
        }
        // Basic frontend validation for stock
        const invalidStock = validItems.some(item => {
            const product = products.find((p: any) => p.id === item.productId);
            // If checking generic product not yet loaded, we skip validation or be careful
            // For now, strict validation only if stock is known?
            // Actually, we should allow requesting even if stock is 0?
            // Let's prompt confirmation if exceeding.
            const stock = product?.currentStock;
            return stock !== undefined && item.quantity > stock;
        });

        if (invalidStock) {
            if (!confirm('Alguns itens excedem o estoque disponível. Deseja enviar mesmo assim? (Pode ser rejeitado)')) {
                return;
            }
        }

        onSubmit({ chefObservation, items: validItems });
    };

    const filteredProducts = products.filter((p: any) =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-4xl max-h-[95vh] flex flex-col animate-scale-in border border-white/10 shadow-2xl">
                <div className="flex justify-between items-center p-6 border-b border-white/10 bg-white/5">
                    <div>
                        <h2 className="text-xl font-bold text-white">Nova Requisição</h2>
                        <p className="text-gray-400 text-sm">Selecione os itens e quantidades</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Search Product to Add */}
                    <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                        <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">Adicionar Produto</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Busque por nome ou SKU..."
                                className="input pl-10 w-full"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto z-20">
                                    {filteredProducts.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500">Nenhum produto encontrado</div>
                                    ) : (
                                        filteredProducts.map((p: any) => (
                                            <button
                                                key={p.id}
                                                className="w-full text-left p-3 hover:bg-white/10 flex justify-between items-center border-b border-white/5 last:border-0"
                                                onClick={() => handleAddItem(p.id)}
                                            >
                                                <div>
                                                    <p className="font-medium text-white">{p.name}</p>
                                                    <p className="text-xs text-gray-400">SKU: {p.sku} • Estoque: {p.currentStock} {p.baseUnit}</p>
                                                </div>
                                                <Plus className="w-4 h-4 text-primary-400" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Items List */}
                    <div className="space-y-3">
                        <label className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Itens da Requisição</label>
                        {items.length === 0 ? (
                            <div className="text-center py-12 border-2 border-dashed border-white/10 rounded-xl">
                                <p className="text-gray-500">Sua lista está vazia.</p>
                                <p className="text-xs text-gray-600 mt-1">Adicione itens na busca acima ou configure uma lista padrão.</p>
                            </div>
                        ) : (
                            items.map((item, index) => {
                                const product = products.find((p: any) => p.id === item.productId);
                                // If not in product list, use item cached details
                                const name = product?.name || item.productName || 'Produto Desconhecido';
                                const sku = product?.sku || item.sku;
                                const baseUnit = product?.baseUnit || item.baseUnit || 'un';
                                const currentStock = product?.currentStock; // Can be undefined

                                const available = currentStock ?? 0;
                                // Only show exceeding warning if we KNOW the stock and it's exceeding
                                const isExceeding = currentStock !== undefined && item.quantity > available;

                                return (
                                    <div key={item.productId} className={cn(
                                        "flex flex-col md:flex-row gap-4 p-4 rounded-xl border transition-all",
                                        isExceeding ? "bg-red-500/10 border-red-500/30" : "bg-white/5 border-white/5"
                                    )}>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <p className="font-bold text-white text-lg">{name}</p>
                                                {sku && <span className="text-xs bg-black/30 px-2 py-0.5 rounded text-gray-400">{sku}</span>}
                                            </div>
                                            <div className="text-sm flex items-center gap-2">
                                                <span className="text-gray-400">Estoque Disponível:</span>
                                                <span className={cn("font-mono font-bold", available <= 0 && currentStock !== undefined ? 'text-red-400' : 'text-green-400')}>
                                                    {currentStock !== undefined ? `${formatNumber(available)} ${baseUnit} ` : '-'}
                                                </span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <div className="w-32">
                                                <label className="text-[10px] text-gray-500 block mb-1 uppercase font-bold">Qtd Solicitada</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="0.01"
                                                        value={item.quantity}
                                                        onChange={(e) => updateItem(index, 'quantity', e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                        className={cn(
                                                            "input w-full text-right font-bold text-lg h-10 px-2",
                                                            isExceeding ? "border-red-500 text-red-100 focus:border-red-500 focus:ring-red-500/50" : ""
                                                        )}
                                                    />
                                                    {isExceeding && (
                                                        <div className="absolute -top-3 -right-2 text-red-500 bg-black/80 rounded px-2 py-0.5 text-[10px] whitespace-nowrap z-10 border border-red-500/30 shadow-xl">
                                                            Excede estoque!
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleRemoveItem(index)}
                                                className="p-3 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors mt-4"
                                                title="Remover item"
                                            >
                                                <X className="w-5 h-5" />
                                            </button>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    <div>
                        <label className="label">Observações Gerais</label>
                        <textarea
                            className="input w-full h-24 resize-none"
                            value={chefObservation}
                            onChange={e => setChefObservation(e.target.value)}
                            placeholder="Ex: Preciso disto com urgência para o evento de amanhã..."
                        />
                    </div>
                </div >

                <div className="flex justify-end gap-3 p-6 border-t border-white/10 bg-white/5 rounded-b-xl">

                    <button onClick={onClose} className="btn-ghost" disabled={isLoading}>Cancelar</button>
                    <button onClick={handleSubmit} disabled={isLoading} className="btn-primary min-w-[150px]">
                        {isLoading ? (
                            <span className="flex items-center gap-2"><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Enviando...</span>
                        ) : (
                            <span className="flex items-center gap-2"><Check className="w-4 h-4" /> Enviar Requisição</span>
                        )}
                    </button>
                </div>
            </div >
        </div >
    );
}

function TemplateFormModal({ onClose, onSubmit, isLoading, currentTemplate }: any) {
    // Initialize items with full details from the template include
    const [shift, setShift] = useState<'DAY' | 'NIGHT'>((currentTemplate?.shift as any) || 'DAY');
    const [items, setItems] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Fetch template when shift changes
    const { data: shiftTemplate, refetch: refetchTemplate } = useQuery({
        queryKey: ['stock-request-template', shift],
        queryFn: () => api.get('/api/stock-requests/template', { params: { shift } }).then(r => r.data.data),
        enabled: true,
    });

    // When shiftTemplate loads, update items (if user confirms? Or auto-switch?)
    // This is tricky. If user is editing, switching shift should probably load that shift's list.
    // Let's rely on a useEffect to update items when shiftTemplate changes.
    useEffect(() => {
        if (shiftTemplate) {
            setItems(shiftTemplate.items?.map((t: any) => ({
                productId: t.productId,
                quantity: t.standardQuantity || 0,
                name: t.product?.name || 'Produto Desconhecido',
                baseUnit: t.product?.baseUnit || 'un',
                sku: t.product?.sku
            })) || []);
        } else {
            // Empty if no template for this shift
            setItems([]);
        }
    }, [shiftTemplate]);

    // Debounce search term
    useEffect(() => {
        const timer = setTimeout(() => setDebouncedSearch(searchTerm), 500);
        return () => clearTimeout(timer);
    }, [searchTerm]);

    // Server-side search
    const { data: searchResults, isError, error, isLoading: isSearching } = useQuery({
        queryKey: ['products-search', debouncedSearch],
        queryFn: () => {
            if (!debouncedSearch) return Promise.resolve([]);
            return api.get('/api/products', {
                params: { search: debouncedSearch, limit: 20 }
            }).then(r => r.data.data.data);
        },
        enabled: debouncedSearch.length > 0,
        staleTime: 1000 * 60, // 1 minute
        retry: 1,
    });

    const handleAddItem = (product: any) => {
        if (!items.find(i => i.productId === product.id)) {
            setItems([...items, {
                productId: product.id,
                quantity: 0,
                name: product.name,
                baseUnit: product.baseUnit,
                sku: product.sku
            }]);
        }
        setSearchTerm('');
    };

    const handleRemoveItem = (productId: string) => {
        setItems(items.filter(i => i.productId !== productId));
    };



    // Filter out already selected items from search results
    const displayResults = (searchResults || []).filter((p: any) =>
        !items.find(i => i.productId === p.id)
    );

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-2xl flex flex-col max-h-[85vh] animate-scale-in border border-white/10 shadow-2xl">
                <div className="p-6 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <div>
                        <h2 className="text-xl font-bold text-white">Configurar Lista Padrão</h2>
                        <p className="text-gray-400 text-sm">Defina itens para o turno {shift === 'DAY' ? 'Dia' : 'Noite'}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-6 h-6" /></button>
                </div>

                <div className="px-6 pt-4">
                    <div className="flex bg-black/40 p-1 rounded-lg">
                        <button
                            onClick={() => setShift('DAY')}
                            className={cn(
                                "flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
                                shift === 'DAY' ? "bg-primary-500 text-black shadow-lg" : "text-gray-400 hover:text-white"
                            )}
                        >
                            <Sun className="w-4 h-4" /> Turno Dia
                        </button>
                        <button
                            onClick={() => setShift('NIGHT')}
                            className={cn(
                                "flex-1 py-2 text-sm font-medium rounded-md transition-all flex items-center justify-center gap-2",
                                shift === 'NIGHT' ? "bg-indigo-500 text-white shadow-lg" : "text-gray-400 hover:text-white"
                            )}
                        >
                            <Moon className="w-4 h-4" /> Turno Noite
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {/* Search Component */}
                    <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                        <label className="text-xs text-gray-500 font-bold uppercase tracking-wider mb-2 block">Adicionar item do estoque</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Busque por nome ou SKU..."
                                className="input pl-10 w-full"
                                value={searchTerm}
                                onChange={e => setSearchTerm(e.target.value)}
                            />
                            {searchTerm && (
                                <div className="absolute top-full left-0 right-0 mt-2 bg-gray-900 border border-gray-700 rounded-xl shadow-xl max-h-60 overflow-y-auto z-20">
                                    {isSearching ? (
                                        <div className="p-4 text-center text-gray-500">Buscando...</div>
                                    ) : isError ? (
                                        <div className="p-4 text-center text-amber-500 text-xs">
                                            <p className="font-bold">Erro: {(error as any)?.response?.status}</p>
                                            <p>{(error as any)?.response?.data?.message || (error as any)?.message}</p>
                                            <p className="mt-1 opacity-50">URL: /api/products</p>
                                        </div>
                                    ) : displayResults.length === 0 ? (
                                        <div className="p-4 text-center text-gray-500">
                                            {debouncedSearch !== searchTerm ? 'Buscando...' : 'Nenhum produto encontrado'}
                                        </div>
                                    ) : (
                                        displayResults.map((p: any) => (
                                            <button
                                                key={p.id}
                                                className="w-full text-left p-3 hover:bg-white/10 flex justify-between items-center border-b border-white/5 last:border-0"
                                                onClick={() => handleAddItem(p)}
                                            >
                                                <div>
                                                    <p className="font-medium text-white">{p.name}</p>
                                                    <p className="text-xs text-gray-400">SKU: {p.sku} • {p.baseUnit}</p>
                                                </div>
                                                <Plus className="w-4 h-4 text-primary-400" />
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Selected Items List */}
                    <div className="space-y-3">
                        <label className="text-xs text-gray-500 font-bold uppercase tracking-wider block">Itens da Lista ({items.length})</label>
                        <div className="space-y-2">
                            {items.length === 0 ? (
                                <div className="text-center py-8 border-2 border-dashed border-white/10 rounded-xl">
                                    <p className="text-gray-500">Nenhum item adicionado à lista padrão</p>
                                </div>
                            ) : (
                                items.map((item) => (
                                    <div
                                        key={item.productId}
                                        className="flex items-center justify-between p-3 rounded-lg border border-white/10 bg-white/5"
                                    >
                                        <div className="flex-1">
                                            <p className="font-medium text-white">{item.name}</p>
                                            <p className="text-xs text-gray-400">{item.baseUnit} {item.sku ? `• SKU: ${item.sku} ` : ''}</p>
                                        </div>

                                        <div className="flex items-center gap-4">
                                            <button
                                                onClick={() => handleRemoveItem(item.productId)}
                                                className="p-2 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                                                title="Remover da lista"
                                            >
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex justify-end items-center p-6 border-t border-white/10 bg-white/5 rounded-b-xl gap-3">
                    <button onClick={onClose} className="btn-ghost">Cancelar</button>
                    <button
                        onClick={() => onSubmit({
                            name: `Lista Padrão(${shift === 'DAY' ? 'Dia' : 'Noite'})`,
                            shift,
                            items: items.map(i => ({ productId: i.productId, quantity: 1 }))
                        })}
                        disabled={isLoading}
                        className="btn-primary"
                    >
                        {isLoading ? 'Salvando...' : 'Salvar Alterações'}
                    </button>
                </div>
            </div>
        </div>
    );
}


function RequestDetailModal({ requestId, onClose }: any) {
    const queryClient = useQueryClient();
    const [comment, setComment] = useState('');

    const { data: request, isLoading } = useQuery({
        queryKey: ['stock-request', requestId],
        queryFn: () => api.get(`/api/stock-requests/${requestId}`).then(r => r.data.data),
    });

    const commentMutation = useMutation({
        mutationFn: (msg: string) => api.post(`/api/stock-requests/${requestId}/comments`, { message: msg }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['stock-request', requestId] });
            setComment('');
            toast.success('Comentário enviado');
        }
    });

    if (!request) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
            <div className="glass-card w-full max-w-5xl max-h-[90vh] flex flex-col animate-scale-in">
                <div className="flex justify-between items-start p-6 border-b border-white/10">
                    <div>
                        <div className="flex items-center gap-3">
                            <h2 className="text-2xl font-bold text-white">{request.code}</h2>
                            <span className={cn(
                                "badge text-sm px-3 py-1",
                                request.status === 'APPROVED' ? "bg-green-500/20 text-green-400" :
                                    request.status === 'REJECTED' ? "bg-red-500/20 text-red-400" :
                                        "bg-amber-500/20 text-amber-400"
                            )}>
                                {request.status === 'APPROVED' ? 'Aprovada' : request.status === 'REJECTED' ? 'Rejeitada' : 'Pendente'}
                            </span>
                        </div>
                        <p className="text-gray-400 mt-1">Solicitado em {formatDate(request.createdAt)}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6 text-gray-400" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex flex-col md:flex-row">
                    {/* Items Column */}
                    <div className="flex-1 overflow-y-auto p-6 border-r border-white/10">
                        {request.chefObservation && (
                            <div className="bg-white/5 p-4 rounded-lg mb-6 border-l-4 border-primary-500">
                                <p className="text-xs text-gray-400 uppercase font-bold mb-1">Sua Observação</p>
                                <p className="text-white italic">"{request.chefObservation}"</p>
                            </div>
                        )}

                        <table className="table w-full">
                            <thead>
                                <tr className="border-b border-white/10">
                                    <th className="text-left text-gray-400 pb-3 font-medium">Produto</th>
                                    <th className="text-right text-gray-400 pb-3 font-medium">Qtd. Solicitada</th>
                                    <th className="text-right text-gray-400 pb-3 font-medium">Qtd. Aprovada</th>
                                </tr>
                            </thead>
                            <tbody>
                                {request.items.map((item: any) => (
                                    <tr key={item.id} className="border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors">
                                        <td className="py-4 text-white">
                                            <span className="font-medium block">{item.productNameSnapshot}</span>
                                            {item.notes && <span className="text-xs text-yellow-500/80 mt-1 block">Obs: {item.notes}</span>}
                                        </td>
                                        <td className="py-4 text-right text-gray-300 font-mono">{formatNumber(item.quantityRequested)} {item.unitSnapshot}</td>
                                        <td className="py-4 text-right">
                                            {item.quantityApproved !== null ? (
                                                <span className={cn("font-bold font-mono", item.quantityApproved < item.quantityRequested ? "text-amber-400" : "text-green-400")}>
                                                    {formatNumber(item.quantityApproved)} {item.unitSnapshot}
                                                </span>
                                            ) : (
                                                <span className="text-gray-500">-</span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Timeline Column */}
                    <div className="w-full md:w-80 bg-black/20 overflow-y-auto p-6 flex flex-col">
                        <h3 className="text-white font-bold mb-4 flex items-center gap-2">
                            <MessageSquare className="w-4 h-4" /> Histórico
                        </h3>

                        <div className="space-y-6">
                            {/* Created Event */}
                            <div className="relative pl-6 border-l border-white/10 pb-2">
                                <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-primary-500"></div>
                                <p className="text-sm text-gray-300">Requisição criada</p>
                                <p className="text-xs text-gray-500">{formatDate(request.createdAt)}</p>
                            </div>

                            {request.comments?.map((c: any) => (
                                <div key={c.id} className="relative pl-6 border-l border-white/10 pb-2">
                                    <div className="absolute -left-1.5 top-0 w-3 h-3 rounded-full bg-gray-600"></div>
                                    <div className="bg-white/5 p-3 rounded-lg rounded-tl-none">
                                        <div className="flex justify-between items-start mb-1">
                                            <span className="font-bold text-xs text-white">{c.user?.firstName} ({c.user?.role})</span>
                                            <span className="text-[10px] text-gray-500">{formatDate(c.createdAt)}</span>
                                        </div>
                                        <p className="text-xs text-gray-300">{c.message}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* New Comment Section - Fixed at bottom of timeline column */}
                    <div className="p-6 border-t border-white/10 bg-black/20 md:w-80">
                        <label className="text-xs text-gray-500 font-bold uppercase mb-2 block">Novo Comentário</label>
                        <textarea
                            className="input w-full text-sm resize-none bg-black/20 focus:bg-black/40"
                            rows={3}
                            placeholder="Escreva uma observação..."
                            value={comment}
                            onChange={e => setComment(e.target.value)}
                        />
                        <button
                            onClick={() => commentMutation.mutate(comment)}
                            disabled={!comment.trim() || commentMutation.isPending}
                            className="btn-ghost w-full mt-2 text-sm border border-white/10 hover:bg-white/5"
                        >
                            Enviar Comentário
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

