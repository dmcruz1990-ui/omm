
import { GoogleGenAI } from "@google/genai";

export const askNexumAI = async (
  userMessage: string,
  history: { role: 'user' | 'model'; text: string }[],
  eventContext: string = "" // Contexto dinámico de eventos
): Promise<string> => {
  try {
    const apiKey = import.meta.env.VITE_GOOGLE_API_KEY || (typeof process !== 'undefined' ? process.env.API_KEY : undefined);
    const ai = new GoogleGenAI({ apiKey });
    
    const AGENT_INSTRUCTION = `
      Eres NEXUM, el Concierge de OMM. Gestionas Reservas de Mesa y Venta de Entradas para Eventos.

      CONTEXTO DE EVENTOS PRÓXIMOS (Dinamico):
      ${eventContext || "No hay eventos especiales programados hoy."}

      ZONAS PARA RESERVAS NORMALES:
      1. Mantra Amatista (Zen, interior)
      2. Eterno (Terraza, vibrante)
      
      REGLAS DE OPERACIÓN:
      - Si el usuario pregunta por planes o qué hacer, menciona los EVENTOS PRÓXIMOS primero.
      - Para RESERVAS DE MESA normales: Necesitas Nombre, Teléfono, Fecha/Hora, Pax y Zona.
      - Para ENTRADAS DE EVENTO: Necesitas Nombre, Teléfono, Email, y Cantidad.

      FORMATOS OBLIGATORIOS DE CIERRE:
      Solo cuando tengas TODOS los datos, termina con una de estas líneas exactamente:

      PARA MESAS:
      CONFIRMAR_RESERVA: [Nombre], [Telefono], [FechaHora], [Personas], [Zona/Plan]

      PARA EVENTOS:
      CONFIRMAR_EVENTO: [ID_EVENTO], [Nombre], [Telefono], [Email], [Cantidad]

      Ejemplo de evento: CONFIRMAR_EVENTO: 1, Juan Perez, 300123, juan@mail.com, 2
    `;

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
    return "Lo siento, hubo un error de conexión.";
  }
};
