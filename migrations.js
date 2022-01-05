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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrate103 = exports.migrate104 = exports.migrate106 = exports.migrate109 = exports.migrate1013 = exports.migrate1015 = void 0;
const bluebird_1 = __importDefault(require("bluebird"));
const path_1 = __importDefault(require("path"));
const semver_1 = __importDefault(require("semver"));
const vortex_api_1 = require("vortex-api");
const payloadDeployer = __importStar(require("./payloadDeployer"));
const common_1 = require("./common");
const WORLDS_PATH = path_1.default.resolve(vortex_api_1.util.getVortexPath('appData'), '..', 'LocalLow', 'IronGate', 'Valheim', 'vortex-worlds');
function migrate1015(api, oldVersion) {
    if (semver_1.default.gte(oldVersion, '1.0.15')) {
        return bluebird_1.default.resolve();
    }
    const state = api.getState();
    const stagingFolder = vortex_api_1.selectors.installPathForGame(state, common_1.GAME_ID);
    const discoveryPath = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', common_1.GAME_ID, 'path'], undefined);
    if (discoveryPath === undefined) {
        return bluebird_1.default.resolve();
    }
    const relevantModTypes = ['', 'bepinex-root-mod'];
    const isConfManager = (mod) => {
        if (!relevantModTypes.includes(mod.type)) {
            return bluebird_1.default.resolve(false);
        }
        const modPath = path_1.default.join(stagingFolder, mod.installationPath);
        return (0, common_1.walkDirPath)(modPath).then((entries) => {
            const confMan = entries.find(entry => path_1.default.basename(entry.filePath.toLowerCase()) === common_1.CONF_MANAGER);
            return confMan !== undefined ? bluebird_1.default.resolve(true) : bluebird_1.default.resolve(false);
        })
            .catch(err => bluebird_1.default.resolve(false));
    };
    const purge = () => bluebird_1.default.resolve();
    const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', common_1.GAME_ID], {});
    return purge().then(() => bluebird_1.default.reduce(Object.values(mods), (accum, iter) => {
        return isConfManager(iter)
            .then(res => {
            if (res) {
                api.store.dispatch(vortex_api_1.actions.setModType(common_1.GAME_ID, iter.id, 'val-conf-man'));
            }
            return bluebird_1.default.resolve();
        });
    }));
}
exports.migrate1015 = migrate1015;
function migrate1013(api, oldVersion) {
    if (semver_1.default.gte(oldVersion, '1.0.13')) {
        return bluebird_1.default.resolve();
    }
    const t = api.translate;
    const state = api.getState();
    const discoveryPath = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', common_1.GAME_ID, 'path'], undefined);
    if (discoveryPath === undefined) {
        return bluebird_1.default.resolve();
    }
    api.dismissNotification('val-103-conf-man-added');
    api.sendNotification({
        message: 'Ingame Mod Configuration Manager Removed',
        type: 'warning',
        allowSuppress: false,
        actions: [
            {
                title: 'More',
                action: (dismiss) => {
                    api.showDialog('info', 'Ingame Mod Configuration Manager Removed', {
                        bbcode: t('As you may be aware - Vortex used to have the BepInEx Configuration Manager '
                            + 'plugin included in its BepInEx package. This plugin has now been removed from the package '
                            + 'and is now offered as a toggleable mod on the mods page due to servers automatically kicking '
                            + 'players with this plugin installed.'),
                    }, [{ label: 'Close', action: () => dismiss(), default: true }]);
                },
            },
        ],
    });
    return api.awaitUI()
        .then(() => {
        const lastActive = vortex_api_1.selectors.lastActiveProfileForGame(state, common_1.GAME_ID);
        return payloadDeployer.onDidPurge(api, lastActive);
    });
}
exports.migrate1013 = migrate1013;
function migrate109(api, oldVersion) {
    if (semver_1.default.gte(oldVersion, '1.0.9')) {
        return bluebird_1.default.resolve();
    }
    const state = api.getState();
    const discoveryPath = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', common_1.GAME_ID, 'path'], undefined);
    if (discoveryPath === undefined) {
        return bluebird_1.default.resolve();
    }
    const profiles = vortex_api_1.util.getSafe(state, ['persistent', 'profiles'], {});
    const profileIds = Object.keys(profiles).filter(id => profiles[id].gameId === common_1.GAME_ID);
    if (profileIds.length === 0) {
        return bluebird_1.default.resolve();
    }
    const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', common_1.GAME_ID], {});
    const unstrippedMods = Object.keys(mods).filter(id => {
        var _a;
        return ((_a = mods[id]) === null || _a === void 0 ? void 0 : _a.type) === 'unstripped-assemblies'
            && vortex_api_1.util.getSafe(state, ['persistent', 'mods', common_1.GAME_ID, id, 'attributes', 'modId'], undefined) === 15;
    });
    if (unstrippedMods.length > 0) {
        return api.awaitUI()
            .then(() => {
            for (const profId of profileIds) {
                for (const modId of unstrippedMods) {
                    api.store.dispatch(vortex_api_1.actions.setModEnabled(profId, modId, false));
                }
            }
            api.store.dispatch(vortex_api_1.actions.setDeploymentNecessary(common_1.GAME_ID, true));
        });
    }
    return bluebird_1.default.resolve();
}
exports.migrate109 = migrate109;
function migrate106(api, oldVersion) {
    if (semver_1.default.gte(oldVersion, '1.0.6')) {
        return bluebird_1.default.resolve();
    }
    const state = api.getState();
    const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', common_1.GAME_ID], {});
    const worldMods = Object.keys(mods).filter(key => { var _a; return ((_a = mods[key]) === null || _a === void 0 ? void 0 : _a.type) === 'better-continents-mod'; });
    if (worldMods.length > 0) {
        return api.awaitUI()
            .then(() => vortex_api_1.fs.ensureDirWritableAsync(WORLDS_PATH))
            .then(() => api.emitAndAwait('purge-mods-in-path', common_1.GAME_ID, 'better-continents-mod', WORLDS_PATH));
    }
    return bluebird_1.default.resolve();
}
exports.migrate106 = migrate106;
function migrate104(api, oldVersion) {
    if (semver_1.default.gte(oldVersion, '1.0.4')) {
        return bluebird_1.default.resolve();
    }
    const state = api.getState();
    const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', common_1.GAME_ID], {});
    const coreLibModId = Object.keys(mods).find(key => vortex_api_1.util.getSafe(mods[key], ['attributes', 'IsCoreLibMod'], false));
    if (coreLibModId !== undefined) {
        api.store.dispatch(vortex_api_1.actions.setModAttribute(common_1.GAME_ID, coreLibModId, 'CoreLibType', 'core_lib'));
    }
    return bluebird_1.default.resolve();
}
exports.migrate104 = migrate104;
function migrate103(api, oldVersion) {
    if (semver_1.default.gte(oldVersion, '1.0.3')) {
        return bluebird_1.default.resolve();
    }
    const t = api.translate;
    api.sendNotification({
        message: 'Ingame Mod Configuration Manager added.',
        id: 'val-103-conf-man-added',
        type: 'info',
        allowSuppress: false,
        actions: [
            {
                title: 'More',
                action: (dismiss) => {
                    api.showDialog('info', 'Ingame Mod Configuration Manager added', {
                        bbcode: t('Some (but not all) Valheim mods come with configuration files allowing '
                            + 'you to tweak mod specific settings. Once you\'ve installed one or several '
                            + 'such mods, you can bring up the mod configuration manager ingame by pressing F1.'
                            + '[br][/br][br][/br]'
                            + 'Any settings you change ingame should be applied immediately and will be saved '
                            + 'to the mods\' config files.'),
                    }, [{ label: 'Close', action: () => dismiss(), default: true }]);
                },
            },
        ],
    });
}
exports.migrate103 = migrate103;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlncmF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1pZ3JhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHdEQUErQjtBQUMvQixnREFBd0I7QUFDeEIsb0RBQTRCO0FBQzVCLDJDQUFzRTtBQUV0RSxtRUFBcUQ7QUFFckQscUNBQThEO0FBRTlELE1BQU0sV0FBVyxHQUFHLGNBQUksQ0FBQyxPQUFPLENBQUMsaUJBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLEVBQzVELElBQUksRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxlQUFlLENBQUMsQ0FBQztBQUU1RCxTQUFnQixXQUFXLENBQUMsR0FBd0IsRUFBRSxVQUFrQjtJQUV0RSxJQUFJLGdCQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUNwQyxPQUFPLGtCQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDMUI7SUFFRCxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDN0IsTUFBTSxhQUFhLEdBQUcsc0JBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUUsZ0JBQU8sQ0FBQyxDQUFDO0lBQ25FLE1BQU0sYUFBYSxHQUFHLGlCQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFDdEMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxnQkFBTyxFQUFFLE1BQU0sQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3RFLElBQUksYUFBYSxLQUFLLFNBQVMsRUFBRTtRQUMvQixPQUFPLGtCQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDMUI7SUFFRCxNQUFNLGdCQUFnQixHQUFHLENBQUMsRUFBRSxFQUFFLGtCQUFrQixDQUFDLENBQUM7SUFDbEQsTUFBTSxhQUFhLEdBQUcsQ0FBQyxHQUFlLEVBQUUsRUFBRTtRQUN4QyxJQUFJ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QUFVLENBQUMsR0FBd0IsRUFBRSxVQUFrQjtJQUNyRSxJQUFJLGdCQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsRUFBRTtRQUNuQyxPQUFPLGtCQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDMUI7SUFFRCxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO0lBRXhCLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQztRQUNuQixPQUFPLEVBQUUseUNBQXlDO1FBQ2xELEVBQUUsRUFBRSx3QkFBd0I7UUFDNUIsSUFBSSxFQUFFLE1BQU07UUFDWixhQUFhLEVBQUUsS0FBSztRQUNwQixPQUFPLEVBQUU7WUFDUDtnQkFDRSxLQUFLLEVBQUUsTUFBTTtnQkFDYixNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtvQkFDbEIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsd0NBQXdDLEVBQy9EO3dCQUNFLE1BQU0sRUFBRSxDQUFDLENBQUMseUVBQXlFOzhCQUMvRSw0RUFBNEU7OEJBQzVFLGtGQUFrRjs4QkFDbEYsb0JBQW9COzhCQUNwQixpRkFBaUY7OEJBQ2pGLDZCQUE2QixDQUFDO3FCQUNuQyxFQUNELENBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRSxPQUFPLEVBQUUsSUFBSSxFQUFFLENBQUUsQ0FBQyxDQUFDO2dCQUNsRSxDQUFDO2FBQ0Y7U0FDRjtLQUNGLENBQUMsQ0FBQztBQUNMLENBQUM7QUE5QkQsZ0NBOEJDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IFByb21pc2UgZnJvbSAnYmx1ZWJpcmQnO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xyXG5pbXBvcnQgeyBhY3Rpb25zLCBmcywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5pbXBvcnQgKiBhcyBwYXlsb2FkRGVwbG95ZXIgZnJvbSAnLi9wYXlsb2FkRGVwbG95ZXInO1xyXG5cclxuaW1wb3J0IHsgQ09ORl9NQU5BR0VSLCBHQU1FX0lELCB3YWxrRGlyUGF0aCB9IGZyb20gJy4vY29tbW9uJztcclxuXHJcbmNvbnN0IFdPUkxEU19QQVRIID0gcGF0aC5yZXNvbHZlKHV0aWwuZ2V0Vm9ydGV4UGF0aCgnYXBwRGF0YScpLFxyXG4gICcuLicsICdMb2NhbExvdycsICdJcm9uR2F0ZScsICdWYWxoZWltJywgJ3ZvcnRleC13b3JsZHMnKTtcclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBtaWdyYXRlMTAxNShhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG9sZFZlcnNpb246IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xyXG4gIC8vIHlldCBhbm90aGVyIGJsb29keSBtaWdyYXRpb24uLi4uIHVnaCFcclxuICBpZiAoc2VtdmVyLmd0ZShvbGRWZXJzaW9uLCAnMS4wLjE1JykpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3Qgc3RhZ2luZ0ZvbGRlciA9IHNlbGVjdG9ycy5pbnN0YWxsUGF0aEZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gIGNvbnN0IGRpc2NvdmVyeVBhdGggPSB1dGlsLmdldFNhZmUoc3RhdGUsXHJcbiAgICBbJ3NldHRpbmdzJywgJ2dhbWVNb2RlJywgJ2Rpc2NvdmVyZWQnLCBHQU1FX0lELCAncGF0aCddLCB1bmRlZmluZWQpO1xyXG4gIGlmIChkaXNjb3ZlcnlQYXRoID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHJlbGV2YW50TW9kVHlwZXMgPSBbJycsICdiZXBpbmV4LXJvb3QtbW9kJ107XHJcbiAgY29uc3QgaXNDb25mTWFuYWdlciA9IChtb2Q6IHR5cGVzLklNb2QpID0+IHtcclxuICAgIGlmICghcmVsZXZhbnRNb2RUeXBlcy5pbmNsdWRlcyhtb2QudHlwZSkpIHtcclxuICAgICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZShmYWxzZSk7XHJcbiAgICB9XHJcblxyXG4gICAgY29uc3QgbW9kUGF0aCA9IHBhdGguam9pbihzdGFnaW5nRm9sZGVyLCBtb2QuaW5zdGFsbGF0aW9uUGF0aCk7XHJcbiAgICByZXR1cm4gd2Fsa0RpclBhdGgobW9kUGF0aCkudGhlbigoZW50cmllcykgPT4ge1xyXG4gICAgICBjb25zdCBjb25mTWFuID0gZW50cmllcy5maW5kKGVudHJ5ID0+XHJcbiAgICAgICAgcGF0aC5iYXNlbmFtZShlbnRyeS5maWxlUGF0aC50b0xvd2VyQ2FzZSgpKSA9PT0gQ09ORl9NQU5BR0VSKTtcclxuICAgICAgcmV0dXJuIGNvbmZNYW4gIT09IHVuZGVmaW5lZCA/IFByb21pc2UucmVzb2x2ZSh0cnVlKSA6IFByb21pc2UucmVzb2x2ZShmYWxzZSk7XHJcbiAgICB9KVxyXG4gICAgLmNhdGNoKGVyciA9PiBQcm9taXNlLnJlc29sdmUoZmFsc2UpKTtcclxuICB9O1xyXG5cclxuICBjb25zdCBwdXJnZSA9ICgpID0+IFByb21pc2UucmVzb2x2ZSgpO1xyXG4gIC8vIHsgRm9yIHNvbWUgcmVhc29uIHRoZSBwYXRoIHB1cmdlIGZhaWxzIC0gdGhlIG1hbmlmZXN0IGdldHMgY2xlYXJlZCwgYnV0IHRoZVxyXG4gIC8vICAgbW9kIGZpbGVzIGFyZSBsZWZ0IGJlaGluZCAtIG5lZWQgdG8gaW52ZXN0aWdhdGUgdGhpcyBpc3N1ZSBzZXBhcmF0ZWx5LlxyXG4gIC8vICAgLy8gQ2xlYW4gdXAgYmVmb3JlIHRoZSBtYWRuZXNzXHJcbiAgLy8gICByZXR1cm4gYXBpLmF3YWl0VUkoKVxyXG4gIC8vICAgICAudGhlbigoKSA9PiB7XHJcbiAgLy8gICAgICAgY29uc3QgbW9kUGF0aHMgPSB7XHJcbiAgLy8gICAgICAgICBbJyddOiBwYXRoLmpvaW4oZGlzY292ZXJ5UGF0aCwgJ0JlcEluRXgnLCAncGx1Z2lucycpLFxyXG4gIC8vICAgICAgICAgWydiZXBpbmV4LXJvb3QtbW9kJ106IHBhdGguam9pbihkaXNjb3ZlcnlQYXRoLCAnQmVwSW5FeCcpLFxyXG4gIC8vICAgICAgIH07XHJcbiAgLy8gICAgICAgcmV0dXJuIFByb21pc2UubWFwKHJlbGV2YW50TW9kVHlwZXMsIG1vZFR5cGUgPT4ge1xyXG4gIC8vICAgICAgICAgcmV0dXJuIGZzLmVuc3VyZURpcldyaXRhYmxlQXN5bmMobW9kUGF0aHNbbW9kVHlwZV0pXHJcbiAgLy8gICAgICAgICAgIC50aGVuKCgpID0+IGFwaS5lbWl0QW5kQXdhaXQoJ3B1cmdlLW1vZHMtaW4tcGF0aCcsXHJcbiAgLy8gICAgICAgICAgICAgR0FNRV9JRCwgbW9kVHlwZSwgbW9kUGF0aHNbbW9kVHlwZV0pKTtcclxuICAvLyAgICAgfSk7XHJcbiAgLy8gICB9KVxyXG4gIC8vICAgLnRoZW4oKCkgPT4gYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0RGVwbG95bWVudE5lY2Vzc2FyeShHQU1FX0lELCB0cnVlKSkpO1xyXG4gIC8vIH07XHJcblxyXG4gIGNvbnN0IG1vZHM6IHsgW21vZElkOiBzdHJpbmddOiB0eXBlcy5JTW9kIH0gPVxyXG4gICAgdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcbiAgcmV0dXJuIHB1cmdlKCkudGhlbigoKSA9PiBQcm9taXNlLnJlZHVjZShPYmplY3QudmFsdWVzKG1vZHMpLCAoYWNjdW0sIGl0ZXIpID0+IHtcclxuICAgIHJldHVybiAoaXNDb25mTWFuYWdlcihpdGVyKSBhcyBhbnkpXHJcbiAgICAgIC50aGVuKHJlcyA9PiB7XHJcbiAgICAgICAgaWYgKHJlcykge1xyXG4gICAgICAgICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0TW9kVHlwZShHQU1FX0lELCBpdGVyLmlkLCAndmFsLWNvbmYtbWFuJykpO1xyXG4gICAgICAgIH1cclxuICAgICAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgICAgIH0pO1xyXG4gIH0pKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG1pZ3JhdGUxMDEzKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgb2xkVmVyc2lvbjogc3RyaW5nKSB7XHJcbiAgaWYgKHNlbXZlci5ndGUob2xkVmVyc2lvbiwgJzEuMC4xMycpKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCB0ID0gYXBpLnRyYW5zbGF0ZTtcclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IGRpc2NvdmVyeVBhdGggPSB1dGlsLmdldFNhZmUoc3RhdGUsXHJcbiAgICBbJ3NldHRpbmdzJywgJ2dhbWVNb2RlJywgJ2Rpc2NvdmVyZWQnLCBHQU1FX0lELCAncGF0aCddLCB1bmRlZmluZWQpO1xyXG4gIGlmIChkaXNjb3ZlcnlQYXRoID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcbiAgYXBpLmRpc21pc3NOb3RpZmljYXRpb24oJ3ZhbC0xMDMtY29uZi1tYW4tYWRkZWQnKTtcclxuICBhcGkuc2VuZE5vdGlmaWNhdGlvbih7XHJcbiAgICBtZXNzYWdlOiAnSW5nYW1lIE1vZCBDb25maWd1cmF0aW9uIE1hbmFnZXIgUmVtb3ZlZCcsXHJcbiAgICB0eXBlOiAnd2FybmluZycsXHJcbiAgICBhbGxvd1N1cHByZXNzOiBmYWxzZSxcclxuICAgIGFjdGlvbnM6IFtcclxuICAgICAge1xyXG4gICAgICAgIHRpdGxlOiAnTW9yZScsXHJcbiAgICAgICAgYWN0aW9uOiAoZGlzbWlzcykgPT4ge1xyXG4gICAgICAgICAgYXBpLnNob3dEaWFsb2coJ2luZm8nLCAnSW5nYW1lIE1vZCBDb25maWd1cmF0aW9uIE1hbmFnZXIgUmVtb3ZlZCcsXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIGJiY29kZTogdCgnQXMgeW91IG1heSBiZSBhd2FyZSAtIFZvcnRleCB1c2VkIHRvIGhhdmUgdGhlIEJlcEluRXggQ29uZmlndXJhdGlvbiBNYW5hZ2VyICdcclxuICAgICAgICAgICAgICArICdwbHVnaW4gaW5jbHVkZWQgaW4gaXRzIEJlcEluRXggcGFja2FnZS4gVGhpcyBwbHVnaW4gaGFzIG5vdyBiZWVuIHJlbW92ZWQgZnJvbSB0aGUgcGFja2FnZSAnXHJcbiAgICAgICAgICAgICAgKyAnYW5kIGlzIG5vdyBvZmZlcmVkIGFzIGEgdG9nZ2xlYWJsZSBtb2Qgb24gdGhlIG1vZHMgcGFnZSBkdWUgdG8gc2VydmVycyBhdXRvbWF0aWNhbGx5IGtpY2tpbmcgJ1xyXG4gICAgICAgICAgICAgICsgJ3BsYXllcnMgd2l0aCB0aGlzIHBsdWdpbiBpbnN0YWxsZWQuJyksXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgWyB7IGxhYmVsOiAnQ2xvc2UnLCBhY3Rpb246ICgpID0+IGRpc21pc3MoKSwgZGVmYXVsdDogdHJ1ZSB9IF0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICBdLFxyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gYXBpLmF3YWl0VUkoKVxyXG4gICAgLnRoZW4oKCkgPT4ge1xyXG4gICAgICBjb25zdCBsYXN0QWN0aXZlID0gc2VsZWN0b3JzLmxhc3RBY3RpdmVQcm9maWxlRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgICAgIHJldHVybiBwYXlsb2FkRGVwbG95ZXIub25EaWRQdXJnZShhcGksIGxhc3RBY3RpdmUpO1xyXG4gICAgfSk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBtaWdyYXRlMTA5KGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgb2xkVmVyc2lvbjogc3RyaW5nKSB7XHJcbiAgaWYgKHNlbXZlci5ndGUob2xkVmVyc2lvbiwgJzEuMC45JykpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgZGlzY292ZXJ5UGF0aCA9IHV0aWwuZ2V0U2FmZShzdGF0ZSxcclxuICAgIFsnc2V0dGluZ3MnLCAnZ2FtZU1vZGUnLCAnZGlzY292ZXJlZCcsIEdBTUVfSUQsICdwYXRoJ10sIHVuZGVmaW5lZCk7XHJcbiAgaWYgKGRpc2NvdmVyeVBhdGggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgcHJvZmlsZXM6IHsgW3Byb2ZpbGVJZDogc3RyaW5nXTogdHlwZXMuSVByb2ZpbGUgfSA9IHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydwZXJzaXN0ZW50JywgJ3Byb2ZpbGVzJ10sIHt9KTtcclxuICBjb25zdCBwcm9maWxlSWRzID0gT2JqZWN0LmtleXMocHJvZmlsZXMpLmZpbHRlcihpZCA9PiBwcm9maWxlc1tpZF0uZ2FtZUlkID09PSBHQU1FX0lEKTtcclxuICBpZiAocHJvZmlsZUlkcy5sZW5ndGggPT09IDApIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IG1vZHM6IHsgW21vZElkOiBzdHJpbmddOiB0eXBlcy5JTW9kIH0gPVxyXG4gICAgdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcbiAgY29uc3QgdW5zdHJpcHBlZE1vZHMgPSBPYmplY3Qua2V5cyhtb2RzKS5maWx0ZXIoaWQgPT4gbW9kc1tpZF0/LnR5cGUgPT09ICd1bnN0cmlwcGVkLWFzc2VtYmxpZXMnXHJcbiAgICAmJiB1dGlsLmdldFNhZmUoc3RhdGUsXHJcbiAgICAgIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRCwgaWQsICdhdHRyaWJ1dGVzJywgJ21vZElkJ10sIHVuZGVmaW5lZCkgPT09IDE1KTtcclxuICBpZiAodW5zdHJpcHBlZE1vZHMubGVuZ3RoID4gMCkge1xyXG4gICAgcmV0dXJuIGFwaS5hd2FpdFVJKClcclxuICAgICAgLnRoZW4oKCkgPT4ge1xyXG4gICAgICAgIGZvciAoY29uc3QgcHJvZklkIG9mIHByb2ZpbGVJZHMpIHtcclxuICAgICAgICAgIGZvciAoY29uc3QgbW9kSWQgb2YgdW5zdHJpcHBlZE1vZHMpIHtcclxuICAgICAgICAgICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0TW9kRW5hYmxlZChwcm9mSWQsIG1vZElkLCBmYWxzZSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zZXREZXBsb3ltZW50TmVjZXNzYXJ5KEdBTUVfSUQsIHRydWUpKTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBtaWdyYXRlMTA2KGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgb2xkVmVyc2lvbjogc3RyaW5nKSB7XHJcbiAgaWYgKHNlbXZlci5ndGUob2xkVmVyc2lvbiwgJzEuMC42JykpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCB3b3JsZE1vZHMgPSBPYmplY3Qua2V5cyhtb2RzKS5maWx0ZXIoa2V5ID0+IG1vZHNba2V5XT8udHlwZSA9PT0gJ2JldHRlci1jb250aW5lbnRzLW1vZCcpO1xyXG4gIGlmICh3b3JsZE1vZHMubGVuZ3RoID4gMCkge1xyXG4gICAgcmV0dXJuIGFwaS5hd2FpdFVJKClcclxuICAgICAgLnRoZW4oKCkgPT4gZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhXT1JMRFNfUEFUSCkpXHJcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbWF4LWxpbmUtbGVuZ3RoXHJcbiAgICAgIC50aGVuKCgpID0+IGFwaS5lbWl0QW5kQXdhaXQoJ3B1cmdlLW1vZHMtaW4tcGF0aCcsIEdBTUVfSUQsICdiZXR0ZXItY29udGluZW50cy1tb2QnLCBXT1JMRFNfUEFUSCkpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWlncmF0ZTEwNChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG9sZFZlcnNpb246IHN0cmluZykge1xyXG4gIGlmIChzZW12ZXIuZ3RlKG9sZFZlcnNpb24sICcxLjAuNCcpKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IG1vZHM6IHsgW21vZElkOiBzdHJpbmddOiB0eXBlcy5JTW9kIH0gPVxyXG4gICAgdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcbiAgY29uc3QgY29yZUxpYk1vZElkID0gT2JqZWN0LmtleXMobW9kcykuZmluZChrZXkgPT5cclxuICAgIHV0aWwuZ2V0U2FmZShtb2RzW2tleV0sIFsnYXR0cmlidXRlcycsICdJc0NvcmVMaWJNb2QnXSwgZmFsc2UpKTtcclxuXHJcbiAgaWYgKGNvcmVMaWJNb2RJZCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zZXRNb2RBdHRyaWJ1dGUoR0FNRV9JRCwgY29yZUxpYk1vZElkLCAnQ29yZUxpYlR5cGUnLCAnY29yZV9saWInKSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBtaWdyYXRlMTAzKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgb2xkVmVyc2lvbjogc3RyaW5nKSB7XHJcbiAgaWYgKHNlbXZlci5ndGUob2xkVmVyc2lvbiwgJzEuMC4zJykpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHQgPSBhcGkudHJhbnNsYXRlO1xyXG5cclxuICBhcGkuc2VuZE5vdGlmaWNhdGlvbih7XHJcbiAgICBtZXNzYWdlOiAnSW5nYW1lIE1vZCBDb25maWd1cmF0aW9uIE1hbmFnZXIgYWRkZWQuJyxcclxuICAgIGlkOiAndmFsLTEwMy1jb25mLW1hbi1hZGRlZCcsXHJcbiAgICB0eXBlOiAnaW5mbycsXHJcbiAgICBhbGxvd1N1cHByZXNzOiBmYWxzZSxcclxuICAgIGFjdGlvbnM6IFtcclxuICAgICAge1xyXG4gICAgICAgIHRpdGxlOiAnTW9yZScsXHJcbiAgICAgICAgYWN0aW9uOiAoZGlzbWlzcykgPT4ge1xyXG4gICAgICAgICAgYXBpLnNob3dEaWFsb2coJ2luZm8nLCAnSW5nYW1lIE1vZCBDb25maWd1cmF0aW9uIE1hbmFnZXIgYWRkZWQnLFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBiYmNvZGU6IHQoJ1NvbWUgKGJ1dCBub3QgYWxsKSBWYWxoZWltIG1vZHMgY29tZSB3aXRoIGNvbmZpZ3VyYXRpb24gZmlsZXMgYWxsb3dpbmcgJ1xyXG4gICAgICAgICAgICAgICsgJ3lvdSB0byB0d2VhayBtb2Qgc3BlY2lmaWMgc2V0dGluZ3MuIE9uY2UgeW91XFwndmUgaW5zdGFsbGVkIG9uZSBvciBzZXZlcmFsICdcclxuICAgICAgICAgICAgICArICdzdWNoIG1vZHMsIHlvdSBjYW4gYnJpbmcgdXAgdGhlIG1vZCBjb25maWd1cmF0aW9uIG1hbmFnZXIgaW5nYW1lIGJ5IHByZXNzaW5nIEYxLidcclxuICAgICAgICAgICAgICArICdbYnJdWy9icl1bYnJdWy9icl0nXHJcbiAgICAgICAgICAgICAgKyAnQW55IHNldHRpbmdzIHlvdSBjaGFuZ2UgaW5nYW1lIHNob3VsZCBiZSBhcHBsaWVkIGltbWVkaWF0ZWx5IGFuZCB3aWxsIGJlIHNhdmVkICdcclxuICAgICAgICAgICAgICArICd0byB0aGUgbW9kc1xcJyBjb25maWcgZmlsZXMuJyksXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgWyB7IGxhYmVsOiAnQ2xvc2UnLCBhY3Rpb246ICgpID0+IGRpc21pc3MoKSwgZGVmYXVsdDogdHJ1ZSB9IF0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICBdLFxyXG4gIH0pO1xyXG59XHJcbiJdfQ==