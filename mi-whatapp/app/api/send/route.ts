import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

// Sustituye {{1}}, {{2}}, etc. con los valores reales
function renderPlantilla(contenido: string, variables: string): string {
  if (!variables) return contenido;
  const vals = variables.split(',').map((v) => v.trim());
  return contenido.replace(/\{\{(\d+)\}\}/g, (_, idx) => vals[parseInt(idx) - 1] ?? `{{${idx}}}`);
}

export async function POST(request: Request) {
  try {
    const { telefono, texto, type = 'text', templateName, variables } = await request.json();

    if (!telefono || (!texto && type === 'text') || (!templateName && type === 'template')) {
      return NextResponse.json({ error: 'Faltan parámetros' }, { status: 400 });
    }

    // Normalizar teléfono para consistencia con webhook (solo dígitos)
    const telefonoNormalized = String(telefono).replace(/\D/g, '');

    // Verificar ventana de 24h de WhatsApp si es un mensaje de texto libre
    if (type === 'text') {
      const contactoExistente = await prisma.contacto.findUnique({ where: { telefono: telefonoNormalized } });
      const ahora = new Date();
      const ventanaAbierta =
        contactoExistente?.ultimaRespuestaClienteEn &&
        ahora.getTime() - new Date(contactoExistente.ultimaRespuestaClienteEn).getTime() < 24 * 60 * 60 * 1000;

      if (!ventanaAbierta) {
        return NextResponse.json(
          { error: 'VENTANA_CERRADA', message: 'El cliente no ha respondido en las últimas 24h. Solo puedes enviar plantillas.' },
          { status: 403 }
        );
      }
    }

    let bodyPayload: any = {
      messaging_product: 'whatsapp',
      to: telefonoNormalized,
    };

    if (type === 'template') {
      // Buscar la plantilla en la BD para obtener idioma y contenido
      const plantillaDb = await prisma.plantilla.findUnique({ where: { nombre: templateName } });
      const idioma = plantillaDb?.idioma || 'es';

      bodyPayload.type = 'template';
      bodyPayload.template = {
        name: templateName,
        language: { code: idioma },
      };

      // Si el usuario envió variables, las estructuramos para Meta
      if (variables) {
        const paramsArray = variables.split(',').map((v: string) => ({
          type: 'text',
          text: v.trim(),
        }));
        bodyPayload.template.components = [{ type: 'body', parameters: paramsArray }];
      }
    } else {
      bodyPayload.type = 'text';
      bodyPayload.text = { body: texto };
    }

    // 1. Enviar mensaje a la API de Meta
    const response = await fetch(
      `https://graph.facebook.com/v20.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.WHATSAPP_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(bodyPayload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json({ error: data }, { status: response.status });
    }

    // 2. Buscar o crear al contacto en la BD (usar teléfono normalizado)
    const contacto = await prisma.contacto.upsert({
      where: { telefono: telefonoNormalized },
      update: { ultimoMensajeAt: new Date() },
      create: { telefono: telefonoNormalized, nombre: telefonoNormalized },
    });

    // 3. Guardar el mensaje enviado en la BD con el contenido renderizado
    let textoGuardado: string;
    if (type === 'template') {
      const plantillaDb = await prisma.plantilla.findUnique({ where: { nombre: templateName } });
      textoGuardado = plantillaDb
        ? renderPlantilla(plantillaDb.contenido, variables || '')
        : `[Plantilla: ${templateName}]`;
    } else {
      textoGuardado = texto;
    }

    await prisma.mensaje.create({
      data: {
        wamId: data.messages[0].id,
        texto: textoGuardado,
        tipo: type,
        origen: 'SISTEMA',
        estado: 'ENVIADO',
        contactoId: contacto.id,
      },
    });

    return NextResponse.json({ success: true, data, contacto });
  } catch (error) {
    console.error('Error enviando mensaje:', error);
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}