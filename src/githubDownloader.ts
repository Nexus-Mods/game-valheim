/* eslint-disable max-lines-per-function */
import * as _ from 'lodash';
import * as stream from 'stream';
import { promisify } from 'util';
const finished = promisify(stream.finished);
  
import * as semver from 'semver';

import axios from 'axios';

import { GAME_ID } from './common';

import { IGithubRepo, IReleaseMap } from './types';

import * as fs from 'fs';

import { actions, log, selectors, types, util } from 'vortex-api';

const URL_CONFIG_MANAGER = 'https://api.github.com/repos/BepInEx/BepInEx.ConfigurationManager';
const URL_SITE_CONFIG_MANAGER = 'https://github.com/BepInEx/BepInEx.ConfigurationManager';

const URL_BIX = 'https://api.github.com/repos/BepInEx/BepInEx';
const URL_SITE_BIX = 'https://github.com/BepInEx/BepInEx';

const REPOS: { [repoId: string]: IGithubRepo } = {
  bepInEx: {
    name: 'BepInEx',
    url: URL_BIX,
    website: URL_SITE_BIX,
    filePattern: /(BepInEx_x64_[0-9]+.[0-9]+.[0-9]+.[0-9]+.zip)/i,
    coerceVersion: (version: string) => semver.coerce(version.slice(1)).version,
  },
  configManager: {
    name: 'Configuration Manager',
    url: URL_CONFIG_MANAGER,
    website: URL_SITE_CONFIG_MANAGER,
    filePattern: /(BepInEx.ConfigurationManager_v[0-9]+.[0-9]+.zip)/i,
    coerceVersion: (version: string) => semver.coerce(version.slice(1)).version,
  },
};

export async function getReleaseMap(api: types.IExtensionApi,
                                    repo?: IGithubRepo): Promise<IReleaseMap> {
  repo = !repo ? REPOS.bepInEx : repo;
  const releases = await getAllReleases(api, repo);
  const releaseMap: IReleaseMap = {};
  for (const release of releases) {
    const tagName = release.tag_name;
    const asset = release.assets.find(asset => {
      const match = asset.name.match(repo.filePattern);
      return match && match[1];
    });

    if (asset) {
      releaseMap[tagName] = asset.browser_download_url;
    }
  }
  return releaseMap;
}

let releasesCache = null;
async function getAllReleases(api: types.IExtensionApi, repo?: IGithubRepo): Promise<any[]> {
  if (releasesCache) {
    return releasesCache;
  }
  try {
    const response = await axios.get(`${repo.url}/releases`);
    const releases = response.data;
    releasesCache = releases;
    return releases;
  } catch (error) {
    api.showErrorNotification('Failed to get releases for {{repName}}', error, { allowReport: false, replace: { repName: repo.name } });
    return [];
  }
}

async function getLatestReleaseVersion(api: types.IExtensionApi,
                                       repo: IGithubRepo): Promise<string | null> {
  try {
    const response = await axios.get(`${repo.url}/releases/latest`);
    if (response.status === 200) {
      const release = response.data;
      const tagName = release.tag_name;
      if (tagName) {
        const match = tagName.match(repo.filePattern);
        if (match && match[1]) {
          if (!repo.downloadUrl && release.assets.length > 0) {
            repo.downloadUrl = release.assets[0].browser_download_url;
          }
          return repo.coerceVersion(match[1]);
        }
      }
    }
  } catch (error) {
    api.showErrorNotification(
      'Failed to get latest release version for {{repName}}',
      error, { allowReport: false, replace: { repName: repo.name } });
  }

  return null;
}

async function getLatestReleaseDownloadUrl(api: types.IExtensionApi,
                                           repo: IGithubRepo): Promise<string | null> {
  try {
    const response = await axios.get(`${repo.url}/releases/latest`);

    if (response.status === 200) {
      const release = response.data;
      if (release.assets.length > 0) {
        return release.assets[0].browser_download_url;
      }
    }
  } catch (error) {
    api.showErrorNotification(
      'Error fetching the latest release url for {{repName}}',
      error, { allowReport: false, replace: { repName: repo.name } });
  }

  return null;
}

export async function doDownload(downloadUrl: string, destination: string): Promise<void> {
  const response = await axios({
    method: 'get',
    url: downloadUrl,
    responseType: 'arraybuffer',
    headers: {
      "Accept-Encoding": "gzip, deflate",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/107.0.0.0 Safari/537.36"
    },
  });
  await fs.promises.writeFile(destination, Buffer.from(response.data));
}

async function importAndInstall(api: types.IExtensionApi, repo: IGithubRepo, filePath: string) {
  api.events.emit('import-downloads', [filePath], (dlIds: string[]) => {
    const id = dlIds[0];
    if (id === undefined) {
      return;
    }
    api.events.emit('start-install-download', id, true, (err, modId) => {
      if (err !== null) {
        api.showErrorNotification('Failed to install repo', err, { allowReport: false });
      }
  
      const state = api.getState();
      const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
      const batch = [
        actions.setModEnabled(profileId, modId, true),
        actions.setModAttribute(GAME_ID, modId, 'RepoDownload', repo.name),
        actions.setModAttribute(GAME_ID, modId, 'version', repo.latest),
      ];
  
      util.batchDispatch(api.store, batch);
      return Promise.resolve();
    });
  });
}
