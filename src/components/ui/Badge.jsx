import { cn } from '../../lib/utils'

const variants = {
  verde: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
  amarillo: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
  rojo: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
  gray: 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400',
  orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
  blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
}

export default function Badge({ variant = 'gray', children, className }) {
  return (
    <span className={cn('inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium', variants[variant], className)}>
      {children}
    </span>
  )
}
