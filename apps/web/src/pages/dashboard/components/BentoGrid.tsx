
import { ReactNode } from "react";
import { cn } from "../../../lib/utils";

interface BentoGridProps {
    children: ReactNode;
    className?: string;
}

export function BentoGrid({ children, className }: BentoGridProps) {
    return (
        <div className={cn(
            "grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 auto-rows-[minmax(180px,auto)]",
            className
        )}>
            {children}
        </div>
    );
}

interface BentoCardProps {
    children: ReactNode;
    className?: string;
    colSpan?: 1 | 2 | 3 | 4;
    rowSpan?: 1 | 2 | 3; // Keep simple for now
    title?: string;
    headerAction?: ReactNode;
    noPadding?: boolean;
}

export function BentoCard({
    children,
    className,
    colSpan = 1,
    rowSpan = 1,
    title,
    headerAction,
    noPadding = false
}: BentoCardProps) {
    // Map span to classes
    const colSpanClass = {
        1: "md:col-span-1",
        2: "md:col-span-2",
        3: "md:col-span-3",
        4: "md:col-span-4", // Limit for large screens
    }[colSpan];

    // rowSpan is harder with auto-rows, but we can try min-h or row-span if grid allows
    // For now, let's just control height via content or allow custom class

    return (
        <div className={cn(
            "group relative overflow-hidden rounded-3xl bg-gray-900/60 backdrop-blur-xl border border-white/10 shadow-xl transition-all hover:border-white/20",
            colSpanClass,
            className
        )}>
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

            {(title || headerAction) && (
                <div className="flex items-center justify-between p-6 pb-2 relative z-10">
                    {title && <h3 className="text-lg font-semibold text-white tracking-tight">{title}</h3>}
                    {headerAction}
                </div>
            )}

            <div className={cn("relative z-10 h-full", !noPadding && "p-6")}>
                {children}
            </div>
        </div>
    );
}
