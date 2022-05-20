"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.downloadConfigManager = exports.checkConfigManagerUpd = exports.getLatestReleases = void 0;
const https = __importStar(require("https"));
const _ = __importStar(require("lodash"));
const semver = __importStar(require("semver"));
const url = __importStar(require("url"));
const common_1 = require("./common");
const vortex_api_1 = require("vortex-api");
const URL_CONFIG_MANAGER = 'https://api.github.com/repos/BepInEx/BepInEx.ConfigurationManager';
const URL_BIX = 'https://api.github.com/repos/BepInEx/BepInEx';
const URL_SITE_CONFIG_MANAGER = 'https://github.com/BepInEx/BepInEx.ConfigurationManager';
const URL_SITE_BIX = 'https://github.com/BepInEx/BepInEx';
const REPOS = {
    bepInEx: {
        name: 'BepInEx',
        url: URL_BIX,
        website: URL_SITE_BIX,
        filePattern: /(BepInEx_x64_[0-9]+.[0-9]+.[0-9]+.[0-9]+.zip)/i,
        coerceVersion: (version) => semver.coerce(version.slice(1)).version,
    },
    configManager: {
        name: 'Configuration Manager',
        url: URL_CONFIG_MANAGER,
        website: URL_SITE_CONFIG_MANAGER,
        filePattern: /(BepInEx.ConfigurationManager_v[0-9]+.[0-9]+.zip)/i,
        coerceVersion: (version) => semver.coerce(version.slice(1)).version,
    },
};
function query(baseUrl, request) {
    return new Promise((resolve, reject) => {
        const getRequest = getRequestOptions(`${baseUrl}/${request}`);
        https.get(getRequest, (res) => {
            res.setEncoding('utf-8');
            const msgHeaders = res.headers;
            const callsRemaining = parseInt(vortex_api_1.util.getSafe(msgHeaders, ['x-ratelimit-remaining'], '0'), 10);
            if ((res.statusCode === 403) && (callsRemaining === 0)) {
                const resetDate = parseInt(vortex_api_1.util.getSafe(msgHeaders, ['x-ratelimit-reset'], '0'), 10);
                (0, vortex_api_1.log)('info', 'GitHub rate limit exceeded', { reset_at: (new Date(resetDate)).toString() });
                return reject(new vortex_api_1.util.ProcessCanceled('GitHub rate limit exceeded'));
            }
            let output = '';
            res
                .on('data', data => output += data)
                .on('end', () => {
                try {
                    return resolve(JSON.parse(output));
                }
                catch (parseErr) {
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
    return (Object.assign(Object.assign({}, _.pick(relUrl, ['port', 'hostname', 'path'])), { headers: {
            'User-Agent': 'Vortex',
        } }));
}
function notifyUpdate(api, repo) {
    return __awaiter(this, void 0, void 0, function* () {
        const gameId = vortex_api_1.selectors.activeGameId(api.store.getState());
        const t = api.translate;
        return new Promise((resolve, reject) => {
            api.sendNotification({
                type: 'info',
                id: `repo-update`,
                noDismiss: true,
                allowSuppress: true,
                title: 'Update for {{name}}',
                message: 'Latest: {{latest}}, Installed: {{current}}',
                replace: {
                    name: repo.name,
                    latest: repo.latest,
                    current: repo.current,
                },
                actions: [
                    { title: 'More', action: (dismiss) => {
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
                            reject(new vortex_api_1.util.UserCanceled());
                            dismiss();
                        },
                    },
                ],
            });
        });
    });
}
function getLatestReleases(api, repo) {
    return __awaiter(this, void 0, void 0, function* () {
        if (repo.current === undefined) {
            repo.current = getCurrentVersion(api, repo);
        }
        return query(repo.url, 'releases')
            .then((releases) => {
            if (!Array.isArray(releases)) {
                return Promise.reject(new vortex_api_1.util.DataInvalid('expected array of github releases'));
            }
            const current = releases
                .filter(rel => {
                const tagName = repo.coerceVersion(vortex_api_1.util.getSafe(rel, ['tag_name'], undefined));
                const isPreRelease = vortex_api_1.util.getSafe(rel, ['prerelease'], false);
                const version = semver.valid(tagName);
                return (!isPreRelease
                    && (version !== null)
                    && ((repo.current === undefined) || (semver.gte(version, repo.current))));
            })
                .sort((lhs, rhs) => semver.compare(repo.coerceVersion(rhs.tag_name), repo.coerceVersion(lhs.tag_name)));
            return Promise.resolve(current);
        });
    });
}
exports.getLatestReleases = getLatestReleases;
function startDownload(api, repo, downloadLink) {
    return __awaiter(this, void 0, void 0, function* () {
        const redirectionURL = yield new Promise((resolve, reject) => {
            https.request(getRequestOptions(downloadLink), res => {
                return resolve(res.headers['location']);
            })
                .on('error', err => reject(err))
                .end();
        });
        const dlInfo = {
            game: common_1.GAME_ID,
            name: repo.name,
        };
        api.events.emit('start-download', [redirectionURL], dlInfo, undefined, (error, id) => {
            if (error !== null) {
                if ((error.name === 'AlreadyDownloaded')
                    && (error.downloadId !== undefined)) {
                    id = error.downloadId;
                }
                else {
                    api.showErrorNotification('Download failed', error, { allowReport: false });
                    return Promise.resolve();
                }
            }
            api.events.emit('start-install-download', id, true, (err, modId) => {
                if (err !== null) {
                    api.showErrorNotification('Failed to install repo', err, { allowReport: false });
                }
                const state = api.getState();
                const profileId = vortex_api_1.selectors.lastActiveProfileForGame(state, common_1.GAME_ID);
                const batch = [
                    vortex_api_1.actions.setModEnabled(profileId, modId, true),
                    vortex_api_1.actions.setModAttribute(common_1.GAME_ID, modId, 'RepoDownload', repo.name),
                    vortex_api_1.actions.setModAttribute(common_1.GAME_ID, modId, 'version', repo.latest),
                ];
                vortex_api_1.util.batchDispatch(api.store, batch);
                return Promise.resolve();
            });
        }, 'ask');
    });
}
function resolveDownloadLink(repo, currentReleases) {
    var _a;
    return __awaiter(this, void 0, void 0, function* () {
        const archives = currentReleases[0].assets.filter(asset => asset.name.match(repo.filePattern));
        const downloadLink = (_a = archives[0]) === null || _a === void 0 ? void 0 : _a.browser_download_url;
        return (downloadLink === undefined)
            ? Promise.reject(new vortex_api_1.util.DataInvalid('Failed to resolve browser download url'))
            : Promise.resolve(downloadLink);
    });
}
function getCurrentVersion(api, repo) {
    const state = api.getState();
    const mods = state.persistent.mods[common_1.GAME_ID];
    if (mods === undefined) {
        return '0.0.0';
    }
    const mod = Object.values(mods).find(x => { var _a; return ((_a = x.attributes) === null || _a === void 0 ? void 0 : _a['RepoDownload']) === repo.name; });
    if (mod === undefined) {
        return '0.0.0';
    }
    return mod.attributes['version'];
}
function checkConfigManagerUpd(api, force) {
    return __awaiter(this, void 0, void 0, function* () {
        const repo = REPOS['configManager'];
        return checkForUpdates(api, repo, force);
    });
}
exports.checkConfigManagerUpd = checkConfigManagerUpd;
function checkForUpdates(api, repo, force) {
    return __awaiter(this, void 0, void 0, function* () {
        repo.current = getCurrentVersion(api, repo);
        return getLatestReleases(api, repo)
            .then((currentReleases) => __awaiter(this, void 0, void 0, function* () {
            const mostRecentVersion = repo.coerceVersion(currentReleases[0].tag_name);
            const downloadLink = yield resolveDownloadLink(repo, currentReleases);
            if (semver.valid(mostRecentVersion) === null) {
                return Promise.resolve(repo.current);
            }
            else {
                repo.latest = mostRecentVersion;
                if (semver.gt(mostRecentVersion, repo.current)) {
                    const update = () => force ? Promise.resolve() : notifyUpdate(api, repo);
                    return update()
                        .then(() => startDownload(api, repo, downloadLink))
                        .then(() => Promise.resolve(mostRecentVersion));
                }
                else {
                    return Promise.resolve(repo.current);
                }
            }
        })).catch(err => {
            if (err instanceof vortex_api_1.util.UserCanceled || err instanceof vortex_api_1.util.ProcessCanceled) {
                return Promise.resolve(repo.current);
            }
            const allowReport = !['ECONNRESET', 'EPERM', 'ENOENT', 'EPROTO'].includes(err.code);
            api.showErrorNotification('Unable to update from Github repo', Object.assign(Object.assign({}, err), { repoName: repo.name }), { allowReport });
            return Promise.resolve(repo.current);
        });
    });
}
function downloadConfigManager(api) {
    return __awaiter(this, void 0, void 0, function* () {
        const repo = REPOS['configManager'];
        repo.current = getCurrentVersion(api, repo);
        if (repo.current !== '0.0.0') {
            return;
        }
        return getLatestReleases(api, repo)
            .then((currentReleases) => __awaiter(this, void 0, void 0, function* () {
            const downloadLink = yield resolveDownloadLink(repo, currentReleases);
            return startDownload(api, repo, downloadLink);
        }))
            .catch(err => {
            if (err instanceof vortex_api_1.util.UserCanceled || err instanceof vortex_api_1.util.ProcessCanceled) {
                return Promise.resolve();
            }
            else {
                api.showErrorNotification('Unable to download/install repo', Object.assign(Object.assign({}, err), { details: repo.name }));
                return Promise.resolve();
            }
        });
    });
}
exports.downloadConfigManager = downloadConfigManager;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViRG93bmxvYWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdpdGh1YkRvd25sb2FkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDZDQUErQjtBQUMvQiwwQ0FBNEI7QUFDNUIsK0NBQWlDO0FBQ2pDLHlDQUEyQjtBQUUzQixxQ0FBbUM7QUFLbkMsMkNBQWtFO0FBRWxFLE1BQU0sa0JBQWtCLEdBQUcsbUVBQW1FLENBQUM7QUFDL0YsTUFBTSxPQUFPLEdBQUcsOENBQThDLENBQUM7QUFFL0QsTUFBTSx1QkFBdUIsR0FBRyx5REFBeUQsQ0FBQztBQUMxRixNQUFNLFlBQVksR0FBRyxvQ0FBb0MsQ0FBQztBQUUxRCxNQUFNLEtBQUssR0FBc0M7SUFDL0MsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLFNBQVM7UUFDZixHQUFHLEVBQUUsT0FBTztRQUNaLE9BQU8sRUFBRSxZQUFZO1FBQ3JCLFdBQVcsRUFBRSxnREFBZ0Q7UUFDN0QsYUFBYSxFQUFFLENBQUMsT0FBZSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPO0tBQzVFO0lBQ0QsYUFBYSxFQUFFO1FBQ2IsSUFBSSxFQUFFLHVCQUF1QjtRQUM3QixHQUFHLEVBQUUsa0JBQWtCO1FBQ3ZCLE9BQU8sRUFBRSx1QkFBdUI7UUFDaEMsV0FBVyxFQUFFLG9EQUFvRDtRQUNqRSxhQUFhLEVBQUUsQ0FBQyxPQUFlLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU87S0FDNUU7Q0FDRixDQUFDO0FBRUYsU0FBUyxLQUFLLENBQUMsT0FBZSxFQUFFLE9BQWU7SUFDN0MsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFN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QUFJLENBQUMsT0FBTyxLQUFLLE9BQU8sRUFBRTtZQUM1QixPQUFPO1NBQ1I7UUFDRCxPQUFPLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7YUFDaEMsSUFBSSxDQUFDLENBQU0sZUFBZSxFQUFDLEVBQUU7WUFDNUIsTUFBTSxZQUFZLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDdEUsT0FBTyxhQUFhLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztRQUNoRCxDQUFDLENBQUEsQ0FBQzthQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNYLElBQUksR0FBRyxZQUFZLGlCQUFJLENBQUMsWUFBWSxJQUFJLEdBQUcsWUFBWSxpQkFBSSxDQUFDLGVBQWUsRUFBRTtnQkFDM0UsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7YUFDMUI7aUJBQU07Z0JBQ0wsR0FBRyxDQUFDLHFCQUFxQixDQUFDLGlDQUFpQyxrQ0FDcEQsR0FBRyxLQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsSUFBSSxJQUFHLENBQUM7Z0JBQ2xDLE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO2FBQzFCO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0NBQUE7QUFwQkQsc0RBb0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgaHR0cHMgZnJvbSAnaHR0cHMnO1xyXG5pbXBvcnQgKiBhcyBfIGZyb20gJ2xvZGFzaCc7XHJcbmltcG9ydCAqIGFzIHNlbXZlciBmcm9tICdzZW12ZXInO1xyXG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcclxuXHJcbmltcG9ydCB7IEdBTUVfSUQgfSBmcm9tICcuL2NvbW1vbic7XHJcblxyXG5pbXBvcnQgeyBJR2l0aHViUmVwb30gZnJvbSAnLi90eXBlcyc7XHJcblxyXG5pbXBvcnQgeyBJbmNvbWluZ0h0dHBIZWFkZXJzLCBJbmNvbWluZ01lc3NhZ2UgfSBmcm9tICdodHRwJztcclxuaW1wb3J0IHsgYWN0aW9ucywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5jb25zdCBVUkxfQ09ORklHX01BTkFHRVIgPSAnaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy9CZXBJbkV4L0JlcEluRXguQ29uZmlndXJhdGlvbk1hbmFnZXInO1xyXG5jb25zdCBVUkxfQklYID0gJ2h0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvQmVwSW5FeC9CZXBJbkV4JztcclxuXHJcbmNvbnN0IFVSTF9TSVRFX0NPTkZJR19NQU5BR0VSID0gJ2h0dHBzOi8vZ2l0aHViLmNvbS9CZXBJbkV4L0JlcEluRXguQ29uZmlndXJhdGlvbk1hbmFnZXInO1xyXG5jb25zdCBVUkxfU0lURV9CSVggPSAnaHR0cHM6Ly9naXRodWIuY29tL0JlcEluRXgvQmVwSW5FeCc7XHJcblxyXG5jb25zdCBSRVBPUzogeyBbcmVwb0lkOiBzdHJpbmddOiBJR2l0aHViUmVwbyB9ID0ge1xyXG4gIGJlcEluRXg6IHtcclxuICAgIG5hbWU6ICdCZXBJbkV4JyxcclxuICAgIHVybDogVVJMX0JJWCxcclxuICAgIHdlYnNpdGU6IFVSTF9TSVRFX0JJWCxcclxuICAgIGZpbGVQYXR0ZXJuOiAvKEJlcEluRXhfeDY0X1swLTldKy5bMC05XSsuWzAtOV0rLlswLTldKy56aXApL2ksXHJcbiAgICBjb2VyY2VWZXJzaW9uOiAodmVyc2lvbjogc3RyaW5nKSA9PiBzZW12ZXIuY29lcmNlKHZlcnNpb24uc2xpY2UoMSkpLnZlcnNpb24sXHJcbiAgfSxcclxuICBjb25maWdNYW5hZ2VyOiB7XHJcbiAgICBuYW1lOiAnQ29uZmlndXJhdGlvbiBNYW5hZ2VyJyxcclxuICAgIHVybDogVVJMX0NPTkZJR19NQU5BR0VSLFxyXG4gICAgd2Vic2l0ZTogVVJMX1NJVEVfQ09ORklHX01BTkFHRVIsXHJcbiAgICBmaWxlUGF0dGVybjogLyhCZXBJbkV4LkNvbmZpZ3VyYXRpb25NYW5hZ2VyX3ZbMC05XSsuWzAtOV0rLnppcCkvaSxcclxuICAgIGNvZXJjZVZlcnNpb246ICh2ZXJzaW9uOiBzdHJpbmcpID0+IHNlbXZlci5jb2VyY2UodmVyc2lvbi5zbGljZSgxKSkudmVyc2lvbixcclxuICB9LFxyXG59O1xyXG5cclxuZnVuY3Rpb24gcXVlcnkoYmFzZVVybDogc3RyaW5nLCByZXF1ZXN0OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBjb25zdCBnZXRSZXF1ZXN0ID0gZ2V0UmVxdWVzdE9wdGlvbnMoYCR7YmFzZVVybH0vJHtyZXF1ZXN0fWApO1xyXG4gICAgaHR0cHMuZ2V0KGdldFJlcXVlc3QsIChyZXM6IEluY29taW5nTWVzc2FnZSkgPT4ge1xyXG4gICAgICByZXMuc2V0RW5jb2RpbmcoJ3V0Zi04Jyk7XHJcbiAgICAgIGNvbnN0IG1zZ0hlYWRlcnM6IEluY29taW5nSHR0cEhlYWRlcnMgPSByZXMuaGVhZGVycztcclxuICAgICAgY29uc3QgY2FsbHNSZW1haW5pbmcgPSBwYXJzZUludCh1dGlsLmdldFNhZmUobXNnSGVhZGVycywgWyd4LXJhdGVsaW1pdC1yZW1haW5pbmcnXSwgJzAnKSwgMTApO1xyXG4gICAgICBpZiAoKHJlcy5zdGF0dXNDb2RlID09PSA0MDMpICYmIChjYWxsc1JlbWFpbmluZyA9PT0gMCkpIHtcclxuICAgICAgICBjb25zdCByZXNldERhdGUgPSBwYXJzZUludCh1dGlsLmdldFNhZmUobXNnSGVhZGVycywgWyd4LXJhdGVsaW1pdC1yZXNldCddLCAnMCcpLCAxMCk7XHJcbiAgICAgICAgbG9nKCdpbmZvJywgJ0dpdEh1YiByYXRlIGxpbWl0IGV4Y2VlZGVkJyxcclxuICAgICAgICAgIHsgcmVzZXRfYXQ6IChuZXcgRGF0ZShyZXNldERhdGUpKS50b1N0cmluZygpIH0pO1xyXG4gICAgICAgIHJldHVybiByZWplY3QobmV3IHV0aWwuUHJvY2Vzc0NhbmNlbGVkKCdHaXRIdWIgcmF0ZSBsaW1pdCBleGNlZWRlZCcpKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgbGV0IG91dHB1dDogc3RyaW5nID0gJyc7XHJcbiAgICAgIHJlc1xyXG4gICAgICAgIC5vbignZGF0YScsIGRhdGEgPT4gb3V0cHV0ICs9IGRhdGEpXHJcbiAgICAgICAgLm9uKCdlbmQnLCAoKSA9PiB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKG91dHB1dCkpO1xyXG4gICAgICAgICAgfSBjYXRjaCAocGFyc2VFcnIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChwYXJzZUVycik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KVxyXG4gICAgICAub24oJ2Vycm9yJywgZXJyID0+IHtcclxuICAgICAgICByZXR1cm4gcmVqZWN0KGVycik7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5lbmQoKTtcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0UmVxdWVzdE9wdGlvbnMobGluaykge1xyXG4gIGNvbnN0IHJlbFVybCA9IHVybC5wYXJzZShsaW5rKTtcclxuICByZXR1cm4gKHtcclxuICAgIC4uLl8ucGljayhyZWxVcmwsIFsncG9ydCcsICdob3N0bmFtZScsICdwYXRoJ10pLFxyXG4gICAgaGVhZGVyczoge1xyXG4gICAgICAnVXNlci1BZ2VudCc6ICdWb3J0ZXgnLFxyXG4gICAgfSxcclxuICB9KTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gbm90aWZ5VXBkYXRlKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG86IElHaXRodWJSZXBvKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgY29uc3QgZ2FtZUlkID0gc2VsZWN0b3JzLmFjdGl2ZUdhbWVJZChhcGkuc3RvcmUuZ2V0U3RhdGUoKSk7XHJcbiAgY29uc3QgdCA9IGFwaS50cmFuc2xhdGU7XHJcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIGFwaS5zZW5kTm90aWZpY2F0aW9uKHtcclxuICAgICAgdHlwZTogJ2luZm8nLFxyXG4gICAgICBpZDogYHJlcG8tdXBkYXRlYCxcclxuICAgICAgbm9EaXNtaXNzOiB0cnVlLFxyXG4gICAgICBhbGxvd1N1cHByZXNzOiB0cnVlLFxyXG4gICAgICB0aXRsZTogJ1VwZGF0ZSBmb3Ige3tuYW1lfX0nLFxyXG4gICAgICBtZXNzYWdlOiAnTGF0ZXN0OiB7e2xhdGVzdH19LCBJbnN0YWxsZWQ6IHt7Y3VycmVudH19JyxcclxuICAgICAgcmVwbGFjZToge1xyXG4gICAgICAgIG5hbWU6IHJlcG8ubmFtZSxcclxuICAgICAgICBsYXRlc3Q6IHJlcG8ubGF0ZXN0LFxyXG4gICAgICAgIGN1cnJlbnQ6IHJlcG8uY3VycmVudCxcclxuICAgICAgfSxcclxuICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgIHsgdGl0bGUgOiAnTW9yZScsIGFjdGlvbjogKGRpc21pc3M6ICgpID0+IHZvaWQpID0+IHtcclxuICAgICAgICAgICAgYXBpLnNob3dEaWFsb2coJ2luZm8nLCAne3tuYW1lfX0gVXBkYXRlJywge1xyXG4gICAgICAgICAgICAgIHRleHQ6ICdWb3J0ZXggaGFzIGRldGVjdGVkIGEgbmV3ZXIgdmVyc2lvbiBvZiB7e25hbWV9fSAoe3tsYXRlc3R9fSkgYXZhaWxhYmxlIHRvIGRvd25sb2FkIGZyb20ge3t3ZWJzaXRlfX0uIFlvdSBjdXJyZW50bHkgaGF2ZSB2ZXJzaW9uIHt7Y3VycmVudH19IGluc3RhbGxlZC4nXHJcbiAgICAgICAgICAgICAgKyAnXFxuVm9ydGV4IGNhbiBkb3dubG9hZCBhbmQgYXR0ZW1wdCB0byBpbnN0YWxsIHRoZSBuZXcgdXBkYXRlIGZvciB5b3UuJyxcclxuICAgICAgICAgICAgICBwYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiByZXBvLm5hbWUsXHJcbiAgICAgICAgICAgICAgICB3ZWJzaXRlOiByZXBvLndlYnNpdGUsXHJcbiAgICAgICAgICAgICAgICBsYXRlc3Q6IHJlcG8ubGF0ZXN0LFxyXG4gICAgICAgICAgICAgICAgY3VycmVudDogcmVwby5jdXJyZW50LFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0sIFtcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgbGFiZWw6ICdEb3dubG9hZCcsXHJcbiAgICAgICAgICAgICAgICAgIGFjdGlvbjogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICBkaXNtaXNzKCk7XHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIF0pO1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIHRpdGxlOiAnRGlzbWlzcycsXHJcbiAgICAgICAgICBhY3Rpb246IChkaXNtaXNzKSA9PiB7XHJcbiAgICAgICAgICAgIHJlamVjdChuZXcgdXRpbC5Vc2VyQ2FuY2VsZWQoKSk7XHJcbiAgICAgICAgICAgIGRpc21pc3MoKTtcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgfSxcclxuICAgICAgXSxcclxuICAgIH0pO1xyXG4gIH0pO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZ2V0TGF0ZXN0UmVsZWFzZXMoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCByZXBvOiBJR2l0aHViUmVwbykge1xyXG4gIGlmIChyZXBvLmN1cnJlbnQgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgcmVwby5jdXJyZW50ID0gZ2V0Q3VycmVudFZlcnNpb24oYXBpLCByZXBvKTtcclxuICB9XHJcbiAgcmV0dXJuIHF1ZXJ5KHJlcG8udXJsLCAncmVsZWFzZXMnKVxyXG4gIC50aGVuKChyZWxlYXNlcykgPT4ge1xyXG4gICAgaWYgKCFBcnJheS5pc0FycmF5KHJlbGVhc2VzKSkge1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZWplY3QobmV3IHV0aWwuRGF0YUludmFsaWQoJ2V4cGVjdGVkIGFycmF5IG9mIGdpdGh1YiByZWxlYXNlcycpKTtcclxuICAgIH1cclxuICAgIGNvbnN0IGN1cnJlbnQgPSByZWxlYXNlc1xyXG4gICAgICAuZmlsdGVyKHJlbCA9PiB7XHJcbiAgICAgICAgY29uc3QgdGFnTmFtZSA9IHJlcG8uY29lcmNlVmVyc2lvbih1dGlsLmdldFNhZmUocmVsLCBbJ3RhZ19uYW1lJ10sIHVuZGVmaW5lZCkpO1xyXG4gICAgICAgIGNvbnN0IGlzUHJlUmVsZWFzZSA9IHV0aWwuZ2V0U2FmZShyZWwsIFsncHJlcmVsZWFzZSddLCBmYWxzZSk7XHJcbiAgICAgICAgY29uc3QgdmVyc2lvbiA9IHNlbXZlci52YWxpZCh0YWdOYW1lKTtcclxuXHJcbiAgICAgICAgcmV0dXJuICghaXNQcmVSZWxlYXNlXHJcbiAgICAgICAgICAmJiAodmVyc2lvbiAhPT0gbnVsbClcclxuICAgICAgICAgICYmICgocmVwby5jdXJyZW50ID09PSB1bmRlZmluZWQpIHx8IChzZW12ZXIuZ3RlKHZlcnNpb24sIHJlcG8uY3VycmVudCkpKSk7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5zb3J0KChsaHMsIHJocykgPT4gc2VtdmVyLmNvbXBhcmUoXHJcbiAgICAgICAgcmVwby5jb2VyY2VWZXJzaW9uKHJocy50YWdfbmFtZSksXHJcbiAgICAgICAgcmVwby5jb2VyY2VWZXJzaW9uKGxocy50YWdfbmFtZSkpKTtcclxuXHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGN1cnJlbnQpO1xyXG4gIH0pO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBzdGFydERvd25sb2FkKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvOiBJR2l0aHViUmVwbyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkb3dubG9hZExpbms6IHN0cmluZykge1xyXG4gIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbm8tc2hhZG93ZWQtdmFyaWFibGUgLSB3aHkgaXMgdGhpcyBldmVuIHJlcXVpcmVkID9cclxuICBjb25zdCByZWRpcmVjdGlvblVSTCA9IGF3YWl0IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIGh0dHBzLnJlcXVlc3QoZ2V0UmVxdWVzdE9wdGlvbnMoZG93bmxvYWRMaW5rKSwgcmVzID0+IHtcclxuICAgICAgcmV0dXJuIHJlc29sdmUocmVzLmhlYWRlcnNbJ2xvY2F0aW9uJ10pO1xyXG4gICAgfSlcclxuICAgICAgLm9uKCdlcnJvcicsIGVyciA9PiByZWplY3QoZXJyKSlcclxuICAgICAgLmVuZCgpO1xyXG4gIH0pO1xyXG4gIGNvbnN0IGRsSW5mbyA9IHtcclxuICAgIGdhbWU6IEdBTUVfSUQsXHJcbiAgICBuYW1lOiByZXBvLm5hbWUsXHJcbiAgfTtcclxuICBhcGkuZXZlbnRzLmVtaXQoJ3N0YXJ0LWRvd25sb2FkJywgW3JlZGlyZWN0aW9uVVJMXSwgZGxJbmZvLCB1bmRlZmluZWQsXHJcbiAgICAoZXJyb3IsIGlkKSA9PiB7XHJcbiAgICAgIGlmIChlcnJvciAhPT0gbnVsbCkge1xyXG4gICAgICAgIGlmICgoZXJyb3IubmFtZSA9PT0gJ0FscmVhZHlEb3dubG9hZGVkJylcclxuICAgICAgICAgICAgJiYgKGVycm9yLmRvd25sb2FkSWQgIT09IHVuZGVmaW5lZCkpIHtcclxuICAgICAgICAgIGlkID0gZXJyb3IuZG93bmxvYWRJZDtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignRG93bmxvYWQgZmFpbGVkJyxcclxuICAgICAgICAgICAgZXJyb3IsIHsgYWxsb3dSZXBvcnQ6IGZhbHNlIH0pO1xyXG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICBhcGkuZXZlbnRzLmVtaXQoJ3N0YXJ0LWluc3RhbGwtZG93bmxvYWQnLCBpZCwgdHJ1ZSwgKGVyciwgbW9kSWQpID0+IHtcclxuICAgICAgICBpZiAoZXJyICE9PSBudWxsKSB7XHJcbiAgICAgICAgICBhcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdGYWlsZWQgdG8gaW5zdGFsbCByZXBvJyxcclxuICAgICAgICAgICAgZXJyLCB7IGFsbG93UmVwb3J0OiBmYWxzZSB9KTtcclxuICAgICAgICB9XHJcblxyXG4gICAgICAgIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgICAgICAgY29uc3QgcHJvZmlsZUlkID0gc2VsZWN0b3JzLmxhc3RBY3RpdmVQcm9maWxlRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgICAgICAgY29uc3QgYmF0Y2ggPSBbXHJcbiAgICAgICAgICBhY3Rpb25zLnNldE1vZEVuYWJsZWQocHJvZmlsZUlkLCBtb2RJZCwgdHJ1ZSksXHJcbiAgICAgICAgICBhY3Rpb25zLnNldE1vZEF0dHJpYnV0ZShHQU1FX0lELCBtb2RJZCwgJ1JlcG9Eb3dubG9hZCcsIHJlcG8ubmFtZSksXHJcbiAgICAgICAgICBhY3Rpb25zLnNldE1vZEF0dHJpYnV0ZShHQU1FX0lELCBtb2RJZCwgJ3ZlcnNpb24nLCByZXBvLmxhdGVzdCksXHJcbiAgICAgICAgXTtcclxuXHJcbiAgICAgICAgdXRpbC5iYXRjaERpc3BhdGNoKGFwaS5zdG9yZSwgYmF0Y2gpO1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9LCAnYXNrJyk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVEb3dubG9hZExpbmsocmVwbzogSUdpdGh1YlJlcG8sIGN1cnJlbnRSZWxlYXNlczogYW55W10pIHtcclxuICBjb25zdCBhcmNoaXZlcyA9IGN1cnJlbnRSZWxlYXNlc1swXS5hc3NldHMuZmlsdGVyKGFzc2V0ID0+XHJcbiAgICBhc3NldC5uYW1lLm1hdGNoKHJlcG8uZmlsZVBhdHRlcm4pKTtcclxuXHJcbiAgY29uc3QgZG93bmxvYWRMaW5rID0gYXJjaGl2ZXNbMF0/LmJyb3dzZXJfZG93bmxvYWRfdXJsO1xyXG4gIHJldHVybiAoZG93bmxvYWRMaW5rID09PSB1bmRlZmluZWQpXHJcbiAgICA/IFByb21pc2UucmVqZWN0KG5ldyB1dGlsLkRhdGFJbnZhbGlkKCdGYWlsZWQgdG8gcmVzb2x2ZSBicm93c2VyIGRvd25sb2FkIHVybCcpKVxyXG4gICAgOiBQcm9taXNlLnJlc29sdmUoZG93bmxvYWRMaW5rKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0Q3VycmVudFZlcnNpb24oYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCByZXBvOiBJR2l0aHViUmVwbykge1xyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgbW9kcyA9IHN0YXRlLnBlcnNpc3RlbnQubW9kc1tHQU1FX0lEXTtcclxuICBpZiAobW9kcyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm4gJzAuMC4wJztcclxuICB9XHJcbiAgY29uc3QgbW9kID0gT2JqZWN0LnZhbHVlcyhtb2RzKS5maW5kKHggPT4geC5hdHRyaWJ1dGVzPy5bJ1JlcG9Eb3dubG9hZCddID09PSByZXBvLm5hbWUpO1xyXG4gIGlmIChtb2QgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgcmV0dXJuICcwLjAuMCc7XHJcbiAgfVxyXG4gIHJldHVybiBtb2QuYXR0cmlidXRlc1sndmVyc2lvbiddO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gY2hlY2tDb25maWdNYW5hZ2VyVXBkKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgZm9yY2U/OiBib29sZWFuKSB7XHJcbiAgY29uc3QgcmVwbyA9IFJFUE9TWydjb25maWdNYW5hZ2VyJ107XHJcbiAgcmV0dXJuIGNoZWNrRm9yVXBkYXRlcyhhcGksIHJlcG8sIGZvcmNlKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gY2hlY2tGb3JVcGRhdGVzKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG86IElHaXRodWJSZXBvLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZm9yY2U/OiBib29sZWFuKTogUHJvbWlzZTxzdHJpbmc+IHtcclxuICByZXBvLmN1cnJlbnQgPSBnZXRDdXJyZW50VmVyc2lvbihhcGksIHJlcG8pO1xyXG4gIHJldHVybiBnZXRMYXRlc3RSZWxlYXNlcyhhcGksIHJlcG8pXHJcbiAgICAudGhlbihhc3luYyBjdXJyZW50UmVsZWFzZXMgPT4ge1xyXG4gICAgICBjb25zdCBtb3N0UmVjZW50VmVyc2lvbiA9IHJlcG8uY29lcmNlVmVyc2lvbihjdXJyZW50UmVsZWFzZXNbMF0udGFnX25hbWUpO1xyXG4gICAgICBjb25zdCBkb3dubG9hZExpbmsgPSBhd2FpdCByZXNvbHZlRG93bmxvYWRMaW5rKHJlcG8sIGN1cnJlbnRSZWxlYXNlcyk7XHJcbiAgICAgIGlmIChzZW12ZXIudmFsaWQobW9zdFJlY2VudFZlcnNpb24pID09PSBudWxsKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXBvLmN1cnJlbnQpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIHJlcG8ubGF0ZXN0ID0gbW9zdFJlY2VudFZlcnNpb247XHJcbiAgICAgICAgaWYgKHNlbXZlci5ndChtb3N0UmVjZW50VmVyc2lvbiwgcmVwby5jdXJyZW50KSkge1xyXG4gICAgICAgICAgY29uc3QgdXBkYXRlID0gKCkgPT4gZm9yY2UgPyBQcm9taXNlLnJlc29sdmUoKSA6IG5vdGlmeVVwZGF0ZShhcGksIHJlcG8pO1xyXG4gICAgICAgICAgcmV0dXJuIHVwZGF0ZSgpXHJcbiAgICAgICAgICAgIC50aGVuKCgpID0+IHN0YXJ0RG93bmxvYWQoYXBpLCByZXBvLCBkb3dubG9hZExpbmspKVxyXG4gICAgICAgICAgICAudGhlbigoKSA9PiBQcm9taXNlLnJlc29sdmUobW9zdFJlY2VudFZlcnNpb24pKTtcclxuICAgICAgICB9IGVsc2Uge1xyXG4gICAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXBvLmN1cnJlbnQpO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgfSkuY2F0Y2goZXJyID0+IHtcclxuICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIHV0aWwuVXNlckNhbmNlbGVkIHx8IGVyciBpbnN0YW5jZW9mIHV0aWwuUHJvY2Vzc0NhbmNlbGVkKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXBvLmN1cnJlbnQpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBjb25zdCBhbGxvd1JlcG9ydCA9ICFbJ0VDT05OUkVTRVQnLCAnRVBFUk0nLCAnRU5PRU5UJywgJ0VQUk9UTyddLmluY2x1ZGVzKGVyci5jb2RlKTtcclxuICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignVW5hYmxlIHRvIHVwZGF0ZSBmcm9tIEdpdGh1YiByZXBvJyxcclxuICAgICAgICB7IC4uLmVyciwgcmVwb05hbWU6IHJlcG8ubmFtZSB9LCB7IGFsbG93UmVwb3J0IH0pO1xyXG5cclxuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXBvLmN1cnJlbnQpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkb3dubG9hZENvbmZpZ01hbmFnZXIoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgY29uc3QgcmVwbyA9IFJFUE9TWydjb25maWdNYW5hZ2VyJ107XHJcbiAgcmVwby5jdXJyZW50ID0gZ2V0Q3VycmVudFZlcnNpb24oYXBpLCByZXBvKTtcclxuICBpZiAocmVwby5jdXJyZW50ICE9PSAnMC4wLjAnKSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIHJldHVybiBnZXRMYXRlc3RSZWxlYXNlcyhhcGksIHJlcG8pXHJcbiAgICAudGhlbihhc3luYyBjdXJyZW50UmVsZWFzZXMgPT4ge1xyXG4gICAgICBjb25zdCBkb3dubG9hZExpbmsgPSBhd2FpdCByZXNvbHZlRG93bmxvYWRMaW5rKHJlcG8sIGN1cnJlbnRSZWxlYXNlcyk7XHJcbiAgICAgIHJldHVybiBzdGFydERvd25sb2FkKGFwaSwgcmVwbywgZG93bmxvYWRMaW5rKTtcclxuICAgIH0pXHJcbiAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIHV0aWwuVXNlckNhbmNlbGVkIHx8IGVyciBpbnN0YW5jZW9mIHV0aWwuUHJvY2Vzc0NhbmNlbGVkKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ1VuYWJsZSB0byBkb3dubG9hZC9pbnN0YWxsIHJlcG8nLFxyXG4gICAgICAgICAgeyAuLi5lcnIsIGRldGFpbHM6IHJlcG8ubmFtZSB9KTtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcbiJdfQ==