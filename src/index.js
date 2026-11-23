/**
 * Demostración del flujo transaccional completo del Sprint 1 (Italika POS & Taller).
 */

const { crearRepositorioProductos } = require("./inventario/productosService");
const { crearServicioVentas } = require("./ventas/ventasService");
const { registrarPagoVenta, generarComprobanteVenta } = require("./cobros/cobrosService");
const { crearServicioTaller } = require("./taller/serviciosTallerService");

function ejecutarDemoSprint1() {
  const repositorioProductos = crearRepositorioProductos();
  const servicioVentas = crearServicioVentas({ repositorioProductos });
  const servicioTaller = crearServicioTaller();

  const productoAlta = repositorioProductos.registrarProducto({
    codigoProducto: "ITA-REF-001",
    nombre: "Kit de arrastre Italika FT150",
    categoria: "Refacciones",
    precioCompra: 320.0,
    precioVenta: 480.0,
    cantidadInicial: 10,
    stockMinimo: 3,
  });

  const catalogoSecretaria = repositorioProductos.obtenerCatalogoProductos({
    terminoBusqueda: "ITA-REF",
    rolUsuario: "Secretario/a",
  });

  const venta = servicioVentas.registrarVentaMostrador({
    itemsCarrito: [{ codigoProducto: "ITA-REF-001", cantidad: 2 }],
    usuarioResponsable: "Secretario/a",
  });

  const cobro = registrarPagoVenta({
    venta,
    metodoPago: "Efectivo",
    pagoCon: 1000.0,
  });

  const comprobante = generarComprobanteVenta(venta);

  const ordenTaller = servicioTaller.registrarServicioRealizado({
    nombreServicio: "Cambio de balatas",
    precioCobrado: 200.0,
    porcentajeComision: 30,
    mecanicoResponsable: "Juan Pérez",
    placasMotocicleta: "SON-150-IT",
    pagoConfirmado: true,
  });

  return {
    productoAlta,
    catalogoSecretaria,
    cobro,
    comprobante,
    existenciaRestante: repositorioProductos.obtenerPorCodigo("ITA-REF-001").existenciaActual,
    ordenTaller,
  };
}

if (require.main === module) {
  console.log(JSON.stringify(ejecutarDemoSprint1(), null, 2));
}

module.exports = { ejecutarDemoSprint1 };
