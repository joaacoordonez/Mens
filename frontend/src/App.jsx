import { useState, useEffect } from 'react';
import './App.css';

function App() {
  const [chats, setChats] = useState([]);
  const [selectedChat, setSelectedChat] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [showNewChat, setShowNewChat] = useState(false);
  const [textInput, setTextInput] = useState('');

  useEffect(() => {
    loadChats();
  }, []);

  const loadChats = async () => {
    try {
      const response = await fetch('http://localhost:3000/chats');
      const data = await response.json();
      if (response.ok) {
        setChats(data.chats);
      }
    } catch (error) {
      console.error('Error loading chats');
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('archivo', file);

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/subir-apunte', {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (response.ok) {
        setMessages([{ role: 'system', content: data.mensaje }]);
        setShowNewChat(false);
        loadChats(); // Reload chats
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Error al subir el archivo');
    }
    setLoading(false);
  };

  const handleTextUpload = async () => {
    if (!textInput.trim()) return;

    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/subir-texto', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texto: textInput }),
      });
      const data = await response.json();
      if (response.ok) {
        setMessages([{ role: 'system', content: data.mensaje }]);
        setTextInput('');
        setShowNewChat(false);
        loadChats();
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Error al subir el texto');
    }
    setLoading(false);
  };

  const selectChat = async (chatId) => {
    setLoading(true);
    try {
      const response = await fetch('http://localhost:3000/select-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatId }),
      });
      const data = await response.json();
      if (response.ok) {
        setSelectedChat(chatId);
        setMessages(data.messages);
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Error al seleccionar chat');
    }
    setLoading(false);
  };

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    const userMessage = { role: 'user', content: input };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('http://localhost:3000/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mensaje: input }),
      });
      const data = await response.json();
      if (response.ok) {
        const botMessage = { role: 'assistant', content: data.respuesta };
        setMessages(prev => [...prev, botMessage]);
      } else {
        alert(data.error);
      }
    } catch (error) {
      alert('Error en el chat');
    }
    setLoading(false);
  };

  const handleReset = async () => {
    try {
      await fetch('http://localhost:3000/reset', { method: 'POST' });
      setMessages([]);
      setSelectedChat(null);
    } catch (error) {
      alert('Error al resetear');
    }
  };

  return (
    <div className="app">
      <div className="sidebar">
        <h2>Chats</h2>
        <button onClick={() => setShowNewChat(true)}>Nuevo Chat</button>
        {chats.map(chat => (
          <div
            key={chat.id}
            className={`chat-item ${selectedChat === chat.id ? 'selected' : ''}`}
            onClick={() => selectChat(chat.id)}
          >
            {chat.title} - {new Date(chat.created_at).toLocaleDateString()}
          </div>
        ))}
      </div>
      <div className="main">
        <h1>Chatbot de Apuntes</h1>
        {showNewChat ? (
          <div className="new-chat-section">
            <h3>Nuevo Chat</h3>
            <div>
              <label>Subir PDF:</label>
              <input type="file" accept=".pdf" onChange={handleFileUpload} />
            </div>
            <div>
              <label>O pegar texto:</label>
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Pega tus apuntes aquí..."
                rows={10}
              />
              <button onClick={handleTextUpload} disabled={loading}>Crear Chat con Texto</button>
            </div>
            {loading && <p>Creando chat...</p>}
          </div>
        ) : selectedChat ? (
          <div className="chat-section">
            <div className="messages">
              {messages.map((msg, index) => (
                <div key={index} className={`message ${msg.role}`}>
                  <strong>{msg.role === 'user' ? 'Tú:' : msg.role === 'assistant' ? 'Bot:' : 'Sistema:'}</strong> {msg.content}
                </div>
              ))}
              {loading && <p>Esperando respuesta...</p>}
            </div>
            <div className="input-section">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                placeholder="Escribe tu respuesta o pregunta..."
              />
              <button onClick={handleSendMessage} disabled={loading}>Enviar</button>
              <button onClick={handleReset}>Resetear</button>
            </div>
          </div>
        ) : (
          <p>Selecciona un chat o crea uno nuevo.</p>
        )}
      </div>
    </div>
  );
}

export default App;
