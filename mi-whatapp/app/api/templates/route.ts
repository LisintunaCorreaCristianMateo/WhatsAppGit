import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    const plantillas = await prisma.plantilla.findMany({
      orderBy: { createdAt: 'desc' },
    });
    return NextResponse.json(plantillas);
  } catch (error: any) {
    console.error('GET /api/templates error', error);
    if (error?.code === 'P1001') {
      return NextResponse.json({ error: 'Database unreachable', code: 'P1001' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const { nombre, etiqueta, contenido, idioma } = await request.json();

    if (!nombre || !etiqueta || !contenido) {
      return NextResponse.json({ error: 'Faltan campos requeridos' }, { status: 400 });
    }

    const plantilla = await prisma.plantilla.create({
      data: {
        nombre: nombre.trim().toLowerCase().replace(/\s+/g, '_'),
        etiqueta: etiqueta.trim(),
        contenido: contenido.trim(),
        idioma: idioma?.trim() || 'es',
      },
    });

    return NextResponse.json(plantilla);
  } catch (error: any) {
    console.error('POST /api/templates error', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'Ya existe una plantilla con ese nombre' }, { status: 409 });
    }
    if (error?.code === 'P1001') {
      return NextResponse.json({ error: 'Database unreachable', code: 'P1001' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}
