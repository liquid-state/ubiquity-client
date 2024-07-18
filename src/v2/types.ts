type Url = string;
type DateTime = string;

export interface APIList<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

export interface App {
  url: Url;
  id: number;
  token: string;
  public_key: string;
  forms: Url;
  messages: Url;
  weblinks: Url;
}

export interface NewAppData {
  name: string;
}

export interface ContentItem {
  url: Url;
  uuid: string;
  name: string;
  slug: string;
  description: string;
  versions: Url;
  publishing_records: Url;
  created: DateTime;
  modified: DateTime;
  is_available: boolean;
}

export interface ContentItemData {
  name: string;
  slug?: string;
  description?: string;
}

export type Form = ContentItem;
export type Message = ContentItem;
export type Weblink = ContentItem & {
  type: 'website' | 'web_form';
};

export interface ContentItemVersion {
  url: Url;
  name: string;
  number: number;
  metadata: { [key: string]: any };
}

export type FormVersion = ContentItemVersion & {
  schema: { [key: string]: any };
  ui_schema: { [key: string]: any };
};

export type MessageVersion = ContentItemVersion & {
  title: string;
  body: string;
  payload: { [key: string]: any };
};

export type WeblinkVersion = ContentItemVersion & {
  content_url: string;
  type: 'website' | 'web_form';
};

export interface PublishingRecord {
  url: Url;
  available: boolean;
  version: Url;
  created: DateTime;
  created_by: string;
}

interface ContentLookupBaseType {
  uuid: string;
  name: string;
  slug: string;
  description: string;
}

export type FormContentLookup = ContentLookupBaseType & {
  content: {
    number: number;
    metadata: { [key: string]: any };
    schema: { [key: string]: any };
    ui_schema: { [key: string]: any };
  };
};

export type MessageContentLookup = ContentLookupBaseType & {
  content: {
    number: number;
    metadata: { [key: string]: any };
    title: string;
    body: string;
    payload: { [key: string]: any };
  };
};

export type WeblinkContentLookup = ContentLookupBaseType & {
  content: {
    number: number;
    metadata: { [key: string]: any };
    content_url: string;
    type: 'website' | 'web_form';
  };
};
