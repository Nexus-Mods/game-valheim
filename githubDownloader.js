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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViRG93bmxvYWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdpdGh1YkRvd25sb2FkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDZDQUErQjtBQUMvQiwwQ0FBNEI7QUFDNUIsK0NBQWlDO0FBQ2pDLHlDQUEyQjtBQUUzQixxQ0FBbUM7QUFLbkMsMkNBQWtFO0FBRWxFLE1BQU0sa0JBQWtCLEdBQUcsbUVBQW1FLENBQUM7QUFDL0YsTUFBTSxPQUFPLEdBQUcsOENBQThDLENBQUM7QUFFL0QsTUFBTSx1QkFBdUIsR0FBRyx5REFBeUQsQ0FBQztBQUMxRixNQUFNLFlBQVksR0FBRyxvQ0FBb0MsQ0FBQztBQUUxRCxNQUFNLEtBQUssR0FBc0M7SUFDL0MsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLFNBQVM7UUFDZixHQUFHLEVBQUUsT0FBTztRQUNaLE9BQU8sRUFBRSxZQUFZO1FBQ3JCLFdBQVcsRUFBRSxnREFBZ0Q7UUFDN0QsYUFBYSxFQUFFLENBQUMsT0FBZSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPO0tBQzVFO0lBQ0QsYUFBYSxFQUFFO1FBQ2IsSUFBSSxFQUFFLHVCQUF1QjtRQUM3QixHQUFHLEVBQUUsa0JBQWtCO1FBQ3ZCLE9BQU8sRUFBRSx1QkFBdUI7UUFDaEMsV0FBVyxFQUFFLG9EQUFvRDtRQUNqRSxhQUFhLEVBQUUsQ0FBQyxPQUFlLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU87S0FDNUU7Q0FDRixDQUFDO0FBRUYsU0FBUyxLQUFLLENBQUMsT0FBZSxFQUFFLE9BQWU7SUFDN0MsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFN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QUU7WUFDNUIsT0FBTztTQUNSO1FBQ0QsT0FBTyxpQkFBaUIsQ0FBQyxHQUFHLEVBQUUsSUFBSSxDQUFDO2FBQ2hDLElBQUksQ0FBQyxDQUFNLGVBQWUsRUFBQyxFQUFFO1lBQzVCLE1BQU0sWUFBWSxHQUFHLE1BQU0sbUJBQW1CLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxDQUFDO1lBQ3RFLE9BQU8sYUFBYSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDaEQsQ0FBQyxDQUFBLENBQUM7YUFDRCxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDWCxJQUFJLEdBQUcsWUFBWSxpQkFBSSxDQUFDLFlBQVksSUFBSSxHQUFHLFlBQVksaUJBQUksQ0FBQyxlQUFlLEVBQUU7Z0JBQzNFLE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO2FBQzFCO2lCQUFNO2dCQUNMLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxpQ0FBaUMsa0NBQ3BELEdBQUcsS0FBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBRyxDQUFDO2dCQUNsQyxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQzthQUMxQjtRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztDQUFBO0FBcEJELHNEQW9CQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGh0dHBzIGZyb20gJ2h0dHBzJztcclxuaW1wb3J0ICogYXMgXyBmcm9tICdsb2Rhc2gnO1xyXG5pbXBvcnQgKiBhcyBzZW12ZXIgZnJvbSAnc2VtdmVyJztcclxuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XHJcblxyXG5pbXBvcnQgeyBHQU1FX0lEIH0gZnJvbSAnLi9jb21tb24nO1xyXG5cclxuaW1wb3J0IHsgSUdpdGh1YlJlcG99IGZyb20gJy4vdHlwZXMnO1xyXG5cclxuaW1wb3J0IHsgSW5jb21pbmdIdHRwSGVhZGVycywgSW5jb21pbmdNZXNzYWdlIH0gZnJvbSAnaHR0cCc7XHJcbmltcG9ydCB7IGFjdGlvbnMsIGxvZywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuY29uc3QgVVJMX0NPTkZJR19NQU5BR0VSID0gJ2h0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvQmVwSW5FeC9CZXBJbkV4LkNvbmZpZ3VyYXRpb25NYW5hZ2VyJztcclxuY29uc3QgVVJMX0JJWCA9ICdodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zL0JlcEluRXgvQmVwSW5FeCc7XHJcblxyXG5jb25zdCBVUkxfU0lURV9DT05GSUdfTUFOQUdFUiA9ICdodHRwczovL2dpdGh1Yi5jb20vQmVwSW5FeC9CZXBJbkV4LkNvbmZpZ3VyYXRpb25NYW5hZ2VyJztcclxuY29uc3QgVVJMX1NJVEVfQklYID0gJ2h0dHBzOi8vZ2l0aHViLmNvbS9CZXBJbkV4L0JlcEluRXgnO1xyXG5cclxuY29uc3QgUkVQT1M6IHsgW3JlcG9JZDogc3RyaW5nXTogSUdpdGh1YlJlcG8gfSA9IHtcclxuICBiZXBJbkV4OiB7XHJcbiAgICBuYW1lOiAnQmVwSW5FeCcsXHJcbiAgICB1cmw6IFVSTF9CSVgsXHJcbiAgICB3ZWJzaXRlOiBVUkxfU0lURV9CSVgsXHJcbiAgICBmaWxlUGF0dGVybjogLyhCZXBJbkV4X3g2NF9bMC05XSsuWzAtOV0rLlswLTldKy5bMC05XSsuemlwKS9pLFxyXG4gICAgY29lcmNlVmVyc2lvbjogKHZlcnNpb246IHN0cmluZykgPT4gc2VtdmVyLmNvZXJjZSh2ZXJzaW9uLnNsaWNlKDEpKS52ZXJzaW9uLFxyXG4gIH0sXHJcbiAgY29uZmlnTWFuYWdlcjoge1xyXG4gICAgbmFtZTogJ0NvbmZpZ3VyYXRpb24gTWFuYWdlcicsXHJcbiAgICB1cmw6IFVSTF9DT05GSUdfTUFOQUdFUixcclxuICAgIHdlYnNpdGU6IFVSTF9TSVRFX0NPTkZJR19NQU5BR0VSLFxyXG4gICAgZmlsZVBhdHRlcm46IC8oQmVwSW5FeC5Db25maWd1cmF0aW9uTWFuYWdlcl92WzAtOV0rLlswLTldKy56aXApL2ksXHJcbiAgICBjb2VyY2VWZXJzaW9uOiAodmVyc2lvbjogc3RyaW5nKSA9PiBzZW12ZXIuY29lcmNlKHZlcnNpb24uc2xpY2UoMSkpLnZlcnNpb24sXHJcbiAgfSxcclxufTtcclxuXHJcbmZ1bmN0aW9uIHF1ZXJ5KGJhc2VVcmw6IHN0cmluZywgcmVxdWVzdDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgY29uc3QgZ2V0UmVxdWVzdCA9IGdldFJlcXVlc3RPcHRpb25zKGAke2Jhc2VVcmx9LyR7cmVxdWVzdH1gKTtcclxuICAgIGh0dHBzLmdldChnZXRSZXF1ZXN0LCAocmVzOiBJbmNvbWluZ01lc3NhZ2UpID0+IHtcclxuICAgICAgcmVzLnNldEVuY29kaW5nKCd1dGYtOCcpO1xyXG4gICAgICBjb25zdCBtc2dIZWFkZXJzOiBJbmNvbWluZ0h0dHBIZWFkZXJzID0gcmVzLmhlYWRlcnM7XHJcbiAgICAgIGNvbnN0IGNhbGxzUmVtYWluaW5nID0gcGFyc2VJbnQodXRpbC5nZXRTYWZlKG1zZ0hlYWRlcnMsIFsneC1yYXRlbGltaXQtcmVtYWluaW5nJ10sICcwJyksIDEwKTtcclxuICAgICAgaWYgKChyZXMuc3RhdHVzQ29kZSA9PT0gNDAzKSAmJiAoY2FsbHNSZW1haW5pbmcgPT09IDApKSB7XHJcbiAgICAgICAgY29uc3QgcmVzZXREYXRlID0gcGFyc2VJbnQodXRpbC5nZXRTYWZlKG1zZ0hlYWRlcnMsIFsneC1yYXRlbGltaXQtcmVzZXQnXSwgJzAnKSwgMTApO1xyXG4gICAgICAgIGxvZygnaW5mbycsICdHaXRIdWIgcmF0ZSBsaW1pdCBleGNlZWRlZCcsXHJcbiAgICAgICAgICB7IHJlc2V0X2F0OiAobmV3IERhdGUocmVzZXREYXRlKSkudG9TdHJpbmcoKSB9KTtcclxuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyB1dGlsLlByb2Nlc3NDYW5jZWxlZCgnR2l0SHViIHJhdGUgbGltaXQgZXhjZWVkZWQnKSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGxldCBvdXRwdXQ6IHN0cmluZyA9ICcnO1xyXG4gICAgICByZXNcclxuICAgICAgICAub24oJ2RhdGEnLCBkYXRhID0+IG91dHB1dCArPSBkYXRhKVxyXG4gICAgICAgIC5vbignZW5kJywgKCkgPT4ge1xyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoSlNPTi5wYXJzZShvdXRwdXQpKTtcclxuICAgICAgICAgIH0gY2F0Y2ggKHBhcnNlRXJyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QocGFyc2VFcnIpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfSlcclxuICAgICAgLm9uKCdlcnJvcicsIGVyciA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpO1xyXG4gICAgICB9KVxyXG4gICAgICAuZW5kKCk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFJlcXVlc3RPcHRpb25zKGxpbmspIHtcclxuICBjb25zdCByZWxVcmwgPSB1cmwucGFyc2UobGluayk7XHJcbiAgcmV0dXJuICh7XHJcbiAgICAuLi5fLnBpY2socmVsVXJsLCBbJ3BvcnQnLCAnaG9zdG5hbWUnLCAncGF0aCddKSxcclxuICAgIGhlYWRlcnM6IHtcclxuICAgICAgJ1VzZXItQWdlbnQnOiAnVm9ydGV4JyxcclxuICAgIH0sXHJcbiAgfSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIG5vdGlmeVVwZGF0ZShhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvOiBJR2l0aHViUmVwbyk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGNvbnN0IGdhbWVJZCA9IHNlbGVjdG9ycy5hY3RpdmVHYW1lSWQoYXBpLnN0b3JlLmdldFN0YXRlKCkpO1xyXG4gIGNvbnN0IHQgPSBhcGkudHJhbnNsYXRlO1xyXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBhcGkuc2VuZE5vdGlmaWNhdGlvbih7XHJcbiAgICAgIHR5cGU6ICdpbmZvJyxcclxuICAgICAgaWQ6IGBkaXZpbmUtdXBkYXRlYCxcclxuICAgICAgbm9EaXNtaXNzOiB0cnVlLFxyXG4gICAgICBhbGxvd1N1cHByZXNzOiB0cnVlLFxyXG4gICAgICB0aXRsZTogJ1VwZGF0ZSBmb3Ige3tuYW1lfX0nLFxyXG4gICAgICBtZXNzYWdlOiAnTGF0ZXN0OiB7e2xhdGVzdH19LCBJbnN0YWxsZWQ6IHt7Y3VycmVudH19JyxcclxuICAgICAgcmVwbGFjZToge1xyXG4gICAgICAgIG5hbWU6IHJlcG8ubmFtZSxcclxuICAgICAgICBsYXRlc3Q6IHJlcG8ubGF0ZXN0LFxyXG4gICAgICAgIGN1cnJlbnQ6IHJlcG8uY3VycmVudCxcclxuICAgICAgfSxcclxuICAgICAgYWN0aW9uczogW1xyXG4gICAgICAgIHsgdGl0bGUgOiAnTW9yZScsIGFjdGlvbjogKGRpc21pc3M6ICgpID0+IHZvaWQpID0+IHtcclxuICAgICAgICAgICAgYXBpLnNob3dEaWFsb2coJ2luZm8nLCAne3tuYW1lfX0gVXBkYXRlJywge1xyXG4gICAgICAgICAgICAgIHRleHQ6ICdWb3J0ZXggaGFzIGRldGVjdGVkIGEgbmV3ZXIgdmVyc2lvbiBvZiB7e25hbWV9fSAoe3tsYXRlc3R9fSkgYXZhaWxhYmxlIHRvIGRvd25sb2FkIGZyb20ge3t3ZWJzaXRlfX0uIFlvdSBjdXJyZW50bHkgaGF2ZSB2ZXJzaW9uIHt7Y3VycmVudH19IGluc3RhbGxlZC4nXHJcbiAgICAgICAgICAgICAgKyAnXFxuVm9ydGV4IGNhbiBkb3dubG9hZCBhbmQgYXR0ZW1wdCB0byBpbnN0YWxsIHRoZSBuZXcgdXBkYXRlIGZvciB5b3UuJyxcclxuICAgICAgICAgICAgICBwYXJhbWV0ZXJzOiB7XHJcbiAgICAgICAgICAgICAgICBuYW1lOiByZXBvLm5hbWUsXHJcbiAgICAgICAgICAgICAgICB3ZWJzaXRlOiByZXBvLndlYnNpdGUsXHJcbiAgICAgICAgICAgICAgICBsYXRlc3Q6IHJlcG8ubGF0ZXN0LFxyXG4gICAgICAgICAgICAgICAgY3VycmVudDogcmVwby5jdXJyZW50LFxyXG4gICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgIH0sIFtcclxuICAgICAgICAgICAgICAgIHtcclxuICAgICAgICAgICAgICAgICAgbGFiZWw6ICdEb3dubG9hZCcsXHJcbiAgICAgICAgICAgICAgICAgIGFjdGlvbjogKCkgPT4ge1xyXG4gICAgICAgICAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgICAgICAgICBkaXNtaXNzKCk7XHJcbiAgICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgICB9LFxyXG4gICAgICAgICAgICAgIF0pO1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICAgIHtcclxuICAgICAgICAgIHRpdGxlOiAnRGlzbWlzcycsXHJcbiAgICAgICAgICBhY3Rpb246IChkaXNtaXNzKSA9PiB7XHJcbiAgICAgICAgICAgIHJlc29sdmUoKTtcclxuICAgICAgICAgICAgZGlzbWlzcygpO1xyXG4gICAgICAgICAgfSxcclxuICAgICAgICB9LFxyXG4gICAgICBdLFxyXG4gICAgfSk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBnZXRMYXRlc3RSZWxlYXNlcyhhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIHJlcG86IElHaXRodWJSZXBvKSB7XHJcbiAgaWYgKHJlcG8uY3VycmVudCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXBvLmN1cnJlbnQgPSBnZXRDdXJyZW50VmVyc2lvbihhcGksIHJlcG8pO1xyXG4gIH1cclxuICByZXR1cm4gcXVlcnkocmVwby51cmwsICdyZWxlYXNlcycpXHJcbiAgLnRoZW4oKHJlbGVhc2VzKSA9PiB7XHJcbiAgICBpZiAoIUFycmF5LmlzQXJyYXkocmVsZWFzZXMpKSB7XHJcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgdXRpbC5EYXRhSW52YWxpZCgnZXhwZWN0ZWQgYXJyYXkgb2YgZ2l0aHViIHJlbGVhc2VzJykpO1xyXG4gICAgfVxyXG4gICAgY29uc3QgY3VycmVudCA9IHJlbGVhc2VzXHJcbiAgICAgIC5maWx0ZXIocmVsID0+IHtcclxuICAgICAgICBjb25zdCB0YWdOYW1lID0gcmVwby5jb2VyY2VWZXJzaW9uKHV0aWwuZ2V0U2FmZShyZWwsIFsndGFnX25hbWUnXSwgdW5kZWZpbmVkKSk7XHJcbiAgICAgICAgY29uc3QgaXNQcmVSZWxlYXNlID0gdXRpbC5nZXRTYWZlKHJlbCwgWydwcmVyZWxlYXNlJ10sIGZhbHNlKTtcclxuICAgICAgICBjb25zdCB2ZXJzaW9uID0gc2VtdmVyLnZhbGlkKHRhZ05hbWUpO1xyXG5cclxuICAgICAgICByZXR1cm4gKCFpc1ByZVJlbGVhc2VcclxuICAgICAgICAgICYmICh2ZXJzaW9uICE9PSBudWxsKVxyXG4gICAgICAgICAgJiYgKChyZXBvLmN1cnJlbnQgPT09IHVuZGVmaW5lZCkgfHwgKHNlbXZlci5ndGUodmVyc2lvbiwgcmVwby5jdXJyZW50KSkpKTtcclxuICAgICAgfSlcclxuICAgICAgLnNvcnQoKGxocywgcmhzKSA9PiBzZW12ZXIuY29tcGFyZShcclxuICAgICAgICByZXBvLmNvZXJjZVZlcnNpb24ocmhzLnRhZ19uYW1lKSxcclxuICAgICAgICByZXBvLmNvZXJjZVZlcnNpb24obGhzLnRhZ19uYW1lKSkpO1xyXG5cclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoY3VycmVudCk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHN0YXJ0RG93bmxvYWQoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIHJlcG86IElHaXRodWJSZXBvLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRvd25sb2FkTGluazogc3RyaW5nKSB7XHJcbiAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBuby1zaGFkb3dlZC12YXJpYWJsZSAtIHdoeSBpcyB0aGlzIGV2ZW4gcmVxdWlyZWQgP1xyXG4gIGNvbnN0IHJlZGlyZWN0aW9uVVJMID0gYXdhaXQgbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgaHR0cHMucmVxdWVzdChnZXRSZXF1ZXN0T3B0aW9ucyhkb3dubG9hZExpbmspLCByZXMgPT4ge1xyXG4gICAgICByZXR1cm4gcmVzb2x2ZShyZXMuaGVhZGVyc1snbG9jYXRpb24nXSk7XHJcbiAgICB9KVxyXG4gICAgICAub24oJ2Vycm9yJywgZXJyID0+IHJlamVjdChlcnIpKVxyXG4gICAgICAuZW5kKCk7XHJcbiAgfSk7XHJcbiAgY29uc3QgZGxJbmZvID0ge1xyXG4gICAgZ2FtZTogR0FNRV9JRCxcclxuICAgIG5hbWU6IHJlcG8ubmFtZSxcclxuICB9O1xyXG4gIGFwaS5ldmVudHMuZW1pdCgnc3RhcnQtZG93bmxvYWQnLCBbcmVkaXJlY3Rpb25VUkxdLCBkbEluZm8sIHVuZGVmaW5lZCxcclxuICAgIChlcnJvciwgaWQpID0+IHtcclxuICAgICAgaWYgKGVycm9yICE9PSBudWxsKSB7XHJcbiAgICAgICAgaWYgKChlcnJvci5uYW1lID09PSAnQWxyZWFkeURvd25sb2FkZWQnKVxyXG4gICAgICAgICAgICAmJiAoZXJyb3IuZG93bmxvYWRJZCAhPT0gdW5kZWZpbmVkKSkge1xyXG4gICAgICAgICAgaWQgPSBlcnJvci5kb3dubG9hZElkO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICBhcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdEb3dubG9hZCBmYWlsZWQnLFxyXG4gICAgICAgICAgICBlcnJvciwgeyBhbGxvd1JlcG9ydDogZmFsc2UgfSk7XHJcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIGFwaS5ldmVudHMuZW1pdCgnc3RhcnQtaW5zdGFsbC1kb3dubG9hZCcsIGlkLCB0cnVlLCAoZXJyLCBtb2RJZCkgPT4ge1xyXG4gICAgICAgIGlmIChlcnIgIT09IG51bGwpIHtcclxuICAgICAgICAgIGFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ0ZhaWxlZCB0byBpbnN0YWxsIHJlcG8nLFxyXG4gICAgICAgICAgICBlcnIsIHsgYWxsb3dSZXBvcnQ6IGZhbHNlIH0pO1xyXG4gICAgICAgIH1cclxuXHJcbiAgICAgICAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICAgICAgICBjb25zdCBwcm9maWxlSWQgPSBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICAgICAgICBjb25zdCBiYXRjaCA9IFtcclxuICAgICAgICAgIGFjdGlvbnMuc2V0TW9kRW5hYmxlZChwcm9maWxlSWQsIG1vZElkLCB0cnVlKSxcclxuICAgICAgICAgIGFjdGlvbnMuc2V0TW9kQXR0cmlidXRlKEdBTUVfSUQsIG1vZElkLCAnUmVwb0Rvd25sb2FkJywgcmVwby5uYW1lKSxcclxuICAgICAgICAgIGFjdGlvbnMuc2V0TW9kQXR0cmlidXRlKEdBTUVfSUQsIG1vZElkLCAndmVyc2lvbicsIHJlcG8ubGF0ZXN0KSxcclxuICAgICAgICBdO1xyXG4gICAgICAgIGZvciAoY29uc3QgYWN0IG9mIGJhdGNoKSB7XHJcbiAgICAgICAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0KTtcclxuICAgICAgICB9XHJcbiAgICAgICAgLy8gdXRpbC5iYXRjaERpc3BhdGNoKGFwaS5zdG9yZSwgYmF0Y2gpO1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfSk7XHJcbiAgICB9LCAnYXNrJyk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIHJlc29sdmVEb3dubG9hZExpbmsocmVwbzogSUdpdGh1YlJlcG8sIGN1cnJlbnRSZWxlYXNlczogYW55W10pIHtcclxuICBjb25zdCBhcmNoaXZlcyA9IGN1cnJlbnRSZWxlYXNlc1swXS5hc3NldHMuZmlsdGVyKGFzc2V0ID0+XHJcbiAgICBhc3NldC5uYW1lLm1hdGNoKHJlcG8uZmlsZVBhdHRlcm4pKTtcclxuXHJcbiAgY29uc3QgZG93bmxvYWRMaW5rID0gYXJjaGl2ZXNbMF0/LmJyb3dzZXJfZG93bmxvYWRfdXJsO1xyXG4gIHJldHVybiAoZG93bmxvYWRMaW5rID09PSB1bmRlZmluZWQpXHJcbiAgICA/IFByb21pc2UucmVqZWN0KG5ldyB1dGlsLkRhdGFJbnZhbGlkKCdGYWlsZWQgdG8gcmVzb2x2ZSBicm93c2VyIGRvd25sb2FkIHVybCcpKVxyXG4gICAgOiBQcm9taXNlLnJlc29sdmUoZG93bmxvYWRMaW5rKTtcclxufVxyXG5cclxuZnVuY3Rpb24gZ2V0Q3VycmVudFZlcnNpb24oYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCByZXBvOiBJR2l0aHViUmVwbykge1xyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgbW9kcyA9IHN0YXRlLnBlcnNpc3RlbnQubW9kc1tHQU1FX0lEXTtcclxuICBpZiAobW9kcyA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm4gJzAuMC4wJztcclxuICB9XHJcbiAgLy8gY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5hY3RpdmVQcm9maWxlKHN0YXRlKTtcclxuICAvLyBjb25zdCBpc0VuYWJsZWQgPSAobW9kSWQ6IHN0cmluZykgPT4gdXRpbC5nZXRTYWZlKHByb2ZpbGUsIFsnbW9kU3RhdGUnLCBtb2RJZCwgJ2VuYWJsZWQnXSwgZmFsc2UpO1xyXG4gIGNvbnN0IG1vZCA9IE9iamVjdC52YWx1ZXMobW9kcykuZmluZCh4ID0+IHguYXR0cmlidXRlc1snUmVwb0Rvd25sb2FkJ10gPT09IHJlcG8ubmFtZSk7XHJcbiAgaWYgKG1vZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICByZXR1cm4gJzAuMC4wJztcclxuICB9XHJcbiAgcmV0dXJuIG1vZC5hdHRyaWJ1dGVzWyd2ZXJzaW9uJ107XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiBjaGVja0NvbmZpZ01hbmFnZXJVcGQoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCBmb3JjZT86IGJvb2xlYW4pIHtcclxuICBjb25zdCByZXBvID0gUkVQT1NbJ2NvbmZpZ01hbmFnZXInXTtcclxuICByZXR1cm4gY2hlY2tGb3JVcGRhdGVzKGFwaSwgcmVwbywgZm9yY2UpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBjaGVja0ZvclVwZGF0ZXMoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwbzogSUdpdGh1YlJlcG8sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBmb3JjZT86IGJvb2xlYW4pOiBQcm9taXNlPHN0cmluZz4ge1xyXG4gIHJlcG8uY3VycmVudCA9IGdldEN1cnJlbnRWZXJzaW9uKGFwaSwgcmVwbyk7XHJcbiAgcmV0dXJuIGdldExhdGVzdFJlbGVhc2VzKGFwaSwgcmVwbylcclxuICAgIC50aGVuKGFzeW5jIGN1cnJlbnRSZWxlYXNlcyA9PiB7XHJcbiAgICAgIGNvbnN0IG1vc3RSZWNlbnRWZXJzaW9uID0gcmVwby5jb2VyY2VWZXJzaW9uKGN1cnJlbnRSZWxlYXNlc1swXS50YWdfbmFtZSk7XHJcbiAgICAgIGNvbnN0IGRvd25sb2FkTGluayA9IGF3YWl0IHJlc29sdmVEb3dubG9hZExpbmsocmVwbywgY3VycmVudFJlbGVhc2VzKTtcclxuICAgICAgaWYgKHNlbXZlci52YWxpZChtb3N0UmVjZW50VmVyc2lvbikgPT09IG51bGwpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgcmVwby5sYXRlc3QgPSBtb3N0UmVjZW50VmVyc2lvbjtcclxuICAgICAgICBpZiAoc2VtdmVyLmd0KG1vc3RSZWNlbnRWZXJzaW9uLCByZXBvLmN1cnJlbnQpKSB7XHJcbiAgICAgICAgICBjb25zdCB1cGRhdGUgPSAoKSA9PiBmb3JjZSA/IFByb21pc2UucmVzb2x2ZSgpIDogbm90aWZ5VXBkYXRlKGFwaSwgcmVwbyk7XHJcbiAgICAgICAgICByZXR1cm4gdXBkYXRlKClcclxuICAgICAgICAgICAgLnRoZW4oKCkgPT4gc3RhcnREb3dubG9hZChhcGksIHJlcG8sIGRvd25sb2FkTGluaykpXHJcbiAgICAgICAgICAgIC50aGVuKCgpID0+IFByb21pc2UucmVzb2x2ZShtb3N0UmVjZW50VmVyc2lvbikpO1xyXG4gICAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICB9KS5jYXRjaChlcnIgPT4ge1xyXG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWQgfHwgZXJyIGluc3RhbmNlb2YgdXRpbC5Qcm9jZXNzQ2FuY2VsZWQpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGNvbnN0IGFsbG93UmVwb3J0ID0gIVsnRUNPTk5SRVNFVCcsICdFUEVSTScsICdFTk9FTlQnLCAnRVBST1RPJ10uaW5jbHVkZXMoZXJyLmNvZGUpO1xyXG4gICAgICBhcGkuc2hvd0Vycm9yTm90aWZpY2F0aW9uKCdVbmFibGUgdG8gdXBkYXRlIGZyb20gR2l0aHViIHJlcG8nLFxyXG4gICAgICAgIHsgLi4uZXJyLCByZXBvTmFtZTogcmVwby5uYW1lIH0sIHsgYWxsb3dSZXBvcnQgfSk7XHJcblxyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRvd25sb2FkQ29uZmlnTWFuYWdlcihhcGk6IHR5cGVzLklFeHRlbnNpb25BcGkpOiBQcm9taXNlPHZvaWQ+IHtcclxuICBjb25zdCByZXBvID0gUkVQT1NbJ2NvbmZpZ01hbmFnZXInXTtcclxuICByZXBvLmN1cnJlbnQgPSBnZXRDdXJyZW50VmVyc2lvbihhcGksIHJlcG8pO1xyXG4gIGlmIChyZXBvLmN1cnJlbnQgIT09ICcwLjAuMCcpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgcmV0dXJuIGdldExhdGVzdFJlbGVhc2VzKGFwaSwgcmVwbylcclxuICAgIC50aGVuKGFzeW5jIGN1cnJlbnRSZWxlYXNlcyA9PiB7XHJcbiAgICAgIGNvbnN0IGRvd25sb2FkTGluayA9IGF3YWl0IHJlc29sdmVEb3dubG9hZExpbmsocmVwbywgY3VycmVudFJlbGVhc2VzKTtcclxuICAgICAgcmV0dXJuIHN0YXJ0RG93bmxvYWQoYXBpLCByZXBvLCBkb3dubG9hZExpbmspO1xyXG4gICAgfSlcclxuICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWQgfHwgZXJyIGluc3RhbmNlb2YgdXRpbC5Qcm9jZXNzQ2FuY2VsZWQpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignVW5hYmxlIHRvIGRvd25sb2FkL2luc3RhbGwgcmVwbycsXHJcbiAgICAgICAgICB7IC4uLmVyciwgZGV0YWlsczogcmVwby5uYW1lIH0pO1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbn1cclxuIl19