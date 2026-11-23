/**
 * Servicio de Ventas de Mostrador con descuento atómico de inventario y Kardex (HU-08 / KAN-14).
 */

function calcularTotalVenta(itemsCarrito = []) {
  let totalVenta = 0;
  const partidas = itemsCarrito.map((item) => {
    const subtotal = Number((item.precioVenta * item.cantidad).toFixed(2));
    totalVenta += subtotal;
    return {
      codigoProducto: item.codigoProducto,
      nombre: item.nombre,
      cantidad: item.cantidad,
      precioUnitario: Number(item.precioVenta.toFixed(2)),
      subtotal,
    };
  });
  return {
    partidas,
    totalVenta: Number(totalVenta.toFixed(2)),
  };
}

function crearServicioVentas({ repositorioProductos }) {
  const ventasRegistradas = [];
  const movimientosKardex = [];
  let consecutivoFolio = 1;

  function registrarVentaMostrador({ itemsCarrito = [], usuarioResponsable = "Secretario/a" }) {
    if (!Array.isArray(itemsCarrito) || itemsCarrito.length === 0) {
      const err = new Error("Debe agregar al menos un producto al carrito de venta.");
      err.statusCode = 400;
      throw err;
    }

    // Fase 1 (Validación previa para garantizar atomicidad sin mutaciones parciales)
    const productosValidados = [];
    for (const item of itemsCarrito) {
      const productoActual = repositorioProductos.obtenerPorCodigo(item.codigoProducto);
      if (!productoActual || productoActual.estado !== "Activo") {
        const err = new Error(`Producto ${item.codigoProducto} no disponible en catálogo activo.`);
        err.statusCode = 404;
        throw err;
      }
      if (item.cantidad <= 0) {
        const err = new Error("La cantidad vendida debe ser mayor a cero.");
        err.statusCode = 400;
        throw err;
      }
      if (productoActual.existenciaActual < item.cantidad) {
        const err = new Error(
          `Stock insuficiente: solo hay ${productoActual.existenciaActual} unidades disponibles`
        );
        err.statusCode = 409;
        throw err;
      }
      productosValidados.push({
        producto: productoActual,
        cantidad: item.cantidad,
        precioVenta: productoActual.precioVenta,
        nombre: productoActual.nombre,
        codigoProducto: productoActual.codigoProducto,
      });
    }

    // Fase 2 (Commit atómico: descuento de existencias + folio + Kardex)
    const folioVenta = `VTA-${String(consecutivoFolio++).padStart(4, "0")}`;
    const { partidas, totalVenta } = calcularTotalVenta(productosValidados);

    for (const entry of productosValidados) {
      const stockAnterior = entry.producto.existenciaActual;
      const stockResultante = stockAnterior - entry.cantidad;
      repositorioProductos.actualizarExistencia(entry.codigoProducto, stockResultante);
      movimientosKardex.push({
        folioReferencia: folioVenta,
        codigoProducto: entry.codigoProducto,
        tipoMovimiento: "Salida por Venta",
        cantidad: entry.cantidad,
        stockAnterior,
        stockResultante,
        usuarioResponsable,
      });
    }

    const venta = {
      folioVenta,
      partidas,
      totalVenta,
      estado: "Pendiente",
      usuarioResponsable,
    };
    ventasRegistradas.push(venta);
    return { ...venta };
  }

  return {
    calcularTotalVenta,
    registrarVentaMostrador,
    obtenerVentas: () => [...ventasRegistradas],
    obtenerKardex: () => [...movimientosKardex],
  };
}

module.exports = {
  calcularTotalVenta,
  crearServicioVentas,
};
