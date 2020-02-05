export interface IUbiquityAdmin {}

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

type ID = number | string;

// support passing a whole app object back
type Identifier = ID | { id: number };

export default class UbiquityAdmin implements IUbiquityAdmin {
  private options: IOptions;

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

  apps = async () => {
    const resp = await this.request('api/core/v1/apps/');
    return resp.json();
  };

  appDetails = async (app: Identifier) => {
    const resp = await this.request(`api/core/v1/apps/${this.idFrom(app)}/`);
    return resp.json();
  };

  documents = async (app: Identifier) => {
    const resp = await this.request(`api/core/v1/apps/${this.idFrom(app)}/documents/`);
    return resp.json();
  };

  documentVersions = async (app: Identifier, document: Identifier) => {
    const url = `api/core/v1/apps/${this.idFrom(app)}/documents/${this.idFrom(
      document
    )}/versions/`;
    return (await this.request(url)).json();
  };

  pages = async (documentVersion: { links: { pages: string } }) => {
    return (await this.request(documentVersion.links.pages)).json();
  };

  private request = async (path: string) => {
    const auth = this.identity.apiKey
      ? `Token ${this.identity.apiKey}`
      : `Bearer ${this.identity.jwt}`;

    const resp = await fetch(`${this.options.baseUrl}${this.cleanPath(path)}`, {
      headers: { Authorization: auth },
    });
    if (!resp.ok) {
      throw new Error('Invalid ubiquity request');
    }
    return resp;
  };

  private idFrom = (id: Identifier): string => {
    if ((id as any).id) {
      return (id as any).id.toString();
    }
    return id.toString();
  };

  private cleanPath = (path: string): string => {
    let final = path;
    while (final.startsWith('/')) {
      final = final.slice(1);
    }
    return final;
  };
}
