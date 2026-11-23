/**
 * Servicio de Cobros, Cálculo de Cambio y Comprobante de Venta (HU-09 / KAN-15).
 */

const METODOS_PAGO_VALIDOS = Object.freeze(["Efectivo", "Tarjeta", "Transferencia"]);

function calcularCambioDevuelto(totalVenta, pagoCon) {
  return Number((pagoCon - totalVenta).toFixed(2));
}

function registrarPagoVenta({ venta, metodoPago, pagoCon, referenciaPago = null }) {
  if (!METODOS_PAGO_VALIDOS.includes(metodoPago)) {
    const err = new Error(`Método de pago inválido: ${metodoPago}.`);
    err.statusCode = 400;
    throw err;
  }

  const totalVenta = Number(venta.totalVenta.toFixed(2));
  let montoRecibido = pagoCon;

  if (metodoPago === "Tarjeta" || metodoPago === "Transferencia") {
    montoRecibido = totalVenta;
  }

  if (typeof montoRecibido !== "number" || montoRecibido < totalVenta) {
    const err = new Error(
      `El importe recibido no cubre el total de la venta ($${totalVenta.toFixed(2)})`
    );
    err.statusCode = 400;
    throw err;
  }

  const cambioDevuelto =
    metodoPago === "Efectivo" ? calcularCambioDevuelto(totalVenta, montoRecibido) : 0.0;

  venta.estado = "Pagada";
  venta.metodoPago = metodoPago;
  venta.pagoCon = Number(montoRecibido.toFixed(2));
  venta.cambioDevuelto = cambioDevuelto;
  venta.referenciaPago = referenciaPago;

  return {
    folioVenta: venta.folioVenta,
    totalVenta,
    metodoPago,
    pagoCon: venta.pagoCon,
    cambioDevuelto,
    estado: venta.estado,
  };
}

function generarComprobanteVenta(ventaPagada) {
  return {
    folioVenta: ventaPagada.folioVenta,
    estado: ventaPagada.estado,
    metodoPago: ventaPagada.metodoPago,
    partidas: ventaPagada.partidas,
    totalVenta: ventaPagada.totalVenta,
    pagoCon: ventaPagada.pagoCon,
    cambioDevuelto: ventaPagada.cambioDevuelto,
  };
}

module.exports = {
  METODOS_PAGO_VALIDOS,
  calcularCambioDevuelto,
  registrarPagoVenta,
  generarComprobanteVenta,
};
