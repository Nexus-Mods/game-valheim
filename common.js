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
exports.removeDir = exports.guessModId = exports.genInstructions = exports.genProps = exports.isInSlimVMLInstalled = exports.walkDirPath = exports.IGNORABLE_FILES = exports.NEXUS = exports.ISVML_SKIP = exports.CONF_MANAGER = exports.BIX_SVML = exports.DOORSTOPPER_HOOK = exports.INSLIMVML_IDENTIFIER = exports.OBJ_EXT = exports.FBX_EXT = exports.VBUILD_EXT = exports.BETTER_CONT_EXT = exports.STEAM_ID = exports.isValheimGame = exports.GAME_ID_SERVER = exports.GAME_ID = void 0;
const turbowalk_1 = __importDefault(require("turbowalk"));
const vortex_api_1 = require("vortex-api");
exports.GAME_ID = 'valheim';
exports.GAME_ID_SERVER = 'valheimserver';
const isValheimGame = (gameId) => [exports.GAME_ID_SERVER, exports.GAME_ID].includes(gameId);
exports.isValheimGame = isValheimGame;
exports.STEAM_ID = '892970';
exports.BETTER_CONT_EXT = '.bettercontinents';
exports.VBUILD_EXT = '.vbuild';
exports.FBX_EXT = '.fbx';
exports.OBJ_EXT = '.obj';
exports.INSLIMVML_IDENTIFIER = 'inslimvml.ini';
exports.DOORSTOPPER_HOOK = 'winhttp.dll';
exports.BIX_SVML = 'slimvml.loader.dll';
exports.CONF_MANAGER = 'configurationmanager.dll';
exports.ISVML_SKIP = [exports.BIX_SVML, 'slimassist.dll', '0harmony.dll'];
exports.NEXUS = 'www.nexusmods.com';
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
        yield (0, turbowalk_1.default)(dirPath, (entries) => {
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
function genProps(api, profileId) {
    const state = api.getState();
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
    return { api, state, profile, discovery };
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
function guessModId(fileName) {
    const match = fileName.match(/-([0-9]+)-/);
    if (match !== null) {
        return match[1];
    }
    else {
        return undefined;
    }
}
exports.guessModId = guessModId;
function removeDir(filePath) {
    return __awaiter(this, void 0, void 0, function* () {
        const filePaths = yield walkDirPath(filePath);
        filePaths.sort((lhs, rhs) => rhs.filePath.length - lhs.filePath.length);
        for (const entry of filePaths) {
            try {
                yield vortex_api_1.fs.removeAsync(entry.filePath);
            }
            catch (err) {
                (0, vortex_api_1.log)('debug', 'failed to remove file', err);
            }
        }
    });
}
exports.removeDir = removeDir;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDBEQUE4QztBQUM5QywyQ0FBNkQ7QUFHaEQsUUFBQSxPQUFPLEdBQUcsU0FBUyxDQUFDO0FBQ3BCLFFBQUEsY0FBYyxHQUFHLGVBQWUsQ0FBQztBQUN2QyxNQUFNLGFBQWEsR0FBRyxDQUFDLE1BQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxzQkFBYyxFQUFFLGVBQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUEvRSxRQUFBLGFBQWEsaUJBQWtFO0FBRS9FLFFBQUEsUUFBUSxHQUFHLFFBQVEsQ0FBQztBQUVwQixRQUFBLGVBQWUsR0FBRyxtQkFBbUIsQ0FBQztBQUN0QyxRQUFBLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDdkIsUUFBQSxPQUFPLEdBQUcsTUFBTSxDQUFDO0FBQ2pCLFFBQUEsT0FBTyxHQUFHLE1BQU0sQ0FBQztBQUNqQixRQUFBLG9CQUFvQixHQUFHLGVBQWUsQ0FBQztBQUN2QyxRQUFBLGdCQUFnQixHQUFHLGFBQWEsQ0FBQztBQUNqQyxRQUFBLFFBQVEsR0FBRyxvQkFBb0IsQ0FBQztBQUNoQyxRQUFBLFlBQVksR0FBRywwQkFBMEIsQ0FBQztBQUMxQyxRQUFBLFVBQVUsR0FBRyxDQUFDLGdCQUFRLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFFMUQsUUFBQSxLQUFLLEdBQUcsbUJBQW1CLENBQUM7QUFNNUIsUUFBQSxlQUFlLEdBQUc7SUFDN0IsU0FBUyxFQUFFLGVBQWUsRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLHFCQUFxQixFQUFFLFVBQVUsRUFBRSxXQUFXO0lBQ3pHLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUscUJBQXFCLEVBQUUscUJBQXFCO0lBQzdGLHVCQUF1QixFQUFFLHVCQUF1QixFQUFFLGFBQWEsRUFBRSxx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QUFHLENBQUMsUUFBUSxDQUFDLE1BQU0sR0FBRyxHQUFHLENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3hFLEtBQUssTUFBTSxLQUFLLElBQUksU0FBUyxFQUFFO1lBQzdCLElBQUk7Z0JBQ0YsTUFBTSxlQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUN0QztZQUFDLE9BQU8sR0FBRyxFQUFFO2dCQUNaLElBQUEsZ0JBQUcsRUFBQyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsR0FBRyxDQUFDLENBQUM7YUFDNUM7U0FDRjtJQUNILENBQUM7Q0FBQTtBQVZELDhCQVVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR1cmJvd2FsaywgeyBJRW50cnkgfSBmcm9tICd0dXJib3dhbGsnO1xyXG5pbXBvcnQgeyBmcywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5leHBvcnQgZGVjbGFyZSB0eXBlIFBhY2tUeXBlID0gJ25vbmUnIHwgJ2NvcmVfbGliJyB8ICd1bnN0cmlwcGVkX2NvcmxpYic7XHJcbmV4cG9ydCBjb25zdCBHQU1FX0lEID0gJ3ZhbGhlaW0nO1xyXG5leHBvcnQgY29uc3QgR0FNRV9JRF9TRVJWRVIgPSAndmFsaGVpbXNlcnZlcic7XHJcbmV4cG9ydCBjb25zdCBpc1ZhbGhlaW1HYW1lID0gKGdhbWVJZDogc3RyaW5nKSA9PiBbR0FNRV9JRF9TRVJWRVIsIEdBTUVfSURdLmluY2x1ZGVzKGdhbWVJZCk7XHJcblxyXG5leHBvcnQgY29uc3QgU1RFQU1fSUQgPSAnODkyOTcwJztcclxuXHJcbmV4cG9ydCBjb25zdCBCRVRURVJfQ09OVF9FWFQgPSAnLmJldHRlcmNvbnRpbmVudHMnO1xyXG5leHBvcnQgY29uc3QgVkJVSUxEX0VYVCA9ICcudmJ1aWxkJztcclxuZXhwb3J0IGNvbnN0IEZCWF9FWFQgPSAnLmZieCc7XHJcbmV4cG9ydCBjb25zdCBPQkpfRVhUID0gJy5vYmonO1xyXG5leHBvcnQgY29uc3QgSU5TTElNVk1MX0lERU5USUZJRVIgPSAnaW5zbGltdm1sLmluaSc7XHJcbmV4cG9ydCBjb25zdCBET09SU1RPUFBFUl9IT09LID0gJ3dpbmh0dHAuZGxsJztcclxuZXhwb3J0IGNvbnN0IEJJWF9TVk1MID0gJ3NsaW12bWwubG9hZGVyLmRsbCc7XHJcbmV4cG9ydCBjb25zdCBDT05GX01BTkFHRVIgPSAnY29uZmlndXJhdGlvbm1hbmFnZXIuZGxsJztcclxuZXhwb3J0IGNvbnN0IElTVk1MX1NLSVAgPSBbQklYX1NWTUwsICdzbGltYXNzaXN0LmRsbCcsICcwaGFybW9ueS5kbGwnXTtcclxuXHJcbmV4cG9ydCBjb25zdCBORVhVUyA9ICd3d3cubmV4dXNtb2RzLmNvbSc7XHJcblxyXG4vLyBUaGVzZSBhcmUgZmlsZXMgd2hpY2ggYXJlIGNydWNpYWwgdG8gVmFsaGVpbSdzIG1vZGRpbmcgcGF0dGVybiBhbmQgaXQgYXBwZWFyc1xyXG4vLyAgdGhhdCBtYW55IG1vZHMgb24gVm9ydGV4IGFyZSBjdXJyZW50bHkgZGlzdHJpYnV0aW5nIHRoZXNlIGFzIHBhcnQgb2YgdGhlaXIgbW9kLlxyXG4vLyAgTmVlZGxlc3MgdG8gc2F5LCB3ZSBkb24ndCB3YW50IHRoZXNlIGRlcGxveWVkIG9yIHJlcG9ydGluZyBhbnkgY29uZmxpY3RzIGFzXHJcbi8vICBWb3J0ZXggaXMgYWxyZWFkeSBkaXN0cmlidXRpbmcgdGhlbS5cclxuZXhwb3J0IGNvbnN0IElHTk9SQUJMRV9GSUxFUyA9IFtcclxuICAnTElDRU5TRScsICdtYW5pZmVzdC5qc29uJywgJ0JlcEluRXguY2ZnJywgJzBIYXJtb255LmRsbCcsICdkb29yc3RvcF9jb25maWcuaW5pJywgJ2ljb24ucG5nJywgJ1JFQURNRS5tZCcsXHJcbiAgJzBIYXJtb255LnhtbCcsICcwSGFybW9ueTIwLmRsbCcsICdCZXBJbkV4LmRsbCcsICdCZXBJbkV4Lkhhcm1vbnkuZGxsJywgJ0JlcEluRXguSGFybW9ueS54bWwnLFxyXG4gICdCZXBJbkV4LlByZWxvYWRlci5kbGwnLCAnQmVwSW5FeC5QcmVsb2FkZXIueG1sJywgJ0JlcEluRXgueG1sJywgJ0hhcm1vbnlYSW50ZXJvcC5kbGwnLFxyXG4gICdNb25vLkNlY2lsLmRsbCcsICdNb25vLkNlY2lsLk1kYi5kbGwnLCAnTW9uby5DZWNpbC5QZGIuZGxsJywgJ01vbm8uQ2VjaWwuUm9ja3MuZGxsJyxcclxuICAnTW9ub01vZC5SdW50aW1lRGV0b3VyLmRsbCcsICdNb25vTW9kLlJ1bnRpbWVEZXRvdXIueG1sJywgJ01vbm9Nb2QuVXRpbHMuZGxsJyxcclxuICAnTW9ub01vZC5VdGlscy54bWwnLFxyXG5dO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJUHJvcHMge1xyXG4gIGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaTtcclxuICBzdGF0ZTogdHlwZXMuSVN0YXRlO1xyXG4gIHByb2ZpbGU6IHR5cGVzLklQcm9maWxlO1xyXG4gIGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJQXJndW1lbnQge1xyXG4gIGFyZ3VtZW50OiBzdHJpbmc7XHJcbiAgdmFsdWU/OiBzdHJpbmc7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSVNDTURQcm9wcyB7XHJcbiAgZ2FtZUlkOiBzdHJpbmc7XHJcbiAgc3RlYW1BcHBJZDogbnVtYmVyO1xyXG4gIGNhbGxiYWNrPzogKGVycjogRXJyb3IsIGRhdGE6IGFueSkgPT4gdm9pZDtcclxuICBhcmd1bWVudHM6IElBcmd1bWVudFtdO1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2Fsa0RpclBhdGgoZGlyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxJRW50cnlbXT4ge1xyXG4gIGxldCBmaWxlRW50cmllczogSUVudHJ5W10gPSBbXTtcclxuICBhd2FpdCB0dXJib3dhbGsoZGlyUGF0aCwgKGVudHJpZXM6IElFbnRyeVtdKSA9PiB7XHJcbiAgICBmaWxlRW50cmllcyA9IGZpbGVFbnRyaWVzLmNvbmNhdChlbnRyaWVzKTtcclxuICB9KVxyXG4gIC5jYXRjaCh7IHN5c3RlbUNvZGU6IDMgfSwgKCkgPT4gUHJvbWlzZS5yZXNvbHZlKCkpXHJcbiAgLmNhdGNoKGVyciA9PiBbJ0VOT1RGT1VORCcsICdFTk9FTlQnXS5pbmNsdWRlcyhlcnIuY29kZSlcclxuICAgID8gUHJvbWlzZS5yZXNvbHZlKCkgOiBQcm9taXNlLnJlamVjdChlcnIpKTtcclxuXHJcbiAgcmV0dXJuIGZpbGVFbnRyaWVzO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaXNJblNsaW1WTUxJbnN0YWxsZWQoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpKSB7XHJcbiAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IHByb2ZpbGVJZCA9IHNlbGVjdG9ycy5sYXN0QWN0aXZlUHJvZmlsZUZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gIGNvbnN0IHByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByb2ZpbGVJZCk7XHJcbiAgY29uc3QgZW5hYmxlZE1vZHMgPSBPYmplY3Qua2V5cyhtb2RzKVxyXG4gICAgLmZpbHRlcihrZXkgPT4gdXRpbC5nZXRTYWZlKHByb2ZpbGUsIFsnbW9kU3RhdGUnLCBrZXksICdlbmFibGVkJ10sIGZhbHNlKSk7XHJcbiAgcmV0dXJuIGVuYWJsZWRNb2RzLmZpbmQoa2V5ID0+IG1vZHNba2V5XT8udHlwZSA9PT0gJ2luc2xpbXZtbC1tb2QtbG9hZGVyJykgIT09IHVuZGVmaW5lZDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdlblByb3BzKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgcHJvZmlsZUlkPzogc3RyaW5nKTogSVByb3BzIHtcclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIHByb2ZpbGVJZCA9IHByb2ZpbGVJZCAhPT0gdW5kZWZpbmVkXHJcbiAgICA/IHByb2ZpbGVJZFxyXG4gICAgOiBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlID0gc2VsZWN0b3JzLnByb2ZpbGVCeUlkKHN0YXRlLCBwcm9maWxlSWQpO1xyXG4gIGlmIChwcm9maWxlPy5nYW1lSWQgIT09IEdBTUVfSUQpIHtcclxuICAgIC8vIFRoaXMgaXMgdG9vIHNwYW1teS5cclxuICAgIC8vIGxvZygnZGVidWcnLCAnSW52YWxpZCBwcm9maWxlJywgeyBwcm9maWxlIH0pO1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9XHJcbiAgY29uc3QgZGlzY292ZXJ5ID0gdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3NldHRpbmdzJywgJ2dhbWVNb2RlJywgJ2Rpc2NvdmVyZWQnLCBHQU1FX0lEXSwgdW5kZWZpbmVkKTtcclxuICBpZiAoZGlzY292ZXJ5Py5wYXRoID09PSB1bmRlZmluZWQpIHtcclxuICAgIC8vIGxvZygnZGVidWcnLCAnR2FtZSBpcyBub3QgZGlzY292ZXJlZCcsIHsgcHJvZmlsZSwgZGlzY292ZXJ5IH0pO1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9XHJcbiAgcmV0dXJuIHsgYXBpLCBzdGF0ZSwgcHJvZmlsZSwgZGlzY292ZXJ5IH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZW5JbnN0cnVjdGlvbnMoc3JjUGF0aDogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc3RQYXRoOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50cmllczogSUVudHJ5W10pOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSB7XHJcbiAgcmV0dXJuIGVudHJpZXMuZmlsdGVyKGVudHJ5ID0+ICFlbnRyeS5pc0RpcmVjdG9yeSlcclxuICAgIC5yZWR1Y2UoKGFjY3VtLCBpdGVyKSA9PiB7XHJcbiAgICAgIGNvbnN0IGRlc3RpbmF0aW9uOiBzdHJpbmcgPSBpdGVyLmZpbGVQYXRoLnJlcGxhY2Uoc3JjUGF0aCwgZGVzdFBhdGgpO1xyXG4gICAgICBhY2N1bS5wdXNoKHtcclxuICAgICAgICB0eXBlOiAnY29weScsXHJcbiAgICAgICAgc291cmNlOiBpdGVyLmZpbGVQYXRoLFxyXG4gICAgICAgIGRlc3RpbmF0aW9uLFxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIGFjY3VtO1xyXG4gICAgfSwgW10pO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ3Vlc3NNb2RJZChmaWxlTmFtZTogc3RyaW5nKTogc3RyaW5nIHtcclxuICBjb25zdCBtYXRjaCA9IGZpbGVOYW1lLm1hdGNoKC8tKFswLTldKyktLyk7XHJcbiAgaWYgKG1hdGNoICE9PSBudWxsKSB7XHJcbiAgICByZXR1cm4gbWF0Y2hbMV07XHJcbiAgfSBlbHNlIHtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gcmVtb3ZlRGlyKGZpbGVQYXRoOiBzdHJpbmcpIHtcclxuICBjb25zdCBmaWxlUGF0aHMgPSBhd2FpdCB3YWxrRGlyUGF0aChmaWxlUGF0aCk7XHJcbiAgZmlsZVBhdGhzLnNvcnQoKGxocywgcmhzKSA9PiByaHMuZmlsZVBhdGgubGVuZ3RoIC0gbGhzLmZpbGVQYXRoLmxlbmd0aCk7XHJcbiAgZm9yIChjb25zdCBlbnRyeSBvZiBmaWxlUGF0aHMpIHtcclxuICAgIHRyeSB7XHJcbiAgICAgIGF3YWl0IGZzLnJlbW92ZUFzeW5jKGVudHJ5LmZpbGVQYXRoKTtcclxuICAgIH0gY2F0Y2ggKGVycikge1xyXG4gICAgICBsb2coJ2RlYnVnJywgJ2ZhaWxlZCB0byByZW1vdmUgZmlsZScsIGVycik7XHJcbiAgICB9XHJcbiAgfVxyXG59XHJcbiJdfQ==