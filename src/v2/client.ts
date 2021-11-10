import { stringify } from 'query-string';
import { APIList, App } from './types';

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

  url(url: string, query?: { [key: string]: string | number | boolean }) {
    return `${this.options.baseUrl}${url}${query ? `?${stringify(query)}` : ''}`;
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
      if (r.status === 204) {
        return;
      }
      return r.json();
    } catch {
      throw new NetworkError('A network error has occurred, unable to contact ubiquity.');
    }
  };
}

export default class UbiquityV2Client {
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

  public getForm: (token: string, id: string, version?: number) => Promise<any> = (
    token,
    id,
    version,
  ) => {
    return this.executor.execute(
      this.executor.url(
        `api/v2/apps/${token}/content-lookup/forms/${id}/`,
        version ? { version } : undefined,
      ),
    );
  };

  public getWeblink: (token: string, id: string, version?: number) => Promise<any> = (
    token,
    id,
    version,
  ) => {
    return this.executor.execute(
      this.executor.url(
        `api/v2/apps/${token}/content-lookup/weblinks/${id}/`,
        version ? { version } : undefined,
      ),
    );
  };
}
