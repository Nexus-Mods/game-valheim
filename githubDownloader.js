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
                id: `divine-update`,
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
                            resolve();
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
                for (const act of batch) {
                    api.store.dispatch(act);
                }
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViRG93bmxvYWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdpdGh1YkRvd25sb2FkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDZDQUErQjtBQUMvQiwwQ0FBNEI7QUFDNUIsK0NBQWlDO0FBQ2pDLHlDQUEyQjtBQUUzQixxQ0FBbUM7QUFLbkMsMkNBQWtFO0FBRWxFLE1BQU0sa0JBQWtCLEdBQUcsbUVBQW1FLENBQUM7QUFDL0YsTUFBTSxPQUFPLEdBQUcsOENBQThDLENBQUM7QUFFL0QsTUFBTSx1QkFBdUIsR0FBRyx5REFBeUQsQ0FBQztBQUMxRixNQUFNLFlBQVksR0FBRyxvQ0FBb0MsQ0FBQztBQUUxRCxNQUFNLEtBQUssR0FBc0M7SUFDL0MsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLFNBQVM7UUFDZixHQUFHLEVBQUUsT0FBTztRQUNaLE9BQU8sRUFBRSxZQUFZO1FBQ3JCLFdBQVcsRUFBRSxnREFBZ0Q7UUFDN0QsYUFBYSxFQUFFLENBQUMsT0FBZSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPO0tBQzVFO0lBQ0QsYUFBYSxFQUFFO1FBQ2IsSUFBSSxFQUFFLHVCQUF1QjtRQUM3QixHQUFHLEVBQUUsa0JBQWtCO1FBQ3ZCLE9BQU8sRUFBRSx1QkFBdUI7UUFDaEMsV0FBVyxFQUFFLG9EQUFvRDtRQUNqRSxhQUFhLEVBQUUsQ0FBQyxPQUFlLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU87S0FDNUU7Q0FDRixDQUFDO0FBRUYsU0FBUyxLQUFLLENBQUMsT0FBZSxFQUFFLE9BQWU7SUFDN0MsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFN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QUFJLENBQUMsT0FBTyxLQUFLLE9BQU8sRUFBRTtZQUM1QixPQUFPO1NBQ1I7UUFDRCxPQUFPLGlCQUFpQixDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUM7YUFDaEMsSUFBSSxDQUFDLENBQU0sZUFBZSxFQUFDLEVBQUU7WUFDNUIsTUFBTSxZQUFZLEdBQUcsTUFBTSxtQkFBbUIsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLENBQUM7WUFDdEUsT0FBTyxhQUFhLENBQUMsR0FBRyxFQUFFLElBQUksRUFBRSxZQUFZLENBQUMsQ0FBQztRQUNoRCxDQUFDLENBQUEsQ0FBQzthQUNELEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRTtZQUNYLElBQUksR0FBRyxZQUFZLGlCQUFJLENBQUMsWUFBWSxJQUFJLEdBQUcsWUFBWSxpQkFBSSxDQUFDLGVBQWUsRUFBRTtnQkFDM0UsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7YUFDMUI7aUJBQU07Z0JBQ0wsR0FBRyxDQUFDLHFCQUFxQixDQUFDLGlDQUFpQyxrQ0FDcEQsR0FBRyxLQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsSUFBSSxJQUFHLENBQUM7Z0JBQ2xDLE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO2FBQzFCO1FBQ0gsQ0FBQyxDQUFDLENBQUM7SUFDUCxDQUFDO0NBQUE7QUFwQkQsc0RBb0JDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0ICogYXMgaHR0cHMgZnJvbSAnaHR0cHMnO1xyXG5pbXBvcnQgKiBhcyBfIGZyb20gJ2xvZGFzaCc7XHJcbmltcG9ydCAqIGFzIHNlbXZlciBmcm9tICdzZW12ZXInO1xyXG5pbXBvcnQgKiBhcyB1cmwgZnJvbSAndXJsJztcclxuXHJcbmltcG9ydCB7IEdBTUVfSUQgfSBmcm9tICcuL2NvbW1vbic7XHJcblxyXG5pbXBvcnQgeyBJR2l0aHViUmVwb30gZnJvbSAnLi90eXBlcyc7XHJcblxyXG5pbXBvcnQgeyBJbmNvbWluZ0h0dHBIZWFkZXJzLCBJbmNvbWluZ01lc3NhZ2UgfSBmcm9tICdodHRwJztcclxuaW1wb3J0IHsgYWN0aW9ucywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5jb25zdCBVUkxfQ09ORklHX01BTkFHRVIgPSAnaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy9CZXBJbkV4L0JlcEluRXguQ29uZmlndXJhdGlvbk1hbmFnZXInO1xyXG5jb25zdCBVUkxfQklYID0gJ2h0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvQmVwSW5FeC9CZXBJbkV4JztcclxuXHJcbmNvbnN0IFVSTF9TSVRFX0NPTkZJR19NQU5BR0VSID0gJ2h0dHBzOi8vZ2l0aHViLmNvbS9CZXBJbkV4L0JlcEluRXguQ29uZmlndXJhdGlvbk1hbmFnZXInO1xyXG5jb25zdCBVUkxfU0lURV9CSVggPSAnaHR0cHM6Ly9naXRodWIuY29tL0JlcEluRXgvQmVwSW5FeCc7XHJcblxyXG5jb25zdCBSRVBPUzogeyBbcmVwb0lkOiBzdHJpbmddOiBJR2l0aHViUmVwbyB9ID0ge1xyXG4gIGJlcEluRXg6IHtcclxuICAgIG5hbWU6ICdCZXBJbkV4JyxcclxuICAgIHVybDogVVJMX0JJWCxcclxuICAgIHdlYnNpdGU6IFVSTF9TSVRFX0JJWCxcclxuICAgIGZpbGVQYXR0ZXJuOiAvKEJlcEluRXhfeDY0X1swLTldKy5bMC05XSsuWzAtOV0rLlswLTldKy56aXApL2ksXHJcbiAgICBjb2VyY2VWZXJzaW9uOiAodmVyc2lvbjogc3RyaW5nKSA9PiBzZW12ZXIuY29lcmNlKHZlcnNpb24uc2xpY2UoMSkpLnZlcnNpb24sXHJcbiAgfSxcclxuICBjb25maWdNYW5hZ2VyOiB7XHJcbiAgICBuYW1lOiAnQ29uZmlndXJhdGlvbiBNYW5hZ2VyJyxcclxuICAgIHVybDogVVJMX0NPTkZJR19NQU5BR0VSLFxyXG4gICAgd2Vic2l0ZTogVVJMX1NJVEVfQ09ORklHX01BTkFHRVIsXHJcbiAgICBmaWxlUGF0dGVybjogLyhCZXBJbkV4LkNvbmZpZ3VyYXRpb25NYW5hZ2VyX3ZbMC05XSsuWzAtOV0rLnppcCkvaSxcclxuICAgIGNvZXJjZVZlcnNpb246ICh2ZXJzaW9uOiBzdHJpbmcpID0+IHNlbXZlci5jb2VyY2UodmVyc2lvbi5zbGljZSgxKSkudmVyc2lvbixcclxuICB9LFxyXG59O1xyXG5cclxuZnVuY3Rpb24gcXVlcnkoYmFzZVVybDogc3RyaW5nLCByZXF1ZXN0OiBzdHJpbmcpOiBQcm9taXNlPGFueT4ge1xyXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBjb25zdCBnZXRSZXF1ZXN0ID0gZ2V0UmVxdWVzdE9wdGlvbnMoYCR7YmFzZVVybH0vJHtyZXF1ZXN0fWApO1xyXG4gICAgaHR0cHMuZ2V0KGdldFJlcXVlc3QsIChyZXM6IEluY29taW5nTWVzc2FnZSkgPT4ge1xyXG4gICAgICByZXMuc2V0RW5jb2RpbmcoJ3V0Zi04Jyk7XHJcbiAgICAgIGNvbnN0IG1zZ0hlYWRlcnM6IEluY29taW5nSHR0cEhlYWRlcnMgPSByZXMuaGVhZGVycztcclxuICAgICAgY29uc3QgY2FsbHNSZW1haW5pbmcgPSBwYXJzZUludCh1dGlsLmdldFNhZmUobXNnSGVhZGVycywgWyd4LXJhdGVsaW1pdC1yZW1haW5pbmcnXSwgJzAnKSwgMTApO1xyXG4gICAgICBpZiAoKHJlcy5zdGF0dXNDb2RlID09PSA0MDMpICYmIChjYWxsc1JlbWFpbmluZyA9PT0gMCkpIHtcclxuICAgICAgICBjb25zdCByZXNldERhdGUgPSBwYXJzZUludCh1dGlsLmdldFNhZmUobXNnSGVhZGVycywgWyd4LXJhdGVsaW1pdC1yZXNldCddLCAnMCcpLCAxMCk7XHJcbiAgICAgICAgbG9nKCdpbmZvJywgJ0dpdEh1YiByYXRlIGxpbWl0IGV4Y2VlZGVkJyxcclxuICAgICAgICAgIHsgcmVzZXRfYXQ6IChuZXcgRGF0ZShyZXNldERhdGUpKS50b1N0cmluZygpIH0pO1xyXG4gICAgICAgIHJldHVybiByZWplY3QobmV3IHV0aWwuUHJvY2Vzc0NhbmNlbGVkKCdHaXRIdWIgcmF0ZSBsaW1pdCBleGNlZWRlZCcpKTtcclxuICAgICAgfVxyXG5cclxuICAgICAgbGV0IG91dHB1dDogc3RyaW5nID0gJyc7XHJcbiAgICAgIHJlc1xyXG4gICAgICAgIC5vbignZGF0YScsIGRhdGEgPT4gb3V0cHV0ICs9IGRhdGEpXHJcbiAgICAgICAgLm9uKCdlbmQnLCAoKSA9PiB7XHJcbiAgICAgICAgICB0cnkge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVzb2x2ZShKU09OLnBhcnNlKG91dHB1dCkpO1xyXG4gICAgICAgICAgfSBjYXRjaCAocGFyc2VFcnIpIHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlamVjdChwYXJzZUVycik7XHJcbiAgICAgICAgICB9XHJcbiAgICAgICAgfSk7XHJcbiAgICB9KVxyXG4gICAgICAub24oJ2Vycm9yJywgZXJyID0+IHtcclxuICAgICAgICByZXR1cm4gcmVqZWN0KGVycik7XHJcbiAgICAgIH0pXHJcbiAgICAgIC5lbmQoKTtcclxuICB9KTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0UmVxdWVzdE9wdGlvbnMobGluaykge1xyXG4gIGNvbnN0IHJlbFVybCA9IHVybC5wYXJzZShsaW5rKTtcclxuICByZXR1cm4gKHtcclxuICAgIC4uLl8ucGljayhyZWxVcmwsIFsncG9ydCcsICdob3N0bmFtZScsICdwYXRoJ10pLFxyXG4gICAgaGVhZGVyczoge1xyXG4gICAgICAnVXNlci1BZ2VudCc6ICdWb3J0ZXgnLFxyXG4gICAgfSxcclxuICB9KTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gbm90aWZ5VXBkYXRlKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG86IElHaXRodWJSZXBvKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgY29uc3QgZ2FtZUlkID0gc2VsZWN0b3JzLmFjdGl2ZUdhbWVJZChhcGkuc3RvcmUuZ2V0U3RhdGUoKSk7XHJcbiAgY29uc3QgdCA9IGFwaS50cmFuc2xhdGU7XHJcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIGFwaS5zZW5kTm90aWZpY2F0aW9uKHtcclxuICAgICAgdHlwZTogJ2luZm8nLFxyXG4gICAgICBpZDogYGRpdmluZS11cGRhdGVgLFxyXG4gICAgICBub0Rpc21pc3M6IHRydWUsXHJcbiAgICAgIGFsbG93U3VwcHJlc3M6IHRydWUsXHJcbiAgICAgIHRpdGxlOiAnVXBkYXRlIGZvciB7e25hbWV9fScsXHJcbiAgICAgIG1lc3NhZ2U6ICdMYXRlc3Q6IHt7bGF0ZXN0fX0sIEluc3RhbGxlZDoge3tjdXJyZW50fX0nLFxyXG4gICAgICByZXBsYWNlOiB7XHJcbiAgICAgICAgbmFtZTogcmVwby5uYW1lLFxyXG4gICAgICAgIGxhdGVzdDogcmVwby5sYXRlc3QsXHJcbiAgICAgICAgY3VycmVudDogcmVwby5jdXJyZW50LFxyXG4gICAgICB9LFxyXG4gICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgeyB0aXRsZSA6ICdNb3JlJywgYWN0aW9uOiAoZGlzbWlzczogKCkgPT4gdm9pZCkgPT4ge1xyXG4gICAgICAgICAgICBhcGkuc2hvd0RpYWxvZygnaW5mbycsICd7e25hbWV9fSBVcGRhdGUnLCB7XHJcbiAgICAgICAgICAgICAgdGV4dDogJ1ZvcnRleCBoYXMgZGV0ZWN0ZWQgYSBuZXdlciB2ZXJzaW9uIG9mIHt7bmFtZX19ICh7e2xhdGVzdH19KSBhdmFpbGFibGUgdG8gZG93bmxvYWQgZnJvbSB7e3dlYnNpdGV9fS4gWW91IGN1cnJlbnRseSBoYXZlIHZlcnNpb24ge3tjdXJyZW50fX0gaW5zdGFsbGVkLidcclxuICAgICAgICAgICAgICArICdcXG5Wb3J0ZXggY2FuIGRvd25sb2FkIGFuZCBhdHRlbXB0IHRvIGluc3RhbGwgdGhlIG5ldyB1cGRhdGUgZm9yIHlvdS4nLFxyXG4gICAgICAgICAgICAgIHBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IHJlcG8ubmFtZSxcclxuICAgICAgICAgICAgICAgIHdlYnNpdGU6IHJlcG8ud2Vic2l0ZSxcclxuICAgICAgICAgICAgICAgIGxhdGVzdDogcmVwby5sYXRlc3QsXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50OiByZXBvLmN1cnJlbnQsXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSwgW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBsYWJlbDogJ0Rvd25sb2FkJyxcclxuICAgICAgICAgICAgICAgICAgYWN0aW9uOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGRpc21pc3MoKTtcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgXSk7XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgdGl0bGU6ICdEaXNtaXNzJyxcclxuICAgICAgICAgIGFjdGlvbjogKGRpc21pc3MpID0+IHtcclxuICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICBkaXNtaXNzKCk7XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldExhdGVzdFJlbGVhc2VzKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgcmVwbzogSUdpdGh1YlJlcG8pIHtcclxuICBpZiAocmVwby5jdXJyZW50ID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJlcG8uY3VycmVudCA9IGdldEN1cnJlbnRWZXJzaW9uKGFwaSwgcmVwbyk7XHJcbiAgfVxyXG4gIHJldHVybiBxdWVyeShyZXBvLnVybCwgJ3JlbGVhc2VzJylcclxuICAudGhlbigocmVsZWFzZXMpID0+IHtcclxuICAgIGlmICghQXJyYXkuaXNBcnJheShyZWxlYXNlcykpIHtcclxuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyB1dGlsLkRhdGFJbnZhbGlkKCdleHBlY3RlZCBhcnJheSBvZiBnaXRodWIgcmVsZWFzZXMnKSk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBjdXJyZW50ID0gcmVsZWFzZXNcclxuICAgICAgLmZpbHRlcihyZWwgPT4ge1xyXG4gICAgICAgIGNvbnN0IHRhZ05hbWUgPSByZXBvLmNvZXJjZVZlcnNpb24odXRpbC5nZXRTYWZlKHJlbCwgWyd0YWdfbmFtZSddLCB1bmRlZmluZWQpKTtcclxuICAgICAgICBjb25zdCBpc1ByZVJlbGVhc2UgPSB1dGlsLmdldFNhZmUocmVsLCBbJ3ByZXJlbGVhc2UnXSwgZmFsc2UpO1xyXG4gICAgICAgIGNvbnN0IHZlcnNpb24gPSBzZW12ZXIudmFsaWQodGFnTmFtZSk7XHJcblxyXG4gICAgICAgIHJldHVybiAoIWlzUHJlUmVsZWFzZVxyXG4gICAgICAgICAgJiYgKHZlcnNpb24gIT09IG51bGwpXHJcbiAgICAgICAgICAmJiAoKHJlcG8uY3VycmVudCA9PT0gdW5kZWZpbmVkKSB8fCAoc2VtdmVyLmd0ZSh2ZXJzaW9uLCByZXBvLmN1cnJlbnQpKSkpO1xyXG4gICAgICB9KVxyXG4gICAgICAuc29ydCgobGhzLCByaHMpID0+IHNlbXZlci5jb21wYXJlKFxyXG4gICAgICAgIHJlcG8uY29lcmNlVmVyc2lvbihyaHMudGFnX25hbWUpLFxyXG4gICAgICAgIHJlcG8uY29lcmNlVmVyc2lvbihsaHMudGFnX25hbWUpKSk7XHJcblxyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShjdXJyZW50KTtcclxuICB9KTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc3RhcnREb3dubG9hZChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwbzogSUdpdGh1YlJlcG8sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG93bmxvYWRMaW5rOiBzdHJpbmcpIHtcclxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG5vLXNoYWRvd2VkLXZhcmlhYmxlIC0gd2h5IGlzIHRoaXMgZXZlbiByZXF1aXJlZCA/XHJcbiAgY29uc3QgcmVkaXJlY3Rpb25VUkwgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBodHRwcy5yZXF1ZXN0KGdldFJlcXVlc3RPcHRpb25zKGRvd25sb2FkTGluayksIHJlcyA9PiB7XHJcbiAgICAgIHJldHVybiByZXNvbHZlKHJlcy5oZWFkZXJzWydsb2NhdGlvbiddKTtcclxuICAgIH0pXHJcbiAgICAgIC5vbignZXJyb3InLCBlcnIgPT4gcmVqZWN0KGVycikpXHJcbiAgICAgIC5lbmQoKTtcclxuICB9KTtcclxuICBjb25zdCBkbEluZm8gPSB7XHJcbiAgICBnYW1lOiBHQU1FX0lELFxyXG4gICAgbmFtZTogcmVwby5uYW1lLFxyXG4gIH07XHJcbiAgYXBpLmV2ZW50cy5lbWl0KCdzdGFydC1kb3dubG9hZCcsIFtyZWRpcmVjdGlvblVSTF0sIGRsSW5mbywgdW5kZWZpbmVkLFxyXG4gICAgKGVycm9yLCBpZCkgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IgIT09IG51bGwpIHtcclxuICAgICAgICBpZiAoKGVycm9yLm5hbWUgPT09ICdBbHJlYWR5RG93bmxvYWRlZCcpXHJcbiAgICAgICAgICAgICYmIChlcnJvci5kb3dubG9hZElkICE9PSB1bmRlZmluZWQpKSB7XHJcbiAgICAgICAgICBpZCA9IGVycm9yLmRvd25sb2FkSWQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ0Rvd25sb2FkIGZhaWxlZCcsXHJcbiAgICAgICAgICAgIGVycm9yLCB7IGFsbG93UmVwb3J0OiBmYWxzZSB9KTtcclxuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgYXBpLmV2ZW50cy5lbWl0KCdzdGFydC1pbnN0YWxsLWRvd25sb2FkJywgaWQsIHRydWUsIChlcnIsIG1vZElkKSA9PiB7XHJcbiAgICAgICAgaWYgKGVyciAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignRmFpbGVkIHRvIGluc3RhbGwgcmVwbycsXHJcbiAgICAgICAgICAgIGVyciwgeyBhbGxvd1JlcG9ydDogZmFsc2UgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gICAgICAgIGNvbnN0IHByb2ZpbGVJZCA9IHNlbGVjdG9ycy5sYXN0QWN0aXZlUHJvZmlsZUZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gICAgICAgIGNvbnN0IGJhdGNoID0gW1xyXG4gICAgICAgICAgYWN0aW9ucy5zZXRNb2RFbmFibGVkKHByb2ZpbGVJZCwgbW9kSWQsIHRydWUpLFxyXG4gICAgICAgICAgYWN0aW9ucy5zZXRNb2RBdHRyaWJ1dGUoR0FNRV9JRCwgbW9kSWQsICdSZXBvRG93bmxvYWQnLCByZXBvLm5hbWUpLFxyXG4gICAgICAgICAgYWN0aW9ucy5zZXRNb2RBdHRyaWJ1dGUoR0FNRV9JRCwgbW9kSWQsICd2ZXJzaW9uJywgcmVwby5sYXRlc3QpLFxyXG4gICAgICAgIF07XHJcbiAgICAgICAgZm9yIChjb25zdCBhY3Qgb2YgYmF0Y2gpIHtcclxuICAgICAgICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3QpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyB1dGlsLmJhdGNoRGlzcGF0Y2goYXBpLnN0b3JlLCBiYXRjaCk7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH0sICdhc2snKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZURvd25sb2FkTGluayhyZXBvOiBJR2l0aHViUmVwbywgY3VycmVudFJlbGVhc2VzOiBhbnlbXSkge1xyXG4gIGNvbnN0IGFyY2hpdmVzID0gY3VycmVudFJlbGVhc2VzWzBdLmFzc2V0cy5maWx0ZXIoYXNzZXQgPT5cclxuICAgIGFzc2V0Lm5hbWUubWF0Y2gocmVwby5maWxlUGF0dGVybikpO1xyXG5cclxuICBjb25zdCBkb3dubG9hZExpbmsgPSBhcmNoaXZlc1swXT8uYnJvd3Nlcl9kb3dubG9hZF91cmw7XHJcbiAgcmV0dXJuIChkb3dubG9hZExpbmsgPT09IHVuZGVmaW5lZClcclxuICAgID8gUHJvbWlzZS5yZWplY3QobmV3IHV0aWwuRGF0YUludmFsaWQoJ0ZhaWxlZCB0byByZXNvbHZlIGJyb3dzZXIgZG93bmxvYWQgdXJsJykpXHJcbiAgICA6IFByb21pc2UucmVzb2x2ZShkb3dubG9hZExpbmspO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRDdXJyZW50VmVyc2lvbihhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIHJlcG86IElHaXRodWJSZXBvKSB7XHJcbiAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBtb2RzID0gc3RhdGUucGVyc2lzdGVudC5tb2RzW0dBTUVfSURdO1xyXG4gIGlmIChtb2RzID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiAnMC4wLjAnO1xyXG4gIH1cclxuICBjb25zdCBtb2QgPSBPYmplY3QudmFsdWVzKG1vZHMpLmZpbmQoeCA9PiB4LmF0dHJpYnV0ZXM/LlsnUmVwb0Rvd25sb2FkJ10gPT09IHJlcG8ubmFtZSk7XHJcbiAgaWYgKG1vZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm4gJzAuMC4wJztcclxuICB9XHJcbiAgcmV0dXJuIG1vZC5hdHRyaWJ1dGVzWyd2ZXJzaW9uJ107XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjaGVja0NvbmZpZ01hbmFnZXJVcGQoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCBmb3JjZT86IGJvb2xlYW4pIHtcclxuICBjb25zdCByZXBvID0gUkVQT1NbJ2NvbmZpZ01hbmFnZXInXTtcclxuICByZXR1cm4gY2hlY2tGb3JVcGRhdGVzKGFwaSwgcmVwbywgZm9yY2UpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBjaGVja0ZvclVwZGF0ZXMoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwbzogSUdpdGh1YlJlcG8sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3JjZT86IGJvb2xlYW4pOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gIHJlcG8uY3VycmVudCA9IGdldEN1cnJlbnRWZXJzaW9uKGFwaSwgcmVwbyk7XHJcbiAgcmV0dXJuIGdldExhdGVzdFJlbGVhc2VzKGFwaSwgcmVwbylcclxuICAgIC50aGVuKGFzeW5jIGN1cnJlbnRSZWxlYXNlcyA9PiB7XHJcbiAgICAgIGNvbnN0IG1vc3RSZWNlbnRWZXJzaW9uID0gcmVwby5jb2VyY2VWZXJzaW9uKGN1cnJlbnRSZWxlYXNlc1swXS50YWdfbmFtZSk7XHJcbiAgICAgIGNvbnN0IGRvd25sb2FkTGluayA9IGF3YWl0IHJlc29sdmVEb3dubG9hZExpbmsocmVwbywgY3VycmVudFJlbGVhc2VzKTtcclxuICAgICAgaWYgKHNlbXZlci52YWxpZChtb3N0UmVjZW50VmVyc2lvbikgPT09IG51bGwpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmVwby5sYXRlc3QgPSBtb3N0UmVjZW50VmVyc2lvbjtcclxuICAgICAgICBpZiAoc2VtdmVyLmd0KG1vc3RSZWNlbnRWZXJzaW9uLCByZXBvLmN1cnJlbnQpKSB7XHJcbiAgICAgICAgICBjb25zdCB1cGRhdGUgPSAoKSA9PiBmb3JjZSA/IFByb21pc2UucmVzb2x2ZSgpIDogbm90aWZ5VXBkYXRlKGFwaSwgcmVwbyk7XHJcbiAgICAgICAgICByZXR1cm4gdXBkYXRlKClcclxuICAgICAgICAgICAgLnRoZW4oKCkgPT4gc3RhcnREb3dubG9hZChhcGksIHJlcG8sIGRvd25sb2FkTGluaykpXHJcbiAgICAgICAgICAgIC50aGVuKCgpID0+IFByb21pc2UucmVzb2x2ZShtb3N0UmVjZW50VmVyc2lvbikpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KS5jYXRjaChlcnIgPT4ge1xyXG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWQgfHwgZXJyIGluc3RhbmNlb2YgdXRpbC5Qcm9jZXNzQ2FuY2VsZWQpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGFsbG93UmVwb3J0ID0gIVsnRUNPTk5SRVNFVCcsICdFUEVSTScsICdFTk9FTlQnLCAnRVBST1RPJ10uaW5jbHVkZXMoZXJyLmNvZGUpO1xyXG4gICAgICBhcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdVbmFibGUgdG8gdXBkYXRlIGZyb20gR2l0aHViIHJlcG8nLFxyXG4gICAgICAgIHsgLi4uZXJyLCByZXBvTmFtZTogcmVwby5uYW1lIH0sIHsgYWxsb3dSZXBvcnQgfSk7XHJcblxyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRvd25sb2FkQ29uZmlnTWFuYWdlcihhcGk6IHR5cGVzLklFeHRlbnNpb25BcGkpOiBQcm9taXNlPHZvaWQ+IHtcclxuICBjb25zdCByZXBvID0gUkVQT1NbJ2NvbmZpZ01hbmFnZXInXTtcclxuICByZXBvLmN1cnJlbnQgPSBnZXRDdXJyZW50VmVyc2lvbihhcGksIHJlcG8pO1xyXG4gIGlmIChyZXBvLmN1cnJlbnQgIT09ICcwLjAuMCcpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgcmV0dXJuIGdldExhdGVzdFJlbGVhc2VzKGFwaSwgcmVwbylcclxuICAgIC50aGVuKGFzeW5jIGN1cnJlbnRSZWxlYXNlcyA9PiB7XHJcbiAgICAgIGNvbnN0IGRvd25sb2FkTGluayA9IGF3YWl0IHJlc29sdmVEb3dubG9hZExpbmsocmVwbywgY3VycmVudFJlbGVhc2VzKTtcclxuICAgICAgcmV0dXJuIHN0YXJ0RG93bmxvYWQoYXBpLCByZXBvLCBkb3dubG9hZExpbmspO1xyXG4gICAgfSlcclxuICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWQgfHwgZXJyIGluc3RhbmNlb2YgdXRpbC5Qcm9jZXNzQ2FuY2VsZWQpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignVW5hYmxlIHRvIGRvd25sb2FkL2luc3RhbGwgcmVwbycsXHJcbiAgICAgICAgICB7IC4uLmVyciwgZGV0YWlsczogcmVwby5uYW1lIH0pO1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbn1cclxuIl19