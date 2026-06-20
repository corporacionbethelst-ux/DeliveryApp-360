import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Rutas públicas que NO requieren autenticación
const publicRoutes = ['/', '/login', '/register', '/register-rider'];

// Rutas protegidas por rol (Mapeo de prefijo -> Roles permitidos)
const protectedRoutes: Record<string, string[]> = {
  '/manager': ['SUPERADMIN', 'GERENTE', 'OPERADOR'],
  '/rider': ['REPARTIDOR'],
  '/operator': ['OPERADOR', 'GERENTE', 'SUPERADMIN'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // 1. Verificar si la ruta es pública
  if (publicRoutes.includes(pathname)) {
    return NextResponse.next();
  }

  // 2. Obtener el token de las cookies
  const token = request.cookies.get('auth-token')?.value;

  // 3. Si NO hay token, redirigir al login
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // 4. Validación de Roles (Solo si la ruta está protegida por rol)
  let userRole: string | null = null;

  // Buscar si la ruta actual coincide con algún prefijo protegido
  const matchedPrefix = Object.keys(protectedRoutes).find(prefix => 
    pathname.startsWith(prefix)
  );

  if (matchedPrefix) {
    try {
      const userDataCookie = request.cookies.get('user-data')?.value;
      
      // CORRECCIÓN CRÍTICA: Si no hay cookie de usuario pero SÍ hay token válido,
      // NO redirigimos al login para evitar bucles. Permitimos el paso y dejamos
      // que el cliente (React) valide o recargue los datos.
      if (!userDataCookie) {
        console.warn('[Middleware] Token presente pero sin user-data cookie. Permitiendo paso para evitar bucle.');
        return NextResponse.next();
      }

      const user = JSON.parse(userDataCookie);
      userRole = user.role;

      if (!userRole) {
        throw new Error('Invalid user role');
      }

      // Mapeo de rutas permitidas por rol
      const allowedRoles: Record<string, string[]> = {
        '/manager': ['SUPERADMIN', 'GERENTE', 'OPERADOR'],
        '/rider': ['REPARTIDOR'],
      };

      // Verificar si la ruta actual tiene restricciones de rol
      const restrictedPath = Object.keys(allowedRoles).find(path => pathname.startsWith(path));
      
      if (restrictedPath) {
        const allowed = allowedRoles[restrictedPath];
        if (!allowed.includes(userRole)) {
          // Redirigir al dashboard correspondiente a su rol en lugar de login
          let redirectPath = '/login';
          if (userRole === 'REPARTIDOR') redirectPath = '/rider';
          else if (['SUPERADMIN', 'GERENTE', 'OPERADOR'].includes(userRole)) redirectPath = '/manager';
          
          return NextResponse.redirect(new URL(redirectPath, request.url));
        }
      }

    } catch (e) {
      console.error('[Middleware] Auth validation error:', e);
      // Solo limpiamos y redirigimos si el error es grave (ej: token inválido explícito)
      // Si es solo falta de cookie user-data, ya lo manejamos arriba.
      if (e instanceof SyntaxError) {
         const response = NextResponse.redirect(new URL('/login', request.url));
         response.cookies.delete('auth-token');
         response.cookies.delete('user-data');
         return response;
      }
      // En otros casos, permitimos pasar para no bloquear al usuario legítimo
      return NextResponse.next();
    }
  }

  // 5. Si todo está bien (token válido y rol correcto o ruta no protegida por rol)
  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};