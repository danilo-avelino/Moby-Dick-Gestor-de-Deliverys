
import { cn } from "../../../lib/utils";
import { LucideIcon } from "lucide-react";

interface ModernKPICardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    trend?: string;
    trendType?: "up" | "down" | "neutral";
    icon?: LucideIcon;
    variant: "revenue" | "profit" | "waste" | "cmv" | "neutral";
    className?: string;
}

export function ModernKPICard({
    title,
    value,
    subtitle,
    trend,
    trendType = "neutral",
    icon: Icon,
    variant,
    className
}: ModernKPICardProps) {

    const variants = {
        revenue: {
            bg: "from-amber-500/10 to-transparent",
            text: "text-amber-400",
            iconBg: "bg-amber-500/20",
            border: "border-amber-500/20",
            glow: "shadow-amber-500/5"
        },
        profit: {
            bg: "from-emerald-500/10 to-transparent",
            text: "text-emerald-400",
            iconBg: "bg-emerald-500/20",
            border: "border-emerald-500/20",
            glow: "shadow-emerald-500/5"
        },
        waste: {
            bg: "from-red-500/10 to-transparent",
            text: "text-red-400",
            iconBg: "bg-red-500/20",
            border: "border-red-500/20",
            glow: "shadow-red-500/5"
        },
        cmv: {
            bg: "from-blue-500/10 to-transparent",
            text: "text-blue-400",
            iconBg: "bg-blue-500/20",
            border: "border-blue-500/20",
            glow: "shadow-blue-500/5"
        },
        neutral: {
            bg: "from-gray-500/10 to-transparent",
            text: "text-gray-400",
            iconBg: "bg-gray-500/20",
            border: "border-gray-500/20",
            glow: "shadow-gray-500/5"
        }
    };

    const style = variants[variant] || variants.neutral;

    const trendColor = {
        up: "text-emerald-400",
        down: "text-red-400",
        neutral: "text-gray-400"
    }[trendType];

    return (
        <div className={cn(
            "relative overflow-hidden p-6 h-full flex flex-col justify-between",
            className
        )}>
            {/* Background Gradient */}
            <div className={cn("absolute inset-0 bg-gradient-to-br opacity-50", style.bg)} />

            {/* Header */}
            <div className="relative z-10 flex justify-between items-start mb-4">
                <div>
                    <p className="text-sm font-medium text-gray-400">{title}</p>
                </div>
                {Icon && (
                    <div className={cn("p-2 rounded-xl", style.iconBg)}>
                        <Icon className={cn("w-5 h-5", style.text)} />
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="relative z-10">
                <h2 className="text-3xl font-bold text-white tracking-tight drop-shadow-sm">
                    {value}
                </h2>
                <div className="flex items-center gap-2 mt-2">
                    {trend && (
                        <span className={cn("text-xs font-semibold px-1.5 py-0.5 rounded bg-white/5", trendColor)}>
                            {trend}
                        </span>
                    )}
                    {subtitle && (
                        <p className="text-xs text-gray-500 truncate">{subtitle}</p>
                    )}
                </div>
            </div>
        </div>
    );
}
