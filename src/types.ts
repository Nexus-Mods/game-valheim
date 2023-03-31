export interface IGithubRepo {
  name: string;
  url: string;
  website: string;
  filePattern: RegExp;
  coerceVersion: (version: string) => string;
  latest?: string;
  current?: string;
}
