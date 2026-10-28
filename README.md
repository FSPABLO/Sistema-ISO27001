# Controles ISO/IEC 27001:2022 para la confidencialidad en Oracle

Proyecto del curso EIF402 Administración de Bases de Datos (UNA Costa Rica).

- `laboratorio/`: base Oracle en Docker, scripts de preparación, implementación (I01 a I11) y verificación (V00 a V12), con la evidencia antes y después (27 pruebas).
- `sistema/`: sistema web de auditoría (Node.js, Express, Docker) que ejecuta 39 pruebas sobre 18 controles, pondera por riesgo y recomienda qué resolver primero. Ver `sistema/README.md`.

Todos los datos son ficticios. Las claves de `laboratorio/scripts/comun/config.sql` son de prueba.
