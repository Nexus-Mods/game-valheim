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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2l0aHViRG93bmxvYWRlci5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbImdpdGh1YkRvd25sb2FkZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDZDQUErQjtBQUMvQiwwQ0FBNEI7QUFDNUIsK0NBQWlDO0FBQ2pDLHlDQUEyQjtBQUUzQixxQ0FBbUM7QUFLbkMsMkNBQWtFO0FBRWxFLE1BQU0sa0JBQWtCLEdBQUcsbUVBQW1FLENBQUM7QUFDL0YsTUFBTSxPQUFPLEdBQUcsOENBQThDLENBQUM7QUFFL0QsTUFBTSx1QkFBdUIsR0FBRyx5REFBeUQsQ0FBQztBQUMxRixNQUFNLFlBQVksR0FBRyxvQ0FBb0MsQ0FBQztBQUUxRCxNQUFNLEtBQUssR0FBc0M7SUFDL0MsT0FBTyxFQUFFO1FBQ1AsSUFBSSxFQUFFLFNBQVM7UUFDZixHQUFHLEVBQUUsT0FBTztRQUNaLE9BQU8sRUFBRSxZQUFZO1FBQ3JCLFdBQVcsRUFBRSxnREFBZ0Q7UUFDN0QsYUFBYSxFQUFFLENBQUMsT0FBZSxFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPO0tBQzVFO0lBQ0QsYUFBYSxFQUFFO1FBQ2IsSUFBSSxFQUFFLHVCQUF1QjtRQUM3QixHQUFHLEVBQUUsa0JBQWtCO1FBQ3ZCLE9BQU8sRUFBRSx1QkFBdUI7UUFDaEMsV0FBVyxFQUFFLG9EQUFvRDtRQUNqRSxhQUFhLEVBQUUsQ0FBQyxPQUFlLEVBQUUsRUFBRSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLE9BQU87S0FDNUU7Q0FDRixDQUFDO0FBRUYsU0FBUyxLQUFLLENBQUMsT0FBZSxFQUFFLE9BQWU7SUFDN0MsT0FBTyxJQUFJLE9BQU8sQ0FBQyxDQUFDLE9BQU8sRUFBRSxNQUFN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Q3RFLE9BQU8sYUFBYSxDQUFDLEdBQUcsRUFBRSxJQUFJLEVBQUUsWUFBWSxDQUFDLENBQUM7UUFDaEQsQ0FBQyxDQUFBLENBQUM7YUFDRCxLQUFLLENBQUMsR0FBRyxDQUFDLEVBQUU7WUFDWCxJQUFJLEdBQUcsWUFBWSxpQkFBSSxDQUFDLFlBQVksSUFBSSxHQUFHLFlBQVksaUJBQUksQ0FBQyxlQUFlLEVBQUU7Z0JBQzNFLE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO2FBQzFCO2lCQUFNO2dCQUNMLEdBQUcsQ0FBQyxxQkFBcUIsQ0FBQyxpQ0FBaUMsa0NBQ3BELEdBQUcsS0FBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLElBQUksSUFBRyxDQUFDO2dCQUNsQyxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQzthQUMxQjtRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ1AsQ0FBQztDQUFBO0FBcEJELHNEQW9CQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCAqIGFzIGh0dHBzIGZyb20gJ2h0dHBzJztcclxuaW1wb3J0ICogYXMgXyBmcm9tICdsb2Rhc2gnO1xyXG5pbXBvcnQgKiBhcyBzZW12ZXIgZnJvbSAnc2VtdmVyJztcclxuaW1wb3J0ICogYXMgdXJsIGZyb20gJ3VybCc7XHJcblxyXG5pbXBvcnQgeyBHQU1FX0lEIH0gZnJvbSAnLi9jb21tb24nO1xyXG5cclxuaW1wb3J0IHsgSUdpdGh1YlJlcG99IGZyb20gJy4vdHlwZXMnO1xyXG5cclxuaW1wb3J0IHsgSW5jb21pbmdIdHRwSGVhZGVycywgSW5jb21pbmdNZXNzYWdlIH0gZnJvbSAnaHR0cCc7XHJcbmltcG9ydCB7IGFjdGlvbnMsIGxvZywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuY29uc3QgVVJMX0NPTkZJR19NQU5BR0VSID0gJ2h0dHBzOi8vYXBpLmdpdGh1Yi5jb20vcmVwb3MvQmVwSW5FeC9CZXBJbkV4LkNvbmZpZ3VyYXRpb25NYW5hZ2VyJztcclxuY29uc3QgVVJMX0JJWCA9ICdodHRwczovL2FwaS5naXRodWIuY29tL3JlcG9zL0JlcEluRXgvQmVwSW5FeCc7XHJcblxyXG5jb25zdCBVUkxfU0lURV9DT05GSUdfTUFOQUdFUiA9ICdodHRwczovL2dpdGh1Yi5jb20vQmVwSW5FeC9CZXBJbkV4LkNvbmZpZ3VyYXRpb25NYW5hZ2VyJztcclxuY29uc3QgVVJMX1NJVEVfQklYID0gJ2h0dHBzOi8vZ2l0aHViLmNvbS9CZXBJbkV4L0JlcEluRXgnO1xyXG5cclxuY29uc3QgUkVQT1M6IHsgW3JlcG9JZDogc3RyaW5nXTogSUdpdGh1YlJlcG8gfSA9IHtcclxuICBiZXBJbkV4OiB7XHJcbiAgICBuYW1lOiAnQmVwSW5FeCcsXHJcbiAgICB1cmw6IFVSTF9CSVgsXHJcbiAgICB3ZWJzaXRlOiBVUkxfU0lURV9CSVgsXHJcbiAgICBmaWxlUGF0dGVybjogLyhCZXBJbkV4X3g2NF9bMC05XSsuWzAtOV0rLlswLTldKy5bMC05XSsuemlwKS9pLFxyXG4gICAgY29lcmNlVmVyc2lvbjogKHZlcnNpb246IHN0cmluZykgPT4gc2VtdmVyLmNvZXJjZSh2ZXJzaW9uLnNsaWNlKDEpKS52ZXJzaW9uLFxyXG4gIH0sXHJcbiAgY29uZmlnTWFuYWdlcjoge1xyXG4gICAgbmFtZTogJ0NvbmZpZ3VyYXRpb24gTWFuYWdlcicsXHJcbiAgICB1cmw6IFVSTF9DT05GSUdfTUFOQUdFUixcclxuICAgIHdlYnNpdGU6IFVSTF9TSVRFX0NPTkZJR19NQU5BR0VSLFxyXG4gICAgZmlsZVBhdHRlcm46IC8oQmVwSW5FeC5Db25maWd1cmF0aW9uTWFuYWdlcl92WzAtOV0rLlswLTldKy56aXApL2ksXHJcbiAgICBjb2VyY2VWZXJzaW9uOiAodmVyc2lvbjogc3RyaW5nKSA9PiBzZW12ZXIuY29lcmNlKHZlcnNpb24uc2xpY2UoMSkpLnZlcnNpb24sXHJcbiAgfSxcclxufTtcclxuXHJcbmZ1bmN0aW9uIHF1ZXJ5KGJhc2VVcmw6IHN0cmluZywgcmVxdWVzdDogc3RyaW5nKTogUHJvbWlzZTxhbnk+IHtcclxuICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgY29uc3QgZ2V0UmVxdWVzdCA9IGdldFJlcXVlc3RPcHRpb25zKGAke2Jhc2VVcmx9LyR7cmVxdWVzdH1gKTtcclxuICAgIGh0dHBzLmdldChnZXRSZXF1ZXN0LCAocmVzOiBJbmNvbWluZ01lc3NhZ2UpID0+IHtcclxuICAgICAgcmVzLnNldEVuY29kaW5nKCd1dGYtOCcpO1xyXG4gICAgICBjb25zdCBtc2dIZWFkZXJzOiBJbmNvbWluZ0h0dHBIZWFkZXJzID0gcmVzLmhlYWRlcnM7XHJcbiAgICAgIGNvbnN0IGNhbGxzUmVtYWluaW5nID0gcGFyc2VJbnQodXRpbC5nZXRTYWZlKG1zZ0hlYWRlcnMsIFsneC1yYXRlbGltaXQtcmVtYWluaW5nJ10sICcwJyksIDEwKTtcclxuICAgICAgaWYgKChyZXMuc3RhdHVzQ29kZSA9PT0gNDAzKSAmJiAoY2FsbHNSZW1haW5pbmcgPT09IDApKSB7XHJcbiAgICAgICAgY29uc3QgcmVzZXREYXRlID0gcGFyc2VJbnQodXRpbC5nZXRTYWZlKG1zZ0hlYWRlcnMsIFsneC1yYXRlbGltaXQtcmVzZXQnXSwgJzAnKSwgMTApO1xyXG4gICAgICAgIGxvZygnaW5mbycsICdHaXRIdWIgcmF0ZSBsaW1pdCBleGNlZWRlZCcsXHJcbiAgICAgICAgICB7IHJlc2V0X2F0OiAobmV3IERhdGUocmVzZXREYXRlKSkudG9TdHJpbmcoKSB9KTtcclxuICAgICAgICByZXR1cm4gcmVqZWN0KG5ldyB1dGlsLlByb2Nlc3NDYW5jZWxlZCgnR2l0SHViIHJhdGUgbGltaXQgZXhjZWVkZWQnKSk7XHJcbiAgICAgIH1cclxuXHJcbiAgICAgIGxldCBvdXRwdXQ6IHN0cmluZyA9ICcnO1xyXG4gICAgICByZXNcclxuICAgICAgICAub24oJ2RhdGEnLCBkYXRhID0+IG91dHB1dCArPSBkYXRhKVxyXG4gICAgICAgIC5vbignZW5kJywgKCkgPT4ge1xyXG4gICAgICAgICAgdHJ5IHtcclxuICAgICAgICAgICAgcmV0dXJuIHJlc29sdmUoSlNPTi5wYXJzZShvdXRwdXQpKTtcclxuICAgICAgICAgIH0gY2F0Y2ggKHBhcnNlRXJyKSB7XHJcbiAgICAgICAgICAgIHJldHVybiByZWplY3QocGFyc2VFcnIpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH0pO1xyXG4gICAgfSlcclxuICAgICAgLm9uKCdlcnJvcicsIGVyciA9PiB7XHJcbiAgICAgICAgcmV0dXJuIHJlamVjdChlcnIpO1xyXG4gICAgICB9KVxyXG4gICAgICAuZW5kKCk7XHJcbiAgfSk7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGdldFJlcXVlc3RPcHRpb25zKGxpbmspIHtcclxuICBjb25zdCByZWxVcmwgPSB1cmwucGFyc2UobGluayk7XHJcbiAgcmV0dXJuICh7XHJcbiAgICAuLi5fLnBpY2socmVsVXJsLCBbJ3BvcnQnLCAnaG9zdG5hbWUnLCAncGF0aCddKSxcclxuICAgIGhlYWRlcnM6IHtcclxuICAgICAgJ1VzZXItQWdlbnQnOiAnVm9ydGV4JyxcclxuICAgIH0sXHJcbiAgfSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIG5vdGlmeVVwZGF0ZShhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvOiBJR2l0aHViUmVwbyk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGNvbnN0IGdhbWVJZCA9IHNlbGVjdG9ycy5hY3RpdmVHYW1lSWQoYXBpLnN0b3JlLmdldFN0YXRlKCkpO1xyXG4gIGNvbnN0IHQgPSBhcGkudHJhbnNsYXRlO1xyXG4gIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBhcGkuc2VuZE5vdGlmaWNhdGlvbih7XHJcbiAgICAgIHR5cGU6ICdpbmZvJyxcclxuICAgICAgaWQ6IGBkaXZpbmUtdXBkYXRlYCxcclxuICAgICAgbm9EaXNtaXNzOiB0cnVlLFxyXG4gICAgICBhbGxvd1N1cHByZXNzOiB0cnVlLFxyXG4gICAgICB0aXRsZTogJ1VwZGF0ZSBmb3Ige3tuYW1lfX0nLFxyXG4gICAgICBtZXNzYWdlOiAnTGF0ZXN0OiB7e2xhdGVzdH19LCBJbnN0YWxsZWQ6IHt7Y3VycmVudH19JyxcclxuICAgICAgcmVwbGFjZToge1xyXG4gICAgICAgIGxhdGVzdDogcmVwby5sYXRlc3QsXHJcbiAgICAgICAgY3VycmVudDogcmVwby5jdXJyZW50LFxyXG4gICAgICB9LFxyXG4gICAgICBhY3Rpb25zOiBbXHJcbiAgICAgICAgeyB0aXRsZSA6ICdNb3JlJywgYWN0aW9uOiAoZGlzbWlzczogKCkgPT4gdm9pZCkgPT4ge1xyXG4gICAgICAgICAgICBhcGkuc2hvd0RpYWxvZygnaW5mbycsICd7e25hbWV9fSBVcGRhdGUnLCB7XHJcbiAgICAgICAgICAgICAgdGV4dDogJ1ZvcnRleCBoYXMgZGV0ZWN0ZWQgYSBuZXdlciB2ZXJzaW9uIG9mIHt7bmFtZX19ICh7e2xhdGVzdH19KSBhdmFpbGFibGUgdG8gZG93bmxvYWQgZnJvbSB7e3dlYnNpdGV9fS4gWW91IGN1cnJlbnRseSBoYXZlIHZlcnNpb24ge3tjdXJyZW50fX0gaW5zdGFsbGVkLidcclxuICAgICAgICAgICAgICArICdcXG5Wb3J0ZXggY2FuIGRvd25sb2FkIGFuZCBhdHRlbXB0IHRvIGluc3RhbGwgdGhlIG5ldyB1cGRhdGUgZm9yIHlvdS4nLFxyXG4gICAgICAgICAgICAgIHBhcmFtZXRlcnM6IHtcclxuICAgICAgICAgICAgICAgIG5hbWU6IHJlcG8ubmFtZSxcclxuICAgICAgICAgICAgICAgIHdlYnNpdGU6IHJlcG8ud2Vic2l0ZSxcclxuICAgICAgICAgICAgICAgIGxhdGVzdDogcmVwby5sYXRlc3QsXHJcbiAgICAgICAgICAgICAgICBjdXJyZW50OiByZXBvLmN1cnJlbnQsXHJcbiAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgfSwgW1xyXG4gICAgICAgICAgICAgICAge1xyXG4gICAgICAgICAgICAgICAgICBsYWJlbDogJ0Rvd25sb2FkJyxcclxuICAgICAgICAgICAgICAgICAgYWN0aW9uOiAoKSA9PiB7XHJcbiAgICAgICAgICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICAgICAgICAgIGRpc21pc3MoKTtcclxuICAgICAgICAgICAgICAgICAgfSxcclxuICAgICAgICAgICAgICAgIH0sXHJcbiAgICAgICAgICAgICAgXSk7XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgdGl0bGU6ICdEaXNtaXNzJyxcclxuICAgICAgICAgIGFjdGlvbjogKGRpc21pc3MpID0+IHtcclxuICAgICAgICAgICAgcmVzb2x2ZSgpO1xyXG4gICAgICAgICAgICBkaXNtaXNzKCk7XHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgIH0sXHJcbiAgICAgIF0sXHJcbiAgICB9KTtcclxuICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGdldExhdGVzdFJlbGVhc2VzKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgcmVwbzogSUdpdGh1YlJlcG8pIHtcclxuICBpZiAocmVwby5jdXJyZW50ID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJlcG8uY3VycmVudCA9IGdldEN1cnJlbnRWZXJzaW9uKGFwaSwgcmVwbyk7XHJcbiAgfVxyXG4gIHJldHVybiBxdWVyeShyZXBvLnVybCwgJ3JlbGVhc2VzJylcclxuICAudGhlbigocmVsZWFzZXMpID0+IHtcclxuICAgIGlmICghQXJyYXkuaXNBcnJheShyZWxlYXNlcykpIHtcclxuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyB1dGlsLkRhdGFJbnZhbGlkKCdleHBlY3RlZCBhcnJheSBvZiBnaXRodWIgcmVsZWFzZXMnKSk7XHJcbiAgICB9XHJcbiAgICBjb25zdCBjdXJyZW50ID0gcmVsZWFzZXNcclxuICAgICAgLmZpbHRlcihyZWwgPT4ge1xyXG4gICAgICAgIGNvbnN0IHRhZ05hbWUgPSByZXBvLmNvZXJjZVZlcnNpb24odXRpbC5nZXRTYWZlKHJlbCwgWyd0YWdfbmFtZSddLCB1bmRlZmluZWQpKTtcclxuICAgICAgICBjb25zdCBpc1ByZVJlbGVhc2UgPSB1dGlsLmdldFNhZmUocmVsLCBbJ3ByZXJlbGVhc2UnXSwgZmFsc2UpO1xyXG4gICAgICAgIGNvbnN0IHZlcnNpb24gPSBzZW12ZXIudmFsaWQodGFnTmFtZSk7XHJcblxyXG4gICAgICAgIHJldHVybiAoIWlzUHJlUmVsZWFzZVxyXG4gICAgICAgICAgJiYgKHZlcnNpb24gIT09IG51bGwpXHJcbiAgICAgICAgICAmJiAoKHJlcG8uY3VycmVudCA9PT0gdW5kZWZpbmVkKSB8fCAoc2VtdmVyLmd0ZSh2ZXJzaW9uLCByZXBvLmN1cnJlbnQpKSkpO1xyXG4gICAgICB9KVxyXG4gICAgICAuc29ydCgobGhzLCByaHMpID0+IHNlbXZlci5jb21wYXJlKFxyXG4gICAgICAgIHJlcG8uY29lcmNlVmVyc2lvbihyaHMudGFnX25hbWUpLFxyXG4gICAgICAgIHJlcG8uY29lcmNlVmVyc2lvbihsaHMudGFnX25hbWUpKSk7XHJcblxyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShjdXJyZW50KTtcclxuICB9KTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gc3RhcnREb3dubG9hZChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgcmVwbzogSUdpdGh1YlJlcG8sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZG93bmxvYWRMaW5rOiBzdHJpbmcpIHtcclxuICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG5vLXNoYWRvd2VkLXZhcmlhYmxlIC0gd2h5IGlzIHRoaXMgZXZlbiByZXF1aXJlZCA/XHJcbiAgY29uc3QgcmVkaXJlY3Rpb25VUkwgPSBhd2FpdCBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICBodHRwcy5yZXF1ZXN0KGdldFJlcXVlc3RPcHRpb25zKGRvd25sb2FkTGluayksIHJlcyA9PiB7XHJcbiAgICAgIHJldHVybiByZXNvbHZlKHJlcy5oZWFkZXJzWydsb2NhdGlvbiddKTtcclxuICAgIH0pXHJcbiAgICAgIC5vbignZXJyb3InLCBlcnIgPT4gcmVqZWN0KGVycikpXHJcbiAgICAgIC5lbmQoKTtcclxuICB9KTtcclxuICBjb25zdCBkbEluZm8gPSB7XHJcbiAgICBnYW1lOiBHQU1FX0lELFxyXG4gICAgbmFtZTogcmVwby5uYW1lLFxyXG4gIH07XHJcbiAgYXBpLmV2ZW50cy5lbWl0KCdzdGFydC1kb3dubG9hZCcsIFtyZWRpcmVjdGlvblVSTF0sIGRsSW5mbywgdW5kZWZpbmVkLFxyXG4gICAgKGVycm9yLCBpZCkgPT4ge1xyXG4gICAgICBpZiAoZXJyb3IgIT09IG51bGwpIHtcclxuICAgICAgICBpZiAoKGVycm9yLm5hbWUgPT09ICdBbHJlYWR5RG93bmxvYWRlZCcpXHJcbiAgICAgICAgICAgICYmIChlcnJvci5kb3dubG9hZElkICE9PSB1bmRlZmluZWQpKSB7XHJcbiAgICAgICAgICBpZCA9IGVycm9yLmRvd25sb2FkSWQ7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIGFwaS5zaG93RXJyb3JOb3RpZmljYXRpb24oJ0Rvd25sb2FkIGZhaWxlZCcsXHJcbiAgICAgICAgICAgIGVycm9yLCB7IGFsbG93UmVwb3J0OiBmYWxzZSB9KTtcclxuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgICAgYXBpLmV2ZW50cy5lbWl0KCdzdGFydC1pbnN0YWxsLWRvd25sb2FkJywgaWQsIHRydWUsIChlcnIsIG1vZElkKSA9PiB7XHJcbiAgICAgICAgaWYgKGVyciAhPT0gbnVsbCkge1xyXG4gICAgICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignRmFpbGVkIHRvIGluc3RhbGwgcmVwbycsXHJcbiAgICAgICAgICAgIGVyciwgeyBhbGxvd1JlcG9ydDogZmFsc2UgfSk7XHJcbiAgICAgICAgfVxyXG5cclxuICAgICAgICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gICAgICAgIGNvbnN0IHByb2ZpbGVJZCA9IHNlbGVjdG9ycy5sYXN0QWN0aXZlUHJvZmlsZUZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gICAgICAgIGNvbnN0IGJhdGNoID0gW1xyXG4gICAgICAgICAgYWN0aW9ucy5zZXRNb2RFbmFibGVkKHByb2ZpbGVJZCwgbW9kSWQsIHRydWUpLFxyXG4gICAgICAgICAgYWN0aW9ucy5zZXRNb2RBdHRyaWJ1dGUoR0FNRV9JRCwgbW9kSWQsICdSZXBvRG93bmxvYWQnLCByZXBvLm5hbWUpLFxyXG4gICAgICAgICAgYWN0aW9ucy5zZXRNb2RBdHRyaWJ1dGUoR0FNRV9JRCwgbW9kSWQsICd2ZXJzaW9uJywgcmVwby5sYXRlc3QpLFxyXG4gICAgICAgIF07XHJcbiAgICAgICAgZm9yIChjb25zdCBhY3Qgb2YgYmF0Y2gpIHtcclxuICAgICAgICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3QpO1xyXG4gICAgICAgIH1cclxuICAgICAgICAvLyB1dGlsLmJhdGNoRGlzcGF0Y2goYXBpLnN0b3JlLCBiYXRjaCk7XHJcbiAgICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gICAgICB9KTtcclxuICAgIH0sICdhc2snKTtcclxufVxyXG5cclxuYXN5bmMgZnVuY3Rpb24gcmVzb2x2ZURvd25sb2FkTGluayhyZXBvOiBJR2l0aHViUmVwbywgY3VycmVudFJlbGVhc2VzOiBhbnlbXSkge1xyXG4gIGNvbnN0IGFyY2hpdmVzID0gY3VycmVudFJlbGVhc2VzWzBdLmFzc2V0cy5maWx0ZXIoYXNzZXQgPT5cclxuICAgIGFzc2V0Lm5hbWUubWF0Y2gocmVwby5maWxlUGF0dGVybikpO1xyXG5cclxuICBjb25zdCBkb3dubG9hZExpbmsgPSBhcmNoaXZlc1swXT8uYnJvd3Nlcl9kb3dubG9hZF91cmw7XHJcbiAgcmV0dXJuIChkb3dubG9hZExpbmsgPT09IHVuZGVmaW5lZClcclxuICAgID8gUHJvbWlzZS5yZWplY3QobmV3IHV0aWwuRGF0YUludmFsaWQoJ0ZhaWxlZCB0byByZXNvbHZlIGJyb3dzZXIgZG93bmxvYWQgdXJsJykpXHJcbiAgICA6IFByb21pc2UucmVzb2x2ZShkb3dubG9hZExpbmspO1xyXG59XHJcblxyXG5mdW5jdGlvbiBnZXRDdXJyZW50VmVyc2lvbihhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIHJlcG86IElHaXRodWJSZXBvKSB7XHJcbiAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBtb2RzID0gc3RhdGUucGVyc2lzdGVudC5tb2RzW0dBTUVfSURdO1xyXG4gIGlmIChtb2RzID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiAnMC4wLjAnO1xyXG4gIH1cclxuICAvLyBjb25zdCBwcm9maWxlID0gc2VsZWN0b3JzLmFjdGl2ZVByb2ZpbGUoc3RhdGUpO1xyXG4gIC8vIGNvbnN0IGlzRW5hYmxlZCA9IChtb2RJZDogc3RyaW5nKSA9PiB1dGlsLmdldFNhZmUocHJvZmlsZSwgWydtb2RTdGF0ZScsIG1vZElkLCAnZW5hYmxlZCddLCBmYWxzZSk7XHJcbiAgY29uc3QgbW9kID0gT2JqZWN0LnZhbHVlcyhtb2RzKS5maW5kKHggPT4geC5hdHRyaWJ1dGVzWydSZXBvRG93bmxvYWQnXSA9PT0gcmVwby5uYW1lKTtcclxuICBpZiAobW9kID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiAnMC4wLjAnO1xyXG4gIH1cclxuICByZXR1cm4gbW9kLmF0dHJpYnV0ZXNbJ3ZlcnNpb24nXTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGNoZWNrQ29uZmlnTWFuYWdlclVwZChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIGZvcmNlPzogYm9vbGVhbikge1xyXG4gIGNvbnN0IHJlcG8gPSBSRVBPU1snY29uZmlnTWFuYWdlciddO1xyXG4gIHJldHVybiBjaGVja0ZvclVwZGF0ZXMoYXBpLCByZXBvLCBmb3JjZSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGNoZWNrRm9yVXBkYXRlcyhhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICByZXBvOiBJR2l0aHViUmVwbyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGZvcmNlPzogYm9vbGVhbik6IFByb21pc2U8c3RyaW5nPiB7XHJcbiAgcmVwby5jdXJyZW50ID0gZ2V0Q3VycmVudFZlcnNpb24oYXBpLCByZXBvKTtcclxuICByZXR1cm4gZ2V0TGF0ZXN0UmVsZWFzZXMoYXBpLCByZXBvKVxyXG4gICAgLnRoZW4oYXN5bmMgY3VycmVudFJlbGVhc2VzID0+IHtcclxuICAgICAgY29uc3QgbW9zdFJlY2VudFZlcnNpb24gPSByZXBvLmNvZXJjZVZlcnNpb24oY3VycmVudFJlbGVhc2VzWzBdLnRhZ19uYW1lKTtcclxuICAgICAgY29uc3QgZG93bmxvYWRMaW5rID0gYXdhaXQgcmVzb2x2ZURvd25sb2FkTGluayhyZXBvLCBjdXJyZW50UmVsZWFzZXMpO1xyXG4gICAgICBpZiAoc2VtdmVyLnZhbGlkKG1vc3RSZWNlbnRWZXJzaW9uKSA9PT0gbnVsbCkge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVwby5jdXJyZW50KTtcclxuICAgICAgfSBlbHNlIHtcclxuICAgICAgICByZXBvLmxhdGVzdCA9IG1vc3RSZWNlbnRWZXJzaW9uO1xyXG4gICAgICAgIGlmIChzZW12ZXIuZ3QobW9zdFJlY2VudFZlcnNpb24sIHJlcG8uY3VycmVudCkpIHtcclxuICAgICAgICAgIGNvbnN0IHVwZGF0ZSA9ICgpID0+IGZvcmNlID8gUHJvbWlzZS5yZXNvbHZlKCkgOiBub3RpZnlVcGRhdGUoYXBpLCByZXBvKTtcclxuICAgICAgICAgIHJldHVybiB1cGRhdGUoKVxyXG4gICAgICAgICAgICAudGhlbigoKSA9PiBzdGFydERvd25sb2FkKGFwaSwgcmVwbywgZG93bmxvYWRMaW5rKSlcclxuICAgICAgICAgICAgLnRoZW4oKCkgPT4gUHJvbWlzZS5yZXNvbHZlKG1vc3RSZWNlbnRWZXJzaW9uKSk7XHJcbiAgICAgICAgfSBlbHNlIHtcclxuICAgICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVwby5jdXJyZW50KTtcclxuICAgICAgICB9XHJcbiAgICAgIH1cclxuICAgIH0pLmNhdGNoKGVyciA9PiB7XHJcbiAgICAgIGlmIChlcnIgaW5zdGFuY2VvZiB1dGlsLlVzZXJDYW5jZWxlZCB8fCBlcnIgaW5zdGFuY2VvZiB1dGlsLlByb2Nlc3NDYW5jZWxlZCkge1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUocmVwby5jdXJyZW50KTtcclxuICAgICAgfVxyXG5cclxuICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignVW5hYmxlIHRvIHVwZGF0ZSBmcm9tIEdpdGh1YiByZXBvJyxcclxuICAgICAgICB7IC4uLmVyciwgZGV0YWlsczogcmVwby5uYW1lIH0pO1xyXG4gICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG8uY3VycmVudCk7XHJcbiAgICB9KTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIGRvd25sb2FkQ29uZmlnTWFuYWdlcihhcGk6IHR5cGVzLklFeHRlbnNpb25BcGkpOiBQcm9taXNlPHZvaWQ+IHtcclxuICBjb25zdCByZXBvID0gUkVQT1NbJ2NvbmZpZ01hbmFnZXInXTtcclxuICByZXBvLmN1cnJlbnQgPSBnZXRDdXJyZW50VmVyc2lvbihhcGksIHJlcG8pO1xyXG4gIGlmIChyZXBvLmN1cnJlbnQgIT09ICcwLjAuMCcpIHtcclxuICAgIHJldHVybjtcclxuICB9XHJcbiAgcmV0dXJuIGdldExhdGVzdFJlbGVhc2VzKGFwaSwgcmVwbylcclxuICAgIC50aGVuKGFzeW5jIGN1cnJlbnRSZWxlYXNlcyA9PiB7XHJcbiAgICAgIGNvbnN0IGRvd25sb2FkTGluayA9IGF3YWl0IHJlc29sdmVEb3dubG9hZExpbmsocmVwbywgY3VycmVudFJlbGVhc2VzKTtcclxuICAgICAgcmV0dXJuIHN0YXJ0RG93bmxvYWQoYXBpLCByZXBvLCBkb3dubG9hZExpbmspO1xyXG4gICAgfSlcclxuICAgIC5jYXRjaChlcnIgPT4ge1xyXG4gICAgICBpZiAoZXJyIGluc3RhbmNlb2YgdXRpbC5Vc2VyQ2FuY2VsZWQgfHwgZXJyIGluc3RhbmNlb2YgdXRpbC5Qcm9jZXNzQ2FuY2VsZWQpIHtcclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgIH0gZWxzZSB7XHJcbiAgICAgICAgYXBpLnNob3dFcnJvck5vdGlmaWNhdGlvbignVW5hYmxlIHRvIGRvd25sb2FkL2luc3RhbGwgcmVwbycsXHJcbiAgICAgICAgICB7IC4uLmVyciwgZGV0YWlsczogcmVwby5uYW1lIH0pO1xyXG4gICAgICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICAgICAgfVxyXG4gICAgfSk7XHJcbn1cclxuIl19