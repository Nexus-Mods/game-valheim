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
exports.genInstructions = exports.genProps = exports.isInSlimVMLInstalled = exports.walkDirPath = exports.IGNORABLE_FILES = exports.DOORSTOPPER_HOOK = exports.INSLIMVML_IDENTIFIER = exports.VBUILD_EXT = exports.STEAM_ID = exports.GAME_ID = void 0;
const turbowalk_1 = __importDefault(require("turbowalk"));
const vortex_api_1 = require("vortex-api");
exports.GAME_ID = 'valheim';
exports.STEAM_ID = '892970';
exports.VBUILD_EXT = '.vbuild';
exports.INSLIMVML_IDENTIFIER = 'inslimvml.ini';
exports.DOORSTOPPER_HOOK = 'winhttp.dll';
exports.IGNORABLE_FILES = [
    'manifest.json', 'BepInEx.cfg', '0Harmony.dll', 'doorstop_config.ini', 'icon.png', 'readme.md',
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
        vortex_api_1.log('debug', 'Invalid profile', { profile });
        return undefined;
    }
    const discovery = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', exports.GAME_ID], undefined);
    if ((discovery === null || discovery === void 0 ? void 0 : discovery.path) === undefined) {
        vortex_api_1.log('debug', 'Game is not discovered', { profile, discovery });
        return undefined;
    }
    return { state, profile, discovery };
}
exports.genProps = genProps;
function genInstructions(srcPath, destPath, entries) {
    return entries.filter(entry => !entry.isDirectory)
        .reduce((accum, iter) => {
        const destination = iter.filePath.replace(srcPath, destPath);
        accum.push({
            type: 'copy',
            source: iter.filePath,
            destination,
        });
        return accum;
    }, []);
}
exports.genInstructions = genInstructions;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDBEQUE4QztBQUM5QywyQ0FBeUQ7QUFFNUMsUUFBQSxPQUFPLEdBQUcsU0FBUyxDQUFDO0FBQ3BCLFFBQUEsUUFBUSxHQUFHLFFBQVEsQ0FBQztBQUVwQixRQUFBLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDdkIsUUFBQSxvQkFBb0IsR0FBRyxlQUFlLENBQUM7QUFDdkMsUUFBQSxnQkFBZ0IsR0FBRyxhQUFhLENBQUM7QUFNakMsUUFBQSxlQUFlLEdBQUc7SUFDN0IsZUFBZSxFQUFFLGFBQWEsRUFBRSxjQUFjLEVBQUUscUJBQXFCLEVBQUUsVUFBVSxFQUFFLFdBQVc7SUFDOUYsY0FBYyxFQUFFLGdCQUFnQixFQUFFLGFBQWEsRUFBRSxxQkFBcUIsRUFBRSxxQkFBcUI7SUFDN0YsdUJBQXVCLEVBQUUsdUJBQXVCLEVBQUUsYUFBYSxFQUFFLHFCQUFxQjtJQUN0RixnQkFBZ0IsRUFBRSxvQkFBb0IsRUFBRSxvQkFBb0IsRUFBRSxzQkFBc0I7SUFDcEYsMkJBQTJCLEVBQUUsMkJBQTJCLEVBQUUsbUJBQW1CO0lBQzdFLG1CQUFtQjtDQUNwQixDQUFDO0FBUUYsU0FBc0IsV0FBVyxDQUFDLE9BQWU7O1FBQy9DLElBQUksV0FBVyxHQUFhLEVBQUUsQ0FBQztRQUMvQixNQUFNLG1CQUFTLENBQUMsT0FBTyxFQUFFLENBQUMsT0FBaUIsRUFBRSxFQUFFO1lBQzdDLFdBQVcsR0FBRyxXQUFXLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzVDLENBQUMsQ0FBQzthQUNELEtBQUssQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7YUFDakQsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxXQUFX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RUFBRTtRQUN0QixNQUFNLFdBQVcsR0FBVyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDckUsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNULElBQUksRUFBRSxNQUFNO1lBQ1osTUFBTSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3JCLFdBQVc7U0FDWixDQUFDLENBQUM7UUFDSCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNYLENBQUM7QUFiRCwwQ0FhQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0dXJib3dhbGssIHsgSUVudHJ5IH0gZnJvbSAndHVyYm93YWxrJztcclxuaW1wb3J0IHsgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5leHBvcnQgY29uc3QgR0FNRV9JRCA9ICd2YWxoZWltJztcclxuZXhwb3J0IGNvbnN0IFNURUFNX0lEID0gJzg5Mjk3MCc7XHJcblxyXG5leHBvcnQgY29uc3QgVkJVSUxEX0VYVCA9ICcudmJ1aWxkJztcclxuZXhwb3J0IGNvbnN0IElOU0xJTVZNTF9JREVOVElGSUVSID0gJ2luc2xpbXZtbC5pbmknO1xyXG5leHBvcnQgY29uc3QgRE9PUlNUT1BQRVJfSE9PSyA9ICd3aW5odHRwLmRsbCc7XHJcblxyXG4vLyBUaGVzZSBhcmUgZmlsZXMgd2hpY2ggYXJlIGNydWNpYWwgdG8gVmFsaGVpbSdzIG1vZGRpbmcgcGF0dGVybiBhbmQgaXQgYXBwZWFyc1xyXG4vLyAgdGhhdCBtYW55IG1vZHMgb24gVm9ydGV4IGFyZSBjdXJyZW50bHkgZGlzdHJpYnV0aW5nIHRoZXNlIGFzIHBhcnQgb2YgdGhlaXIgbW9kLlxyXG4vLyAgTmVlZGxlc3MgdG8gc2F5LCB3ZSBkb24ndCB3YW50IHRoZXNlIGRlcGxveWVkIG9yIHJlcG9ydGluZyBhbnkgY29uZmxpY3RzIGFzXHJcbi8vICBWb3J0ZXggaXMgYWxyZWFkeSBkaXN0cmlidXRpbmcgdGhlbS5cclxuZXhwb3J0IGNvbnN0IElHTk9SQUJMRV9GSUxFUyA9IFtcclxuICAnbWFuaWZlc3QuanNvbicsICdCZXBJbkV4LmNmZycsICcwSGFybW9ueS5kbGwnLCAnZG9vcnN0b3BfY29uZmlnLmluaScsICdpY29uLnBuZycsICdyZWFkbWUubWQnLFxyXG4gICcwSGFybW9ueS54bWwnLCAnMEhhcm1vbnkyMC5kbGwnLCAnQmVwSW5FeC5kbGwnLCAnQmVwSW5FeC5IYXJtb255LmRsbCcsICdCZXBJbkV4Lkhhcm1vbnkueG1sJyxcclxuICAnQmVwSW5FeC5QcmVsb2FkZXIuZGxsJywgJ0JlcEluRXguUHJlbG9hZGVyLnhtbCcsICdCZXBJbkV4LnhtbCcsICdIYXJtb255WEludGVyb3AuZGxsJyxcclxuICAnTW9uby5DZWNpbC5kbGwnLCAnTW9uby5DZWNpbC5NZGIuZGxsJywgJ01vbm8uQ2VjaWwuUGRiLmRsbCcsICdNb25vLkNlY2lsLlJvY2tzLmRsbCcsXHJcbiAgJ01vbm9Nb2QuUnVudGltZURldG91ci5kbGwnLCAnTW9ub01vZC5SdW50aW1lRGV0b3VyLnhtbCcsICdNb25vTW9kLlV0aWxzLmRsbCcsXHJcbiAgJ01vbm9Nb2QuVXRpbHMueG1sJyxcclxuXTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSVByb3BzIHtcclxuICBzdGF0ZTogdHlwZXMuSVN0YXRlO1xyXG4gIHByb2ZpbGU6IHR5cGVzLklQcm9maWxlO1xyXG4gIGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhbGtEaXJQYXRoKGRpclBhdGg6IHN0cmluZyk6IFByb21pc2U8SUVudHJ5W10+IHtcclxuICBsZXQgZmlsZUVudHJpZXM6IElFbnRyeVtdID0gW107XHJcbiAgYXdhaXQgdHVyYm93YWxrKGRpclBhdGgsIChlbnRyaWVzOiBJRW50cnlbXSkgPT4ge1xyXG4gICAgZmlsZUVudHJpZXMgPSBmaWxlRW50cmllcy5jb25jYXQoZW50cmllcyk7XHJcbiAgfSlcclxuICAuY2F0Y2goeyBzeXN0ZW1Db2RlOiAzIH0sICgpID0+IFByb21pc2UucmVzb2x2ZSgpKVxyXG4gIC5jYXRjaChlcnIgPT4gWydFTk9URk9VTkQnLCAnRU5PRU5UJ10uaW5jbHVkZXMoZXJyLmNvZGUpXHJcbiAgICA/IFByb21pc2UucmVzb2x2ZSgpIDogUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcblxyXG4gIHJldHVybiBmaWxlRW50cmllcztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGlzSW5TbGltVk1MSW5zdGFsbGVkKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSkge1xyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBwcm9maWxlSWQgPSBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlID0gc2VsZWN0b3JzLnByb2ZpbGVCeUlkKHN0YXRlLCBwcm9maWxlSWQpO1xyXG4gIGNvbnN0IGVuYWJsZWRNb2RzID0gT2JqZWN0LmtleXMobW9kcylcclxuICAgIC5maWx0ZXIoa2V5ID0+IHV0aWwuZ2V0U2FmZShwcm9maWxlLCBbJ21vZFN0YXRlJywga2V5LCAnZW5hYmxlZCddLCBmYWxzZSkpO1xyXG4gIHJldHVybiBlbmFibGVkTW9kcy5maW5kKGtleSA9PiBtb2RzW2tleV0/LnR5cGUgPT09ICdpbnNsaW12bWwtbW9kLWxvYWRlcicpICE9PSB1bmRlZmluZWQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZW5Qcm9wcyhjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCwgcHJvZmlsZUlkPzogc3RyaW5nKTogSVByb3BzIHtcclxuICBjb25zdCBzdGF0ZSA9IGNvbnRleHQuYXBpLmdldFN0YXRlKCk7XHJcbiAgcHJvZmlsZUlkID0gcHJvZmlsZUlkICE9PSB1bmRlZmluZWRcclxuICAgID8gcHJvZmlsZUlkXHJcbiAgICA6IHNlbGVjdG9ycy5sYXN0QWN0aXZlUHJvZmlsZUZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gIGNvbnN0IHByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByb2ZpbGVJZCk7XHJcbiAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgbG9nKCdkZWJ1ZycsICdJbnZhbGlkIHByb2ZpbGUnLCB7IHByb2ZpbGUgfSk7XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxuICBjb25zdCBkaXNjb3ZlcnkgPSB1dGlsLmdldFNhZmUoc3RhdGUsIFsnc2V0dGluZ3MnLCAnZ2FtZU1vZGUnLCAnZGlzY292ZXJlZCcsIEdBTUVfSURdLCB1bmRlZmluZWQpO1xyXG4gIGlmIChkaXNjb3Zlcnk/LnBhdGggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgbG9nKCdkZWJ1ZycsICdHYW1lIGlzIG5vdCBkaXNjb3ZlcmVkJywgeyBwcm9maWxlLCBkaXNjb3ZlcnkgfSk7XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxuICByZXR1cm4geyBzdGF0ZSwgcHJvZmlsZSwgZGlzY292ZXJ5IH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZW5JbnN0cnVjdGlvbnMoc3JjUGF0aDogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc3RQYXRoOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50cmllczogSUVudHJ5W10pOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSB7XHJcbiAgcmV0dXJuIGVudHJpZXMuZmlsdGVyKGVudHJ5ID0+ICFlbnRyeS5pc0RpcmVjdG9yeSlcclxuICAgIC5yZWR1Y2UoKGFjY3VtLCBpdGVyKSA9PiB7XHJcbiAgICAgIGNvbnN0IGRlc3RpbmF0aW9uOiBzdHJpbmcgPSBpdGVyLmZpbGVQYXRoLnJlcGxhY2Uoc3JjUGF0aCwgZGVzdFBhdGgpO1xyXG4gICAgICBhY2N1bS5wdXNoKHtcclxuICAgICAgICB0eXBlOiAnY29weScsXHJcbiAgICAgICAgc291cmNlOiBpdGVyLmZpbGVQYXRoLFxyXG4gICAgICAgIGRlc3RpbmF0aW9uLFxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIGFjY3VtO1xyXG4gICAgfSwgW10pO1xyXG59XHJcbiJdfQ==