/**
 * CemAI Agents - Real-time Communication Utilities
 * WebSocket and Server-Sent Events (SSE) utilities for real-time data streaming
 */

import { 
  KPIData, 
  ProcessAlert, 
  AgentState, 
  LogEntry, 
  Notification, 
  ChatToken,
  WebSocketEvent,
  SSEEvent
} from '../types/api-contracts';

export interface RealtimeConfig {
  wsUrl?: string;
  sseUrl?: string;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
  token?: string;
}

export interface EventHandlers {
  onKPIUpdate?: (data: KPIData) => void;
  onProcessAlert?: (alert: ProcessAlert) => void;
  onAgentState?: (state: AgentState) => void;
  onLogEntry?: (log: LogEntry) => void;
  onNotification?: (notification: Notification) => void;
  onChatToken?: (token: ChatToken) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: Error) => void;
}

export class RealtimeClient {
  private config: RealtimeConfig;
  private handlers: EventHandlers;
  private ws: WebSocket | null = null;
  private sse: EventSource | null = null;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnected = false;
  private lastEventId: string | null = null;

  constructor(config: RealtimeConfig, handlers: EventHandlers) {
    this.config = {
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      ...config
    };
    this.handlers = handlers;
  }

  // ============================================================================
  // WebSocket Implementation
  // ============================================================================

  connectWebSocket(): void {
    if (!this.config.wsUrl) {
      throw new Error('WebSocket URL not configured');
    }

    try {
      const wsUrl = this.config.token 
        ? `${this.config.wsUrl}?token=${this.config.token}`
        : this.config.wsUrl;

      this.ws = new WebSocket(wsUrl);
      this.setupWebSocketHandlers();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  private setupWebSocketHandlers(): void {
    if (!this.ws) return;

    this.ws.onopen = () => {
      console.log('WebSocket connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.startHeartbeat();
      this.handlers.onConnect?.();
    };

    this.ws.onmessage = (event) => {
      try {
        const data: WebSocketEvent = JSON.parse(event.data);
        this.handleWebSocketEvent(data);
      } catch (error) {
        console.error('Failed to parse WebSocket message:', error);
      }
    };

    this.ws.onclose = (event) => {
      console.log('WebSocket disconnected:', event.code, event.reason);
      this.isConnected = false;
      this.stopHeartbeat();
      this.handlers.onDisconnect?.();

      // Attempt reconnection if not a clean close
      if (event.code !== 1000 && this.reconnectAttempts < this.config.maxReconnectAttempts!) {
        this.scheduleReconnect();
      }
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.handleError(new Error('WebSocket connection error'));
    };
  }

  private handleWebSocketEvent(event: WebSocketEvent): void {
    switch (event.type) {
      case 'kpi_update':
        this.handlers.onKPIUpdate?.(event.data as KPIData);
        break;
      case 'process_alert':
        this.handlers.onProcessAlert?.(event.data as ProcessAlert);
        break;
      case 'agent_state':
        this.handlers.onAgentState?.(event.data as AgentState);
        break;
      case 'log_entry':
        this.handlers.onLogEntry?.(event.data as LogEntry);
        break;
      case 'notification':
        this.handlers.onNotification?.(event.data as Notification);
        break;
      case 'chat_token':
        this.handlers.onChatToken?.(event.data as ChatToken);
        break;
      default:
        console.warn('Unknown event type:', event.type);
    }
  }

  // ============================================================================
  // Server-Sent Events Implementation
  // ============================================================================

  connectSSE(): void {
    if (!this.config.sseUrl) {
      throw new Error('SSE URL not configured');
    }

    try {
      const sseUrl = this.config.token 
        ? `${this.config.sseUrl}?token=${this.config.token}`
        : this.config.sseUrl;

      this.sse = new EventSource(sseUrl);
      this.setupSSEHandlers();
    } catch (error) {
      this.handleError(error as Error);
    }
  }

  private setupSSEHandlers(): void {
    if (!this.sse) return;

    this.sse.onopen = () => {
      console.log('SSE connected');
      this.isConnected = true;
      this.reconnectAttempts = 0;
      this.handlers.onConnect?.();
    };

    this.sse.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        this.handleSSEEvent(event.type, data);
      } catch (error) {
        console.error('Failed to parse SSE message:', error);
      }
    };

    this.sse.onerror = (error) => {
      console.error('SSE error:', error);
      this.isConnected = false;
      this.handlers.onDisconnect?.();

      // Attempt reconnection
      if (this.reconnectAttempts < this.config.maxReconnectAttempts!) {
        this.scheduleReconnect();
      }
    };

    // Set up specific event listeners
    this.sse.addEventListener('kpi_update', (event) => {
      try {
        const data: KPIData = JSON.parse(event.data);
        this.handlers.onKPIUpdate?.(data);
      } catch (error) {
        console.error('Failed to parse KPI update:', error);
      }
    });

    this.sse.addEventListener('process_alert', (event) => {
      try {
        const data: ProcessAlert = JSON.parse(event.data);
        this.handlers.onProcessAlert?.(data);
      } catch (error) {
        console.error('Failed to parse process alert:', error);
      }
    });

    this.sse.addEventListener('agent_state', (event) => {
      try {
        const data: AgentState = JSON.parse(event.data);
        this.handlers.onAgentState?.(data);
      } catch (error) {
        console.error('Failed to parse agent state:', error);
      }
    });

    this.sse.addEventListener('log_entry', (event) => {
      try {
        const data: LogEntry = JSON.parse(event.data);
        this.handlers.onLogEntry?.(data);
      } catch (error) {
        console.error('Failed to parse log entry:', error);
      }
    });

    this.sse.addEventListener('notification', (event) => {
      try {
        const data: Notification = JSON.parse(event.data);
        this.handlers.onNotification?.(data);
      } catch (error) {
        console.error('Failed to parse notification:', error);
      }
    });

    this.sse.addEventListener('chat_token', (event) => {
      try {
        const data: ChatToken = JSON.parse(event.data);
        this.handlers.onChatToken?.(data);
      } catch (error) {
        console.error('Failed to parse chat token:', error);
      }
    });
  }

  private handleSSEEvent(eventType: string, data: any): void {
    // Handle generic SSE events
    switch (eventType) {
      case 'message':
        // Generic message handling
        break;
      default:
        console.warn('Unknown SSE event type:', eventType);
    }
  }

  // ============================================================================
  // Connection Management
  // ============================================================================

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.config.reconnectInterval! * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(() => {
      if (this.config.wsUrl) {
        this.connectWebSocket();
      } else if (this.config.sseUrl) {
        this.connectSSE();
      }
    }, delay);
  }

  private startHeartbeat(): void {
    if (!this.config.wsUrl || !this.ws) return;

    this.heartbeatTimer = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleError(error: Error): void {
    console.error('Realtime client error:', error);
    this.handlers.onError?.(error);
  }

  // ============================================================================
  // Public Methods
  // ============================================================================

  connect(): void {
    if (this.config.wsUrl) {
      this.connectWebSocket();
    } else if (this.config.sseUrl) {
      this.connectSSE();
    } else {
      throw new Error('No WebSocket or SSE URL configured');
    }
  }

  disconnect(): void {
    this.isConnected = false;
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    if (this.sse) {
      this.sse.close();
      this.sse = null;
    }
  }

  send(data: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.warn('WebSocket not connected, cannot send data');
    }
  }

  isConnectionActive(): boolean {
    return this.isConnected;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  // ============================================================================
  // Static Factory Methods
  // ============================================================================

  static createWebSocketClient(config: RealtimeConfig, handlers: EventHandlers): RealtimeClient {
    return new RealtimeClient({ ...config, sseUrl: undefined }, handlers);
  }

  static createSSEClient(config: RealtimeConfig, handlers: EventHandlers): RealtimeClient {
    return new RealtimeClient({ ...config, wsUrl: undefined }, handlers);
  }

  static createFromConfig(handlers: EventHandlers): RealtimeClient {
    const wsUrl = process.env.REACT_APP_WS_URL;
    const sseUrl = process.env.REACT_APP_SSE_URL;
    const token = localStorage.getItem('accessToken');

    return new RealtimeClient({
      wsUrl,
      sseUrl,
      reconnectInterval: 5000,
      maxReconnectAttempts: 10,
      heartbeatInterval: 30000,
      token
    }, handlers);
  }
}

// ============================================================================
// React Hook for Real-time Data
// ============================================================================

import { useEffect, useRef, useState } from 'react';

export interface UseRealtimeOptions {
  autoConnect?: boolean;
  config?: RealtimeConfig;
}

export function useRealtime(
  handlers: EventHandlers,
  options: UseRealtimeOptions = {}
) {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const clientRef = useRef<RealtimeClient | null>(null);

  const { autoConnect = true, config } = options;

  useEffect(() => {
    if (!autoConnect) return;

    const client = RealtimeClient.createFromConfig({
      ...handlers,
      onConnect: () => {
        setIsConnected(true);
        setError(null);
        handlers.onConnect?.();
      },
      onDisconnect: () => {
        setIsConnected(false);
        handlers.onDisconnect?.();
      },
      onError: (err) => {
        setError(err);
        handlers.onError?.(err);
      }
    });

    clientRef.current = client;
    client.connect();

    return () => {
      client.disconnect();
    };
  }, [autoConnect, config]);

  const connect = () => {
    if (clientRef.current) {
      clientRef.current.connect();
    }
  };

  const disconnect = () => {
    if (clientRef.current) {
      clientRef.current.disconnect();
    }
  };

  const send = (data: any) => {
    if (clientRef.current) {
      clientRef.current.send(data);
    }
  };

  return {
    isConnected,
    error,
    connect,
    disconnect,
    send
  };
}

// ============================================================================
// Default Export
// ============================================================================

export default RealtimeClient;
