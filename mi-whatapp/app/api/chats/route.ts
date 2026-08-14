import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const contactos = await prisma.contacto.findMany({
      orderBy: { ultimoMensajeAt: 'desc' },
      select: {
        id: true,
        telefono: true,
        nombre: true,
        ultimaRespuestaClienteEn: true,
      },
    });
    return NextResponse.json(contactos);
  } catch (error: any) {
    console.error('GET /api/chats error', error);
    // Prisma P1001 = Can't reach database server
    if (error?.code === 'P1001') {
      return NextResponse.json({ error: 'Database unreachable', code: 'P1001' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}