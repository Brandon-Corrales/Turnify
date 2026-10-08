/**
 * Parser mínimo del Markdown que usa el asistente (negritas, cursivas,
 * listas con viñetas o numeradas, párrafos). Devuelve una estructura de
 * datos, nunca HTML: el componente `MarkdownBasico` la pinta con elementos
 * de React, así que el texto siempre pasa por el escape de React y no hay
 * forma de inyectar HTML (sin `dangerouslySetInnerHTML` ni sanitizador).
 *
 * Tolera texto incompleto mientras llega en streaming: un `**` sin cerrar
 * se muestra tal cual hasta que llega su cierre.
 */
export interface Segmento {
  texto: string;
  negrita?: boolean;
  cursiva?: boolean;
}

export type Bloque =
  | { tipo: 'parrafo'; lineas: Segmento[][] }
  | { tipo: 'lista'; ordenada: boolean; items: Segmento[][] };

const RE_VINETA = /^\s*[-*•]\s+(.*)$/;
const RE_NUMERADA = /^\s*\d+[.)]\s+(.*)$/;
const RE_ENCABEZADO = /^\s*#{1,6}\s+(.*)$/;
// **negrita** | *cursiva* (sin espacios pegados a los asteriscos, para no
// confundir "2 * 3 * 4" con una cursiva).
const RE_EN_LINEA = /\*\*(.+?)\*\*|\*(?!\s)([^*]+?)(?<!\s)\*/g;

export function parsearEnLinea(texto: string): Segmento[] {
  const segmentos: Segmento[] = [];
  let ultimo = 0;
  for (const coincidencia of texto.matchAll(RE_EN_LINEA)) {
    const inicio = coincidencia.index;
    if (inicio > ultimo) segmentos.push({ texto: texto.slice(ultimo, inicio) });
    if (coincidencia[1] !== undefined) segmentos.push({ texto: coincidencia[1], negrita: true });
    else segmentos.push({ texto: coincidencia[2], cursiva: true });
    ultimo = inicio + coincidencia[0].length;
  }
  if (ultimo < texto.length) segmentos.push({ texto: texto.slice(ultimo) });
  return segmentos;
}

export function parsearMarkdownBasico(texto: string): Bloque[] {
  const bloques: Bloque[] = [];
  let actual: Bloque | null = null;

  for (const linea of texto.split('\n')) {
    const vineta = RE_VINETA.exec(linea);
    const numerada = vineta ? null : RE_NUMERADA.exec(linea);
    const item = vineta ?? numerada;

    if (item) {
      const ordenada = Boolean(numerada);
      if (actual?.tipo !== 'lista' || actual.ordenada !== ordenada) {
        actual = { tipo: 'lista', ordenada, items: [] };
        bloques.push(actual);
      }
      actual.items.push(parsearEnLinea(item[1]));
      continue;
    }

    if (linea.trim() === '') {
      actual = null; // una línea vacía cierra el párrafo o la lista
      continue;
    }

    // Los encabezados no están permitidos en el prompt; si el modelo los
    // usa igual, se muestran como una línea en negrita en vez de "### ...".
    const encabezado = RE_ENCABEZADO.exec(linea);
    const segmentos = encabezado
      ? [{ texto: encabezado[1].replace(/\*\*/g, ''), negrita: true }]
      : parsearEnLinea(linea);

    if (actual?.tipo !== 'parrafo') {
      actual = { tipo: 'parrafo', lineas: [] };
      bloques.push(actual);
    }
    actual.lineas.push(segmentos);
  }

  return bloques;
}
