import { AsyncLocalStorage } from 'node:async_hooks';

interface RequestStore {
  requestId: string;
}

const requestStorage = new AsyncLocalStorage<RequestStore>();

export class RequestContext {
  static run<T>(requestId: string, callback: () => T): T {
    return requestStorage.run({ requestId }, callback);
  }

  static getRequestId(): string | undefined {
    return requestStorage.getStore()?.requestId;
  }
}
