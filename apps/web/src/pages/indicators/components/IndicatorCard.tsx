import { ArrowDown, ArrowUp, Clock, Info, Target, Calendar } from "lucide-react";
import { cn } from "../../../lib/utils";

interface IndicatorCardProps {
    indicator: any; // Type efficiently later
    onClick: () => void;
}

export function IndicatorCard({ indicator, onClick }: IndicatorCardProps) {
    const { name, currentValue, targetValue, cycle, isDeveloping, isActive } = indicator;

    // Determine status color
    // Simple logic: if currentValue >= targetValue then Green, else Red?
    // Depends on indicator type (Cost vs Revenue). Assuming Revenue logic for now (Higher is better).
    // If "Ruptura" (Rupture), Lower is better. 
    // For now, let's use a generic status or assume target is a "Goal".
    // If system doesn't know direction, maybe we need a `direction` field in schema?
    // Let's assume standard logic: Green if met.

    const isMet = targetValue ? currentValue >= targetValue : false;
    const statusColor = isDeveloping
        ? "bg-gray-100 border-gray-200 text-gray-500"
        : isMet
            ? "bg-emerald-50 border-emerald-200 text-emerald-700"
            : "bg-red-50 border-red-200 text-red-700";

    const diff = targetValue ? ((currentValue - targetValue) / targetValue) * 100 : 0;

    return (
        <div
            onClick={!isDeveloping ? onClick : undefined}
            className={cn(
                "relative rounded-xl border p-5 transition-all duration-200 hover:shadow-md cursor-pointer",
                isDeveloping
                    ? "bg-white/5 opacity-75 cursor-not-allowed border-dashed border-white/10"
                    : "glass-card border-white/10 hover:border-primary-500/50 hover:bg-white/5"
            )}
        >
            {isDeveloping && (
                <div className="absolute top-2 right-2 px-2 py-0.5 bg-white/10 text-gray-400 text-xs rounded-full font-medium">
                    Em construção
                </div>
            )}

            <div className="flex justify-between items-start mb-4">
                <div className="p-2 bg-indigo-500/20 rounded-lg">
                    <Target className="w-5 h-5 text-indigo-400" />
                </div>
                <div className="flex flex-col items-end">
                    <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">{cycle}</span>
                </div>
            </div>

            <h3 className="text-white font-semibold text-lg leading-tight mb-1">{name}</h3>
            <p className="text-sm text-gray-400 mb-4 line-clamp-2">{indicator.description || "Indicador de performance"}</p>

            {isDeveloping ? (
                <div className="flex items-center text-gray-500 text-sm mt-4">
                    <Info className="w-4 h-4 mr-2" />
                    Aguardando integração
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex items-baseline justify-between">
                        <span className="text-3xl font-bold text-white">
                            {currentValue.toLocaleString('pt-BR')}
                        </span>
                        <div className={cn("flex items-center text-sm font-medium", isMet ? "text-emerald-400" : "text-red-400")}>
                            {isMet ? <ArrowUp className="w-4 h-4 mr-1" /> : <ArrowDown className="w-4 h-4 mr-1" />}
                            {Math.abs(diff).toFixed(1)}% vs meta
                        </div>
                    </div>

                    <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
                        <div
                            className={cn("h-full rounded-full", isMet ? "bg-emerald-500" : "bg-red-500")}
                            style={{ width: `${Math.min((currentValue / (targetValue || 1)) * 100, 100)}%` }}
                        />
                    </div>

                    <div className="flex justify-between text-xs text-gray-500 pt-2 border-t border-white/5">
                        <span className="flex items-center">
                            <Target className="w-3 h-3 mr-1" /> Meta: {targetValue?.toLocaleString('pt-BR') || '-'}
                        </span>
                        <span className="flex items-center">
                            <Clock className="w-3 h-3 mr-1" /> Atualizado há 2h
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
