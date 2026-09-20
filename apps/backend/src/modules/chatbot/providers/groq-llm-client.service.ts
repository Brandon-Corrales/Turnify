import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import OpenAI from 'openai';
import type { Env } from '../../../config/env.schema';
import type { LlmClient, MensajeLlm } from './llm-client.interface';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';

/**
 * Adaptador concreto de LlmClient para Groq. Groq expone una API
 * compatible con el SDK de OpenAI (mismo shape de `chat.completions.create`,
 * solo cambia `baseURL`) — se reusa el SDK oficial `openai` en vez de un
 * cliente hecho a mano, verificado contra el paquete real instalado
 * (`openai@7.20.0`): `client.chat.completions.create({..., stream: true})`
 * devuelve un `Stream<ChatCompletionChunk>` async-iterable, cada chunk trae
 * el texto en `choices[0].delta.content`.
 *
 * A diferencia de Gemini, esta API no tiene un campo separado para el
 * system prompt — va como un mensaje más con `role: 'system'` al inicio
 * de `messages`, y los turnos previos usan `role: 'assistant'` (no
 * `'model'`) para el LLM.
 *
 * Segundo proveedor de LlmClient de este proyecto (el primero, Gemini,
 * quedó bloqueado a nivel de proyecto de Google Cloud — ver PROGRESS.md):
 * cambiar de proveedor fue escribir esta clase y un `useClass` en
 * ChatbotModule, sin tocar ChatbotService/ChatbotGateway.
 *
 * Privacidad (mismo criterio que con Gemini, independiente del proveedor):
 * el contexto que arma ChatbotService nunca incluye datos reales de
 * CLIENTE ni credenciales, solo información genérica del sistema y del
 * negocio propio del usuario autenticado.
 */
@Injectable()
export class GroqLlmClient implements LlmClient {
  private readonly logger = new Logger(GroqLlmClient.name);
  private readonly cliente: OpenAI | null;
  private readonly modelo: string;

  constructor(config: ConfigService<Env, true>) {
    const apiKey = config.get('LLM_API_KEY', { infer: true });
    this.cliente = apiKey ? new OpenAI({ apiKey, baseURL: GROQ_BASE_URL }) : null;
    this.modelo = config.get('LLM_MODEL', { infer: true });
  }

  async *generarRespuestaStream(
    systemPrompt: string,
    historial: MensajeLlm[],
  ): AsyncGenerator<string> {
    if (!this.cliente) {
      throw new Error('LLM_API_KEY no configurada');
    }

    const mensajes: OpenAI.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      ...historial.map((m): OpenAI.ChatCompletionMessageParam =>
        m.rol === 'model'
          ? { role: 'assistant', content: m.texto }
          : { role: 'user', content: m.texto },
      ),
    ];

    const stream = await this.cliente.chat.completions.create({
      model: this.modelo,
      messages: mensajes,
      stream: true,
    });

    for await (const chunk of stream) {
      const fragmento = chunk.choices[0]?.delta?.content;
      if (fragmento) yield fragmento;
    }
  }
}
