import { RequestExecutor } from "./admin-client";
import { APIList } from "./types";


export default class Paginator<T = any> {
  private queued?: Promise<APIList<any>> = undefined;
  private previousResult?: APIList<T> = undefined;

  constructor(private executor: RequestExecutor) {}

  begin = <U>(initial: Promise<APIList<U>>): Paginator<U> => {
    this.queued = initial;
    return this as unknown as Paginator<U>;
  }

  next = async (): Promise<T[] | null> => {
    let result;
    if (this.queued) {
      result = await this.queued;
      this.queued = undefined;
    } else if (this.previousResult && this.previousResult.next) {
      result = await this.executor.execute(this.previousResult.next);
    } else {
      return null;
    }
    this.previousResult = result;
    return result.results;
  }

  hasNext = (): boolean => {
    return Boolean(this.queued || (this.previousResult && this.previousResult.next));
  }
}