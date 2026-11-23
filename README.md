# Italika POS & Taller — Sistema de Inventario, Ventas y Servicios de Taller

Repositorio oficial del **Equipo 2** para el Proyecto Final de la materia **Calidad de Software** (Grupo 7LMV, ITSON — Dr. Marco Antonio Hernández Aguirre).

## Equipo Scrum (Equipo 2)

| Rol en Scrum | Integrante | ID Institucional |
| :--- | :--- | :--- |
| **Scrum Master (SM)** | Castro Valenzuela, Alejandro | `00000228536` |
| **Product Owner (PO)** | Valenzuela Galaviz, Jesús Alejandro | `00000253267` |
| **Developer** | Valenzuela Moroyoqui, Gustavo Alexis | `205981` |
| **Developer** | Becerra Contreras, Raziel Alberto | `00000216568` |

## Alcance del Sprint 1 (Release 1 — 18 Story Points)

| Clave Jira | Historia | Descripción | SP | Módulo Principal |
| :--- | :--- | :--- | :---: | :--- |
| `KAN-12` | `HU-01` | Registrar productos en inventario | 3 | `src/inventario/productosService.js` |
| `KAN-13` | `HU-02` | Consultar catálogo y disponibilidad por rol | 2 | `src/inventario/productosService.js` |
| `KAN-14` | `HU-08` | Registrar venta de mostrador y descuento atómico de stock | 5 | `src/ventas/ventasService.js` |
| `KAN-15` | `HU-09` | Registrar cobro, método de pago, cambio y comprobante | 3 | `src/cobros/cobrosService.js` |
| `KAN-18` | `HU-13` | Registrar servicio realizado en taller con cálculo de comisión | 5 | `src/taller/serviciosTallerService.js` |

## Convenciones Técnicas y Calidad

- **JavaScript / JSON:** `lowerCamelCase` estricto en variables, propiedades JSON y funciones/métodos (`codigoProducto`, `precioVenta`, `existenciaActual`, `registrarVentaMostrador()`).
- **Constantes:** `UPPER_SNAKE_CASE` (`METODOS_PAGO_VALIDOS`, `ESTADOS_COMISION`).
- **Base de Datos (PostgreSQL):** `snake_case` en tablas y columnas (`db/schema.sql`).
- **Control de Versiones:** Rama `main` protegida e integración mediante ramas `feature/HU-XX-*` con mensajes *Conventional Commits* en español y revisión cruzada conforme al [DoD](docs/DoD.md).

## Ejecución y Pruebas

Requiere Node.js (>= 18), sin dependencias externas:

```bash
# Ejecutar suite de pruebas unitarias e integración (15 criterios de aceptación del Sprint 1)
npm test

# Ejecutar demostración de flujo completo del Sprint 1 en consola (JSON lowerCamelCase)
npm run demo
```
