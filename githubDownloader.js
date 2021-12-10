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
    const mod = Object.values(mods).find(x => x.attributes['RepoDownload'] === repo.name);
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
            api.showErrorNotification('Unable to update from Github repo', Object.assign(Object.assign({}, err), { details: repo.name }));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViRG93bmxvYWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdpdGh1YkRvd25sb2FkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDZDQUErQjtBQUMvQiwwQ0FBNEI7QUFDNUIsK0NBQWlDO0FBQ2pDLHlDQUEyQjtBQUUzQixxQ0FBbUM7QUFLbkMsMkNBQWtFO0FBRWxFLE1BQU0sa0JBQWtCLEdBQUcsbUVBQW1FLENBQUM7QUFDL0YsTUFBTSxPQUFPLEdBQUcsOENBQThDLENBQUM7QUFFL0QsTUFBTSx1QkFBdUIsR0FBRyx5REFBeUQsQ0FBQztBQUMxRixNQUFNLFlBQVksR0FBRyxvQ0FBb0MsQ0FBQztBQUUxRCxNQUFNLEtBQUssR0FBc0M7SUFDL0MsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLFNBQVM7UUFDZixHQUFHLEVBQUUsT0FBTztRQUNaLE9BQU8sRUFBRSxZQUFZO1FBQ3JCLFdBQVcsRUFBRSxnREFBZ0Q7UUFDN0QsYUFBYSxFQUFFLENBQUMsT0FBZSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPO0tBQzVFO0lBQ0QsYUFBYSxFQUFFO1FBQ2IsSUFBSSxFQUFFLHVCQUF1QjtRQUM3QixHQUFHLEVBQUUsa0JBQWtCO1FBQ3ZCLE9BQU8sRUFBRSx1QkFBdUI7UUFDaEMsV0FBVyxFQUFFLG9EQUFvRDtRQUNqRSxhQUFhLEVBQUUsQ0FBQyxPQUFlLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU87S0FDNUU7Q0FDRixDQUFDO0FBRUYsU0FBUyxLQUFLLENBQUMsT0FBZSxFQUFFLE9BQWU7SUFDN0MsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFN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LEdBQUcsQ0FBQyxFQUFFO1lBQ1gsSUFBSSxHQUFHLFlBQVksaUJBQUksQ0FBQyxZQUFZLElBQUksR0FBRyxZQUFZLGlCQUFJLENBQUMsZUFBZSxFQUFFO2dCQUMzRSxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQzthQUMxQjtpQkFBTTtnQkFDTCxHQUFHLENBQUMscUJBQXFCLENBQUMsaUNBQWlDLGtDQUNwRCxHQUFHLEtBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxJQUFJLElBQUcsQ0FBQztnQkFDbEMsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7YUFDMUI7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNQLENBQUM7Q0FBQTtBQXBCRCxzREFvQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBodHRwcyBmcm9tICdodHRwcyc7XHJcbmltcG9ydCAqIGFzIF8gZnJvbSAnbG9kYXNoJztcclxuaW1wb3J0ICogYXMgc2VtdmVyIGZyb20gJ3NlbXZlcic7XHJcbmltcG9ydCAqIGFzIHVybCBmcm9tICd1cmwnO1xyXG5cclxuaW1wb3J0IHsgR0FNRV9JRCB9IGZyb20gJy4vY29tbW9uJztcclxuXHJcbmltcG9ydCB7IElHaXRodWJSZXBvfSBmcm9tICcuL3R5cGVzJztcclxuXHJcbmltcG9ydCB7IEluY29taW5nSHR0cEhlYWRlcnMsIEluY29taW5nTWVzc2FnZSB9IGZyb20gJ2h0dHAnO1xyXG5pbXBvcnQgeyBhY3Rpb25zLCBsb2csIHNlbGVjdG9ycywgdHlwZXMsIHV0aWwgfSBmcm9tICd2b3J0ZXgtYXBpJztcclxuXHJcbmNvbnN0IFVSTF9DT05GSUdfTUFOQUdFUiA9ICdodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zL0JlcEluRXgvQmVwSW5FeC5Db25maWd1cmF0aW9uTWFuYWdlcic7XHJcbmNvbnN0IFVSTF9CSVggPSAnaHR0cHM6Ly9hcGkuZ2l0aHViLmNvbS9yZXBvcy9CZXBJbkV4L0JlcEluRXgnO1xyXG5cclxuY29uc3QgVVJMX1NJVEVfQ09ORklHX01BTkFHRVIgPSAnaHR0cHM6Ly9naXRodWIuY29tL0JlcEluRXgvQmVwSW5FeC5Db25maWd1cmF0aW9uTWFuYWdlcic7XHJcbmNvbnN0IFVSTF9TSVRFX0JJWCA9ICdodHRwczovL2dpdGh1Yi5jb20vQmVwSW5FeC9CZXBJbkV4JztcclxuXHJcbmNvbnN0IFJFUE9TOiB7IFtyZXBvSWQ6IHN0cmluZ106IElHaXRodWJSZXBvIH0gPSB7XHJcbiAgYmVwSW5FeDoge1xyXG4gICAgbmFtZTogJ0JlcEluRXgnLFxyXG4gICAgdXJsOiBVUkxfQklYLFxyXG4gICAgd2Vic2l0ZTogVVJMX1NJVEVfQklYLFxyXG4gICAgZmlsZVBhdHRlcm46IC8oQmVwSW5FeF94NjRfWzAtOV0rLlswLTldKy5bMC05XSsuWzAtOV0rLnppcCkvaSxcclxuICAgIGNvZXJjZVZlcnNpb246ICh2ZXJzaW9uOiBzdHJpbmcpID0+IHNlbXZlci5jb2VyY2UodmVyc2lvbi5zbGljZSgxKSkudmVyc2lvbixcclxuICB9LFxyXG4gIGNvbmZpZ01hbmFnZXI6IHtcclxuICAgIG5hbWU6ICdDb25maWd1cmF0aW9uIE1hbmFnZXInLFxyXG4gICAgdXJsOiBVUkxfQ09ORklHX01BTkFHRVIsXHJcbiAgICB3ZWJzaXRlOiBVUkxfU0lURV9DT05GSUdfTUFOQUdFUixcclxuICAgIGZpbGVQYXR0ZXJuOiAvKEJlcEluRXguQ29uZmlndXJhdGlvbk1hbmFnZXJfdlswLTldKy5bMC05XSsuemlwKS9pLFxyXG4gICAgY29lcmNlVmVyc2lvbjogKHZlcnNpb246IHN0cmluZykgPT4gc2VtdmVyLmNvZXJjZSh2ZXJzaW9uLnNsaWNlKDEpKS52ZXJzaW9uLFxyXG4gIH0sXHJcbn07XHJcblxyXG5mdW5jdGlvbiBxdWVyeShiYXNlVXJsOiBzdHJpbmcsIHJlcXVlc3Q6IHN0cmluZyk6IFByb21pc2U8YW55PiB7XHJcbiAgcmV0dXJuIG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIGNvbnN0IGdldFJlcXVlc3QgPSBnZXRSZXF1ZXN0T3B0aW9ucyhgJHtiYXNlVXJsfS8ke3JlcXVlc3R9YCk7XHJcbiAgICBodHRwcy5nZXQoZ2V0UmVxdWVzdCwgKHJlczogSW5jb21pbmdNZXNzYWdlKSA9PiB7XHJcbiAgICAgIHJlcy5zZXRFbmNvZGluZygndXRmLTgnKTtcclxuICAgICAgY29uc3QgbXNnSGVhZGVyczogSW5jb21pbmdIdHRwSGVhZGVycyA9IHJlcy5oZWFkZXJzO1xyXG4gICAgICBjb25zdCBjYWxsc1JlbWFpbmluZyA9IHBhcnNlSW50KHV0aWwuZ2V0U2FmZShtc2dIZWFkZXJzLCBbJ3gtcmF0ZWxpbWl0LXJlbWFpbmluZyddLCAnMCcpLCAxMCk7XHJcbiAgICAgIGlmICgocmVzLnN0YXR1c0NvZGUgPT09IDQwMykgJiYgKGNhbGxzUmVtYWluaW5nID09PSAwKSkge1xyXG4gICAgICAgIGNvbnN0IHJlc2V0RGF0ZSA9IHBhcnNlSW50KHV0aWwuZ2V0U2FmZShtc2dIZWFkZXJzLCBbJ3gtcmF0ZWxpbWl0LXJlc2V0J10sICcwJyksIDEwKTtcclxuICAgICAgICBsb2coJ2luZm8nLCAnR2l0SHViIHJhdGUgbGltaXQgZXhjZWVkZWQnLFxyXG4gICAgICAgICAgeyByZXNldF9hdDogKG5ldyBEYXRlKHJlc2V0RGF0ZSkpLnRvU3RyaW5nKCkgfSk7XHJcbiAgICAgICAgcmV0dXJuIHJlamVjdChuZXcgdXRpbC5Qcm9jZXNzQ2FuY2VsZWQoJ0dpdEh1YiByYXRlIGxpbWl0IGV4Y2VlZGVkJykpO1xyXG4gICAgICB9XHJcblxyXG4gICAgICBsZXQgb3V0cHV0OiBzdHJpbmcgPSAnJztcclxuICAgICAgcmVzXHJcbiAgICAgICAgLm9uKCdkYXRhJywgZGF0YSA9PiBvdXRwdXQgKz0gZGF0YSlcclxuICAgICAgICAub24oJ2VuZCcsICgpID0+IHtcclxuICAgICAgICAgIHRyeSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZXNvbHZlKEpTT04ucGFyc2Uob3V0cHV0KSk7XHJcbiAgICAgICAgICB9IGNhdGNoIChwYXJzZUVycikge1xyXG4gICAgICAgICAgICByZXR1cm4gcmVqZWN0KHBhcnNlRXJyKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9KTtcclxuICAgIH0pXHJcbiAgICAgIC5vbignZXJyb3InLCBlcnIgPT4ge1xyXG4gICAgICAgIHJldHVybiByZWplY3QoZXJyKTtcclxuICAgICAgfSlcclxuICAgICAgLmVuZCgpO1xyXG4gIH0pO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRSZXF1ZXN0T3B0aW9ucyhsaW5rKSB7XHJcbiAgY29uc3QgcmVsVXJsID0gdXJsLnBhcnNlKGxpbmspO1xyXG4gIHJldHVybiAoe1xyXG4gICAgLi4uXy5waWNrKHJlbFVybCwgWydwb3J0JywgJ2hvc3RuYW1lJywgJ3BhdGgnXSksXHJcbiAgICBoZWFkZXJzOiB7XHJcbiAgICAgICdVc2VyLUFnZW50JzogJ1ZvcnRleCcsXHJcbiAgICB9LFxyXG4gIH0pO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBub3RpZnlVcGRhdGUoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwbzogSUdpdGh1YlJlcG8pOiBQcm9taXNlPHZvaWQ+IHtcclxuICBjb25zdCBnYW1lSWQgPSBzZWxlY3RvcnMuYWN0aXZlR2FtZUlkKGFwaS5zdG9yZS5nZXRTdGF0ZSgpKTtcclxuICBjb25zdCB0ID0gYXBpLnRyYW5zbGF0ZTtcclxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgYXBpLnNlbmROb3RpZmljYXRpb24oe1xyXG4gICAgICB0eXBlOiAnaW5mbycsXHJcbiAgICAgIGlkOiBgZGl2aW5lLXVwZGF0ZWAsXHJcbiAgICAgIG5vRGlzbWlzczogdHJ1ZSxcclxuICAgICAgYWxsb3dTdXBwcmVzczogdHJ1ZSxcclxuICAgICAgdGl0bGU6ICdVcGRhdGUgZm9yIHt7bmFtZX19JyxcclxuICAgICAgbWVzc2FnZTogJ0xhdGVzdDoge3tsYXRlc3R9fSwgSW5zdGFsbGVkOiB7e2N1cnJlbnR9fScsXHJcbiAgICAgIHJlcGxhY2U6IHtcclxuICAgICAgICBsYXRlc3Q6IHJlcG8ubGF0ZXN0LFxyXG4gICAgICAgIGN1cnJlbnQ6IHJlcG8uY3VycmVudCxcclxuICAgICAgfSxcclxuICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgIHsgdGl0bGUgOiAnTW9yZScsIGFjdGlvbjogKGRpc21pc3M6ICgpID0+IHZvaWQpID0+IHtcclxuICAgICAgICAgICAgYXBpLnNob3dEaWFsb2coJ2luZm8nLCAne3tuYW1lfX0gVXBkYXRlJywge1xyXG4gICAgICAgICAgICAgIHRleHQ6ICdWb3J0ZXggaGFzIGRldGVjdGVkIGEgbmV3ZXIgdmVyc2lvbiBvZiB7e25hbWV9fSAoe3tsYXRlc3R9fSkgYXZhaWxhYmxlIHRvIGRvd25sb2FkIGZyb20ge3t3ZWJzaXRlfX0uIFlvdSBjdXJyZW50bHkgaGF2ZSB2ZXJzaW9uIHt7Y3VycmVudH19IGluc3RhbGxlZC4nXHJcbiAgICAgICAgICAgICAgKyAnXFxuVm9ydGV4IGNhbiBkb3dubG9hZCBhbmQgYXR0ZW1wdCB0byBpbnN0YWxsIHRoZSBuZXcgdXBkYXRlIGZvciB5b3UuJyxcclxuICAgICAgICAgICAgICBwYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiByZXBvLm5hbWUsXHJcbiAgICAgICAgICAgICAgICB3ZWJzaXRlOiByZXBvLndlYnNpdGUsXHJcbiAgICAgICAgICAgICAgICBsYXRlc3Q6IHJlcG8ubGF0ZXN0LFxyXG4gICAgICAgICAgICAgICAgY3VycmVudDogcmVwby5jdXJyZW50LFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0sIFtcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgbGFiZWw6ICdEb3dubG9hZCcsXHJcbiAgICAgICAgICAgICAgICAgIGFjdGlvbjogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICBkaXNtaXNzKCk7XHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIF0pO1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIHRpdGxlOiAnRGlzbWlzcycsXHJcbiAgICAgICAgICBhY3Rpb246IChkaXNtaXNzKSA9PiB7XHJcbiAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgZGlzbWlzcygpO1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICBdLFxyXG4gICAgfSk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRMYXRlc3RSZWxlYXNlcyhhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIHJlcG86IElHaXRodWJSZXBvKSB7XHJcbiAgaWYgKHJlcG8uY3VycmVudCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXBvLmN1cnJlbnQgPSBnZXRDdXJyZW50VmVyc2lvbihhcGksIHJlcG8pO1xyXG4gIH1cclxuICByZXR1cm4gcXVlcnkocmVwby51cmwsICdyZWxlYXNlcycpXHJcbiAgLnRoZW4oKHJlbGVhc2VzKSA9PiB7XHJcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkocmVsZWFzZXMpKSB7XHJcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgdXRpbC5EYXRhSW52YWxpZCgnZXhwZWN0ZWQgYXJyYXkgb2YgZ2l0aHViIHJlbGVhc2VzJykpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgY3VycmVudCA9IHJlbGVhc2VzXHJcbiAgICAgIC5maWx0ZXIocmVsID0+IHtcclxuICAgICAgICBjb25zdCB0YWdOYW1lID0gcmVwby5jb2VyY2VWZXJzaW9uKHV0aWwuZ2V0U2FmZShyZWwsIFsndGFnX25hbWUnXSwgdW5kZWZpbmVkKSk7XHJcbiAgICAgICAgY29uc3QgaXNQcmVSZWxlYXNlID0gdXRpbC5nZXRTYWZlKHJlbCwgWydwcmVyZWxlYXNlJ10sIGZhbHNlKTtcclxuICAgICAgICBjb25zdCB2ZXJzaW9uID0gc2VtdmVyLnZhbGlkKHRhZ05hbWUpO1xyXG5cclxuICAgICAgICByZXR1cm4gKCFpc1ByZVJlbGVhc2VcclxuICAgICAgICAgICYmICh2ZXJzaW9uICE9PSBudWxsKVxyXG4gICAgICAgICAgJiYgKChyZXBvLmN1cnJlbnQgPT09IHVuZGVmaW5lZCkgfHwgKHNlbXZlci5ndGUodmVyc2lvbiwgcmVwby5jdXJyZW50KSkpKTtcclxuICAgICAgfSlcclxuICAgICAgLnNvcnQoKGxocywgcmhzKSA9PiBzZW12ZXIuY29tcGFyZShcclxuICAgICAgICByZXBvLmNvZXJjZVZlcnNpb24ocmhzLnRhZ19uYW1lKSxcclxuICAgICAgICByZXBvLmNvZXJjZVZlcnNpb24obGhzLnRhZ19uYW1lKSkpO1xyXG5cclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoY3VycmVudCk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHN0YXJ0RG93bmxvYWQoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG86IElHaXRodWJSZXBvLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvd25sb2FkTGluazogc3RyaW5nKSB7XHJcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBuby1zaGFkb3dlZC12YXJpYWJsZSAtIHdoeSBpcyB0aGlzIGV2ZW4gcmVxdWlyZWQgP1xyXG4gIGNvbnN0IHJlZGlyZWN0aW9uVVJMID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgaHR0cHMucmVxdWVzdChnZXRSZXF1ZXN0T3B0aW9ucyhkb3dubG9hZExpbmspLCByZXMgPT4ge1xyXG4gICAgICByZXR1cm4gcmVzb2x2ZShyZXMuaGVhZGVyc1snbG9jYXRpb24nXSk7XHJcbiAgICB9KVxyXG4gICAgICAub24oJ2Vycm9yJywgZXJyID0+IHJlamVjdChlcnIpKVxyXG4gICAgICAuZW5kKCk7XHJcbiAgfSk7XHJcbiAgY29uc3QgZGxJbmZvID0ge1xyXG4gICAgZ2FtZTogR0FNRV9JRCxcclxuICAgIG5hbWU6IHJlcG8ubmFtZSxcclxuICB9O1xyXG4gIGFwaS5ldmVudHMuZW1pdCgnc3RhcnQtZG93bmxvYWQnLCBbcmVkaXJlY3Rpb25VUkxdLCBkbEluZm8sIHVuZGVmaW5lZCxcclxuICAgIChlcnJvciwgaWQpID0+IHtcclxuICAgICAgaWYgKGVycm9yICE9PSBudWxsKSB7XHJcbiAgICAgICAgaWYgKChlcnJvci5uYW1lID09PSAnQWxyZWFkeURvd25sb2FkZWQnKVxyXG4gICAgICAgICAgICAmJiAoZXJyb3IuZG93bmxvYWRJZCAhPT0gdW5kZWZpbmVkKSkge1xyXG4gICAgICAgICAgaWQgPSBlcnJvci5kb3dubG9hZElkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBhcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdEb3dubG9hZCBmYWlsZWQnLFxyXG4gICAgICAgICAgICBlcnJvciwgeyBhbGxvd1JlcG9ydDogZmFsc2UgfSk7XHJcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGFwaS5ldmVudHMuZW1pdCgnc3RhcnQtaW5zdGFsbC1kb3dubG9hZCcsIGlkLCB0cnVlLCAoZXJyLCBtb2RJZCkgPT4ge1xyXG4gICAgICAgIGlmIChlcnIgIT09IG51bGwpIHtcclxuICAgICAgICAgIGFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ0ZhaWxlZCB0byBpbnN0YWxsIHJlcG8nLFxyXG4gICAgICAgICAgICBlcnIsIHsgYWxsb3dSZXBvcnQ6IGZhbHNlIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICAgICAgICBjb25zdCBwcm9maWxlSWQgPSBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICAgICAgICBjb25zdCBiYXRjaCA9IFtcclxuICAgICAgICAgIGFjdGlvbnMuc2V0TW9kRW5hYmxlZChwcm9maWxlSWQsIG1vZElkLCB0cnVlKSxcclxuICAgICAgICAgIGFjdGlvbnMuc2V0TW9kQXR0cmlidXRlKEdBTUVfSUQsIG1vZElkLCAnUmVwb0Rvd25sb2FkJywgcmVwby5uYW1lKSxcclxuICAgICAgICAgIGFjdGlvbnMuc2V0TW9kQXR0cmlidXRlKEdBTUVfSUQsIG1vZElkLCAndmVyc2lvbicsIHJlcG8ubGF0ZXN0KSxcclxuICAgICAgICBdO1xyXG4gICAgICAgIHV0aWwuYmF0Y2hEaXNwYXRjaChhcGkuc3RvcmUsIGJhdGNoKTtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgIH0pO1xyXG4gICAgfSwgJ2FzaycpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiByZXNvbHZlRG93bmxvYWRMaW5rKHJlcG86IElHaXRodWJSZXBvLCBjdXJyZW50UmVsZWFzZXM6IGFueVtdKSB7XHJcbiAgY29uc3QgYXJjaGl2ZXMgPSBjdXJyZW50UmVsZWFzZXNbMF0uYXNzZXRzLmZpbHRlcihhc3NldCA9PlxyXG4gICAgYXNzZXQubmFtZS5tYXRjaChyZXBvLmZpbGVQYXR0ZXJuKSk7XHJcblxyXG4gIGNvbnN0IGRvd25sb2FkTGluayA9IGFyY2hpdmVzWzBdPy5icm93c2VyX2Rvd25sb2FkX3VybDtcclxuICByZXR1cm4gKGRvd25sb2FkTGluayA9PT0gdW5kZWZpbmVkKVxyXG4gICAgPyBQcm9taXNlLnJlamVjdChuZXcgdXRpbC5EYXRhSW52YWxpZCgnRmFpbGVkIHRvIHJlc29sdmUgYnJvd3NlciBkb3dubG9hZCB1cmwnKSlcclxuICAgIDogUHJvbWlzZS5yZXNvbHZlKGRvd25sb2FkTGluayk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldEN1cnJlbnRWZXJzaW9uKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgcmVwbzogSUdpdGh1YlJlcG8pIHtcclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IG1vZHMgPSBzdGF0ZS5wZXJzaXN0ZW50Lm1vZHNbR0FNRV9JRF07XHJcbiAgLy8gY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5hY3RpdmVQcm9maWxlKHN0YXRlKTtcclxuICAvLyBjb25zdCBpc0VuYWJsZWQgPSAobW9kSWQ6IHN0cmluZykgPT4gdXRpbC5nZXRTYWZlKHByb2ZpbGUsIFsnbW9kU3RhdGUnLCBtb2RJZCwgJ2VuYWJsZWQnXSwgZmFsc2UpO1xyXG4gIGNvbnN0IG1vZCA9IE9iamVjdC52YWx1ZXMobW9kcykuZmluZCh4ID0+IHguYXR0cmlidXRlc1snUmVwb0Rvd25sb2FkJ10gPT09IHJlcG8ubmFtZSk7XHJcbiAgaWYgKG1vZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm4gJzAuMC4wJztcclxuICB9XHJcbiAgcmV0dXJuIG1vZC5hdHRyaWJ1dGVzWyd2ZXJzaW9uJ107XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjaGVja0NvbmZpZ01hbmFnZXJVcGQoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCBmb3JjZT86IGJvb2xlYW4pIHtcclxuICBjb25zdCByZXBvID0gUkVQT1NbJ2NvbmZpZ01hbmFnZXInXTtcclxuICByZXR1cm4gY2hlY2tGb3JVcGRhdGVzKGFwaSwgcmVwbywgZm9yY2UpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBjaGVja0ZvclVwZGF0ZXMoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwbzogSUdpdGh1YlJlcG8sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3JjZT86IGJvb2xlYW4pOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gIHJlcG8uY3VycmVudCA9IGdldEN1cnJlbnRWZXJzaW9uKGFwaSwgcmVwbyk7XHJcbiAgcmV0dXJuIGdldExhdGVzdFJlbGVhc2VzKGFwaSwgcmVwbylcclxuICAgIC50aGVuKGFzeW5jIGN1cnJlbnRSZWxlYXNlcyA9PiB7XHJcbiAgICAgIGNvbnN0IG1vc3RSZWNlbnRWZXJzaW9uID0gcmVwby5jb2VyY2VWZXJzaW9uKGN1cnJlbnRSZWxlYXNlc1swXS50YWdfbmFtZSk7XHJcbiAgICAgIGNvbnN0IGRvd25sb2FkTGluayA9IGF3YWl0IHJlc29sdmVEb3dubG9hZExpbmsocmVwbywgY3VycmVudFJlbGVhc2VzKTtcclxuICAgICAgaWYgKHNlbXZlci52YWxpZChtb3N0UmVjZW50VmVyc2lvbikgPT09IG51bGwpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmVwby5sYXRlc3QgPSBtb3N0UmVjZW50VmVyc2lvbjtcclxuICAgICAgICBpZiAoc2VtdmVyLmd0KG1vc3RSZWNlbnRWZXJzaW9uLCByZXBvLmN1cnJlbnQpKSB7XHJcbiAgICAgICAgICBjb25zdCB1cGRhdGUgPSAoKSA9PiBmb3JjZSA/IFByb21pc2UucmVzb2x2ZSgpIDogbm90aWZ5VXBkYXRlKGFwaSwgcmVwbyk7XHJcbiAgICAgICAgICByZXR1cm4gdXBkYXRlKClcclxuICAgICAgICAgICAgLnRoZW4oKCkgPT4gc3RhcnREb3dubG9hZChhcGksIHJlcG8sIGRvd25sb2FkTGluaykpXHJcbiAgICAgICAgICAgIC50aGVuKCgpID0+IFByb21pc2UucmVzb2x2ZShtb3N0UmVjZW50VmVyc2lvbikpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KS5jYXRjaChlcnIgPT4ge1xyXG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWQgfHwgZXJyIGluc3RhbmNlb2YgdXRpbC5Qcm9jZXNzQ2FuY2VsZWQpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ1VuYWJsZSB0byB1cGRhdGUgZnJvbSBHaXRodWIgcmVwbycsXHJcbiAgICAgICAgeyAuLi5lcnIsIGRldGFpbHM6IHJlcG8ubmFtZSB9KTtcclxuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXBvLmN1cnJlbnQpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBkb3dubG9hZENvbmZpZ01hbmFnZXIoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpKTogUHJvbWlzZTx2b2lkPiB7XHJcbiAgY29uc3QgcmVwbyA9IFJFUE9TWydjb25maWdNYW5hZ2VyJ107XHJcbiAgcmVwby5jdXJyZW50ID0gZ2V0Q3VycmVudFZlcnNpb24oYXBpLCByZXBvKTtcclxuICBpZiAocmVwby5jdXJyZW50ICE9PSAnMC4wLjAnKSB7XHJcbiAgICByZXR1cm47XHJcbiAgfVxyXG4gIHJldHVybiBnZXRMYXRlc3RSZWxlYXNlcyhhcGksIHJlcG8pXHJcbiAgICAudGhlbihhc3luYyBjdXJyZW50UmVsZWFzZXMgPT4ge1xyXG4gICAgICBjb25zdCBkb3dubG9hZExpbmsgPSBhd2FpdCByZXNvbHZlRG93bmxvYWRMaW5rKHJlcG8sIGN1cnJlbnRSZWxlYXNlcyk7XHJcbiAgICAgIHJldHVybiBzdGFydERvd25sb2FkKGFwaSwgcmVwbywgZG93bmxvYWRMaW5rKTtcclxuICAgIH0pXHJcbiAgICAuY2F0Y2goZXJyID0+IHtcclxuICAgICAgaWYgKGVyciBpbnN0YW5jZW9mIHV0aWwuVXNlckNhbmNlbGVkIHx8IGVyciBpbnN0YW5jZW9mIHV0aWwuUHJvY2Vzc0NhbmNlbGVkKSB7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICB9IGVsc2Uge1xyXG4gICAgICAgIGFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ1VuYWJsZSB0byBkb3dubG9hZC9pbnN0YWxsIHJlcG8nLFxyXG4gICAgICAgICAgeyAuLi5lcnIsIGRldGFpbHM6IHJlcG8ubmFtZSB9KTtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgIH1cclxuICAgIH0pO1xyXG59XHJcbiJdfQ==