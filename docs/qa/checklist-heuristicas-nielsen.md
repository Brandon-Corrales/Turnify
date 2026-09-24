# QA: Checklist manual de heurísticas de Nielsen sobre el frontend real

Tarjeta de Trello: **"QA: Checklist manual de heurísticas de Nielsen sobre el
frontend real"**. Verificado contra la app real corriendo en esta máquina
(frontend `http://localhost:5173`, backend `http://localhost:3000`
conectado al **Supabase compartido del equipo**, no una base local), con
Chrome real vía automatización — no es una revisión de código.

**Cuenta usada**: negocio de QA propio ("QA Brenda - Salón de Belleza",
`salon_belleza`, Plan Gratis, admin `brendaespinozamatarrita252@gmail.com`)
creado específicamente para esta sesión — nunca se usó
`admin@turnify.app`, según la regla del equipo de no pisar el negocio demo
compartido.

**Pantallas cubiertas**: Landing pública, Login, Dashboard, Servicios,
Clientes, Configuración (horario + link público), Calendario, Reservas
(admin), Notificaciones, Reportes, Suscripción, Wizard de reserva pública
(4 pasos completos, reserva real creada), y el widget de chatbot (1
mensaje, para no gastar el cupo diario del negocio).

---

## 1. Visibilidad del estado del sistema

**Verificado en**: Dashboard (KPIs con stagger de entrada), Calendario
("Actualizando..." mientras refetch), Servicios/Clientes (skeletons +
toast al crear), Login (spinner en el botón durante el submit), Wizard
público (skeletons en cada paso, spinner en "Confirmar reserva"),
chatbot (mensaje de "no disponible" en vez de colgarse).

**Evidencia concreta**:
- Crear un servicio real disparó un toast "Servicio creado" visible de
  inmediato y la tarjeta apareció en la grilla sin recargar la página.
- El botón "Iniciar sesión" mostró un spinner inline mientras la request
  estaba en vuelo, y volvió a su estado normal al resolver.
- El Calendario mostró el texto "Actualizando…" mientras refrescaba datos,
  en vez de quedar en blanco o bloqueado (comportamiento ya documentado en
  sesiones previas de QA, reverificado aquí de nuevo con datos reales).

**Veredicto**: **Cumple.**

---

## 2. Coincidencia entre el sistema y el mundo real

**Verificado en**: navegación completa (Calendario, Clientes, Servicios,
Reservas — vocabulario de negocio en español, no jerga técnica), wizard
público (nombre del negocio real "QA Brenda - Salón de Belleza" en el
encabezado, nunca "Turnify" hardcodeado en pantalla orientada al
cliente), catálogo de plantillas de `salon_belleza` con nombres reales del
rubro.

**Evidencia concreta**: el encabezado del wizard público mostró literal
"Reservar en QA Brenda - Salón de Belleza" — confirma que el nombre del
negocio (no el de la plataforma) es lo que ve el cliente final, tal como
exige el punto 2 del brief.

**Veredicto**: **Cumple.**

---

## 3. Control y libertad del usuario

**Verificado en**: wizard público (paso "Confirma tu reserva" antes de
comprometerse, cancelar una reserva desde el Calendario con
`ConfirmDialog`), Login/Registro (volver, recuperar sesión), formularios
con botón "Cancelar" en todos los modales de creación.

**Evidencia concreta**: el wizard deja revisar servicio/horario/datos
completos en una pantalla de confirmación antes del `POST` real, y solo
después de "Confirmar reserva" se compromete el cambio — el usuario puede
abandonar en cualquier paso anterior sin costo.

**Veredicto**: **Cumple.**

---

## 4. Consistencia y estándares

**Verificado en**: convención de foco verde/azul (crear vs. editar) en
Servicios/Clientes, mismo componente Toast/Modal en todas las pantallas,
mismo patrón de badges de estado, **y cruce de una misma reserva across
pantallas (Calendario vs. Reservas admin vs. wizard público vs. base de
datos cruda)**.

**Veredicto**: **Cumple parcialmente — hallazgo real de alta prioridad.**

### Hallazgo #1 (alta prioridad): el Calendario muestra la hora de una reserva en la zona horaria del navegador, no en la hora fija de Costa Rica que usa el resto del sistema

Se creó una reserva real vía el wizard público para el **lunes 28 de
septiembre, 10:00 a.m.** (hora de Costa Rica, elegida explícitamente en el
selector de horarios). Se verificó el mismo dato en cuatro lugares:

| Fuente | Hora mostrada |
|---|---|
| Pantalla de confirmación del wizard público | **10:00 a. m.** |
| `GET /reservas` (dato crudo): `fechaHoraInicio` | `2026-09-28T16:00:00.000Z` (= 10:00 a. m. CR, UTC-6) |
| Pantalla **Reservas** (admin, lista) | **10:00 a. m.** ✅ |
| Modal "Detalle de la reserva" del **Calendario** | **9:00 a. m.** ❌ |

El navegador de esta sesión de prueba tiene el huso horario del sistema
operativo en `America/Los_Angeles` (UTC-7 en esta fecha, confirmado con
`Intl.DateTimeFormat().resolvedOptions().timeZone`), y `16:00 UTC - 7h =
09:00` — coincide exactamente con lo que muestra el Calendario. Esto
confirma que **el componente de Calendario (FullCalendar) está
renderizando la hora del evento con el huso horario local del navegador
del admin**, mientras que el resto del sistema (el propio wizard, la
pantalla de Reservas, las validaciones de disponibilidad del backend)
usa consistentemente el offset fijo de Costa Rica (UTC-6) documentado en
`PROGRESS.md` (`zona-horaria-negocio.ts`).

**Impacto real**: cualquier admin/empleado que abra Turnify desde un
dispositivo cuyo huso horario del sistema operativo no sea Costa Rica —
un escenario realista (viaje, laptop mal configurada, trabajo remoto) —
verá en el Calendario una hora distinta a la que el cliente confirmó y a
la que el resto de la app (incluida la pantalla de Reservas) muestra para
la MISMA reserva. Esto puede causar que el negocio atienda al cliente a
la hora equivocada.

**Causa probable**: FullCalendar interpreta y formatea timestamps en el
huso horario del navegador por defecto salvo que se le pase una opción
explícita de `timeZone` (o se le entreguen los eventos ya normalizados a
hora de Costa Rica). El resto de la app usa la utilidad
`zona-horaria-negocio.ts` para esto; el Calendario parece ser el único
punto que no la usa.

### Hallazgo #2 (prioridad media): el gráfico "Reservas por día" de Reportes muestra la fecha un día antes cuando el navegador está detrás de UTC

`GET /reportes/resumen` devuelve correctamente
`reservasPorDia: [{"fecha":"2026-09-28","cantidad":1}]` (fecha-only, sin
hora, verificado directo contra la API). El gráfico de barras de
`ReportesPage`, sin embargo, etiquetó el eje X de ese punto como **"27
sept"**, no "28 sept".

**Causa probable**: al construir `new Date("2026-09-28")` en JavaScript,
el string se interpreta como **medianoche UTC**
(`2026-09-28T00:00:00.000Z`); si luego se formatea con
`toLocaleDateString`/`Intl.DateTimeFormat` sin fijar `timeZone: 'UTC'`,
el navegador la convierte a su huso horario local, restando horas y
empujando la fecha al día anterior. **Esto no es exclusivo del entorno de
pruebas**: como Costa Rica también está detrás de UTC (UTC-6), un admin
real usando Turnify desde Costa Rica reproduciría el mismo corrimiento de
un día si el código de formateo tiene este patrón — a diferencia del
Hallazgo #1, que depende de que el navegador esté en OTRO huso horario
distinto al de CR.

**Veredicto de la heurística**: los dos hallazgos anteriores son
inconsistencias reales de hora/fecha entre pantallas que muestran el
mismo dato — quedan pendientes de arreglo, el resto de la app es
consistente.

### Actualización — Hallazgos #1 y #2 arreglados y reverificados

- **Hallazgo #2 (Reportes)**: `formatearDiaCorto` en `ReportesPage.tsx`
  ahora fija `timeZone: 'UTC'` al formatear una fecha-sin-hora del
  backend. El mismo patrón exacto (mismo bug, mismo fix) se encontró
  también en el tooltip del gráfico "Reservas por día" del **Dashboard**
  (`InicioPage.tsx`), no reportado antes porque el checklist original no
  cubrió esa pantalla — corregido ahí también. Reverificado en Chrome
  real contra la misma reserva: el eje de Reportes y el tooltip del
  Dashboard ahora muestran "28 sept" en vez de "27 sept".
- **Hallazgo #1 (Calendario, modal de detalle)**: el `toLocaleString` del
  modal "Detalle de la reserva" en `CalendarioPage.tsx` ahora fija
  `timeZone: 'America/Costa_Rica'`. Reverificado en Chrome real: la misma
  reserva (10:00 a.m. CR) ahora muestra "28 sept 2026, 10:00 a. m." en el
  modal, en un navegador con huso horario `America/Los_Angeles`.

**Nuevo hallazgo encontrado al reverificar (no incluido en el arreglo
anterior)**: el propio **componente `<FullCalendar>`** — el número de
hora que antecede al título del evento dentro de la celda del mes (ej.
"**9** Cliente Prueba Nielsen") — sigue mostrando la hora en el huso
horario del navegador, no en la hora de Costa Rica, incluso después del
fix del modal. Esto confirma que el "causa probable" original era
correcto: FullCalendar renderiza tiempos en el huso horario local del
navegador por defecto, y el fix del modal (un `toLocaleString` aparte)
no toca ese renderizado interno. Arreglarlo de forma robusta requiere
pasarle a `<FullCalendar timeZone="...">` un huso horario fijo real
(vía el plugin oficial `@fullcalendar/moment-timezone`, ya que sin un
plugin el componente solo soporta `'local'` o `'UTC'` nativamente) y
ajustar en consecuencia los tres puntos donde el código ya interpreta
fechas del propio calendario (el feed de eventos, `dateClick` para crear
una reserva manual, y `eventDrop` para reprogramar por arrastre) — un
cambio más grande y con más superficie de riesgo que los dos anteriores
(nueva dependencia + tres puntos de conversión a ajustar en conjunto),
que se deja anotado como seguimiento en vez de aplicarse apurado dentro
de esta misma corrección.

---

## 5. Prevención de errores

**Verificado en**: validación en tiempo real de todos los formularios
probados (Servicios, Clientes, Login), campos obligatorios marcados con
asterisco rojo, botones deshabilitados hasta que el formulario es válido
(wizard: "Siguiente" deshabilitado sin horario elegido; Login: mensajes
antes de tocar la red).

**Evidencia concreta**: en el modal "Nuevo servicio", enviar el formulario
vacío mostró de inmediato "Mínimo 2 caracteres" bajo Nombre y "Debe ser
mayor a 0" bajo Precio, con ambos campos en borde rojo — sin llegar a
pegarle al backend.

**Veredicto**: **Cumple.**

---

## 6. Reconocer antes que recordar

**Verificado en**: wizard público (cada paso repite el servicio/horario ya
elegido en el título — "Elige un horario para *Peeling quimico facial*"),
Configuración (día activado muestra de inmediato un horario sugerido
09:00–18:00 en vez de campos vacíos), badges de plan/estado visibles sin
tener que navegar a otra pantalla.

**Veredicto**: **Cumple.**

---

## 7. Flexibilidad y eficiencia de uso

**Verificado en**: link público de reservas con botón "Copiar" en
Configuración (evita tener que armarlo a mano), filtro de estado en
Reservas, selector de período en Reportes, toggle lista/cuadrícula en
Servicios/Clientes.

**Veredicto**: **Cumple** (para el nivel de madurez actual del producto;
no se esperan atajos de teclado avanzados en este tipo de app de gestión).

---

## 8. Diseño estético y minimalista

**Verificado en**: todas las pantallas — paleta de color consistente
(slate/primary/indigo), dark mode aplicado sin colores sueltos, modales
con backdrop-blur, jerarquía visual clara (título, subtítulo, contenido).
Landing con animaciones de scroll-reveal reales (`framer-motion`
`whileInView`).

**Evidencia concreta**: el modal "Nuevo servicio" y "Nuevo cliente"
muestran un diseño limpio, sin elementos decorativos innecesarios, con
foco visual correcto (anillo verde en formularios de creación,
confirmado en ambos modales probados).

**Veredicto**: **Cumple.**

---

## 9. Ayudar a reconocer, diagnosticar y recuperarse de errores

**Verificado en**: Login con credenciales inválidas ("Correo o contraseña
incorrectos", mensaje claro, no expone cuál de los dos campos falló ni
un código técnico), wizard público con horario ya no disponible (mensaje
"No hay horarios disponibles ese día. Prueba con otra fecha."), **y el
chatbot con la API del LLM no configurada en este entorno**.

**Evidencia concreta más importante**: con `LLM_API_KEY` vacío en este
entorno de pruebas, al enviar un mensaje real al chatbot ("¿En qué
pantalla estoy ahora mismo?") el widget respondió, en vez de quedarse
cargando indefinidamente o romperse: *"El asistente no está disponible en
este momento. Intenta de nuevo más tarde."* — exactamente el
comportamiento de degradación amable que exige el punto 16 del brief,
verificado en vivo (no solo leído en `PROGRESS.md`).

**Veredicto**: **Cumple.**

---

## 10. Ayuda y documentación

**Verificado en**: textos de ayuda contextual en Configuración ("Definí el
horario laboral... las reservas solo se pueden agendar dentro de estos
horarios"), Reportes ("La exportación de datos está disponible en el Plan
de Pago — tu negocio está en el Plan Gratis"), y el propio chatbot como
mecanismo de ayuda en vivo (punto 16 del brief).

**Veredicto**: **Cumple** (no hay una sección de ayuda/FAQ separada, pero
el patrón de texto contextual + chatbot cubre razonablemente esta
heurística para el tipo de producto).

---

## Hallazgos a corregir (priorizados)

1. ~~**[Alta] Calendario: la hora de una reserva se muestra en el huso
   horario del navegador del admin...**~~ **Arreglado y reverificado**
   (ver "Actualización" en Heurística 4) — el modal de detalle ya muestra
   la hora fija de Costa Rica. Queda un seguimiento más grande y de menor
   prioridad: la propia celda del mes de FullCalendar sigue mostrando la
   hora en el huso del navegador (ver punto 3 abajo).
2. ~~**[Media] Reportes: el eje de fechas del gráfico "Reservas por día"
   corre la fecha un día hacia atrás**~~ **Arreglado y reverificado**
   (ver "Actualización" en Heurística 4) — se corrigió tanto en Reportes
   como en el mismo patrón encontrado de paso en el Dashboard.
3. **[Media, seguimiento nuevo] El número de hora dentro de la celda del
   Calendario (ej. "9 Cliente...") sigue en el huso horario del
   navegador, no en hora de Costa Rica** — ver el detalle completo en la
   "Actualización" de Heurística 4. Requiere el plugin
   `@fullcalendar/moment-timezone` (o equivalente) y ajustar el feed de
   eventos + `dateClick` + `eventDrop` en conjunto; no se aplicó en esta
   corrección por su mayor superficie de riesgo.
4. **[Baja / no confirmado, anotado por transparencia]** Durante las
   primeras pruebas en el modal "Nuevo servicio", escribir en el campo
   "Nombre del servicio" se truncó dos veces a los primeros 2 caracteres,
   con el foco saltando del input al contenedor del diálogo (confirmado
   con lectura directa del DOM, no solo con capturas de pantalla). Se
   intentó reproducir de forma aislada 4 veces más (mismo campo, mismo
   modal, con distintas variantes de la secuencia de clic+escritura) y
   **no volvió a ocurrir ninguna vez** — incluyendo el mismo patrón
   exacto que había fallado antes. No se pudo aislar una causa
   reproducible del lado de la app; es más probable que haya sido un
   artefacto de la herramienta de automatización del navegador (ráfaga de
   eventos sintéticos de teclado) que un bug real de Turnify. Se deja
   anotado para que el equipo lo tenga presente si alguna vez un usuario
   real reporta algo similar, pero **no se cuenta como hallazgo
   confirmado**.

## Conclusión

La tarjeta se da por **cumplida como auditoría** (las 10 heurísticas
fueron verificadas una por una contra la app real, con evidencia concreta
por cada una), pero **no se recomienda cerrarla como "todo en verde"**:
quedan 2 hallazgos reales de inconsistencia de horario/fecha (Heurística
4) que vale la pena arreglar antes de considerar el flujo de Calendario/
Reportes completamente confiable para un admin fuera de Costa Rica o,
en el caso del segundo hallazgo, incluso dentro de Costa Rica. El resto
del sistema (9 de las 10 heurísticas sin reservas) cumple sólidamente con
evidencia real de navegador, no solo inspección de código.
