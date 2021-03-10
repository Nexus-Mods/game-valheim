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
exports.genInstructions = exports.genProps = exports.isInSlimVMLInstalled = exports.walkDirPath = exports.IGNORABLE_FILES = exports.ISVML_SKIP = exports.BIX_SVML = exports.DOORSTOPPER_HOOK = exports.INSLIMVML_IDENTIFIER = exports.OBJ_EXT = exports.FBX_EXT = exports.VBUILD_EXT = exports.STEAM_ID = exports.GAME_ID = void 0;
const turbowalk_1 = __importDefault(require("turbowalk"));
const vortex_api_1 = require("vortex-api");
exports.GAME_ID = 'valheim';
exports.STEAM_ID = '892970';
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDBEQUE4QztBQUM5QywyQ0FBeUQ7QUFFNUMsUUFBQSxPQUFPLEdBQUcsU0FBUyxDQUFDO0FBQ3BCLFFBQUEsUUFBUSxHQUFHLFFBQVEsQ0FBQztBQUVwQixRQUFBLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDdkIsUUFBQSxPQUFPLEdBQUcsTUFBTSxDQUFDO0FBQ2pCLFFBQUEsT0FBTyxHQUFHLE1BQU0sQ0FBQztBQUNqQixRQUFBLG9CQUFvQixHQUFHLGVBQWUsQ0FBQztBQUN2QyxRQUFBLGdCQUFnQixHQUFHLGFBQWEsQ0FBQztBQUNqQyxRQUFBLFFBQVEsR0FBRyxvQkFBb0IsQ0FBQztBQUNoQyxRQUFBLFVBQVUsR0FBRyxDQUFDLGdCQUFRLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFNMUQsUUFBQSxlQUFlLEdBQUc7SUFDN0IsU0FBUyxFQUFFLGVBQWUsRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLHFCQUFxQixFQUFFLFVBQVUsRUFBRSxXQUFXO0lBQ3pHLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUscUJBQXFCLEVBQUUscUJBQXFCO0lBQzdGLHVCQUF1QixFQUFFLHVCQUF1QixFQUFFLGFBQWEsRUFBRSxxQkFBcUI7SUFDdEYsZ0JBQWdCLEVBQUUsb0JBQW9CLEVBQUUsb0JBQW9CLEVBQUUsc0JBQXNCO0lBQ3BGLDJCQUEyQixFQUFFLDJCQUEyQixFQUFFLG1CQUFtQjtJQUM3RSxtQkFBbUI7Q0FDcEIsQ0FBQztBQVNGLFNBQXNCLFdBQVcsQ0FBQyxPQUFlOztRQUMvQyxJQUFJLFdBQVcsR0FBYSxFQUFFLENBQUM7UUFDL0IsTUFBTSxtQkFBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQWlCLEVBQUUsRUFBRTtZQUM3QyxXQUFXLEdBQUcsV0FBVyxDQUFDLE1B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S0FBSyxDQUFDLFdBQVcsQ0FBQztTQUMvQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7UUFDdEIsTUFBTSxXQUFXLEdBQVcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3JFLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDVCxJQUFJLEVBQUUsTUFBTTtZQUNaLE1BQU0sRUFBRSxJQUFJLENBQUMsUUFBUTtZQUNyQixXQUFXO1NBQ1osQ0FBQyxDQUFDO1FBQ0gsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDWCxDQUFDO0FBYkQsMENBYUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHVyYm93YWxrLCB7IElFbnRyeSB9IGZyb20gJ3R1cmJvd2Fsayc7XHJcbmltcG9ydCB7IGxvZywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuZXhwb3J0IGNvbnN0IEdBTUVfSUQgPSAndmFsaGVpbSc7XHJcbmV4cG9ydCBjb25zdCBTVEVBTV9JRCA9ICc4OTI5NzAnO1xyXG5cclxuZXhwb3J0IGNvbnN0IFZCVUlMRF9FWFQgPSAnLnZidWlsZCc7XHJcbmV4cG9ydCBjb25zdCBGQlhfRVhUID0gJy5mYngnO1xyXG5leHBvcnQgY29uc3QgT0JKX0VYVCA9ICcub2JqJztcclxuZXhwb3J0IGNvbnN0IElOU0xJTVZNTF9JREVOVElGSUVSID0gJ2luc2xpbXZtbC5pbmknO1xyXG5leHBvcnQgY29uc3QgRE9PUlNUT1BQRVJfSE9PSyA9ICd3aW5odHRwLmRsbCc7XHJcbmV4cG9ydCBjb25zdCBCSVhfU1ZNTCA9ICdzbGltdm1sLmxvYWRlci5kbGwnO1xyXG5leHBvcnQgY29uc3QgSVNWTUxfU0tJUCA9IFtCSVhfU1ZNTCwgJ3NsaW1hc3Npc3QuZGxsJywgJzBoYXJtb255LmRsbCddO1xyXG5cclxuLy8gVGhlc2UgYXJlIGZpbGVzIHdoaWNoIGFyZSBjcnVjaWFsIHRvIFZhbGhlaW0ncyBtb2RkaW5nIHBhdHRlcm4gYW5kIGl0IGFwcGVhcnNcclxuLy8gIHRoYXQgbWFueSBtb2RzIG9uIFZvcnRleCBhcmUgY3VycmVudGx5IGRpc3RyaWJ1dGluZyB0aGVzZSBhcyBwYXJ0IG9mIHRoZWlyIG1vZC5cclxuLy8gIE5lZWRsZXNzIHRvIHNheSwgd2UgZG9uJ3Qgd2FudCB0aGVzZSBkZXBsb3llZCBvciByZXBvcnRpbmcgYW55IGNvbmZsaWN0cyBhc1xyXG4vLyAgVm9ydGV4IGlzIGFscmVhZHkgZGlzdHJpYnV0aW5nIHRoZW0uXHJcbmV4cG9ydCBjb25zdCBJR05PUkFCTEVfRklMRVMgPSBbXHJcbiAgJ0xJQ0VOU0UnLCAnbWFuaWZlc3QuanNvbicsICdCZXBJbkV4LmNmZycsICcwSGFybW9ueS5kbGwnLCAnZG9vcnN0b3BfY29uZmlnLmluaScsICdpY29uLnBuZycsICdSRUFETUUubWQnLFxyXG4gICcwSGFybW9ueS54bWwnLCAnMEhhcm1vbnkyMC5kbGwnLCAnQmVwSW5FeC5kbGwnLCAnQmVwSW5FeC5IYXJtb255LmRsbCcsICdCZXBJbkV4Lkhhcm1vbnkueG1sJyxcclxuICAnQmVwSW5FeC5QcmVsb2FkZXIuZGxsJywgJ0JlcEluRXguUHJlbG9hZGVyLnhtbCcsICdCZXBJbkV4LnhtbCcsICdIYXJtb255WEludGVyb3AuZGxsJyxcclxuICAnTW9uby5DZWNpbC5kbGwnLCAnTW9uby5DZWNpbC5NZGIuZGxsJywgJ01vbm8uQ2VjaWwuUGRiLmRsbCcsICdNb25vLkNlY2lsLlJvY2tzLmRsbCcsXHJcbiAgJ01vbm9Nb2QuUnVudGltZURldG91ci5kbGwnLCAnTW9ub01vZC5SdW50aW1lRGV0b3VyLnhtbCcsICdNb25vTW9kLlV0aWxzLmRsbCcsXHJcbiAgJ01vbm9Nb2QuVXRpbHMueG1sJyxcclxuXTtcclxuXHJcbmV4cG9ydCBpbnRlcmZhY2UgSVByb3BzIHtcclxuICBhcGk/OiB0eXBlcy5JRXh0ZW5zaW9uQXBpO1xyXG4gIHN0YXRlOiB0eXBlcy5JU3RhdGU7XHJcbiAgcHJvZmlsZTogdHlwZXMuSVByb2ZpbGU7XHJcbiAgZGlzY292ZXJ5OiB0eXBlcy5JRGlzY292ZXJ5UmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gd2Fsa0RpclBhdGgoZGlyUGF0aDogc3RyaW5nKTogUHJvbWlzZTxJRW50cnlbXT4ge1xyXG4gIGxldCBmaWxlRW50cmllczogSUVudHJ5W10gPSBbXTtcclxuICBhd2FpdCB0dXJib3dhbGsoZGlyUGF0aCwgKGVudHJpZXM6IElFbnRyeVtdKSA9PiB7XHJcbiAgICBmaWxlRW50cmllcyA9IGZpbGVFbnRyaWVzLmNvbmNhdChlbnRyaWVzKTtcclxuICB9KVxyXG4gIC5jYXRjaCh7IHN5c3RlbUNvZGU6IDMgfSwgKCkgPT4gUHJvbWlzZS5yZXNvbHZlKCkpXHJcbiAgLmNhdGNoKGVyciA9PiBbJ0VOT1RGT1VORCcsICdFTk9FTlQnXS5pbmNsdWRlcyhlcnIuY29kZSlcclxuICAgID8gUHJvbWlzZS5yZXNvbHZlKCkgOiBQcm9taXNlLnJlamVjdChlcnIpKTtcclxuXHJcbiAgcmV0dXJuIGZpbGVFbnRyaWVzO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gaXNJblNsaW1WTUxJbnN0YWxsZWQoYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpKSB7XHJcbiAgY29uc3Qgc3RhdGUgPSBhcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9ID1cclxuICAgIHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG4gIGNvbnN0IHByb2ZpbGVJZCA9IHNlbGVjdG9ycy5sYXN0QWN0aXZlUHJvZmlsZUZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gIGNvbnN0IHByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByb2ZpbGVJZCk7XHJcbiAgY29uc3QgZW5hYmxlZE1vZHMgPSBPYmplY3Qua2V5cyhtb2RzKVxyXG4gICAgLmZpbHRlcihrZXkgPT4gdXRpbC5nZXRTYWZlKHByb2ZpbGUsIFsnbW9kU3RhdGUnLCBrZXksICdlbmFibGVkJ10sIGZhbHNlKSk7XHJcbiAgcmV0dXJuIGVuYWJsZWRNb2RzLmZpbmQoa2V5ID0+IG1vZHNba2V5XT8udHlwZSA9PT0gJ2luc2xpbXZtbC1tb2QtbG9hZGVyJykgIT09IHVuZGVmaW5lZDtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdlblByb3BzKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0LCBwcm9maWxlSWQ/OiBzdHJpbmcpOiBJUHJvcHMge1xyXG4gIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICBwcm9maWxlSWQgPSBwcm9maWxlSWQgIT09IHVuZGVmaW5lZFxyXG4gICAgPyBwcm9maWxlSWRcclxuICAgIDogc2VsZWN0b3JzLmxhc3RBY3RpdmVQcm9maWxlRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJvZmlsZUlkKTtcclxuICBpZiAocHJvZmlsZT8uZ2FtZUlkICE9PSBHQU1FX0lEKSB7XHJcbiAgICAvLyBUaGlzIGlzIHRvbyBzcGFtbXkuXHJcbiAgICAvLyBsb2coJ2RlYnVnJywgJ0ludmFsaWQgcHJvZmlsZScsIHsgcHJvZmlsZSB9KTtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG4gIGNvbnN0IGRpc2NvdmVyeSA9IHV0aWwuZ2V0U2FmZShzdGF0ZSwgWydzZXR0aW5ncycsICdnYW1lTW9kZScsICdkaXNjb3ZlcmVkJywgR0FNRV9JRF0sIHVuZGVmaW5lZCk7XHJcbiAgaWYgKGRpc2NvdmVyeT8ucGF0aCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAvLyBsb2coJ2RlYnVnJywgJ0dhbWUgaXMgbm90IGRpc2NvdmVyZWQnLCB7IHByb2ZpbGUsIGRpc2NvdmVyeSB9KTtcclxuICAgIHJldHVybiB1bmRlZmluZWQ7XHJcbiAgfVxyXG4gIHJldHVybiB7IGFwaTogY29udGV4dC5hcGksIHN0YXRlLCBwcm9maWxlLCBkaXNjb3ZlcnkgfTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGdlbkluc3RydWN0aW9ucyhzcmNQYXRoOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZGVzdFBhdGg6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBlbnRyaWVzOiBJRW50cnlbXSk6IHR5cGVzLklJbnN0cnVjdGlvbltdIHtcclxuICByZXR1cm4gZW50cmllcy5maWx0ZXIoZW50cnkgPT4gIWVudHJ5LmlzRGlyZWN0b3J5KVxyXG4gICAgLnJlZHVjZSgoYWNjdW0sIGl0ZXIpID0+IHtcclxuICAgICAgY29uc3QgZGVzdGluYXRpb246IHN0cmluZyA9IGl0ZXIuZmlsZVBhdGgucmVwbGFjZShzcmNQYXRoLCBkZXN0UGF0aCk7XHJcbiAgICAgIGFjY3VtLnB1c2goe1xyXG4gICAgICAgIHR5cGU6ICdjb3B5JyxcclxuICAgICAgICBzb3VyY2U6IGl0ZXIuZmlsZVBhdGgsXHJcbiAgICAgICAgZGVzdGluYXRpb24sXHJcbiAgICAgIH0pO1xyXG4gICAgICByZXR1cm4gYWNjdW07XHJcbiAgICB9LCBbXSk7XHJcbn1cclxuIl19