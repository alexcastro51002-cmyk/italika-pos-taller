# Definition of Done (DoD) — Proyecto Italika POS & Taller

Criterios mínimos que toda Historia de Usuario (`HU`) debe satisfacer antes de pasar a la columna **Terminado** en Jira (`KAN`):

1. **Requerimiento y aceptación:** Vinculada a su ticket Jira (`KAN-XX`) y cumpliendo los 3 criterios de aceptación *Dado / Cuando / Entonces* del Avance 1.
2. **Convenciones de código:** Identificadores JavaScript y contratos JSON en `lowerCamelCase`, constantes en `UPPER_SNAKE_CASE` y tablas/columnas PostgreSQL en `snake_case`.
3. **Idioma y formato:** Código fuente, documentación y mensajes de validación en español; indentación consistente de 2 espacios, UTF-8 y finales de línea `LF`.
4. **Validación de datos y negocio:** Precios de compra > 0, `precioVenta >= precioCompra`, existencias >= 0 sin stock negativo, `pagoCon >= totalVenta` y asignación obligatoria de mecánico en taller.
5. **Pruebas:** Pruebas unitarias y de casos límite/error ejecutadas y aprobadas al 100 % mediante `npm test` (`node --test`).
6. **Versionado y Pull Request:** Desarrollo en rama `feature/HU-XX-*`, *commits* descriptivos en español (*Conventional Commits*) e integración a `main` previa revisión por al menos un integrante distinto del autor.
7. **Aceptación:** Incremento validado por el Product Owner frente a los criterios de aceptación.
