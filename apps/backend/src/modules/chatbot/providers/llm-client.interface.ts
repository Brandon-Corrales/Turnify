export interface MensajeLlm {
  rol: 'user' | 'model';
  texto: string;
}

export const LLM_CLIENT = Symbol('LLM_CLIENT');

/**
 * Interfaz genérica de cliente LLM (punto 16 del brief: el módulo del
 * chatbot debe quedar desacoplado del proveedor específico). ChatbotService
 * solo conoce esta interfaz — cambiar de Gemini a otro proveedor implica
 * escribir una clase nueva que la implemente y cambiar un solo `provide`
 * en ChatbotModule, sin tocar ChatbotService ni el gateway.
 */
export interface LlmClient {
  /** Generación en streaming: cada elemento del async generator es un fragmento de texto nuevo (no acumulado). */
  generarRespuestaStream(systemPrompt: string, historial: MensajeLlm[]): AsyncGenerator<string>;
}
