import ContentItemApi from './content-item-api';
import { App, Form, APIList, Message, Weblink, FormVersion, MessageVersion, WeblinkVersion } from './types';

interface IOptions {
  baseUrl?: string;
  baseS3Url?: string;
}

interface IdentityOptions {
  jwt?: string;
  apiKey?: string;
}

const defaultOptions = {
  baseUrl: 'https://cloud.liquid-state.com/',
  baseS3Url: 'https://s3.ap-southeast-2.amazonaws.com/liquidstate-prod-apsoutheast2/',
};

class NetworkError extends Error {}
class UbiquityError extends Error {
  constructor(message: string, public response: Response) {
    super(message);
  }
}

export class RequestExecutor {
  constructor(private identity: IdentityOptions, private options: IOptions) {}

  get auth() {
    return this.identity.apiKey ? `Token ${this.identity.apiKey}` : `Bearer ${this.identity.jwt}`;
  }

  url(url: string) {
    return `${this.options.baseUrl}${url}`;
  }

  headers(additionalHeaders?: object) {
    return {
      Authorization: this.auth,
      'Content-Type': 'application/json',
      ...additionalHeaders,
    };
  }

  execute = async (url: string, init?: RequestInit) => {
    try {
      const r = await fetch(url, init || { headers: this.headers() });
      if (!r.ok) {
        throw new UbiquityError('Invalid request', r);
      }
      return r.json();
    } catch {
      throw new NetworkError('A network error has occurred, unable to contact ubiquity.');
    }
  };
}

export default class UbiquityV2AdminClient {
  private options: IOptions;
  private _executor?: RequestExecutor;

  constructor(private identity: IdentityOptions, options?: IOptions) {
    if (!options) {
      this.options = defaultOptions;
    }
    this.options = { ...defaultOptions, ...options };
    if (!this.options.baseUrl) {
      this.options.baseUrl = defaultOptions.baseUrl;
    }
    if (!this.options.baseS3Url) {
      this.options.baseS3Url = defaultOptions.baseS3Url;
    }
  }

  private get executor() {
    if (!this._executor) {
      this._executor = new RequestExecutor(this.identity, this.options);
    }
    return this._executor;
  }

  public listApps: () => Promise<APIList<App>> = async () => {
    return this.executor.execute(this.executor.url('api/v2/apps/'));
  };

  public getApp: (token: string) => Promise<App> = (token: string) => {
    return this.executor.execute(this.executor.url(`api/v2/apps/${token}/`));
  };

  public forms(appOrToken: App | string) {
    return new ContentItemApi<Form, FormVersion>(this.executor, 'forms', appOrToken);
  }

  public messages(appOrToken: App | string) {
    return new ContentItemApi<Message, MessageVersion>(this.executor, 'messages', appOrToken);
  }

  public weblinks(appOrToken: App | string) {
    return new ContentItemApi<Weblink, WeblinkVersion>(this.executor, 'weblinks', appOrToken);
  }
}