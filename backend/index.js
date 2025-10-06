// index.js
import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import fs from "fs";
import cors from "cors";
import ollama from "ollama";
import { supabase } from "./supabaseClient.js";  // Importamos el cliente de Supabase

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Configuración de Multer para subir archivos
const upload = multer({ dest: "uploads/" });

// Guardamos historial simple en memoria
let historial = [];
let currentChatId = null;

// Crear o recuperar sesión de usuario
async function getOrCreateUserSession() {
  try {
    const { data, error } = await supabase.from("user_sessions").select("id").limit(1).single();
    if (error || !data) {
      const { data: newSession, error: insertError } = await supabase.from("user_sessions").insert({}).select("id").single();
      if (insertError) throw insertError;
      console.log("Nueva sesión creada:", newSession);  // Log para verificar si se crea la sesión
      return newSession.id;
    }
    console.log("Sesión existente:", data);  // Log para verificar la sesión existente
    return data.id;
  } catch (error) {
    console.error("Error en getOrCreateUserSession:", error);
    throw error;
  }
}


// Subida de PDF
app.post("/subir-apunte", upload.single("archivo"), async (req, res) => {
  try {
    const { default: pdfParse } = await import("pdf-parse");
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const texto = pdfData.text.substring(0, 2000); // limitar texto

    // Eliminamos archivo temporal
    fs.unlinkSync(req.file.path);

    // Obtener o crear sesión de usuario
    const userSessionId = await getOrCreateUserSession();

    // Crear nuevo chat
    const { data: chatData, error: chatError } = await supabase
      .from("chats")
      .insert([{ user_session_id: userSessionId, title: "Chat de apuntes" }])
      .select("id")
      .single();
    if (chatError) throw chatError;

    currentChatId = chatData.id;

    // Guardar nota en la base de datos
    const { error: noteError } = await supabase.from("notes").insert([{
      chat_id: currentChatId,
      source: "pdf",
      content: texto,
    }]);
    if (noteError) throw noteError;

    // Guardar el texto como contexto inicial en historial en memoria
    historial = [{
      role: "system",
      content: `Estos son los apuntes que debes usar como referencia para hacer preguntas: ${texto}`,
    }];

    res.json({ mensaje: "✅ Apunte cargado correctamente, ya podés empezar el chat." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al procesar el PDF" });
  }
});

// Subida de texto
app.post("/subir-texto", async (req, res) => {
  const { texto } = req.body;
  try {
    if (!texto || texto.trim().length === 0) {
      return res.status(400).json({ error: "Texto vacío" });
    }

    const textoLimitado = texto.substring(0, 2000);

    // Obtener o crear sesión de usuario
    const userSessionId = await getOrCreateUserSession();

    // Crear nuevo chat
    const { data: chatData, error: chatError } = await supabase
      .from("chats")
      .insert([{ user_session_id: userSessionId, title: "Chat de apuntes" }])
      .select("id")
      .single();
    if (chatError) throw chatError;

    currentChatId = chatData.id;

    // Guardar nota en la base de datos
    const { error: noteError } = await supabase.from("notes").insert([{
      chat_id: currentChatId,
      source: "text",
      content: textoLimitado,
    }]);
    if (noteError) throw noteError;

    // Guardar el texto como contexto inicial en historial en memoria
    historial = [{
      role: "system",
      content: `Estos son los apuntes que debes usar como referencia para hacer preguntas: ${textoLimitado}`,
    }];

    res.json({ mensaje: "✅ Texto cargado correctamente, ya podés empezar el chat." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al procesar el texto" });
  }
});

// Chat: el bot genera preguntas y evalúa respuestas
app.post("/chat", async (req, res) => {
  const { mensaje } = req.body;

  try {
    if (!currentChatId) {
      return res.status(400).json({ error: "No hay chat activo. Por favor, sube un apunte primero." });
    }

    // Guardamos lo que dijo el usuario en memoria
    historial.push({ role: "user", content: mensaje });

    // Guardamos mensaje en la base de datos
    const { error: messageError } = await supabase.from("messages").insert([{
      chat_id: currentChatId,
      role: "user",
      content: mensaje,
    }]);
    if (messageError) throw messageError;

    // Llamamos a Ollama con el historial
    const response = await ollama.chat({
      model: "llama3",
      messages: [
        { role: "system", content: "Eres un profesor que hace preguntas de repaso basadas en los apuntes proporcionados." },
        ...historial,
      ],
    });

    const respuestaBot = response.message?.content || "⚠️ No entendí la respuesta";

    // Guardamos respuesta del bot en memoria
    historial.push({ role: "assistant", content: respuestaBot });

    // Guardamos respuesta del bot en la base de datos
    const { error: assistantMessageError } = await supabase.from("messages").insert([{
      chat_id: currentChatId,
      role: "assistant",
      content: respuestaBot,
    }]);
    if (assistantMessageError) throw assistantMessageError;

    res.json({ respuesta: respuestaBot });
  } catch (error) {
    console.error("Error con Ollama o Supabase:", error);
    res.status(500).json({ error: "Error en el chat con Ollama o Supabase" });
  }
});

// Listar chats
app.get("/chats", async (req, res) => {
  try {
    const userSessionId = await getOrCreateUserSession();
    const { data: chats, error } = await supabase
      .from("chats")
      .select("id, title, created_at")
      .eq("user_session_id", userSessionId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error al obtener chats:", error);
      return res.status(500).json({ error: "Error al obtener chats" });
    }

    console.log("Chats recuperados:", chats);  // Log para ver los chats
    res.json({ chats });
  } catch (error) {
    console.error("Error al recuperar chats:", error);
    res.status(500).json({ error: "Error al obtener chats" });
  }
});


// Seleccionar chat
app.post("/select-chat", async (req, res) => {
  const { chatId } = req.body;
  try {
    if (!chatId) {
      return res.status(400).json({ error: "chatId requerido" });
    }

    // Verificar que el chat pertenece a la sesión
    const userSessionId = await getOrCreateUserSession();
    const { data: chat, error: chatError } = await supabase
      .from("chats")
      .select("id")
      .eq("user_session_id", userSessionId)
      .eq("id", chatId)
      .single();

    if (chatError || !chat) {
      return res.status(404).json({ error: "Chat no encontrado" });
    }

    currentChatId = chat.id;
    res.json({ mensaje: `Chat ${chatId} seleccionado` });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al seleccionar el chat" });
  }
});

// Iniciar servidor
app.listen(3000, () => {
  console.log("✅ Servidor corriendo en http://localhost:3000");
});
