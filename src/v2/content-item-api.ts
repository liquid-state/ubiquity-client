import { RequestExecutor } from './admin-client';
import {
  APIList,
  App,
  ContentItem,
  ContentItemData,
  ContentItemVersion,
  PublishingRecord,
} from './types';
import { isApp, isContentItem, isContentVersion } from './utils';

export default class ContentItemApi<T extends ContentItem, U extends ContentItemVersion> {
  constructor(
    private executor: RequestExecutor,
    private name: 'forms' | 'messages' | 'weblinks',
    private appOrToken: App | string,
  ) {}

  private get baseUrl() {
    return isApp(this.appOrToken)
      ? this.appOrToken[this.name]
      : this.executor.url(`api/v2/apps/${this.appOrToken}/${this.name}/`);
  }

  public list = (): Promise<APIList<T>> => {
    return this.executor.execute(this.baseUrl);
  };

  public get = (form: string): Promise<T> => {
    const url = `${this.baseUrl}/${form}/`;
    return this.executor.execute(url);
  };

  public create = (data: ContentItemData): Promise<T> => {
    return this.executor.execute(this.baseUrl, {
      method: 'POST',
      headers: this.executor.headers(),
      body: JSON.stringify(data),
    });
  };

  public edit = (item: string | T, data: ContentItemData): Promise<T> => {
    const url = this.contentItemUrl(item);
    return this.executor.execute(url, {
      method: 'PUT',
      headers: this.executor.headers(),
      body: JSON.stringify(data),
    });
  };

  public makeAvailable = (item: string | T): Promise<void> => {
    const url = `${this.contentItemUrl(item)}make_available/`;
    return this.executor.execute(url, { headers: this.executor.headers(), method: 'POST' });
  };

  public makeUnavailable = (item: string | T): Promise<void> => {
    const url = `${this.contentItemUrl(item)}make_unavailable/`;
    return this.executor.execute(url, { headers: this.executor.headers(), method: 'POST' });
  };

  public listVersions = (item: string | T): Promise<APIList<U>> => {
    const url = `${this.contentItemUrl(item)}versions/`;
    return this.executor.execute(url);
  };

  public getVersion = (item: string | T, number: number): Promise<U> => {
    const url = this.contentVersionUrl(number, item);
    return this.executor.execute(url);
  };

  public createVersion = (item: string | T, data: any): Promise<U> => {
    const url = `${this.contentItemUrl(item)}versions/`;
    return this.executor.execute(url, {
      method: 'POST',
      headers: this.executor.headers(),
      body: JSON.stringify(data),
    });
  };

  public editVersion = (version: U | number, data: any, item?: string | T): Promise<U> => {
    const url = this.contentVersionUrl(version, item);
    return this.executor.execute(url, {
      method: 'PUT',
      headers: this.executor.headers(),
      body: JSON.stringify(data),
    });
  };

  public packageVersion = (version: U | number, item?: string | T): Promise<void> => {
    const url = `${this.contentVersionUrl(version, item)}package/`;
    return this.executor.execute(url, { method: 'POST', headers: this.executor.headers() });
  };

  listPublishingRecords = (item: string | T): Promise<APIList<PublishingRecord>> => {
    const url = `${this.contentItemUrl(item)}publishing_records/`;
    return this.executor.execute(url);
  };

  private contentItemUrl = (ci: string | ContentItem) => {
    if (isContentItem(ci)) {
      return ci.url;
    } else {
      return `${this.baseUrl}${ci}/`;
    }
  };

  private contentVersionUrl = (version: U | number, item?: string | T) => {
    if (isContentVersion(version)) {
      return version.url;
    } else if (isContentItem(item)) {
      return `${item.url}versions/${version}/`;
    } else {
      return `${this.baseUrl}${item}/versions/${version}/`;
    }
  };
}
