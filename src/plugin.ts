import { App } from '@liquid-state/iwa-core';
import IdentityPlugin from '@liquid-state/iwa-identity';
import Ubiquity, { IOptions } from './client';


export type DefaultConfig = {
  useAls: boolean,
  useIdentity: boolean,
};
export type Config = {
  baseUrl?: string
  baseS3Url?: string,
  useAls?: boolean,
  jwt?: string,
  useIdentity?: boolean,
};

export default class UbiquityPlugin {
  static key = 'ubiquity';

  static configure(customise?: (conf: DefaultConfig) => Config) {
    const defaultOptions = { useAls: false, useIdentity: true };
    const options = customise ? customise(defaultOptions) : defaultOptions;
    return new UbiquityPlugin(options);
  }

  public key = UbiquityPlugin.key;

  private constructor(private options: Config) { };

  async use(app: App): Promise<Ubiquity> {
    const clientOptions: IOptions = this.options;
    clientOptions.identity = {};
    if (this.options.useAls) {
      clientOptions.als = await app.alsProvider.result();
    }
    if (this.options.useIdentity && !this.options.jwt) {
      clientOptions.identity.identityProvider = app.use(IdentityPlugin).forService('ubiquity');
    } else if (this.options.jwt) {
      clientOptions.identity.jwt = this.options.jwt;
    }
    const {
      app_token: appToken,
      company_token: companyToken,
      UBIQUITY_BASE_URL: baseUrl,
      UBIQUITY_BASE_S3_URL: baseS3Url
    } = await app.configuration('app_token', 'company_token', 'UBIQUITY_BASE_URL', 'UBIQUITY_BASE_S3_URL');
    clientOptions.baseUrl = clientOptions.baseUrl || baseUrl;
    clientOptions.baseS3Url = clientOptions.baseS3Url || baseS3Url;
    return new Ubiquity(companyToken, appToken, clientOptions);
  }
}
