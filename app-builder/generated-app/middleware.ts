import { updateSession } from '@/lib/supabase/middleware';
import createServerClient from '@/lib/supabase/server';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const response = await updateSession(request);

  const supabase = createServerClient(request.cookies);
  const { data: { user } } = await supabase.auth.getUser();

  if (user && request.nextUrl.pathname.startsWith('/login')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  if (user && request.nextUrl.pathname.startsWith('/signup')) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  const protectedRoutes = ['/dashboard'];
  const isProtectedRoute = protectedRoutes.some(route => request.nextUrl.pathname.startsWith(route));

  if (!user && isProtectedRoute) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  return response;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)'
  ]
};
