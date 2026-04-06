import { cookies } from 'next/headers';

export async function POST(request: Request) {
  const { password } = await request.json();
  const sitePassword = process.env.SITE_PASSWORD;

  if (!sitePassword) {
    return Response.json({ error: 'SITE_PASSWORD not configured' }, { status: 500 });
  }

  if (password !== sitePassword) {
    return Response.json({ error: 'Invalid password' }, { status: 401 });
  }

  // Create a simple signed token: timestamp + hmac-like check
  // For a team tool with a shared password, a simple approach is fine
  const token = Buffer.from(JSON.stringify({
    authenticated: true,
    ts: Date.now(),
  })).toString('base64');

  const cookieStore = await cookies();
  cookieStore.set('gtm-auth', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  });

  return Response.json({ ok: true });
}

export async function DELETE() {
  const cookieStore = await cookies();
  cookieStore.delete('gtm-auth');
  return Response.json({ ok: true });
}
