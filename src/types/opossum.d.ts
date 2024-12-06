declare module 'opossum' {
  interface CircuitBreakerOptions {
    timeout?: number;
    errorThresholdPercentage?: number;
    resetTimeout?: number;
    rollingCountTimeout?: number;
    rollingCountBuckets?: number;
    name?: string;
    group?: string;
    rollingPercentilesEnabled?: boolean;
    capacity?: number;
    errorFilter?: (err: Error) => boolean;
    allowWarmUp?: boolean;
    volumeThreshold?: number;
    enabled?: boolean;
  }

  interface Stats {
    failures: number;
    fallbacks: number;
    successes: number;
    rejects: number;
    fires: number;
    timeouts: number;
    cacheHits: number;
    cacheMisses: number;
    semaphoreRejections: number;
    percentiles: {
      [key: number]: number;
    };
    latencyTotalMean: number;
    latencyMean: number;
    latencyMax: number;
    latencyMin: number;
  }

  class CircuitBreaker {
    constructor(action: (...args: any[]) => Promise<any>, options?: CircuitBreakerOptions);
    fire(...args: any[]): Promise<any>;
    fallback(func: (...args: any[]) => any): this;
    open(): void;
    close(): void;
    disable(): void;
    enable(): void;
    isOpen(): boolean;
    isClosed(): boolean;
    isHalfOpen(): boolean;
    stats: Stats;
    on(event: string, callback: (...args: any[]) => void): this;
    removeListener(event: string, callback: (...args: any[]) => void): this;
  }

  export = CircuitBreaker;
} 