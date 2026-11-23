const test = require("node:test");
const assert = require("node:assert/strict");

const { crearRepositorioProductos } = require("../src/inventario/productosService");
const { crearServicioVentas } = require("../src/ventas/ventasService");
const { registrarPagoVenta } = require("../src/cobros/cobrosService");
const { crearServicioTaller } = require("../src/taller/serviciosTallerService");

test("HU-01 (KAN-12): Alta exitosa, rechazo por código duplicado y validación de precios", () => {
  const repo = crearRepositorioProductos();

  // CA-01: Alta exitosa
  const creado = repo.registrarProducto({
    codigoProducto: "ITA-REF-001",
    nombre: "Bujía NGK Italika",
    categoria: "Refacciones",
    precioCompra: 45,
    precioVenta: 85,
    cantidadInicial: 15,
    stockMinimo: 5,
  });
  assert.equal(creado.estado, "Activo");
  assert.equal(creado.existenciaActual, 15);

  // CA-02: Rechazo por código duplicado
  assert.throws(
    () =>
      repo.registrarProducto({
        codigoProducto: "ITA-REF-001",
        nombre: "Otro producto",
        categoria: "Refacciones",
        precioCompra: 50,
        precioVenta: 90,
      }),
    /El código de producto ya se encuentra registrado/
  );

  // CA-03: Precio venta inferior al costo
  assert.throws(
    () =>
      repo.registrarProducto({
        codigoProducto: "ITA-REF-002",
        nombre: "Casco integral",
        categoria: "Accesorios",
        precioCompra: 500,
        precioVenta: 450,
      }),
    /no puede ser inferior al costo/
  );
});

test("HU-02 (KAN-13): Búsqueda por coincidencia, ocultamiento de costo por rol y estado vacío", () => {
  const repo = crearRepositorioProductos([
    {
      codigoProducto: "ITA-001",
      nombre: "Aceite Italika 20W50",
      categoria: "Refacciones",
      precioCompra: 95,
      precioVenta: 145,
      existenciaActual: 12,
      stockMinimo: 4,
      estado: "Activo",
    },
  ]);

  // CA-01 y CA-02: Secretario/a no ve precioCompra
  const vistaSecretaria = repo.obtenerCatalogoProductos({
    terminoBusqueda: "Aceite",
    rolUsuario: "Secretario/a",
  });
  assert.equal(vistaSecretaria.productos.length, 1);
  assert.equal("precioCompra" in vistaSecretaria.productos[0], false);
  assert.equal(vistaSecretaria.productos[0].precioVenta, 145);

  // Administrador sí ve precioCompra
  const vistaAdmin = repo.obtenerCatalogoProductos({
    terminoBusqueda: "ITA-001",
    rolUsuario: "Administrador",
  });
  assert.equal(vistaAdmin.productos[0].precioCompra, 95);

  // CA-03: Búsqueda sin coincidencias
  const sinResultados = repo.obtenerCatalogoProductos({ terminoBusqueda: "XYZ-999" });
  assert.equal(sinResultados.productos.length, 0);
  assert.match(sinResultados.mensaje, /No se encontraron productos/);
});

test("HU-08 (KAN-14): Cálculo automático de venta, descuento atómico en stock/Kardex y bloqueo sin stock", () => {
  const repo = crearRepositorioProductos([
    {
      codigoProducto: "PROD-A",
      nombre: "Producto A",
      categoria: "Refacciones",
      precioCompra: 100,
      precioVenta: 150,
      existenciaActual: 10,
      stockMinimo: 2,
      estado: "Activo",
    },
    {
      codigoProducto: "PROD-B",
      nombre: "Producto B",
      categoria: "Accesorios",
      precioCompra: 250,
      precioVenta: 400,
      existenciaActual: 3,
      stockMinimo: 1,
      estado: "Activo",
    },
  ]);
  const ventas = crearServicioVentas({ repositorioProductos: repo });

  // CA-01 y CA-02: Venta válida 2*150 + 1*400 = 700
  const venta = ventas.registrarVentaMostrador({
    itemsCarrito: [
      { codigoProducto: "PROD-A", cantidad: 2 },
      { codigoProducto: "PROD-B", cantidad: 1 },
    ],
  });
  assert.equal(venta.totalVenta, 700);
  assert.equal(repo.obtenerPorCodigo("PROD-A").existenciaActual, 8);
  assert.equal(repo.obtenerPorCodigo("PROD-B").existenciaActual, 2);
  assert.equal(ventas.obtenerKardex().length, 2);

  // CA-03: Stock insuficiente (quedan 2 de PROD-B, intenta vender 4) y atomicidad intacta en PROD-A
  assert.throws(
    () =>
      ventas.registrarVentaMostrador({
        itemsCarrito: [
          { codigoProducto: "PROD-A", cantidad: 1 },
          { codigoProducto: "PROD-B", cantidad: 4 },
        ],
      }),
    /Stock insuficiente: solo hay 2 unidades disponibles/
  );
  assert.equal(repo.obtenerPorCodigo("PROD-A").existenciaActual, 8);
});

test("HU-09 (KAN-15): Cobro en efectivo con cambio, rechazo por monto menor y tarjeta/transferencia", () => {
  // CA-01: Efectivo con cambio
  const ventaEfectivo = { folioVenta: "VTA-0001", totalVenta: 700, estado: "Pendiente", partidas: [] };
  const cobroEfectivo = registrarPagoVenta({
    venta: ventaEfectivo,
    metodoPago: "Efectivo",
    pagoCon: 1000,
  });
  assert.equal(cobroEfectivo.cambioDevuelto, 300);
  assert.equal(cobroEfectivo.estado, "Pagada");

  // CA-02: Importe menor al total
  const ventaInsuficiente = { folioVenta: "VTA-0002", totalVenta: 700, estado: "Pendiente", partidas: [] };
  assert.throws(
    () =>
      registrarPagoVenta({
        venta: ventaInsuficiente,
        metodoPago: "Efectivo",
        pagoCon: 650,
      }),
    /El importe recibido no cubre el total de la venta \(\$700\.00\)/
  );

  // CA-03: Tarjeta
  const ventaTarjeta = { folioVenta: "VTA-0003", totalVenta: 700, estado: "Pendiente", partidas: [] };
  const cobroTarjeta = registrarPagoVenta({
    venta: ventaTarjeta,
    metodoPago: "Tarjeta",
    referenciaPago: "AUTH-9981",
  });
  assert.equal(cobroTarjeta.pagoCon, 700);
  assert.equal(cobroTarjeta.cambioDevuelto, 0);
});

test("HU-13 (KAN-18): Registro de servicio realizado, cálculo exacto de comisión y mecánico obligatorio", () => {
  const taller = crearServicioTaller();

  // CA-01 y CA-03: $200 * 30% = $60.00 en estado Acreditada
  const orden = taller.registrarServicioRealizado({
    nombreServicio: "Cambio de balatas",
    precioCobrado: 200,
    porcentajeComision: 30,
    mecanicoResponsable: "Juan Pérez",
    pagoConfirmado: true,
  });
  assert.equal(orden.comisionCalculada, 60);
  assert.equal(orden.estadoComision, "Acreditada");

  // CA-02: Sin mecánico responsable
  assert.throws(
    () =>
      taller.registrarServicioRealizado({
        nombreServicio: "Afinación menor",
        precioCobrado: 350,
        porcentajeComision: 25,
        mecanicoResponsable: "",
      }),
    /Debe asignar un trabajador responsable al servicio/
  );
});
