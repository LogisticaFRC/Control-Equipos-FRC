-- =====================================================================
-- BODEGA DE FILTROS + KITS · Ejecutar UNA VEZ en Supabase → SQL Editor → Run
-- (Se puede volver a ejecutar sin perder datos.)
--
--  bd_filtros_stock        → inventario general de filtros sueltos (código, tipo, marca, cantidad)
--  bd_filtros_kits         → KITS armados: código del kit, para qué marca/modelo de equipo y cuántos hay en bodega
--  bd_filtros_kits_items   → composición de cada kit (qué filtros y cuántos lleva UN kit)
--  bd_filtros_movimientos  → registro de todo lo que entra / sale (ingresos, armado, desarme, consumo en Programas)
-- =====================================================================

-- 1) INVENTARIO GENERAL (filtros sueltos)
CREATE TABLE IF NOT EXISTS public.bd_filtros_stock (
  id          bigserial PRIMARY KEY,
  codigo      text NOT NULL,
  tipo        text NOT NULL DEFAULT '',
  marca       text NOT NULL DEFAULT '',
  cantidad    numeric NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),
  CONSTRAINT bd_filtros_stock_codigo_unico UNIQUE (codigo)
);

-- 2) KITS
CREATE TABLE IF NOT EXISTS public.bd_filtros_kits (
  id             bigserial PRIMARY KEY,
  codigo         text NOT NULL,                 -- código del kit, ej. KIT-CAT-320D-01
  equipo_marca   text NOT NULL DEFAULT '',      -- marca / modelo del equipo (mismo criterio que el módulo Filtros)
  equipo_modelo  text NOT NULL DEFAULT '',
  descripcion    text NOT NULL DEFAULT '',
  cantidad       numeric NOT NULL DEFAULT 0,    -- kits armados disponibles en bodega
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  CONSTRAINT bd_filtros_kits_codigo_unico UNIQUE (codigo)
);

-- 3) COMPOSICIÓN DE CADA KIT (por 1 kit)
CREATE TABLE IF NOT EXISTS public.bd_filtros_kits_items (
  id        bigserial PRIMARY KEY,
  kit_id    bigint NOT NULL REFERENCES public.bd_filtros_kits(id) ON DELETE CASCADE,
  codigo    text NOT NULL,
  tipo      text NOT NULL DEFAULT '',
  marca     text NOT NULL DEFAULT '',
  cantidad  numeric NOT NULL DEFAULT 1,
  CONSTRAINT bd_filtros_kits_items_unico UNIQUE (kit_id, codigo)
);

-- 4) MOVIMIENTOS (trazabilidad)
CREATE TABLE IF NOT EXISTS public.bd_filtros_movimientos (
  id          bigserial PRIMARY KEY,
  fecha       timestamptz DEFAULT now(),
  tipo_mov    text NOT NULL,          -- INGRESO, SALIDA, AJUSTE, ARMADO KIT, DESARME KIT, CONSUMO KIT, DEVOLUCION KIT
  es_kit      boolean NOT NULL DEFAULT false,
  codigo      text NOT NULL,          -- código del filtro o del kit
  cantidad    numeric NOT NULL,       -- + entra / - sale
  detalle     text DEFAULT '',
  usuario     text DEFAULT '',
  ref         text DEFAULT ''         -- ej. PROG_ITEM:123 (consumo desde Programas)
);
CREATE INDEX IF NOT EXISTS bd_filtros_movimientos_ref_idx ON public.bd_filtros_movimientos (ref);

-- Permisos (igual que las demás tablas: clave anon)
ALTER TABLE public.bd_filtros_stock ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_filtros_kits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_filtros_kits_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bd_filtros_movimientos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS bd_filtros_stock_anon_all ON public.bd_filtros_stock;
DROP POLICY IF EXISTS bd_filtros_kits_anon_all ON public.bd_filtros_kits;
DROP POLICY IF EXISTS bd_filtros_kits_items_anon_all ON public.bd_filtros_kits_items;
DROP POLICY IF EXISTS bd_filtros_movimientos_anon_all ON public.bd_filtros_movimientos;
CREATE POLICY bd_filtros_stock_anon_all ON public.bd_filtros_stock FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY bd_filtros_kits_anon_all ON public.bd_filtros_kits FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY bd_filtros_kits_items_anon_all ON public.bd_filtros_kits_items FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY bd_filtros_movimientos_anon_all ON public.bd_filtros_movimientos FOR ALL TO anon USING (true) WITH CHECK (true);

-- Refresca la caché de Supabase para que la app vea las tablas nuevas de inmediato
NOTIFY pgrst, 'reload schema';
