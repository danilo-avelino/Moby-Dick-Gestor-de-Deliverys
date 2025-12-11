import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { ArrowLeft, CheckCircle, Circle, Play } from 'lucide-react';
import toast from 'react-hot-toast';

interface InventoryItem {
    id: string;
    product: {
        category: {
            id: string;
            name: string;
        } | null;
    };
    countedQuantity: number | null;
}

export default function InventoryActiveSession() {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const queryClient = useQueryClient();

    const { data: items, isLoading } = useQuery({
        queryKey: ['inventory-items', id],
        queryFn: () => api.get(`/api/inventory/${id}`).then(r => r.data.data),
    });

    const finishMutation = useMutation({
        mutationFn: () => api.post(`/api/inventory/${id}/finish`),
        onSuccess: (res) => {
            toast.success(`Inventário finalizado! Precisão: ${Math.round(res.data.data.precision)}%`);
            navigate('/stock/inventory');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Erro ao finalizar inventário');
        }
    });

    if (isLoading) return <div className="p-8 text-center text-gray-400">Carregando...</div>;

    // Group items by category
    const categoriesMap = new Map<string, { name: string; total: number; counted: number; correct: number }>();

    // Add "No Category" bucket
    categoriesMap.set('uncategorized', { name: 'Sem Categoria', total: 0, counted: 0, correct: 0 });

    (items as InventoryItem[])?.forEach((item: any) => {
        const catId = item.product.category?.id || 'uncategorized';
        const catName = item.product.category?.name || 'Sem Categoria';

        if (!categoriesMap.has(catId)) {
            categoriesMap.set(catId, { name: catName, total: 0, counted: 0, correct: 0 });
        }

        const cat = categoriesMap.get(catId)!;
        cat.total++;
        if (item.countedQuantity !== null) {
            cat.counted++;
            // isCorrect should be returned by API logic which sets it on update
            // Or we calculate it here: abs(counted - expected) < tolerance
            if (item.isCorrect) { // Assuming API returns isCorrect
                cat.correct++;
            }
        }
    });

    // Clean up empty buckets if necessary, though "uncategorized" might be empty
    if (categoriesMap.get('uncategorized')?.total === 0) {
        categoriesMap.delete('uncategorized');
    }

    const categories = Array.from(categoriesMap.entries()).map(([id, data]) => ({
        id,
        ...data,
        progress: data.total > 0 ? (data.counted / data.total) * 100 : 0,
        precision: data.counted > 0 ? (data.correct / data.counted) * 100 : 0
    }));

    const totalProgress = (items.filter((i: any) => i.countedQuantity !== null).length / items.length) * 100;
    const isComplete = totalProgress === 100;

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/stock/inventory" className="btn-ghost">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">Contagem em Andamento</h1>
                        <p className="text-gray-400">Progresso Geral: {Math.round(totalProgress)}%</p>
                    </div>
                </div>
                {isComplete && (
                    <button
                        onClick={() => {
                            if (window.confirm('Tem certeza? Isso irá atualizar o estoque oficial com os valores contados.')) {
                                finishMutation.mutate();
                            }
                        }}
                        className="btn-success"
                        disabled={finishMutation.isPending}
                    >
                        {finishMutation.isPending ? 'Finalizando...' : 'Finalizar Inventário'}
                    </button>
                )}
            </div>

            <p className="text-gray-400">Acompanhe o progresso da contagem de cada Grupo de Insumos.</p>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories.map(cat => (
                    <div
                        key={cat.id}
                        className={`glass-card border-l-4 transition-all hover:bg-white/5 ${cat.progress === 100 ? 'border-l-green-500' : 'border-l-white/10'}`}
                    >
                        <h3 className="font-semibold text-white mb-4 h-12 flex items-center">{cat.name}</h3>

                        <div className="flex justify-center mb-6">
                            {/* Circular Progress Placeholder - utilizing simple CSS or svg */}
                            <div className="relative w-24 h-24 flex items-center justify-center">
                                <svg className="w-full h-full transform -rotate-90">
                                    <circle
                                        cx="48"
                                        cy="48"
                                        r="40"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        className="text-gray-700"
                                    />
                                    <circle
                                        cx="48"
                                        cy="48"
                                        r="40"
                                        stroke="currentColor"
                                        strokeWidth="8"
                                        fill="transparent"
                                        strokeDasharray={251.2}
                                        strokeDashoffset={251.2 - (251.2 * cat.progress) / 100}
                                        className={`${cat.progress === 100 ? 'text-green-500' : 'text-primary-500'} transition-all duration-1000 ease-out`}
                                    />
                                </svg>
                                <span className={`absolute text-xl font-bold ${cat.progress === 100 ? 'text-green-500' : 'text-white'}`}>
                                    {Math.round(cat.progress)}%
                                </span>
                            </div>
                        </div>

                        <Link
                            to={`/stock/inventory/${id}/count/${cat.id}`}
                            className={`w-full flex items-center justify-center gap-2 py-2 rounded-lg font-medium transition-colors ${cat.progress === 100
                                    ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
                                    : 'bg-primary-500/20 text-primary-400 hover:bg-primary-500/30'
                                }`}
                        >
                            {cat.progress === 100 ? (
                                <>
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Concluído (Precisão: {Math.round(cat.precision)}%)</span>
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" /> Iniciar
                                </>
                            )}
                        </Link>
                    </div>
                ))}
            </div>
        </div>
    );
}
