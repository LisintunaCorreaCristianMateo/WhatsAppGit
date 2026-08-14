'use client';

import { useState, useEffect, useRef } from 'react';
import React from 'react';
import Link from 'next/link';
import { supabase } from '../lib/supabaseClient';

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
  const [mensajesNuevos, setMensajesNuevos] = useState<Set<string>>(new Set());
  const chatActivoRef = React.useRef<Contacto | null>(null);
  // Mapa de {contactoId -> ultimaRespuestaClienteEn} para detectar cambios
  const respuestasAnteriores = React.useRef<Record<string, string | null>>({});

  // Cargar lista de contactos al iniciar
  const fetchContactos = async () => {
    try {
      const res = await fetch('/api/chats');
      if (!res.ok) return;
      const data: Contacto[] = await res.json();
      setContactos(data);

      // ✅ Sincronizar chatActivo y detectar mensajes nuevos
      const activoActual = chatActivoRef.current;
      const nuevos = new Set(mensajesNuevos);

      data.forEach(actualizado => {
        const id = actualizado.id;
        const nuevaRespuesta = actualizado.ultimaRespuestaClienteEn;
        const anteriorRespuesta = respuestasAnteriores.current[id];

        // Inicializar el historial si es la primera vez que vemos este contacto
        if (anteriorRespuesta === undefined) {
          respuestasAnteriores.current[id] = nuevaRespuesta || null;
          return;
        }

        // Si hay una respuesta nueva
        if (nuevaRespuesta && nuevaRespuesta !== anteriorRespuesta) {
          respuestasAnteriores.current[id] = nuevaRespuesta; // Actualizar historial
          
          if (activoActual?.id === id) {
            // El cliente respondió en el chat activo — actualizar para desbloquear input
            setChatActivo(actualizado);
            chatActivoRef.current = actualizado;
          } else {
            // El cliente respondió en un chat inactivo — mostrar notificación
            nuevos.add(id);
          }
        }
      });
      
      setMensajesNuevos(nuevos);
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

    // Reemplazar setInterval por Supabase Realtime
    const channel = supabase.channel('realtime-mensajes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'Mensaje' },
        (payload) => {
          // Cuando llega un mensaje nuevo en la base de datos, refrescamos los datos
          fetchContactos();
          const activo = chatActivoRef.current;
          // Si el mensaje es para el chat que estamos viendo, refrescamos sus mensajes
          // payload.new contiene los datos de la fila insertada
          if (activo && payload.new && payload.new.contactoId === activo.id) {
            fetchMensajes(activo.id);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []); // Ya no depende de chatActivo porque usamos chatActivoRef por dentro

  const handleSeleccionarChat = (contacto: Contacto) => {
    setChatActivo(contacto);
    chatActivoRef.current = contacto;
    // Quitar punto de notificación
    setMensajesNuevos(prev => { 
      const s = new Set(prev); 
      s.delete(contacto.id); 
      return s; 
    });
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
        chatActivoRef.current = data.contacto;
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
              className="text-xs font-medium text-gray-500 hover:text-emerald-700 bg-white border border-gray-200 hover:border-emerald-200 hover:bg-emerald-50 px-3 py-1.5 rounded-full transition-all duration-200 shadow-sm"
              title="Gestionar plantillas"
            >
              Gestionar Plantillas
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
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Número de destino</label>
              <input 
                type="text" 
                placeholder="Ej: 521..."
                value={nuevoTelefono}
                onChange={(e) => setNuevoTelefono(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 shadow-sm"
              />
            </div>
            
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Plantilla</label>
              <select 
                value={plantillaSeleccionada}
                onChange={(e) => setPlantillaSeleccionada(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 shadow-sm appearance-none cursor-pointer"
              >
              {plantillas.length === 0 ? (
                <option disabled value="">Sin plantillas — ve a 📋 Plantillas</option>
              ) : (
                plantillas.map((p) => (
                  <option key={p.id} value={p.nombre}>{p.etiqueta}</option>
                ))
              )}
              </select>
            </div>
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
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">Variables</label>
              <input 
                type="text" 
                placeholder="Juan, Mi Financiera..."
                title="Valores separados por coma para {{1}}, {{2}}, etc."
                value={variablesPlantilla}
                onChange={(e) => setVariablesPlantilla(e.target.value)}
                className="w-full px-4 py-2.5 text-sm bg-white rounded-xl border border-gray-200 focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 transition-all duration-200 shadow-sm"
              />
            </div>

            <button type="submit" disabled={loading} className="mt-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100 shadow-sm flex justify-center items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
              Enviar Plantilla
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
              {mensajesNuevos.has(contacto.id) && chatActivo?.id !== contacto.id && (
                <span className="inline-block w-2.5 h-2.5 bg-emerald-500 rounded-full mt-1 animate-pulse" title="Mensaje nuevo"></span>
              )}
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
                  className={`flex-1 rounded-2xl px-5 py-3 border border-gray-200 focus:outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/10 transition-all duration-200 shadow-sm text-gray-700 ${
                    !ventana24hAbierta() ? 'bg-gray-100 cursor-not-allowed text-gray-400 border-gray-200' : 'bg-white'
                  }`}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && ventana24hAbierta() && enviarMensaje()}
                  disabled={loading || !ventana24hAbierta()}
                />
                <button
                  onClick={enviarMensaje}
                  disabled={loading || !ventana24hAbierta()}
                  className="bg-emerald-600 text-white px-6 py-3 rounded-2xl font-medium shadow-sm hover:bg-emerald-700 hover:shadow active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 flex items-center justify-center"
                >
                  <svg className="w-5 h-5 ml-1 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
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