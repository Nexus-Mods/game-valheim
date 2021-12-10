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
exports.migrate103 = exports.migrate104 = exports.migrate106 = exports.migrate109 = exports.migrate1013 = void 0;
const bluebird_1 = __importDefault(require("bluebird"));
const path_1 = __importDefault(require("path"));
const semver_1 = __importDefault(require("semver"));
const vortex_api_1 = require("vortex-api");
const payloadDeployer = __importStar(require("./payloadDeployer"));
const common_1 = require("./common");
const WORLDS_PATH = path_1.default.resolve(vortex_api_1.util.getVortexPath('appData'), '..', 'LocalLow', 'IronGate', 'Valheim', 'vortex-worlds');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlncmF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1pZ3JhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHdEQUErQjtBQUMvQixnREFBd0I7QUFDeEIsb0RBQTRCO0FBQzVCLDJDQUFzRTtBQUV0RSxtRUFBcUQ7QUFFckQscUNBQW1DO0FBRW5DLE1BQU0sV0FBVyxHQUFHLGNBQUksQ0FBQyxPQUFPLENBQUMsaUJBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxDQUFDLEVBQzVELElBQUksRUFBRSxVQUFVLEVBQUUsVUFBVSxFQUFFLFNBQVMsRUFBRSxlQUFlLENBQUMsQ0FBQztBQUU1RCxTQUFnQixXQUFXLENBQUMsR0FBd0IsRUFBRSxVQUFrQjtJQUN0RSxJQUFJLGdCQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUMsRUFBRTtRQUNwQyxPQUFPLGtCQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDMUI7SUFFRCxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO0lBQ3hCLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUM3QixNQUFNLGFBQWEsR0FBRyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQ3RDLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsZ0JBQU8sRUFBRSxNQUFNLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUN0RSxJQUFJLGFBQWEsS0FBSyxTQUFTLEVBQUU7UUFDL0IsT0FBTyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQzFCO0lBQ0QsR0FBRyxDQUFDLGdCQUFnQixDQUFDO1FBQ25CLE9BQU8sRUFBRSwwQ0FBMEM7UUFDbkQsSUFBSSxFQUFFLFNBQVM7UUFDZixhQUFhLEVBQUUsS0FBSztRQUNwQixPQUFPLEVBQUU7WUFDUDtnQkFDRSxLQUFLLEVBQUUsTUFBTTtnQkFDYixNQUFNLEVBQUUsQ0FBQyxPQUFPLEVBQUUsRUFBRTtvQkFDbEIsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLEVBQUUsMENBQTBDLEVBQ2pFO3dCQUNFLE1BQU0sRUFBRSxDQUFDLENBQUMsOEVBQThFOzhCQUNwRiw0RkFBNEY7OEJBQzVGLCtGQUErRjs4QkFDL0YscUNBQXFDLENBQUM7cUJBQzNDLEVBQ0QsQ0FBRSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBRSxDQUFDLENBQUM7Z0JBQ2xFLENBQUM7YUFDRjtTQUNGO0tBQ0YsQ0FBQyxDQUFDO0lBRUgsT0FBTyxHQUFHLENBQUMsT0FBTyxFQUFFO1NBQ2pCLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDVCxNQUFNLFVBQVUsR0FBRyxzQkFBUyxDQUFDLHdCQUF3QixDQUFDLEtBQUssRUFBRSxnQkFBTyxDQUFDLENBQUM7UUFDdEUsT0FBTyxlQUFlLENBQUMsVUFBVSxDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQztJQUNyRCxDQUFDLENBQUMsQ0FBQztBQUNQLENBQUM7QUF0Q0Qsa0NBc0NDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLEdBQXdCLEVBQUUsVUFBa0I7SUFDckUsSUFBSSxnQkFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQUU7UUFDbkMsT0FBTyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQzFCO0lBRUQsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQzdCLE1BQU0sYUFBYSxHQUFHLGlCQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFDdEMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFlBQVksRUFBRSxnQkFBTyxFQUFFLE1BQU0sQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ3RFLElBQUksYUFBYSxLQUFLLFNBQVMsRUFBRTtRQUMvQixPQUFPLGtCQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDMUI7SUFFRCxNQUFNLFFBQVEsR0FBNEMsaUJBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsWUFBWSxFQUFFLFVBQVUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzlHLE1BQU0sVUFBVSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLE1BQU0sS0FBSyxnQkFBTyxDQUFDLENBQUM7SUFDdkYsSUFBSSxVQUFVLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtRQUMzQixPQUFPLGtCQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDMUI7SUFFRCxNQUFNLElBQUksR0FDUixpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLGdCQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMzRCxNQUFNLGNBQWMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUMsRUFBRTs7UUFBQyxPQUFBLENBQUEsTUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLDBDQUFFLElBQUksTUFBSyx1QkFBdUI7ZUFDM0YsaUJBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUNuQixDQUFDLFlBQVksRUFBRSxNQUFNLEVBQUUsZ0JBQU8sRUFBRSxFQUFFLEVBQUUsWUFBWSxFQUFFLE9BQU8sQ0FBQyxFQUFFLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQTtLQUFBLENBQUMsQ0FBQztJQUNuRixJQUFJLGNBQWMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQzdCLE9BQU8sR0FBRyxDQUFDLE9BQU8sRUFBRTthQUNqQixJQUFJLENBQUMsR0FBRyxFQUFFO1lBQ1QsS0FBSyxNQUFNLE1BQU0sSUFBSSxVQUFVLEVBQUU7Z0JBQy9CLEtBQUssTUFBTSxLQUFLLElBQUksY0FBYyxFQUFFO29CQUNsQyxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxvQkFBTyxDQUFDLGFBQWEsQ0FBQyxNQUFNLEVBQUUsS0FBSyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7aUJBQ2pFO2FBQ0Y7WUFDRCxHQUFHLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxvQkFBTyxDQUFDLHNCQUFzQixDQUFDLGdCQUFPLEVBQUUsSUFBSSxDQUFDLENBQUMsQ0FBQztRQUNwRSxDQUFDLENBQUMsQ0FBQztLQUNOO0lBRUQsT0FBTyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQzNCLENBQUM7QUFwQ0QsZ0NBb0NDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLEdBQXdCLEVBQUUsVUFBa0I7SUFDckUsSUFBSSxnQkFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQUU7UUFDbkMsT0FBTyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQzFCO0lBRUQsTUFBTSxLQUFLLEdBQUcsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQzdCLE1BQU0sSUFBSSxHQUNSLGlCQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLFlBQVksRUFBRSxNQUFNLEVBQUUsZ0JBQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzNELE1BQU0sU0FBUyxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFdBQUMsT0FBQSxDQUFBLE1BQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQywwQ0FBRSxJQUFJLE1BQUssdUJBQXVCLENBQUEsRUFBQSxDQUFDLENBQUM7SUFDL0YsSUFBSSxTQUFTLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtRQUN4QixPQUFPLEdBQUcsQ0FBQyxPQUFPLEVBQUU7YUFDakIsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLGVBQUUsQ0FBQyxzQkFBc0IsQ0FBQyxXQUFXLENBQUMsQ0FBQzthQUVsRCxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLFlBQVksQ0FBQyxvQkFBb0IsRUFBRSxnQkFBTyxFQUFFLHVCQUF1QixFQUFFLFdBQVcsQ0FBQyxDQUFDLENBQUM7S0FDdEc7SUFFRCxPQUFPLGtCQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDM0IsQ0FBQztBQWpCRCxnQ0FpQkM7QUFFRCxTQUFnQixVQUFVLENBQUMsR0FBd0IsRUFBRSxVQUFrQjtJQUNyRSxJQUFJLGdCQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsRUFBRTtRQUNuQyxPQUFPLGtCQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDMUI7SUFFRCxNQUFNLEtBQUssR0FBRyxHQUFHLENBQUMsUUFBUSxFQUFFLENBQUM7SUFDN0IsTUFBTSxJQUFJLEdBQ1IsaUJBQUksQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLENBQUMsWUFBWSxFQUFFLE1BQU0sRUFBRSxnQkFBTyxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDM0QsTUFBTSxZQUFZLEdBQUcsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FDaEQsaUJBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsWUFBWSxFQUFFLGNBQWMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFFbEUsSUFBSSxZQUFZLEtBQUssU0FBUyxFQUFFO1FBQzlCLEdBQUcsQ0FBQyxLQUFLLENBQUMsUUFBUSxDQUFDLG9CQUFPLENBQUMsZUFBZSxDQUFDLGdCQUFPLEVBQUUsWUFBWSxFQUFFLGFBQWEsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0tBQy9GO0lBRUQsT0FBTyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQzNCLENBQUM7QUFoQkQsZ0NBZ0JDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLEdBQXdCLEVBQUUsVUFBa0I7SUFDckUsSUFBSSxnQkFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQUU7UUFDbkMsT0FBTyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQzFCO0lBRUQsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQztJQUV4QixHQUFHLENBQUMsZ0JBQWdCLENBQUM7UUFDbkIsT0FBTyxFQUFFLHlDQUF5QztRQUNsRCxJQUFJLEVBQUUsTUFBTTtRQUNaLGFBQWEsRUFBRSxLQUFLO1FBQ3BCLE9BQU8sRUFBRTtZQUNQO2dCQUNFLEtBQUssRUFBRSxNQUFNO2dCQUNiLE1BQU0sRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFO29CQUNsQixHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSx3Q0FBd0MsRUFDL0Q7d0JBQ0UsTUFBTSxFQUFFLENBQUMsQ0FBQyx5RUFBeUU7OEJBQy9FLDRFQUE0RTs4QkFDNUUsa0ZBQWtGOzhCQUNsRixvQkFBb0I7OEJBQ3BCLGlGQUFpRjs4QkFDakYsNkJBQTZCLENBQUM7cUJBQ25DLEVBQ0QsQ0FBRSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBRSxDQUFDLENBQUM7Z0JBQ2xFLENBQUM7YUFDRjtTQUNGO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQTdCRCxnQ0E2QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUHJvbWlzZSBmcm9tICdibHVlYmlyZCc7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XHJcbmltcG9ydCB7IGFjdGlvbnMsIGZzLCBsb2csIHNlbGVjdG9ycywgdHlwZXMsIHV0aWwgfSBmcm9tICd2b3J0ZXgtYXBpJztcclxuXHJcbmltcG9ydCAqIGFzIHBheWxvYWREZXBsb3llciBmcm9tICcuL3BheWxvYWREZXBsb3llcic7XHJcblxyXG5pbXBvcnQgeyBHQU1FX0lEIH0gZnJvbSAnLi9jb21tb24nO1xyXG5cclxuY29uc3QgV09STERTX1BBVEggPSBwYXRoLnJlc29sdmUodXRpbC5nZXRWb3J0ZXhQYXRoKCdhcHBEYXRhJyksXHJcbiAgJy4uJywgJ0xvY2FsTG93JywgJ0lyb25HYXRlJywgJ1ZhbGhlaW0nLCAndm9ydGV4LXdvcmxkcycpO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG1pZ3JhdGUxMDEzKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgb2xkVmVyc2lvbjogc3RyaW5nKSB7XHJcbiAgaWYgKHNlbXZlci5ndGUob2xkVmVyc2lvbiwgJzEuMC4xMycpKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCB0ID0gYXBpLnRyYW5zbGF0ZTtcclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IGRpc2NvdmVyeVBhdGggPSB1dGlsLmdldFNhZmUoc3RhdGUsXHJcbiAgICBbJ3NldHRpbmdzJywgJ2dhbWVNb2RlJywgJ2Rpc2NvdmVyZWQnLCBHQU1FX0lELCAncGF0aCddLCB1bmRlZmluZWQpO1xyXG4gIGlmIChkaXNjb3ZlcnlQYXRoID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcbiAgYXBpLnNlbmROb3RpZmljYXRpb24oe1xyXG4gICAgbWVzc2FnZTogJ0luZ2FtZSBNb2QgQ29uZmlndXJhdGlvbiBNYW5hZ2VyIFJlbW92ZWQnLFxyXG4gICAgdHlwZTogJ3dhcm5pbmcnLFxyXG4gICAgYWxsb3dTdXBwcmVzczogZmFsc2UsXHJcbiAgICBhY3Rpb25zOiBbXHJcbiAgICAgIHtcclxuICAgICAgICB0aXRsZTogJ01vcmUnLFxyXG4gICAgICAgIGFjdGlvbjogKGRpc21pc3MpID0+IHtcclxuICAgICAgICAgIGFwaS5zaG93RGlhbG9nKCdpbmZvJywgJ0luZ2FtZSBNb2QgQ29uZmlndXJhdGlvbiBNYW5hZ2VyIFJlbW92ZWQnLFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBiYmNvZGU6IHQoJ0FzIHlvdSBtYXkgYmUgYXdhcmUgLSBWb3J0ZXggdXNlZCB0byBoYXZlIHRoZSBCZXBJbkV4IENvbmZpZ3VyYXRpb24gTWFuYWdlciAnXHJcbiAgICAgICAgICAgICAgKyAncGx1Z2luIGluY2x1ZGVkIGluIGl0cyBCZXBJbkV4IHBhY2thZ2UuIFRoaXMgcGx1Z2luIGhhcyBub3cgYmVlbiByZW1vdmVkIGZyb20gdGhlIHBhY2thZ2UgJ1xyXG4gICAgICAgICAgICAgICsgJ2FuZCBpcyBub3cgb2ZmZXJlZCBhcyBhIHRvZ2dsZWFibGUgbW9kIG9uIHRoZSBtb2RzIHBhZ2UgZHVlIHRvIHNlcnZlcnMgYXV0b21hdGljYWxseSBraWNraW5nICdcclxuICAgICAgICAgICAgICArICdwbGF5ZXJzIHdpdGggdGhpcyBwbHVnaW4gaW5zdGFsbGVkLicpLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIFsgeyBsYWJlbDogJ0Nsb3NlJywgYWN0aW9uOiAoKSA9PiBkaXNtaXNzKCksIGRlZmF1bHQ6IHRydWUgfSBdKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgXSxcclxuICB9KTtcclxuXHJcbiAgcmV0dXJuIGFwaS5hd2FpdFVJKClcclxuICAgIC50aGVuKCgpID0+IHtcclxuICAgICAgY29uc3QgbGFzdEFjdGl2ZSA9IHNlbGVjdG9ycy5sYXN0QWN0aXZlUHJvZmlsZUZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gICAgICByZXR1cm4gcGF5bG9hZERlcGxveWVyLm9uRGlkUHVyZ2UoYXBpLCBsYXN0QWN0aXZlKTtcclxuICAgIH0pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWlncmF0ZTEwOShhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG9sZFZlcnNpb246IHN0cmluZykge1xyXG4gIGlmIChzZW12ZXIuZ3RlKG9sZFZlcnNpb24sICcxLjAuOScpKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IGRpc2NvdmVyeVBhdGggPSB1dGlsLmdldFNhZmUoc3RhdGUsXHJcbiAgICBbJ3NldHRpbmdzJywgJ2dhbWVNb2RlJywgJ2Rpc2NvdmVyZWQnLCBHQU1FX0lELCAncGF0aCddLCB1bmRlZmluZWQpO1xyXG4gIGlmIChkaXNjb3ZlcnlQYXRoID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHByb2ZpbGVzOiB7IFtwcm9maWxlSWQ6IHN0cmluZ106IHR5cGVzLklQcm9maWxlIH0gPSB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdwcm9maWxlcyddLCB7fSk7XHJcbiAgY29uc3QgcHJvZmlsZUlkcyA9IE9iamVjdC5rZXlzKHByb2ZpbGVzKS5maWx0ZXIoaWQgPT4gcHJvZmlsZXNbaWRdLmdhbWVJZCA9PT0gR0FNRV9JRCk7XHJcbiAgaWYgKHByb2ZpbGVJZHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IHVuc3RyaXBwZWRNb2RzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGlkID0+IG1vZHNbaWRdPy50eXBlID09PSAndW5zdHJpcHBlZC1hc3NlbWJsaWVzJ1xyXG4gICAgJiYgdXRpbC5nZXRTYWZlKHN0YXRlLFxyXG4gICAgICBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSUQsIGlkLCAnYXR0cmlidXRlcycsICdtb2RJZCddLCB1bmRlZmluZWQpID09PSAxNSk7XHJcbiAgaWYgKHVuc3RyaXBwZWRNb2RzLmxlbmd0aCA+IDApIHtcclxuICAgIHJldHVybiBhcGkuYXdhaXRVSSgpXHJcbiAgICAgIC50aGVuKCgpID0+IHtcclxuICAgICAgICBmb3IgKGNvbnN0IHByb2ZJZCBvZiBwcm9maWxlSWRzKSB7XHJcbiAgICAgICAgICBmb3IgKGNvbnN0IG1vZElkIG9mIHVuc3RyaXBwZWRNb2RzKSB7XHJcbiAgICAgICAgICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3Rpb25zLnNldE1vZEVuYWJsZWQocHJvZklkLCBtb2RJZCwgZmFsc2UpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0RGVwbG95bWVudE5lY2Vzc2FyeShHQU1FX0lELCB0cnVlKSk7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWlncmF0ZTEwNihhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG9sZFZlcnNpb246IHN0cmluZykge1xyXG4gIGlmIChzZW12ZXIuZ3RlKG9sZFZlcnNpb24sICcxLjAuNicpKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IG1vZHM6IHsgW21vZElkOiBzdHJpbmddOiB0eXBlcy5JTW9kIH0gPVxyXG4gICAgdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcbiAgY29uc3Qgd29ybGRNb2RzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGtleSA9PiBtb2RzW2tleV0/LnR5cGUgPT09ICdiZXR0ZXItY29udGluZW50cy1tb2QnKTtcclxuICBpZiAod29ybGRNb2RzLmxlbmd0aCA+IDApIHtcclxuICAgIHJldHVybiBhcGkuYXdhaXRVSSgpXHJcbiAgICAgIC50aGVuKCgpID0+IGZzLmVuc3VyZURpcldyaXRhYmxlQXN5bmMoV09STERTX1BBVEgpKVxyXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG1heC1saW5lLWxlbmd0aFxyXG4gICAgICAudGhlbigoKSA9PiBhcGkuZW1pdEFuZEF3YWl0KCdwdXJnZS1tb2RzLWluLXBhdGgnLCBHQU1FX0lELCAnYmV0dGVyLWNvbnRpbmVudHMtbW9kJywgV09STERTX1BBVEgpKTtcclxuICB9XHJcblxyXG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG1pZ3JhdGUxMDQoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCBvbGRWZXJzaW9uOiBzdHJpbmcpIHtcclxuICBpZiAoc2VtdmVyLmd0ZShvbGRWZXJzaW9uLCAnMS4wLjQnKSkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gIH1cclxuXHJcbiAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IGNvcmVMaWJNb2RJZCA9IE9iamVjdC5rZXlzKG1vZHMpLmZpbmQoa2V5ID0+XHJcbiAgICB1dGlsLmdldFNhZmUobW9kc1trZXldLCBbJ2F0dHJpYnV0ZXMnLCAnSXNDb3JlTGliTW9kJ10sIGZhbHNlKSk7XHJcblxyXG4gIGlmIChjb3JlTGliTW9kSWQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0TW9kQXR0cmlidXRlKEdBTUVfSUQsIGNvcmVMaWJNb2RJZCwgJ0NvcmVMaWJUeXBlJywgJ2NvcmVfbGliJykpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWlncmF0ZTEwMyhhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG9sZFZlcnNpb246IHN0cmluZykge1xyXG4gIGlmIChzZW12ZXIuZ3RlKG9sZFZlcnNpb24sICcxLjAuMycpKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCB0ID0gYXBpLnRyYW5zbGF0ZTtcclxuXHJcbiAgYXBpLnNlbmROb3RpZmljYXRpb24oe1xyXG4gICAgbWVzc2FnZTogJ0luZ2FtZSBNb2QgQ29uZmlndXJhdGlvbiBNYW5hZ2VyIGFkZGVkLicsXHJcbiAgICB0eXBlOiAnaW5mbycsXHJcbiAgICBhbGxvd1N1cHByZXNzOiBmYWxzZSxcclxuICAgIGFjdGlvbnM6IFtcclxuICAgICAge1xyXG4gICAgICAgIHRpdGxlOiAnTW9yZScsXHJcbiAgICAgICAgYWN0aW9uOiAoZGlzbWlzcykgPT4ge1xyXG4gICAgICAgICAgYXBpLnNob3dEaWFsb2coJ2luZm8nLCAnSW5nYW1lIE1vZCBDb25maWd1cmF0aW9uIE1hbmFnZXIgYWRkZWQnLFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBiYmNvZGU6IHQoJ1NvbWUgKGJ1dCBub3QgYWxsKSBWYWxoZWltIG1vZHMgY29tZSB3aXRoIGNvbmZpZ3VyYXRpb24gZmlsZXMgYWxsb3dpbmcgJ1xyXG4gICAgICAgICAgICAgICsgJ3lvdSB0byB0d2VhayBtb2Qgc3BlY2lmaWMgc2V0dGluZ3MuIE9uY2UgeW91XFwndmUgaW5zdGFsbGVkIG9uZSBvciBzZXZlcmFsICdcclxuICAgICAgICAgICAgICArICdzdWNoIG1vZHMsIHlvdSBjYW4gYnJpbmcgdXAgdGhlIG1vZCBjb25maWd1cmF0aW9uIG1hbmFnZXIgaW5nYW1lIGJ5IHByZXNzaW5nIEYxLidcclxuICAgICAgICAgICAgICArICdbYnJdWy9icl1bYnJdWy9icl0nXHJcbiAgICAgICAgICAgICAgKyAnQW55IHNldHRpbmdzIHlvdSBjaGFuZ2UgaW5nYW1lIHNob3VsZCBiZSBhcHBsaWVkIGltbWVkaWF0ZWx5IGFuZCB3aWxsIGJlIHNhdmVkICdcclxuICAgICAgICAgICAgICArICd0byB0aGUgbW9kc1xcJyBjb25maWcgZmlsZXMuJyksXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgWyB7IGxhYmVsOiAnQ2xvc2UnLCBhY3Rpb246ICgpID0+IGRpc21pc3MoKSwgZGVmYXVsdDogdHJ1ZSB9IF0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICBdLFxyXG4gIH0pO1xyXG59XHJcbiJdfQ==