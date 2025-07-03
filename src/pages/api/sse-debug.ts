import type { APIRoute } from 'astro';
import { getConnectionStats } from './brawls/[slug]/stream';

export const prerender = false;

export const GET: APIRoute = async () => {
  const stats = getConnectionStats();

  return new Response(JSON.stringify(stats, null, 2), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
};
