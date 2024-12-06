import { Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';
import { SSEMessage } from '../types/api.types';

interface ServerSentEvent {
  data: string;
  id?: string;
  type?: string;
  retry?: number;
}

export abstract class BaseSSEController {
  protected readonly logger: Logger;
  protected readonly eventSubject = new Subject<SSEMessage>();

  constructor(context: string) {
    this.logger = new Logger(context);
  }

  protected createEventStream(): Observable<ServerSentEvent> {
    return this.eventSubject.asObservable().pipe(
      map((message) => ({
        data: JSON.stringify(message.data),
        id: message.id,
        type: message.event,
        retry: message.retry,
      }))
    );
  }

  protected emit<T>(data: T, eventName?: string) {
    const message: SSEMessage<T> = {
      id: new Date().getTime().toString(),
      data,
      event: eventName,
    };
    this.eventSubject.next(message);
  }

  protected emitWithRetry<T>(data: T, retryMs: number, eventName?: string) {
    const message: SSEMessage<T> = {
      id: new Date().getTime().toString(),
      data,
      event: eventName,
      retry: retryMs,
    };
    this.eventSubject.next(message);
  }

  protected complete() {
    this.eventSubject.complete();
  }

  protected error(error: Error) {
    this.logger.error(error.message);
    this.eventSubject.error(error);
  }
} 