interface NgrokTunnel {
  proto: string;
  public_url: string;
}

interface NgrokResponse {
  tunnels: NgrokTunnel[];
}

export class TunnelManager {
  private static instance: TunnelManager;
  private cachedUrl: string | null = null;
  private readonly isDev = import.meta.env.DEV;

  private constructor() {}

  static getInstance(): TunnelManager {
    if (!TunnelManager.instance) {
      TunnelManager.instance = new TunnelManager();
    }
    return TunnelManager.instance;
  }

  async getUrl(): Promise<string> {
    // Return cached URL if available
    if (this.cachedUrl) return this.cachedUrl;

    // Get production URL
    if (!this.isDev) {
      this.cachedUrl = this.getProductionUrl();
      return this.cachedUrl;
    }

    // In development, try ngrok first, fallback to localhost
    try {
      const ngrokUrl = await this.getNgrokUrl();
      this.cachedUrl = ngrokUrl;
      return ngrokUrl;
    } catch (error) {
      console.warn(
        'Failed to get ngrok URL, falling back to localhost:',
        error
      );
      this.cachedUrl = 'http://localhost:4321';
      return this.cachedUrl;
    }
  }

  private getProductionUrl(): string {
    const flyAppName = process.env.FLY_APP_NAME;
    return flyAppName
      ? `https://${flyAppName}.fly.dev`
      : process.env.SERVER_URL || 'https://your-production-domain.com';
  }

  private async getNgrokUrl(): Promise<string> {
    try {
      const response = await fetch('http://127.0.0.1:4040/api/tunnels', {
        headers: {
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(
          `Failed to fetch ngrok tunnels: ${response.statusText}`
        );
      }

      const data = (await response.json()) as NgrokResponse;
      const httpsTunnel = data.tunnels.find(
        (tunnel) => tunnel.proto === 'https'
      );

      if (!httpsTunnel) {
        throw new Error('No HTTPS ngrok tunnel found');
      }

      console.log('Using ngrok tunnel:', httpsTunnel.public_url);
      return httpsTunnel.public_url;
    } catch (error) {
      console.error('Error getting ngrok URL:', error);
      throw error;
    }
  }
}
