import type { APIRoute } from 'astro';
import { db, brawls } from '../../../../lib/db';
import { eq } from 'drizzle-orm';

export const prerender = false;

// Store active connections for each brawl
const connections = new Map<string, Set<WritableStreamDefaultWriter>>();

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;

  if (!slug) {
    return new Response('Slug is required', { status: 400 });
  }

  // Verify the brawl exists
  const brawl = await db.query.brawls.findFirst({
    where: eq(brawls.slug, slug),
    with: {
      characters: true,
    },
  });

  if (!brawl) {
    return new Response('Brawl not found', { status: 404 });
  }

  // Create a readable stream for SSE
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      // Send initial connection message
      const initialMessage = `data: ${JSON.stringify({
        type: 'connected',
        timestamp: new Date().toISOString(),
        brawl: {
          id: brawl.id,
          slug: brawl.slug,
          characterCount: brawl.characters.length,
        },
      })}\n\n`;

      controller.enqueue(encoder.encode(initialMessage));

      // Store the controller for this brawl
      if (!connections.has(slug)) {
        connections.set(slug, new Set());
      }

      // We'll use the controller as our "writer" for simplicity
      const writer = {
        write: (data: string) => {
          try {
            controller.enqueue(encoder.encode(data));
          } catch (error) {
            console.log('Client disconnected:', error);
            // Remove from connections when client disconnects
            const brawlConnections = connections.get(slug);
            if (brawlConnections) {
              brawlConnections.delete(writer as any);
              if (brawlConnections.size === 0) {
                connections.delete(slug);
              }
            }
          }
        },
        close: () => {
          try {
            controller.close();
          } catch (error) {
            // Already closed
          }
        },
      };

      connections.get(slug)!.add(writer as any);

      // Send periodic heartbeat to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          const heartbeatMessage = `data: ${JSON.stringify({
            type: 'heartbeat',
            timestamp: new Date().toISOString(),
          })}\n\n`;

          controller.enqueue(encoder.encode(heartbeatMessage));
        } catch (error) {
          clearInterval(heartbeat);
          // Remove from connections when client disconnects
          const brawlConnections = connections.get(slug);
          if (brawlConnections) {
            brawlConnections.delete(writer as any);
            if (brawlConnections.size === 0) {
              connections.delete(slug);
            }
          }
        }
      }, 30000); // Every 30 seconds

      // Clean up on close
      return () => {
        clearInterval(heartbeat);
        const brawlConnections = connections.get(slug);
        if (brawlConnections) {
          brawlConnections.delete(writer as any);
          if (brawlConnections.size === 0) {
            connections.delete(slug);
          }
        }
      };
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control',
    },
  });
};

// Helper function to broadcast updates to all connected clients for a brawl
export function broadcastBrawlUpdate(slug: string, data: any): void {
  const brawlConnections = connections.get(slug);
  if (!brawlConnections || brawlConnections.size === 0) {
    return;
  }

  const message = `data: ${JSON.stringify({
    type: 'brawl_update',
    timestamp: new Date().toISOString(),
    ...data,
  })}\n\n`;

  // Create a copy of the connections to iterate over
  const connectionsToRemove: any[] = [];

  // Send to all connected clients for this brawl
  brawlConnections.forEach((writer: any) => {
    try {
      writer.write(message);
    } catch (error) {
      console.log(
        'Client disconnected during broadcast:',
        error instanceof Error ? error.message : String(error)
      );
      // Mark for removal instead of removing during iteration
      connectionsToRemove.push(writer);
    }
  });

  // Remove failed connections
  connectionsToRemove.forEach((writer) => {
    brawlConnections.delete(writer);
  });

  // Clean up empty connection sets
  if (brawlConnections.size === 0) {
    connections.delete(slug);
  }
}
