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
exports.removeDir = exports.guessModId = exports.genInstructions = exports.genProps = exports.isInSlimVMLInstalled = exports.walkDirPath = exports.IGNORABLE_FILES = exports.NEXUS = exports.ISVML_SKIP = exports.BIX_SVML = exports.DOORSTOPPER_HOOK = exports.INSLIMVML_IDENTIFIER = exports.OBJ_EXT = exports.FBX_EXT = exports.VBUILD_EXT = exports.BETTER_CONT_EXT = exports.STEAM_ID = exports.isValheimGame = exports.GAME_ID_SERVER = exports.GAME_ID = void 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDBEQUE4QztBQUM5QywyQ0FBNkQ7QUFHaEQsUUFBQSxPQUFPLEdBQUcsU0FBUyxDQUFDO0FBQ3BCLFFBQUEsY0FBYyxHQUFHLGVBQWUsQ0FBQztBQUN2QyxNQUFNLGFBQWEsR0FBRyxDQUFDLE1BQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxzQkFBYyxFQUFFLGVBQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUEvRSxRQUFBLGFBQWEsaUJBQWtFO0FBRS9FLFFBQUEsUUFBUSxHQUFHLFFBQVEsQ0FBQztBQUVwQixRQUFBLGVBQWUsR0FBRyxtQkFBbUIsQ0FBQztBQUN0QyxRQUFBLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDdkIsUUFBQSxPQUFPLEdBQUcsTUFBTSxDQUFDO0FBQ2pCLFFBQUEsT0FBTyxHQUFHLE1BQU0sQ0FBQztBQUNqQixRQUFBLG9CQUFvQixHQUFHLGVBQWUsQ0FBQztBQUN2QyxRQUFBLGdCQUFnQixHQUFHLGFBQWEsQ0FBQztBQUNqQyxRQUFBLFFBQVEsR0FBRyxvQkFBb0IsQ0FBQztBQUNoQyxRQUFBLFVBQVUsR0FBRyxDQUFDLGdCQUFRLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFFMUQsUUFBQSxLQUFLLEdBQUcsbUJBQW1CLENBQUM7QUFNNUIsUUFBQSxlQUFlLEdBQUc7SUFDN0IsU0FBUyxFQUFFLGVBQWUsRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLHFCQUFxQixFQUFFLFVBQVUsRUFBRSxXQUFXO0lBQ3pHLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUscUJBQXFCLEVBQUUscUJBQXFCO0lBQzdGLHVCQUF1QixFQUFFLHVCQUF1QixFQUFFLGFBQWEsRUFBRSxxQkFBcUI7SUFDdEYsZ0JBQWdCLEVBQUUsb0JBQW9CLEVB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LENBQUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3hFLEtBQUssTUFBTSxLQUFLLElBQUksU0FBUyxFQUFFO1lBQzdCLElBQUk7Z0JBQ0YsTUFBTSxlQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUN0QztZQUFDLE9BQU8sR0FBRyxFQUFFO2dCQUNaLElBQUEsZ0JBQUcsRUFBQyxPQUFPLEVBQUUsdUJBQXVCLEVBQUUsR0FBRyxDQUFDLENBQUM7YUFDNUM7U0FDRjtJQUNILENBQUM7Q0FBQTtBQVZELDhCQVVDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHR1cmJvd2FsaywgeyBJRW50cnkgfSBmcm9tICd0dXJib3dhbGsnO1xyXG5pbXBvcnQgeyBmcywgbG9nLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcblxyXG5leHBvcnQgZGVjbGFyZSB0eXBlIFBhY2tUeXBlID0gJ25vbmUnIHwgJ2NvcmVfbGliJyB8ICd1bnN0cmlwcGVkX2NvcmxpYic7XHJcbmV4cG9ydCBjb25zdCBHQU1FX0lEID0gJ3ZhbGhlaW0nO1xyXG5leHBvcnQgY29uc3QgR0FNRV9JRF9TRVJWRVIgPSAndmFsaGVpbXNlcnZlcic7XHJcbmV4cG9ydCBjb25zdCBpc1ZhbGhlaW1HYW1lID0gKGdhbWVJZDogc3RyaW5nKSA9PiBbR0FNRV9JRF9TRVJWRVIsIEdBTUVfSURdLmluY2x1ZGVzKGdhbWVJZCk7XHJcblxyXG5leHBvcnQgY29uc3QgU1RFQU1fSUQgPSAnODkyOTcwJztcclxuXHJcbmV4cG9ydCBjb25zdCBCRVRURVJfQ09OVF9FWFQgPSAnLmJldHRlcmNvbnRpbmVudHMnO1xyXG5leHBvcnQgY29uc3QgVkJVSUxEX0VYVCA9ICcudmJ1aWxkJztcclxuZXhwb3J0IGNvbnN0IEZCWF9FWFQgPSAnLmZieCc7XHJcbmV4cG9ydCBjb25zdCBPQkpfRVhUID0gJy5vYmonO1xyXG5leHBvcnQgY29uc3QgSU5TTElNVk1MX0lERU5USUZJRVIgPSAnaW5zbGltdm1sLmluaSc7XHJcbmV4cG9ydCBjb25zdCBET09SU1RPUFBFUl9IT09LID0gJ3dpbmh0dHAuZGxsJztcclxuZXhwb3J0IGNvbnN0IEJJWF9TVk1MID0gJ3NsaW12bWwubG9hZGVyLmRsbCc7XHJcbmV4cG9ydCBjb25zdCBJU1ZNTF9TS0lQID0gW0JJWF9TVk1MLCAnc2xpbWFzc2lzdC5kbGwnLCAnMGhhcm1vbnkuZGxsJ107XHJcblxyXG5leHBvcnQgY29uc3QgTkVYVVMgPSAnd3d3Lm5leHVzbW9kcy5jb20nO1xyXG5cclxuLy8gVGhlc2UgYXJlIGZpbGVzIHdoaWNoIGFyZSBjcnVjaWFsIHRvIFZhbGhlaW0ncyBtb2RkaW5nIHBhdHRlcm4gYW5kIGl0IGFwcGVhcnNcclxuLy8gIHRoYXQgbWFueSBtb2RzIG9uIFZvcnRleCBhcmUgY3VycmVudGx5IGRpc3RyaWJ1dGluZyB0aGVzZSBhcyBwYXJ0IG9mIHRoZWlyIG1vZC5cclxuLy8gIE5lZWRsZXNzIHRvIHNheSwgd2UgZG9uJ3Qgd2FudCB0aGVzZSBkZXBsb3llZCBvciByZXBvcnRpbmcgYW55IGNvbmZsaWN0cyBhc1xyXG4vLyAgVm9ydGV4IGlzIGFscmVhZHkgZGlzdHJpYnV0aW5nIHRoZW0uXHJcbmV4cG9ydCBjb25zdCBJR05PUkFCTEVfRklMRVMgPSBbXHJcbiAgJ0xJQ0VOU0UnLCAnbWFuaWZlc3QuanNvbicsICdCZXBJbkV4LmNmZycsICcwSGFybW9ueS5kbGwnLCAnZG9vcnN0b3BfY29uZmlnLmluaScsICdpY29uLnBuZycsICdSRUFETUUubWQnLFxyXG4gICcwSGFybW9ueS54bWwnLCAnMEhhcm1vbnkyMC5kbGwnLCAnQmVwSW5FeC5kbGwnLCAnQmVwSW5FeC5IYXJtb255LmRsbCcsICdCZXBJbkV4Lkhhcm1vbnkueG1sJyxcclxuICAnQmVwSW5FeC5QcmVsb2FkZXIuZGxsJywgJ0JlcEluRXguUHJlbG9hZGVyLnhtbCcsICdCZXBJbkV4LnhtbCcsICdIYXJtb255WEludGVyb3AuZGxsJyxcclxuICAnTW9uby5DZWNpbC5kbGwnLCAnTW9uby5DZWNpbC5NZGIuZGxsJywgJ01vbm8uQ2VjaWwuUGRiLmRsbCcsICdNb25vLkNlY2lsLlJvY2tzLmRsbCcsXHJcbiAgJ01vbm9Nb2QuUnVudGltZURldG91ci5kbGwnLCAnTW9ub01vZC5SdW50aW1lRGV0b3VyLnhtbCcsICdNb25vTW9kLlV0aWxzLmRsbCcsXHJcbiAgJ01vbm9Nb2QuVXRpbHMueG1sJyxcclxuXTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSVByb3BzIHtcclxuICBhcGk6IHR5cGVzLklFeHRlbnNpb25BcGk7XHJcbiAgc3RhdGU6IHR5cGVzLklTdGF0ZTtcclxuICBwcm9maWxlOiB0eXBlcy5JUHJvZmlsZTtcclxuICBkaXNjb3Zlcnk6IHR5cGVzLklEaXNjb3ZlcnlSZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSUFyZ3VtZW50IHtcclxuICBhcmd1bWVudDogc3RyaW5nO1xyXG4gIHZhbHVlPzogc3RyaW5nO1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIElTQ01EUHJvcHMge1xyXG4gIGdhbWVJZDogc3RyaW5nO1xyXG4gIHN0ZWFtQXBwSWQ6IG51bWJlcjtcclxuICBjYWxsYmFjaz86IChlcnI6IEVycm9yLCBkYXRhOiBhbnkpID0+IHZvaWQ7XHJcbiAgYXJndW1lbnRzOiBJQXJndW1lbnRbXTtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhbGtEaXJQYXRoKGRpclBhdGg6IHN0cmluZyk6IFByb21pc2U8SUVudHJ5W10+IHtcclxuICBsZXQgZmlsZUVudHJpZXM6IElFbnRyeVtdID0gW107XHJcbiAgYXdhaXQgdHVyYm93YWxrKGRpclBhdGgsIChlbnRyaWVzOiBJRW50cnlbXSkgPT4ge1xyXG4gICAgZmlsZUVudHJpZXMgPSBmaWxlRW50cmllcy5jb25jYXQoZW50cmllcyk7XHJcbiAgfSlcclxuICAuY2F0Y2goeyBzeXN0ZW1Db2RlOiAzIH0sICgpID0+IFByb21pc2UucmVzb2x2ZSgpKVxyXG4gIC5jYXRjaChlcnIgPT4gWydFTk9URk9VTkQnLCAnRU5PRU5UJ10uaW5jbHVkZXMoZXJyLmNvZGUpXHJcbiAgICA/IFByb21pc2UucmVzb2x2ZSgpIDogUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcblxyXG4gIHJldHVybiBmaWxlRW50cmllcztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGlzSW5TbGltVk1MSW5zdGFsbGVkKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSkge1xyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBwcm9maWxlSWQgPSBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlID0gc2VsZWN0b3JzLnByb2ZpbGVCeUlkKHN0YXRlLCBwcm9maWxlSWQpO1xyXG4gIGNvbnN0IGVuYWJsZWRNb2RzID0gT2JqZWN0LmtleXMobW9kcylcclxuICAgIC5maWx0ZXIoa2V5ID0+IHV0aWwuZ2V0U2FmZShwcm9maWxlLCBbJ21vZFN0YXRlJywga2V5LCAnZW5hYmxlZCddLCBmYWxzZSkpO1xyXG4gIHJldHVybiBlbmFibGVkTW9kcy5maW5kKGtleSA9PiBtb2RzW2tleV0/LnR5cGUgPT09ICdpbnNsaW12bWwtbW9kLWxvYWRlcicpICE9PSB1bmRlZmluZWQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZW5Qcm9wcyhhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIHByb2ZpbGVJZD86IHN0cmluZyk6IElQcm9wcyB7XHJcbiAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICBwcm9maWxlSWQgPSBwcm9maWxlSWQgIT09IHVuZGVmaW5lZFxyXG4gICAgPyBwcm9maWxlSWRcclxuICAgIDogc2VsZWN0b3JzLmxhc3RBY3RpdmVQcm9maWxlRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJvZmlsZUlkKTtcclxuICBpZiAocHJvZmlsZT8uZ2FtZUlkICE9PSBHQU1FX0lEKSB7XHJcbiAgICAvLyBUaGlzIGlzIHRvbyBzcGFtbXkuXHJcbiAgICAvLyBsb2coJ2RlYnVnJywgJ0ludmFsaWQgcHJvZmlsZScsIHsgcHJvZmlsZSB9KTtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG4gIGNvbnN0IGRpc2NvdmVyeSA9IHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydzZXR0aW5ncycsICdnYW1lTW9kZScsICdkaXNjb3ZlcmVkJywgR0FNRV9JRF0sIHVuZGVmaW5lZCk7XHJcbiAgaWYgKGRpc2NvdmVyeT8ucGF0aCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAvLyBsb2coJ2RlYnVnJywgJ0dhbWUgaXMgbm90IGRpc2NvdmVyZWQnLCB7IHByb2ZpbGUsIGRpc2NvdmVyeSB9KTtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG4gIHJldHVybiB7IGFwaSwgc3RhdGUsIHByb2ZpbGUsIGRpc2NvdmVyeSB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2VuSW5zdHJ1Y3Rpb25zKHNyY1BhdGg6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXN0UGF0aDogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudHJpZXM6IElFbnRyeVtdKTogdHlwZXMuSUluc3RydWN0aW9uW10ge1xyXG4gIHJldHVybiBlbnRyaWVzLmZpbHRlcihlbnRyeSA9PiAhZW50cnkuaXNEaXJlY3RvcnkpXHJcbiAgICAucmVkdWNlKChhY2N1bSwgaXRlcikgPT4ge1xyXG4gICAgICBjb25zdCBkZXN0aW5hdGlvbjogc3RyaW5nID0gaXRlci5maWxlUGF0aC5yZXBsYWNlKHNyY1BhdGgsIGRlc3RQYXRoKTtcclxuICAgICAgYWNjdW0ucHVzaCh7XHJcbiAgICAgICAgdHlwZTogJ2NvcHknLFxyXG4gICAgICAgIHNvdXJjZTogaXRlci5maWxlUGF0aCxcclxuICAgICAgICBkZXN0aW5hdGlvbixcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiBhY2N1bTtcclxuICAgIH0sIFtdKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGd1ZXNzTW9kSWQoZmlsZU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgbWF0Y2ggPSBmaWxlTmFtZS5tYXRjaCgvLShbMC05XSspLS8pO1xyXG4gIGlmIChtYXRjaCAhPT0gbnVsbCkge1xyXG4gICAgcmV0dXJuIG1hdGNoWzFdO1xyXG4gIH0gZWxzZSB7XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlbW92ZURpcihmaWxlUGF0aDogc3RyaW5nKSB7XHJcbiAgY29uc3QgZmlsZVBhdGhzID0gYXdhaXQgd2Fsa0RpclBhdGgoZmlsZVBhdGgpO1xyXG4gIGZpbGVQYXRocy5zb3J0KChsaHMsIHJocykgPT4gcmhzLmZpbGVQYXRoLmxlbmd0aCAtIGxocy5maWxlUGF0aC5sZW5ndGgpO1xyXG4gIGZvciAoY29uc3QgZW50cnkgb2YgZmlsZVBhdGhzKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBmcy5yZW1vdmVBc3luYyhlbnRyeS5maWxlUGF0aCk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgbG9nKCdkZWJ1ZycsICdmYWlsZWQgdG8gcmVtb3ZlIGZpbGUnLCBlcnIpO1xyXG4gICAgfVxyXG4gIH1cclxufVxyXG4iXX0=