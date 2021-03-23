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
exports.genInstructions = exports.genProps = exports.isInSlimVMLInstalled = exports.walkDirPath = exports.IGNORABLE_FILES = exports.ISVML_SKIP = exports.BIX_SVML = exports.DOORSTOPPER_HOOK = exports.INSLIMVML_IDENTIFIER = exports.OBJ_EXT = exports.FBX_EXT = exports.VBUILD_EXT = exports.BETTER_CONT_EXT = exports.STEAM_ID = exports.GAME_ID = void 0;
const turbowalk_1 = __importDefault(require("turbowalk"));
const vortex_api_1 = require("vortex-api");
exports.GAME_ID = 'valheim';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDBEQUE4QztBQUM5QywyQ0FBeUQ7QUFHNUMsUUFBQSxPQUFPLEdBQUcsU0FBUyxDQUFDO0FBQ3BCLFFBQUEsUUFBUSxHQUFHLFFBQVEsQ0FBQztBQUVwQixRQUFBLGVBQWUsR0FBRyxtQkFBbUIsQ0FBQztBQUN0QyxRQUFBLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDdkIsUUFBQSxPQUFPLEdBQUcsTUFBTSxDQUFDO0FBQ2pCLFFBQUEsT0FBTyxHQUFHLE1BQU0sQ0FBQztBQUNqQixRQUFBLG9CQUFvQixHQUFHLGVBQWUsQ0FBQztBQUN2QyxRQUFBLGdCQUFnQixHQUFHLGFBQWEsQ0FBQztBQUNqQyxRQUFBLFFBQVEsR0FBRyxvQkFBb0IsQ0FBQztBQUNoQyxRQUFBLFVBQVUsR0FBRyxDQUFDLGdCQUFRLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFNMUQsUUFBQSxlQUFlLEdBQUc7SUFDN0IsU0FBUyxFQUFFLGVBQWUsRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLHFCQUFxQixFQUFFLFVBQVUsRUFBRSxXQUFXO0lBQ3pHLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUscUJBQXFCLEVBQUUscUJBQXFCO0lBQzdGLHVCQUF1QixFQUFFLHVCQUF1QixFQUFFLGFBQWEsRUFBRSxxQkFBcUI7SUFDdEYsZ0JBQWdCLEVBQUUsb0JBQW9CLEVBQUUsb0JBQW9CLEVBQUUsc0JBQXNCO0lBQ3BGLDJCQUEyQixFQUFFLDJCQUEyQixFQUFFLG1CQUFtQjtJQUM3RSxtQkFBbUI7Q0FDcEIsQ0FBQztBQVNGLFNBQXNCLFdBQVcsQ0FBQyxPQUFlOztRQUMvQyxJQUFJLFdBQVcsR0FBYSxFQUFFLENBQUM7UUFDL0IsTUFBTSxtQkFBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQWlCLEVBQUUs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QU0sQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQztTQUMvQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7UUFDdEIsTUFBTSxXQUFXLEdBQVcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3JFLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDVCxJQUFJLEVBQUUsTUFBTTtZQUNaLE1BQU0sRUFBRSxJQUFJLENBQUMsUUFBUTtZQUNyQixXQUFXO1NBQ1osQ0FBQyxDQUFDO1FBQ0gsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDWCxDQUFDO0FBYkQsMENBYUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHVyYm93YWxrLCB7IElFbnRyeSB9IGZyb20gJ3R1cmJvd2Fsayc7XHJcbmltcG9ydCB7IGxvZywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuZXhwb3J0IGRlY2xhcmUgdHlwZSBQYWNrVHlwZSA9ICdub25lJyB8ICdjb3JlX2xpYicgfCAndW5zdHJpcHBlZF9jb3JsaWInO1xyXG5leHBvcnQgY29uc3QgR0FNRV9JRCA9ICd2YWxoZWltJztcclxuZXhwb3J0IGNvbnN0IFNURUFNX0lEID0gJzg5Mjk3MCc7XHJcblxyXG5leHBvcnQgY29uc3QgQkVUVEVSX0NPTlRfRVhUID0gJy5iZXR0ZXJjb250aW5lbnRzJztcclxuZXhwb3J0IGNvbnN0IFZCVUlMRF9FWFQgPSAnLnZidWlsZCc7XHJcbmV4cG9ydCBjb25zdCBGQlhfRVhUID0gJy5mYngnO1xyXG5leHBvcnQgY29uc3QgT0JKX0VYVCA9ICcub2JqJztcclxuZXhwb3J0IGNvbnN0IElOU0xJTVZNTF9JREVOVElGSUVSID0gJ2luc2xpbXZtbC5pbmknO1xyXG5leHBvcnQgY29uc3QgRE9PUlNUT1BQRVJfSE9PSyA9ICd3aW5odHRwLmRsbCc7XHJcbmV4cG9ydCBjb25zdCBCSVhfU1ZNTCA9ICdzbGltdm1sLmxvYWRlci5kbGwnO1xyXG5leHBvcnQgY29uc3QgSVNWTUxfU0tJUCA9IFtCSVhfU1ZNTCwgJ3NsaW1hc3Npc3QuZGxsJywgJzBoYXJtb255LmRsbCddO1xyXG5cclxuLy8gVGhlc2UgYXJlIGZpbGVzIHdoaWNoIGFyZSBjcnVjaWFsIHRvIFZhbGhlaW0ncyBtb2RkaW5nIHBhdHRlcm4gYW5kIGl0IGFwcGVhcnNcclxuLy8gIHRoYXQgbWFueSBtb2RzIG9uIFZvcnRleCBhcmUgY3VycmVudGx5IGRpc3RyaWJ1dGluZyB0aGVzZSBhcyBwYXJ0IG9mIHRoZWlyIG1vZC5cclxuLy8gIE5lZWRsZXNzIHRvIHNheSwgd2UgZG9uJ3Qgd2FudCB0aGVzZSBkZXBsb3llZCBvciByZXBvcnRpbmcgYW55IGNvbmZsaWN0cyBhc1xyXG4vLyAgVm9ydGV4IGlzIGFscmVhZHkgZGlzdHJpYnV0aW5nIHRoZW0uXHJcbmV4cG9ydCBjb25zdCBJR05PUkFCTEVfRklMRVMgPSBbXHJcbiAgJ0xJQ0VOU0UnLCAnbWFuaWZlc3QuanNvbicsICdCZXBJbkV4LmNmZycsICcwSGFybW9ueS5kbGwnLCAnZG9vcnN0b3BfY29uZmlnLmluaScsICdpY29uLnBuZycsICdSRUFETUUubWQnLFxyXG4gICcwSGFybW9ueS54bWwnLCAnMEhhcm1vbnkyMC5kbGwnLCAnQmVwSW5FeC5kbGwnLCAnQmVwSW5FeC5IYXJtb255LmRsbCcsICdCZXBJbkV4Lkhhcm1vbnkueG1sJyxcclxuICAnQmVwSW5FeC5QcmVsb2FkZXIuZGxsJywgJ0JlcEluRXguUHJlbG9hZGVyLnhtbCcsICdCZXBJbkV4LnhtbCcsICdIYXJtb255WEludGVyb3AuZGxsJyxcclxuICAnTW9uby5DZWNpbC5kbGwnLCAnTW9uby5DZWNpbC5NZGIuZGxsJywgJ01vbm8uQ2VjaWwuUGRiLmRsbCcsICdNb25vLkNlY2lsLlJvY2tzLmRsbCcsXHJcbiAgJ01vbm9Nb2QuUnVudGltZURldG91ci5kbGwnLCAnTW9ub01vZC5SdW50aW1lRGV0b3VyLnhtbCcsICdNb25vTW9kLlV0aWxzLmRsbCcsXHJcbiAgJ01vbm9Nb2QuVXRpbHMueG1sJyxcclxuXTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSVByb3BzIHtcclxuICBhcGk6IHR5cGVzLklFeHRlbnNpb25BcGk7XHJcbiAgc3RhdGU6IHR5cGVzLklTdGF0ZTtcclxuICBwcm9maWxlOiB0eXBlcy5JUHJvZmlsZTtcclxuICBkaXNjb3Zlcnk6IHR5cGVzLklEaXNjb3ZlcnlSZXN1bHQ7XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3YWxrRGlyUGF0aChkaXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPElFbnRyeVtdPiB7XHJcbiAgbGV0IGZpbGVFbnRyaWVzOiBJRW50cnlbXSA9IFtdO1xyXG4gIGF3YWl0IHR1cmJvd2FsayhkaXJQYXRoLCAoZW50cmllczogSUVudHJ5W10pID0+IHtcclxuICAgIGZpbGVFbnRyaWVzID0gZmlsZUVudHJpZXMuY29uY2F0KGVudHJpZXMpO1xyXG4gIH0pXHJcbiAgLmNhdGNoKHsgc3lzdGVtQ29kZTogMyB9LCAoKSA9PiBQcm9taXNlLnJlc29sdmUoKSlcclxuICAuY2F0Y2goZXJyID0+IFsnRU5PVEZPVU5EJywgJ0VOT0VOVCddLmluY2x1ZGVzKGVyci5jb2RlKVxyXG4gICAgPyBQcm9taXNlLnJlc29sdmUoKSA6IFByb21pc2UucmVqZWN0KGVycikpO1xyXG5cclxuICByZXR1cm4gZmlsZUVudHJpZXM7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBpc0luU2xpbVZNTEluc3RhbGxlZChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGkpIHtcclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IG1vZHM6IHsgW21vZElkOiBzdHJpbmddOiB0eXBlcy5JTW9kIH0gPVxyXG4gICAgdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcbiAgY29uc3QgcHJvZmlsZUlkID0gc2VsZWN0b3JzLmxhc3RBY3RpdmVQcm9maWxlRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJvZmlsZUlkKTtcclxuICBjb25zdCBlbmFibGVkTW9kcyA9IE9iamVjdC5rZXlzKG1vZHMpXHJcbiAgICAuZmlsdGVyKGtleSA9PiB1dGlsLmdldFNhZmUocHJvZmlsZSwgWydtb2RTdGF0ZScsIGtleSwgJ2VuYWJsZWQnXSwgZmFsc2UpKTtcclxuICByZXR1cm4gZW5hYmxlZE1vZHMuZmluZChrZXkgPT4gbW9kc1trZXldPy50eXBlID09PSAnaW5zbGltdm1sLW1vZC1sb2FkZXInKSAhPT0gdW5kZWZpbmVkO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2VuUHJvcHMoY29udGV4dDogdHlwZXMuSUV4dGVuc2lvbkNvbnRleHQsIHByb2ZpbGVJZD86IHN0cmluZyk6IElQcm9wcyB7XHJcbiAgY29uc3Qgc3RhdGUgPSBjb250ZXh0LmFwaS5nZXRTdGF0ZSgpO1xyXG4gIHByb2ZpbGVJZCA9IHByb2ZpbGVJZCAhPT0gdW5kZWZpbmVkXHJcbiAgICA/IHByb2ZpbGVJZFxyXG4gICAgOiBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlID0gc2VsZWN0b3JzLnByb2ZpbGVCeUlkKHN0YXRlLCBwcm9maWxlSWQpO1xyXG4gIGlmIChwcm9maWxlPy5nYW1lSWQgIT09IEdBTUVfSUQpIHtcclxuICAgIC8vIFRoaXMgaXMgdG9vIHNwYW1teS5cclxuICAgIC8vIGxvZygnZGVidWcnLCAnSW52YWxpZCBwcm9maWxlJywgeyBwcm9maWxlIH0pO1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9XHJcbiAgY29uc3QgZGlzY292ZXJ5ID0gdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3NldHRpbmdzJywgJ2dhbWVNb2RlJywgJ2Rpc2NvdmVyZWQnLCBHQU1FX0lEXSwgdW5kZWZpbmVkKTtcclxuICBpZiAoZGlzY292ZXJ5Py5wYXRoID09PSB1bmRlZmluZWQpIHtcclxuICAgIC8vIGxvZygnZGVidWcnLCAnR2FtZSBpcyBub3QgZGlzY292ZXJlZCcsIHsgcHJvZmlsZSwgZGlzY292ZXJ5IH0pO1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9XHJcbiAgcmV0dXJuIHsgYXBpOiBjb250ZXh0LmFwaSwgc3RhdGUsIHByb2ZpbGUsIGRpc2NvdmVyeSB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2VuSW5zdHJ1Y3Rpb25zKHNyY1BhdGg6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXN0UGF0aDogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudHJpZXM6IElFbnRyeVtdKTogdHlwZXMuSUluc3RydWN0aW9uW10ge1xyXG4gIHJldHVybiBlbnRyaWVzLmZpbHRlcihlbnRyeSA9PiAhZW50cnkuaXNEaXJlY3RvcnkpXHJcbiAgICAucmVkdWNlKChhY2N1bSwgaXRlcikgPT4ge1xyXG4gICAgICBjb25zdCBkZXN0aW5hdGlvbjogc3RyaW5nID0gaXRlci5maWxlUGF0aC5yZXBsYWNlKHNyY1BhdGgsIGRlc3RQYXRoKTtcclxuICAgICAgYWNjdW0ucHVzaCh7XHJcbiAgICAgICAgdHlwZTogJ2NvcHknLFxyXG4gICAgICAgIHNvdXJjZTogaXRlci5maWxlUGF0aCxcclxuICAgICAgICBkZXN0aW5hdGlvbixcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiBhY2N1bTtcclxuICAgIH0sIFtdKTtcclxufVxyXG4iXX0=