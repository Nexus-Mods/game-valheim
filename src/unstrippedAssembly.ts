import * as path from 'path';

import { fs } from 'vortex-api';

export class UnstrippedAssemblyDownloader {
  private mTempPath: string;
  constructor(tempPath: string) {
    this.mTempPath = tempPath;
  }

  public async downloadNewest(searchType: SearchType, value: string): Promise<string> {
    const pred = searchType === 'full_name'
      ? (ent: IManifestEntry) => ent.full_name === value
      : (ent: IManifestEntry) => ent.uuid4 === value;
    try {
      const manifestEntry = await this.findManifestEntry(value, pred);
      const latestVer = manifestEntry.versions[0];
      const dest = path.join(this.mTempPath, latestVer.full_name + '.zip');
      await this.fetchFileFromUrl(latestVer.download_url, dest);
      return Promise.resolve(dest);
    } catch (err) {
      return Promise.reject(err);
    }
  }

  private async fetchFileFromUrl(url: string, dest: string) {
    try {
      const res = await fetch(url);
      const buffer = await res.arrayBuffer();
      await fs.writeFileAsync(dest, Buffer.from(buffer));
    } catch (err) {
      return Promise.reject(err);
    }
  }

  private async getManifest() {
    const tempFilePath = path.join(this.mTempPath, MANIFEST_FILE);
    await this.fetchFileFromUrl(MANIFEST_URL, tempFilePath);
    const data = await fs.readFileAsync(tempFilePath, { encoding: 'utf8' });
    const manifest: IManifestEntry[] = JSON.parse(data);
    return manifest;
  }

  private async findManifestEntry(value: string, pred: (entry: IManifestEntry) => boolean) {
    const manifestEntries: IManifestEntry[] = await this.getManifest();
    const entry = manifestEntries.find(pred);
    if (entry === undefined) {
      throw new NotFoundError(value);
    }
    return entry;
  }
}

const MANIFEST_URL = 'https://valheim.thunderstore.io/api/v1/package/';
const MANIFEST_FILE = 'manifest.json';

class NotFoundError extends Error {
  constructor(what: string) {
    super(`Failed to find entry based on: ${what}`);
    this.name = 'NotFoundError';
  }
}

type SearchType = 'full_name' | 'uuid4';

interface IManifestEntry {
  name: string;
  full_name: string;
  owner: string;
  package_url: string;
  date_created: string;
  date_updated: string;
  uuid4: string;
  rating_score: number;
  is_pinned: boolean;
  is_deprecated: boolean;
  has_nsfw_content: boolean;
  categories: any[];
  versions: IManifestEntryVersion[];
}

interface IManifestEntryVersion {
  name: string;
  full_name: string;
  description: string;
  icon: string;
  version_number: string;
  dependencies: any[];
  download_url: string;
  downloads: number;
  date_created: string;
  website_url: string;
  is_active: boolean;
  uuid4: string;
}
