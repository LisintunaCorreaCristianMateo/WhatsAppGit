'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Contacto = { id: string; telefono: string; nombre: string | null; ultimaRespuestaClienteEn?: string | null };
type Mensaje = { id: string; texto: string; origen: 'CLIENTE' | 'SISTEMA'; creadoEn: string };
type Plantilla = { id: string; nombre: string; etiqueta: string; contenido: string; idioma: string };

export default function ChatPage() {
  const [contactos, setContactos] = useState<Contacto[]>([]);
  const [chatActivo, setChatActivo] = useState<Contacto | null>(null);
  const [mensajes, setMensajes] = useState<Mensaje[]>([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [nuevoTelefono, setNuevoTelefono] = useState('');
  const [mostrandoNuevoChat, setMostrandoNuevoChat] = useState(false);
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [plantillaSeleccionada, setPlantillaSeleccionada] = useState('');
  const [variablesPlantilla, setVariablesPlantilla] = useState('');

  // Cargar lista de contactos al iniciar
  const fetchContactos = async () => {
    try {
      const res = await fetch('/api/chats');
      if (!res.ok) return;
      const data = await res.json();
      setContactos(data);
    } catch (e) {
      // Ignorar errores de red/JSON durante recargas del servidor
    }
  };

  // Cargar mensajes del chat seleccionado
  const fetchMensajes = async (contactoId: string) => {
    try {
      const res = await fetch(`/api/messeges/${contactoId}`);
      if (!res.ok) return;
      const data = await res.json();
      setMensajes(data);
    } catch (e) {
      // Ignorar errores de red/JSON durante recargas del servidor
    }
  };

  // Cargar plantillas disponibles
  const fetchPlantillas = async () => {
    try {
      const res = await fetch('/api/templates');
      if (!res.ok) return;
      const data = await res.json();
      setPlantillas(data);
      if (data.length > 0) setPlantillaSeleccionada(data[0].nombre);
    } catch (e) {}
  };

  useEffect(() => {
    fetchContactos();
    fetchPlantillas();
    const interval = setInterval(() => {
      fetchContactos();
      if (chatActivo) fetchMensajes(chatActivo.id);
    }, 5000);
    return () => clearInterval(interval);
  }, [chatActivo]);

  const handleSeleccionarChat = (contacto: Contacto) => {
    setChatActivo(contacto);
    if (!contacto.id.startsWith('temp-')) {
      fetchMensajes(contacto.id);
    } else {
      setMensajes([]);
    }
  };

  const iniciarNuevoChat = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevoTelefono.trim()) return;
    
    setLoading(true);
    const telefonoLimpio = nuevoTelefono.replace(/\D/g, '');
    
    // Crear un chat temporal en el estado
    const nuevoContacto = { 
      id: 'temp-' + Date.now(), 
      telefono: telefonoLimpio, 
      nombre: nuevoTelefono 
    };
    
    setChatActivo(nuevoContacto);
    setMensajes([]);
    setContactos((prev) => [nuevoContacto, ...prev]);
    setNuevoTelefono('');
    setVariablesPlantilla('');
    setMostrandoNuevoChat(false);

    try {
      const resp = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          telefono: telefonoLimpio, 
          type: 'template', 
          templateName: plantillaSeleccionada,
          variables: variablesPlantilla
        }),
      });
      const data = await resp.json();

      if (!resp.ok) {
        alert(`Error al enviar la plantilla: ${data.error?.error?.message || data.message || 'Error desconocido'}`);
        setLoading(false);
        return;
      }

      // Usar el ID real devuelto por la API para cargar los mensajes
      if (data.contacto) {
        setChatActivo(data.contacto);
        fetchContactos();
        fetchMensajes(data.contacto.id);
      }
    } catch (error) {
      console.error('Error enviando plantilla:', error);
    } finally {
      setLoading(false);
    }
  };

  const enviarMensaje = async () => {
    if (!inputText.trim() || !chatActivo) return;

    const textoAEnviar = inputText;
    setInputText('');
    setLoading(true);

    try {
      const resp = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telefono: chatActivo.telefono, texto: textoAEnviar }),
      });
      const data = await resp.json();

      if (resp.status === 403 && data.error === 'VENTANA_CERRADA') {
        setInputText(textoAEnviar); // Restaurar el texto
        alert('\u26d4 Ventana de 24h cerrada. El cliente no ha respondido recientemente. Solo puedes enviar plantillas.');
        setLoading(false);
        return;
      }

      let currentChatId = chatActivo.id;
      if (chatActivo.id.startsWith('temp-') && data.contacto) {
        currentChatId = data.contacto.id;
        setChatActivo(data.contacto);
        fetchContactos();
      }
      fetchMensajes(currentChatId);
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  // Comprobar si la ventana de 24h está abierta para el chat activo
  const ventana24hAbierta = (): boolean => {
    if (!chatActivo?.ultimaRespuestaClienteEn) return false;
    const hace24h = new Date();
    hace24h.setHours(hace24h.getHours() - 24);
    return new Date(chatActivo.ultimaRespuestaClienteEn) > hace24h;
  };

  return (
    <div className="flex h-screen bg-gray-100 text-gray-800 font-sans">
      {/* Barra lateral de contactos */}
      <div className="w-1/3 bg-white border-r border-gray-300 flex flex-col">
        <div className="p-4 bg-gray-50 border-b border-gray-300 flex justify-between items-center">
          <div>
            <h1 className="text-xl font-bold">Mi WhatsApp</h1>
            <h2 className="text-sm text-gray-500">Desarrollado por Cristian</h2>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/plantillas"
              className="text-xs text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded transition"
              title="Gestionar plantillas"
            >
              📋 Plantillas
            </Link>
            <button 
              onClick={() => setMostrandoNuevoChat(!mostrandoNuevoChat)}
              className="bg-emerald-500 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-emerald-600 transition"
              title="Nuevo chat"
            >
              +
            </button>
          </div>
        </div>

        {mostrandoNuevoChat && (
          <form onSubmit={iniciarNuevoChat} className="p-4 bg-gray-100 border-b border-gray-300 flex flex-col gap-3">
            <input 
              type="text" 
              placeholder="52..."
              value={nuevoTelefono}
              onChange={(e) => setNuevoTelefono(e.target.value)}
              className="px-3 py-1 text-sm rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <select 
              value={plantillaSeleccionada}
              onChange={(e) => setPlantillaSeleccionada(e.target.value)}
              className="px-3 py-1 text-sm rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            >
              {plantillas.length === 0 ? (
                <option disabled value="">Sin plantillas — ve a 📋 Plantillas</option>
              ) : (
                plantillas.map((p) => (
                  <option key={p.id} value={p.nombre}>{p.etiqueta}</option>
                ))
              )}
            </select>
            {/* Hint dinámico basado en la plantilla seleccionada */}
            {(() => {
              const p = plantillas.find(pl => pl.nombre === plantillaSeleccionada);
              if (!p) return null;
              const matches = [...p.contenido.matchAll(/\{\{(\d+)\}\}/g)];
              const count = new Set(matches.map(m => m[1])).size;
              if (count === 0) return (
                <p className="text-xs text-gray-500 bg-white rounded p-2 border border-gray-200">
                  ℹ️ Esta plantilla no tiene variables.
                </p>
              );
              return (
                <div className="text-xs text-amber-700 bg-amber-50 rounded p-2 border border-amber-200">
                  ⚠️ Esta plantilla necesita <strong>{count} variable(s)</strong> separadas por coma.
                  <br/>Preview: <span className="font-mono text-gray-600">{p.contenido.replace(/\{\{(\d+)\}\}/g, (_, i) => `[var${i}]`)}</span>
                </div>
              );
            })()}
            <input 
              type="text" 
              placeholder="Variables (nombre, financiera)"
              title="Valores separados por coma para {{1}}, {{2}}, etc."
              value={variablesPlantilla}
              onChange={(e) => setVariablesPlantilla(e.target.value)}
              className="px-3 py-1 text-sm rounded border border-gray-300 focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
            <button type="submit" disabled={loading} className="bg-emerald-600 text-white px-3 py-1 rounded text-sm hover:bg-emerald-700 disabled:opacity-50">
              Enviar Plantilla y Abrir Chat
            </button>
          </form>
        )}

        <div className="flex-1 overflow-y-auto">
          {contactos.map((contacto) => (
            <div
              key={contacto.id}
              onClick={() => handleSeleccionarChat(contacto)}
              className={`p-4 border-b cursor-pointer hover:bg-gray-100 ${
                chatActivo?.id === contacto.id ? 'bg-gray-200' : ''
              }`}
            >
              <h2 className="font-semibold">{contacto.nombre || contacto.telefono}</h2>
              <p className="text-sm text-gray-500">+{contacto.telefono}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Área principal del chat */}
      <div className="flex-1 flex flex-col bg-[url('https://user-images.githubusercontent.com/15075759/28719144-86dc0f70-73b1-11e7-911d-60d70fcded21.png')] bg-cover">
        {chatActivo ? (
          <>
            <div className="p-4 bg-gray-50 border-b flex items-center shadow-sm">
              <h2 className="font-bold text-lg">{chatActivo.nombre || `+${chatActivo.telefono}`}</h2>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {mensajes.map((msg) => (
                <div key={msg.id} className={`flex ${msg.origen === 'SISTEMA' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`px-4 py-2 rounded-lg max-w-md shadow ${
                    msg.origen === 'SISTEMA' ? 'bg-[#d9fdd3]' : 'bg-white'
                  }`}>
                    <p>{msg.texto}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-gray-100 flex flex-col gap-2">
              {!ventana24hAbierta() && (
                <div className="bg-amber-100 border border-amber-300 text-amber-800 text-xs rounded px-3 py-2 flex items-center gap-2">
                  <span>⛔</span>
                  <span>Ventana de 24h cerrada. El cliente no ha respondido. Solo puedes usar plantillas.</span>
                </div>
              )}
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder={ventana24hAbierta() ? 'Escribe un mensaje...' : 'Bloqueado — Usa plantillas para iniciar'}
                  className={`flex-1 rounded-lg px-4 py-2 border-none focus:ring-2 focus:ring-emerald-500 outline-none ${
                    !ventana24hAbierta() ? 'bg-gray-200 cursor-not-allowed text-gray-400' : ''
                  }`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && ventana24hAbierta() && enviarMensaje()}
                  disabled={loading || !ventana24hAbierta()}
                />
                <button
                  onClick={enviarMensaje}
                  disabled={loading || !ventana24hAbierta()}
                  className="bg-emerald-600 text-white px-6 py-2 rounded-lg font-medium disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Enviar
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="bg-white/80 p-6 rounded-2xl shadow-sm text-center">
              <h2 className="text-2xl font-light text-gray-600">Selecciona un chat para empezar</h2>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}