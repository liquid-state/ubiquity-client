import { UbiquityError } from './client.js';
export interface IUbiquityAdmin {
  addTagToDocument(app: Identifier, documentId: number, tag: string): Promise<any>;
  apps(): Promise<any>;
  appDetails(app: Identifier): Promise<any>;
  createDocument(app: Identifier, name: string, audienceType: string, metadata?: IDocumentMetadata, ownerId?: string): Promise<any>;
  createDocumentVersion(
    app: Identifier,
    documentId: number,
    versionData: ICreateVersion
  ): Promise<any>;
  deleteDocument(app: Identifier, documentId: number): Promise<any>;
  documents(app: Identifier): Promise<any>;
  documentVersions(app: Identifier, document: Identifier): Promise<any[]>;
  documentVersion(app: Identifier, document: Identifier, version: Identifier): Promise<any>;
  documentLatestVersionPublicDetails(app: Identifier, documentProductId: Identifier): Promise<any>;
  editDocument(
    app: Identifier,
    documentId: number,
    name: string,
    metadata?: IDocumentMetadata,
    ownerId?: string
  ): Promise<{ [key: string]: any }>;
  exportUploadDone(app: Identifier, importId: string): Promise<any>;
  pages(
    documentOrDocumentVersion: { links: { pages: string } } | { links: { page_list: string } }
  ): Promise<any>;
  documentVersionUploadStatus(
    app: Identifier,
    documentId: number,
    versionId: number,
    importId: string
  ): Promise<any>;
  getDocumentUploadUrl(
    app: Identifier,
    documentId: number,
    versionId: number,
    uploadUrlData: IGetDocumentVersionUploadUrl
  ): Promise<any>;
  removeTagFromDocument(app: Identifier, documentId: number, tag: string): Promise<any>;
  setDocumentAvailability(
    app: Identifier,
    documentId: number,
    availability: 'free' | 'unavailable' | 'paid'
  ): Promise<any>;
  uploadDocumentVersion(
    app: Identifier,
    documentId: number,
    versionId: number,
    uploadUrlData: IGetDocumentVersionUploadUrl,
    file: File
  ): Promise<any>;
  publishingDetails(app: Identifier, documentId: number): Promise<any>;
}

interface IOptions {
  baseUrl?: string;
  baseS3Url?: string;
}

interface IdentityOptions {
  jwt?: string;
  apiKey?: string;
}

interface IDocumentMetadata {
  tags: [{ term: string; label: string; scheme?: string }];
  custom: { [key: string]: any };
}

const defaultOptions = {
  baseUrl: 'https://cloud.liquid-state.com/',
  baseS3Url: 'https://s3.ap-southeast-2.amazonaws.com/liquidstate-prod-apsoutheast2/',
};

type ID = number | string;

// support passing a whole app object back
type Identifier = ID | { id: number };

interface ICreateVersion {
  name: string;
  description: string;
  creationMode?: string;
  createFromVersion?: string;
}

interface IEditVersion {
  name?: string;
  description?: string;
}

interface IGetDocumentVersionUploadUrl {
  importType?: string;
  fileName: string;
  importAtPosition?: number;
  issueName?: string;
}

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

  addTagToDocument = async (app: Identifier, documentId: number, tag: string) => {
    const body = new FormData();
    body.append('term', tag);
    body.append('label', tag);

    const resp = await this.request(
      `api/core/v1/apps/${this.idFrom(app)}/documents/${documentId}/metadata/tags/add/`,
      'POST',
      body
    );

    return resp.json();
  };

  apps = async () => {
    const resp = await this.request('api/core/v1/apps/');
    return resp.json();
  };

  appDetails = async (app: Identifier) => {
    const resp = await this.request(`api/core/v1/apps/${this.idFrom(app)}/`);
    return resp.json();
  };

  createDocument = async (
    app: Identifier,
    name: string,
    audienceType: string,
    metadata?: IDocumentMetadata,
    ownerId?: string
  ) => {
    const body = new FormData();
    body.append('name', name);
    body.append('audience_type', audienceType);
    if (metadata) {
      body.append('metadata', JSON.stringify(metadata));
    }

    if (ownerId) {
      body.append('owner_id', ownerId);
    }

    const resp = await this.request(
      `api/core/v1/apps/${this.idFrom(app)}/documents/`,
      'POST',
      body
    );
    const responseBody = await resp.json();

    // wait for initial document version to be created
    while (true) {
      const versionList = await this.documentVersions(app, responseBody.id);
      if (versionList.length > 0 && versionList[0].is_ready) {
        responseBody.latest_version = versionList[0];
        break;
      }
      await this.delay();
    }

    return responseBody;
  };

  createDocumentVersion = async (
    app: Identifier,
    documentId: number,
    versionData: ICreateVersion
  ) => {
    const body = new FormData();
    body.append('name', versionData.name);
    body.append('description', versionData.description);
    if (versionData.createFromVersion) {
      body.append('create_from_version', versionData.createFromVersion);
    }
    if (versionData.creationMode) {
      body.append('creation_mode', versionData.creationMode);
    }
    const resp = await this.request(
      `api/core/v1/apps/${this.idFrom(app)}/documents/${documentId}/versions/`,
      'POST',
      body
    );

    const respBody = await resp.json();

    while (true) {
      const versionInfo = await this.documentVersion(app, documentId, respBody.id);

      if (versionInfo.is_ready) break;

      await this.delay();
    }

    return respBody;
  };

  deleteDocument = async (app: Identifier, documentId: number) => {
    const resp = await this.request(
      `api/core/v1/apps/${this.idFrom(app)}/documents/${documentId}/`,
      'DELETE'
    );
    return resp;
  };

  document = async (app: Identifier, documentId: number) => {
    const resp = await this.request(
      `api/core/v1/apps/${this.idFrom(app)}/documents/${documentId}/`
    );

    return resp.json();
  };

  documents = async (app: Identifier, queryStringParameters?: { [key: string]: string }) => {
    const resp = await this.request(
      `api/core/v1/apps/${this.idFrom(app)}/documents/${
        queryStringParameters
          ? `?${Object.keys(queryStringParameters).reduce(
              (queryString, key) => `${queryString}${key}=${queryStringParameters[key]}&`,
              ''
            )}`
          : ''
      }`
    );
    return resp.json();
  };

  documentPublishedStatus = async (app: Identifier, document: Identifier) => {
    const resp = await this.request(
      `/api/core/v1/apps/${this.idFrom(app)}/documents/${this.idFrom(document)}/channels/Public/`
    );

    return resp.json();
  };

  documentVersions = async (app: Identifier, document: Identifier) => {
    const url = `api/core/v1/apps/${this.idFrom(app)}/documents/${this.idFrom(
      document
    )}/versions/`;
    return (await this.request(url)).json();
  };

  documentVersion = async (app: Identifier, document: Identifier, version: Identifier) => {
    const resp = await this.request(
      `api/core/v1/apps/${this.idFrom(app)}/documents/${this.idFrom(
        document
      )}/versions/${this.idFrom(version)}/`
    );

    return resp.json();
  };

  documentLatestVersionPublicDetails = async (app: Identifier, documentProductId: Identifier) => {
    const resp = await this.request(
      `api/core/v1/apps/${this.idFrom(app)}/documents/${this.idFrom(documentProductId)}/`
    );

    return resp.json();
  };

  editDocument = async (
    app: Identifier,
    documentId: number,
    name: string,
    metadata?: IDocumentMetadata,
    ownerId?: string
  ) => {
    const body = new FormData();
    body.append('name', name);
    if (metadata) {
      body.append('metadata', JSON.stringify(metadata));
    }

    if (ownerId) {
      body.append('owner_id', ownerId);
    }

    const resp = await this.request(
      `api/core/v1/apps/${this.idFrom(app)}/documents/${documentId}/`,
      'POST',
      body
    );

    return resp.json();
  };

  editDocumentVersion = async (
    app: Identifier,
    documentId: number,
    versionId: number,
    editData: IEditVersion
  ) => {
    const body = new FormData();
    if (editData.name) {
      body.append('name', editData.name);
    }
    if (editData.description) {
      body.append('description', editData.description);
    }
    const resp = await this.request(
      `api/core/v1/apps/${this.idFrom(
        app
      )}/documents/${documentId}/versions/${versionId}/configuration/`,
      'POST',
      body
    );
  };

  exportUploadDone = async (app: Identifier, importId: string) => {
    const resp = await this.request(
      `api/importing/v1/apps/${this.idFrom(app)}/isues/import/${importId}/status/`,
      'POST'
    );
    return resp.json();
  };

  pages = async (
    documentOrDocumentVersion: { links: { pages: string } } | { links: { page_list: string } }
  ) => {
    let url;

    if ('pages' in documentOrDocumentVersion.links) {
      url = documentOrDocumentVersion.links.pages;
    } else {
      url = documentOrDocumentVersion.links.page_list;
    }
    return (await this.request(url)).json();
  };

  appendOptionalFormData = async <T>(
    obj: { [key: string]: any },
    optionalKeys: { objKey: string; formKey: string }[],
    form = new FormData()
  ) => {
    optionalKeys.forEach(({ objKey, formKey }) => {
      if (obj[objKey]) {
        form.append(formKey, obj[objKey]);
      }
    });
  };

  getDocumentUploadUrl = async (
    app: Identifier,
    documentId: number,
    versionId: number,
    uploadUrlData: IGetDocumentVersionUploadUrl
  ) => {
    const body = new FormData();
    body.append('import_file_name', uploadUrlData.fileName);

    this.appendOptionalFormData(
      uploadUrlData,
      [
        { objKey: 'importAtPosition', formKey: 'import_at_position' },
        { objKey: 'importType', formKey: 'import_type' },
      ],
      body
    );

    const resp = await this.request(
      `/api/importing/v1/apps/${this.idFrom(
        app
      )}/documents/${documentId}/versions/${versionId}/imports/`,
      'POST',
      body
    );

    const respBody = await resp.json();

    return {
      importSessionId: respBody.id,
      uploadUrl: respBody.upload_url,
    };
  };

  putDocument = async (uploadUrl: string, file: File) => {
    const body = new FormData();
    body.append('file', file);
    const resp = await fetch(uploadUrl, {
      headers: {
        'Content-Type': 'application/pdf',
      },
      method: 'PUT',
      body,
    });

    return resp;
  };

  removeTagFromDocument = async (app: Identifier, documentId: number, tag: string) => {
    const body = new FormData();
    body.append('term', tag);
    body.append('label', tag);

    const resp = await this.request(
      `api/core/v1/apps/${this.idFrom(app)}/documents/${documentId}/metadata/tags/remove/`,
      'POST',
      body
    );

    return resp.json();
  };

  documentVersionUploadStatus = async (
    app: Identifier,
    documentId: number,
    versionId: number,
    importId: string
  ) => {
    const resp = await this.request(
      `api/importing/v1/apps/${this.idFrom(
        app
      )}/documents/${documentId}/versions/${versionId}/imports/${importId}/`,
      'GET'
    );

    return resp.json();
  };

  uploadDocumentVersion = async (
    app: Identifier,
    documentId: number,
    versionId: number,
    uploadUrlData: IGetDocumentVersionUploadUrl,
    file: File
  ) => {
    if (uploadUrlData.fileName.length > 30) {
      uploadUrlData.fileName = `${uploadUrlData.fileName.slice(0, 26)}.pdf`;
    }

    const { importSessionId, uploadUrl } = await this.getDocumentUploadUrl(
      app,
      documentId,
      versionId,
      uploadUrlData
    );
    const resp = await this.putDocument(uploadUrl, file);

    const uploadDoneResp = await this.documentVersionUploadAcknowledged(
      app,
      documentId,
      versionId,
      importSessionId
    );

    while (true) {
      const statusResp = await this.documentVersionUploadStatus(
        app,
        documentId,
        versionId,
        importSessionId
      );

      if (statusResp.status === 'completed' || statusResp.status === 'failed') {
        break;
      }

      await this.delay();
    }

    return { importSessionId, resp };
  };

  documentVersionUploadAcknowledged = async (
    app: Identifier,
    documentId: number,
    versionId: number,
    importId: string
  ) => {
    const body = new FormData();
    body.append('status', 'upload_acknowledged');
    const resp = await this.request(
      `/api/importing/v1/apps/${this.idFrom(
        app
      )}/documents/${documentId}/versions/${versionId}/imports/${importId}/`,
      'PATCH',
      'status=upload_acknowledged'
    );

    return resp;
  };

  publish = async (app: Identifier, documentId: number, versionId: number) => {
    const initalPublishDetailsList = await this.publishingDetails(app, documentId);

    await this.publishDocument(app, documentId, versionId);
    let publishingDetails = null;

    while (!publishingDetails) {
      const publishingDetailsList = await this.publishingDetails(app, documentId);

      if (publishingDetailsList.length > initalPublishDetailsList.length) {
        publishingDetails = publishingDetailsList;
      }
      await this.delay();
    }

    const { id: publishingRecord } = publishingDetails.find(
      ({ version }: { [key: string]: any }) => version.id == `${versionId}`
    );

    let isPublishing = true;

    while (isPublishing) {
      const statusBody = await this.publishingStatus(app, documentId, publishingRecord);

      switch (statusBody.publishing_record.status) {
        case 'successful':
          isPublishing = false;
          break;
        case 'failed':
          isPublishing = false;
          throw UbiquityError('Failed to publish document', statusBody);
        default:
          continue;
      }

      await this.delay();
    }
  };

  publishingDetails = async (app: Identifier, documentId: number) => {
    const resp = await this.request(
      `/api/publishing/v1/apps/${this.idFrom(
        app
      )}/documents/${documentId}/channels/Public/published/`
    );

    return resp.json();
  };

  publishDocument = async (app: Identifier, documentId: number, versionId: number) => {
    const body = new FormData();
    body.append('version_id', `${versionId}`);

    const resp = await this.request(
      `/api/publishing/v1/apps/${this.idFrom(
        app
      )}/documents/${documentId}/channels/Public/published/`,
      'POST',
      body
    );

    return resp;
  };

  publishingStatus = async (app: Identifier, documentId: number, publishingRecord: number) => {
    const resp = await this.request(
      `/api/publishing/v1/apps/${this.idFrom(
        app
      )}/documents/${documentId}/channels/Public/published/${publishingRecord}/`
    );

    return resp.json();
  };

  setDocumentAvailability = async (
    app: Identifier,
    documentId: number,
    availability: 'free' | 'unavailable' | 'paid'
  ) => {
    const body = new FormData();
    body.append('availability', availability);

    const resp = await this.request(
      `/api/core/v1/apps/${this.idFrom(app)}/documents/${documentId}/channels/Public/`,
      'POST',
      body
    );

    return resp;
  };

  private delay = async (ms = 200) =>
    new Promise<void>(resolve => setTimeout(() => resolve(), ms));

  private request = async (
    path: string,
    method = 'GET',
    body?: FormData | string,
    headers?: { [key: string]: any }
  ) => {
    const auth = this.identity.apiKey
      ? `Token ${this.identity.apiKey}`
      : `Bearer ${this.identity.jwt}`;

    const resp = await fetch(`${this.options.baseUrl}${this.cleanPath(path)}`, {
      headers: { Authorization: auth, ...(headers ? headers : {}) },
      method,
      ...(body ? { body } : {}),
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
