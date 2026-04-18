declare module 'bullmq' {
  export class Job<T = any> {
    id?: string | number;
    data: T;
  }

  export class Worker<T = any> {
    constructor(name: string, processor: (job: Job<T>) => Promise<unknown>, opts?: any);
    on(event: string, handler: (job?: Job<T>, err?: Error) => void): this;
  }

  export class Queue<T = any> {
    constructor(name: string, opts?: any);
    add(name: string, data: T, opts?: any): Promise<unknown>;
    getWaitingCount(): Promise<number>;
    getActiveCount(): Promise<number>;
    getCompletedCount(): Promise<number>;
    getFailedCount(): Promise<number>;
    getDelayedCount(): Promise<number>;
  }
}

declare module 'ws' {
  export class WebSocket {
    static OPEN: number;
    readyState: number;
    send(data: string): void;
    ping(): void;
    close(): void;
    on(event: string, listener: (...args: any[]) => void): void;
  }

  export class WebSocketServer {
    constructor(options?: any);
    on(event: string, listener: (...args: any[]) => void): void;
  }
}
