# Recorrido automatizado de la defensa (escenarios 1 a 7 y 11)

Ejecutan por REST, contra el
entorno real, los escenarios de la consigna §5 que no dependen del sitio web, y dicen PASS/FAIL con la evidencia mínima.
Los escenarios 8, 9 y 10 se ensayan a mano: `informe/checklist-manual.md`.

## Requisitos

- Entorno levantado según el `README.md` de la raíz (pasos 1 a 5): contenedores arriba con el JAR actual, usuarios y BD creados.
- Node.js 18 o más (usa `fetch`), Java 11 o más y Maven (para el classpath de dependencias y `target/classes`: correr antes `mvn package -DskipTests`).
- Puerto SMTP libre (25, o el de `SMTP_PORT`; en Linux usar uno >1024, p. ej. 2525, igual que en `docker compose up`): el script abre un SMTP de prueba para verificar los correos (si no puede, omite sólo esas verificaciones; cerrar DevNullSmtp antes).
- Sin otras instancias activas de `Process_Curso` que no sean de la prueba: el script las **borra** (cuentan para el límite de 5).

## Uso (desde la raíz del repo)

```
node scripts/escenarios/m-escenarios.js                 # todos: 1 a 7 y 11 (tarda unos 4 minutos; 8 de 8 PASS al 2026-11-04)
node scripts/escenarios/m-escenarios.js --solo=3,5      # algunos
node scripts/escenarios/m-escenarios.js --conservar     # no borra el modelo desplegado al terminar
node scripts/escenarios/m-limpiar-instancias.js         # borra las instancias activas de Process_Curso
node scripts/escenarios/m-aceptacion-sin-fecha.js       # reproduce el 500 de "Aceptación" sin fechaCurso
```

- Despliega la DMN y el modelo, corre los escenarios y, al final, deja en Flowable **sólo "Demo processes"** (borra los
  despliegues de `Process_Curso` y de la DMN). Con `--conservar` no lo hace. Después hay que volver a desplegar
  (`scripts/desplegar-modelo`) para usar el modelo a mano.
- Código de salida 0 si todo PASS, 1 si algo falla.
- **El log se guarda solo**, igual en Windows y Ubuntu (no hace falta redirigir nada): `scripts/escenarios/resultados/<script>.log`, por ejemplo `m-escenarios.log`. Se reescribe en cada corrida. La carpeta no se versiona; `classpath.txt` también queda ahí.
- **Cómo leer el log:** las líneas `✔`/`✘` son las verificaciones; el bloque `RESUMEN` del final dice PASS/FAIL por escenario.
- Escenario 11: usa el simulador CLI real (`SimuladorMain`, entrada estándar guionada) y `ServicioTareas` de la app Swing a
  través de `m-MaterialesApiJava.java` (sin interfaz). Variable opcional `M_CP_EXTRA`: JARs extra para ese lanzador
  (diagnóstico; ya no hace falta).
