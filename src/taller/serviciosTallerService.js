/**
 * Servicio de Registro de Servicios Realizados en Taller y Comisiones (HU-13 / KAN-18).
 */

const ESTADOS_COMISION = Object.freeze({
  ACREDITADA: "Acreditada",
  ANULADA: "Anulada",
});

function crearServicioTaller() {
  const ordenesServicio = [];
  let consecutivoOrden = 1;

  function registrarServicioRealizado({
    nombreServicio,
    precioCobrado,
    porcentajeComision,
    mecanicoResponsable,
    placasMotocicleta = "",
    pagoConfirmado = true,
  }) {
    if (!mecanicoResponsable || !String(mecanicoResponsable).trim()) {
      const err = new Error("Debe asignar un trabajador responsable al servicio");
      err.statusCode = 400;
      throw err;
    }

    if (typeof precioCobrado !== "number" || precioCobrado <= 0) {
      const err = new Error("El precio cobrado debe ser mayor a cero.");
      err.statusCode = 400;
      throw err;
    }

    if (typeof porcentajeComision !== "number" || porcentajeComision < 0 || porcentajeComision > 100) {
      const err = new Error("El porcentaje de comisión debe estar entre 0 y 100.");
      err.statusCode = 400;
      throw err;
    }

    const comisionCalculada = Number(((precioCobrado * porcentajeComision) / 100).toFixed(2));
    const orden = {
      folioServicio: `SRV-${String(consecutivoOrden++).padStart(4, "0")}`,
      nombreServicio: String(nombreServicio || "").trim(),
      mecanicoResponsable: String(mecanicoResponsable).trim(),
      placasMotocicleta: String(placasMotocicleta || "").trim(),
      precioCobrado: Number(precioCobrado.toFixed(2)),
      porcentajeComision,
      comisionCalculada,
      estadoPago: pagoConfirmado ? "Pagado" : "Pendiente",
      estadoComision: pagoConfirmado ? ESTADOS_COMISION.ACREDITADA : "Pendiente",
    };

    ordenesServicio.push(orden);
    return { ...orden };
  }

  return {
    registrarServicioRealizado,
    obtenerOrdenes: () => [...ordenesServicio],
  };
}

module.exports = {
  ESTADOS_COMISION,
  crearServicioTaller,
};
