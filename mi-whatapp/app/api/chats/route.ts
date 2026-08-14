import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
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
}