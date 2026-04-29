type WsStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

type SubscriptionHandler = (data: unknown) => void;

interface Subscription {
  id: string;
  channel: string;
  handler: SubscriptionHandler;
}

export class WsClient {
  private _status: WsStatus = 'disconnected';
  private subscriptions: Map<string, Subscription> = new Map();
  private nextSubId = 0;

  constructor(private url: string) {}

  get status(): WsStatus {
    return this._status;
  }

  connect(): void {
    // Stub implementation - no actual connection in this task
    // Downstream chunk will wire actual WebSocket
    this._status = 'disconnected';
  }

  subscribe(channel: string, handler: SubscriptionHandler): string {
    const id = `sub-${this.nextSubId++}`;
    this.subscriptions.set(id, { id, channel, handler });
    return id;
  }

  unsubscribe(id: string): void {
    this.subscriptions.delete(id);
  }

  send(message: unknown): void {
    // Stub implementation - no actual send in this task
    console.log('[WsClient] send (stub):', message);
  }
}

const wsClient = new WsClient('');

export function useWebSocket() {
  return {
    status: wsClient.status,
    subscribe: wsClient.subscribe.bind(wsClient),
    send: wsClient.send.bind(wsClient),
  };
}
