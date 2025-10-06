// supabaseClient.js
import { createClient } from "@supabase/supabase-js";
import https from "https";  // Importamos el módulo https para gestionar el SSL

// Creamos un https.Agent para deshabilitar la validación de certificados SSL
const agent = new https.Agent({
  rejectUnauthorized: false, // Deshabilitar validación del certificado
});

// Configuración de Supabase
const supabaseUrl = "https://zwbebfnipkbziwcknegg.supabase.co";
const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inp3YmViZm5pcGtieml3Y2tuZWdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk3NTIwMTgsImV4cCI6MjA3NTMyODAxOH0.nxqSTu0F0SpO45t1gqw6Cv2ckEg-qQSN7ZyooMRUStc"; // Asegúrate de usar tu clave real de Supabase

// Creamos el cliente de Supabase con la función fetch personalizada
const supabase = createClient(supabaseUrl, supabaseKey, {
  fetch: (url, options) => {
    return fetch(url, {
      ...options,
      agent, // Usamos el agente personalizado para evitar errores de SSL
    });
  },
});

export { supabase };
