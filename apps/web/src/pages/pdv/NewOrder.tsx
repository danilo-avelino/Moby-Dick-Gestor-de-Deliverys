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
    optionGroups: any[]; // Extended later
}

interface CartItem {
    productId: string;
    productName: string;
    productSku?: string;
    quantity: number;
    unitPrice: number;
    notes?: string;
    options?: any[]; // Selected options
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
    const currentCostCenterId = user?.costCenter?.id; // Assuming populated

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

    // Flatten items for search/list, but keep categories structure for filters if needed
    // The API returns [{ ...category, items: [] }]
    const categories = menuData || [];

    // Flatten items logic handled in filteredProducts or separate memo
    const products = useMemo(() => {
        const allItems: MenuItem[] = [];
        categories.forEach((cat: any) => {
            if (cat.items) {
                allItems.push(...cat.items.map((item: any) => ({ ...item, menuCategoryId: cat.id })));
            }
        });
        return allItems;
    }, [categories]);

    // Fetch tables (for SALAO)
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
            // p.sku check removed as MenuItem doesn't have SKU yet (can add if needed)

            const matchesCategory = !selectedCategory || p.menuCategoryId === selectedCategory;
            return matchesSearch && matchesCategory;
        });
    }, [products, productSearch, selectedCategory]);

    // Cart calculations
    const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0);
    const total = subtotal + (orderType === 'DELIVERY' ? deliveryFee : 0);

    // Add to cart
    const addToCart = (product: MenuItem) => {
        // Check for modifiers
        // Check for modifiers
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
                // productSku: product.sku, // removed
                quantity: 1,
                unitPrice: product.price,
            }]);
        }
    };

    // Update cart item
    const updateCartItem = (productId: string, quantity: number) => {
        if (quantity <= 0) {
            setCart(cart.filter(item => item.productId !== productId));
        } else {
            setCart(cart.map(item =>
                item.productId === productId ? { ...item, quantity } : item
            ));
        }
    };

    // Remove from cart
    const removeFromCart = (productId: string) => {
        setCart(cart.filter(item => item.productId !== productId));
    };

    // Create order mutation
    const createOrderMutation = useMutation({
        mutationFn: async (payments: Array<{ method: string; amount: number }>) => {
            // Create order
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
                })),
            });

            const order = orderRes.data.data;

            // Add payments
            for (const payment of payments) {
                await api.post(`/api/pdv/orders/${order.id}/payments`, payment);
            }

            return order;
        },
        onSuccess: () => {
            navigate('/pdv');
        },
    });

    // Keyboard shortcuts
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
        <div className="h-full flex flex-col -m-6">
            {/* Header */}
            <div className="bg-gray-900/80 border-b border-white/10 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => navigate('/pdv')}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                    </button>
                    <h1 className="text-xl font-bold text-white">Novo Pedido</h1>
                </div>

                {/* Order Type Selector */}
                <div className="flex gap-2">
                    {[
                        { type: 'DELIVERY' as OrderType, label: 'Delivery', icon: Truck },
                        { type: 'RETIRADA' as OrderType, label: 'Retirada', icon: Package },
                        { type: 'SALAO' as OrderType, label: 'Salão', icon: Users },
                    ].map(({ type, label, icon: Icon }) => (
                        <button
                            key={type}
                            onClick={() => setOrderType(type)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors',
                                orderType === type
                                    ? 'bg-primary-500 text-white'
                                    : 'bg-white/5 text-gray-400 hover:bg-white/10'
                            )}
                        >
                            <Icon className="w-4 h-4" />
                            {label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 flex overflow-hidden">
                {/* Left: Categories */}
                <div className="w-48 bg-gray-900/50 border-r border-white/10 overflow-y-auto p-2">
                    <button
                        onClick={() => setSelectedCategory('')}
                        className={cn(
                            'w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors',
                            !selectedCategory ? 'bg-primary-500/20 text-primary-400' : 'text-gray-400 hover:bg-white/5'
                        )}
                    >
                        Todos
                    </button>
                    {categories.map((cat: any) => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className={cn(
                                'w-full text-left px-3 py-2 rounded-lg mb-1 transition-colors',
                                selectedCategory === cat.id ? 'bg-primary-500/20 text-primary-400' : 'text-gray-400 hover:bg-white/5'
                            )}
                        >
                            {cat.name}
                        </button>
                    ))}
                </div>

                {/* Center: Products Grid */}
                <div className="flex-1 overflow-y-auto p-4">
                    {/* Search */}
                    <div className="relative mb-4">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                        <input
                            id="product-search"
                            type="text"
                            placeholder="Encontre produtos por nome ou código (Ctrl + B)"
                            value={productSearch}
                            onChange={(e) => setProductSearch(e.target.value)}
                            className="input pl-10 w-full"
                        />
                    </div>

                    {/* Products Grid */}
                    <div className="grid grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-3">
                        {filteredProducts.map((product) => (
                            <button
                                key={product.id}
                                onClick={() => addToCart(product)}
                                className="card p-3 text-left hover:border-primary-500/50 transition-colors"
                            >
                                <div className="aspect-square bg-gray-800 rounded-lg mb-2 flex items-center justify-center">
                                    {product.imageUrl ? (
                                        <img src={product.imageUrl} alt={product.name} className="w-full h-full object-cover rounded-lg" />
                                    ) : (
                                        <Package className="w-8 h-8 text-gray-600" />
                                    )}
                                </div>
                                <h3 className="text-sm font-medium text-white truncate">{product.name}</h3>
                                <p className="text-xs text-primary-400">
                                    {formatCurrency(product.price)}
                                </p>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right: Cart */}
                <div className="w-96 bg-gray-900/50 border-l border-white/10 flex flex-col">
                    {/* Customer Info */}
                    <div className="p-4 border-b border-white/10">
                        <div className="flex items-center gap-2 mb-3">
                            <User className="w-4 h-4 text-gray-400" />
                            <span className="text-sm font-medium text-gray-400">Cliente</span>
                        </div>
                        <input
                            type="text"
                            placeholder="Nome do cliente"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="input w-full mb-2"
                        />
                        <input
                            type="text"
                            placeholder="Telefone"
                            value={customerPhone}
                            onChange={(e) => setCustomerPhone(e.target.value)}
                            className="input w-full"
                        />

                        {/* Delivery Address */}
                        {orderType === 'DELIVERY' && (
                            <div className="mt-3">
                                <div className="flex items-center gap-2 mb-2">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                    <span className="text-sm font-medium text-gray-400">Endereço</span>
                                </div>
                                <textarea
                                    placeholder="Endereço de entrega..."
                                    className="input w-full h-20 resize-none"
                                />
                                <div className="mt-2">
                                    <label className="text-xs text-gray-400">Taxa de Entrega</label>
                                    <input
                                        type="number"
                                        value={deliveryFee}
                                        onChange={(e) => setDeliveryFee(parseFloat(e.target.value) || 0)}
                                        className="input w-full mt-1"
                                        step="0.01"
                                    />
                                </div>
                            </div>
                        )}

                        {/* Table Selection */}
                        {orderType === 'SALAO' && (
                            <div className="mt-3">
                                <label className="text-sm font-medium text-gray-400">Mesa</label>
                                <select
                                    value={selectedTableId}
                                    onChange={(e) => setSelectedTableId(e.target.value)}
                                    className="input w-full mt-1"
                                >
                                    <option value="">Selecione uma mesa</option>
                                    {tables.map(table => (
                                        <option key={table.id} value={table.id}>
                                            {table.identifier}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    {/* Cart Items */}
                    <div className="flex-1 overflow-y-auto p-4">
                        {cart.length === 0 ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                <ShoppingCart className="w-12 h-12 mb-2 opacity-50" />
                                <p className="text-sm">Carrinho vazio</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {cart.map((item) => (
                                    <div key={item.productId} className="bg-gray-800/50 rounded-lg p-3">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <h4 className="text-sm font-medium text-white">{item.productName}</h4>
                                                <p className="text-xs text-gray-400">{formatCurrency(item.unitPrice)}</p>
                                            </div>
                                            <button
                                                onClick={() => removeFromCart(item.productId)}
                                                className="p-1 text-gray-500 hover:text-red-400"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => updateCartItem(item.productId, item.quantity - 1)}
                                                    className="w-7 h-7 rounded bg-white/10 flex items-center justify-center hover:bg-white/20"
                                                >
                                                    <Minus className="w-3 h-3" />
                                                </button>
                                                <span className="w-8 text-center text-white">{item.quantity}</span>
                                                <button
                                                    onClick={() => updateCartItem(item.productId, item.quantity + 1)}
                                                    className="w-7 h-7 rounded bg-white/10 flex items-center justify-center hover:bg-white/20"
                                                >
                                                    <Plus className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <span className="text-white font-medium">
                                                {formatCurrency(item.unitPrice * item.quantity)}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Totals & Pay Button */}
                    <div className="p-4 border-t border-white/10">
                        <div className="space-y-2 mb-4">
                            <div className="flex justify-between text-sm">
                                <span className="text-gray-400">Subtotal</span>
                                <span className="text-white">{formatCurrency(subtotal)}</span>
                            </div>
                            {orderType === 'DELIVERY' && deliveryFee > 0 && (
                                <div className="flex justify-between text-sm">
                                    <span className="text-gray-400">Taxa de Entrega</span>
                                    <span className="text-white">{formatCurrency(deliveryFee)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-lg font-bold pt-2 border-t border-white/10">
                                <span className="text-white">TOTAL</span>
                                <span className="text-primary-400">{formatCurrency(total)}</span>
                            </div>
                        </div>
                        <button
                            onClick={() => setShowPaymentModal(true)}
                            disabled={cart.length === 0}
                            className={cn(
                                'w-full py-3 rounded-lg font-bold text-center transition-colors flex items-center justify-center gap-2',
                                cart.length > 0
                                    ? 'bg-primary-500 text-white hover:bg-primary-600'
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            )}
                        >
                            <CreditCard className="w-5 h-5" />
                            PAGAR (Ctrl + P)
                        </button>
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {showPaymentModal && (
                <PaymentModal
                    total={total}
                    onClose={() => setShowPaymentModal(false)}
                    onConfirm={(payments) => createOrderMutation.mutate(payments)}
                    isLoading={createOrderMutation.isPending}
                />
            )}

            {showModifierModal && selectedItemForModifiers && (
                <ModifierSelectionModal
                    item={selectedItemForModifiers}
                    onClose={() => {
                        setShowModifierModal(false);
                        setSelectedItemForModifiers(null);
                    }}
                    onConfirm={(item, options) => {
                        // Add to cart with options
                        const totalPrice = item.price + options.reduce((acc, opt) => acc + opt.price, 0);

                        setCart([...cart, {
                            productId: item.id,
                            productName: item.name,
                            quantity: 1,
                            unitPrice: totalPrice,
                            options: options,
                            notes: options.map(o => o.name).join(', ') // Simple display of options
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
        { value: 'DINHEIRO', label: 'Dinheiro' },
        { value: 'CARTAO_CREDITO', label: 'Cartão Crédito' },
        { value: 'CARTAO_DEBITO', label: 'Cartão Débito' },
        { value: 'PIX', label: 'PIX' },
        { value: 'VALE_REFEICAO', label: 'Vale Refeição' },
    ];

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remaining = total - totalPaid;

    const updatePayment = (index: number, field: 'method' | 'amount', value: string | number) => {
        setPayments(payments.map((p, i) =>
            i === index ? { ...p, [field]: value } : p
        ));
    };

    const addPayment = () => {
        if (remaining > 0) {
            setPayments([...payments, { method: 'PIX', amount: remaining }]);
        }
    };

    const removePayment = (index: number) => {
        if (payments.length > 1) {
            setPayments(payments.filter((_, i) => i !== index));
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
            <div className="bg-gray-900 rounded-xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Pagamento</h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-lg">
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                <div className="mb-4">
                    <div className="text-sm text-gray-400">Total</div>
                    <div className="text-2xl font-bold text-primary-400">{formatCurrency(total)}</div>
                </div>

                <div className="space-y-3 mb-4">
                    {payments.map((payment, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <select
                                value={payment.method}
                                onChange={(e) => updatePayment(index, 'method', e.target.value)}
                                className="input flex-1"
                            >
                                {methods.map(m => (
                                    <option key={m.value} value={m.value}>{m.label}</option>
                                ))}
                            </select>
                            <input
                                type="number"
                                value={payment.amount}
                                onChange={(e) => updatePayment(index, 'amount', parseFloat(e.target.value) || 0)}
                                className="input w-32"
                                step="0.01"
                            />
                            {payments.length > 1 && (
                                <button
                                    onClick={() => removePayment(index)}
                                    className="p-2 text-red-400 hover:bg-red-500/10 rounded"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    ))}
                </div>

                {remaining > 0.01 && (
                    <button
                        onClick={addPayment}
                        className="w-full py-2 mb-4 border border-dashed border-white/20 rounded-lg text-gray-400 hover:border-primary-500/50 hover:text-primary-400"
                    >
                        + Adicionar forma de pagamento
                    </button>
                )}

                {remaining > 0.01 && (
                    <div className="text-center text-yellow-400 text-sm mb-4">
                        Faltam {formatCurrency(remaining)}
                    </div>
                )}

                <button
                    onClick={() => onConfirm(payments)}
                    disabled={isLoading || remaining > 0.01}
                    className={cn(
                        'w-full py-3 rounded-lg font-bold text-center',
                        isLoading || remaining > 0.01
                            ? 'bg-gray-700 text-gray-500 cursor-not-allowed'
                            : 'bg-primary-500 text-white hover:bg-primary-600'
                    )}
                >
                    {isLoading ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
            </div>
        </div>
    );
}
