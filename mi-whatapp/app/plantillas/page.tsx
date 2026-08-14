'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

type Plantilla = {
  id: string;
  nombre: string;
  etiqueta: string;
  contenido: string;
  idioma: string;
};

export default function PlantillasPage() {
  const [plantillas, setPlantillas] = useState<Plantilla[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    etiqueta: '',
    nombre: '',
    contenido: '',
    idioma: 'es',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const fetchPlantillas = async () => {
    try {
      const res = await fetch('/api/templates');
      if (!res.ok) return;
      const data = await res.json();
      setPlantillas(data);
    } catch (e) {
      // Ignorar errores durante recargas
    }
  };

  useEffect(() => {
    fetchPlantillas();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    const res = await fetch('/api/templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const data = await res.json();
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Error al guardar');
      return;
    }

    setSuccess('¡Plantilla guardada correctamente!');
    setForm({ etiqueta: '', nombre: '', contenido: '', idioma: 'es' });
    fetchPlantillas();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta plantilla?')) return;
    await fetch(`/api/templates/${id}`, { method: 'DELETE' });
    fetchPlantillas();
  };

  const previewRender = (contenido: string): string => {
    // Muestra una previsualización con variables de ejemplo resaltadas
    return contenido.replace(/\{\{(\d+)\}\}/g, (_, i) => `[variable ${i}]`);
  };

  return (
    <div className="min-h-screen bg-gray-50 font-sans">
      {/* Header */}
      <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between shadow">
        <div className="flex items-center gap-3">
          <Link href="/" className="text-white/80 hover:text-white transition text-sm">
            ← Volver al chat
          </Link>
          <span className="text-white/40">|</span>
          <h1 className="text-lg font-bold">Gestión de Plantillas</h1>
        </div>
        <span className="text-sm text-emerald-200">{plantillas.length} plantilla(s) registrada(s)</span>
      </div>

      <div className="max-w-5xl mx-auto p-6 grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
        {/* Formulario de nueva plantilla */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 mb-4">Agregar nueva plantilla</h2>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Nombre visible en la app
              </label>
              <input
                type="text"
                placeholder="Ej: Recordatorio de pago"
                value={form.etiqueta}
                onChange={(e) => setForm({ ...form, etiqueta: e.target.value })}
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Nombre en Meta <span className="text-gray-400">(exacto, ej: recordatorio_pago)</span>
              </label>
              <input
                type="text"
                placeholder="recordatorio_pago"
                value={form.nombre}
                onChange={(e) => setForm({ ...form, nombre: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                required
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Idioma del template en Meta
              </label>
              <input
                type="text"
                placeholder="es, en_US, es_MX..."
                value={form.idioma}
                onChange={(e) => setForm({ ...form, idioma: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-1">
                Contenido de la plantilla <span className="text-gray-400">(usa {`{{1}}`}, {`{{2}}`}, etc. para variables)</span>
              </label>
              <textarea
                placeholder="Hola {{1}}, tienes un pago pendiente con {{2}}."
                value={form.contenido}
                onChange={(e) => setForm({ ...form, contenido: e.target.value })}
                required
                rows={4}
                className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none font-mono"
              />
              {form.contenido && (
                <p className="mt-2 text-xs text-gray-500 bg-gray-50 rounded p-2 border">
                  <span className="font-semibold">Preview:</span> {previewRender(form.contenido)}
                </p>
              )}
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            {success && <p className="text-emerald-600 text-sm font-medium">{success}</p>}

            <button
              type="submit"
              disabled={loading}
              className="bg-emerald-600 text-white py-2 rounded-lg font-medium hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar plantilla'}
            </button>
          </form>
        </div>

        {/* Lista de plantillas */}
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-semibold text-gray-800">Plantillas guardadas</h2>

          {plantillas.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm">
              Aún no has guardado ninguna plantilla.
            </div>
          ) : (
            plantillas.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-semibold text-gray-800">{p.etiqueta}</h3>
                    <p className="text-xs font-mono text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded mt-1 inline-block">
                      {p.nombre} · {p.idioma}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDelete(p.id)}
                    className="text-red-400 hover:text-red-600 text-sm ml-2 shrink-0"
                    title="Eliminar"
                  >
                    🗑
                  </button>
                </div>
                <p className="mt-2 text-sm text-gray-600 bg-gray-50 rounded p-2 border border-gray-100">
                  {p.contenido}
                </p>
                <p className="mt-1 text-xs text-gray-400 italic">
                  Preview: {previewRender(p.contenido)}
                </p>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
