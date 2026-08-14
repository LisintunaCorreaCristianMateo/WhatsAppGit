import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET() {
  try {
    // Ejecuta una consulta mínima para verificar conectividad
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: 'ok' });
  } catch (error: any) {
    console.error('GET /api/health error', error);
    if (error?.code === 'P1001') {
      return NextResponse.json({ status: 'down', error: 'Database unreachable', code: 'P1001' }, { status: 503 });
    }
    return NextResponse.json({ status: 'error', error: 'Internal error' }, { status: 500 });
  }
}
