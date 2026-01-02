
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { useAuthStore } from '../../stores/auth';
import {
    ArrowLeft, Search, Plus, Minus, Trash2, User, MapPin,
    Truck, Package, Users, CreditCard, ShoppingCart, X
} from 'lucide-react';
import { cn } from '../../lib/utils';
import ModifierSelectionModal from './ModifierSelectionModal';

interface MenuItem {
    id: string;
    name: string;
    description?: string;
    price: number;
    menuCategoryId: string;
    imageUrl?: string;
    type: 'SIMPLE' | 'COMBO';
    optionGroups: any[];
}

interface CartItem {
    productId: string;
    productName: string;
    productSku?: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
    options?: any[];
}

interface Customer {
    id: string;
    name: string;
    phone?: string;
    addresses: Array<{
        id: string;
        label?: string;
        street: string;
        number?: string;
        neighborhood: string;
        city: string;
    }>;
}

interface Table {
    id: string;
    identifier: string;
    status: 'LIVRE' | 'OCUPADA' | 'RESERVADA';
}

type OrderType = 'DELIVERY' | 'RETIRADA' | 'SALAO';

function formatCurrency(value: number): string {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

export default function NewOrder() {
    const navigate = useNavigate();
    const { user } = useAuthStore();
    const currentCostCenterId = user?.costCenter?.id;

    // Order state
    const [orderType, setOrderType] = useState<OrderType>('RETIRADA');
    const [cart, setCart] = useState<CartItem[]>([]);
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
    const [selectedAddressId, setSelectedAddressId] = useState<string>('');
    const [selectedTableId, setSelectedTableId] = useState<string>('');
    const [deliveryFee, setDeliveryFee] = useState(0);
    const [notes, setNotes] = useState('');
    const [productSearch, setProductSearch] = useState('');
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [showPaymentModal, setShowPaymentModal] = useState(false);

    // Modifier Modal
    const [showModifierModal, setShowModifierModal] = useState(false);
    const [selectedItemForModifiers, setSelectedItemForModifiers] = useState<MenuItem | null>(null);

    // Fetch Menu (Categories included)
    const { data: menuData } = useQuery({
        queryKey: ['menu-pdv', currentCostCenterId, orderType],
        queryFn: async () => {
            if (!currentCostCenterId) return [];
            const res = await api.get('/api/menu/pdv', {
                params: {
                    costCenterId: currentCostCenterId,
                    channel: orderType
                }
            });
            return res.data.data || [];
        },
        enabled: !!currentCostCenterId
    });

    const categories = menuData || [];

    const products = useMemo(() => {
        const allItems: MenuItem[] = [];
        categories.forEach((cat: any) => {
            if (cat.items) {
                allItems.push(...cat.items.map((item: any) => ({ ...item, menuCategoryId: cat.id })));
            }
        });
        return allItems;
    }, [categories]);

    // Fetch tables
    const { data: tablesData } = useQuery({
        queryKey: ['tables-pdv'],
        queryFn: async () => {
            const res = await api.get('/api/tables?status=LIVRE');
            return res.data.data || [];
        },
        enabled: orderType === 'SALAO',
    });
    const tables: Table[] = tablesData || [];

    // Filtered products
    const filteredProducts = useMemo(() => {
        return products.filter(p => {
            const matchesSearch = !productSearch ||
                p.name.toLowerCase().includes(productSearch.toLowerCase());
            const matchesCategory = !selectedCategory || p.menuCategoryId === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, productSearch, selectedCategory]);

    const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const total = subtotal + (orderType === 'DELIVERY' ? deliveryFee : 0);

    const addToCart = (product: MenuItem) => {
        if (product.optionGroups && product.optionGroups.length > 0) {
            setSelectedItemForModifiers(product);
            setShowModifierModal(true);
            return;
        }

        const existing = cart.find(item => item.productId === product.id && (!item.options || item.options.length === 0));

        if (existing) {
            setCart(cart.map(item =>
                item.productId === product.id && (!item.options || item.options.length === 0)
                    ? { ...item, quantity: item.quantity + 1 }
                    : item
            ));
        } else {
            setCart([...cart, {
                productId: product.id,
                productName: product.name,
                quantity: 1,
                unitPrice: product.price,
            }]);
        }
    };

    const updateCartItem = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            setCart(cart.filter(item => item.productId !== productId));
        } else {
            setCart(cart.map(item =>
                item.productId === productId ? { ...item, quantity } : item
            ));
        }
    };

    const removeFromCart = (productId: string) => {
        setCart(cart.filter(item => item.productId !== productId));
    };

    const createOrderMutation = useMutation({
        mutationFn: async (payments: Array<{ method: string; amount: number }>) => {
            const orderRes = await api.post('/api/pdv/orders', {
                orderType,
                salesChannel: 'PRESENCIAL',
                customerId: selectedCustomer?.id,
                customerName: customerName || selectedCustomer?.name,
                customerPhone: customerPhone || selectedCustomer?.phone,
                addressId: orderType === 'DELIVERY' ? selectedAddressId : undefined,
                deliveryFee: orderType === 'DELIVERY' ? deliveryFee : 0,
                tableId: orderType === 'SALAO' ? selectedTableId : undefined,
                notes,
                items: cart.map(item => ({
                    productId: item.productId,
                    productName: item.productName,
                    productSku: item.productSku,
                    quantity: item.quantity,
                    unitPrice: item.unitPrice,
                    notes: item.notes,
                    options: item.options
                })),
            });

            const order = orderRes.data.data;

            for (const payment of payments) {
                await api.post(`/api/pdv/orders/${order.id}/payments`, payment);
            }

            return order;
        },
        onSuccess: () => {
            navigate('/pdv');
        },
    });

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.ctrlKey && e.key === 'b') {
                e.preventDefault();
                document.getElementById('product-search')?.focus();
            }
            if (e.ctrlKey && e.key === 'p') {
                e.preventDefault();
                if (cart.length > 0) setShowPaymentModal(true);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [cart.length]);

    return (
        <div className="h-full flex flex-col -m-6 bg-gray-950">
            {/* Header */}
            <div className="bg-gray-900/50 backdrop-blur-xl border-b border-white/5 px-6 py-4 flex items-center justify-between z-10">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/pdv')}
                        className="p-2 hover:bg-white/5 rounded-full transition-colors text-gray-400 hover:text-white"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div>
                        <h1 className="text-lg font-bold text-white leading-none">Novo Pedido</h1>
                        <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">Terminal de Atendimento</p>
                    </div>
                </div>

                {/* Order Type Selector */}
                <div className="flex gap-1 bg-white/5 p-1 rounded-xl">
                    {[
                        { type: 'DELIVERY' as OrderType, label: 'Delivery', icon: Truck },
                        { type: 'RETIRADA' as OrderType, label: 'Retirada', icon: Package },
                        { type: 'SALAO' as OrderType, label: 'Salão', icon: Users },
                    ].map(({ type, label, icon: Icon }) => (
                        <button
                            key={type}
                            onClick={() => setOrderType(type)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200',
                                orderType === type
                                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/20'
                                    : 'text-gray-500 hover:text-gray-300'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            <span className="hidden sm:inline">{label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Categories */}
                <div className="w-56 bg-gray-900/30 border-r border-white/5 overflow-y-auto p-4 space-y-1">
                    <h3 className="text-[10px] font-bold text-gray-600 uppercase tracking-widest px-4 mb-4">Categorias</h3>
                    <button
                        onClick={() => setSelectedCategory('')}
                        className={cn(
                            'w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200',
                            !selectedCategory
                                ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                                : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                        )}
                    >
                        Todos os Itens
                    </button>
                    {categories.map((cat: any) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={cn(
                                'w-full text-left px-4 py-3 rounded-xl text-sm font-bold transition-all duration-200',
                                selectedCategory === cat.id
                                    ? 'bg-primary-500/10 text-primary-400 border border-primary-500/20'
                                    : 'text-gray-500 hover:bg-white/5 hover:text-gray-300'
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Center: Products Grid */}
                <div className="flex-1 overflow-y-auto p-6 bg-gray-950">
                    <div className="max-w-6xl mx-auto space-y-6">
                        {/* Search */}
                        <div className="relative group">
                            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-600 group-focus-within:text-primary-500 transition-colors" />
                            <input
                                id="product-search"
                                type="text"
                                placeholder="Encontre produtos por nome ou código (Ctrl + B)"
                                value={productSearch}
                                onChange={(e) => setProductSearch(e.target.value)}
                                className="input pl-12 py-4 bg-white/5 border-white/5 focus:bg-white/10 text-lg transition-all"
                            />
                        </div>

                        {/* Products Grid */}
                        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredProducts.map((product) => (
                                <button
                                    key={product.id}
                                    onClick={() => addToCart(product)}
                                    className="card group bg-gray-900/40 border-white/5 hover:border-primary-500/30 hover:bg-primary-500/5 transition-all duration-300 flex flex-col text-left overflow-hidden shadow-sm hover:shadow-primary-500/10"
                                >
                                    <div className="aspect-[4/3] bg-gray-800 relative overflow-hidden">
                                        {product.imageUrl ? (
                                            <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                                        ) : (
                                            <div className="absolute inset-0 flex items-center justify-center opacity-20">
                                                <Package size={48} className="text-gray-400" />
                                            </div>
                                        )}
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
                                        <div className="absolute bottom-3 left-3 right-3">
                                            <p className="text-xs font-bold text-primary-400">{formatCurrency(product.price)}</p>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <h3 className="text-sm font-bold text-white line-clamp-2 leading-tight group-hover:text-primary-400 transition-colors">{product.name}</h3>
                                        <p className="text-[10px] text-gray-500 mt-1 uppercase font-bold tracking-wider">{product.type}</p>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right: Cart */}
                <div className="w-[400px] bg-gray-900/50 backdrop-blur-3xl border-l border-white/5 flex flex-col shadow-2xl">
                    {/* Customer Info */}
                    <div className="p-6 space-y-4 border-b border-white/5">
                        <div className="flex items-center justify-between mb-2">
                            <h3 className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">Informações do Pedido</h3>
                            <button className="text-[10px] font-bold text-primary-500 hover:text-primary-400 transition-colors">LIMPAR TUDO</button>
                        </div>

                        <div className="space-y-3">
                            <div className="relative group">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Nome do cliente"
                                    value={customerName}
                                    onChange={(e) => setCustomerName(e.target.value)}
                                    className="input pl-10 py-2.5 bg-white/5 border-white/5 focus:bg-white/10 text-sm"
                                />
                            </div>
                            <div className="relative group">
                                <X className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-600 group-focus-within:text-primary-500 transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Telefone"
                                    value={customerPhone}
                                    onChange={(e) => setCustomerPhone(e.target.value)}
                                    className="input pl-10 py-2.5 bg-white/5 border-white/5 focus:bg-white/10 text-sm"
                                />
                            </div>
                        </div>

                        {orderType === 'DELIVERY' && (
                            <div className="space-y-3 pt-2 animate-in slide-in-from-top-2 duration-300">
                                <div className="relative group">
                                    <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-600 group-focus-within:text-primary-500 transition-colors" />
                                    <textarea
                                        placeholder="Endereço de entrega completo..."
                                        className="input pl-10 py-2.5 h-20 bg-white/5 border-white/5 focus:bg-white/10 text-sm resize-none"
                                    />
                                </div>
                                <div className="flex items-center justify-between bg-white/5 p-3 rounded-xl border border-white/5">
                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Taxa de Entrega</span>
                                    <input
                                        type="number"
                                        value={deliveryFee}
                                        onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                                        className="bg-transparent border-none text-right font-bold text-primary-400 w-24 focus:ring-0 text-sm"
                                        step="0.01"
                                    />
                                </div>
                            </div>
                        )}

                        {orderType === 'SALAO' && (
                            <div className="pt-2 animate-in slide-in-from-top-2 duration-300">
                                <select
                                    value={selectedTableId}
                                    onChange={(e) => setSelectedTableId(e.target.value)}
                                    className="input py-2.5 bg-white/5 border-white/5 focus:bg-white/10 text-sm font-bold"
                                >
                                    <option value="">Selecione a Mesa</option>
                                    {tables.map(table => (
                                        <option key={table.id} value={table.id}>Mesa {table.identifier}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-4">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                                <ShoppingCart className="w-16 h-16 mb-4 text-gray-400" />
                                <p className="text-sm font-bold uppercase tracking-widest text-gray-400">Sacola Vazia</p>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                {cart.map((item, idx) => (
                                    <div key={`${item.productId}-${idx}`} className="group bg-white/5 border border-white/5 hover:border-primary-500/20 hover:bg-white/10 p-4 rounded-2xl transition-all duration-200">
                                        <div className="flex items-start justify-between mb-3">
                                            <div className="flex-1">
                                                <h4 className="text-sm font-bold text-white group-hover:text-primary-400 transition-colors">{item.productName}</h4>
                                                <p className="text-xs text-gray-500 mt-0.5">{formatCurrency(item.unitPrice)} cada</p>
                                                {item.notes && <p className="text-[10px] text-primary-400 mt-1 italic font-medium">Obs: {item.notes}</p>}
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.productId)}
                                                className="p-1.5 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-all"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-1 bg-gray-950/50 p-1 rounded-xl">
                                                <button
                                                    onClick={() => updateCartItem(item.productId, item.quantity - 1)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 transition-colors"
                                                >
                                                    <Minus size={14} />
                                                </button>
                                                <span className="w-8 text-center text-sm font-bold text-white">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateCartItem(item.productId, item.quantity + 1)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-white/10 text-gray-400 transition-colors"
                                                >
                                                    <Plus size={14} />
                                                </button>
                                            </div>
                                            <span className="text-sm font-bold text-white">
                                                {formatCurrency(item.unitPrice * item.quantity)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Totals & Pay Button */}
                    <div className="p-6 bg-gray-900 border-t border-white/10 space-y-6">
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                                <span>Subtotal</span>
                                <span>{formatCurrency(subtotal)}</span>
                            </div>
                            {orderType === 'DELIVERY' && (
                                <div className="flex justify-between text-xs font-bold text-gray-500 uppercase tracking-wider">
                                    <span>Taxa de Entrega</span>
                                    <span>{formatCurrency(deliveryFee)}</span>
                                </div>
                            )}
                            <div className="flex justify-between items-end pt-4 border-t border-white/5">
                                <span className="text-sm font-bold text-white uppercase tracking-widest">Total Geral</span>
                                <span className="text-2xl font-black text-primary-500">{formatCurrency(total)}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowPaymentModal(true)}
                            disabled={cart.length === 0}
                            className={cn(
                                'w-full py-5 rounded-2xl font-black text-lg tracking-widest transition-all duration-300 flex items-center justify-center gap-3',
                                cart.length > 0
                                    ? 'bg-primary-500 text-white hover:bg-primary-600 shadow-xl shadow-primary-500/20 active:scale-95'
                                    : 'bg-gray-800 text-gray-600 cursor-not-allowed'
                            )}
                        >
                            <CreditCard className="w-6 h-6" />
                            FECHAR PEDIDO
                        </button>
                        <p className="text-[10px] text-center text-gray-600 font-bold uppercase tracking-widest">Atalho: Ctrl + P para pagar</p>
                    </div>
                </div>
            </div>

            {/* Modals */}
            {showPaymentModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-in fade-in duration-300">
                    <PaymentModal
                        total={total}
                        onClose={() => setShowPaymentModal(false)}
                        onConfirm={(payments) => createOrderMutation.mutate(payments)}
                        isLoading={createOrderMutation.isPending}
                    />
                </div>
            )}

            {showModifierModal && selectedItemForModifiers && (
                <ModifierSelectionModal
                    item={selectedItemForModifiers}
                    onClose={() => {
                        setShowModifierModal(false);
                        setSelectedItemForModifiers(null);
                    }}
                    onConfirm={(item, options) => {
                        const totalPrice = item.price + options.reduce((acc, opt) => acc + opt.price, 0);
                        const optNotes = options.map(o => o.name).join(', ');

                        setCart([...cart, {
                            productId: item.id,
                            productName: item.name,
                            quantity: 1,
                            unitPrice: totalPrice,
                            options: options,
                            notes: optNotes
                        }]);

                        setShowModifierModal(false);
                        setSelectedItemForModifiers(null);
                    }}
                />
            )}
        </div>
    );
}

interface PaymentModalProps {
    total: number;
    onClose: () => void;
    onConfirm: (payments: Array<{ method: string; amount: number }>) => void;
    isLoading: boolean;
}

function PaymentModal({ total, onClose, onConfirm, isLoading }: PaymentModalProps) {
    const [payments, setPayments] = useState<Array<{ method: string; amount: number }>>([
        { method: 'DINHEIRO', amount: total },
    ]);

    const methods = [
        { value: 'DINHEIRO', label: 'Dinheiro', icon: '💵' },
        { value: 'CARTAO_CREDITO', label: 'Crédito', icon: '💳' },
        { value: 'CARTAO_DEBITO', label: 'Débito', icon: '🏧' },
        { value: 'PIX', label: 'PIX', icon: '📱' },
        { value: 'VALE_REFEICAO', label: 'VR Case', icon: '🎫' },
    ];

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = total - totalPaid;

    const updatePayment = (index: number, field: 'method' | 'amount', value: string | number) => {
        setPayments(payments.map((p, i) =>
            i === index ? { ...p, [field]: value } : p
        ));
    };

    const addPayment = () => {
        if (remaining > 0.01) {
            setPayments([...payments, { method: 'PIX', amount: remaining }]);
        }
    };

    const removePayment = (index: number) => {
        if (payments.length > 1) {
            setPayments(payments.filter((_, i) => i !== index));
        }
    };

    return (
        <div className="bg-gray-900 border border-white/10 rounded-3xl w-full max-w-lg p-8 shadow-2xl overflow-hidden relative group">
            <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h2 className="text-2xl font-black text-white leading-tight">Pagamento</h2>
                        <p className="text-sm text-gray-500 uppercase tracking-widest mt-1">Selecione os métodos</p>
                    </div>
                    <button onClick={onClose} className="p-3 hover:bg-white/5 rounded-2xl transition-all text-gray-500 hover:text-white">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <div className="mb-8 p-6 bg-white/5 rounded-3xl border border-white/5 flex flex-col items-center">
                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Total a Pagar</p>
                    <div className="text-5xl font-black text-primary-500">{formatCurrency(total)}</div>
                </div>

                <div className="space-y-3 mb-8">
                    {payments.map((payment, index) => (
                        <div key={index} className="flex gap-2 animate-in slide-in-from-right-2 duration-300" style={{ animationDelay: `${index * 100}ms` }}>
                            <div className="flex-1 relative group">
                                <select
                                    value={payment.method}
                                    onChange={(e) => updatePayment(index, 'method', e.target.value)}
                                    className="input py-3.5 bg-white/5 border-white/5 text-sm font-bold uppercase tracking-wider appearance-none cursor-pointer hover:bg-white/10 transition-all rounded-2xl pl-4"
                                >
                                    {methods.map(m => (
                                        <option key={m.value} value={m.value}>{m.icon} &nbsp; {m.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="w-40 relative group">
                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-primary-500 font-bold">R$</span>
                                <input
                                    type="number"
                                    value={payment.amount}
                                    onChange={(e) => updatePayment(index, 'amount', parseFloat(e.target.value) || 0)}
                                    className="input pl-10 py-3.5 bg-white/5 border-white/5 text-lg font-black text-white text-right rounded-2xl"
                                    step="0.01"
                                />
                            </div>
                            {payments.length > 1 && (
                                <button
                                    onClick={() => removePayment(index)}
                                    className="p-3 text-red-400 hover:bg-red-500/10 rounded-2xl transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                <div className="space-y-6">
                    {remaining > 0.01 && (
                        <button
                            onClick={addPayment}
                            className="w-full py-4 border-2 border-dashed border-white/5 rounded-2xl text-xs font-bold uppercase tracking-widest text-gray-500 hover:border-primary-500/30 hover:text-primary-400 transition-all bg-white/2 hover:bg-primary-500/5"
                        >
                            + Dividir Pagamento
                        </button>
                    )}

                    <div className="flex flex-col items-center">
                        {remaining > 0.01 ? (
                            <div className="px-6 py-2 bg-yellow-500/10 border border-yellow-500/20 rounded-full text-xs font-bold text-yellow-500 uppercase tracking-widest animate-pulse">
                                Faltam {formatCurrency(remaining)}
                            </div>
                        ) : remaining < -0.01 ? (
                            <div className="px-6 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-xs font-bold text-green-400 uppercase tracking-widest">
                                Troco: {formatCurrency(Math.abs(remaining))}
                            </div>
                        ) : (
                            <div className="px-6 py-2 bg-green-500/10 border border-green-500/20 rounded-full text-xs font-bold text-green-400 uppercase tracking-widest">
                                Valor Exato
                            </div>
                        )}
                    </div>

                    <button
                        onClick={() => onConfirm(payments)}
                        disabled={isLoading || remaining > 0.01}
                        className={cn(
                            'w-full py-5 rounded-3xl font-black text-xl tracking-[0.2em] transition-all duration-300 shadow-2xl transform active:scale-[0.98]',
                            isLoading || remaining > 0.01
                                ? 'bg-gray-800 text-gray-600 cursor-not-allowed grayscale'
                                : 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-primary-500/20'
                        )}
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-3">
                                <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                PROCESSANDO...
                            </div>
                        ) : 'EFETUAR PAGAMENTO'}
                    </button>
                </div>
            </div>

            {/* Background design element */}
            <div className="absolute -top-20 -left-20 w-60 h-60 bg-primary-500/10 rounded-full blur-[100px] pointer-events-none" />
            <div className="absolute -bottom-20 -right-20 w-60 h-60 bg-primary-500/10 rounded-full blur-[100px] pointer-events-none" />
        </div>
    );
}

