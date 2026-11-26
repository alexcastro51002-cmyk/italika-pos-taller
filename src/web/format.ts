export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(value);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}
