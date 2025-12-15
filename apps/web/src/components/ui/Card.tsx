import { cn } from '../../lib/utils';
import { ReactNode } from 'react';

interface CardProps {
    children: ReactNode;
    className?: string;
    noPadding?: boolean;
}

export function Card({ children, className, noPadding = false }: CardProps) {
    return (
        <div className={cn("bg-card rounded-2xl shadow-sm border border-border overflow-hidden", className)}>
            <div className={cn(noPadding ? "" : "p-6")}>
                {children}
            </div>
        </div>
    );
}
