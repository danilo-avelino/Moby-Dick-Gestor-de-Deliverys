import { useState } from 'react';
import { X, ChefHat, Scale, Package, Layers, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

interface NewRecipeModalProps {
    onClose: () => void;
    categories: Array<{ id: string; name: string }>;
    preSelectedCategoryId?: string;
}

const RECIPE_TYPES = [
    { id: 'FINAL_PRODUCT', label: 'Produto Final', icon: ChefHat, desc: 'Item de venda direta (Ex: Pizza, Prato, Drink)' },
    { id: 'TRANSFORMED_ITEM', label: 'Item Transformado', icon: Package, desc: 'Base para outras receitas (Ex: Molho, Massa)' },
    { id: 'PORCIONAMENTO', label: 'Porcionamento', icon: Scale, desc: 'Processo de corte/divisão (Ex: Frango Desfiado)' },
    { id: 'COMBO', label: 'Combo', icon: Layers, desc: 'Combinação de produtos (Ex: Pizza + Refri)' },
];

export function NewRecipeModal({ onClose, categories, preSelectedCategoryId }: NewRecipeModalProps) {
    const navigate = useNavigate();
    const [type, setType] = useState('FINAL_PRODUCT');
    const [categoryId, setCategoryId] = useState(preSelectedCategoryId || '');

    function handleContinue() {
        if (!categoryId) {
            return toast.error('Selecione uma categoria');
        }
        navigate(`/recipes/new?type=${type}&recipeCategoryId=${categoryId}`);
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="bg-[#1a1d24] rounded-xl border border-white/10 w-full max-w-2xl p-6 shadow-2xl">
                <div className="flex items-center justify-between mb-6">
                    <div>
                        <h2 className="text-xl font-bold text-white">Nova Ficha Técnica</h2>
                        <p className="text-sm text-gray-400">Escolha o tipo e categoria para começar</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="space-y-6">
                    {/* Categories */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Categoria
                        </label>
                        <select
                            value={categoryId}
                            onChange={(e) => setCategoryId(e.target.value)}
                            className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-primary-500 transition-all appearance-none"
                        >
                            <option value="">Selecione uma categoria...</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Types */}
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-2">
                            Tipo de Ficha
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {RECIPE_TYPES.map((t) => (
                                <button
                                    key={t.id}
                                    onClick={() => setType(t.id)}
                                    className={`relative flex items-start p-4 rounded-xl border transition-all text-left group ${type === t.id
                                            ? 'bg-primary-500/10 border-primary-500/50'
                                            : 'bg-white/5 border-white/5 hover:bg-white/10 hover:border-white/10'
                                        }`}
                                >
                                    <div className={`p-2 rounded-lg mr-3 ${type === t.id ? 'bg-primary-500 text-white' : 'bg-white/10 text-gray-400 group-hover:text-white'}`}>
                                        <t.icon className="w-5 h-5" />
                                    </div>
                                    <div>
                                        <h3 className={`font-medium ${type === t.id ? 'text-primary-400' : 'text-white'}`}>
                                            {t.label}
                                        </h3>
                                        <p className="text-xs text-gray-500 mt-1">{t.desc}</p>
                                    </div>
                                    {type === t.id && (
                                        <div className="absolute top-4 right-4 w-2 h-2 rounded-full bg-primary-500 shadow-[0_0_10px_rgba(var(--primary-500),0.5)]" />
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>

                </div>

                <div className="flex justify-end gap-3 mt-8 pt-6 border-t border-white/5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-sm font-medium text-gray-400 hover:text-white transition-colors"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleContinue}
                        disabled={!categoryId}
                        className="flex items-center gap-2 px-6 py-2 bg-primary-500 hover:bg-primary-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary-500/20"
                    >
                        Continuar <ArrowRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        </div>
    );
}
