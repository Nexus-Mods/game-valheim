"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrate103 = exports.migrate104 = exports.migrate106 = exports.migrate109 = void 0;
const bluebird_1 = __importDefault(require("bluebird"));
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const semver_1 = __importDefault(require("semver"));
const vortex_api_1 = require("vortex-api");
const common_1 = require("./common");
const appuni = electron_1.app || electron_1.remote.app;
const WORLDS_PATH = path_1.default.resolve(appuni.getPath('appData'), '..', 'LocalLow', 'IronGate', 'Valheim', 'vortex-worlds');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlncmF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1pZ3JhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQStCO0FBQy9CLHVDQUFnRDtBQUNoRCxnREFBd0I7QUFDeEIsb0RBQTRCO0FBQzVCLDJDQUFzRTtBQUV0RSxxQ0FBbUM7QUFFbkMsTUFBTSxNQUFNLEdBQUcsY0FBSyxJQUFJLGlCQUFNLENBQUMsR0FBRyxDQUFDO0FBQ25DLE1BQU0sV0FBVyxHQUFHLGNBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFDeEQsSUFBSSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0FBRTVELFNBQWdCLFVBQVUsQ0FBQyxHQUF3QixFQUFFLFVBQWtCO0lBQ3JFLElBQUksZ0JBQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFO1FBQ25DLE9BQU8sa0JBQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUMxQjtJQUVELE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUM3QixNQUFNLGFBQWEsR0FBRyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQ3RDLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsZ0JBQU8sRUFBRSxNQUFNLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUN0RSxJQUFJLGFBQWEsS0FBSyxTQUFTLEVBQUU7UUFDL0IsT0FBTyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQzFCO0lBRUQsTUFBTSxRQUFRLEdBQTRDLGlCQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUM5RyxNQUFNLFVBQVUsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEs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RCxJQUFJLEVBQUUsTUFBTTtRQUNaLGFBQWEsRUFBRSxLQUFLO1FBQ3BCLE9BQU8sRUFBRTtZQUNQO2dCQUNFLEtBQUssRUFBRSxNQUFNO2dCQUNiLE1BQU0sRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFO29CQUNsQixHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSx3Q0FBd0MsRUFDL0Q7d0JBQ0UsTUFBTSxFQUFFLENBQUMsQ0FBQyx5RUFBeUU7OEJBQy9FLDRFQUE0RTs4QkFDNUUsa0ZBQWtGOzhCQUNsRixvQkFBb0I7OEJBQ3BCLGlGQUFpRjs4QkFDakYsNkJBQTZCLENBQUM7cUJBQ25DLEVBQ0QsQ0FBRSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBRSxDQUFDLENBQUM7Z0JBQ2xFLENBQUM7YUFDRjtTQUNGO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQTdCRCxnQ0E2QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUHJvbWlzZSBmcm9tICdibHVlYmlyZCc7XHJcbmltcG9ydCB7IGFwcCBhcyBhcHBJbiwgcmVtb3RlIH0gZnJvbSAnZWxlY3Ryb24nO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xyXG5pbXBvcnQgeyBhY3Rpb25zLCBmcywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5pbXBvcnQgeyBHQU1FX0lEIH0gZnJvbSAnLi9jb21tb24nO1xyXG5cclxuY29uc3QgYXBwdW5pID0gYXBwSW4gfHwgcmVtb3RlLmFwcDtcclxuY29uc3QgV09STERTX1BBVEggPSBwYXRoLnJlc29sdmUoYXBwdW5pLmdldFBhdGgoJ2FwcERhdGEnKSxcclxuICAnLi4nLCAnTG9jYWxMb3cnLCAnSXJvbkdhdGUnLCAnVmFsaGVpbScsICd2b3J0ZXgtd29ybGRzJyk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWlncmF0ZTEwOShhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG9sZFZlcnNpb246IHN0cmluZykge1xyXG4gIGlmIChzZW12ZXIuZ3RlKG9sZFZlcnNpb24sICcxLjAuOScpKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IGRpc2NvdmVyeVBhdGggPSB1dGlsLmdldFNhZmUoc3RhdGUsXHJcbiAgICBbJ3NldHRpbmdzJywgJ2dhbWVNb2RlJywgJ2Rpc2NvdmVyZWQnLCBHQU1FX0lELCAncGF0aCddLCB1bmRlZmluZWQpO1xyXG4gIGlmIChkaXNjb3ZlcnlQYXRoID09PSB1bmRlZmluZWQpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHByb2ZpbGVzOiB7IFtwcm9maWxlSWQ6IHN0cmluZ106IHR5cGVzLklQcm9maWxlIH0gPSB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdwcm9maWxlcyddLCB7fSk7XHJcbiAgY29uc3QgcHJvZmlsZUlkcyA9IE9iamVjdC5rZXlzKHByb2ZpbGVzKS5maWx0ZXIoaWQgPT4gcHJvZmlsZXNbaWRdLmdhbWVJZCA9PT0gR0FNRV9JRCk7XHJcbiAgaWYgKHByb2ZpbGVJZHMubGVuZ3RoID09PSAwKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IHVuc3RyaXBwZWRNb2RzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGlkID0+IG1vZHNbaWRdPy50eXBlID09PSAndW5zdHJpcHBlZC1hc3NlbWJsaWVzJ1xyXG4gICAgJiYgdXRpbC5nZXRTYWZlKHN0YXRlLFxyXG4gICAgICBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSUQsIGlkLCAnYXR0cmlidXRlcycsICdtb2RJZCddLCB1bmRlZmluZWQpID09PSAxNSk7XHJcbiAgaWYgKHVuc3RyaXBwZWRNb2RzLmxlbmd0aCA+IDApIHtcclxuICAgIHJldHVybiBhcGkuYXdhaXRVSSgpXHJcbiAgICAgIC50aGVuKCgpID0+IHtcclxuICAgICAgICBmb3IgKGNvbnN0IHByb2ZJZCBvZiBwcm9maWxlSWRzKSB7XHJcbiAgICAgICAgICBmb3IgKGNvbnN0IG1vZElkIG9mIHVuc3RyaXBwZWRNb2RzKSB7XHJcbiAgICAgICAgICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3Rpb25zLnNldE1vZEVuYWJsZWQocHJvZklkLCBtb2RJZCwgZmFsc2UpKTtcclxuICAgICAgICAgIH1cclxuICAgICAgICB9XHJcbiAgICAgICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0RGVwbG95bWVudE5lY2Vzc2FyeShHQU1FX0lELCB0cnVlKSk7XHJcbiAgICAgIH0pO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWlncmF0ZTEwNihhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG9sZFZlcnNpb246IHN0cmluZykge1xyXG4gIGlmIChzZW12ZXIuZ3RlKG9sZFZlcnNpb24sICcxLjAuNicpKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IG1vZHM6IHsgW21vZElkOiBzdHJpbmddOiB0eXBlcy5JTW9kIH0gPVxyXG4gICAgdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcbiAgY29uc3Qgd29ybGRNb2RzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGtleSA9PiBtb2RzW2tleV0/LnR5cGUgPT09ICdiZXR0ZXItY29udGluZW50cy1tb2QnKTtcclxuICBpZiAod29ybGRNb2RzLmxlbmd0aCA+IDApIHtcclxuICAgIHJldHVybiBhcGkuYXdhaXRVSSgpXHJcbiAgICAgIC50aGVuKCgpID0+IGZzLmVuc3VyZURpcldyaXRhYmxlQXN5bmMoV09STERTX1BBVEgpKVxyXG4gICAgICAvLyB0c2xpbnQ6ZGlzYWJsZS1uZXh0LWxpbmU6IG1heC1saW5lLWxlbmd0aFxyXG4gICAgICAudGhlbigoKSA9PiBhcGkuZW1pdEFuZEF3YWl0KCdwdXJnZS1tb2RzLWluLXBhdGgnLCBHQU1FX0lELCAnYmV0dGVyLWNvbnRpbmVudHMtbW9kJywgV09STERTX1BBVEgpKTtcclxuICB9XHJcblxyXG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG1pZ3JhdGUxMDQoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCBvbGRWZXJzaW9uOiBzdHJpbmcpIHtcclxuICBpZiAoc2VtdmVyLmd0ZShvbGRWZXJzaW9uLCAnMS4wLjQnKSkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gIH1cclxuXHJcbiAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IGNvcmVMaWJNb2RJZCA9IE9iamVjdC5rZXlzKG1vZHMpLmZpbmQoa2V5ID0+XHJcbiAgICB1dGlsLmdldFNhZmUobW9kc1trZXldLCBbJ2F0dHJpYnV0ZXMnLCAnSXNDb3JlTGliTW9kJ10sIGZhbHNlKSk7XHJcblxyXG4gIGlmIChjb3JlTGliTW9kSWQgIT09IHVuZGVmaW5lZCkge1xyXG4gICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0TW9kQXR0cmlidXRlKEdBTUVfSUQsIGNvcmVMaWJNb2RJZCwgJ0NvcmVMaWJUeXBlJywgJ2NvcmVfbGliJykpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWlncmF0ZTEwMyhhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG9sZFZlcnNpb246IHN0cmluZykge1xyXG4gIGlmIChzZW12ZXIuZ3RlKG9sZFZlcnNpb24sICcxLjAuMycpKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCB0ID0gYXBpLnRyYW5zbGF0ZTtcclxuXHJcbiAgYXBpLnNlbmROb3RpZmljYXRpb24oe1xyXG4gICAgbWVzc2FnZTogJ0luZ2FtZSBNb2QgQ29uZmlndXJhdGlvbiBNYW5hZ2VyIGFkZGVkLicsXHJcbiAgICB0eXBlOiAnaW5mbycsXHJcbiAgICBhbGxvd1N1cHByZXNzOiBmYWxzZSxcclxuICAgIGFjdGlvbnM6IFtcclxuICAgICAge1xyXG4gICAgICAgIHRpdGxlOiAnTW9yZScsXHJcbiAgICAgICAgYWN0aW9uOiAoZGlzbWlzcykgPT4ge1xyXG4gICAgICAgICAgYXBpLnNob3dEaWFsb2coJ2luZm8nLCAnSW5nYW1lIE1vZCBDb25maWd1cmF0aW9uIE1hbmFnZXIgYWRkZWQnLFxyXG4gICAgICAgICAge1xyXG4gICAgICAgICAgICBiYmNvZGU6IHQoJ1NvbWUgKGJ1dCBub3QgYWxsKSBWYWxoZWltIG1vZHMgY29tZSB3aXRoIGNvbmZpZ3VyYXRpb24gZmlsZXMgYWxsb3dpbmcgJ1xyXG4gICAgICAgICAgICAgICsgJ3lvdSB0byB0d2VhayBtb2Qgc3BlY2lmaWMgc2V0dGluZ3MuIE9uY2UgeW91XFwndmUgaW5zdGFsbGVkIG9uZSBvciBzZXZlcmFsICdcclxuICAgICAgICAgICAgICArICdzdWNoIG1vZHMsIHlvdSBjYW4gYnJpbmcgdXAgdGhlIG1vZCBjb25maWd1cmF0aW9uIG1hbmFnZXIgaW5nYW1lIGJ5IHByZXNzaW5nIEYxLidcclxuICAgICAgICAgICAgICArICdbYnJdWy9icl1bYnJdWy9icl0nXHJcbiAgICAgICAgICAgICAgKyAnQW55IHNldHRpbmdzIHlvdSBjaGFuZ2UgaW5nYW1lIHNob3VsZCBiZSBhcHBsaWVkIGltbWVkaWF0ZWx5IGFuZCB3aWxsIGJlIHNhdmVkICdcclxuICAgICAgICAgICAgICArICd0byB0aGUgbW9kc1xcJyBjb25maWcgZmlsZXMuJyksXHJcbiAgICAgICAgICB9LFxyXG4gICAgICAgICAgWyB7IGxhYmVsOiAnQ2xvc2UnLCBhY3Rpb246ICgpID0+IGRpc21pc3MoKSwgZGVmYXVsdDogdHJ1ZSB9IF0pO1xyXG4gICAgICAgIH0sXHJcbiAgICAgIH0sXHJcbiAgICBdLFxyXG4gIH0pO1xyXG59XHJcbiJdfQ==