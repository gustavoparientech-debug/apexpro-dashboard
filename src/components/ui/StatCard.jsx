import { cn } from '../../lib/utils'

const COLOR_MAP = {
  red:     { icon: 'text-red-500 bg-red-500/10',     accent: 'from-red-500/5 to-red-500/0',     bar: 'bg-red-500',     num: 'text-red-600 dark:text-red-400' },
  green:   { icon: 'text-emerald-500 bg-emerald-500/10', accent: 'from-emerald-500/5 to-emerald-500/0', bar: 'bg-emerald-500', num: 'text-emerald-600 dark:text-emerald-400' },
  neutral: { icon: 'text-slate-500 bg-slate-100 dark:bg-slate-700', accent: 'from-slate-500/5 to-slate-500/0', bar: 'bg-slate-400', num: 'text-gray-900 dark:text-white' },
}

export default function StatCard({ label, value, sub, icon: Icon, color = 'neutral', trend }) {
  const c = COLOR_MAP[color] || COLOR_MAP.neutral
  const isNegative = typeof value === 'string' && value.startsWith('-')

  return (
    <div className={cn(
      'relative overflow-hidden rounded-2xl bg-white dark:bg-gray-900 border border-gray-100 dark:border-gray-800',
      'shadow-sm hover:shadow-md active:scale-[0.98] transition-all duration-200 p-4 flex flex-col gap-3'
    )}>
      {/* Gradiente sutil de fondo */}
      <div className={cn('absolute inset-0 bg-gradient-to-br opacity-60 pointer-events-none', c.accent)} />

      {/* Barra de color superior */}
      <div className={cn('absolute top-0 left-0 right-0 h-0.5', c.bar)} />

      {/* Header: icono + label */}
      <div className="flex items-center gap-2 relative">
        {Icon && (
          <div className={cn('rounded-xl p-2.5 flex-shrink-0', c.icon)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <p className="text-xs font-semibold text-gray-500 dark:text-gray-400 leading-tight uppercase tracking-wide">{label}</p>
      </div>

      {/* Valor principal */}
      <p className={cn(
        'text-2xl font-black leading-none tracking-tight relative',
        isNegative ? 'text-red-500 dark:text-red-400' : c.num
      )}>
        {value}
      </p>

      {/* Sub */}
      {sub && (
        <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight relative">{sub}</p>
      )}
    </div>
  )
}
