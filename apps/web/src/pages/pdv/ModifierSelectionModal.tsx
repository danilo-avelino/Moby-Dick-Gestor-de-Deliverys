import React, { useState, useEffect } from 'react';
import { X, Plus, Minus } from 'lucide-react';

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

    // Initialize required groups with defaults if single selection?
    // For now, start empty.

    const toggleOption = (groupId: string, optionId: string, group: OptionGroup) => {
        const currentSelected = selections[groupId] || [];
        const isSelected = currentSelected.includes(optionId);

        if (group.selectionType === 'SINGLE') {
            // Replace selection
            setSelections(prev => ({ ...prev, [groupId]: [optionId] }));
        } else {
            // Toggle
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

    const isValid = item.optionGroups.every(isGroupValid);

    const calculateTotal = () => {
        let total = item.price;
        item.optionGroups.forEach(group => {
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
        item.optionGroups.forEach(group => {
            const selectedIds = selections[group.id] || [];
            selectedIds.forEach(id => {
                const opt = group.options.find(o => o.id === id);
                if (opt) flattenedOptions.push({ ...opt, groupName: group.name });
            });
        });
        onConfirm(item, flattenedOptions);
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md flex flex-col max-h-[80vh]">
                <div className="p-4 border-b flex justify-between items-center">
                    <h3 className="font-bold text-lg">{item.name}</h3>
                    <button onClick={onClose}><X size={20} /></button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {item.optionGroups.map(group => (
                        <div key={group.id}>
                            <div className="flex justify-between items-center mb-2">
                                <h4 className="font-semibold text-gray-800">{group.name}</h4>
                                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                                    {group.isRequired ? 'Obrigatório' : 'Opcional'}
                                    {group.selectionType === 'MULTIPLE' && ` (Max: ${group.maxOptions})`}
                                </span>
                            </div>

                            <div className="space-y-2">
                                {group.options.map(option => {
                                    const selected = (selections[group.id] || []).includes(option.id);
                                    return (
                                        <div
                                            key={option.id}
                                            onClick={() => toggleOption(group.id, option.id, group)}
                                            className={`
                                                flex justify-between items-center p-3 rounded border cursor-pointer transition-colors
                                                ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}
                                            `}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`
                                                    w-4 h-4 rounded-full border flex items-center justify-center
                                                    ${selected ? 'border-blue-600' : 'border-gray-400'}
                                                `}>
                                                    {selected && <div className="w-2 h-2 rounded-full bg-blue-600" />}
                                                </div>
                                                <span className="font-medium text-gray-700">{option.name}</span>
                                            </div>
                                            {option.price > 0 && (
                                                <span className="text-sm text-gray-500">
                                                    + {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(option.price)}
                                                </span>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                            {!isGroupValid(group) && (
                                <p className="text-xs text-red-500 mt-1">Selecione pelo menos {group.minOptions} opção(ões).</p>
                            )}
                        </div>
                    ))}
                </div>

                <div className="p-4 border-t bg-gray-50">
                    <button
                        onClick={handleConfirm}
                        disabled={!isValid}
                        className="w-full bg-blue-600 text-white py-3 rounded-lg font-bold text-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex justify-between px-4"
                    >
                        <span>Adicionar ao Pedido</span>
                        <span>{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(calculateTotal())}</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
