import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(request: Request, { params }: { params: Promise<{ contactoId: string }> }) {
  const { contactoId } = await params;
  const mensajes = await prisma.mensaje.findMany({
    where: { contactoId: contactoId },
    orderBy: { creadoEn: 'asc' },
  });
  return NextResponse.json(mensajes);
}