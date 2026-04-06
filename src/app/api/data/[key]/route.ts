import { getValue, setValue } from '@/lib/db';

const VALID_KEYS = ['launches', 'templates', 'custom_moments'];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  if (!VALID_KEYS.includes(key)) {
    return Response.json({ error: 'Invalid key' }, { status: 400 });
  }

  const result = await getValue(key);
  if (!result) {
    return Response.json({ value: key === 'launches' ? '[]' : '{}', updatedAt: 0 });
  }
  return Response.json(result);
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ key: string }> }
) {
  const { key } = await params;
  if (!VALID_KEYS.includes(key)) {
    return Response.json({ error: 'Invalid key' }, { status: 400 });
  }

  const body = await request.json();
  const value = JSON.stringify(body.value);
  const updatedAt = await setValue(key, value);
  return Response.json({ updatedAt });
}
