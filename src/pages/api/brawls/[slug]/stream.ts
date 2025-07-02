import type { APIRoute } from 'astro';

// Simple in-memory store for SSE connections
interface SSEConnection {
  controller: ReadableStreamDefaultController;
  id: string;
  send: (data: any) => void;
}

const connections = new Map<string, Set<SSEConnection>>();

export const prerender = false;

export const GET: APIRoute = async ({ params, request }) => {
  const { slug } = params;

  if (!slug) {
    return new Response('Slug required', { status: 400 });
  }

  // Set up SSE headers
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      // Add this connection to the fight room
      if (!connections.has(slug)) {
        connections.set(slug, new Set());
      }

      const fightConnections = connections.get(slug)!;

      // Create a response object to track this connection
      const connectionId = Math.random().toString(36);
      const connection = {
        controller,
        id: connectionId,
        send: (data: any) => {
          try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(new TextEncoder().encode(message));
          } catch (error) {
            console.error('Error sending SSE message:', error);
            // Remove broken connection
            fightConnections.delete(connection);
          }
        },
      };

      fightConnections.add(connection);

      console.log(
        `SSE client connected to fight ${slug}. Total connections: ${fightConnections.size}`
      );

      // Send initial connection message
      connection.send({
        type: 'connected',
        timestamp: new Date().toISOString(),
        connectionId,
      });

      // Handle connection cleanup
      request.signal.addEventListener('abort', () => {
        console.log(`SSE client disconnected from fight ${slug}`);
        fightConnections.delete(connection);

        if (fightConnections.size === 0) {
          connections.delete(slug);
        }

        try {
          controller.close();
        } catch (error) {
          // Connection already closed
        }
      });
    },
  });

  return new Response(stream, { headers });
};

/**
 * Broadcast a message to all SSE connections for a specific fight
 */
export function broadcastToFight(slug: string, data: any): void {
  const fightConnections = connections.get(slug);

  if (!fightConnections || fightConnections.size === 0) {
    console.log(`No SSE connections for fight ${slug}`);
    return;
  }

  console.log(
    `Broadcasting to ${fightConnections.size} SSE connections for fight ${slug}`
  );

  // Send to all connections, remove any that fail
  const failedConnections = new Set<SSEConnection>();

  for (const connection of fightConnections) {
    try {
      connection.send(data);
    } catch (error) {
      console.error('Failed to send to SSE connection:', error);
      failedConnections.add(connection);
    }
  }

  // Clean up failed connections
  for (const failed of failedConnections) {
    fightConnections.delete(failed);
  }

  if (fightConnections.size === 0) {
    connections.delete(slug);
  }
}
