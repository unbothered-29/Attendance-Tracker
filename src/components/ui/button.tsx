import * as React from "react"
import { cn } from "../../lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost' | 'danger';
  size?: 'default' | 'sm' | 'lg' | 'icon';
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
          {
            'bg-purple-600 text-white hover:bg-purple-500 shadow-lg shadow-purple-500/25': variant === 'default',
            'border border-purple-500/30 bg-purple-500/5 text-purple-300 hover:bg-purple-500/15 hover:text-purple-200': variant === 'outline',
            'hover:bg-white/5 text-gray-300 hover:text-white': variant === 'ghost',
            'bg-red-500/10 text-red-400 hover:bg-red-500/20 hover:text-red-300': variant === 'danger',
            'h-10 px-5 py-2': size === 'default',
            'h-8 rounded-lg px-3 text-xs': size === 'sm',
            'h-12 rounded-xl px-8 text-base': size === 'lg',
            'h-10 w-10': size === 'icon',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
