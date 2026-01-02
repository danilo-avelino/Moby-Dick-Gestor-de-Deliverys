import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../../../lib/api";
import { X, Target, TrendingDown, Percent, Save, Loader2, ChevronRight, ChevronDown, Calendar, DollarSign, FileText, ShoppingCart, Trash2, Star } from "lucide-react";
import toast from "react-hot-toast";

interface GoalsConfigModalProps {
    isOpen: boolean;
    onClose: () => void;
}

interface GoalConfig {
    target: number;
    alertThreshold?: number;
    monthly?: Record<string, number>;
}

interface GoalsData {
    cmv: GoalConfig;
    stockAccuracy: GoalConfig;
    revenue: GoalConfig;
    waste: GoalConfig;
    recipeCoverage: GoalConfig;
    purchasesRatio: GoalConfig;
    ifoodRating: GoalConfig;
}

const MONTHS = [
    { key: '01', name: 'Janeiro', short: 'Jan' },
    { key: '02', name: 'Fevereiro', short: 'Fev' },
    { key: '03', name: 'Março', short: 'Mar' },
    { key: '04', name: 'Abril', short: 'Abr' },
    { key: '05', name: 'Maio', short: 'Mai' },
    { key: '06', name: 'Junho', short: 'Jun' },
    { key: '07', name: 'Julho', short: 'Jul' },
    { key: '08', name: 'Agosto', short: 'Ago' },
    { key: '09', name: 'Setembro', short: 'Set' },
    { key: '10', name: 'Outubro', short: 'Out' },
    { key: '11', name: 'Novembro', short: 'Nov' },
    { key: '12', name: 'Dezembro', short: 'Dez' },
];

const INDICATORS_CONFIG = [
    {
        key: 'cmv',
        label: 'CMV',
        subLabel: 'Custo de Mercadoria Vendida',
        icon: TrendingDown,
        iconColor: 'text-emerald-400',
        unit: '%',
        iconType: Percent,
        hasAlert: true,
        description: 'Valor ideal de CMV para sua operação'
    },
    {
        key: 'stockAccuracy',
        label: 'Precisão de Estoque',
        subLabel: 'Assertividade do Inventário',
        icon: Target,
        iconColor: 'text-blue-400',
        unit: '%',
        iconType: Percent,
        hasAlert: false,
        description: 'Meta de precisão na contagem de estoque'
    },
    {
        key: 'revenue',
        label: 'Faturamento',
        subLabel: 'Receita Total',
        icon: DollarSign,
        iconColor: 'text-green-400',
        unit: 'R$',
        iconType: DollarSign,
        hasAlert: false,
        description: 'Meta de faturamento mensal'
    },
    {
        key: 'waste',
        label: 'Desperdício',
        subLabel: 'Perdas e Quebras',
        icon: Trash2,
        iconColor: 'text-red-400',
        unit: '%',
        iconType: Percent,
        hasAlert: true,
        description: 'Limite aceitável de desperdício'
    },
    {
        key: 'recipeCoverage',
        label: 'Cobertura de Fichas',
        subLabel: 'Itens com Ficha Técnica',
        icon: FileText,
        iconColor: 'text-purple-400',
        unit: '%',
        iconType: Percent,
        hasAlert: false,
        description: 'Porcentagem do cardápio com fichas técnicas'
    },
    {
        key: 'purchasesRatio',
        label: 'Compras vs Meta',
        subLabel: 'Eficiência de Compras',
        icon: ShoppingCart,
        iconColor: 'text-orange-400',
        unit: '%',
        iconType: Percent,
        hasAlert: true,
        description: 'Volume de compras em relação à meta de CMV'
    },
    {
        key: 'ifoodRating',
        label: 'Nota iFood',
        subLabel: 'Avaliação Média',
        icon: Star,
        iconColor: 'text-yellow-400',
        unit: '',
        iconType: Star,
        hasAlert: false,
        description: 'Meta de avaliação mensal (0-5)'
    }
] as const;

export function GoalsConfigModal({ isOpen, onClose }: GoalsConfigModalProps) {
    const queryClient = useQueryClient();
    const currentYear = new Date().getFullYear();

    // State to hold all form data
    const [formData, setFormData] = useState<Record<string, any>>({});
    const [expandedGoal, setExpandedGoal] = useState<string | null>(null);

    const { data: goals, isLoading } = useQuery({
        queryKey: ["goals"],
        queryFn: () => api.get("/api/dashboard/goals").then((res) => res.data.data as GoalsData),
        enabled: isOpen,
    });

    useEffect(() => {
        if (goals) {
            const newFormData: Record<string, any> = {};

            INDICATORS_CONFIG.forEach(ind => {
                const goalData = goals[ind.key as keyof GoalsData];
                const defaultTarget = goalData?.target?.toString() || "";

                // Initialize monthly values
                const monthly: Record<string, string> = {};
                MONTHS.forEach(m => {
                    monthly[m.key] = goalData?.monthly?.[m.key]?.toString() || defaultTarget;
                });

                newFormData[ind.key] = {
                    target: defaultTarget,
                    alertThreshold: goalData?.alertThreshold?.toString() || "",
                    monthly
                };
            });

            setFormData(newFormData);
        }
    }, [goals]);

    const updateGoalsMutation = useMutation({
        mutationFn: (data: any) => api.put("/api/dashboard/goals", data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["goals"] });
            queryClient.invalidateQueries({ queryKey: ["dashboard-kpis"] });
            toast.success("Metas atualizadas com sucesso!");
            onClose();
        },
        onError: () => {
            toast.error("Erro ao atualizar metas");
        }
    });

    const handleSave = () => {
        const payload: Record<string, any> = {};

        Object.entries(formData).forEach(([key, data]) => {
            // Only include if target is set
            if (data.target) {
                const monthlyValues: Record<string, number> = {};
                Object.entries(data.monthly).forEach(([mKey, mVal]) => {
                    monthlyValues[mKey] = parseFloat(mVal as string) || parseFloat(data.target);
                });

                payload[key] = {
                    target: parseFloat(data.target),
                    monthly: monthlyValues,
                    ...(data.alertThreshold ? { alertThreshold: parseFloat(data.alertThreshold) } : {})
                };
            }
        });

        updateGoalsMutation.mutate(payload);
    };

    const handleInputChange = (indicatorKey: string, field: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [indicatorKey]: {
                ...prev[indicatorKey],
                [field]: value
            }
        }));
    };

    const handleMonthlyChange = (indicatorKey: string, monthKey: string, value: string) => {
        setFormData(prev => ({
            ...prev,
            [indicatorKey]: {
                ...prev[indicatorKey],
                monthly: {
                    ...prev[indicatorKey].monthly,
                    [monthKey]: value
                }
            }
        }));
    };

    const applyToAllMonths = (indicatorKey: string) => {
        const targetValue = formData[indicatorKey]?.target;
        if (!targetValue) return;

        const monthly: Record<string, string> = {};
        MONTHS.forEach(m => {
            monthly[m.key] = targetValue;
        });

        setFormData(prev => ({
            ...prev,
            [indicatorKey]: {
                ...prev[indicatorKey],
                monthly
            }
        }));

        toast.success("Valor aplicado a todos os meses");
    };

    const toggleGoalExpand = (goalName: string) => {
        setExpandedGoal(expandedGoal === goalName ? null : goalName);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
            <div className="glass-card w-full max-w-2xl m-4 max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between pb-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-primary-500/20">
                            <Target className="w-6 h-6 text-primary-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">Configurar Metas</h2>
                            <p className="text-sm text-gray-400">Defina as metas para seu centro de custo</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-400" />
                    </button>
                </div>

                {isLoading ? (
                    <div className="flex items-center justify-center py-12">
                        <Loader2 className="w-8 h-8 animate-spin text-primary-400" />
                    </div>
                ) : (
                    <div className="space-y-4 pt-6">
                        {INDICATORS_CONFIG.map((indicator) => {
                            const data = formData[indicator.key] || {};
                            const isExpanded = expandedGoal === indicator.key;

                            return (
                                <div key={indicator.key} className="rounded-xl border border-white/10 overflow-hidden bg-white/5">
                                    {/* Clickable Header */}
                                    <button
                                        onClick={() => toggleGoalExpand(indicator.key)}
                                        className="w-full flex items-center justify-between p-4 hover:bg-white/5 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            <indicator.icon className={`w-5 h-5 ${indicator.iconColor}`} />
                                            <div className="text-left">
                                                <h3 className="text-lg font-semibold text-white">{indicator.label}</h3>
                                                <p className="text-sm text-gray-400">
                                                    Meta atual: {data.target || '-'} {indicator.unit}
                                                    {indicator.hasAlert && data.alertThreshold && ` | Alerta: ${data.alertThreshold} ${indicator.unit}`}
                                                </p>
                                            </div>
                                        </div>
                                        {isExpanded ? (
                                            <ChevronDown className="w-5 h-5 text-gray-400" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-gray-400" />
                                        )}
                                    </button>

                                    {/* Expanded Content */}
                                    {isExpanded && (
                                        <div className="p-4 pt-0 space-y-4 border-t border-white/10">
                                            {/* Default Values */}
                                            <div className="grid grid-cols-2 gap-4 mt-4">
                                                <div>
                                                    <label className="block text-sm font-medium text-gray-300 mb-2">
                                                        Meta Padrão
                                                    </label>
                                                    <div className="relative">
                                                        <input
                                                            type="number"
                                                            step={indicator.unit === '%' ? "0.1" : "1"}
                                                            value={data.target}
                                                            onChange={(e) => handleInputChange(indicator.key, 'target', e.target.value)}
                                                            className="input w-full pr-10"
                                                            placeholder={indicator.unit === '%' ? "30" : "0"}
                                                        />
                                                        <indicator.iconType className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2" />
                                                    </div>
                                                </div>

                                                {indicator.hasAlert && (
                                                    <div>
                                                        <label className="block text-sm font-medium text-gray-300 mb-2">
                                                            Limite de Alerta
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step={indicator.unit === '%' ? "0.1" : "1"}
                                                                value={data.alertThreshold}
                                                                onChange={(e) => handleInputChange(indicator.key, 'alertThreshold', e.target.value)}
                                                                className="input w-full pr-10"
                                                                placeholder={indicator.unit === '%' ? "35" : "0"}
                                                            />
                                                            <indicator.iconType className="w-4 h-4 text-gray-500 absolute right-3 top-1/2 -translate-y-1/2" />
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Apply to all months button */}
                                            <div className="flex items-center justify-between pt-2">
                                                <div className="flex items-center gap-2 text-gray-400">
                                                    <Calendar className="w-4 h-4" />
                                                    <span className="text-sm font-medium">Metas Mensais - {currentYear}</span>
                                                </div>
                                                <button
                                                    onClick={() => applyToAllMonths(indicator.key)}
                                                    className="text-xs text-primary-400 hover:text-primary-300 font-medium"
                                                >
                                                    Aplicar padrão a todos
                                                </button>
                                            </div>

                                            {/* Monthly Grid */}
                                            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2">
                                                {MONTHS.map((month) => (
                                                    <div key={month.key} className="space-y-1">
                                                        <label className="block text-xs font-medium text-gray-400 text-center">
                                                            {month.short}
                                                        </label>
                                                        <div className="relative">
                                                            <input
                                                                type="number"
                                                                step={indicator.unit === '%' ? "0.1" : "1"}
                                                                value={data.monthly?.[month.key] || ""}
                                                                onChange={(e) => handleMonthlyChange(indicator.key, month.key, e.target.value)}
                                                                className="input w-full text-center text-sm py-2 px-2"
                                                            />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>

                                            <p className="text-xs text-gray-500">
                                                {indicator.description}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            );
                        })}

                        {/* Actions */}
                        <div className="flex justify-end gap-3 pt-4 border-t border-white/10">
                            <button
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={updateGoalsMutation.isPending}
                                className="btn-primary flex items-center gap-2"
                            >
                                {updateGoalsMutation.isPending ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <Save className="w-4 h-4" />
                                )}
                                Salvar Metas
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
