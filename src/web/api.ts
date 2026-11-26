import type {
  AuthUser,
  ClientDTO,
  CommissionConfigDTO,
  CommissionMovementDTO,
  CommissionRuleDTO,
  CommissionSummaryDTO,
  CommissionsReportDTO,
  IncomeReportDTO,
  PaymentAccountSummaryDTO,
  PaymentDTO,
  PaymentMethod,
  Permission,
  ReceiptDTO,
  Role,
  SaleDTO,
  SalesReportDTO,
  ServiceDTO,
  ServiceExecutionStatus,
  ServicesReportDTO,
  UserDTO,
  WorkOrderDTO,
  WorkOrderSummaryDTO,
  WorkerDTO,
} from "../shared/types.js";

export interface ApiErrorBody {
  error?: string;
  message?: string;
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  token?: string | null,
): Promise<T> {
  const headers = new Headers(options.headers);
  if (options.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (token) {
    headers.set("authorization", `Bearer ${token}`);
  }
  const res = await fetch(`/api${path}`, { ...options, headers });
  const data = (await res.json()) as T & ApiErrorBody;
  if (!res.ok) {
    throw new Error(data.message ?? `Error HTTP ${res.status}`);
  }
  return data;
}

export function login(email: string, password: string) {
  return request<{ token: string; user: AuthUser }>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export function fetchMe(token: string) {
  return request<{ user: AuthUser }>("/auth/me", {}, token);
}

// Catalog (M1)
export function listServices(
  token: string,
  q = "",
  active: "all" | "true" | "false" = "all",
) {
  const params = new URLSearchParams({ q, active });
  return request<{ services: ServiceDTO[] }>(
    `/services?${params.toString()}`,
    {},
    token,
  );
}

export function createService(
  token: string,
  payload: {
    nombre: string;
    descripcion: string;
    precioBase: number;
    duracionMin: number;
  },
) {
  return request<{ service: ServiceDTO }>(
    "/services",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function updateService(
  token: string,
  id: number,
  payload: {
    nombre: string;
    descripcion: string;
    precioBase: number;
    duracionMin: number;
  },
) {
  return request<{ service: ServiceDTO }>(
    `/services/${id}`,
    { method: "PUT", body: JSON.stringify(payload) },
    token,
  );
}

export function setServiceStatus(token: string, id: number, activo: boolean) {
  return request<{ service: ServiceDTO }>(
    `/services/${id}/status`,
    { method: "PATCH", body: JSON.stringify({ activo }) },
    token,
  );
}

// Users (M0)
export function listUsers(token: string) {
  return request<{ users: UserDTO[] }>("/users", {}, token);
}

export function createUser(
  token: string,
  payload: {
    nombre: string;
    email: string;
    password: string;
    rol: Role;
    telefono: string;
  },
) {
  return request<{ user: UserDTO }>(
    "/users",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function updateUserPermissions(
  token: string,
  id: number,
  payload: { rol?: Role; permisosExtra?: Permission[]; activo?: boolean },
) {
  return request<{ user: UserDTO }>(
    `/users/${id}/permissions`,
    { method: "PATCH", body: JSON.stringify(payload) },
    token,
  );
}

// Sales, Workers, Clients (M2)
export function listWorkers(token: string) {
  return request<{ workers: WorkerDTO[] }>("/workers", {}, token);
}

export function listClients(token: string) {
  return request<{ clients: ClientDTO[] }>("/clients", {}, token);
}

export function listSales(
  token: string,
  filters: {
    q?: string;
    from?: string;
    to?: string;
    workerId?: string;
    status?: string;
  } = {},
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return request<{ sales: SaleDTO[] }>(
    qs ? `/sales?${qs}` : "/sales",
    {},
    token,
  );
}

export function createSale(
  token: string,
  payload: {
    clienteId?: number | null;
    clienteNombre?: string;
    clienteTelefono?: string;
    fechaVenta?: string;
    descuentoAutorizado: number;
    items: Array<{
      servicioId: number;
      trabajadorId: number | null;
      fechaProgramada: string | null;
    }>;
  },
) {
  return request<{ sale: SaleDTO }>(
    "/sales",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function cancelSale(token: string, saleId: number, motivo: string) {
  return request<{ sale: SaleDTO }>(
    `/sales/${saleId}/cancel`,
    { method: "POST", body: JSON.stringify({ motivo }) },
    token,
  );
}

// Payments (M3)
export function listPaymentSummaries(token: string) {
  return request<{ summaries: PaymentAccountSummaryDTO[] }>(
    "/payments/summary",
    {},
    token,
  );
}

export function listSalePayments(token: string, ventaId: number) {
  return request<{ payments: PaymentDTO[] }>(
    `/sales/${ventaId}/payments`,
    {},
    token,
  );
}

export function registerPayment(
  token: string,
  ventaId: number,
  payload: { monto: number; metodoPago: PaymentMethod; fechaPago?: string },
) {
  return request<{ payment: PaymentDTO; account: PaymentAccountSummaryDTO }>(
    `/sales/${ventaId}/payments`,
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function registerRefund(
  token: string,
  ventaId: number,
  payload: { monto: number; metodoPago: PaymentMethod; fechaPago?: string },
) {
  return request<{ refund: PaymentDTO; account: PaymentAccountSummaryDTO }>(
    `/sales/${ventaId}/refunds`,
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function getReceipt(token: string, ventaId: number) {
  return request<{ receipt: ReceiptDTO }>(
    `/sales/${ventaId}/receipt`,
    {},
    token,
  );
}

// Work orders (M4)
export function listWorkOrders(
  token: string,
  filters: {
    workerId?: string;
    status?: string;
    from?: string;
    to?: string;
  } = {},
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return request<{ orders: WorkOrderDTO[]; summary: WorkOrderSummaryDTO }>(
    qs ? `/work-orders?${qs}` : "/work-orders",
    {},
    token,
  );
}

export function updateWorkOrderStatus(
  token: string,
  detailId: number,
  estado: ServiceExecutionStatus,
) {
  return request<{ order: WorkOrderDTO }>(
    `/work-orders/${detailId}/status`,
    { method: "PATCH", body: JSON.stringify({ estado }) },
    token,
  );
}

// Commissions (M5/M6)
export function getCommissionConfig(token: string) {
  return request<{
    config: CommissionConfigDTO;
    rules: CommissionRuleDTO[];
  }>("/commissions/config", {}, token);
}

export function updateCommissionConfig(
  token: string,
  payload: CommissionConfigDTO,
) {
  return request<{ config: CommissionConfigDTO }>(
    "/commissions/config",
    { method: "PUT", body: JSON.stringify(payload) },
    token,
  );
}

export function createCommissionRule(
  token: string,
  payload: {
    trabajadorId: number | null;
    servicioId: number | null;
    porcentaje: number;
  },
) {
  return request<{ rule: CommissionRuleDTO }>(
    "/commissions/rules",
    { method: "POST", body: JSON.stringify(payload) },
    token,
  );
}

export function deleteCommissionRule(token: string, id: number) {
  return request<{ deleted: boolean }>(
    `/commissions/rules/${id}`,
    { method: "DELETE" },
    token,
  );
}

export function listCommissions(
  token: string,
  filters: {
    beneficiaryType?: string;
    workerId?: string;
    from?: string;
    to?: string;
  } = {},
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const qs = params.toString();
  return request<{
    movements: CommissionMovementDTO[];
    summaries: CommissionSummaryDTO[];
    totals: {
      trabajadoresNeto: number;
      secretariaNeto: number;
      totalGeneral: number;
    };
  }>(qs ? `/commissions?${qs}` : "/commissions", {}, token);
}

// Reports (M7)
export function getSalesReport(
  token: string,
  filters: {
    groupBy?: string;
    from?: string;
    to?: string;
    workerId?: string;
  } = {},
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  return request<{ report: SalesReportDTO }>(
    `/reports/sales?${params.toString()}`,
    {},
    token,
  );
}

export function getServicesReport(
  token: string,
  filters: { from?: string; to?: string; workerId?: string } = {},
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  return request<{ report: ServicesReportDTO }>(
    `/reports/services?${params.toString()}`,
    {},
    token,
  );
}

export function getIncomeReport(
  token: string,
  filters: { from?: string; to?: string; workerId?: string } = {},
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  return request<{ report: IncomeReportDTO }>(
    `/reports/income?${params.toString()}`,
    {},
    token,
  );
}

export function getCommissionsReport(
  token: string,
  filters: { from?: string; to?: string; workerId?: string } = {},
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  return request<{ report: CommissionsReportDTO }>(
    `/reports/commissions?${params.toString()}`,
    {},
    token,
  );
}

export async function downloadReportCsv(
  token: string,
  type: "sales" | "services" | "income" | "commissions",
  filters: {
    groupBy?: string;
    from?: string;
    to?: string;
    workerId?: string;
  } = {},
) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v) params.set(k, v);
  }
  const res = await fetch(`/api/reports/${type}/export?${params.toString()}`, {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    throw new Error(`No se pudo exportar (${res.status}).`);
  }
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `reporte_${type}_svas.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
