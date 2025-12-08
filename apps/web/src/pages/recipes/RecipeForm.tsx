import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../../lib/api';
import { ArrowLeft, Loader2 } from 'lucide-react';

export default function RecipeForm() {
    const { id } = useParams();
    const navigate = useNavigate();
    const isEdit = !!id;

    const { data: recipe, isLoading } = useQuery({
        queryKey: ['recipe', id],
        queryFn: () => api.get(`/api/recipes/${id}`).then((r) => r.data.data),
        enabled: isEdit,
    });

    if (isEdit && isLoading) {
        return <div className="flex items-center justify-center h-64"><Loader2 className="w-8 h-8 animate-spin text-primary-500" /></div>;
    }

    return (
        <div className="max-w-3xl mx-auto space-y-6 animate-fade-in">
            <div className="flex items-center gap-4">
                <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/10 rounded-lg">
                    <ArrowLeft className="w-5 h-5 text-gray-400" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold text-white">{isEdit ? 'Editar Receita' : 'Nova Receita'}</h1>
                    <p className="text-gray-400">Configure os ingredientes e custos</p>
                </div>
            </div>

            <div className="glass-card">
                <p className="text-gray-400 text-center py-8">
                    Formulário de receita em construção.
                    <br />
                    Esta página permitirá adicionar ingredientes, calcular custos e definir preços sugeridos.
                </p>
            </div>
        </div>
    );
}
