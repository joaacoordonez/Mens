import express from "express";
import bodyParser from "body-parser";
import multer from "multer";
import fs from "fs";
import pdfParse from "pdf-parse";
import ollama from "ollama";

const app = express();
app.use(bodyParser.json());

// Configuración de Multer para subir archivos
const upload = multer({ dest: "uploads/" });

// Guardamos historial simple en memoria
let historial = [];

// Subida de PDF
app.post("/subir-apunte", upload.single("archivo"), async (req, res) => {
  try {
    const dataBuffer = fs.readFileSync(req.file.path);
    const pdfData = await pdfParse(dataBuffer);
    const texto = pdfData.text.substring(0, 2000); // limitar texto

    // Eliminamos archivo temporal
    fs.unlinkSync(req.file.path);

    // Guardamos el texto como contexto inicial
    historial.push({
      role: "system",
      content: `Estos son los apuntes que debes usar como referencia para hacer preguntas: ${texto}`
    });

    res.json({ mensaje: "✅ Apunte cargado correctamente, ya podés empezar el chat." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al procesar el PDF" });
  }
});

// Chat: el bot genera preguntas y evalúa respuestas
app.post("/chat", async (req, res) => {
  const { mensaje } = req.body;

  try {
    // Guardamos lo que dijo el usuario
    historial.push({ role: "user", content: mensaje });

    // Llamamos a Ollama con el historial
    const response = await ollama.chat({
      model: "llama3",
      messages: [
        { role: "system", content: "Eres un profesor que hace preguntas de repaso basadas en los apuntes proporcionados." },
        ...historial
      ]
    });

    const respuestaBot = response.message?.content || "⚠️ No entendí la respuesta";

    // Guardamos respuesta del bot
    historial.push({ role: "assistant", content: respuestaBot });

    res.json({ respuesta: respuestaBot });
  } catch (error) {
    console.error("Error con Ollama:", error);
    res.status(500).json({ error: "Error en el chat con Ollama" });
  }
});

// Reiniciar historial
app.post("/reset", (req, res) => {
  historial = [];
  res.json({ mensaje: "Historial reseteado." });
});

app.listen(3000, () => {
  console.log("✅ Servidor corriendo en http://localhost:3000");
});
