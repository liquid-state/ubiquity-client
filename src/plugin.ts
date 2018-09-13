import { App } from '@liquid-state/iwa-core';
import IdentityPlugin from '@liquid-state/iwa-identity';
import Ubiquity, { IOptions } from './client';


export type DefaultConfig = {
  useAls: false,
  useIdentity: true,
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

  static configure(customise: (conf: DefaultConfig) => Config) {
    const options = customise({ useAls: false, useIdentity: true });
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
    }
    const { APP_TOKEN, COMPANY_TOKEN } = await app.configuration('APP_TOKEN', 'COMPANY_TOKEN');

    return new Ubiquity(COMPANY_TOKEN, APP_TOKEN, clientOptions);
  }
}
