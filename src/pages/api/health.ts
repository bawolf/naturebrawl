import type { APIRoute } from 'astro';
import { getConnectionStats } from './brawls/[slug]/stream';

export const prerender = false;

export const GET: APIRoute = async () => {
  try {
    const sseStats = getConnectionStats();

    const health = {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      sse: {
        totalConnections: sseStats.totalConnections,
        activeFights: sseStats.totalFights,
        fightDetails: sseStats.fightDetails,
      },
      environment: process.env.NODE_ENV || 'development',
      version: process.env.npm_package_version || 'unknown',
      debug: {
        nodeEnv: process.env.NODE_ENV,
        siteUrl: process.env.SITE_URL,
      },
    };

    return new Response(JSON.stringify(health, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Health check failed:', error);

    return new Response(
      JSON.stringify(
        {
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          error: error instanceof Error ? error.message : 'Unknown error',
          stack: error instanceof Error ? error.stack : undefined,
        },
        null,
        2
      ),
      {
        status: 503,
        headers: {
          'Content-Type': 'application/json',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
};
