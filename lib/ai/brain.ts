
import { GoogleGenAI } from "@google/genai";

// NUEVO PROMPT: Mandato estricto para finalización y formato de reserva
const AGENT_INSTRUCTION = `
Eres NEXUM, el Asistente de Reservas de OMM.
Tu misión es confirmar reservas.

PLANES:
1. Romántica
2. Negocios
3. Foodie
4. Master

REGLA DE ORO (CRÍTICA):
Si ya tienes los datos básicos (Nombre, Teléfono, Tipo de Plan, Número de Personas y la Fecha/Hora), DEBES FINALIZAR.
NO hagas más preguntas.

FORMATO OBLIGATORIO DE CONFIRMACIÓN:
Tu respuesta final DEBE contener exactamente esta línea. NOTA IMPORTANTE: Junta la Fecha y la Hora en un solo dato.

CONFIRMAR_RESERVA: [Nombre], [Telefono], [FechaHora], [Personas], [Plan]

Ejemplo:
CONFIRMAR_RESERVA: Juan, 3001234567, Mañana 8PM, 2, Foodie

IMPORTANTE: "Mañana 8PM" va junto. "2" es el número de personas. No separes con comas adicionales. Es vital que incluyas la línea "CONFIRMAR_RESERVA:" para que el sistema funcione.
`;

export const askNexumAI = async (
  userMessage: string,
  history: { role: 'user' | 'model'; text: string }[]
): Promise<string> => {
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // Mapeamos el historial al formato que espera el SDK de Gemini
    const chatHistory = history.map(h => ({
      role: h.role,
      parts: [{ text: h.text }]
    }));

    const chat = ai.chats.create({
      model: "gemini-3-flash-preview",
      config: {
        systemInstruction: AGENT_INSTRUCTION,
        temperature: 0.7,
      },
      history: chatHistory
    });

    const result = await chat.sendMessage({ message: userMessage });
    return result.text || "Lo siento, no pude procesar tu mensaje.";
  } catch (error) {
    console.error("Error en Agente NEXUM:", error);
    return "Lo siento, hubo un error de conexión. Inténtalo de nuevo.";
  }
};
