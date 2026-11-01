import { formatMoney } from '../../lib/utils'

// De dónde sale la utilidad del plan, en dos partes:
// - lo que hace el equipo: su costo ya está en el costo fijo, así que todo su
//   precio va a cubrir ese costo fijo;
// - lo que se hace con externos (PPF, polarizados, pintura): deja ganancia
//   después de pagarles.
export default function DesgloseUtilidad({ econ }) {
  const equipo = econ.ingresoEquipoMeta || 0
  const ganExt = econ.gananciaExternaMeta || 0
  const fijo   = econ.costoFijo || 0
  const falta  = fijo - equipo
  return (
    <div className="rounded-xl border border-gray-100 dark:border-gray-800 p-3 space-y-2 text-[11px]">
      <div>
        <div className="flex justify-between gap-2">
          <span className="text-gray-500">Servicios del equipo</span>
          <span className="font-bold text-gray-800 dark:text-gray-100 tabular-nums">{formatMoney(equipo)}</span>
        </div>
        <p className="text-gray-400 leading-snug">
          Su material y mano de obra ya están en el costo fijo ({formatMoney(fijo)}).
          {falta > 0
            ? <> Cubren el <b>{fijo > 0 ? Math.round((equipo / fijo) * 100) : 0}%</b>: faltan <b className="text-red-500">{formatMoney(falta)}</b> para cubrirlo.</>
            : <> Lo cubren y sobran <b className="text-emerald-600">{formatMoney(-falta)}</b>.</>}
        </p>
      </div>
      <div>
        <div className="flex justify-between gap-2">
          <span className="text-gray-500">PPF, polarizados y pintura</span>
          <span className="font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">+{formatMoney(ganExt)}</span>
        </div>
        <p className="text-gray-400 leading-snug">
          {formatMoney(econ.ingresoExternoMeta || 0)} de ingreso − {formatMoney(econ.costoExternoMeta || 0)} que se paga a los externos.
        </p>
      </div>
      <div className="flex justify-between gap-2 border-t border-gray-100 dark:border-gray-800 pt-2">
        <span className="font-semibold text-gray-600 dark:text-gray-300">
          Utilidad = {formatMoney(equipo)} + {formatMoney(ganExt)} − {formatMoney(fijo)}
        </span>
        <span className={`font-black tabular-nums ${econ.utilidadMeta >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>{formatMoney(econ.utilidadMeta)}</span>
      </div>
    </div>
  )
}
