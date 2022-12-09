import { IIdentityProvider } from '@liquid-state/iwa-identity/dist/manager.js';

interface IUbiquity {
  register(username: string, password?: string): Promise<Response>;
  getProfile(): Promise<object>;
  setProfile(profile: object, clearExistingProfile: boolean): Promise<void>;
  appPublicConfiguration(): Promise<object>;
  appConfiguration(): Promise<object>;
  appContent(useOldStyleDocumentMap: boolean): Promise<object>;
  messageHistory(): Promise<MessageHistory>;
}

type MessageHistory = {
  messages: object[];
};

interface IOptions {
  baseUrl?: string;
  baseS3Url?: string;
  als?: { getUrl(service: string, endpoint: string): string };
  identity?: IdentityOptions;
}

interface IdentityOptions {
  jwt?: string;
  identityProvider?: IIdentityProvider<any>;
}

const defaultOptions = {
  baseUrl: 'https://cloud.liquid-state.com/',
  baseS3Url: 'https://s3.ap-southeast-2.amazonaws.com/liquidstate-prod-apsoutheast2/',
  identity: {},
};

const pathMap: { [key: string]: string } = {
  appPublicConfig: 'c/{{companyToken}}/apps/{{appToken}}/app.json',
  registration: 'api/appusers/v1/{{appToken}}/register/',
  getProfile: 'api/appusers/v1/{{appToken}}/profile/',
  setProfile: 'api/appusers/v1/{{appToken}}/profile/set/',
  setDevice: 'api/appusers/v1/{{appToken}}/set_device/',
  appConfig: 'c/{{companyToken}}/apps/{{appToken}}/app_users/{{appUserId}}/app_config.json',
  messageHistory:
    'c/{{companyToken}}/apps/{{appToken}}/app_users/{{appUserId}}/messaging/list.json',
  viewableIssues: 'c/{{companyToken}}/apps/{{appToken}}/app_users/{{appUserId}}/app_config.json',
};

export const UbiquityError = (message: string, response: Response) => ({
  message: `Ubiquity API Error: ${message}`,
  response,
});

class Ubiquity implements IUbiquity {
  private options: IOptions;

  constructor(private companyToken: string, private appToken: string, options?: IOptions) {
    if (!options) {
      this.options = defaultOptions;
    } else {
      this.options = { ...defaultOptions, ...options };
      if (!this.options.baseUrl) {
        this.options.baseUrl = defaultOptions.baseUrl;
      }
      if (!this.options.baseS3Url) {
        this.options.baseS3Url = defaultOptions.baseS3Url;
      }
    }
  }

  register = (username: string, password?: string) => {
    const url = this.getUrl('registration');
    const body = new FormData();
    body.append('json_data', JSON.stringify({ username, password }));
    return fetch(url, {
      method: 'POST',
      body,
    });
  };

  getProfile = async () => {
    const url = this.getUrl('getProfile');
    const resp = await fetch(url, {
      headers: {
        Authorization: `Bearer ${await this.jwt()}`,
      },
    });
    if (!resp.ok) {
      throw UbiquityError('Unable to get profile for user', resp);
    }
    const content = await resp.json();
    return content.data;
  };

  setProfile = async (profile: object, clearExistingProfile = false) => {
    const url = this.getUrl('setProfile');
    const body = new FormData();
    if (clearExistingProfile) {
      (profile as any)['_clear_profile'] = true;
    }
    body.append('json_data', JSON.stringify(profile));
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.jwt()}`,
      },
      body,
    });
    if (!resp.ok) {
      throw UbiquityError('Unable to update profile data', resp);
    }
  };

  setDevice = async (installationId: string) => {
    const url = this.getUrl('setDevice');
    const body = new FormData();
    body.append('action', 'add');
    body.append('installation_id', installationId);

    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${await this.jwt()}`,
      },
      body,
    });
    if (!resp.ok) {
      throw UbiquityError('Unable to update device', resp);
    }
  };

  appPublicConfiguration = async () => {
    const url = this.getUrl('appPublicConfig', true);
    const resp = await fetch(url);
    if (!resp.ok) {
      throw UbiquityError('Unable to retrieve app public config', resp);
    }
    return resp.json();
  };

  appConfiguration = async () => {
    const sub = this.sub(await this.jwt());
    const url = this.getUrl('appConfig', true).replace('{{appUserId}}', sub);
    const resp = await fetch(url);
    if (!resp.ok) {
      throw UbiquityError('Unable to retrieve app config for the current user ', resp);
    }
    return resp.json();
  };

  appContent = async (useOldStyleDocumentMap = false) => {
    const jwt = await this.jwt();
    if (!jwt) {
      return this.publicAppContent();
    }
    const sub = this.sub(await this.jwt());
    const url = this.getUrl('viewableIssues', true).replace('{{appUserId}}', sub);
    const resp = await fetch(url);
    if (!resp.ok) {
      throw UbiquityError('Unable to retrieve the viewable issues for the current user ', resp);
    }
    const data = await resp.json();
    if ('documents' in data && useOldStyleDocumentMap) {
      return {
        categories: data.categories,
        iaps: {
          ios: data.documents,
          android: data.documents,
          web: data.documents,
        },
      };
    }
    return data;
  };

  messageHistory = async () => {
    const sub = this.sub(await this.jwt());
    const url = this.getUrl('messageHistory', true).replace('{{appUserId}}', sub);
    const resp = await fetch(url);
    if (!resp.ok) {
      if (resp.status === 403) {
        return { messages: [] };
      } else {
        throw UbiquityError('Unable to retrieve the message history for the current user ', resp);
      }
    }
    return resp.json();
  };

  private publicAppContent = async () => {
    const config = await this.appPublicConfiguration();
    return {
      categories: config.categories,
      documents: config.iaps.ios,
    };
  };

  private getUrl(endpoint: string, useS3 = false) {
    let result;
    if (this.options.als) {
      result = this.options.als.getUrl('ubiquity', endpoint);
    } else if (endpoint in pathMap) {
      const baseUrl = useS3 ? this.options.baseS3Url : this.options.baseUrl;
      result = `${baseUrl}${pathMap[endpoint]}`;
    }
    if (result === undefined) {
      throw Error(`Unable to find url for ubiquity client, endpoint: ${name}`);
    }
    result = result
      .replace('{{companyToken}}', this.companyToken)
      .replace('{{appToken}}', this.appToken);
    return result;
  }

  private async jwt() {
    if (!this.options.identity) {
      return undefined;
    }
    if (this.options.identity.jwt) {
      return this.options.identity.jwt;
    } else if (this.options.identity.identityProvider) {
      const id = await this.options.identity.identityProvider.getIdentity();
      return id.isAuthenticated ? id.credentials.jwt : undefined;
    }
    return undefined;
  }

  private sub(jwt: string) {
    // Get the body of the JWT.
    const payload = jwt.split('.')[1];
    // Which is base64 encoded.
    const parsed = JSON.parse(atob(payload));
    return parsed.sub;
  }
}

export default Ubiquity;
export { IUbiquity, IOptions, IdentityOptions };
