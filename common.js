"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.genProps = exports.isInSlimVMLInstalled = exports.walkDirPath = exports.IGNORABLE_FILES = exports.DOORSTOPPER_HOOK = exports.INSLIMVML_IDENTIFIER = exports.VBUILD_EXT = exports.STEAM_ID = exports.GAME_ID = void 0;
const turbowalk_1 = __importDefault(require("turbowalk"));
const vortex_api_1 = require("vortex-api");
exports.GAME_ID = 'valheim';
exports.STEAM_ID = '892970';
exports.VBUILD_EXT = '.vbuild';
exports.INSLIMVML_IDENTIFIER = 'inslimvml.ini';
exports.DOORSTOPPER_HOOK = 'winhttp.dll';
exports.IGNORABLE_FILES = [
    'manifest.json', 'BepInEx.cfg', '0Harmony.dll', 'doorstop_config.ini',
    '0Harmony.xml', '0Harmony20.dll', 'BepInEx.dll', 'BepInEx.Harmony.dll', 'BepInEx.Harmony.xml',
    'BepInEx.Preloader.dll', 'BepInEx.Preloader.xml', 'BepInEx.xml', 'HarmonyXInterop.dll',
    'Mono.Cecil.dll', 'Mono.Cecil.Mdb.dll', 'Mono.Cecil.Pdb.dll', 'Mono.Cecil.Rocks.dll',
    'MonoMod.RuntimeDetour.dll', 'MonoMod.RuntimeDetour.xml', 'MonoMod.Utils.dll',
    'MonoMod.Utils.xml',
];
function walkDirPath(dirPath) {
    return __awaiter(this, void 0, void 0, function* () {
        let fileEntries = [];
        yield turbowalk_1.default(dirPath, (entries) => {
            fileEntries = fileEntries.concat(entries);
        })
            .catch({ systemCode: 3 }, () => Promise.resolve())
            .catch(err => ['ENOTFOUND', 'ENOENT'].includes(err.code)
            ? Promise.resolve() : Promise.reject(err));
        return fileEntries;
    });
}
exports.walkDirPath = walkDirPath;
function isInSlimVMLInstalled(api) {
    const state = api.getState();
    const mods = vortex_api_1.util.getSafe(state, ['persistent', 'mods', exports.GAME_ID], {});
    const profileId = vortex_api_1.selectors.lastActiveProfileForGame(state, exports.GAME_ID);
    const profile = vortex_api_1.selectors.profileById(state, profileId);
    const enabledMods = Object.keys(mods)
        .filter(key => vortex_api_1.util.getSafe(profile, ['modState', key, 'enabled'], false));
    return enabledMods.find(key => { var _a; return ((_a = mods[key]) === null || _a === void 0 ? void 0 : _a.type) === 'inslimvml-mod-loader'; }) !== undefined;
}
exports.isInSlimVMLInstalled = isInSlimVMLInstalled;
function genProps(context, profileId) {
    const state = context.api.getState();
    profileId = profileId !== undefined
        ? profileId
        : vortex_api_1.selectors.lastActiveProfileForGame(state, exports.GAME_ID);
    const profile = vortex_api_1.selectors.profileById(state, profileId);
    if ((profile === null || profile === void 0 ? void 0 : profile.gameId) !== exports.GAME_ID) {
        vortex_api_1.log('error', 'Invalid profile', { profile });
        return undefined;
    }
    const discovery = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', exports.GAME_ID], undefined);
    if ((discovery === null || discovery === void 0 ? void 0 : discovery.path) === undefined) {
        vortex_api_1.log('error', 'Game is not discovered', { profile, discovery });
        return undefined;
    }
    return { state, profile, discovery };
}
exports.genProps = genProps;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDBEQUE4QztBQUM5QywyQ0FBeUQ7QUFFNUMsUUFBQSxPQUFPLEdBQUcsU0FBUyxDQUFDO0FBQ3BCLFFBQUEsUUFBUSxHQUFHLFFBQVEsQ0FBQztBQUVwQixRQUFBLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDdkIsUUFBQSxvQkFBb0IsR0FBRyxlQUFlLENBQUM7QUFDdkMsUUFBQSxnQkFBZ0IsR0FBRyxhQUFhLENBQUM7QUFNakMsUUFBQSxlQUFlLEdBQUc7SUFDN0IsZUFBZSxFQUFFLGFBQWEsRUFBRSxjQUFjLEVBQUUscUJBQXFCO0lBQ3JFLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUscUJBQXFCLEVBQUUscUJBQXFCO0lBQzdGLHVCQUF1QixFQUFFLHVCQUF1QixFQUFFLGFBQWEsRUFBRSxxQkFBcUI7SUFDdEYsZ0JBQWdCLEVBQUUsb0JBQW9CLEVBQUUsb0JBQW9CLEVBQUUsc0JBQXNCO0lBQ3BGLDJCQUEyQixFQUFFLDJCQUEyQixFQUFFLG1CQUFtQjtJQUM3RSxtQkFBbUI7Q0FDcEIsQ0FBQztBQVFGLFNBQXNCLFdBQVcsQ0FBQyxPQUFlOztRQUMvQyxJQUFJLFdBQVcsR0FBYSxFQUFFLENBQUM7UUFDL0IsTUFBTSxtQkFBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQWlCLEVBQUUsRUFBRTtZQUM3QyxXQUFXLEdBQUcsV0FBVyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM1QyxDQUFDLENBQUM7YUFDRCxLQUFLLENBQUMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLEVBQUUsR0FBRyxFQUFFLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRSxDQUFDO2FBQ2pELEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUMsV0FBVyxFQUFFLFFBQVEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO1lBQ3RELENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztRQUU3QyxPQUFPLFdBQVcsQ0FBQztJQUNyQixDQUFDO0NBQUE7QUFWRCxrQ0FVQztBQUVELFNBQWdCLG9CQUFvQixDQUFDLEdBQXdCO0lBQzNELE1BQU0sS0FBSyxHQUFHLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUM3QixNQUFNLElBQUksR0FDUixpQkFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLGVBQU8sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDO0lBQzNELE1BQU0sU0FBUyxHQUFHLHNCQUFTLENBQUMsd0JBQXdCLENBQUMsS0FBSyxFQUFFLGVBQU8sQ0FBQyxDQUFDO0lBQ3JFLE1BQU0sT0FBTyxHQUFHLHNCQUFTLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztJQUN4RCxNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztTQUNsQyxNQUFNLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxpQkFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQyxVQUFVLEVBQUUsR0FBRyxFQUFFLFNBQVMsQ0FBQyxFQUFFLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDN0UsT0FBTyxXQUFXLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFdBQUMsT0FBQSxPQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsMENBQUUsSUFBSSxNQUFLLHNCQUFzQixDQUFBLEVBQUEsQ0FBQyxLQUFLLFNBQVMsQ0FBQztBQUMzRixDQUFDO0FBVEQsb0RBU0M7QUFFRCxTQUFnQixRQUFRLENBQUMsT0FBZ0MsRUFBRSxTQUFrQjtJQUMzRSxNQUFNLEtBQUssR0FBRyxPQUFPLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBQ3JDLFNBQVMsR0FBRyxTQUFTLEtBQUssU0FBUztRQUNqQyxDQUFDLENBQUMsU0FBUztRQUNYLENBQUMsQ0FBQyxzQkFBUyxDQUFDLHdCQUF3QixDQUFDLEtBQUssRUFBRSxlQUFPLENBQUMsQ0FBQztJQUN2RCxNQUFNLE9BQU8sR0FBRyxzQkFBUyxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7SUFDeEQsSUFBSSxDQUFBLE9BQU8sYUFBUCxPQUFPLHVCQUFQLE9BQU8sQ0FBRSxNQUFNLE1BQUssZUFBTyxFQUFFO1FBQy9CLGdCQUFHLENBQUMsT0FBTyxFQUFFLGlCQUFpQixFQUFFLEVBQUUsT0FBTyxFQUFFLENBQUMsQ0FBQztRQUM3QyxPQUFPLFNBQVMsQ0FBQztLQUNsQjtJQUNELE1BQU0sU0FBUyxHQUFHLGlCQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssRUFBRSxDQUFDLFVBQVUsRUFBRSxVQUFVLEVBQUUsWUFBWSxFQUFFLGVBQU8sQ0FBQyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0lBQ2xHLElBQUksQ0FBQSxTQUFTLGFBQVQsU0FBUyx1QkFBVCxTQUFTLENBQUUsSUFBSSxNQUFLLFNBQVMsRUFBRTtRQUNqQyxnQkFBRyxDQUFDLE9BQU8sRUFBRSx3QkFBd0IsRUFBRSxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDO1FBQy9ELE9BQU8sU0FBUyxDQUFDO0tBQ2xCO0lBQ0QsT0FBTyxFQUFFLEtBQUssRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLENBQUM7QUFDdkMsQ0FBQztBQWhCRCw0QkFnQkMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHVyYm93YWxrLCB7IElFbnRyeSB9IGZyb20gJ3R1cmJvd2Fsayc7XHJcbmltcG9ydCB7IGxvZywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuZXhwb3J0IGNvbnN0IEdBTUVfSUQgPSAndmFsaGVpbSc7XHJcbmV4cG9ydCBjb25zdCBTVEVBTV9JRCA9ICc4OTI5NzAnO1xyXG5cclxuZXhwb3J0IGNvbnN0IFZCVUlMRF9FWFQgPSAnLnZidWlsZCc7XHJcbmV4cG9ydCBjb25zdCBJTlNMSU1WTUxfSURFTlRJRklFUiA9ICdpbnNsaW12bWwuaW5pJztcclxuZXhwb3J0IGNvbnN0IERPT1JTVE9QUEVSX0hPT0sgPSAnd2luaHR0cC5kbGwnO1xyXG5cclxuLy8gVGhlc2UgYXJlIGZpbGVzIHdoaWNoIGFyZSBjcnVjaWFsIHRvIFZhbGhlaW0ncyBtb2RkaW5nIHBhdHRlcm4gYW5kIGl0IGFwcGVhcnNcclxuLy8gIHRoYXQgbWFueSBtb2RzIG9uIFZvcnRleCBhcmUgY3VycmVudGx5IGRpc3RyaWJ1dGluZyB0aGVzZSBhcyBwYXJ0IG9mIHRoZWlyIG1vZC5cclxuLy8gIE5lZWRsZXNzIHRvIHNheSwgd2UgZG9uJ3Qgd2FudCB0aGVzZSBkZXBsb3llZCBvciByZXBvcnRpbmcgYW55IGNvbmZsaWN0cyBhc1xyXG4vLyAgVm9ydGV4IGlzIGFscmVhZHkgZGlzdHJpYnV0aW5nIHRoZW0uXHJcbmV4cG9ydCBjb25zdCBJR05PUkFCTEVfRklMRVMgPSBbXHJcbiAgJ21hbmlmZXN0Lmpzb24nLCAnQmVwSW5FeC5jZmcnLCAnMEhhcm1vbnkuZGxsJywgJ2Rvb3JzdG9wX2NvbmZpZy5pbmknLFxyXG4gICcwSGFybW9ueS54bWwnLCAnMEhhcm1vbnkyMC5kbGwnLCAnQmVwSW5FeC5kbGwnLCAnQmVwSW5FeC5IYXJtb255LmRsbCcsICdCZXBJbkV4Lkhhcm1vbnkueG1sJyxcclxuICAnQmVwSW5FeC5QcmVsb2FkZXIuZGxsJywgJ0JlcEluRXguUHJlbG9hZGVyLnhtbCcsICdCZXBJbkV4LnhtbCcsICdIYXJtb255WEludGVyb3AuZGxsJyxcclxuICAnTW9uby5DZWNpbC5kbGwnLCAnTW9uby5DZWNpbC5NZGIuZGxsJywgJ01vbm8uQ2VjaWwuUGRiLmRsbCcsICdNb25vLkNlY2lsLlJvY2tzLmRsbCcsXHJcbiAgJ01vbm9Nb2QuUnVudGltZURldG91ci5kbGwnLCAnTW9ub01vZC5SdW50aW1lRGV0b3VyLnhtbCcsICdNb25vTW9kLlV0aWxzLmRsbCcsXHJcbiAgJ01vbm9Nb2QuVXRpbHMueG1sJyxcclxuXTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSVByb3BzIHtcclxuICBzdGF0ZTogdHlwZXMuSVN0YXRlO1xyXG4gIHByb2ZpbGU6IHR5cGVzLklQcm9maWxlO1xyXG4gIGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhbGtEaXJQYXRoKGRpclBhdGg6IHN0cmluZyk6IFByb21pc2U8SUVudHJ5W10+IHtcclxuICBsZXQgZmlsZUVudHJpZXM6IElFbnRyeVtdID0gW107XHJcbiAgYXdhaXQgdHVyYm93YWxrKGRpclBhdGgsIChlbnRyaWVzOiBJRW50cnlbXSkgPT4ge1xyXG4gICAgZmlsZUVudHJpZXMgPSBmaWxlRW50cmllcy5jb25jYXQoZW50cmllcyk7XHJcbiAgfSlcclxuICAuY2F0Y2goeyBzeXN0ZW1Db2RlOiAzIH0sICgpID0+IFByb21pc2UucmVzb2x2ZSgpKVxyXG4gIC5jYXRjaChlcnIgPT4gWydFTk9URk9VTkQnLCAnRU5PRU5UJ10uaW5jbHVkZXMoZXJyLmNvZGUpXHJcbiAgICA/IFByb21pc2UucmVzb2x2ZSgpIDogUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcblxyXG4gIHJldHVybiBmaWxlRW50cmllcztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGlzSW5TbGltVk1MSW5zdGFsbGVkKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSkge1xyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBwcm9maWxlSWQgPSBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlID0gc2VsZWN0b3JzLnByb2ZpbGVCeUlkKHN0YXRlLCBwcm9maWxlSWQpO1xyXG4gIGNvbnN0IGVuYWJsZWRNb2RzID0gT2JqZWN0LmtleXMobW9kcylcclxuICAgIC5maWx0ZXIoa2V5ID0+IHV0aWwuZ2V0U2FmZShwcm9maWxlLCBbJ21vZFN0YXRlJywga2V5LCAnZW5hYmxlZCddLCBmYWxzZSkpO1xyXG4gIHJldHVybiBlbmFibGVkTW9kcy5maW5kKGtleSA9PiBtb2RzW2tleV0/LnR5cGUgPT09ICdpbnNsaW12bWwtbW9kLWxvYWRlcicpICE9PSB1bmRlZmluZWQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZW5Qcm9wcyhjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCwgcHJvZmlsZUlkPzogc3RyaW5nKTogSVByb3BzIHtcclxuICBjb25zdCBzdGF0ZSA9IGNvbnRleHQuYXBpLmdldFN0YXRlKCk7XHJcbiAgcHJvZmlsZUlkID0gcHJvZmlsZUlkICE9PSB1bmRlZmluZWRcclxuICAgID8gcHJvZmlsZUlkXHJcbiAgICA6IHNlbGVjdG9ycy5sYXN0QWN0aXZlUHJvZmlsZUZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gIGNvbnN0IHByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByb2ZpbGVJZCk7XHJcbiAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgbG9nKCdlcnJvcicsICdJbnZhbGlkIHByb2ZpbGUnLCB7IHByb2ZpbGUgfSk7XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxuICBjb25zdCBkaXNjb3ZlcnkgPSB1dGlsLmdldFNhZmUoc3RhdGUsIFsnc2V0dGluZ3MnLCAnZ2FtZU1vZGUnLCAnZGlzY292ZXJlZCcsIEdBTUVfSURdLCB1bmRlZmluZWQpO1xyXG4gIGlmIChkaXNjb3Zlcnk/LnBhdGggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgbG9nKCdlcnJvcicsICdHYW1lIGlzIG5vdCBkaXNjb3ZlcmVkJywgeyBwcm9maWxlLCBkaXNjb3ZlcnkgfSk7XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxuICByZXR1cm4geyBzdGF0ZSwgcHJvZmlsZSwgZGlzY292ZXJ5IH07XHJcbn1cclxuIl19