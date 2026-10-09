import { Campo } from './ui'

export const EMPTY_BUYER = { nombre: '', dni: '', celular: '', email: '' }

// Validación local (la definitiva está en raffle_create_order).
export function validateBuyer(b) {
  const nombre = b.nombre.trim().replace(/\s+/g, ' ')
  if (nombre.length < 3 || !nombre.includes(' ')) return 'Escribe tu nombre y apellido.'
  if (!/^[0-9A-Za-z]{8,12}$/.test(b.dni.trim())) return 'Revisa el DNI (8 dígitos) o carnet de extranjería.'
  if (!/^9\d{8}$/.test(b.celular.replace(/\D/g, ''))) return 'El celular debe tener 9 dígitos y empezar con 9.'
  if (b.email.trim() && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(b.email.trim())) return 'Revisa el correo electrónico.'
  return null
}

export default function BuyerFields({ value, onChange, inputClass = 'input-dark' }) {
  const set = (k) => (e) => onChange({ ...value, [k]: e.target.value })
  return (
    <div className="space-y-3">
      <Campo label="Nombre completo">
        <input className={inputClass} value={value.nombre} onChange={set('nombre')}
          autoComplete="name" placeholder="Nombre y apellidos" maxLength={120} required />
      </Campo>
      <div className="grid grid-cols-2 gap-3">
        <Campo label="DNI">
          <input className={inputClass} value={value.dni} inputMode="numeric" maxLength={12}
            onChange={e => onChange({ ...value, dni: e.target.value.replace(/[^0-9A-Za-z]/g, '').toUpperCase() })}
            placeholder="12345678" required />
        </Campo>
        <Campo label="Celular">
          <input className={inputClass} value={value.celular} inputMode="tel" autoComplete="tel" maxLength={11}
            onChange={e => onChange({ ...value, celular: e.target.value.replace(/[^\d ]/g, '') })}
            placeholder="9XX XXX XXX" required />
        </Campo>
      </div>
      <Campo label="Correo (opcional)">
        <input className={inputClass} type="email" value={value.email} onChange={set('email')}
          autoComplete="email" placeholder="tucorreo@ejemplo.com" />
      </Campo>
    </div>
  )
}
