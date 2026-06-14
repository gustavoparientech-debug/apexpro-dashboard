import { cn } from '../../lib/utils'

export default function StatCard({ label, value, sub, icon: Icon, color = 'orange', trend }) {
  const colors = {
    orange: 'text-orange-500 bg-orange-50 dark:bg-orange-900/20',
    green: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    blue: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    purple: 'text-purple-600 bg-purple-50 dark:bg-purple-900/20',
    red: 'text-red-600 bg-red-50 dark:bg-red-900/20',
  }
  return (
    <div className="card flex flex-col gap-2">
      <div className="flex items-center gap-2">
        {Icon && (
          <div className={cn('rounded-lg p-2 flex-shrink-0', colors[color])}>
            <Icon className="w-4 h-4" />
          </div>
        )}
        <p className="text-sm text-gray-500 dark:text-gray-400 leading-tight">{label}</p>
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white leading-none break-all">{value}</p>
      {sub && <p className="text-xs text-gray-400 dark:text-gray-500 leading-tight">{sub}</p>}
    </div>
  )
}
