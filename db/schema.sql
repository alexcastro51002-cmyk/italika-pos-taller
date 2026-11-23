-- Esquema PostgreSQL (estándar snake_case en SQL) - Sprint 1 Italika POS & Taller

CREATE TABLE IF NOT EXISTS producto (
  id SERIAL PRIMARY KEY,
  codigo_producto VARCHAR(40) NOT NULL UNIQUE,
  nombre VARCHAR(150) NOT NULL,
  categoria VARCHAR(60) NOT NULL,
  precio_compra NUMERIC(12, 2) NOT NULL CHECK (precio_compra > 0),
  precio_venta NUMERIC(12, 2) NOT NULL CHECK (precio_venta >= precio_compra),
  existencia_actual INTEGER NOT NULL DEFAULT 0 CHECK (existencia_actual >= 0),
  stock_minimo INTEGER NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'Activo' CHECK (estado IN ('Activo', 'Inactivo')),
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS venta (
  id SERIAL PRIMARY KEY,
  folio_venta VARCHAR(30) NOT NULL UNIQUE,
  total_venta NUMERIC(12, 2) NOT NULL CHECK (total_venta >= 0),
  metodo_pago VARCHAR(20) CHECK (metodo_pago IN ('Efectivo', 'Tarjeta', 'Transferencia')),
  pago_con NUMERIC(12, 2) CHECK (pago_con >= 0),
  cambio_devuelto NUMERIC(12, 2) DEFAULT 0 CHECK (cambio_devuelto >= 0),
  estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente', 'Pagada', 'Cancelada')),
  usuario_registro VARCHAR(100) NOT NULL,
  creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS venta_detalle (
  id SERIAL PRIMARY KEY,
  venta_id INTEGER NOT NULL REFERENCES venta(id),
  producto_id INTEGER NOT NULL REFERENCES producto(id),
  cantidad INTEGER NOT NULL CHECK (cantidad > 0),
  precio_unitario NUMERIC(12, 2) NOT NULL CHECK (precio_unitario >= 0),
  subtotal NUMERIC(12, 2) NOT NULL CHECK (subtotal >= 0)
);

CREATE TABLE IF NOT EXISTS movimiento_kardex (
  id SERIAL PRIMARY KEY,
  producto_id INTEGER NOT NULL REFERENCES producto(id),
  tipo_movimiento VARCHAR(30) NOT NULL CHECK (tipo_movimiento IN ('Entrada', 'Salida por Venta', 'Devolución por Cancelación', 'Ajuste')),
  cantidad INTEGER NOT NULL,
  stock_anterior INTEGER NOT NULL CHECK (stock_anterior >= 0),
  stock_resultante INTEGER NOT NULL CHECK (stock_resultante >= 0),
  referencia_folio VARCHAR(40),
  usuario_responsable VARCHAR(100) NOT NULL,
  fecha_movimiento TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS servicio_catalogo (
  id SERIAL PRIMARY KEY,
  clave_servicio VARCHAR(30) NOT NULL UNIQUE,
  nombre_servicio VARCHAR(120) NOT NULL,
  precio_estandar NUMERIC(12, 2) NOT NULL CHECK (precio_estandar > 0),
  porcentaje_comision NUMERIC(5, 2) NOT NULL CHECK (porcentaje_comision BETWEEN 0 AND 100),
  estado VARCHAR(20) NOT NULL DEFAULT 'Activo'
);

CREATE TABLE IF NOT EXISTS servicio_realizado (
  id SERIAL PRIMARY KEY,
  folio_servicio VARCHAR(30) NOT NULL UNIQUE,
  servicio_id INTEGER NOT NULL REFERENCES servicio_catalogo(id),
  mecanico_responsable VARCHAR(120) NOT NULL,
  placas_motocicleta VARCHAR(30),
  precio_cobrado NUMERIC(12, 2) NOT NULL CHECK (precio_cobrado > 0),
  porcentaje_comision NUMERIC(5, 2) NOT NULL CHECK (porcentaje_comision BETWEEN 0 AND 100),
  comision_calculada NUMERIC(12, 2) NOT NULL CHECK (comision_calculada >= 0),
  estado_pago VARCHAR(20) NOT NULL DEFAULT 'Pagado',
  estado_comision VARCHAR(20) NOT NULL DEFAULT 'Acreditada' CHECK (estado_comision IN ('Acreditada', 'Anulada')),
  fecha_registro TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
