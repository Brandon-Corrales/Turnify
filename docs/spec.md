Actúa como arquitecto/desarrollador senior full-stack. Vamos a construir "Turnify",
una plataforma de reservas y turnos con notificaciones automatizadas para negocios
de servicios (clínicas, barberías, consultorios, academias). Proyecto académico
(EIF409 - Aplicaciones Informáticas Globales, UNA Costa Rica) pero con estándares
de producción real: SOLID, Clean Architecture, buenas prácticas, seguridad real.

Antes de escribir código, consulta la documentación oficial vigente de NestJS,
TypeORM/Prisma, React, FullCalendar.js, Resend, Twilio, Stripe, Supabase,
nestjs-i18n/react-i18next y Framer Motion para confirmar sintaxis y APIs
actuales — no asumas versiones ni APIs de memoria, verifica.

Las tareas de la sección "ORDEN DE TRABAJO" son EXACTAMENTE las tarjetas del
tablero de Trello del equipo (lista "Backlog técnico"), organizadas por
categoría en el mismo orden. A medida que termines cada una, indícalo con su
nombre literal para que el equipo la mueva de "Backlog técnico" a
"Listo / Desarrollado" en Trello sin tener que adivinar a cuál corresponde.

## 1. MODELO DE DATOS (ya validado, implementar tal cual, en PostgreSQL)

- NEGOCIO(id_negocio PK, nombre, tipo_negocio[barberia|salon_belleza|clinica|
  clinica_dental|spa|estudio_tatuajes|entrenamiento_personal|estetica|
  veterinaria_grooming|otro], correo_electronico, telefono, direccion,
  plan_suscripcion, estado, fecha_registro)
- USUARIO(id_usuario PK, id_negocio FK, nombre_completo, correo_electronico,
  contrasena_hash, rol[admin|empleado], telefono, activo, creado_en)
- CLIENTE(id_cliente PK, id_negocio FK, nombre_completo, correo_electronico,
  telefono, notas, canal_preferido[email|whatsapp], idioma_preferido[es|en],
  nivel_cliente[gratis|premium], activo, creado_en)
- SERVICIO(id_servicio PK, id_negocio FK, nombre, descripcion, duracion_minutos,
  precio, activo, color_calendario)
- RESERVA(id_reserva PK, id_negocio FK, id_cliente FK, id_servicio FK,
  id_usuario FK [quien atiende], fecha_hora_inicio, fecha_hora_fin,
  estado[pendiente|confirmada|cancelada|ausente], notas,
  origen[online|admin], creado_en)
- NOTIFICACION(id_notificacion PK, id_reserva FK, id_cliente FK,
  tipo[recordatorio|confirmacion|cancelacion], canal[email|whatsapp|sms],
  estado[pendiente|enviada|fallida], programado_para, enviado_en, mensaje,
  reintentos)
- DISPONIBILIDAD(id_disponibilidad PK, id_usuario FK, id_negocio FK,
  dia_semana[0-6], hora_inicio, hora_fin, activo)
- EXCEPCION_DISPONIBILIDAD(id_excepcion PK, id_usuario FK, fecha, bloqueado, motivo)
- SUSCRIPCION(id_suscripcion PK, id_negocio FK, plan[basico|premium|empresarial],
  fecha_inicio, fecha_fin, monto_mensual, estado[activa|suspendida|cancelada],
  id_pago_pasarela)

Todas las tablas deben incluir creado_en y actualizado_en (timestamps de
auditoría) aunque no se listen explícitamente arriba. Usa soft delete
(campo activo/eliminado_en) en vez de DELETE físico en NEGOCIO, USUARIO,
CLIENTE y SERVICIO, para no perder el historial de reservas asociado.

Multi-tenant: TODA query debe filtrar por id_negocio del usuario autenticado,
vía guard/interceptor transversal en NestJS — nunca repetido manualmente en
cada servicio.

## 2. PLANTILLA POR TIPO DE NEGOCIO (VERTICAL) — SISTEMA ADAPTABLE

Turnify no es una app para un solo tipo de negocio: es una plantilla funcional
que se amolda al rubro del negocio que la usa (barbería, salón de belleza,
clínica, clínica dental, spa, estudio de tatuajes, entrenamiento personal,
estética, veterinaria/grooming, u otro), todas unidas por la misma funcionalidad base
de reserva de espacios/citas. La lista de verticales de arriba (punto 1,
tipo_negocio) está tomada de categorías reales usadas por plataformas de
reservas ya establecidas (Fresha, Vagaro, SalonBoost) — no inventada.

- **Selección del tipo de negocio:** en el registro (POST /auth/registro,
  ya construido), el admin ELIGE su tipo_negocio de esa lista fija (no texto
  libre). Esto ya modifica el enum del punto 1 — actualiza el DTO de
  registro para validarlo con class-validator.
- **Nombre del local:** el admin ingresa NEGOCIO.nombre (ya existe en el
  modelo), que se muestra tanto en su propio dashboard como en la página
  pública de reserva que ven sus clientes finales — no hardcodear "Turnify"
  en ninguna pantalla orientada al negocio o al cliente, el nombre del
  negocio es lo que debe verse ahí.
- **Catálogo de servicios de plantilla por vertical** (referencia estática,
  sembrada por seed/migración, NO editable vía API — no existe un rol
  superadmin de plataforma que la administre, ver punto 1):
  - `barberia`: Corte de cabello, Corte + barba, Afeitado clásico, Diseño de
    barba, Corte infantil, Corte a máquina (fade), Tratamiento capilar
  - `salon_belleza`: Corte y peinado, Coloración, Mechas/reflejos, Manicure,
    Pedicure, Tratamiento capilar, Alisado/keratina, Maquillaje, Depilación de cejas
  - `clinica` (consulta general/médica): Consulta general, Consulta de
    seguimiento, Control/chequeo, Consulta de urgencia, Certificado médico,
    Toma de signos vitales, Consulta de especialidad
  - `clinica_dental`: Consulta/valoración inicial, Limpieza dental,
    Obturación (resina), Endodoncia (tratamiento de conducto), Extracción,
    Blanqueamiento dental, Ortodoncia (consulta/ajuste), Urgencia dental
  - `spa`: Masaje relajante, Masaje terapéutico, Facial, Exfoliación corporal,
    Aromaterapia, Piedras calientes, Tratamiento corporal reafirmante
  - `estudio_tatuajes`: Consulta de tatuaje, Sesión de tatuaje, Piercing,
    Retoque, Tatuaje pequeño (flash)
  - `entrenamiento_personal`: Sesión individual, Evaluación física inicial,
    Clase grupal, Seguimiento/plan de entrenamiento, Sesión de acondicionamiento
  - `estetica`: Limpieza facial, Depilación, Tratamiento anti-edad,
    Radiofrecuencia, Peeling químico, Depilación láser
  - `veterinaria_grooming`: Baño y corte, Consulta veterinaria, Vacunación,
    Desparasitación, Corte de uñas, Estética canina/felina
  - `otro`: sin plantilla — el admin crea sus SERVICIO desde cero
- **Flujo de onboarding:** justo después del registro, antes del primer
  ingreso al dashboard, muestra al admin las plantillas de servicio de su
  tipo_negocio como una lista de checkboxes ("¿cuáles de estos servicios
  ofreces? puedes agregar más después"). Los que seleccione se crean como
  filas reales de SERVICIO (usando el endpoint POST /servicios que YA
  existe, uno por cada plantilla marcada — no hace falta un endpoint
  masivo nuevo) con valores de duración/precio por defecto que el admin
  edita después. Si elige "otro" o no marca ninguna, pasa directo a crear
  servicios manualmente.
- **Esto es aditivo sobre módulos ya construidos, no un rediseño:** Auth/
  registro, Negocios y Servicios ya están terminados y no se reescriben —
  esto se implementa como un incremento sobre lo que ya existe (agregar el
  enum al DTO de registro, agregar el catálogo estático de plantillas, y
  agregar el paso de onboarding en el frontend después del registro).
- El resto del comportamiento del sistema (reservas, disponibilidad,
  notificaciones, freemium, seguridad, etc.) es idéntico sin importar el
  tipo_negocio elegido — la vertical solo cambia el nombre mostrado y el
  catálogo inicial de servicios sugeridos, no la lógica de negocio.

## 3. STACK OBLIGATORIO

- Backend: NestJS + TypeScript + TypeORM (o Prisma, tú decides cuál se integra
  mejor) + PostgreSQL + class-validator + class-transformer + Swagger
- Frontend: React + TypeScript + Vite + TailwindCSS + FullCalendar.js +
  Framer Motion (animaciones) + TanStack Query (estado del servidor)
- Auth: JWT (access token corto + refresh token), bcrypt para contraseñas,
  guards por rol (admin/empleado)
- Notificaciones: worker separado del request/response principal (cola con
  BullMQ+Redis si es viable, si no, un cron job simple con node-cron) que
  revisa NOTIFICACION.estado=pendiente y programado_para, y envía por
  Resend (email) o Twilio Sandbox (whatsapp), actualizando estado y reintentos
- Pagos: Stripe en modo test para simular cambios de plan de SUSCRIPCION
- Variables de entorno para TODAS las credenciales, nunca hardcodeadas.
  Valida el .env al arrancar la app con un esquema (Joi o Zod) para fallar
  rápido si falta una variable, en vez de fallar a medio request.

## 4. PATRÓN DE DESARROLLO BACKEND

Un módulo NestJS por entidad (auth, negocios, usuarios, clientes, servicios,
disponibilidad, reservas, notificaciones, suscripciones, reportes), cada uno
siguiendo el patrón Controller → Service → Repository. Cada módulo debe tener:
- DTOs de entrada/salida validados con class-validator
- Manejo de errores consistente vía filtro global de excepciones (nunca
  exponer stack traces ni mensajes internos de la base de datos al cliente)
- Logging estructurado (Pino o el logger nativo de NestJS con contexto por
  request) en cada operación relevante, sin loguear datos sensibles
  (contraseñas, tokens)
- Tests unitarios de los casos de negocio críticos (ej: no permitir reservas
  que se traslapen en horario para el mismo usuario)
- Paginación (limit/offset o cursor) en todo endpoint que devuelva listas
  (reservas, clientes, servicios) — nunca devolver una tabla completa sin límite
- Un endpoint de health check (GET /health) que verifique conexión a la base
  de datos, usado por el hosting para saber si el servicio está vivo

La creación de una RESERVA debe ejecutarse dentro de una transacción de base
de datos que valide la disponibilidad y la ausencia de traslapes antes de
confirmar el INSERT, para evitar doble-booking bajo concurrencia (dos
clientes reservando el mismo horario al mismo tiempo). El webhook de Stripe
debe ser idempotente: si Stripe reenvía el mismo evento, no debe duplicar el
cambio de estado de la SUSCRIPCION (verifica el event id ya procesado).

## 5. MODELO FREEMIUM: LÍMITES POR PLAN (GRATIS VS PAGO)

Turnify maneja DOS estados de freemium independientes, uno por tipo de
actor, y no deben confundirse entre sí:

### 4.1 Administrador / Negocio — Plan Gratis vs Plan de Pago

Toda cuenta nueva empieza en el Plan Gratis, y ciertas acciones quedan
limitadas hasta que el negocio actualiza a un Plan de Pago vía el módulo de
Suscripciones (Stripe Test Mode). Este estado vive en SUSCRIPCION.plan y
gobierna los privilegios del/los USUARIO(s) de ese negocio.

- SUSCRIPCION.plan debe distinguir al menos entre `gratis` y de pago
  (`basico`, `premium`, `empresarial` si el equipo decide escalonar el plan
  pago en niveles; si no, un solo nivel de pago es suficiente para el MVP).
- Privilegios del Plan Gratis (el equipo ajusta los números exactos, pero
  deben existir límites reales, no solo de nombre):
  - Máximo 1 usuario (solo el admin, sin poder invitar empleados)
  - Máximo 3 servicios activos
  - Máximo 20 reservas por mes calendario
  - Notificaciones solo por correo electrónico (WhatsApp bloqueado)
  - Reportes básicos, sin exportación de datos
  - Límite diario de mensajes al chatbot del punto 16 (ej: 10 mensajes/día)
  - Texto "Hecho con Turnify" visible en la página pública de reserva del
    negocio (se quita en el plan de pago)
  - Sin personalización de marca (colores de calendario limitados a una
    paleta predefinida)
- Privilegios del Plan de Pago: elimina todos los límites anteriores —
  usuarios/empleados ilimitados con roles diferenciados, servicios y
  reservas ilimitados, notificaciones por email + WhatsApp, reportes
  completos con exportación, chatbot sin límite diario (o uno mucho mayor),
  sin marca de agua, personalización de marca completa.

### 4.2 Cliente final — Nivel Gratis vs Premium

Este es un estado de fidelidad/prioridad que el ADMIN del negocio asigna (o
el sistema calcula por frecuencia de reservas, a decisión del equipo) sobre
sus propios clientes — no es algo que el cliente le pague a Turnify, vive en
CLIENTE.nivel_cliente y es independiente del plan del negocio.

- Nivel Gratis (default de todo cliente nuevo):
  - Reserva estándar según la disponibilidad pública normal
  - Recordatorio por el canal que el negocio tenga habilitado
  - Sin prioridad si dos clientes compiten por el mismo cupo liberado por
    una cancelación
- Nivel Premium:
  - Prioridad en la lista de espera cuando se libera un horario cancelado
  - Recordatorio por un canal adicional (ej. WhatsApp) SI el plan del propio
    negocio ya lo permite — el nivel del cliente nunca puede desbloquear una
    función que el plan del negocio (punto 5.1) tiene bloqueada
  - Badge visible "Cliente Premium" en la pantalla de Clientes del admin
    (lista y cuadrícula, ver punto 9)
  - (Opcional, a decisión del equipo) descuento configurable por servicio

Regla de dependencia entre ambos estados: el nivel del cliente SIEMPRE está
limitado por el techo que impone el plan del negocio. Un cliente Premium de
un negocio en Plan Gratis igual no recibe WhatsApp, porque el negocio no
tiene ese canal habilitado.

### Implementación (aplica a ambos estados)

- Backend: crea un guard/interceptor central por cada estado (uno para
  límites de NEGOCIO/SUSCRIPCION, otro para privilegios de CLIENTE) que
  valide ANTES de ejecutar la acción — mismo patrón transversal que el guard
  multi-tenant del punto 1, nunca copiado y repetido dentro de cada
  servicio. Al alcanzar un límite, responde con el formato estándar de
  error del punto 8 (ej: `errorCode: "LIMITE_PLAN_ALCANZADO"` o
  `errorCode: "PRIVILEGIO_CLIENTE_NO_DISPONIBLE"`).
- Frontend: cuando una acción quede bloqueada por cualquiera de los dos
  estados, usa el mismo componente de Alert/Modal del punto 8 con un mensaje
  claro de por qué se bloqueó — nunca un botón deshabilitado sin
  explicación. Muestra badges visibles de ambos estados donde corresponda:
  "Plan Gratis"/"Plan Pago" en el Dashboard del admin, y "Cliente
  Premium"/"Cliente Gratis" (opcional, solo si aporta valor visible) en la
  pantalla de Clientes.

## 6. PANTALLAS FRONTEND

Landing pública → Login/Registro → Dashboard → Calendario (FullCalendar con
datos reales de RESERVA/DISPONIBILIDAD) → Flujo de reserva pública, como
wizard de 4 pasos exactos:
  1. Selección de servicio
  2. Selección de horario disponible
  3. Datos del cliente
  4. Confirmación
→ Notificaciones (historial + configurar recordatorios) → Reportes (gráficos
con datos reales agregados desde el backend).

## 7. DISEÑO FRONTEND — MODERNO, CON ANIMACIONES E INTERACCIONES

Este proyecto debe verse como un producto SaaS actual, no como un CRUD
genérico. Aplica esto en cada pantalla:

- Micro-interacciones con Framer Motion: transiciones suaves entre pasos del
  wizard de reserva (slide/fade), hover y tap states en botones y tarjetas,
  entrada escalonada (stagger) de listas (servicios, reservas del día)
- Skeleton loaders (no spinners genéricos) mientras cargan datos del
  calendario, dashboard y reportes
- Estados vacíos (empty states) diseñados, no una tabla en blanco, cuando no
  hay reservas o servicios todavía
- Animación de confirmación al completar una reserva (ej: check animado o
  confetti sutil) — celebra la acción sin ser intrusivo
- Modo oscuro (dark mode) con Tailwind, con transición suave al cambiar
- Landing con animaciones al hacer scroll (reveal de secciones con
  Intersection Observer + Framer Motion), no todo estático
- Paleta de colores y tipografía consistentes (define un design token base
  en Tailwind config: colores primarios/secundarios, escala de espaciado,
  radios de borde) — evita el look "Bootstrap por defecto"
- Componentes reutilizables y consistentes (botones, inputs, cards, modales)
  en una carpeta de UI compartida, no estilos repetidos por pantalla

Balance obligatorio: las animaciones no deben sacrificar rendimiento ni
accesibilidad — respeta `prefers-reduced-motion` del sistema operativo del
usuario, y que ninguna transición bloquee la interacción por más de ~300ms.

## 8. COMPONENTES REUTILIZABLES — REGLA OBLIGATORIA PARA TODO EL FRONTEND

Ningún formulario, botón, alerta, modal, notificación de error, tarjeta o
elemento de vista se construye más de una vez. Todo lo que se repita entre
dos o más pantallas se crea UNA sola vez en una carpeta compartida y desde
ahí se importa donde se necesite — nunca se copia y pega ni se recrea con
variaciones sueltas por módulo. Esto aplica a:

- Formularios y sus campos (inputs, selects, date/time pickers, textareas)
- Botones (primario, secundario, destructivo, ícono) con sus estados
  (default, hover, disabled, loading)
- Alertas, toasts, banners y modales de confirmación
- Notificaciones de error y mensajes de validación
- Layouts y estructuras de vista repetidas (encabezado de página, tabla con
  paginación, tarjeta de estadística del dashboard, estado vacío)

**Convención de color en el estado de foco de los formularios (obligatoria
en todo el sistema, parte del componente Input compartido):** el anillo/borde
de foco de un campo debe indicar por color si el formulario está creando o
editando un registro:
- Formularios de **crear** (nuevo servicio, nuevo cliente, nueva reserva,
  registro de negocio, etc.): foco en **verde**
- Formularios de **actualizar/editar** (editar servicio, editar cliente,
  editar perfil del negocio, etc.): foco en **azul**
Esto se implementa como una prop del componente Input compartido (ej.
`variant="crear" | "editar"`), nunca como un color puesto a mano en un
formulario específico — así queda consistente automáticamente en todos los
módulos sin que cada quien del equipo tenga que recordarlo.

Antes de escribir el JSX de cualquier pantalla nueva, revisa primero si el
componente que necesitas ya existe en la carpeta compartida; si no existe y
se va a usar en más de un lugar, créalo ahí antes de usarlo en la pantalla.
Un componente usado en una sola pantalla y sin probabilidad real de
reutilizarse puede vivir junto a esa pantalla, pero en caso de duda,
constrúyelo como reutilizable.

Todo el feedback al usuario en todo el sistema debe salir de ese único set
de componentes compartidos — ningún formulario, pantalla o módulo puede
inventar su propio estilo de alerta o mensaje.

- Backend: TODOS los errores de la API deben responder con la misma forma
  estándar, por ejemplo `{ statusCode, errorCode, message, field? }` (el
  filtro global de excepciones del punto 4 es quien la garantiza). El
  `errorCode` debe ser un identificador estable (ej: `RESERVA_TRASLAPE`,
  `EMAIL_YA_REGISTRADO`) para que el frontend pueda mapearlo a un mensaje
  traducido, en vez de mostrar el texto crudo del backend.
- Frontend: un solo componente de Toast/Alert reutilizable con las 4
  variantes estándar (éxito, error, advertencia, información), mismos
  colores, ícono y duración en todo el sistema — usado tanto para "reserva
  creada" como para "error al guardar servicio".
- Un solo componente de Modal de confirmación para toda acción destructiva o
  irreversible (cancelar reserva, eliminar servicio, desactivar usuario) —
  mismo texto de botones ("Confirmar" / "Cancelar"), mismo estilo, en todos
  los módulos.
- Campos obligatorios: mismo indicador visual en todos los formularios
  (asterisco rojo junto al label), y el mismo componente de input debe
  mostrar su estado de error (borde rojo + mensaje debajo del campo,
  vinculado con aria-describedby) de forma idéntica sin importar en qué
  pantalla esté.
- Mensajes de validación (obligatorio, formato de correo inválido, mínimo de
  caracteres, etc.) centralizados como claves de i18n reutilizadas en todos
  los formularios — nunca redactados de nuevo por cada campo o cada
  desarrollador del equipo.
- Loading states: mismo patrón de skeleton por tipo de contenido (lista,
  tarjeta, tabla) reutilizado en Dashboard, Calendario, Reportes y
  Notificaciones — no un spinner distinto en cada pantalla.
- Banners de estado del sistema (ej: suscripción vencida, negocio inactivo)
  con el mismo componente y ubicación en toda la aplicación.

Construye estos componentes compartidos (Toast, Modal, Input con validación,
Skeleton, Banner) en la carpeta de UI compartida del punto 7 ANTES de
avanzar con las pantallas individuales, para que cada módulo los consuma en
vez de crear los suyos.

## 9. CONTROLES GLOBALES DE PREFERENCIA (VISTA, TEMA, IDIOMA)

Estos tres controles deben vivir juntos y visibles en la barra de navegación
(o un menú de preferencias) en TODA pantalla del sistema, tanto para el
cliente final como para el usuario administrador:

- **Vista lista/cuadrícula**: un toggle reutilizable (parte de
  `components/ui` del punto 8) disponible en toda pantalla que liste
  múltiples registros — Clientes, Servicios, Reservas (vista administrativa).
  No aplica al Calendario (ya es una vista de cuadrícula por naturaleza) ni a
  Reportes (son gráficos). La preferencia elegida se recuerda por
  pantalla (localStorage), no se resetea cada vez que el usuario navega.
- **Tema claro/oscuro**: toggle persistente (localStorage), con el tema del
  sistema operativo del usuario (`prefers-color-scheme`) como valor por
  defecto la primera vez. Debe aplicar a TODA la interfaz sin excepciones —
  landing, dashboard, wizard de reserva, chatbot del punto 16 — usando los
  design tokens de Tailwind definidos en el punto 7, nunca colores sueltos
  hardcodeados por componente.
- **Idioma español/inglés**: el selector ya definido en el punto 10 (i18n),
  ubicado en el mismo grupo de controles que el tema y la vista, con el
  mismo estilo visual que los otros dos toggles.

Construye estos tres controles como un solo grupo de componentes desde el
principio (no como ajustes sueltos agregados después), porque el resto de
las pantallas del punto 6 deben nacer ya preparadas para respetarlos.

## 10. INTERNACIONALIZACIÓN (i18n) — requisito del docente

- Backend: `nestjs-i18n`. Archivos de traducción en apps/backend/src/i18n/es/
  y apps/backend/src/i18n/en/ (mensajes de validación, errores y
  notificaciones). El mensaje que se envía por email/WhatsApp debe generarse
  en el idioma preferido del CLIENTE (campo idioma_preferido de CLIENTE),
  nunca en el idioma del negocio.
- Frontend: `react-i18next` + `i18next-browser-languagedetector`. Archivos en
  apps/frontend/src/i18n/locales/es.json y en.json. Selector de idioma
  visible en el navbar (landing y dashboard). Español como idioma por
  defecto (mercado objetivo es Costa Rica), inglés como segundo idioma.
- No hardcodear ningún texto de UI ni mensaje de notificación en el código;
  todo debe pasar por las claves de traducción desde el primer módulo que se
  construya (Auth), para no tener que refactorizar después.

## 11. ACCESIBILIDAD Y CALIDAD DE INTERFAZ

- Contraste de color suficiente (mínimo AA de WCAG) incluso con la paleta
  moderna del punto 7
- Navegación completa por teclado en el wizard de reserva y el calendario
  (focus visible, orden de tab lógico)
- Atributos aria-label en botones de solo ícono y en el selector de idioma
- Formularios con mensajes de error asociados a su campo (aria-describedby),
  no solo un toast genérico

## 12. DISEÑO RESPONSIVE — TODO EL SISTEMA, TODOS LOS NIVELES

Ninguna pantalla queda exenta. Esto aplica al 100% de las vistas del punto 6
(landing, login/registro, dashboard, calendario, wizard de reserva,
notificaciones, reportes) y también a los controles globales del punto 9 y
al widget del chatbot del punto 16, en desktop y en mobile, sin excepciones.

- Enfoque mobile-first: escribe primero el estilo para pantalla pequeña y
  luego mejóralo para pantallas más grandes con los breakpoints de Tailwind
  (`sm`, `md`, `lg`, `xl`), no al revés.
- El Calendario debe cambiar de vista según el tamaño de pantalla:
  vista de mes/semana en desktop, vista de agenda/día en mobile (FullCalendar
  soporta esto de forma nativa) — un calendario de mes completo no es usable
  en una pantalla de teléfono.
- Toda tabla administrativa (Clientes, Servicios, Reservas) debe volverse
  legible en mobile: como tarjetas apiladas o con scroll horizontal
  controlado, nunca una tabla comprimida e ilegible. Esto aplica igual a la
  vista de lista y a la vista de cuadrícula del punto 9.
- Formularios y el wizard de reserva en una sola columna en mobile, con
  campos de ancho completo y suficiente espacio de toque (mínimo 44x44px
  por control, ver Ley de Fitts del punto 13 [Heurísticas]).
- El widget del chatbot debe colapsar a un ícono flotante en mobile y
  expandirse a pantalla completa o casi completa al abrirse, en vez de
  ocupar una ventana fija que tape el contenido en una pantalla pequeña.
- Prueba en anchos reales de dispositivo (no solo redimensionando la
  ventana del navegador de escritorio) antes de dar por cerrada cualquier
  pantalla, y como parte del checklist de QA de cada Seguimiento.

## 13. HEURÍSTICAS Y LEYES UX A APLICAR

- Nielsen: visibilidad del estado del sistema (loaders, toasts, badge de
  notificaciones), prevención de errores (validación en tiempo real en el
  wizard de reserva), consistencia y estándares, reconocer antes que recordar
  (mostrar servicio/horario elegido en cada paso del wizard), control y
  libertad del usuario (cancelar/reprogramar reserva sin fricción), ayuda a
  reconocer/diagnosticar/recuperarse de errores (mensajes claros, no códigos
  técnicos crudos)
- Ley de Hick: el wizard de reserva no debe mostrar más opciones de las
  necesarias en cada paso
- Ley de Fitts: botones de acción primaria (confirmar reserva, guardar)
  grandes y en zona de pulgar en mobile
- Ley de Jakob: el calendario debe comportarse como Google Calendar/Calendly,
  que es lo que los usuarios ya conocen

## 14. PRINCIPIOS DE INGENIERÍA

- SOLID en todo el backend (inyección de dependencias vía NestJS,
  responsabilidad única por servicio, interfaces para repositorios de modo
  que se puedan mockear en tests)
- Clean Architecture: separación clara entre capa de dominio, capa de
  aplicación (casos de uso) y capa de infraestructura (DB, proveedores
  externos como Resend/Twilio/Stripe)
- Manejo de estado en frontend con TanStack Query para datos del servidor
  (cache, revalidación, estados de loading/error automáticos) — evita
  useEffect + fetch manual repetido en cada componente
- Error boundaries en React para que un error en un componente no rompa toda
  la pantalla
- No dupliques lógica de validación entre frontend y backend: valida en
  ambos lados pero con una sola fuente de verdad para las reglas de negocio
  (ej: reglas de traslape de horarios viven en el backend)
- ESLint + Prettier configurados desde el primer commit en ambos apps, con
  reglas compartidas si es posible
- Documentación: Swagger/OpenAPI autogenerado en el backend, README claro
  con instrucciones de setup local (docker-compose para Postgres)

## 15. SEGURIDAD (no negociable)

- Hasheo de contraseñas (bcrypt) + política de contraseña mínima
- JWT con expiración corta + refresh token rotativo
- Guard de autorización por rol en cada endpoint sensible
- Guard multi-tenant (evitar fuga de datos entre negocios distintos)
- Validación de entrada en TODOS los DTOs (class-validator)
- Rate limiting en endpoints públicos (reserva pública, login, y el
  endpoint/gateway del chatbot del punto 16 — cada mensaje al asistente
  cuesta una llamada a un LLM externo, hay que limitar abuso)
- Variables de entorno fuera del repo (.env nunca commiteado)
- Configuración correcta de CORS (solo dominios propios del proyecto)
- npm audit de dependencias antes de cada entrega/seguimiento

## 16. ASISTENTE CONTEXTUAL (CHATBOT) EN TIEMPO REAL

El sistema debe tener un chat flotante disponible en TODA pantalla, tanto
para el cliente final (mientras reserva) como para el usuario administrador
(mientras gestiona su negocio), que responda dudas de "cómo se hace algo" en
Turnify — no es un chat de soporte humano, es un asistente que conoce el
sistema.

- **Tiempo real**: implementa el canal con WebSockets (`@nestjs/websockets`
  + Socket.io), con respuesta en streaming (los tokens del LLM se muestran
  a medida que llegan, no se espera la respuesta completa).
- **Contextualización real** (esto es lo que lo hace útil y no un chatbot
  genérico): cada mensaje que el frontend envía al backend debe incluir:
  - El rol del usuario (cliente final vs admin/empleado), para que el
    asistente ajuste qué puede explicar (a un cliente le explica cómo
    reservar/cancelar; a un admin le explica cómo configurar disponibilidad,
    servicios, o interpretar sus reportes)
  - La pantalla/módulo actual desde el que se pregunta (ej: "está en el
    paso 2 del wizard de reserva" o "está en la pantalla de Reportes")
  - Datos reales del propio negocio del usuario cuando la pregunta lo
    requiera (ej: "¿qué servicios tengo activos?"), obtenidos REUTILIZANDO
    los services existentes (Servicios, Reservas, Reportes) — nunca
    consultando la base de datos directo desde el módulo del chatbot
  - Una base de conocimiento estática de cómo funciona Turnify (flujos,
    términos, preguntas frecuentes) como parte del system prompt del LLM
- **Seguridad crítica**: el chatbot pasa por el MISMO guard multi-tenant del
  punto 1 — bajo ninguna circunstancia puede responder con datos de un
  negocio distinto al del usuario que pregunta, ni aunque se lo pidan
  explícitamente en el mensaje. Trátalo como un endpoint autenticado más.
- **Proveedor del LLM**: usa una API de LLM externa (Claude, OpenAI, u otra)
  vía variable de entorno para la API key, nunca hardcodeada. Si el
  presupuesto del equipo es limitado, prioriza un modelo económico o de
  capa gratuita — el chatbot es una capa de ayuda, no necesita el modelo
  más caro disponible.
- **Manejo de fallas**: si la API del LLM falla o se agota el límite de uso,
  el widget debe degradarse a un mensaje amable (usando el componente de
  Alert del punto 8) en vez de romper la pantalla o quedarse cargando
  indefinidamente.
- **Frontend**: constrúyelo como un componente reutilizable (parte de
  `components/ui` o una carpeta `chat/` propia), montado una sola vez a
  nivel de layout general, no repetido por pantalla.

Este módulo no estaba en el backlog original de Trello — avísale al equipo
para que se agregue como tarjetas nuevas (backend del chatbot, frontend del
widget, y su prueba de aislamiento multi-tenant en QA) antes de empezar a
construirlo.

## 17. ESTRUCTURA DE REPOSITORIO (monorepo, ya existe en GitHub)

turnify/
├── apps/
│   ├── frontend/
│   │   └── src/
│   │       ├── components/
│   │       │   ├── ui/          (Button, Input, Select, DatePicker, Toast,
│   │       │   │                 Modal, Skeleton, Banner — el set del punto 8)
│   │       │   ├── forms/       (formularios reutilizables completos, ej:
│   │       │   │                 FormularioServicio usado en crear y editar)
│   │       │   └── layout/      (encabezado, tabla con paginación, empty
│   │       │                     state, tarjeta de estadística)
│   │       ├── pages/           (una pantalla del punto 6 por carpeta,
│   │       │                     consume SOLO lo de components/, no
│   │       │                     redefine sus propios botones ni alertas)
│   │       └── i18n/
│   └── backend/        (NestJS+TS)
├── packages/
│   └── shared-types/   (interfaces/DTOs compartidos)
├── .github/workflows/ci.yml
├── docker-compose.yml  (Postgres local)
├── .env.example
└── README.md

Usa npm workspaces (o turborepo si lo consideras mejor). El repo NO debe
llevar los artefactos del Avance 1 (PPTX, wireframe, ER.drawio) — el equipo
decidió mantenerlo limpio, solo código. El pipeline de CI (.github/workflows/ci.yml)
debe correr en cada Pull Request: lint, tests, y build de ambos apps —
fallar el pipeline si algo de esto falla, para no mezclar código roto con `develop`.

## 18. ORDEN DE TRABAJO — TAREAS EXACTAS DEL BACKLOG DE TRELLO (66 TARJETAS)

El equipo tiene el Seguimiento #2 el 24/09/2026 (Avance funcional 30%, Gestión
del proyecto 25%, Calidad técnica 25%, Evidencia/presentación 20%), así que
sigue este orden y no saltes de categoría sin cerrar la anterior. Las tareas
marcadas "DESPUÉS del Seguimiento #2" son funcionalidades reales del sistema
(freemium, chatbot, dark mode, etc.) pero no son necesarias para defender el
avance mínimo de esa fecha — no las adelantes a costa de dejar incompleto el
flujo de reserva básico.

### Base de Datos
- DB: Ajustar diagrama ER final (evaluar tabla EXCEPCION_DISPONIBILIDAD)
- DB: Configurar PostgreSQL en Supabase + variables de entorno
- DB: Migraciones iniciales (TypeORM/Prisma) de las 8 entidades del ER
- DB: Índices y constraints (email único, FK con cascada en reservas)
- DB: Seed de datos de prueba (negocio demo, servicios, usuarios, clientes)
- DB: Definir límites de plan freemium (gratis vs pago) en configuración del sistema
- DB: Seed del catálogo estático de plantillas de servicio por tipo_negocio (barbería, salón, clínica, spa, etc.)

### Backend — PRIORIDAD para el Seguimiento #2 (hasta "Módulo Reservas")
- Backend: Setup del proyecto NestJS + estructura de módulos
- Backend: Módulo Auth — registro de negocio + login JWT + refresh token + guards de rol
- Backend: Guard/interceptor multi-tenant (filtrar automáticamente por id_negocio)
- Backend: Módulo Negocios — CRUD + onboarding
- Backend: Módulo Usuarios — CRUD + roles admin/empleado
- Backend: Módulo Clientes — CRUD
- Backend: Módulo Servicios — CRUD (nombre, duración, precio)
- Backend: Módulo Disponibilidad — CRUD + validación de traslapes de horario
- Backend: Módulo Reservas — crear/cancelar/reprogramar + validación de choques de horario

--- (lo de abajo va DESPUÉS del Seguimiento #2, no antes) ---

- Backend: Worker de Notificaciones — integración Resend (email)
- Backend: Worker de Notificaciones — integración Twilio Sandbox (WhatsApp)
- Backend: Módulo Suscripciones — Stripe Test Mode + webhook + guard de límites del plan gratis
- Backend: Módulo Reportes — agregaciones (reservas por período, ingresos estimados)
- Backend: Documentación Swagger/OpenAPI en todos los endpoints
- Backend: i18n backend (nestjs-i18n, mensajes de validación/errores ES/EN)
- Backend: Guard de límites por plan freemium (bloquear acciones al superar límites del plan gratis)
- Backend: Guard de privilegios por nivel_cliente (Gratis vs Premium), limitado por el plan del negocio
- Backend: Módulo Chatbot — WebSocket Gateway + integración con LLM (contexto por rol y por negocio)
- Backend: Validar tipo_negocio (enum de verticales) en el DTO de registro, sobre el módulo Auth ya existente

### Frontend — PRIORIDAD para el Seguimiento #2 (Setup + componentes base + Login + Calendario)
- Frontend: Setup Vite + TypeScript + Tailwind + estructura de carpetas
- Frontend: Set de componentes UI compartidos (Button, Input, Toast, Modal, Skeleton, Banner)
- Frontend: Login / Registro conectado al módulo Auth
- Frontend: Calendario (FullCalendar) conectado a Reservas/Disponibilidad

--- (lo de abajo va DESPUÉS del Seguimiento #2, no antes) ---

- Frontend: Landing pública conectada a datos reales de planes
- Frontend: Dashboard con KPIs desde el módulo Reportes
- Frontend: Wizard de reserva pública (4 pasos) conectado a Servicios/Disponibilidad/Reservas
- Frontend: Pantalla de Notificaciones (historial + configuración de recordatorios)
- Frontend: Pantalla de Reportes con gráficos de datos reales
- Frontend: Selector de idioma (react-i18next, ES/EN)
- Frontend: Ajustes responsive / mobile-first en todo el sistema (calendario, tablas administrativas, wizard, chatbot)
- Frontend: Toggle de vista lista/cuadrícula reutilizable (Clientes, Servicios, Reservas)
- Frontend: Modo oscuro/claro persistente (dark mode)
- Frontend: Pantalla/banner de upgrade de plan (Plan Gratis a Plan Pago)
- Frontend: Marcar/mostrar nivel_cliente (Gratis/Premium) en la pantalla de Clientes
- Frontend: Widget de chatbot flotante (tiempo real, contextual, responsive)
- Frontend: Paso de onboarding tras el registro — selección de tipo de negocio + plantilla de servicios sugeridos
- Frontend: Componente Input compartido — variante crear (foco verde) vs editar (foco azul)

### Seguridad — aplicar DESDE EL PRIMER MÓDULO (Auth), no al final
- Seguridad: Hasheo de contraseñas (bcrypt) + política de contraseña mínima
- Seguridad: JWT con expiración corta + refresh token rotativo
- Seguridad: Guard de autorización por rol en cada endpoint sensible
- Seguridad: Guard multi-tenant (evitar fuga de datos entre negocios)
- Seguridad: Validación de entrada en todos los DTOs (class-validator)
- Seguridad: Rate limiting en endpoints públicos (reserva pública, login)
- Seguridad: Variables de entorno fuera del repo (.env nunca commiteado)
- Seguridad: Configuración correcta de CORS (solo dominios propios)
- Seguridad: npm audit de dependencias antes de cada entrega/seguimiento
- Seguridad: Rate limiting en el endpoint/gateway del chatbot

### QA — validar cada módulo apenas se termine, no acumular al final
- QA: Tests unitarios de reglas de negocio críticas (no traslape de horarios, validación de roles)
- QA: Tests de integración de endpoints principales (Auth, Reservas)
- QA: Test E2E del flujo completo de reserva pública (Cypress o Playwright)
- QA: Checklist manual de heurísticas de Nielsen sobre el frontend real
- QA: Prueba de concurrencia sobre el endpoint de reservas (evitar doble-booking)
- QA: QA de traducción i18n (sin textos rotos o sin traducir en ES/EN)
- QA: Checklist de cumplimiento de rúbrica antes de cada Seguimiento
- QA: Prueba de aislamiento multi-tenant del chatbot (no debe responder con datos de otro negocio)
- QA: Prueba de límites del plan freemium (bloqueo correcto de cada acción limitada)
- QA: Prueba de que el nivel del cliente nunca desbloquea una función que el plan del negocio tiene bloqueada
- QA: Prueba responsive en dispositivos reales para todas las pantallas
- QA: Verificar que el flujo de plantillas por vertical no rompe el registro/onboarding ya existente

## 19. CONTINUIDAD DEL TRABAJO ANTE INTERRUPCIONES (INTERNET / LÍMITE DE TOKENS)

Este proyecto se construye en múltiples sesiones, no en una sola sentada.
Deja siempre el repositorio en un estado del que cualquier sesión futura
—tuya, de otro miembro del equipo, o una nueva instancia tuya sin memoria de
esta conversación— pueda continuar sin adivinar qué falta.

- Trabaja en incrementos que terminen en un commit funcional. Nunca dejes un
  módulo a medias sin al menos un commit que compile y corra, aunque el
  módulo no esté 100% terminado — un commit pequeño y estable vale más que
  uno grande y roto.
- Mantén un archivo `PROGRESS.md` en la raíz del repo, actualizado en el
  mismo commit que cierra cada tarea, con:
  - La última tarea completada (nombre literal de la tarjeta de Trello del
    punto 18, ej: "Backend: Módulo Auth — registro de negocio...")
  - La tarea en curso y en qué punto exacto quedó
  - Cualquier decisión técnica pendiente de confirmar con el equipo
- **Si detectas que se te va a acabar el contexto/tokens de la sesión, o
  pierdes conexión a internet a media tarea, PAUSA de forma segura:**
  1. Termina el archivo o función en la que estés hasta un punto que
     compile (aunque quede con un comentario `// TODO:` claro de lo que
     falta)
  2. Haz commit de lo que tengas, con un mensaje honesto sobre el estado
     (ej: `wip: módulo Reservas — falta validación de traslapes`)
  3. Actualiza `PROGRESS.md` explicando en qué quedaste y cuál es el
     siguiente paso concreto
- **Al retomar** (se restableció el internet, empezó una sesión nueva, o
  cambió quién está al mando), tu PRIMER paso siempre es leer `PROGRESS.md`
  y correr `git log --oneline -10` para confirmar el estado real del repo
  ANTES de escribir una sola línea de código. Nunca asumas de memoria dónde
  quedaste ni reinicies desde cero un módulo que ya tiene avance.
- No dupliques trabajo: si `PROGRESS.md` o el historial de commits muestran
  que una tarea del punto 18 ya está hecha, no la repitas — continúa con la
  siguiente en el orden dado.

## 20. INSTRUCCIONES DE TRABAJO

Ve avanzando tarea por tarea de la lista de arriba, en el orden dado, sin
generar todo de golpe sin poder probarlo. Explica brevemente cada decisión
técnica no trivial que tomes (ej: por qué TypeORM vs Prisma, por qué BullMQ
vs cron simple) para que el equipo la entienda y la pueda defender en la
exposición del curso.
