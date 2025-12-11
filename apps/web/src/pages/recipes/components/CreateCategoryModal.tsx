import { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { api } from '../../../lib/api';
import toast from 'react-hot-toast';

interface CreateCategoryModalProps {
    onClose: () => void;
    onSuccess: () => void;
}

export function CreateCategoryModal({ onClose, onSuccess }: CreateCategoryModalProps) {
    const [name, setName] = useState('');
    const [loading, setLoading] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        if (!name.trim()) return;

        setLoading(true);
        try {
            await api.post('/api/recipe-categories', { name });
            toast.success('Categoria criada com sucesso!');
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error(error);
            toast.error(error.response?.data?.message || 'Erro ao criar categoria');
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-sm p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">Nova Categoria</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                            Nome da Categoria
                        </label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all placeholder:text-gray-600"
                            placeholder="Ex: Pizzas, Bebidas, Molhos..."
                            autoFocus
                            required
                        />
                    </div>

                    <div className="flex justify-end gap-3 pt-2">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors hover:bg-white/5 rounded-lg"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={loading || !name.trim()}
                            className="flex items-center gap-2 px-4 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? <Loader2 className="animate-spin w-4 h-4" /> : 'Criar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
