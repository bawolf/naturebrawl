import type { APIRoute } from 'astro';
import { handleReplicateWebhook } from '../../lib/services/image-generation';
import { broadcastBrawlUpdate } from './brawls/[slug]/stream';

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  try {
    console.log('Replicate webhook received');

    // Check if request has valid JSON body
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body;
    try {
      body = await request.json();
    } catch (err) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON in request body' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.log('Webhook body:', body);

    // Extract the prediction ID from the webhook
    const replicateId = body.id;
    if (!replicateId) {
      return new Response(JSON.stringify({ error: 'Missing prediction ID' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Process the webhook with broadcast function for dependency injection
    await handleReplicateWebhook(replicateId, body, broadcastBrawlUpdate);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error processing Replicate webhook:', error);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
