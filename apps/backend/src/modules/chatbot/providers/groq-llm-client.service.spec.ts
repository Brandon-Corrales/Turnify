import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfigService } from '@nestjs/config';
import { GroqLlmClient } from './groq-llm-client.service';

const chatCompletionsCreateMock = vi.fn();

// Simula el SDK completo de OpenAI (que Groq reutiliza vía baseURL) —
// nunca se llama a la API real en un test unitario (mismo patrón que
// StripeService/stripe.service.spec.ts). vi.mock() se iza antes de los
// imports de arriba.
vi.mock('openai', () => {
  class OpenAIMock {
    chat = { completions: { create: chatCompletionsCreateMock } };
  }
  return { default: OpenAIMock };
});

function crearConfigMock(valores: Record<string, string | undefined>) {
  return {
    get: (clave: string) =>
      valores[clave] ?? (clave === 'LLM_MODEL' ? 'openai/gpt-oss-20b' : undefined),
  } as unknown as ConfigService<any, true>;
}

async function* streamDeChunks(textos: string[]) {
  for (const texto of textos) {
    yield { choices: [{ delta: { content: texto } }] };
  }
}

describe('GroqLlmClient', () => {
  beforeEach(() => {
    chatCompletionsCreateMock.mockReset();
  });

  it('lanza si LLM_API_KEY no está configurada, sin llamar al SDK', async () => {
    const client = new GroqLlmClient(crearConfigMock({}));
    const generador = client.generarRespuestaStream('system', [{ rol: 'user', texto: 'hola' }]);
    await expect(generador.next()).rejects.toThrow('LLM_API_KEY no configurada');
    expect(chatCompletionsCreateMock).not.toHaveBeenCalled();
  });

  it('arma la llamada con system prompt + historial mapeado a roles OpenAI, y transmite los fragmentos de texto', async () => {
    chatCompletionsCreateMock.mockResolvedValue(streamDeChunks(['Hola ', 'mundo']));
    const client = new GroqLlmClient(
      crearConfigMock({ LLM_API_KEY: 'clave-fake', LLM_MODEL: 'openai/gpt-oss-20b' }),
    );

    const fragmentos: string[] = [];
    for await (const fragmento of client.generarRespuestaStream('Eres un asistente', [
      { rol: 'user', texto: '¿Qué es Turnify?' },
      { rol: 'model', texto: 'Es un SaaS de reservas.' },
    ])) {
      fragmentos.push(fragmento);
    }

    expect(fragmentos).toEqual(['Hola ', 'mundo']);
    expect(chatCompletionsCreateMock).toHaveBeenCalledWith({
      model: 'openai/gpt-oss-20b',
      stream: true,
      messages: [
        { role: 'system', content: 'Eres un asistente' },
        { role: 'user', content: '¿Qué es Turnify?' },
        { role: 'assistant', content: 'Es un SaaS de reservas.' },
      ],
    });
  });

  it('omite chunks sin contenido en el delta (respuestas vacías intermedias del stream)', async () => {
    chatCompletionsCreateMock.mockResolvedValue(streamDeChunks(['', 'listo']));
    const client = new GroqLlmClient(crearConfigMock({ LLM_API_KEY: 'clave-fake' }));

    const fragmentos: string[] = [];
    for await (const fragmento of client.generarRespuestaStream('system', [
      { rol: 'user', texto: 'hola' },
    ])) {
      fragmentos.push(fragmento);
    }

    expect(fragmentos).toEqual(['listo']);
  });
});
