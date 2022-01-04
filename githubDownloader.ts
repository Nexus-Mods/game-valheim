import * as https from 'https';
import * as _ from 'lodash';
import * as semver from 'semver';
import * as url from 'url';

import { GAME_ID } from './common';

import { IGithubRepo} from './types';

import { IncomingHttpHeaders, IncomingMessage } from 'http';
import { actions, log, selectors, types, util } from 'vortex-api';

const URL_CONFIG_MANAGER = 'https://api.github.com/repos/BepInEx/BepInEx.ConfigurationManager';
const URL_BIX = 'https://api.github.com/repos/BepInEx/BepInEx';

const URL_SITE_CONFIG_MANAGER = 'https://github.com/BepInEx/BepInEx.ConfigurationManager';
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

function query(baseUrl: string, request: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const getRequest = getRequestOptions(`${baseUrl}/${request}`);
    https.get(getRequest, (res: IncomingMessage) => {
      res.setEncoding('utf-8');
      const msgHeaders: IncomingHttpHeaders = res.headers;
      const callsRemaining = parseInt(util.getSafe(msgHeaders, ['x-ratelimit-remaining'], '0'), 10);
      if ((res.statusCode === 403) && (callsRemaining === 0)) {
        const resetDate = parseInt(util.getSafe(msgHeaders, ['x-ratelimit-reset'], '0'), 10);
        log('info', 'GitHub rate limit exceeded',
          { reset_at: (new Date(resetDate)).toString() });
        return reject(new util.ProcessCanceled('GitHub rate limit exceeded'));
      }

      let output: string = '';
      res
        .on('data', data => output += data)
        .on('end', () => {
          try {
            return resolve(JSON.parse(output));
          } catch (parseErr) {
            return reject(parseErr);
          }
        });
    })
      .on('error', err => {
        return reject(err);
      })
      .end();
  });
}

function getRequestOptions(link) {
  const relUrl = url.parse(link);
  return ({
    ..._.pick(relUrl, ['port', 'hostname', 'path']),
    headers: {
      'User-Agent': 'Vortex',
    },
  });
}

async function notifyUpdate(api: types.IExtensionApi,
                            repo: IGithubRepo): Promise<void> {
  const gameId = selectors.activeGameId(api.store.getState());
  const t = api.translate;
  return new Promise((resolve, reject) => {
    api.sendNotification({
      type: 'info',
      id: `divine-update`,
      noDismiss: true,
      allowSuppress: true,
      title: 'Update for {{name}}',
      message: 'Latest: {{latest}}, Installed: {{current}}',
      replace: {
        latest: repo.latest,
        current: repo.current,
      },
      actions: [
        { title : 'More', action: (dismiss: () => void) => {
            api.showDialog('info', '{{name}} Update', {
              text: 'Vortex has detected a newer version of {{name}} ({{latest}}) available to download from {{website}}. You currently have version {{current}} installed.'
              + '\nVortex can download and attempt to install the new update for you.',
              parameters: {
                name: repo.name,
                website: repo.website,
                latest: repo.latest,
                current: repo.current,
              },
            }, [
                {
                  label: 'Download',
                  action: () => {
                    resolve();
                    dismiss();
                  },
                },
              ]);
          },
        },
        {
          title: 'Dismiss',
          action: (dismiss) => {
            resolve();
            dismiss();
          },
        },
      ],
    });
  });
}

export async function getLatestReleases(api: types.IExtensionApi, repo: IGithubRepo) {
  if (repo.current === undefined) {
    repo.current = getCurrentVersion(api, repo);
  }
  return query(repo.url, 'releases')
  .then((releases) => {
    if (!Array.isArray(releases)) {
      return Promise.reject(new util.DataInvalid('expected array of github releases'));
    }
    const current = releases
      .filter(rel => {
        const tagName = repo.coerceVersion(util.getSafe(rel, ['tag_name'], undefined));
        const isPreRelease = util.getSafe(rel, ['prerelease'], false);
        const version = semver.valid(tagName);

        return (!isPreRelease
          && (version !== null)
          && ((repo.current === undefined) || (semver.gte(version, repo.current))));
      })
      .sort((lhs, rhs) => semver.compare(
        repo.coerceVersion(rhs.tag_name),
        repo.coerceVersion(lhs.tag_name)));

    return Promise.resolve(current);
  });
}

async function startDownload(api: types.IExtensionApi,
                             repo: IGithubRepo,
                             downloadLink: string) {
  // tslint:disable-next-line: no-shadowed-variable - why is this even required ?
  const redirectionURL = await new Promise((resolve, reject) => {
    https.request(getRequestOptions(downloadLink), res => {
      return resolve(res.headers['location']);
    })
      .on('error', err => reject(err))
      .end();
  });
  const dlInfo = {
    game: GAME_ID,
    name: repo.name,
  };
  api.events.emit('start-download', [redirectionURL], dlInfo, undefined,
    (error, id) => {
      if (error !== null) {
        if ((error.name === 'AlreadyDownloaded')
            && (error.downloadId !== undefined)) {
          id = error.downloadId;
        } else {
          api.showErrorNotification('Download failed',
            error, { allowReport: false });
          return Promise.resolve();
        }
      }
      api.events.emit('start-install-download', id, true, (err, modId) => {
        if (err !== null) {
          api.showErrorNotification('Failed to install repo',
            err, { allowReport: false });
        }

        const state = api.getState();
        const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
        const batch = [
          actions.setModEnabled(profileId, modId, true),
          actions.setModAttribute(GAME_ID, modId, 'RepoDownload', repo.name),
          actions.setModAttribute(GAME_ID, modId, 'version', repo.latest),
        ];
        for (const act of batch) {
          api.store.dispatch(act);
        }
        // util.batchDispatch(api.store, batch);
        return Promise.resolve();
      });
    }, 'ask');
}

async function resolveDownloadLink(repo: IGithubRepo, currentReleases: any[]) {
  const archives = currentReleases[0].assets.filter(asset =>
    asset.name.match(repo.filePattern));

  const downloadLink = archives[0]?.browser_download_url;
  return (downloadLink === undefined)
    ? Promise.reject(new util.DataInvalid('Failed to resolve browser download url'))
    : Promise.resolve(downloadLink);
}

function getCurrentVersion(api: types.IExtensionApi, repo: IGithubRepo) {
  const state = api.getState();
  const mods = state.persistent.mods[GAME_ID];
  if (mods === undefined) {
    return '0.0.0';
  }
  // const profile = selectors.activeProfile(state);
  // const isEnabled = (modId: string) => util.getSafe(profile, ['modState', modId, 'enabled'], false);
  const mod = Object.values(mods).find(x => x.attributes['RepoDownload'] === repo.name);
  if (mod === undefined) {
    return '0.0.0';
  }
  return mod.attributes['version'];
}

export async function checkConfigManagerUpd(api: types.IExtensionApi, force?: boolean) {
  const repo = REPOS['configManager'];
  return checkForUpdates(api, repo, force);
}

async function checkForUpdates(api: types.IExtensionApi,
                               repo: IGithubRepo,
                               force?: boolean): Promise<string> {
  repo.current = getCurrentVersion(api, repo);
  return getLatestReleases(api, repo)
    .then(async currentReleases => {
      const mostRecentVersion = repo.coerceVersion(currentReleases[0].tag_name);
      const downloadLink = await resolveDownloadLink(repo, currentReleases);
      if (semver.valid(mostRecentVersion) === null) {
        return Promise.resolve(repo.current);
      } else {
        repo.latest = mostRecentVersion;
        if (semver.gt(mostRecentVersion, repo.current)) {
          const update = () => force ? Promise.resolve() : notifyUpdate(api, repo);
          return update()
            .then(() => startDownload(api, repo, downloadLink))
            .then(() => Promise.resolve(mostRecentVersion));
        } else {
          return Promise.resolve(repo.current);
        }
      }
    }).catch(err => {
      if (err instanceof util.UserCanceled || err instanceof util.ProcessCanceled) {
        return Promise.resolve(repo.current);
      }

      const allowReport = !['ECONNRESET', 'EPERM', 'ENOENT', 'EPROTO'].includes(err.code);
      api.showErrorNotification('Unable to update from Github repo',
        { ...err, repoName: repo.name }, { allowReport });

      return Promise.resolve(repo.current);
    });
}

export async function downloadConfigManager(api: types.IExtensionApi): Promise<void> {
  const repo = REPOS['configManager'];
  repo.current = getCurrentVersion(api, repo);
  if (repo.current !== '0.0.0') {
    return;
  }
  return getLatestReleases(api, repo)
    .then(async currentReleases => {
      const downloadLink = await resolveDownloadLink(repo, currentReleases);
      return startDownload(api, repo, downloadLink);
    })
    .catch(err => {
      if (err instanceof util.UserCanceled || err instanceof util.ProcessCanceled) {
        return Promise.resolve();
      } else {
        api.showErrorNotification('Unable to download/install repo',
          { ...err, details: repo.name });
        return Promise.resolve();
      }
    });
}
