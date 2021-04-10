"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.migrate103 = exports.migrate104 = exports.migrate106 = void 0;
const bluebird_1 = __importDefault(require("bluebird"));
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const semver_1 = __importDefault(require("semver"));
const vortex_api_1 = require("vortex-api");
const common_1 = require("./common");
const appuni = electron_1.app || electron_1.remote.app;
const WORLDS_PATH = path_1.default.resolve(appuni.getPath('appData'), '..', 'LocalLow', 'IronGate', 'Valheim', 'vortex-worlds');
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWlncmF0aW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1pZ3JhdGlvbnMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUEsd0RBQStCO0FBQy9CLHVDQUFnRDtBQUNoRCxnREFBd0I7QUFDeEIsb0RBQTRCO0FBQzVCLDJDQUFzRDtBQUV0RCxxQ0FBbUM7QUFFbkMsTUFBTSxNQUFNLEdBQUcsY0FBSyxJQUFJLGlCQUFNLENBQUMsR0FBRyxDQUFDO0FBQ25DLE1BQU0sV0FBVyxHQUFHLGNBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsRUFDeEQsSUFBSSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLGVBQWUsQ0FBQyxDQUFDO0FBRTVELFNBQWdCLFVBQVUsQ0FBQyxHQUF3QixFQUFFLFVBQWtCO0lBQ3JFLElBQUksZ0JBQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFO1FBQ25DLE9BQU8sa0JBQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUMxQjtJQUVELE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUM3QixNQUFNLElBQUksR0FDUixpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLGdCQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMzRCxNQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxXQUFDLE9BQUEsT0FBQSxJQUFJLENBQUMsR0FBRyxDQUFDLDBDQUFFLElBQUksTUFBSyx1QkFBdUIsQ0FBQSxFQUFBLENBQUMsQ0FBQztJQUMvRixJQUFJLFNBQVMsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1FBQ3hCLE9BQU8sR0FBRyxDQUFDLE9BQU8sRUFBRTthQUNqQixJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsZUFBRSxDQUFDLHNCQUFzQixDQUFDLFdBQVcsQ0FBQyxDQUFDO2FBRWxELElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLG9CQUFvQixFQUFFLGdCQUFPLEVBQUUsdUJBQXVCLEVBQUUsV0FBVyxDQUFDLENBQUMsQ0FBQztLQUN0RztJQUVELE9BQU8sa0JBQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztBQUMzQixDQUFDO0FBakJELGdDQWlCQztBQUVELFNBQWdCLFVBQVUsQ0FBQyxHQUF3QixFQUFFLFVBQWtCO0lBQ3JFLElBQUksZ0JBQU0sQ0FBQyxHQUFHLENBQUMsVUFBVSxFQUFFLE9BQU8sQ0FBQyxFQUFFO1FBQ25DLE9BQU8sa0JBQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztLQUMxQjtJQUVELE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUM3QixNQUFNLElBQUksR0FDUixpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLGdCQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUMzRCxNQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUNoRCxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxZQUFZLEVBQUUsY0FBYyxDQUFDLEVBQUUsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUVsRSxJQUFJLFlBQVksS0FBSyxTQUFTLEVBQUU7UUFDOUIsR0FBRyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsb0JBQU8sQ0FBQyxlQUFlLENBQUMsZ0JBQU8sRUFBRSxZQUFZLEVBQUUsYUFBYSxFQUFFLFVBQVUsQ0FBQyxDQUFDLENBQUM7S0FDL0Y7SUFFRCxPQUFPLGtCQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDM0IsQ0FBQztBQWhCRCxnQ0FnQkM7QUFFRCxTQUFnQixVQUFVLENBQUMsR0FBd0IsRUFBRSxVQUFrQjtJQUNyRSxJQUFJLGdCQUFNLENBQUMsR0FBRyxDQUFDLFVBQVUsRUFBRSxPQUFPLENBQUMsRUFBRTtRQUNuQyxPQUFPLGtCQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7S0FDMUI7SUFFRCxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsU0FBUyxDQUFDO0lBRXhCLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQztRQUNuQixPQUFPLEVBQUUseUNBQXlDO1FBQ2xELElBQUksRUFBRSxNQUFNO1FBQ1osYUFBYSxFQUFFLEtBQUs7UUFDcEIsT0FBTyxFQUFFO1lBQ1A7Z0JBQ0UsS0FBSyxFQUFFLE1BQU07Z0JBQ2IsTUFBTSxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUU7b0JBQ2xCLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLHdDQUF3QyxFQUMvRDt3QkFDRSxNQUFNLEVBQUUsQ0FBQyxDQUFDLHlFQUF5RTs4QkFDL0UsNEVBQTRFOzhCQUM1RSxrRkFBa0Y7OEJBQ2xGLG9CQUFvQjs4QkFDcEIsaUZBQWlGOzhCQUNqRiw2QkFBNkIsQ0FBQztxQkFDbkMsRUFDRCxDQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLEVBQUUsT0FBTyxFQUFFLElBQUksRUFBRSxDQUFFLENBQUMsQ0FBQztnQkFDbEUsQ0FBQzthQUNGO1NBQ0Y7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDO0FBN0JELGdDQTZCQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBQcm9taXNlIGZyb20gJ2JsdWViaXJkJztcclxuaW1wb3J0IHsgYXBwIGFzIGFwcEluLCByZW1vdGUgfSBmcm9tICdlbGVjdHJvbic7XHJcbmltcG9ydCBwYXRoIGZyb20gJ3BhdGgnO1xyXG5pbXBvcnQgc2VtdmVyIGZyb20gJ3NlbXZlcic7XHJcbmltcG9ydCB7IGFjdGlvbnMsIGZzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuaW1wb3J0IHsgR0FNRV9JRCB9IGZyb20gJy4vY29tbW9uJztcclxuXHJcbmNvbnN0IGFwcHVuaSA9IGFwcEluIHx8IHJlbW90ZS5hcHA7XHJcbmNvbnN0IFdPUkxEU19QQVRIID0gcGF0aC5yZXNvbHZlKGFwcHVuaS5nZXRQYXRoKCdhcHBEYXRhJyksXHJcbiAgJy4uJywgJ0xvY2FsTG93JywgJ0lyb25HYXRlJywgJ1ZhbGhlaW0nLCAndm9ydGV4LXdvcmxkcycpO1xyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG1pZ3JhdGUxMDYoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCBvbGRWZXJzaW9uOiBzdHJpbmcpIHtcclxuICBpZiAoc2VtdmVyLmd0ZShvbGRWZXJzaW9uLCAnMS4wLjYnKSkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gIH1cclxuXHJcbiAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IHdvcmxkTW9kcyA9IE9iamVjdC5rZXlzKG1vZHMpLmZpbHRlcihrZXkgPT4gbW9kc1trZXldPy50eXBlID09PSAnYmV0dGVyLWNvbnRpbmVudHMtbW9kJyk7XHJcbiAgaWYgKHdvcmxkTW9kcy5sZW5ndGggPiAwKSB7XHJcbiAgICByZXR1cm4gYXBpLmF3YWl0VUkoKVxyXG4gICAgICAudGhlbigoKSA9PiBmcy5lbnN1cmVEaXJXcml0YWJsZUFzeW5jKFdPUkxEU19QQVRIKSlcclxuICAgICAgLy8gdHNsaW50OmRpc2FibGUtbmV4dC1saW5lOiBtYXgtbGluZS1sZW5ndGhcclxuICAgICAgLnRoZW4oKCkgPT4gYXBpLmVtaXRBbmRBd2FpdCgncHVyZ2UtbW9kcy1pbi1wYXRoJywgR0FNRV9JRCwgJ2JldHRlci1jb250aW5lbnRzLW1vZCcsIFdPUkxEU19QQVRIKSk7XHJcbiAgfVxyXG5cclxuICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBtaWdyYXRlMTA0KGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgb2xkVmVyc2lvbjogc3RyaW5nKSB7XHJcbiAgaWYgKHNlbXZlci5ndGUob2xkVmVyc2lvbiwgJzEuMC40JykpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcblxyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBjb3JlTGliTW9kSWQgPSBPYmplY3Qua2V5cyhtb2RzKS5maW5kKGtleSA9PlxyXG4gICAgdXRpbC5nZXRTYWZlKG1vZHNba2V5XSwgWydhdHRyaWJ1dGVzJywgJ0lzQ29yZUxpYk1vZCddLCBmYWxzZSkpO1xyXG5cclxuICBpZiAoY29yZUxpYk1vZElkICE9PSB1bmRlZmluZWQpIHtcclxuICAgIGFwaS5zdG9yZS5kaXNwYXRjaChhY3Rpb25zLnNldE1vZEF0dHJpYnV0ZShHQU1FX0lELCBjb3JlTGliTW9kSWQsICdDb3JlTGliVHlwZScsICdjb3JlX2xpYicpKTtcclxuICB9XHJcblxyXG4gIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIG1pZ3JhdGUxMDMoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpLCBvbGRWZXJzaW9uOiBzdHJpbmcpIHtcclxuICBpZiAoc2VtdmVyLmd0ZShvbGRWZXJzaW9uLCAnMS4wLjMnKSkge1xyXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xyXG4gIH1cclxuXHJcbiAgY29uc3QgdCA9IGFwaS50cmFuc2xhdGU7XHJcblxyXG4gIGFwaS5zZW5kTm90aWZpY2F0aW9uKHtcclxuICAgIG1lc3NhZ2U6ICdJbmdhbWUgTW9kIENvbmZpZ3VyYXRpb24gTWFuYWdlciBhZGRlZC4nLFxyXG4gICAgdHlwZTogJ2luZm8nLFxyXG4gICAgYWxsb3dTdXBwcmVzczogZmFsc2UsXHJcbiAgICBhY3Rpb25zOiBbXHJcbiAgICAgIHtcclxuICAgICAgICB0aXRsZTogJ01vcmUnLFxyXG4gICAgICAgIGFjdGlvbjogKGRpc21pc3MpID0+IHtcclxuICAgICAgICAgIGFwaS5zaG93RGlhbG9nKCdpbmZvJywgJ0luZ2FtZSBNb2QgQ29uZmlndXJhdGlvbiBNYW5hZ2VyIGFkZGVkJyxcclxuICAgICAgICAgIHtcclxuICAgICAgICAgICAgYmJjb2RlOiB0KCdTb21lIChidXQgbm90IGFsbCkgVmFsaGVpbSBtb2RzIGNvbWUgd2l0aCBjb25maWd1cmF0aW9uIGZpbGVzIGFsbG93aW5nICdcclxuICAgICAgICAgICAgICArICd5b3UgdG8gdHdlYWsgbW9kIHNwZWNpZmljIHNldHRpbmdzLiBPbmNlIHlvdVxcJ3ZlIGluc3RhbGxlZCBvbmUgb3Igc2V2ZXJhbCAnXHJcbiAgICAgICAgICAgICAgKyAnc3VjaCBtb2RzLCB5b3UgY2FuIGJyaW5nIHVwIHRoZSBtb2QgY29uZmlndXJhdGlvbiBtYW5hZ2VyIGluZ2FtZSBieSBwcmVzc2luZyBGMS4nXHJcbiAgICAgICAgICAgICAgKyAnW2JyXVsvYnJdW2JyXVsvYnJdJ1xyXG4gICAgICAgICAgICAgICsgJ0FueSBzZXR0aW5ncyB5b3UgY2hhbmdlIGluZ2FtZSBzaG91bGQgYmUgYXBwbGllZCBpbW1lZGlhdGVseSBhbmQgd2lsbCBiZSBzYXZlZCAnXHJcbiAgICAgICAgICAgICAgKyAndG8gdGhlIG1vZHNcXCcgY29uZmlnIGZpbGVzLicpLFxyXG4gICAgICAgICAgfSxcclxuICAgICAgICAgIFsgeyBsYWJlbDogJ0Nsb3NlJywgYWN0aW9uOiAoKSA9PiBkaXNtaXNzKCksIGRlZmF1bHQ6IHRydWUgfSBdKTtcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgXSxcclxuICB9KTtcclxufVxyXG4iXX0=