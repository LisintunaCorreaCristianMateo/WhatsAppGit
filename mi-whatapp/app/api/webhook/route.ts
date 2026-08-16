import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode === 'subscribe' && token === process.env.META_VERIFY_TOKEN) {
    return new Response(challenge, { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();

    // Log minimal info to help debugging de webhooks en producción
    console.log('Webhook body received');

    if (body.object === 'whatsapp_business_account') {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;

      // Si es un mensaje entrante
      if (value?.messages?.[0]) {
        const message = value.messages[0];
        const contact = value.contacts?.[0];
        // Normalizar teléfono: mantener solo dígitos para coincidir con la UI
        const rawTelefono = message.from;
        let telefono = String(rawTelefono || '').replace(/\D/g, '');
        // Normalizar números de México: si empieza por 521 y tiene 13 dígitos, quitar el 1
        if (telefono.startsWith('521') && telefono.length === 13) {
          telefono = '52' + telefono.substring(3);
        }
        const nombrePerfil = contact?.profile?.name || 'Desconocido';
        const texto = message.text?.body || '';
        const wamId = message.id;

        console.log('Incoming message from', telefono, 'text length', texto?.length || 0);

        // 1. Guardar o actualizar el contacto, marcando la última respuesta del cliente
        const contactoDb = await prisma.contacto.upsert({
          where: { telefono: telefono },
          update: { nombre: nombrePerfil, ultimoMensajeAt: new Date(), ultimaRespuestaClienteEn: new Date() },
          create: { telefono: telefono, nombre: nombrePerfil, ultimaRespuestaClienteEn: new Date() },
        });

        // 2. Guardar el mensaje recibido
        await prisma.mensaje.create({
          data: {
            wamId: wamId,
            texto: texto,
            tipo: 'text',
            origen: 'CLIENTE',
            estado: 'RECIBIDO',
            contactoId: contactoDb.id,
          },
        });
      }

      // Manejar los cambios de estado (entregado, leído)
      if (value?.statuses?.[0]) {
        const statusObj = value.statuses[0];
        const wamId = statusObj.id;
        const newStatus = statusObj.status; // 'sent', 'delivered', 'read'
        
        let mappedStatus = 'ENVIADO';
        if (newStatus === 'delivered') mappedStatus = 'ENTREGADO';
        if (newStatus === 'read') mappedStatus = 'LEIDO';

        await prisma.mensaje.updateMany({
          where: { wamId: wamId },
          data: { estado: mappedStatus },
        });
      }

      return NextResponse.json({ status: 'ok' }, { status: 200 });
    }

    return NextResponse.json({ status: 'not a whatsapp event' }, { status: 404 });
  } catch (error) {
    console.error('Error en Webhook:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}