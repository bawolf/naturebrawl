import type { APIRoute } from 'astro';

// Simple in-memory store for SSE connections
interface SSEConnection {
  controller: ReadableStreamDefaultController;
  id: string;
  connected: boolean;
  send: (data: any) => void;
}

const connections = new Map<string, Set<SSEConnection>>();

// Periodic cleanup of stale connections
const CLEANUP_INTERVAL = 30000; // 30 seconds
const cleanupTimer = setInterval(() => {
  console.log('Running SSE connection cleanup...');
  let totalCleaned = 0;

  for (const [slug, fightConnections] of connections.entries()) {
    const staleConnections = new Set<SSEConnection>();

    for (const connection of fightConnections) {
      if (!connection.connected) {
        staleConnections.add(connection);
      }
    }

    // Remove stale connections
    for (const stale of staleConnections) {
      fightConnections.delete(stale);
      totalCleaned++;
    }

    // Remove empty fight rooms
    if (fightConnections.size === 0) {
      connections.delete(slug);
    }
  }

  if (totalCleaned > 0) {
    console.log(`Cleaned up ${totalCleaned} stale SSE connections`);
  }
}, CLEANUP_INTERVAL);

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
      const connection: SSEConnection = {
        controller,
        id: connectionId,
        connected: true,
        send: (data: any) => {
          // Check if connection is still valid before sending
          if (!connection.connected) {
            return;
          }

          try {
            const message = `data: ${JSON.stringify(data)}\n\n`;
            controller.enqueue(new TextEncoder().encode(message));
          } catch (error) {
            // Connection is closed or invalid, mark as disconnected
            console.log(
              `SSE connection ${connectionId} closed/failed, removing from ${slug}`
            );
            connection.connected = false;
            clearInterval(pingInterval);
            fightConnections.delete(connection);

            if (fightConnections.size === 0) {
              connections.delete(slug);
            }

            // Don't rethrow the error - this prevents crashing other connections
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

      // Send periodic ping to detect stale connections
      const pingInterval = setInterval(() => {
        if (connection.connected) {
          connection.send({
            type: 'ping',
            timestamp: new Date().toISOString(),
          });
        } else {
          clearInterval(pingInterval);
        }
      }, 15000); // Ping every 15 seconds

      // Handle connection cleanup
      const cleanup = () => {
        console.log(`SSE client disconnected from fight ${slug}`);
        connection.connected = false;
        clearInterval(pingInterval);
        fightConnections.delete(connection);

        if (fightConnections.size === 0) {
          connections.delete(slug);
        }

        try {
          controller.close();
        } catch (error) {
          // Connection already closed or other error - ignore
          console.log(
            'Controller cleanup error (expected):',
            error instanceof Error ? error.message : 'Unknown error'
          );
        }
      };

      // Listen for client disconnect
      request.signal.addEventListener('abort', cleanup);
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

  // Send to all active connections, remove any that fail
  const failedConnections = new Set<SSEConnection>();

  for (const connection of fightConnections) {
    if (!connection.connected) {
      failedConnections.add(connection);
      continue;
    }

    // Try to send to the connection
    // The connection.send() method will handle marking itself as disconnected if it fails
    connection.send(data);

    // After sending, check if the connection marked itself as disconnected
    if (!connection.connected) {
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

  console.log(`Successfully broadcast to ${fightConnections.size} connections`);
}

/**
 * Get connection stats for debugging
 */
export function getConnectionStats() {
  const stats: Record<string, number> = {};

  for (const [slug, fightConnections] of connections.entries()) {
    stats[slug] = fightConnections.size;
  }

  return {
    totalFights: connections.size,
    totalConnections: Array.from(connections.values()).reduce(
      (sum, conns) => sum + conns.size,
      0
    ),
    fightDetails: stats,
  };
}
