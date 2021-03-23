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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDBEQUE4QztBQUM5QywyQ0FBeUQ7QUFHNUMsUUFBQSxPQUFPLEdBQUcsU0FBUyxDQUFDO0FBQ3BCLFFBQUEsUUFBUSxHQUFHLFFBQVEsQ0FBQztBQUVwQixRQUFBLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDdkIsUUFBQSxPQUFPLEdBQUcsTUFBTSxDQUFDO0FBQ2pCLFFBQUEsT0FBTyxHQUFHLE1BQU0sQ0FBQztBQUNqQixRQUFBLG9CQUFvQixHQUFHLGVBQWUsQ0FBQztBQUN2QyxRQUFBLGdCQUFnQixHQUFHLGFBQWEsQ0FBQztBQUNqQyxRQUFBLFFBQVEsR0FBRyxvQkFBb0IsQ0FBQztBQUNoQyxRQUFBLFVBQVUsR0FBRyxDQUFDLGdCQUFRLEVBQUUsZ0JBQWdCLEVBQUUsY0FBYyxDQUFDLENBQUM7QUFNMUQsUUFBQSxlQUFlLEdBQUc7SUFDN0IsU0FBUyxFQUFFLGVBQWUsRUFBRSxhQUFhLEVBQUUsY0FBYyxFQUFFLHFCQUFxQixFQUFFLFVBQVUsRUFBRSxXQUFXO0lBQ3pHLGNBQWMsRUFBRSxnQkFBZ0IsRUFBRSxhQUFhLEVBQUUscUJBQXFCLEVBQUUscUJBQXFCO0lBQzdGLHVCQUF1QixFQUFFLHVCQUF1QixFQUFFLGFBQWEsRUFBRSxxQkFBcUI7SUFDdEYsZ0JBQWdCLEVBQUUsb0JBQW9CLEVBQUUsb0JBQW9CLEVBQUUsc0JBQXNCO0lBQ3BGLDJCQUEyQixFQUFFLDJCQUEyQixFQUFFLG1CQUFtQjtJQUM3RSxtQkFBbUI7Q0FDcEIsQ0FBQztBQVNGLFNBQXNCLFdBQVcsQ0FBQyxPQUFlOztRQUMvQyxJQUFJLFdBQVcsR0FBYSxFQUFFLENBQUM7UUFDL0IsTUFBTSxtQkFBUyxDQUFDLE9BQU8sRUFBRSxDQUFDLE9BQWlCLEVBQUUsRUFBRTtZQUM3QyxXQUFXLEdBQUcsV0FBVyxDQUFDLE1B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S0FBSyxDQUFDLFdBQVcsQ0FBQztTQUMvQyxNQUFNLENBQUMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUU7UUFDdEIsTUFBTSxXQUFXLEdBQVcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFFBQVEsQ0FBQyxDQUFDO1FBQ3JFLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDVCxJQUFJLEVBQUUsTUFBTTtZQUNaLE1BQU0sRUFBRSxJQUFJLENBQUMsUUFBUTtZQUNyQixXQUFXO1NBQ1osQ0FBQyxDQUFDO1FBQ0gsT0FBTyxLQUFLLENBQUM7SUFDZixDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDWCxDQUFDO0FBYkQsMENBYUMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgdHVyYm93YWxrLCB7IElFbnRyeSB9IGZyb20gJ3R1cmJvd2Fsayc7XHJcbmltcG9ydCB7IGxvZywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuZXhwb3J0IGRlY2xhcmUgdHlwZSBQYWNrVHlwZSA9ICdub25lJyB8ICdjb3JlX2xpYicgfCAndW5zdHJpcHBlZF9jb3JsaWInO1xyXG5leHBvcnQgY29uc3QgR0FNRV9JRCA9ICd2YWxoZWltJztcclxuZXhwb3J0IGNvbnN0IFNURUFNX0lEID0gJzg5Mjk3MCc7XHJcblxyXG5leHBvcnQgY29uc3QgVkJVSUxEX0VYVCA9ICcudmJ1aWxkJztcclxuZXhwb3J0IGNvbnN0IEZCWF9FWFQgPSAnLmZieCc7XHJcbmV4cG9ydCBjb25zdCBPQkpfRVhUID0gJy5vYmonO1xyXG5leHBvcnQgY29uc3QgSU5TTElNVk1MX0lERU5USUZJRVIgPSAnaW5zbGltdm1sLmluaSc7XHJcbmV4cG9ydCBjb25zdCBET09SU1RPUFBFUl9IT09LID0gJ3dpbmh0dHAuZGxsJztcclxuZXhwb3J0IGNvbnN0IEJJWF9TVk1MID0gJ3NsaW12bWwubG9hZGVyLmRsbCc7XHJcbmV4cG9ydCBjb25zdCBJU1ZNTF9TS0lQID0gW0JJWF9TVk1MLCAnc2xpbWFzc2lzdC5kbGwnLCAnMGhhcm1vbnkuZGxsJ107XHJcblxyXG4vLyBUaGVzZSBhcmUgZmlsZXMgd2hpY2ggYXJlIGNydWNpYWwgdG8gVmFsaGVpbSdzIG1vZGRpbmcgcGF0dGVybiBhbmQgaXQgYXBwZWFyc1xyXG4vLyAgdGhhdCBtYW55IG1vZHMgb24gVm9ydGV4IGFyZSBjdXJyZW50bHkgZGlzdHJpYnV0aW5nIHRoZXNlIGFzIHBhcnQgb2YgdGhlaXIgbW9kLlxyXG4vLyAgTmVlZGxlc3MgdG8gc2F5LCB3ZSBkb24ndCB3YW50IHRoZXNlIGRlcGxveWVkIG9yIHJlcG9ydGluZyBhbnkgY29uZmxpY3RzIGFzXHJcbi8vICBWb3J0ZXggaXMgYWxyZWFkeSBkaXN0cmlidXRpbmcgdGhlbS5cclxuZXhwb3J0IGNvbnN0IElHTk9SQUJMRV9GSUxFUyA9IFtcclxuICAnTElDRU5TRScsICdtYW5pZmVzdC5qc29uJywgJ0JlcEluRXguY2ZnJywgJzBIYXJtb255LmRsbCcsICdkb29yc3RvcF9jb25maWcuaW5pJywgJ2ljb24ucG5nJywgJ1JFQURNRS5tZCcsXHJcbiAgJzBIYXJtb255LnhtbCcsICcwSGFybW9ueTIwLmRsbCcsICdCZXBJbkV4LmRsbCcsICdCZXBJbkV4Lkhhcm1vbnkuZGxsJywgJ0JlcEluRXguSGFybW9ueS54bWwnLFxyXG4gICdCZXBJbkV4LlByZWxvYWRlci5kbGwnLCAnQmVwSW5FeC5QcmVsb2FkZXIueG1sJywgJ0JlcEluRXgueG1sJywgJ0hhcm1vbnlYSW50ZXJvcC5kbGwnLFxyXG4gICdNb25vLkNlY2lsLmRsbCcsICdNb25vLkNlY2lsLk1kYi5kbGwnLCAnTW9uby5DZWNpbC5QZGIuZGxsJywgJ01vbm8uQ2VjaWwuUm9ja3MuZGxsJyxcclxuICAnTW9ub01vZC5SdW50aW1lRGV0b3VyLmRsbCcsICdNb25vTW9kLlJ1bnRpbWVEZXRvdXIueG1sJywgJ01vbm9Nb2QuVXRpbHMuZGxsJyxcclxuICAnTW9ub01vZC5VdGlscy54bWwnLFxyXG5dO1xyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJUHJvcHMge1xyXG4gIGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaTtcclxuICBzdGF0ZTogdHlwZXMuSVN0YXRlO1xyXG4gIHByb2ZpbGU6IHR5cGVzLklQcm9maWxlO1xyXG4gIGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdDtcclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHdhbGtEaXJQYXRoKGRpclBhdGg6IHN0cmluZyk6IFByb21pc2U8SUVudHJ5W10+IHtcclxuICBsZXQgZmlsZUVudHJpZXM6IElFbnRyeVtdID0gW107XHJcbiAgYXdhaXQgdHVyYm93YWxrKGRpclBhdGgsIChlbnRyaWVzOiBJRW50cnlbXSkgPT4ge1xyXG4gICAgZmlsZUVudHJpZXMgPSBmaWxlRW50cmllcy5jb25jYXQoZW50cmllcyk7XHJcbiAgfSlcclxuICAuY2F0Y2goeyBzeXN0ZW1Db2RlOiAzIH0sICgpID0+IFByb21pc2UucmVzb2x2ZSgpKVxyXG4gIC5jYXRjaChlcnIgPT4gWydFTk9URk9VTkQnLCAnRU5PRU5UJ10uaW5jbHVkZXMoZXJyLmNvZGUpXHJcbiAgICA/IFByb21pc2UucmVzb2x2ZSgpIDogUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcblxyXG4gIHJldHVybiBmaWxlRW50cmllcztcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGlzSW5TbGltVk1MSW5zdGFsbGVkKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSkge1xyXG4gIGNvbnN0IHN0YXRlID0gYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgbW9kczogeyBbbW9kSWQ6IHN0cmluZ106IHR5cGVzLklNb2QgfSA9XHJcbiAgICB1dGlsLmdldFNhZmUoc3RhdGUsIFsncGVyc2lzdGVudCcsICdtb2RzJywgR0FNRV9JRF0sIHt9KTtcclxuICBjb25zdCBwcm9maWxlSWQgPSBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlID0gc2VsZWN0b3JzLnByb2ZpbGVCeUlkKHN0YXRlLCBwcm9maWxlSWQpO1xyXG4gIGNvbnN0IGVuYWJsZWRNb2RzID0gT2JqZWN0LmtleXMobW9kcylcclxuICAgIC5maWx0ZXIoa2V5ID0+IHV0aWwuZ2V0U2FmZShwcm9maWxlLCBbJ21vZFN0YXRlJywga2V5LCAnZW5hYmxlZCddLCBmYWxzZSkpO1xyXG4gIHJldHVybiBlbmFibGVkTW9kcy5maW5kKGtleSA9PiBtb2RzW2tleV0/LnR5cGUgPT09ICdpbnNsaW12bWwtbW9kLWxvYWRlcicpICE9PSB1bmRlZmluZWQ7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZW5Qcm9wcyhjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCwgcHJvZmlsZUlkPzogc3RyaW5nKTogSVByb3BzIHtcclxuICBjb25zdCBzdGF0ZSA9IGNvbnRleHQuYXBpLmdldFN0YXRlKCk7XHJcbiAgcHJvZmlsZUlkID0gcHJvZmlsZUlkICE9PSB1bmRlZmluZWRcclxuICAgID8gcHJvZmlsZUlkXHJcbiAgICA6IHNlbGVjdG9ycy5sYXN0QWN0aXZlUHJvZmlsZUZvckdhbWUoc3RhdGUsIEdBTUVfSUQpO1xyXG4gIGNvbnN0IHByb2ZpbGUgPSBzZWxlY3RvcnMucHJvZmlsZUJ5SWQoc3RhdGUsIHByb2ZpbGVJZCk7XHJcbiAgaWYgKHByb2ZpbGU/LmdhbWVJZCAhPT0gR0FNRV9JRCkge1xyXG4gICAgLy8gVGhpcyBpcyB0b28gc3BhbW15LlxyXG4gICAgLy8gbG9nKCdkZWJ1ZycsICdJbnZhbGlkIHByb2ZpbGUnLCB7IHByb2ZpbGUgfSk7XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxuICBjb25zdCBkaXNjb3ZlcnkgPSB1dGlsLmdldFNhZmUoc3RhdGUsIFsnc2V0dGluZ3MnLCAnZ2FtZU1vZGUnLCAnZGlzY292ZXJlZCcsIEdBTUVfSURdLCB1bmRlZmluZWQpO1xyXG4gIGlmIChkaXNjb3Zlcnk/LnBhdGggPT09IHVuZGVmaW5lZCkge1xyXG4gICAgLy8gbG9nKCdkZWJ1ZycsICdHYW1lIGlzIG5vdCBkaXNjb3ZlcmVkJywgeyBwcm9maWxlLCBkaXNjb3ZlcnkgfSk7XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxuICByZXR1cm4geyBhcGk6IGNvbnRleHQuYXBpLCBzdGF0ZSwgcHJvZmlsZSwgZGlzY292ZXJ5IH07XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBnZW5JbnN0cnVjdGlvbnMoc3JjUGF0aDogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGRlc3RQYXRoOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgZW50cmllczogSUVudHJ5W10pOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSB7XHJcbiAgcmV0dXJuIGVudHJpZXMuZmlsdGVyKGVudHJ5ID0+ICFlbnRyeS5pc0RpcmVjdG9yeSlcclxuICAgIC5yZWR1Y2UoKGFjY3VtLCBpdGVyKSA9PiB7XHJcbiAgICAgIGNvbnN0IGRlc3RpbmF0aW9uOiBzdHJpbmcgPSBpdGVyLmZpbGVQYXRoLnJlcGxhY2Uoc3JjUGF0aCwgZGVzdFBhdGgpO1xyXG4gICAgICBhY2N1bS5wdXNoKHtcclxuICAgICAgICB0eXBlOiAnY29weScsXHJcbiAgICAgICAgc291cmNlOiBpdGVyLmZpbGVQYXRoLFxyXG4gICAgICAgIGRlc3RpbmF0aW9uLFxyXG4gICAgICB9KTtcclxuICAgICAgcmV0dXJuIGFjY3VtO1xyXG4gICAgfSwgW10pO1xyXG59XHJcbiJdfQ==