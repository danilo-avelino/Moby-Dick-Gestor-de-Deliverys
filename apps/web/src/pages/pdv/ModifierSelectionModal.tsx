
import React, { useState } from 'react';
import { X, Check } from 'lucide-react';
import { cn } from '../../lib/utils';

interface Option {
    id: string;
    name: string;
    price: number;
}
interface OptionGroup {
    id: string;
    name: string;
    selectionType: 'SINGLE' | 'MULTIPLE';
    isRequired: boolean;
    minOptions: number;
    maxOptions: number;
    options: Option[];
}
interface MenuItem {
    id: string;
    name: string;
    price: number;
    optionGroups: OptionGroup[];
}

interface Props {
    item: MenuItem;
    onClose: () => void;
    onConfirm: (item: MenuItem, selectedOptions: any[]) => void;
}

export default function ModifierSelectionModal({ item, onClose, onConfirm }: Props) {
    const [selections, setSelections] = useState<Record<string, string[]>>({}); // optionGroupId -> [optionId]

    const toggleOption = (groupId: string, optionId: string, group: OptionGroup) => {
        const currentSelected = selections[groupId] || [];
        const isSelected = currentSelected.includes(optionId);

        if (group.selectionType === 'SINGLE') {
            setSelections(prev => ({ ...prev, [groupId]: [optionId] }));
        } else {
            if (isSelected) {
                setSelections(prev => ({ ...prev, [groupId]: currentSelected.filter(id => id !== optionId) }));
            } else {
                if (currentSelected.length < group.maxOptions) {
                    setSelections(prev => ({ ...prev, [groupId]: [...currentSelected, optionId] }));
                }
            }
        }
    };

    const isGroupValid = (group: OptionGroup) => {
        const count = (selections[group.id] || []).length;
        if (group.isRequired && count < group.minOptions) return false;
        return true;
    };

    const isValid = (item.optionGroups || []).every(isGroupValid);

    const calculateTotal = () => {
        let total = item.price;
        (item.optionGroups || []).forEach(group => {
            const selectedIds = selections[group.id] || [];
            selectedIds.forEach(id => {
                const opt = group.options.find(o => o.id === id);
                if (opt) total += opt.price;
            });
        });
        return total;
    };

    const handleConfirm = () => {
        const flattenedOptions: any[] = [];
        (item.optionGroups || []).forEach(group => {
            const selectedIds = selections[group.id] || [];
            selectedIds.forEach(id => {
                const opt = group.options.find(o => o.id === id);
                if (opt) flattenedOptions.push({ ...opt, groupName: group.name });
            });
        });
        onConfirm(item, flattenedOptions);
    };

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-gray-900 border border-white/10 rounded-2xl shadow-2xl w-full max-w-md flex flex-col max-h-[85vh] overflow-hidden animate-in fade-in zoom-in duration-200">
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-gray-900/50">
                    <div>
                        <h3 className="font-bold text-xl text-white">{item.name}</h3>
                        <p className="text-sm text-gray-500">Escolha as opções abaixo</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/5 rounded-full text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    {(item.optionGroups || []).map(group => (
                        <div key={group.id} className="space-y-4">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h4 className="font-bold text-white text-lg">{group.name}</h4>
                                    <p className="text-xs text-gray-500">
                                        {group.selectionType === 'SINGLE' ? 'Selecione uma opção' : `Selecione até ${group.maxOptions} opções`}
                                    </p>
                                </div>
                                <span className={cn(
                                    "px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                                    group.isRequired ? "bg-primary-500/10 text-primary-400" : "bg-gray-800 text-gray-500"
                                )}>
                                    {group.isRequired ? 'Obrigatório' : 'Opcional'}
                                </span>
                            </div>

                            <div className="grid gap-2">
                                {group.options.map(option => {
                                    const selected = (selections[group.id] || []).includes(option.id);
                                    return (
                                        <div
                                            key={option.id}
                                            onClick={() => toggleOption(group.id, option.id, group)}
                                            className={cn(
                                                "flex justify-between items-center p-4 rounded-xl border-2 cursor-pointer transition-all duration-200",
                                                selected
                                                    ? "border-primary-500 bg-primary-500/5 ring-1 ring-primary-500"
                                                    : "border-white/5 bg-white/5 hover:border-white/10 hover:bg-white/10"
                                            )}
                                        >
                                            <div className="flex items-center gap-4">
                                                <div className={cn(
                                                    "w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors",
                                                    selected ? "border-primary-500 bg-primary-500" : "border-gray-600"
                                                )}>
                                                    {selected && <Check size={14} className="text-white stroke-[3]" />}
                                                </div>
                                                <span className={cn("font-semibold", selected ? "text-white" : "text-gray-300")}>
                                                    {option.name}
                                                </span>
                                            </div>
                                            {option.price > 0 && (
                                                <span className={cn("text-sm font-bold", selected ? "text-primary-400" : "text-gray-500")}>
                                                    + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(option.price)}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {!isGroupValid(group) && (
                                <p className="text-xs text-red-400 font-medium">Selecione pelo menos {group.minOptions} opção(ões).</p>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-white/10 bg-gray-900/80 backdrop-blur-md">
                    <button
                        onClick={handleConfirm}
                        disabled={!isValid}
                        className={cn(
                            "w-full py-4 rounded-xl font-bold text-lg transition-all flex justify-between px-6 shadow-xl",
                            isValid
                                ? "bg-primary-500 text-white hover:bg-primary-600 shadow-primary-500/20"
                                : "bg-gray-800 text-gray-500 cursor-not-allowed opacity-50"
                        )}
                    >
                        <span>Adicionar ao Pedido</span>
                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}</span>
                    </button>
                    {!isValid && (
                        <p className="text-center text-xs text-gray-500 mt-3 italic">Finalize as seleções obrigatórias para continuar</p>
                    )}
                </div>
            </div>
        </div>
    );
}
