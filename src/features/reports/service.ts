import type { ReportsRepository } from "./repo.js";
import type { ReportQuery, ReportType } from "./schema.js";

function escapeCsvCell(value: string | number | null | undefined): string {
  const str = String(value ?? "");
  return `"${str.replaceAll('"', '""')}"`;
}

function buildCsv(
  headers: string[],
  rows: Array<Array<string | number | null | undefined>>,
): string {
  const lines = [
    headers.map(escapeCsvCell).join(","),
    ...rows.map((r) => r.map(escapeCsvCell).join(",")),
  ];
  return `\ufeff${lines.join("\n")}`;
}

export class ReportsService {
  constructor(private readonly repo: ReportsRepository) {}

  getSalesReport(query: ReportQuery) {
    return this.repo.getSalesReport(query);
  }

  getServicesReport(query: ReportQuery) {
    return this.repo.getServicesReport(query);
  }

  getIncomeReport(query: ReportQuery) {
    return this.repo.getIncomeReport(query);
  }

  getCommissionsReport(query: ReportQuery) {
    return this.repo.getCommissionsReport(query);
  }

  exportCsv(
    type: ReportType,
    query: ReportQuery,
  ): { filename: string; content: string } {
    if (type === "sales") {
      const data = this.repo.getSalesReport(query);
      return {
        filename: "reporte_ventas_svas.csv",
        content: buildCsv(
          [
            "Folio",
            "Fecha",
            "Cliente",
            "Servicios",
            "Trabajadores",
            "Responsable",
            "Total",
            "Estado",
          ],
          data.detalleVentas.map((r) => [
            r.folio,
            r.fechaVenta,
            r.clienteNombre ?? "Público general",
            r.servicios,
            r.trabajadores,
            r.responsableNombre,
            r.total.toFixed(2),
            r.estadoVenta,
          ]),
        ),
      };
    }

    if (type === "services") {
      const data = this.repo.getServicesReport(query);
      return {
        filename: "reporte_servicios_svas.csv",
        content: buildCsv(
          [
            "Folio",
            "Fecha Venta",
            "Fecha Realización",
            "Servicio",
            "Trabajador",
            "Cliente",
            "Precio",
          ],
          data.detalle.map((r) => [
            r.folio,
            r.fechaVenta,
            r.fechaRealizacion ?? "",
            r.servicioNombre,
            r.trabajadorNombre ?? "Sin asignar",
            r.clienteNombre ?? "Público general",
            r.precioAplicado.toFixed(2),
          ]),
        ),
      };
    }

    if (type === "income") {
      const data = this.repo.getIncomeReport(query);
      return {
        filename: "reporte_ingresos_svas.csv",
        content: buildCsv(
          [
            "Folio",
            "Cliente",
            "Fecha Pago",
            "Tipo",
            "Método",
            "Monto",
            "Registró",
          ],
          data.movimientos.map((m) => [
            m.folio,
            m.clienteNombre ?? "Público general",
            m.fechaPago,
            m.tipo,
            m.metodoPago,
            m.monto.toFixed(2),
            m.registradoPorNombre,
          ]),
        ),
      };
    }

    const data = this.repo.getCommissionsReport(query);
    return {
      filename: "reporte_comisiones_svas.csv",
      content: buildCsv(
        [
          "Tipo Beneficiario",
          "Beneficiario",
          "Folio",
          "Fecha Venta",
          "Servicio",
          "Base",
          "Porcentaje",
          "Movimiento",
          "Monto",
        ],
        data.movimientos.map((m) => [
          m.beneficiarioTipo,
          m.beneficiarioNombre,
          m.folio,
          m.fechaVenta,
          m.servicioNombre ?? "Venta completa",
          m.baseElegible.toFixed(2),
          `${m.porcentajeAplicado}%`,
          m.tipoMovimiento,
          m.monto.toFixed(2),
        ]),
      ),
    };
  }
}
