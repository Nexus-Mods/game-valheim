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
exports.genInstructions = exports.genProps = exports.isInSlimVMLInstalled = exports.walkDirPath = exports.IGNORABLE_FILES = exports.ISVML_SKIP = exports.BIX_SVML = exports.DOORSTOPPER_HOOK = exports.INSLIMVML_IDENTIFIER = exports.OBJ_EXT = exports.FBX_EXT = exports.VBUILD_EXT = exports.BETTER_CONT_EXT = exports.STEAM_ID = exports.isValheimGame = exports.GAME_ID_SERVER = exports.GAME_ID = void 0;
const turbowalk_1 = __importDefault(require("turbowalk"));
const vortex_api_1 = require("vortex-api");
exports.GAME_ID = 'valheim';
exports.GAME_ID_SERVER = 'valheimserver';
exports.isValheimGame = (gameId) => [exports.GAME_ID_SERVER, exports.GAME_ID].includes(gameId);
exports.STEAM_ID = '892970';
exports.BETTER_CONT_EXT = '.bettercontinents';
exports.VBUILD_EXT = '.vbuild';
exports.FBX_EXT = '.fbx';
exports.OBJ_EXT = '.obj';
exports.INSLIMVML_IDENTIFIER = 'inslimvml.ini';
exports.DOORSTOPPER_HOOK = 'winhttp.dll';
exports.BIX_SVML = 'slimvml.loader.dll';
exports.ISVML_SKIP = [exports.BIX_SVML, 'slimassist.dll', '0harmony.dll'];
exports.IGNORABLE_FILES = [
    'LICENSE', 'manifest.json', 'BepInEx.cfg', '0Harmony.dll', 'doorstop_config.ini', 'icon.png', 'README.md',
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
        return undefined;
    }
    const discovery = vortex_api_1.util.getSafe(state, ['settings', 'gameMode', 'discovered', exports.GAME_ID], undefined);
    if ((discovery === null || discovery === void 0 ? void 0 : discovery.path) === undefined) {
        return undefined;
    }
    return { api: context.api, state, profile, discovery };
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDBEQUE4QztBQUM5QywyQ0FBeUQ7QUFHNUMsUUFBQSxPQUFPLEdBQUcsU0FBUyxDQUFDO0FBQ3BCLFFBQUEsY0FBYyxHQUFHLGVBQWUsQ0FBQztBQUNqQyxRQUFBLGFBQWEsR0FBRyxDQUFDLE1BQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxzQkFBYyxFQUFFLGVBQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUUvRSxRQUFBLFFBQVEsR0FBRyxRQUFRLENBQUM7QUFFcEIsUUFBQSxlQUFlLEdBQUcsbUJBQW1CLENBQUM7QUFDdEMsUUFBQSxVQUFVLEdBQUcsU0FBUyxDQUFDO0FBQ3ZCLFFBQUEsT0FBTyxHQUFHLE1BQU0sQ0FBQztBQUNqQixRQUFBLE9BQU8sR0FBRyxNQUFNLENBQUM7QUFDakIsUUFBQSxvQkFBb0IsR0FBRyxlQUFlLENBQUM7QUFDdkMsUUFBQSxnQkFBZ0IsR0FBRyxhQUFhLENBQUM7QUFDakMsUUFBQSxRQUFRLEdBQUcsb0JBQW9CLENBQUM7QUFDaEMsUUFBQSxVQUFVLEdBQUcsQ0FBQyxnQkFBUSxFQUFFLGdCQUFnQixFQUFFLGNBQWMsQ0FBQyxDQUFDO0FBTTFELFFBQUEsZUFBZSxHQUFHO0lBQzdCLFNBQVMsRUFBRSxlQUFlLEVBQUUsYUFBYSxFQUFFLGNBQWMsRUFBRSxxQkFBcUIsRUFBRSxVQUFVLEVBQUUsV0FBVztJQUN6RyxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLHFCQUFxQixFQUFFLHFCQUFxQjtJQUM3Rix1QkFBdUIsRUFBRSx1QkFBdUIsRUFBRSxhQUFhLEVBQUUscUJBQXFCO0lBQ3RGLGdCQUFnQixFQUFFLG9CQUFvQixFQUFFLG9CQUFvQixFQUFFLHNCQUFzQjtJQUNwRiwyQkFBMkIsRUFBRSwyQkFBMkIsRUFBRSxtQkFB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QUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsQ0FBQztBQUN6RCxDQUFDO0FBakJELDRCQWlCQztBQUVELFNBQWdCLGVBQWUsQ0FBQyxPQUFlLEVBQ2YsUUFBZ0IsRUFDaEIsT0FBaUI7SUFDL0MsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDO1NBQy9DLE1BQU0sQ0FBQyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsRUFBRTtRQUN0QixNQUFNLFdBQVcsR0FBVyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDckUsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNULElBQUksRUFBRSxNQUFNO1lBQ1osTUFBTSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3JCLFdBQVc7U0FDWixDQUFDLENBQUM7UUFDSCxPQUFPLEtBQUssQ0FBQztJQUNmLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNYLENBQUM7QUFiRCwwQ0FhQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0dXJib3dhbGssIHsgSUVudHJ5IH0gZnJvbSAndHVyYm93YWxrJztcclxuaW1wb3J0IHsgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5leHBvcnQgZGVjbGFyZSB0eXBlIFBhY2tUeXBlID0gJ25vbmUnIHwgJ2NvcmVfbGliJyB8ICd1bnN0cmlwcGVkX2NvcmxpYic7XHJcbmV4cG9ydCBjb25zdCBHQU1FX0lEID0gJ3ZhbGhlaW0nO1xyXG5leHBvcnQgY29uc3QgR0FNRV9JRF9TRVJWRVIgPSAndmFsaGVpbXNlcnZlcic7XHJcbmV4cG9ydCBjb25zdCBpc1ZhbGhlaW1HYW1lID0gKGdhbWVJZDogc3RyaW5nKSA9PiBbR0FNRV9JRF9TRVJWRVIsIEdBTUVfSURdLmluY2x1ZGVzKGdhbWVJZCk7XHJcblxyXG5leHBvcnQgY29uc3QgU1RFQU1fSUQgPSAnODkyOTcwJztcclxuXHJcbmV4cG9ydCBjb25zdCBCRVRURVJfQ09OVF9FWFQgPSAnLmJldHRlcmNvbnRpbmVudHMnO1xyXG5leHBvcnQgY29uc3QgVkJVSUxEX0VYVCA9ICcudmJ1aWxkJztcclxuZXhwb3J0IGNvbnN0IEZCWF9FWFQgPSAnLmZieCc7XHJcbmV4cG9ydCBjb25zdCBPQkpfRVhUID0gJy5vYmonO1xyXG5leHBvcnQgY29uc3QgSU5TTElNVk1MX0lERU5USUZJRVIgPSAnaW5zbGltdm1sLmluaSc7XHJcbmV4cG9ydCBjb25zdCBET09SU1RPUFBFUl9IT09LID0gJ3dpbmh0dHAuZGxsJztcclxuZXhwb3J0IGNvbnN0IEJJWF9TVk1MID0gJ3NsaW12bWwubG9hZGVyLmRsbCc7XHJcbmV4cG9ydCBjb25zdCBJU1ZNTF9TS0lQID0gW0JJWF9TVk1MLCAnc2xpbWFzc2lzdC5kbGwnLCAnMGhhcm1vbnkuZGxsJ107XHJcblxyXG4vLyBUaGVzZSBhcmUgZmlsZXMgd2hpY2ggYXJlIGNydWNpYWwgdG8gVmFsaGVpbSdzIG1vZGRpbmcgcGF0dGVybiBhbmQgaXQgYXBwZWFyc1xyXG4vLyAgdGhhdCBtYW55IG1vZHMgb24gVm9ydGV4IGFyZSBjdXJyZW50bHkgZGlzdHJpYnV0aW5nIHRoZXNlIGFzIHBhcnQgb2YgdGhlaXIgbW9kLlxyXG4vLyAgTmVlZGxlc3MgdG8gc2F5LCB3ZSBkb24ndCB3YW50IHRoZXNlIGRlcGxveWVkIG9yIHJlcG9ydGluZyBhbnkgY29uZmxpY3RzIGFzXHJcbi8vICBWb3J0ZXggaXMgYWxyZWFkeSBkaXN0cmlidXRpbmcgdGhlbS5cclxuZXhwb3J0IGNvbnN0IElHTk9SQUJMRV9GSUxFUyA9IFtcclxuICAnTElDRU5TRScsICdtYW5pZmVzdC5qc29uJywgJ0JlcEluRXguY2ZnJywgJzBIYXJtb255LmRsbCcsICdkb29yc3RvcF9jb25maWcuaW5pJywgJ2ljb24ucG5nJywgJ1JFQURNRS5tZCcsXHJcbiAgJzBIYXJtb255LnhtbCcsICcwSGFybW9ueTIwLmRsbCcsICdCZXBJbkV4LmRsbCcsICdCZXBJbkV4Lkhhcm1vbnkuZGxsJywgJ0JlcEluRXguSGFybW9ueS54bWwnLFxyXG4gICdCZXBJbkV4LlByZWxvYWRlci5kbGwnLCAnQmVwSW5FeC5QcmVsb2FkZXIueG1sJywgJ0JlcEluRXgueG1sJywgJ0hhcm1vbnlYSW50ZXJvcC5kbGwnLFxyXG4gICdNb25vLkNlY2lsLmRsbCcsICdNb25vLkNlY2lsLk1kYi5kbGwnLCAnTW9uby5DZWNpbC5QZGIuZGxsJywgJ01vbm8uQ2VjaWwuUm9ja3MuZGxsJyxcclxuICAnTW9ub01vZC5SdW50aW1lRGV0b3VyLmRsbCcsICdNb25vTW9kLlJ1bnRpbWVEZXRvdXIueG1sJywgJ01vbm9Nb2QuVXRpbHMuZGxsJyxcclxuICAnTW9ub01vZC5VdGlscy54bWwnLFxyXG5dO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJUHJvcHMge1xyXG4gIGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaTtcclxuICBzdGF0ZTogdHlwZXMuSVN0YXRlO1xyXG4gIHByb2ZpbGU6IHR5cGVzLklQcm9maWxlO1xyXG4gIGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJQXJndW1lbnQge1xyXG4gIGFyZ3VtZW50OiBzdHJpbmc7XHJcbiAgdmFsdWU/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSVNDTURQcm9wcyB7XHJcbiAgZ2FtZUlkOiBzdHJpbmc7XHJcbiAgc3RlYW1BcHBJZDogbnVtYmVyO1xyXG4gIGNhbGxiYWNrPzogKGVycjogRXJyb3IsIGRhdGE6IGFueSkgPT4gdm9pZDtcclxuICBhcmd1bWVudHM6IElBcmd1bWVudFtdO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2Fsa0RpclBhdGgoZGlyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxJRW50cnlbXT4ge1xyXG4gIGxldCBmaWxlRW50cmllczogSUVudHJ5W10gPSBbXTtcclxuICBhd2FpdCB0dXJib3dhbGsoZGlyUGF0aCwgKGVudHJpZXM6IElFbnRyeVtdKSA9PiB7XHJcbiAgICBmaWxlRW50cmllcyA9IGZpbGVFbnRyaWVzLmNvbmNhdChlbnRyaWVzKTtcclxuICB9KVxyXG4gIC5jYXRjaCh7IHN5c3RlbUNvZGU6IDMgfSwgKCkgPT4gUHJvbWlzZS5yZXNvbHZlKCkpXHJcbiAgLmNhdGNoKGVyciA9PiBbJ0VOT1RGT1VORCcsICdFTk9FTlQnXS5pbmNsdWRlcyhlcnIuY29kZSlcclxuICAgID8gUHJvbWlzZS5yZXNvbHZlKCkgOiBQcm9taXNlLnJlamVjdChlcnIpKTtcclxuXHJcbiAgcmV0dXJuIGZpbGVFbnRyaWVzO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaXNJblNsaW1WTUxJbnN0YWxsZWQoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpKSB7XHJcbiAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IHByb2ZpbGVJZCA9IHNlbGVjdG9ycy5sYXN0QWN0aXZlUHJvZmlsZUZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gIGNvbnN0IHByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByb2ZpbGVJZCk7XHJcbiAgY29uc3QgZW5hYmxlZE1vZHMgPSBPYmplY3Qua2V5cyhtb2RzKVxyXG4gICAgLmZpbHRlcihrZXkgPT4gdXRpbC5nZXRTYWZlKHByb2ZpbGUsIFsnbW9kU3RhdGUnLCBrZXksICdlbmFibGVkJ10sIGZhbHNlKSk7XHJcbiAgcmV0dXJuIGVuYWJsZWRNb2RzLmZpbmQoa2V5ID0+IG1vZHNba2V5XT8udHlwZSA9PT0gJ2luc2xpbXZtbC1tb2QtbG9hZGVyJykgIT09IHVuZGVmaW5lZDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdlblByb3BzKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0LCBwcm9maWxlSWQ/OiBzdHJpbmcpOiBJUHJvcHMge1xyXG4gIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICBwcm9maWxlSWQgPSBwcm9maWxlSWQgIT09IHVuZGVmaW5lZFxyXG4gICAgPyBwcm9maWxlSWRcclxuICAgIDogc2VsZWN0b3JzLmxhc3RBY3RpdmVQcm9maWxlRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJvZmlsZUlkKTtcclxuICBpZiAocHJvZmlsZT8uZ2FtZUlkICE9PSBHQU1FX0lEKSB7XHJcbiAgICAvLyBUaGlzIGlzIHRvbyBzcGFtbXkuXHJcbiAgICAvLyBsb2coJ2RlYnVnJywgJ0ludmFsaWQgcHJvZmlsZScsIHsgcHJvZmlsZSB9KTtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG4gIGNvbnN0IGRpc2NvdmVyeSA9IHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydzZXR0aW5ncycsICdnYW1lTW9kZScsICdkaXNjb3ZlcmVkJywgR0FNRV9JRF0sIHVuZGVmaW5lZCk7XHJcbiAgaWYgKGRpc2NvdmVyeT8ucGF0aCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAvLyBsb2coJ2RlYnVnJywgJ0dhbWUgaXMgbm90IGRpc2NvdmVyZWQnLCB7IHByb2ZpbGUsIGRpc2NvdmVyeSB9KTtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG4gIHJldHVybiB7IGFwaTogY29udGV4dC5hcGksIHN0YXRlLCBwcm9maWxlLCBkaXNjb3ZlcnkgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdlbkluc3RydWN0aW9ucyhzcmNQYXRoOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzdFBhdGg6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRyaWVzOiBJRW50cnlbXSk6IHR5cGVzLklJbnN0cnVjdGlvbltdIHtcclxuICByZXR1cm4gZW50cmllcy5maWx0ZXIoZW50cnkgPT4gIWVudHJ5LmlzRGlyZWN0b3J5KVxyXG4gICAgLnJlZHVjZSgoYWNjdW0sIGl0ZXIpID0+IHtcclxuICAgICAgY29uc3QgZGVzdGluYXRpb246IHN0cmluZyA9IGl0ZXIuZmlsZVBhdGgucmVwbGFjZShzcmNQYXRoLCBkZXN0UGF0aCk7XHJcbiAgICAgIGFjY3VtLnB1c2goe1xyXG4gICAgICAgIHR5cGU6ICdjb3B5JyxcclxuICAgICAgICBzb3VyY2U6IGl0ZXIuZmlsZVBhdGgsXHJcbiAgICAgICAgZGVzdGluYXRpb24sXHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gYWNjdW07XHJcbiAgICB9LCBbXSk7XHJcbn1cclxuIl19