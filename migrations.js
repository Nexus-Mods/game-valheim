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
    vortex_api_1.log('error', 'starting');
    if (semver_1.default.gte(oldVersion, '1.0.9')) {
        return bluebird_1.default.resolve();
    }
    vortex_api_1.log('error', 'starting');
    const state = api.getState();
    const discoveryPath = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', common_1.GAME_ID, 'path'], undefined);
    if (discoveryPath === undefined) {
        return bluebird_1.default.resolve();
    }
    vortex_api_1.log('error', 'discovery + activator');
    const profiles = vortex_api_1.util.getSafe(state, ['persistent', 'profiles'], {});
    const profileIds = Object.keys(profiles).filter(id => profiles[id].gameId === common_1.GAME_ID);
    if (profileIds.length === 0) {
        return bluebird_1.default.resolve();
    }
    vortex_api_1.log('error', 'got profiles');
    const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', common_1.GAME_ID], {});
    const unstrippedMods = Object.keys(mods).filter(id => {
        var _a;
        return ((_a = mods[id]) === null || _a === void 0 ? void 0 : _a.type) === 'unstripped-assemblies'
            && vortex_api_1.util.getSafe(state, ['persistent', 'mods', common_1.GAME_ID, id, 'attributes', 'modId'], undefined) === 15;
    });
    if (unstrippedMods.length > 0) {
        vortex_api_1.log('error', 'got mods');
        return api.awaitUI()
            .then(() => {
            for (const profId of profileIds) {
                for (const modId of unstrippedMods) {
                    vortex_api_1.log('error', 'disabling', { profId, modId });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlncmF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1pZ3JhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQStCO0FBQy9CLHVDQUFnRDtBQUNoRCxnREFBd0I7QUFDeEIsb0RBQTRCO0FBQzVCLDJDQUFzRTtBQUV0RSxxQ0FBbUM7QUFFbkMsTUFBTSxNQUFNLEdBQUcsY0FBSyxJQUFJLGlCQUFNLENBQUMsR0FBRyxDQUFDO0FBQ25DLE1BQU0sV0FBVyxHQUFHLGNBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFDeEQsSUFBSSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0FBRTVELFNBQWdCLFVBQVUsQ0FBQyxHQUF3QixFQUFFLFVBQWtCO0lBQ3JFLGdCQUFHLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3pCLElBQUksZ0JBQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFO1FBQ25DLE9BQU8sa0JBQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUMxQjtJQUVELGdCQUFHLENBQUMsT0FBTyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0lBQ3pCLE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUM3QixNQUFNLGFBQWEsR0FBRyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQ3RDLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRSxZQUFZLEVBQUUsZ0JBQU8sRUFBRSxNQUFNLENBQUMsRUFBRSxTQUFTLENBQUMsQ0FBQztJQUN0RSxJQUFJLGFBQWEsS0FBSyxTQUFTLEVBQUU7UUFDL0IsT0FBTyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQzFCO0lBRUQsZ0JBQUcsQ0FBQyxPQUFPLEVBQUUsdUJBQXVCLENBQUMsQ0FBQztJQUN0QyxNQUFNLFFBQVEs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TyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0FBQzNCLENBQUM7QUFoQkQsZ0NBZ0JDO0FBRUQsU0FBZ0IsVUFBVSxDQUFDLEdBQXdCLEVBQUUsVUFBa0I7SUFDckUsSUFBSSxnQkFBTSxDQUFDLEdBQUcsQ0FBQyxVQUFVLEVBQUUsT0FBTyxDQUFDLEVBQUU7UUFDbkMsT0FBTyxrQkFBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO0tBQzFCO0lBRUQsTUFBTSxDQUFDLEdBQUcsR0FBRyxDQUFDLFNBQVMsQ0FBQztJQUV4QixHQUFHLENBQUMsZ0JBQWdCLENBQUM7UUFDbkIsT0FBTyxFQUFFLHlDQUF5QztRQUNsRCxJQUFJLEVBQUUsTUFBTTtRQUNaLGFBQWEsRUFBRSxLQUFLO1FBQ3BCLE9BQU8sRUFBRTtZQUNQO2dCQUNFLEtBQUssRUFBRSxNQUFNO2dCQUNiLE1BQU0sRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFO29CQUNsQixHQUFHLENBQUMsVUFBVSxDQUFDLE1BQU0sRUFBRSx3Q0FBd0MsRUFDL0Q7d0JBQ0UsTUFBTSxFQUFFLENBQUMsQ0FBQyx5RUFBeUU7OEJBQy9FLDRFQUE0RTs4QkFDNUUsa0ZBQWtGOzhCQUNsRixvQkFBb0I7OEJBQ3BCLGlGQUFpRjs4QkFDakYsNkJBQTZCLENBQUM7cUJBQ25DLEVBQ0QsQ0FBRSxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxFQUFFLE9BQU8sRUFBRSxJQUFJLEVBQUUsQ0FBRSxDQUFDLENBQUM7Z0JBQ2xFLENBQUM7YUFDRjtTQUNGO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQTdCRCxnQ0E2QkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgUHJvbWlzZSBmcm9tICdibHVlYmlyZCc7XHJcbmltcG9ydCB7IGFwcCBhcyBhcHBJbiwgcmVtb3RlIH0gZnJvbSAnZWxlY3Ryb24nO1xyXG5pbXBvcnQgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHNlbXZlciBmcm9tICdzZW12ZXInO1xyXG5pbXBvcnQgeyBhY3Rpb25zLCBmcywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5pbXBvcnQgeyBHQU1FX0lEIH0gZnJvbSAnLi9jb21tb24nO1xyXG5cclxuY29uc3QgYXBwdW5pID0gYXBwSW4gfHwgcmVtb3RlLmFwcDtcclxuY29uc3QgV09STERTX1BBVEggPSBwYXRoLnJlc29sdmUoYXBwdW5pLmdldFBhdGgoJ2FwcERhdGEnKSxcclxuICAnLi4nLCAnTG9jYWxMb3cnLCAnSXJvbkdhdGUnLCAnVmFsaGVpbScsICd2b3J0ZXgtd29ybGRzJyk7XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWlncmF0ZTEwOShhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG9sZFZlcnNpb246IHN0cmluZykge1xyXG4gIGxvZygnZXJyb3InLCAnc3RhcnRpbmcnKTtcclxuICBpZiAoc2VtdmVyLmd0ZShvbGRWZXJzaW9uLCAnMS4wLjknKSkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gIH1cclxuXHJcbiAgbG9nKCdlcnJvcicsICdzdGFydGluZycpO1xyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgZGlzY292ZXJ5UGF0aCA9IHV0aWwuZ2V0U2FmZShzdGF0ZSxcclxuICAgIFsnc2V0dGluZ3MnLCAnZ2FtZU1vZGUnLCAnZGlzY292ZXJlZCcsIEdBTUVfSUQsICdwYXRoJ10sIHVuZGVmaW5lZCk7XHJcbiAgaWYgKGRpc2NvdmVyeVBhdGggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gIH1cclxuXHJcbiAgbG9nKCdlcnJvcicsICdkaXNjb3ZlcnkgKyBhY3RpdmF0b3InKTtcclxuICBjb25zdCBwcm9maWxlczogeyBbcHJvZmlsZUlkOiBzdHJpbmddOiB0eXBlcy5JUHJvZmlsZSB9ID0gdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAncHJvZmlsZXMnXSwge30pO1xyXG4gIGNvbnN0IHByb2ZpbGVJZHMgPSBPYmplY3Qua2V5cyhwcm9maWxlcykuZmlsdGVyKGlkID0+IHByb2ZpbGVzW2lkXS5nYW1lSWQgPT09IEdBTUVfSUQpO1xyXG4gIGlmIChwcm9maWxlSWRzLmxlbmd0aCA9PT0gMCkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gIH1cclxuXHJcbiAgbG9nKCdlcnJvcicsICdnb3QgcHJvZmlsZXMnKTtcclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IHVuc3RyaXBwZWRNb2RzID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGlkID0+IG1vZHNbaWRdPy50eXBlID09PSAndW5zdHJpcHBlZC1hc3NlbWJsaWVzJ1xyXG4gICAgJiYgdXRpbC5nZXRTYWZlKHN0YXRlLFxyXG4gICAgICBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSUQsIGlkLCAnYXR0cmlidXRlcycsICdtb2RJZCddLCB1bmRlZmluZWQpID09PSAxNSk7XHJcbiAgaWYgKHVuc3RyaXBwZWRNb2RzLmxlbmd0aCA+IDApIHtcclxuICAgIGxvZygnZXJyb3InLCAnZ290IG1vZHMnKTtcclxuICAgIHJldHVybiBhcGkuYXdhaXRVSSgpXHJcbiAgICAgIC50aGVuKCgpID0+IHtcclxuICAgICAgICBmb3IgKGNvbnN0IHByb2ZJZCBvZiBwcm9maWxlSWRzKSB7XHJcbiAgICAgICAgICBmb3IgKGNvbnN0IG1vZElkIG9mIHVuc3RyaXBwZWRNb2RzKSB7XHJcbiAgICAgICAgICAgIGxvZygnZXJyb3InLCAnZGlzYWJsaW5nJywge3Byb2ZJZCwgbW9kSWR9KTtcclxuICAgICAgICAgICAgYXBpLnN0b3JlLmRpc3BhdGNoKGFjdGlvbnMuc2V0TW9kRW5hYmxlZChwcm9mSWQsIG1vZElkLCBmYWxzZSkpO1xyXG4gICAgICAgICAgfVxyXG4gICAgICAgIH1cclxuICAgICAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zZXREZXBsb3ltZW50TmVjZXNzYXJ5KEdBTUVfSUQsIHRydWUpKTtcclxuICAgICAgfSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBtaWdyYXRlMTA2KGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgb2xkVmVyc2lvbjogc3RyaW5nKSB7XHJcbiAgaWYgKHNlbXZlci5ndGUob2xkVmVyc2lvbiwgJzEuMC42JykpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCB3b3JsZE1vZHMgPSBPYmplY3Qua2V5cyhtb2RzKS5maWx0ZXIoa2V5ID0+IG1vZHNba2V5XT8udHlwZSA9PT0gJ2JldHRlci1jb250aW5lbnRzLW1vZCcpO1xyXG4gIGlmICh3b3JsZE1vZHMubGVuZ3RoID4gMCkge1xyXG4gICAgcmV0dXJuIGFwaS5hd2FpdFVJKClcclxuICAgICAgLnRoZW4oKCkgPT4gZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhXT1JMRFNfUEFUSCkpXHJcbiAgICAgIC8vIHRzbGludDpkaXNhYmxlLW5leHQtbGluZTogbWF4LWxpbmUtbGVuZ3RoXHJcbiAgICAgIC50aGVuKCgpID0+IGFwaS5lbWl0QW5kQXdhaXQoJ3B1cmdlLW1vZHMtaW4tcGF0aCcsIEdBTUVfSUQsICdiZXR0ZXItY29udGluZW50cy1tb2QnLCBXT1JMRFNfUEFUSCkpO1xyXG4gIH1cclxuXHJcbiAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gbWlncmF0ZTEwNChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIG9sZFZlcnNpb246IHN0cmluZykge1xyXG4gIGlmIChzZW12ZXIuZ3RlKG9sZFZlcnNpb24sICcxLjAuNCcpKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG5cclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IG1vZHM6IHsgW21vZElkOiBzdHJpbmddOiB0eXBlcy5JTW9kIH0gPVxyXG4gICAgdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcbiAgY29uc3QgY29yZUxpYk1vZElkID0gT2JqZWN0LmtleXMobW9kcykuZmluZChrZXkgPT5cclxuICAgIHV0aWwuZ2V0U2FmZShtb2RzW2tleV0sIFsnYXR0cmlidXRlcycsICdJc0NvcmVMaWJNb2QnXSwgZmFsc2UpKTtcclxuXHJcbiAgaWYgKGNvcmVMaWJNb2RJZCAhPT0gdW5kZWZpbmVkKSB7XHJcbiAgICBhcGkuc3RvcmUuZGlzcGF0Y2goYWN0aW9ucy5zZXRNb2RBdHRyaWJ1dGUoR0FNRV9JRCwgY29yZUxpYk1vZElkLCAnQ29yZUxpYlR5cGUnLCAnY29yZV9saWInKSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBtaWdyYXRlMTAzKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgb2xkVmVyc2lvbjogc3RyaW5nKSB7XHJcbiAgaWYgKHNlbXZlci5ndGUob2xkVmVyc2lvbiwgJzEuMC4zJykpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHQgPSBhcGkudHJhbnNsYXRlO1xyXG5cclxuICBhcGkuc2VuZE5vdGlmaWNhdGlvbih7XHJcbiAgICBtZXNzYWdlOiAnSW5nYW1lIE1vZCBDb25maWd1cmF0aW9uIE1hbmFnZXIgYWRkZWQuJyxcclxuICAgIHR5cGU6ICdpbmZvJyxcclxuICAgIGFsbG93U3VwcHJlc3M6IGZhbHNlLFxyXG4gICAgYWN0aW9uczogW1xyXG4gICAgICB7XHJcbiAgICAgICAgdGl0bGU6ICdNb3JlJyxcclxuICAgICAgICBhY3Rpb246IChkaXNtaXNzKSA9PiB7XHJcbiAgICAgICAgICBhcGkuc2hvd0RpYWxvZygnaW5mbycsICdJbmdhbWUgTW9kIENvbmZpZ3VyYXRpb24gTWFuYWdlciBhZGRlZCcsXHJcbiAgICAgICAgICB7XHJcbiAgICAgICAgICAgIGJiY29kZTogdCgnU29tZSAoYnV0IG5vdCBhbGwpIFZhbGhlaW0gbW9kcyBjb21lIHdpdGggY29uZmlndXJhdGlvbiBmaWxlcyBhbGxvd2luZyAnXHJcbiAgICAgICAgICAgICAgKyAneW91IHRvIHR3ZWFrIG1vZCBzcGVjaWZpYyBzZXR0aW5ncy4gT25jZSB5b3VcXCd2ZSBpbnN0YWxsZWQgb25lIG9yIHNldmVyYWwgJ1xyXG4gICAgICAgICAgICAgICsgJ3N1Y2ggbW9kcywgeW91IGNhbiBicmluZyB1cCB0aGUgbW9kIGNvbmZpZ3VyYXRpb24gbWFuYWdlciBpbmdhbWUgYnkgcHJlc3NpbmcgRjEuJ1xyXG4gICAgICAgICAgICAgICsgJ1ticl1bL2JyXVticl1bL2JyXSdcclxuICAgICAgICAgICAgICArICdBbnkgc2V0dGluZ3MgeW91IGNoYW5nZSBpbmdhbWUgc2hvdWxkIGJlIGFwcGxpZWQgaW1tZWRpYXRlbHkgYW5kIHdpbGwgYmUgc2F2ZWQgJ1xyXG4gICAgICAgICAgICAgICsgJ3RvIHRoZSBtb2RzXFwnIGNvbmZpZyBmaWxlcy4nKSxcclxuICAgICAgICAgIH0sXHJcbiAgICAgICAgICBbIHsgbGFiZWw6ICdDbG9zZScsIGFjdGlvbjogKCkgPT4gZGlzbWlzcygpLCBkZWZhdWx0OiB0cnVlIH0gXSk7XHJcbiAgICAgICAgfSxcclxuICAgICAgfSxcclxuICAgIF0sXHJcbiAgfSk7XHJcbn1cclxuIl19