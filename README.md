# Apex Pro — Dashboard de Gestión Empresarial

Dashboard completo para gestión de la empresa de detallado automotriz Apex Pro (Perú).

---

## Stack

- **Frontend:** React 19 + Vite + Tailwind CSS 3
- **Backend/DB:** Supabase (PostgreSQL + Auth + RLS)
- **Gráficos:** Recharts
- **Exportación:** jsPDF + xlsx
- **Deploy:** Vercel / Netlify

---

## Setup local

### 1. Instalar dependencias

```bash
npm install
```

### 2. Configurar Supabase

Crea un proyecto en [supabase.com](https://supabase.com), luego:

1. Ve a **SQL Editor** y ejecuta todo el contenido de `supabase/schema.sql`
   - Crea todas las tablas, RLS policies, y seeds iniciales (trabajadores + servicios)

2. Copia tus credenciales desde **Project Settings > API**

### 3. Variables de entorno

```bash
cp .env.example .env.local
```

Edita `.env.local`:

```env
VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
VITE_SUPABASE_ANON_KEY=tu-anon-key
```

> **Sin `.env.local`:** la app corre en **modo demo** con datos ficticios. No se conecta a ninguna base de datos real.

### 4. Correr en desarrollo

```bash
npm run dev
```

Abre [http://localhost:5173](http://localhost:5173)

---

## Configurar usuarios en Supabase Auth

### Crear usuario Admin (Gustavo)

1. En Supabase Dashboard > **Authentication > Users** → Invite user o Create user
2. Anota el `uuid` del usuario creado
3. En **SQL Editor**:

```sql
-- Obtén el ID del worker de Gustavo
SELECT id FROM workers WHERE name = 'Gustavo';

-- Inserta el perfil vinculando auth user con worker
INSERT INTO profiles (id, worker_id, role)
VALUES ('UUID-DEL-AUTH-USER', 'UUID-DEL-WORKER', 'admin');
```

### Crear usuario Trabajador (Ej: Elías)

```sql
INSERT INTO profiles (id, worker_id, role)
VALUES ('UUID-DEL-AUTH-USER-ELIAS', 'UUID-DEL-WORKER-ELIAS', 'worker');
```

Los trabajadores solo ven sus propios tickets, incidencias y datos personales (RLS enforced).

---

## Deploy en Vercel

```bash
npm run build
```

1. Push al repositorio de GitHub
2. Importar el proyecto en [vercel.com](https://vercel.com)
3. Agregar las variables de entorno en **Settings > Environment Variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Deploy automático en cada push

---

## Módulos del dashboard

| Módulo | Ruta | Acceso |
|--------|------|--------|
| Panel Principal | `/` | Admin |
| Registro Diario | `/registro` | Admin |
| Equipo / Trabajadores | `/trabajadores` | Admin (tabla completa) / Worker (solo sus datos) |
| Nómina | `/nomina` | Admin |
| Propuestas de Mix | `/mix` | Admin |
| Configuración | `/configuracion` | Admin |
| Historial | `/historial` | Admin |

---

## Cálculos de referencia

```
Salario diario      = (salario_base × horas_semana / 48) / 26
Descuento falta     = salario_diario
Descuento tardanza  = (salario_diario / horas_jornada) × horas_tarde
Pago final mes      = salario_real_mensual - SUM(descuentos)
Meta ingresos       = alquiler + insumos + planilla_real + meta_utilidad
Ratio rentabilidad  = ingresos_generados / salario_real
```

---

## Márgenes por categoría

| Categoría | Margen |
|-----------|--------|
| Básico / Mid-tier | 85% |
| Cerámico | 45% |
| Polarizado | 45% |
| PPF | 45% |
