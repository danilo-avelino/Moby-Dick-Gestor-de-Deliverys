import { useState } from 'react';
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


    const { data: inventoryData, isLoading } = useQuery({
        queryKey: ['inventory-items', id],
        queryFn: () => api.get(`/api/inventory/${id}`).then(r => r.data.data),
    });

    const items = inventoryData?.items || (Array.isArray(inventoryData) ? inventoryData : []);
    const session = inventoryData?.session;

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

    const cancelMutation = useMutation({
        mutationFn: () => api.post(`/api/inventory/${id}/cancel`),
        onSuccess: () => {
            toast.success('Inventário cancelado com sucesso');
            navigate('/stock/inventory');
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Erro ao cancelar inventário');
        }
    });

    const updateCountMutation = useMutation({
        mutationFn: ({ itemId, quantity }: { itemId: string, quantity: number }) =>
            api.post(`/api/inventory/${id}/count`, { itemId, quantity }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['inventory-items', id] });
        },
        onError: (err: any) => {
            toast.error(err.response?.data?.message || 'Erro ao atualizar contagem');
        }
    });

    if (isLoading) return <div className="p-8 text-center text-gray-400">Carregando...</div>;

    // Group items by category
    const categoriesMap = new Map<string, { name: string; total: number; counted: number; correct: number }>();

    // Add "No Category" bucket
    categoriesMap.set('uncategorized', { name: 'Sem Categoria', total: 0, counted: 0, correct: 0 });

    // Debug Log
    console.log('Inventory Items:', items);

    if (!Array.isArray(items)) {
        return <div className="p-8 text-center text-red-400">Erro: Dados inválidos retornados pela API.</div>;
    }

    (items as InventoryItem[])?.forEach((item: any) => {
        // Safe access with optional chaining
        // Fallback to categoryName (snapshot) if product relation is missing
        let catId = item?.product?.category?.id;
        let catName = item?.product?.category?.name;

        // Fallback Logic
        if (!catId) {
            // If we have a category name in snapshot, use it to group
            if (item.categoryName && item.categoryName !== 'Sem Categoria') {
                catId = `snapshot-${item.categoryName}`; // Create a synthetic ID
                catName = item.categoryName;
            } else {
                catId = 'uncategorized';
                catName = 'Sem Categoria';
            }
        }

        // Debug weird items
        if (catId === 'uncategorized') {
            console.warn('Uncategorized Item:', item);
        }

        if (!categoriesMap.has(catId)) {
            categoriesMap.set(catId, { name: catName || 'Sem Categoria', total: 0, counted: 0, correct: 0 });
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

    const totalProgress = items.length > 0
        ? (items.filter((i: any) => i.countedQuantity !== null).length / items.length) * 100
        : 0;
    const isComplete = totalProgress === 100;

    // Check if session is already finished
    const sessionStatus = items?.[0]?.inventorySession?.status || 'OPEN'; // Assuming we can get status from items or separate query, but activeSession query in Dashboard gets it.
    // Actually, items endpoint uses `InventoryService.getInventoryItems` which returns items.
    // We might need to fetch session details separately or infer. 
    // The previous tool `view_file` of `InventoryActiveSession.tsx` showed `api.get(/api/inventory/${id})`.
    // The backend route `/api/inventory/:id` returns `items`.
    // It does NOT return the session object directly in the root of data.
    // Wait, backend: `return reply.send({ success: true, data: items });`
    // So we don't know the status from `data` here easily unless we check `items[0].inventorySession`.
    // Let's assume we can get it or just render based on `finishMutation` success? No, user might navigate back.

    // We need to fetch session details to know status.
    // Or we can assume if `items` has `inventorySession` relation included?
    // Backend `getInventoryItems` does NOT include `inventorySession`.

    // Additional Query for Session Details (or update Backend to return {session, items})
    // For now, let's use the `active` query logic? No, `active` only returns OPEN.
    // We should probably update the backend to return session info.
    // BUT, I can't update backend easily now (Prisma lock).

    // Workaround: Use a separate query or assume if we are viewing a "History" item it might be completed.
    // Let's fetch history to check status? No, inefficient.
    // Let's try to deduce from items? No.
    // I'll update the frontend to try to fetch session info if possible, or assume if `items[0].inventorySession.status` is present (if I update backend).
    // I can't update backend.

    // Wait, `InventoryActiveSession.tsx` is used for `/stock/inventory/${id}`.
    // If I clicked from History, it is likely completed.

    // Let's add a `useQuery` for session details specifically?
    // The existing `/api/inventory/active` is only for OPEN.
    // The existing `/api/inventory/history` returns lists.

    // I will modify `InventoryDashboard` to PASS the status via state?
    // `<Link to=... state={{ status: inv.status }}>`
    // Start with that.

    // But `useParams` doesn't give state. `useLocation` does.

    // Let's modify `InventoryActiveSession.tsx` to read location state, OR just render a "Results View" if specific props are met.

    // Actually, I'll update the component to support a "Read Only / Result" mode.

    // We need to know if it's completed.

    // Let's assume for this "Blind" implementation that we check if any item has `isCorrect` property that is meaningful?
    // Or just look at the UI requirement: "Visualize Item-level Accuracy".

    // I will implement a "Resultados" tab/view.

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link to="/stock/inventory" className="btn-ghost">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        <h1 className="text-2xl font-bold text-white">
                            Inventário
                        </h1>
                        {/* We need to know status to show "Contagem" or "Resultados" */}
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                    {session?.status === 'OPEN' && (
                        <button
                            onClick={() => {
                                if (window.confirm('Tem certeza que deseja cancelar este inventário? Todo o progresso será perdido.')) {
                                    cancelMutation.mutate();
                                }
                            }}
                            className="btn btn-error btn-outline text-sm"
                            disabled={cancelMutation.isPending}
                        >
                            {cancelMutation.isPending ? 'Cancelando...' : 'Cancelar'}
                        </button>
                    )}

                    {session?.status === 'OPEN' && isComplete && (
                        <button
                            onClick={() => finishMutation.mutate()}
                            className="btn btn-primary text-sm"
                            disabled={finishMutation.isPending}
                        >
                            {finishMutation.isPending ? 'Finalizando...' : 'Finalizar Inventário'}
                        </button>
                    )}
                </div>
            </div>

            {/* Render Category Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {categories.map(cat => (
                    <div
                        key={cat.id}
                        className={`glass-card transition-all hover:bg-white/5 ${cat.progress === 100 ? 'border-l-4 border-l-green-500 bg-green-500/5' : 'border-white/5'} ${session?.status === 'COMPLETED' ? (cat.precision === 100 ? 'border-l-4 border-l-green-500' : cat.precision >= 95 ? 'border-l-4 border-l-green-400' : 'border-l-4 border-l-yellow-500') : ''}`}
                    >
                        <h3 className="font-bold text-white mb-4 h-12 flex items-center justify-between text-xl">
                            <span className="flex items-center gap-2">
                                {cat.name}
                                {cat.progress === 100 && session?.status === 'OPEN' && (
                                    <CheckCircle className="w-5 h-5 text-green-500" />
                                )}
                            </span>
                            <span className="text-xs font-normal text-gray-400">{cat.counted}/{cat.total} itens</span>
                        </h3>

                        {/* Summary View for Open / Counter Mode */}
                        {session?.status === 'OPEN' && (
                            <div className="flex flex-col items-center justify-center mb-4 gap-2">
                                <div className="text-2xl font-bold text-white mb-1">
                                    {Math.round(cat.progress)}%
                                </div>
                                <div className="text-[10px] text-center text-gray-400 uppercase tracking-tighter">
                                    Progresso da Categoria
                                </div>
                                <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden mt-2">
                                    <div
                                        className="h-full bg-blue-500 transition-all duration-500"
                                        style={{ width: `${cat.progress}%` }}
                                    ></div>
                                </div>
                            </div>
                        )}

                        {/* If Completed, show Accuracy Score */}
                        {session?.status === 'COMPLETED' && (
                            <div className="flex flex-col items-center justify-center mb-6 gap-2">
                                <div className="text-3xl font-bold text-white mb-1">
                                    {Math.round(cat.precision)}%
                                </div>
                                <div className="text-xs text-center text-gray-400">
                                    Precisão
                                </div>
                                <div className="w-full bg-gray-700 h-1.5 rounded-full overflow-hidden mt-2">
                                    <div
                                        className={`h-full ${cat.precision >= 95 ? 'bg-green-500' : 'bg-yellow-500'}`}
                                        style={{ width: `${cat.precision}%` }}
                                    ></div>
                                </div>
                                <div className="mt-4 w-full space-y-2 text-sm text-gray-400">
                                    <div className="flex justify-between">
                                        <span>Precisos:</span>
                                        <span className="text-green-400">{cat.correct}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span>Divergentes:</span>
                                        <span className="text-red-400">{cat.counted - cat.correct}</span>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div className="mt-4 text-center">
                            {session?.status === 'OPEN' && (
                                <div className="flex flex-col gap-2">
                                    <Link
                                        to={`/stock/inventory/${id}/count/${cat.id}`}
                                        className={`btn ${cat.progress === 100 ? 'btn-ghost border-green-500/50 text-green-400' : 'btn-primary'} btn-sm w-full`}
                                    >
                                        {cat.progress === 0 ? 'Iniciar categoria' : cat.progress === 100 ? 'Revisar categoria' : 'Continuar categoria'}
                                    </Link>
                                    <button
                                        onClick={async (e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            try {
                                                const { data } = await api.post(`/api/inventory/${id}/share`);
                                                const token = data.data.token;
                                                const url = `${window.location.origin}/inventory/share/${token}/${cat.id}`;
                                                const message = `Olá, preciso que faça a contagem da categoria *${cat.name}*. Acesse o link: ${url}`;
                                                window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank');
                                            } catch (err) {
                                                toast.error('Erro ao gerar link de compartilhamento');
                                            }
                                        }}
                                        className="btn btn-ghost btn-outline btn-xs w-full"
                                    >
                                        Delegar
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>


            {/* Detail Table - Always show if completed */}
            {
                session?.status === 'COMPLETED' && (
                    <div className="mt-4 animate-fade-in">
                        <h3 className="text-lg font-bold text-white mb-4">Detalhamento por Item</h3>
                        <div className="glass-card overflow-hidden">
                            <table className="table w-full">
                                <thead>
                                    <tr className="text-left text-gray-400 border-b border-gray-700">
                                        <th className="p-4">Produto</th>
                                        <th className="p-4">Categoria</th>
                                        <th className="p-4 text-center">Esperado</th>
                                        <th className="p-4 text-center">Contado</th>
                                        <th className="p-4 text-center">Diferença</th>
                                        <th className="p-4 text-right">Status</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {[...(items || [])]
                                        .sort((a, b) => {
                                            // 1. Put incorrect items first
                                            if (a.isCorrect !== b.isCorrect) {
                                                return a.isCorrect ? 1 : -1;
                                            }
                                            // 2. Sort by absolute difference (descending)
                                            const diffA = Math.abs((a.countedQuantity || 0) - (a.expectedQuantity || 0));
                                            const diffB = Math.abs((b.countedQuantity || 0) - (b.expectedQuantity || 0));
                                            return diffB - diffA;
                                        })
                                        .map((item: any) => {
                                            // Super safe logic
                                            const counted = item?.countedQuantity ?? 0;
                                            const expected = item?.expectedQuantity ?? 0;
                                            const diff = (item?.countedQuantity || 0) - expected;
                                            const diffPercent = expected ? (Math.abs(diff) / expected) * 100 : 0;

                                            // Ensure product object exists
                                            const baseUnit = item?.product?.baseUnit || item?.unit || '';
                                            const isKg = baseUnit.toLowerCase() === 'kg';

                                            // Logic duplication for display purposes if backend didn't update yet (but it should have)
                                            const isCorrect = item?.isCorrect;

                                            return (
                                                <tr key={item?.id || Math.random()} className="border-b border-gray-800 hover:bg-white/5">
                                                    <td className="p-4 font-medium text-white">{item?.productName || 'Item sem nome'}</td>
                                                    <td className="p-4 text-gray-400">{item?.categoryName || 'Sem categoria'}</td>
                                                    <td className="p-4 text-center text-gray-400">{expected} {baseUnit}</td>
                                                    <td className="p-4 text-center text-white">{item?.countedQuantity ?? '-'}</td>
                                                    <td className="p-4 text-center">
                                                        {item?.countedQuantity !== null && item?.countedQuantity !== undefined ? (
                                                            <span className={diff === 0 ? 'text-gray-500' : diff > 0 ? 'text-green-400' : 'text-red-400'}>
                                                                {diff > 0 ? '+' : ''}{diff.toFixed(3)}
                                                            </span>
                                                        ) : '-'}
                                                    </td>
                                                    <td className="p-4 text-right">
                                                        {item?.countedQuantity !== null && item?.countedQuantity !== undefined ? (
                                                            <div className="flex justify-end items-center gap-2">
                                                                {isCorrect ? (
                                                                    <span className="badge badge-success">Preciso</span>
                                                                ) : (
                                                                    <span className="badge badge-error">Divergente</span>
                                                                )}
                                                                {isKg && isCorrect && Math.abs(diff) > 0 && (
                                                                    <span className="text-xs text-yellow-400 border border-yellow-400/30 px-1 rounded" title="Dentro da tolerância de 5%">
                                                                        Tol.
                                                                    </span>
                                                                )}
                                                            </div>
                                                        ) : <span className="text-gray-600">Pendente</span>}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )
            }
        </div >
    );
}
