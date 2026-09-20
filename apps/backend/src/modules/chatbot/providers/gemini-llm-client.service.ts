import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { GoogleGenAI } from '@google/genai';
import type { Env } from '../../../config/env.schema';
import type { LlmClient, MensajeLlm } from './llm-client.interface';

/**
 * Adaptador concreto de LlmClient para Google Gemini (Google AI Studio,
 * tier gratuito). Verificado contra el SDK real instalado (`@google/genai`)
 * — la API pública documentada es `ai.models.generateContentStream(...)`,
 * no la superficie "interactions" (más nueva, sin ejemplos de uso en el
 * propio paquete, se descartó a propósito).
 *
 * Modelo (`LLM_MODEL`, ver env.schema.ts): `gemini-2.5-flash` se probó
 * primero por estabilidad conocida, pero la API real lo rechazó en vivo
 * con 404 ("no longer available to new users... use
 * models/gemini-3.6-flash") — confirmado con la clave real de este
 * proyecto, no una suposición de documentación. Se cambió a
 * `gemini-3.6-flash`, que sí respondió correctamente en la verificación
 * de punta a punta.
 *

 * Privacidad (nota del equipo): en el tier gratuito, Google puede usar
 * prompts/respuestas para mejorar sus productos — por eso el contexto que
 * arma ChatbotService nunca incluye datos reales de CLIENTE ni
 * credenciales, solo información genérica del sistema y del negocio
 * propio del usuario autenticado (nombre, tipo, plan, conteos).
 */
@Injectable()
export class GeminiLlmClient implements LlmClient {
  private readonly logger = new Logger(GeminiLlmClient.name);
  private readonly cliente: GoogleGenAI | null;
  private readonly modelo: string;

  constructor(config: ConfigService<Env, true>) {
    const apiKey = config.get('LLM_API_KEY', { infer: true });
    this.cliente = apiKey ? new GoogleGenAI({ apiKey }) : null;
    this.modelo = config.get('LLM_MODEL', { infer: true });
  }

  async *generarRespuestaStream(
    systemPrompt: string,
    historial: MensajeLlm[],
  ): AsyncGenerator<string> {
    if (!this.cliente) {
      throw new Error('LLM_API_KEY no configurada');
    }

    const stream = await this.cliente.models.generateContentStream({
      model: this.modelo,
      contents: historial.map((m) => ({ role: m.rol, parts: [{ text: m.texto }] })),
      config: { systemInstruction: systemPrompt },
    });

    for await (const chunk of stream) {
      if (chunk.text) yield chunk.text;
    }
  }
}
