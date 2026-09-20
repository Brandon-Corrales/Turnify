import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GeminiLlmClient } from './gemini-llm-client.service';

const generateContentStreamMock = vi.fn();

// Simula el SDK completo de Gemini — nunca se llama a la API real en un
// test unitario (mismo patrón que StripeService/stripe.service.spec.ts).
// vi.mock() se iza antes de los imports de arriba.
vi.mock('@google/genai', () => {
  class GoogleGenAIMock {
    models = { generateContentStream: generateContentStreamMock };
  }
  return { GoogleGenAI: GoogleGenAIMock };
});

function crearConfigMock(valores: Record<string, string | undefined>) {
  return {
    get: (clave: string) =>
      valores[clave] ?? (clave === 'LLM_MODEL' ? 'gemini-3.6-flash' : undefined),
  } as unknown as ConfigService<any, true>;
}

async function* streamDeChunks(textos: string[]) {
  for (const texto of textos) {
    yield { text: texto };
  }
}

describe('GeminiLlmClient', () => {
  beforeEach(() => {
    generateContentStreamMock.mockReset();
  });

  it('lanza si LLM_API_KEY no está configurada, sin llamar al SDK', async () => {
    const client = new GeminiLlmClient(crearConfigMock({}));
    const generador = client.generarRespuestaStream('system', [{ rol: 'user', texto: 'hola' }]);
    await expect(generador.next()).rejects.toThrow('LLM_API_KEY no configurada');
    expect(generateContentStreamMock).not.toHaveBeenCalled();
  });

  it('arma la llamada con model/contents/systemInstruction y transmite los fragmentos de texto', async () => {
    generateContentStreamMock.mockResolvedValue(streamDeChunks(['Hola ', 'mundo']));
    const client = new GeminiLlmClient(
      crearConfigMock({ LLM_API_KEY: 'clave-fake', LLM_MODEL: 'gemini-3.6-flash' }),
    );

    const fragmentos: string[] = [];
    for await (const fragmento of client.generarRespuestaStream('Eres un asistente', [
      { rol: 'user', texto: '¿Qué es Turnify?' },
    ])) {
      fragmentos.push(fragmento);
    }

    expect(fragmentos).toEqual(['Hola ', 'mundo']);
    expect(generateContentStreamMock).toHaveBeenCalledWith({
      model: 'gemini-3.6-flash',
      contents: [{ role: 'user', parts: [{ text: '¿Qué es Turnify?' }] }],
      config: { systemInstruction: 'Eres un asistente' },
    });
  });

  it('omite chunks sin texto (respuestas vacías intermedias del stream)', async () => {
    generateContentStreamMock.mockResolvedValue(streamDeChunks(['', 'listo']));
    const client = new GeminiLlmClient(crearConfigMock({ LLM_API_KEY: 'clave-fake' }));

    const fragmentos: string[] = [];
    for await (const fragmento of client.generarRespuestaStream('system', [
      { rol: 'user', texto: 'hola' },
    ])) {
      fragmentos.push(fragmento);
    }

    expect(fragmentos).toEqual(['listo']);
  });
});
