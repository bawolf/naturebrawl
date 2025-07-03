/**
 * Simple SSE client for fight updates
 */
export class SSEClient {
  private eventSource: EventSource | null = null;
  private listeners: Map<string, Set<(data: any) => void>> = new Map();
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isDisconnecting = false;

  constructor(private fightSlug: string) {}

  /**
   * Connect to the SSE stream
   */
  connect(): void {
    if (this.eventSource) {
      console.log('SSE already connected to', this.fightSlug);
      return;
    }

    if (this.isDisconnecting) {
      console.log('SSE is disconnecting, cannot connect');
      return;
    }

    const url = `/api/brawls/${this.fightSlug}/stream`;
    console.log(`Connecting to SSE: ${url}`);

    this.eventSource = new EventSource(url);

    this.eventSource.onopen = () => {
      console.log('SSE connection opened for', this.fightSlug);
      this.reconnectAttempts = 0;
      this.emit('connection', { status: 'connected' });
    };

    this.eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Don't log ping messages to reduce noise
        if (data.type !== 'ping') {
          console.log('SSE message received for', this.fightSlug, ':', data);
        }

        if (data.type) {
          this.emit(data.type, data);
        }
        this.emit('message', data);
      } catch (error) {
        console.error('Error parsing SSE message:', error);
      }
    };

    this.eventSource.onerror = (error) => {
      console.error('SSE connection error for', this.fightSlug, ':', error);
      this.emit('connection', { status: 'error', error });

      if (this.eventSource?.readyState === EventSource.CLOSED) {
        this.eventSource = null;
        if (!this.isDisconnecting) {
          this.attemptReconnect();
        }
      }
    };
  }

  /**
   * Disconnect from the SSE stream
   */
  disconnect(): void {
    console.log('Disconnecting SSE for', this.fightSlug);
    this.isDisconnecting = true;

    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }

    this.listeners.clear();
    this.reconnectAttempts = 0;

    // Reset disconnecting flag after a short delay
    setTimeout(() => {
      this.isDisconnecting = false;
    }, 500);
  }

  /**
   * Subscribe to events
   */
  on(event: string, callback: (data: any) => void): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Unsubscribe from events
   */
  off(event: string, callback: (data: any) => void): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      eventListeners.delete(callback);
      if (eventListeners.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  /**
   * Emit event to listeners
   */
  private emit(event: string, data: any): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const callback of eventListeners) {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in SSE event listener for ${event}:`, error);
        }
      }
    }
  }

  /**
   * Attempt to reconnect with exponential backoff
   */
  private attemptReconnect(): void {
    if (this.isDisconnecting) {
      console.log('Not reconnecting - client is disconnecting');
      return;
    }

    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error('Max reconnection attempts reached for', this.fightSlug);
      this.emit('connection', { status: 'failed' });
      return;
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    console.log(
      `Attempting to reconnect to ${this.fightSlug} in ${delay}ms (attempt ${this.reconnectAttempts})`
    );
    this.emit('connection', {
      status: 'reconnecting',
      attempt: this.reconnectAttempts,
    });

    setTimeout(() => {
      if (!this.isDisconnecting) {
        this.connect();
      }
    }, delay);
  }

  /**
   * Get connection status
   */
  get isConnected(): boolean {
    return this.eventSource?.readyState === EventSource.OPEN;
  }
}
