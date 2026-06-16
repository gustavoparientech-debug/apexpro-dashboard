import { cn } from '../../lib/utils'

export default function StatCard({ label, value, sub, icon: Icon, color = 'neutral', trend }) {
  const colors = {
    red: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    green: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    neutral: 'text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800',
  }
  return (
    <div className="card flex flex-col gap-2 shadow-md hover:shadow-lg transition-shadow duration-200">
      <div className="flex items-center gap-2">
        {Icon && (
          <div className={cn('rounded-lg p-2 flex-shrink-0', colors[color] || colors.neutral)}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight tracking-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">{sub}</p>}
    </div>
  )
}
