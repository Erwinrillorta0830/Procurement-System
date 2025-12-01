// components/ui/button.tsx
import * as React from 'react';
import clsx from 'clsx';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: 'default' | 'outline' | 'danger';
    size?: 'sm' | 'md' | 'lg';
}

export const Button = ({
                           children,
                           variant = 'default',
                           size = 'md',
                           className,
                           ...props
                       }: ButtonProps) => {
    const base = 'rounded-lg font-medium focus:outline-none focus:ring transition';
    const variants = {
        default: 'bg-blue-600 hover:bg-blue-700 text-white',
        outline: 'border border-gray-300 text-gray-800 hover:bg-gray-50',
        danger: 'bg-red-600 hover:bg-red-700 text-white',
    };
    const sizes = {
        sm: 'px-3 py-1 text-sm',
        md: 'px-4 py-2',
        lg: 'px-5 py-3 text-lg',
    };

    return (
        <button
            className={clsx(base, variants[variant], sizes[size], className)}
            {...props}
        >
            {children}
        </button>
    );
};
