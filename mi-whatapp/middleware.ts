import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const JWT_SECRET = process.env.JWT_SECRET || 'secret-key-super-secure';

export async function middleware(request: NextRequest) {
  // Evitar que el middleware se ejecute en rutas públicas o assets estáticos
  const { pathname } = request.nextUrl;
  
  if (
    pathname.startsWith('/_next') || 
    pathname.startsWith('/api/auth') || 
    pathname.startsWith('/api/webhook') || // el webhook de whatsapp tiene que ser público
    pathname === '/login' ||
    pathname.includes('.') // Archivos estáticos como favicon.ico, .css, etc.
  ) {
    return NextResponse.next();
  }

  const token = request.cookies.get('auth_token')?.value;

  if (!token) {
    // Si no hay token, redirigir al login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  try {
    // Verificar el token
    const secret = new TextEncoder().encode(JWT_SECRET);
    await jwtVerify(token, secret);
    
    // Si es válido, permitir continuar
    return NextResponse.next();
  } catch (error) {
    // Si es inválido o expiró, redirigir al login y borrar cookie
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('auth_token');
    return response;
  }
}

// Configurar el matcher para aplicar el middleware a las rutas correspondientes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sitemap.xml, robots.txt (metadata files)
     */
    '/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)',
  ],
};
