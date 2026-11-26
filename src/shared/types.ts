export type Role = "ADMIN" | "SECRETARIA" | "TRABAJADOR";

export type Permission =
  | "catalog:read"
  | "catalog:write"
  | "catalog:price"
  | "sales:read"
  | "sales:create"
  | "sales:cancel"
  | "payments:read"
  | "payments:create"
  | "payments:history"
  | "work:read_all"
  | "work:read_own"
  | "work:update"
  | "work:confirm"
  | "commissions:config"
  | "commissions:read_all"
  | "commissions:read_own"
  | "reports:read"
  | "reports:export"
  | "users:manage";

export type SaleStatus = "VIGENTE" | "CANCELADA";
export type PaymentStatus = "PENDIENTE" | "PARCIALMENTE_PAGADA" | "LIQUIDADA";
export type ServiceExecutionStatus =
  | "PENDIENTE"
  | "PROGRAMADO"
  | "EN_PROCESO"
  | "REALIZADO"
  | "CANCELADO";

export type PaymentMethod = "EFECTIVO" | "TRANSFERENCIA" | "TARJETA" | "OTRO";
export type CommissionTrigger = "AL_VENDER" | "AL_REALIZAR" | "AL_LIQUIDAR";
export type CommissionBase = "BRUTO" | "NETO_POST_DESCUENTO" | "COBRADO_REAL";

export const DEFAULT_ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  ADMIN: [
    "catalog:read",
    "catalog:write",
    "catalog:price",
    "sales:read",
    "sales:create",
    "sales:cancel",
    "payments:read",
    "payments:create",
    "payments:history",
    "work:read_all",
    "work:update",
    "work:confirm",
    "commissions:config",
    "commissions:read_all",
    "reports:read",
    "reports:export",
    "users:manage",
  ],
  SECRETARIA: [
    "catalog:read",
    "sales:read",
    "sales:create",
    "payments:read",
    "payments:create",
    "work:read_all",
    "work:update",
    "commissions:read_own",
  ],
  TRABAJADOR: ["work:read_own", "work:confirm", "commissions:read_own"],
};

export interface AuthUser {
  id: number;
  nombre: string;
  email: string;
  rol: Role;
  permisos: Permission[];
  trabajadorId: number | null;
}

export interface UserDTO {
  id: number;
  nombre: string;
  email: string;
  rol: Role;
  permisosExtra: Permission[];
  permisosEfectivos: Permission[];
  trabajadorId: number | null;
  activo: boolean;
  creadoEn: string;
}

export interface ServiceDTO {
  id: number;
  nombre: string;
  descripcion: string;
  precioBase: number;
  duracionMin: number;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

export function resolveEffectivePermissions(
  rol: Role,
  extraPermissions: readonly Permission[],
): Permission[] {
  const merged = new Set<Permission>([
    ...DEFAULT_ROLE_PERMISSIONS[rol],
    ...extraPermissions,
  ]);
  return [...merged];
}

export interface WorkerDTO {
  id: number;
  usuarioId: number | null;
  nombre: string;
  telefono: string;
  activo: boolean;
}

export interface ClientDTO {
  id: number;
  nombre: string;
  telefono: string;
  correo: string;
}

export interface SaleDetailDTO {
  id: number;
  ventaId: number;
  servicioId: number;
  servicioNombre: string;
  precioAplicado: number;
  trabajadorId: number | null;
  trabajadorNombre: string | null;
  fechaProgramada: string | null;
  estadoServicio: ServiceExecutionStatus;
  fechaRealizacion: string | null;
}

export interface SaleDTO {
  id: number;
  folio: string;
  clienteId: number | null;
  clienteNombre: string | null;
  registradoPor: number;
  registradoPorNombre: string;
  fechaVenta: string;
  subtotal: number;
  descuentoAutorizado: number;
  total: number;
  pagado: number;
  saldoPendiente: number;
  estadoVenta: SaleStatus;
  estadoPago: PaymentStatus;
  motivoCancelacion: string | null;
  canceladoEn: string | null;
  detalles: SaleDetailDTO[];
}

export interface PaymentDTO {
  id: number;
  ventaId: number;
  monto: number;
  tipo: "PAGO" | "REEMBOLSO";
  metodoPago: PaymentMethod;
  fechaPago: string;
  registradoPor: number;
  registradoPorNombre: string;
}

export interface PaymentAccountSummaryDTO {
  ventaId: number;
  folio: string;
  fechaVenta: string;
  clienteNombre: string | null;
  total: number;
  pagado: number;
  saldoPendiente: number;
  estadoVenta: SaleStatus;
  estadoPago: PaymentStatus;
}

export interface ReceiptDTO {
  folio: string;
  fechaVenta: string;
  clienteNombre: string;
  registradoPorNombre: string;
  estadoVenta: SaleStatus;
  subtotal: number;
  descuentoAutorizado: number;
  total: number;
  pagado: number;
  saldoPendiente: number;
  estadoPago: PaymentStatus;
  servicios: Array<{
    servicioNombre: string;
    trabajadorNombre: string | null;
    precioAplicado: number;
    fechaProgramada: string | null;
    estadoServicio: ServiceExecutionStatus;
  }>;
  pagos: PaymentDTO[];
}

export interface WorkOrderDTO {
  id: number;
  ventaId: number;
  folio: string;
  fechaVenta: string;
  estadoVenta: SaleStatus;
  clienteNombre: string | null;
  servicioId: number;
  servicioNombre: string;
  precioAplicado: number;
  trabajadorId: number | null;
  trabajadorNombre: string | null;
  fechaProgramada: string | null;
  estadoServicio: ServiceExecutionStatus;
  fechaRealizacion: string | null;
}

export interface WorkOrderSummaryDTO {
  total: number;
  pendientes: number;
  programados: number;
  enProceso: number;
  realizados: number;
  cancelados: number;
}

export interface CommissionConfigDTO {
  disparadorTrabajador: CommissionTrigger;
  disparadorSecretaria: CommissionTrigger;
  baseElegible: CommissionBase;
  secSoloVentasPropias: boolean;
  tasaTrabajadorGlobal: number;
  tasaSecretariaGlobal: number;
}

export interface CommissionRuleDTO {
  id: number;
  trabajadorId: number | null;
  trabajadorNombre: string | null;
  servicioId: number | null;
  servicioNombre: string | null;
  porcentaje: number;
  activo: boolean;
}

export interface CommissionMovementDTO {
  id: number;
  beneficiarioTipo: "TRABAJADOR" | "SECRETARIA";
  beneficiarioId: number;
  beneficiarioNombre: string;
  ventaId: number;
  folio: string;
  fechaVenta: string;
  ventaDetalleId: number | null;
  servicioNombre: string | null;
  baseElegible: number;
  porcentajeAplicado: number;
  monto: number;
  tipoMovimiento: "DEVENGADA" | "AJUSTE_CANCELACION" | "AJUSTE_REEMBOLSO";
  fechaRegistro: string;
}

export interface CommissionSummaryDTO {
  beneficiarioTipo: "TRABAJADOR" | "SECRETARIA";
  beneficiarioId: number;
  beneficiarioNombre: string;
  devengado: number;
  ajustes: number;
  neto: number;
  operaciones: number;
}

export interface SalesReportDTO {
  groupBy: "day" | "week" | "month";
  totales: {
    ventasVigentes: number;
    ventasCanceladas: number;
    subtotal: number;
    descuentos: number;
    totalVendido: number;
  };
  periodos: Array<{
    periodo: string;
    cantidad: number;
    subtotal: number;
    descuentos: number;
    total: number;
  }>;
  porServicio: Array<{
    servicioNombre: string;
    cantidad: number;
    totalVendido: number;
  }>;
  detalleVentas: Array<{
    folio: string;
    fechaVenta: string;
    clienteNombre: string | null;
    servicios: string;
    trabajadores: string;
    responsableNombre: string;
    total: number;
    estadoVenta: SaleStatus;
  }>;
}

export interface ServicesReportDTO {
  totalRealizados: number;
  porTrabajador: Array<{
    trabajadorId: number | null;
    trabajadorNombre: string;
    cantidad: number;
    importeServicios: number;
  }>;
  detalle: WorkOrderDTO[];
}

export interface IncomeReportDTO {
  totales: {
    totalVendidoVigente: number;
    totalCobradoNeto: number;
    saldoPendienteTotal: number;
  };
  porMetodo: Array<{
    metodoPago: PaymentMethod;
    cobrado: number;
    reembolsado: number;
    neto: number;
    movimientos: number;
  }>;
  movimientos: Array<{
    id: number;
    folio: string;
    clienteNombre: string | null;
    fechaPago: string;
    tipo: "PAGO" | "REEMBOLSO";
    metodoPago: PaymentMethod;
    monto: number;
    registradoPorNombre: string;
  }>;
}

export interface CommissionsReportDTO {
  totales: {
    trabajadoresNeto: number;
    secretariaNeto: number;
    totalGeneral: number;
  };
  trabajadores: CommissionSummaryDTO[];
  secretaria: CommissionSummaryDTO[];
  movimientos: CommissionMovementDTO[];
}
