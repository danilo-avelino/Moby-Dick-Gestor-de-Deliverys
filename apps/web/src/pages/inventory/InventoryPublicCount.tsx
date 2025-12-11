import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { Check } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

export default function InventoryPublicCount() {
    const { token, categoryId } = useParams<{ token: string; categoryId: string }>();
    const [localCounts, setLocalCounts] = useState<Record<string, string>>({});

    const { data, isLoading, error } = useQuery({
        queryKey: ['public-inventory', token, categoryId],
        queryFn: () => api.get(`/api/public/inventory/${token}/items?categoryId=${categoryId}`).then(r => r.data.data),
    });

    const updateMutation = useMutation({
        mutationFn: (data: { itemId: string; quantity: number }) =>
            api.post(`/api/public/inventory/${token}/count`, data),
        onSuccess: () => {
            toast.success('Salvo', { duration: 1000, position: 'bottom-center' });
        },
        onError: () => {
            toast.error('Erro ao salvar');
        }
    });

    const handleBlur = (itemId: string, value: string) => {
        if (value === '') return;
        const num = parseFloat(value);
        if (isNaN(num)) return;

        updateMutation.mutate({ itemId, quantity: num });
    };

    const [isFinished, setIsFinished] = useState(false);

    if (isLoading) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-white">Carregando...</div>;
    if (error) return <div className="min-h-screen bg-gray-900 flex items-center justify-center text-red-400">Link inválido ou expirado</div>;

    if (isFinished) {
        return (
            <div className="min-h-screen bg-gray-900 p-4 flex items-center justify-center">
                <div className="text-center space-y-4 animate-fade-in">
                    <div className="w-20 h-20 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                        <Check className="w-10 h-10 text-green-500" />
                    </div>
                    <h1 className="text-3xl font-bold text-white">Contagem Finalizada!</h1>
                    <p className="text-gray-400 text-lg">Obrigado pela sua colaboração.</p>
                    <p className="text-sm text-gray-600 mt-8">Você pode fechar esta página agora.</p>
                </div>
            </div>
        );
    }

    const { items, session } = data;
    const categoryName = items?.[0]?.product?.category?.name || 'Sem Categoria';

    return (
        <div className="min-h-screen bg-gray-900 p-4">
            <Toaster />
            <div className="max-w-md mx-auto space-y-6">
                <div className="text-center py-6">
                    <h1 className="text-2xl font-bold text-white mb-2">Contagem Compartilhada</h1>
                    <p className="text-purple-400 font-medium">{categoryName}</p>
                    <p className="text-sm text-gray-400 mt-2">Inventário iniciado em {new Date(session.startDate).toLocaleDateString()}</p>
                </div>

                <div className="glass-card">
                    <div className="space-y-4">
                        {items?.map((item: any) => {
                            const isCounted = item.countedQuantity !== null;
                            // Update local state if it's empty but item has value (first load)
                            const inputValue = localCounts[item.id] !== undefined
                                ? localCounts[item.id]
                                : (item.countedQuantity?.toString() || '');

                            return (
                                <div key={item.id} className="p-4 border-b border-white/5 last:border-0 hover:bg-white/5 transition-colors rounded-lg">
                                    <div className="flex items-start justify-between mb-2">
                                        <div>
                                            <p className="font-semibold text-white">{item.productName}</p>
                                            <span className="text-xs text-gray-400">{item.unit}</span>
                                        </div>
                                        {isCounted && <Check className="w-4 h-4 text-green-400" />}
                                    </div>

                                    <input
                                        type="number"
                                        step="any"
                                        className={`input w-full text-lg font-bold ${isCounted ? 'border-green-500/50 text-green-400' : ''}`}
                                        placeholder="Digite a quantidade..."
                                        value={inputValue}
                                        onChange={(e) => setLocalCounts(prev => ({ ...prev, [item.id]: e.target.value }))}
                                        onBlur={(e) => handleBlur(item.id, e.target.value)}
                                    />
                                </div>
                            );
                        })}
                    </div>
                </div>

                <button
                    onClick={() => {
                        window.scrollTo({ top: 0, behavior: 'smooth' });
                        setIsFinished(true);
                    }}
                    className="btn-primary w-full py-4 text-lg shadow-lg shadow-purple-500/20"
                >
                    Concluir Contagem
                </button>

                <div className="text-center text-gray-500 text-sm pb-8">
                    Moby Dick - Gestão Inteligente
                </div>
            </div>
        </div>
    );
}
