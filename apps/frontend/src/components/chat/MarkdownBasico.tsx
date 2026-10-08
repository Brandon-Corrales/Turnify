import { Fragment } from 'react';
import { parsearMarkdownBasico, type Segmento } from '@/lib/markdown-basico';

function Linea({ segmentos }: { segmentos: Segmento[] }) {
  return segmentos.map((s, i) => {
    if (s.negrita) return <strong key={i}>{s.texto}</strong>;
    if (s.cursiva) return <em key={i}>{s.texto}</em>;
    return <Fragment key={i}>{s.texto}</Fragment>;
  });
}

/**
 * Pinta las respuestas del asistente con formato básico (ver
 * `lib/markdown-basico.ts`). Solo elementos de React, nunca HTML crudo.
 */
export function MarkdownBasico({ texto }: { texto: string }) {
  return (
    <div className="space-y-2">
      {parsearMarkdownBasico(texto).map((bloque, i) => {
        if (bloque.tipo === 'lista') {
          const Lista = bloque.ordenada ? 'ol' : 'ul';
          return (
            <Lista
              key={i}
              className={
                bloque.ordenada ? 'list-decimal space-y-1 pl-5' : 'list-disc space-y-1 pl-5'
              }
            >
              {bloque.items.map((item, j) => (
                <li key={j}>
                  <Linea segmentos={item} />
                </li>
              ))}
            </Lista>
          );
        }
        return (
          <p key={i}>
            {bloque.lineas.map((linea, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <Linea segmentos={linea} />
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
