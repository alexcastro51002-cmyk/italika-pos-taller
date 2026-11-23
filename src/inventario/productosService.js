/**
 * Servicio de Inventario y Catálogo de Productos (HU-01 / KAN-12 y HU-02 / KAN-13).
 * Convención estricta lowerCamelCase en identificadores y objetos JSON.
 */

const ESTADOS_PRODUCTO = Object.freeze({
  ACTIVO: "Activo",
  INACTIVO: "Inactivo",
});

function crearRepositorioProductos(productosIniciales = []) {
  const productos = new Map();
  for (const item of productosIniciales) {
    productos.set(item.codigoProducto, { ...item });
  }

  function registrarProducto(datosProducto) {
    const {
      codigoProducto,
      nombre,
      categoria,
      precioCompra,
      precioVenta,
      cantidadInicial = 0,
      stockMinimo = 0,
    } = datosProducto || {};

    if (!codigoProducto || !String(codigoProducto).trim()) {
      const err = new Error("El código de producto es obligatorio.");
      err.statusCode = 400;
      throw err;
    }

    const codigoNormalizado = String(codigoProducto).trim();
    if (productos.has(codigoNormalizado)) {
      const err = new Error("El código de producto ya se encuentra registrado");
      err.statusCode = 409;
      throw err;
    }

    if (
      typeof precioCompra !== "number" ||
      typeof precioVenta !== "number" ||
      precioCompra <= 0 ||
      precioVenta < precioCompra ||
      cantidadInicial < 0 ||
      stockMinimo < 0
    ) {
      const err = new Error(
        "Los montos deben ser positivos y el precio de venta no puede ser inferior al costo."
      );
      err.statusCode = 400;
      throw err;
    }

    const nuevoProducto = {
      codigoProducto: codigoNormalizado,
      nombre: String(nombre || "").trim(),
      categoria: String(categoria || "").trim(),
      precioCompra: Number(precioCompra.toFixed(2)),
      precioVenta: Number(precioVenta.toFixed(2)),
      existenciaActual: Number(cantidadInicial),
      stockMinimo: Number(stockMinimo),
      estado: ESTADOS_PRODUCTO.ACTIVO,
    };

    productos.set(codigoNormalizado, nuevoProducto);
    return { ...nuevoProducto };
  }

  function obtenerCatalogoProductos({ terminoBusqueda = "", rolUsuario = "Administrador" } = {}) {
    const filtro = String(terminoBusqueda || "").trim().toLowerCase();
    const resultados = [];

    for (const producto of productos.values()) {
      if (producto.estado !== ESTADOS_PRODUCTO.ACTIVO) continue;

      const coincide =
        !filtro ||
        producto.codigoProducto.toLowerCase().includes(filtro) ||
        producto.nombre.toLowerCase().includes(filtro) ||
        producto.categoria.toLowerCase().includes(filtro);

      if (!coincide) continue;

      const salida = {
        codigoProducto: producto.codigoProducto,
        nombre: producto.nombre,
        categoria: producto.categoria,
        precioVenta: producto.precioVenta,
        existenciaActual: producto.existenciaActual,
      };

      if (rolUsuario !== "Secretario/a") {
        salida.precioCompra = producto.precioCompra;
      }

      resultados.push(salida);
    }

    return {
      productos: resultados,
      mensaje:
        resultados.length === 0
          ? "No se encontraron productos que coincidan con el criterio de búsqueda"
          : null,
    };
  }

  function obtenerPorCodigo(codigoProducto) {
    return productos.get(codigoProducto) || null;
  }

  function actualizarExistencia(codigoProducto, nuevaExistencia) {
    const prod = productos.get(codigoProducto);
    if (!prod) {
      throw new Error(`Producto ${codigoProducto} no encontrado.`);
    }
    prod.existenciaActual = nuevaExistencia;
    return { ...prod };
  }

  return {
    registrarProducto,
    obtenerCatalogoProductos,
    obtenerPorCodigo,
    actualizarExistencia,
  };
}

module.exports = {
  ESTADOS_PRODUCTO,
  crearRepositorioProductos,
};
