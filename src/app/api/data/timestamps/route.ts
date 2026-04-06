import { getTimestamps } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  const timestamps = await getTimestamps();
  return Response.json(timestamps);
}
