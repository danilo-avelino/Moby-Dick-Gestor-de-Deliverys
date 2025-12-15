import React from 'react';
import { Minus, Plus } from 'lucide-react';
import { cn } from '../../lib/utils';

interface QuantityStepperProps {
    value: number | string;
    onChange: (value: string) => void;
    min?: number;
    step?: number;
    unit?: string;
    disabled?: boolean;
    className?: string;
}

export function QuantityStepper({
    value,
    onChange,
    min = 0,
    step = 1,
    unit = '',
    disabled = false,
    className
}: QuantityStepperProps) {
    const handleIncrement = () => {
        const current = parseFloat(value.toString()) || 0;
        onChange((current + step).toString());
    };

    const handleDecrement = () => {
        const current = parseFloat(value.toString()) || 0;
        const newValue = current - step;
        if (newValue >= min) {
            onChange(newValue.toString());
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        // Allow empty string for backspacing
        if (val === '') {
            onChange('');
            return;
        }

        // Only allow valid numbers
        if (!/^\d*\.?\d*$/.test(val)) return;

        onChange(val);
    };

    const handleBlur = () => {
        if (value === '' || parseFloat(value.toString()) < min) {
            onChange(min.toString());
        }
    };

    return (
        <div className={cn("flex items-center gap-2", className)}>
            <button
                type="button"
                onClick={handleDecrement}
                disabled={disabled || (parseFloat(value.toString()) || 0) <= min}
                className="w-12 h-12 flex items-center justify-center rounded-lg bg-white/5 hover:bg-white/10 active:bg-white/20 border border-white/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                aria-label="Diminuir quantidade"
            >
                <Minus className="w-6 h-6 text-gray-400 group-hover:text-white transition-colors" />
            </button>

            <div className="relative flex-1 min-w-[100px]">
                <input
                    type="text"
                    inputMode="decimal"
                    value={value}
                    onChange={handleChange}
                    onBlur={handleBlur}
                    disabled={disabled}
                    className="w-full h-12 text-center text-xl font-bold bg-black/20 border border-white/10 rounded-lg focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all text-white placeholder-gray-600"
                    placeholder="0"
                />
                {unit && (
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium text-gray-500 pointer-events-none">
                        {unit}
                    </span>
                )}
            </div>

            <button
                type="button"
                onClick={handleIncrement}
                disabled={disabled}
                className="w-12 h-12 flex items-center justify-center rounded-lg bg-primary-500/20 hover:bg-primary-500/30 active:bg-primary-500/40 border border-primary-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                aria-label="Aumentar quantidade"
            >
                <Plus className="w-6 h-6 text-primary-400 group-hover:text-primary-300 transition-colors" />
            </button>
        </div>
    );
}
