import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ArrowLeft, Check, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function InventoryCategoryCount() {
    const { id, categoryId } = useParams<{ id: string; categoryId: string }>();
    const queryClient = useQueryClient();

    // Local state to manage inputs before saving? Or save on blur/enter?
    // Saving on blur is better for UX.
    const [localCounts, setLocalCounts] = useState<Record<string, string>>({});

    const { data: response, isLoading } = useQuery({
        queryKey: ['inventory-items', id, categoryId],
        queryFn: () => api.get(`/api/inventory/${id}?categoryId=${categoryId === 'uncategorized' ? '' : categoryId}`).then(r => r.data.data),
    });

    const items = response?.items || [];
    const categoryName = items?.[0]?.product?.category?.name || items?.[0]?.categoryName || 'Sem Categoria';

    const updateMutation = useMutation({
        mutationFn: (data: { itemId: string; quantity: number }) =>
            api.post(`/api/inventory/${id}/count`, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-items', id] });
            toast.success('Salvo', { duration: 1000, position: 'bottom-center' });
        }
    });

    const handleBlur = (itemId: string, value: string) => {
        if (value === '') return;
        const num = parseFloat(value);
        if (isNaN(num)) return; // Validation

        updateMutation.mutate({ itemId, quantity: num });
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            (e.target as HTMLInputElement).blur(); // Trigger blur
            // Move to next input? 
            // Implementation of focusing next input is complex without refs list, simple blur is fine.
        }
    };

    if (isLoading) return <div className="p-8 text-center text-gray-400">Carregando...</div>;

    return (
        <div className="space-y-6 animate-fade-in max-w-4xl mx-auto">
            <div className="flex items-center gap-4">
                <Link to={`/stock/inventory/${id}`} className="btn-ghost">
                    <ArrowLeft className="w-5 h-5" />
                </Link>
                <div>
                    <h1 className="text-4xl font-black text-white flex items-center gap-3">
                        {categoryName}
                        {items?.every((i: any) => i.countedQuantity !== null) && (
                            <CheckCircle className="w-8 h-8 text-green-500" />
                        )}
                    </h1>
                    <p className="text-gray-400 text-lg">Digite a quantidade real encontrada no estoque</p>
                </div>

                <button
                    onClick={async () => {
                        try {
                            const { data } = await api.post(`/api/inventory/${id}/share`);
                            const token = data.data.token;
                            // Construct public URL
                            const url = `${window.location.origin}/inventory/share/${token}/${categoryId}`;
                            const message = `Olá, preciso que faça a contagem da categoria *${categoryName}*. Acesse o link: ${url}`;

                            // Open WhatsApp
                            window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                        } catch (err) {
                            toast.error('Erro ao gerar link de compartilhamento');
                        }
                    }}
                    className="btn-secondary ml-auto"
                >
                    Delegar Contagem
                </button>
            </div>

            <div className="glass-card">
                <div className="space-y-4">
                    {(!items || items.length === 0) ? (
                        <div className="p-8 text-center text-gray-500">Nenhum item nesta categoria.</div>
                    ) : items.map((item: any) => {
                        const isCounted = item.countedQuantity !== null;
                        const inputValue = localCounts[item.id] !== undefined
                            ? localCounts[item.id]
                            : (item.countedQuantity?.toString() || '');

                        return (
                            <div key={item.id} className="flex items-center justify-between p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded-lg">
                                <div className="flex-1">
                                    <p className="font-semibold text-white text-lg">{item.productName}</p>
                                    <div className="flex items-center gap-2 mt-1">
                                        <span className="px-2 py-0.5 rounded bg-white/10 text-xs text-gray-300">
                                            {item.unit}
                                        </span>
                                        {isCounted && (
                                            <span className="text-green-400 text-sm flex items-center gap-1">
                                                <Check className="w-3 h-3" /> Contado
                                            </span>
                                        )}
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <div className="text-right hidden sm:block">
                                        <p className="text-xs text-gray-500">Qtd. Estoque</p>
                                        <div className="w-20 h-8 bg-gray-800 rounded animate-pulse opacity-20"></div>
                                    </div>

                                    <div className={`flex flex-col items-end`}>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                step="any"
                                                className={`input w-32 text-center text-lg font-bold ${isCounted ? 'border-green-500/50 text-green-400' : ''}`}
                                                placeholder="0"
                                                value={inputValue}
                                                onChange={(e) => setLocalCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                                onBlur={(e) => handleBlur(item.id, e.target.value)}
                                                onKeyDown={(e) => handleKeyDown(e)}
                                                autoFocus={false}
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            <div className="flex justify-end p-4">
                <Link to={`/stock/inventory/${id}`} className="btn-primary px-8">
                    Concluir Categoria
                </Link>
            </div>
        </div >
    );
}
