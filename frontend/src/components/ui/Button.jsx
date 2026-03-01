import { forwardRef } from 'react'
import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'
import { Loader2 } from 'lucide-react'

const cn = (...inputs) => twMerge(clsx(inputs))

const Button = forwardRef(({
  className,
  variant = 'primary',
  size = 'default',
  isLoading = false,
  disabled,
  children,
  ...props
}, ref) => {
  const variants = {
    primary: 'bg-accent-600 text-white hover:bg-accent-500 focus:ring-accent-500',
    secondary: 'bg-white text-primary-700 border border-primary-200 hover:bg-primary-50 focus:ring-primary-200',
    ghost: 'bg-transparent text-primary-600 hover:bg-primary-100',
    danger: 'bg-red-600 text-white hover:bg-red-500 focus:ring-red-500',
  }

  const sizes = {
    default: 'px-5 py-2.5 text-sm',
    sm: 'px-3 py-2 text-xs',
    lg: 'px-6 py-3 text-base',
    icon: 'p-2',
  }

  return (
    <button
      ref={ref}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-200',
        'focus:outline-none focus:ring-2 focus:ring-offset-2',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  )
})

Button.displayName = 'Button'

export default Button