import { clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

const cn = (...inputs) => twMerge(clsx(inputs))

const Card = ({ className, children, padding = 'default', shadow = 'soft' }) => {
  const paddings = {
    none: '',
    sm: 'p-4',
    default: 'p-6',
    lg: 'p-8',
  }

  const shadows = {
    none: '',
    soft: 'shadow-soft',
    card: 'shadow-card',
    lg: 'shadow-lg',
  }

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-primary-200/60',
        paddings[padding],
        shadows[shadow],
        className
      )}
    >
      {children}
    </div>
  )
}

const CardHeader = ({ className, children }) => (
  <div className={cn('mb-4', className)}>{children}</div>
)

const CardTitle = ({ className, children }) => (
  <h3 className={cn('text-lg font-semibold text-primary-900 tracking-tight', className)}>
    {children}
  </h3>
)

const CardDescription = ({ className, children }) => (
  <p className={cn('text-sm text-primary-500 mt-1', className)}>{children}</p>
)

const CardContent = ({ className, children }) => (
  <div className={cn('', className)}>{children}</div>
)

const CardFooter = ({ className, children }) => (
  <div className={cn('mt-4 pt-4 border-t border-primary-100 flex items-center gap-3', className)}>
    {children}
  </div>
)

Card.Header = CardHeader
Card.Title = CardTitle
Card.Description = CardDescription
Card.Content = CardContent
Card.Footer = CardFooter

export default Card