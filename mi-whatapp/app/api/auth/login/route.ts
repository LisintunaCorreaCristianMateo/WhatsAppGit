import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { SignJWT } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-super-secure';

export async function POST(req: Request) {
  try {
    const { usuario, contrasena } = await req.json();

    if (!usuario || !contrasena) {
      return NextResponse.json({ error: 'Usuario y contraseña son requeridos' }, { status: 400 });
    }

    // Usando Prisma para buscar el usuario en la BD de Supabase
    // Ojo: Esto asume que el usuario guardó contraseñas en texto plano como pidió en la estructura de DB
    // En producción DEBEN ser comparados con un hash de bcrypt o argon2.
    const user = await prisma.usuario.findUnique({
      where: { usuario }
    });

    if (!user || user.contrasena !== contrasena) {
      return NextResponse.json({ error: 'Credenciales inválidas' }, { status: 401 });
    }

    // Crear el JWT token
    const secret = new TextEncoder().encode(JWT_SECRET);
    const alg = 'HS256';

    const token = await new SignJWT({ sub: user.id, username: user.usuario, name: user.nombre })
      .setProtectedHeader({ alg })
      .setIssuedAt()
      .setExpirationTime('24h')
      .sign(secret);

    // Crear la respuesta y setear la cookie
    const response = NextResponse.json({ success: true }, { status: 200 });
    
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 1 day
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 });
  }
}
