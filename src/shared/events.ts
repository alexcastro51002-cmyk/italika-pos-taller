export type DomainEvent =
  | {
      type: "VentaRegistrada";
      ventaId: number;
      total: number;
      registradoPor: number;
    }
  | {
      type: "VentaCancelada";
      ventaId: number;
      canceladoPor: number;
      motivo: string;
    }
  | {
      type: "PagoRegistrado";
      ventaId: number;
      pagoId: number;
      monto: number;
      liquidada: boolean;
    }
  | { type: "PagoReembolsado"; ventaId: number; pagoId: number; monto: number }
  | {
      type: "ServicioRealizado";
      ventaId: number;
      ventaDetalleId: number;
      trabajadorId: number | null;
    };

export type DomainEventHandler<T extends DomainEvent["type"]> = (
  event: Extract<DomainEvent, { type: T }>,
) => void;

export class DomainEventBus {
  private readonly handlers = new Map<
    DomainEvent["type"],
    Array<(event: DomainEvent) => void>
  >();

  on<T extends DomainEvent["type"]>(
    type: T,
    handler: DomainEventHandler<T>,
  ): void {
    const existing = this.handlers.get(type) ?? [];
    existing.push(handler as (event: DomainEvent) => void);
    this.handlers.set(type, existing);
  }

  emit(event: DomainEvent): void {
    const list = this.handlers.get(event.type);
    if (!list) return;
    for (const handler of list) {
      handler(event);
    }
  }
}
