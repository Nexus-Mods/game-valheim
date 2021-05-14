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
                vortex_api_1.log('debug', 'failed to remove file', err);
            }
        }
    });
}
exports.removeDir = removeDir;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY29tbW9uLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiY29tbW9uLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBLDBEQUE4QztBQUM5QywyQ0FBNkQ7QUFHaEQsUUFBQSxPQUFPLEdBQUcsU0FBUyxDQUFDO0FBQ3BCLFFBQUEsY0FBYyxHQUFHLGVBQWUsQ0FBQztBQUNqQyxRQUFBLGFBQWEsR0FBRyxDQUFDLE1BQWMsRUFBRSxFQUFFLENBQUMsQ0FBQyxzQkFBYyxFQUFFLGVBQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUUvRSxRQUFBLFFBQVEsR0FBRyxRQUFRLENBQUM7QUFFcEIsUUFBQSxlQUFlLEdBQUcsbUJBQW1CLENBQUM7QUFDdEMsUUFBQSxVQUFVLEdBQUcsU0FBUyxDQUFDO0FBQ3ZCLFFBQUEsT0FBTyxHQUFHLE1BQU0sQ0FBQztBQUNqQixRQUFBLE9BQU8sR0FBRyxNQUFNLENBQUM7QUFDakIsUUFBQSxvQkFBb0IsR0FBRyxlQUFlLENBQUM7QUFDdkMsUUFBQSxnQkFBZ0IsR0FBRyxhQUFhLENBQUM7QUFDakMsUUFBQSxRQUFRLEdBQUcsb0JBQW9CLENBQUM7QUFDaEMsUUFBQSxVQUFVLEdBQUcsQ0FBQyxnQkFBUSxFQUFFLGdCQUFnQixFQUFFLGNBQWMsQ0FBQyxDQUFDO0FBRTFELFFBQUEsS0FBSyxHQUFHLG1CQUFtQixDQUFDO0FBTTVCLFFBQUEsZUFBZSxHQUFHO0lBQzdCLFNBQVMsRUFBRSxlQUFlLEVBQUUsYUFBYSxFQUFFLGNBQWMsRUFBRSxxQkFBcUIsRUFBRSxVQUFVLEVBQUUsV0FBVztJQUN6RyxjQUFjLEVBQUUsZ0JBQWdCLEVBQUUsYUFBYSxFQUFFLHFCQUFxQixFQUFFLHFCQUFxQjtJQUM3Rix1QkFBdUIsRUFBRSx1QkFBdUIsRUFBRSxhQUFhLEVBQUUscUJBQXFCO0lBQ3RGLGdCQUFnQixFQUFFLG9CQUFvQixFQUFFLG9CQUFvQixFQUFFLHNCQUFzQjtJ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QUMsUUFBUSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3hFLEtBQUssTUFBTSxLQUFLLElBQUksU0FBUyxFQUFFO1lBQzdCLElBQUk7Z0JBQ0YsTUFBTSxlQUFFLENBQUMsV0FBVyxDQUFDLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUN0QztZQUFDLE9BQU8sR0FBRyxFQUFFO2dCQUNaLGdCQUFHLENBQUMsT0FBTyxFQUFFLHVCQUF1QixFQUFFLEdBQUcsQ0FBQyxDQUFDO2FBQzVDO1NBQ0Y7SUFDSCxDQUFDO0NBQUE7QUFWRCw4QkFVQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB0dXJib3dhbGssIHsgSUVudHJ5IH0gZnJvbSAndHVyYm93YWxrJztcclxuaW1wb3J0IHsgZnMsIGxvZywgc2VsZWN0b3JzLCB0eXBlcywgdXRpbCB9IGZyb20gJ3ZvcnRleC1hcGknO1xyXG5cclxuZXhwb3J0IGRlY2xhcmUgdHlwZSBQYWNrVHlwZSA9ICdub25lJyB8ICdjb3JlX2xpYicgfCAndW5zdHJpcHBlZF9jb3JsaWInO1xyXG5leHBvcnQgY29uc3QgR0FNRV9JRCA9ICd2YWxoZWltJztcclxuZXhwb3J0IGNvbnN0IEdBTUVfSURfU0VSVkVSID0gJ3ZhbGhlaW1zZXJ2ZXInO1xyXG5leHBvcnQgY29uc3QgaXNWYWxoZWltR2FtZSA9IChnYW1lSWQ6IHN0cmluZykgPT4gW0dBTUVfSURfU0VSVkVSLCBHQU1FX0lEXS5pbmNsdWRlcyhnYW1lSWQpO1xyXG5cclxuZXhwb3J0IGNvbnN0IFNURUFNX0lEID0gJzg5Mjk3MCc7XHJcblxyXG5leHBvcnQgY29uc3QgQkVUVEVSX0NPTlRfRVhUID0gJy5iZXR0ZXJjb250aW5lbnRzJztcclxuZXhwb3J0IGNvbnN0IFZCVUlMRF9FWFQgPSAnLnZidWlsZCc7XHJcbmV4cG9ydCBjb25zdCBGQlhfRVhUID0gJy5mYngnO1xyXG5leHBvcnQgY29uc3QgT0JKX0VYVCA9ICcub2JqJztcclxuZXhwb3J0IGNvbnN0IElOU0xJTVZNTF9JREVOVElGSUVSID0gJ2luc2xpbXZtbC5pbmknO1xyXG5leHBvcnQgY29uc3QgRE9PUlNUT1BQRVJfSE9PSyA9ICd3aW5odHRwLmRsbCc7XHJcbmV4cG9ydCBjb25zdCBCSVhfU1ZNTCA9ICdzbGltdm1sLmxvYWRlci5kbGwnO1xyXG5leHBvcnQgY29uc3QgSVNWTUxfU0tJUCA9IFtCSVhfU1ZNTCwgJ3NsaW1hc3Npc3QuZGxsJywgJzBoYXJtb255LmRsbCddO1xyXG5cclxuZXhwb3J0IGNvbnN0IE5FWFVTID0gJ3d3dy5uZXh1c21vZHMuY29tJztcclxuXHJcbi8vIFRoZXNlIGFyZSBmaWxlcyB3aGljaCBhcmUgY3J1Y2lhbCB0byBWYWxoZWltJ3MgbW9kZGluZyBwYXR0ZXJuIGFuZCBpdCBhcHBlYXJzXHJcbi8vICB0aGF0IG1hbnkgbW9kcyBvbiBWb3J0ZXggYXJlIGN1cnJlbnRseSBkaXN0cmlidXRpbmcgdGhlc2UgYXMgcGFydCBvZiB0aGVpciBtb2QuXHJcbi8vICBOZWVkbGVzcyB0byBzYXksIHdlIGRvbid0IHdhbnQgdGhlc2UgZGVwbG95ZWQgb3IgcmVwb3J0aW5nIGFueSBjb25mbGljdHMgYXNcclxuLy8gIFZvcnRleCBpcyBhbHJlYWR5IGRpc3RyaWJ1dGluZyB0aGVtLlxyXG5leHBvcnQgY29uc3QgSUdOT1JBQkxFX0ZJTEVTID0gW1xyXG4gICdMSUNFTlNFJywgJ21hbmlmZXN0Lmpzb24nLCAnQmVwSW5FeC5jZmcnLCAnMEhhcm1vbnkuZGxsJywgJ2Rvb3JzdG9wX2NvbmZpZy5pbmknLCAnaWNvbi5wbmcnLCAnUkVBRE1FLm1kJyxcclxuICAnMEhhcm1vbnkueG1sJywgJzBIYXJtb255MjAuZGxsJywgJ0JlcEluRXguZGxsJywgJ0JlcEluRXguSGFybW9ueS5kbGwnLCAnQmVwSW5FeC5IYXJtb255LnhtbCcsXHJcbiAgJ0JlcEluRXguUHJlbG9hZGVyLmRsbCcsICdCZXBJbkV4LlByZWxvYWRlci54bWwnLCAnQmVwSW5FeC54bWwnLCAnSGFybW9ueVhJbnRlcm9wLmRsbCcsXHJcbiAgJ01vbm8uQ2VjaWwuZGxsJywgJ01vbm8uQ2VjaWwuTWRiLmRsbCcsICdNb25vLkNlY2lsLlBkYi5kbGwnLCAnTW9uby5DZWNpbC5Sb2Nrcy5kbGwnLFxyXG4gICdNb25vTW9kLlJ1bnRpbWVEZXRvdXIuZGxsJywgJ01vbm9Nb2QuUnVudGltZURldG91ci54bWwnLCAnTW9ub01vZC5VdGlscy5kbGwnLFxyXG4gICdNb25vTW9kLlV0aWxzLnhtbCcsXHJcbl07XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIElQcm9wcyB7XHJcbiAgYXBpOiB0eXBlcy5JRXh0ZW5zaW9uQXBpO1xyXG4gIHN0YXRlOiB0eXBlcy5JU3RhdGU7XHJcbiAgcHJvZmlsZTogdHlwZXMuSVByb2ZpbGU7XHJcbiAgZGlzY292ZXJ5OiB0eXBlcy5JRGlzY292ZXJ5UmVzdWx0O1xyXG59XHJcblxyXG5leHBvcnQgaW50ZXJmYWNlIElBcmd1bWVudCB7XHJcbiAgYXJndW1lbnQ6IHN0cmluZztcclxuICB2YWx1ZT86IHN0cmluZztcclxufVxyXG5cclxuZXhwb3J0IGludGVyZmFjZSBJU0NNRFByb3BzIHtcclxuICBnYW1lSWQ6IHN0cmluZztcclxuICBzdGVhbUFwcElkOiBudW1iZXI7XHJcbiAgY2FsbGJhY2s/OiAoZXJyOiBFcnJvciwgZGF0YTogYW55KSA9PiB2b2lkO1xyXG4gIGFyZ3VtZW50czogSUFyZ3VtZW50W107XHJcbn1cclxuXHJcbmV4cG9ydCBhc3luYyBmdW5jdGlvbiB3YWxrRGlyUGF0aChkaXJQYXRoOiBzdHJpbmcpOiBQcm9taXNlPElFbnRyeVtdPiB7XHJcbiAgbGV0IGZpbGVFbnRyaWVzOiBJRW50cnlbXSA9IFtdO1xyXG4gIGF3YWl0IHR1cmJvd2FsayhkaXJQYXRoLCAoZW50cmllczogSUVudHJ5W10pID0+IHtcclxuICAgIGZpbGVFbnRyaWVzID0gZmlsZUVudHJpZXMuY29uY2F0KGVudHJpZXMpO1xyXG4gIH0pXHJcbiAgLmNhdGNoKHsgc3lzdGVtQ29kZTogMyB9LCAoKSA9PiBQcm9taXNlLnJlc29sdmUoKSlcclxuICAuY2F0Y2goZXJyID0+IFsnRU5PVEZPVU5EJywgJ0VOT0VOVCddLmluY2x1ZGVzKGVyci5jb2RlKVxyXG4gICAgPyBQcm9taXNlLnJlc29sdmUoKSA6IFByb21pc2UucmVqZWN0KGVycikpO1xyXG5cclxuICByZXR1cm4gZmlsZUVudHJpZXM7XHJcbn1cclxuXHJcbmV4cG9ydCBmdW5jdGlvbiBpc0luU2xpbVZNTEluc3RhbGxlZChhcGk6IHR5cGVzLklFeHRlbnNpb25BcGkpIHtcclxuICBjb25zdCBzdGF0ZSA9IGFwaS5nZXRTdGF0ZSgpO1xyXG4gIGNvbnN0IG1vZHM6IHsgW21vZElkOiBzdHJpbmddOiB0eXBlcy5JTW9kIH0gPVxyXG4gICAgdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcbiAgY29uc3QgcHJvZmlsZUlkID0gc2VsZWN0b3JzLmxhc3RBY3RpdmVQcm9maWxlRm9yR2FtZShzdGF0ZSwgR0FNRV9JRCk7XHJcbiAgY29uc3QgcHJvZmlsZSA9IHNlbGVjdG9ycy5wcm9maWxlQnlJZChzdGF0ZSwgcHJvZmlsZUlkKTtcclxuICBjb25zdCBlbmFibGVkTW9kcyA9IE9iamVjdC5rZXlzKG1vZHMpXHJcbiAgICAuZmlsdGVyKGtleSA9PiB1dGlsLmdldFNhZmUocHJvZmlsZSwgWydtb2RTdGF0ZScsIGtleSwgJ2VuYWJsZWQnXSwgZmFsc2UpKTtcclxuICByZXR1cm4gZW5hYmxlZE1vZHMuZmluZChrZXkgPT4gbW9kc1trZXldPy50eXBlID09PSAnaW5zbGltdm1sLW1vZC1sb2FkZXInKSAhPT0gdW5kZWZpbmVkO1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2VuUHJvcHMoY29udGV4dDogdHlwZXMuSUV4dGVuc2lvbkNvbnRleHQsIHByb2ZpbGVJZD86IHN0cmluZyk6IElQcm9wcyB7XHJcbiAgY29uc3Qgc3RhdGUgPSBjb250ZXh0LmFwaS5nZXRTdGF0ZSgpO1xyXG4gIHByb2ZpbGVJZCA9IHByb2ZpbGVJZCAhPT0gdW5kZWZpbmVkXHJcbiAgICA/IHByb2ZpbGVJZFxyXG4gICAgOiBzZWxlY3RvcnMubGFzdEFjdGl2ZVByb2ZpbGVGb3JHYW1lKHN0YXRlLCBHQU1FX0lEKTtcclxuICBjb25zdCBwcm9maWxlID0gc2VsZWN0b3JzLnByb2ZpbGVCeUlkKHN0YXRlLCBwcm9maWxlSWQpO1xyXG4gIGlmIChwcm9maWxlPy5nYW1lSWQgIT09IEdBTUVfSUQpIHtcclxuICAgIC8vIFRoaXMgaXMgdG9vIHNwYW1teS5cclxuICAgIC8vIGxvZygnZGVidWcnLCAnSW52YWxpZCBwcm9maWxlJywgeyBwcm9maWxlIH0pO1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9XHJcbiAgY29uc3QgZGlzY292ZXJ5ID0gdXRpbC5nZXRTYWZlKHN0YXRlLCBbJ3NldHRpbmdzJywgJ2dhbWVNb2RlJywgJ2Rpc2NvdmVyZWQnLCBHQU1FX0lEXSwgdW5kZWZpbmVkKTtcclxuICBpZiAoZGlzY292ZXJ5Py5wYXRoID09PSB1bmRlZmluZWQpIHtcclxuICAgIC8vIGxvZygnZGVidWcnLCAnR2FtZSBpcyBub3QgZGlzY292ZXJlZCcsIHsgcHJvZmlsZSwgZGlzY292ZXJ5IH0pO1xyXG4gICAgcmV0dXJuIHVuZGVmaW5lZDtcclxuICB9XHJcbiAgcmV0dXJuIHsgYXBpOiBjb250ZXh0LmFwaSwgc3RhdGUsIHByb2ZpbGUsIGRpc2NvdmVyeSB9O1xyXG59XHJcblxyXG5leHBvcnQgZnVuY3Rpb24gZ2VuSW5zdHJ1Y3Rpb25zKHNyY1BhdGg6IHN0cmluZyxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICBkZXN0UGF0aDogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIGVudHJpZXM6IElFbnRyeVtdKTogdHlwZXMuSUluc3RydWN0aW9uW10ge1xyXG4gIHJldHVybiBlbnRyaWVzLmZpbHRlcihlbnRyeSA9PiAhZW50cnkuaXNEaXJlY3RvcnkpXHJcbiAgICAucmVkdWNlKChhY2N1bSwgaXRlcikgPT4ge1xyXG4gICAgICBjb25zdCBkZXN0aW5hdGlvbjogc3RyaW5nID0gaXRlci5maWxlUGF0aC5yZXBsYWNlKHNyY1BhdGgsIGRlc3RQYXRoKTtcclxuICAgICAgYWNjdW0ucHVzaCh7XHJcbiAgICAgICAgdHlwZTogJ2NvcHknLFxyXG4gICAgICAgIHNvdXJjZTogaXRlci5maWxlUGF0aCxcclxuICAgICAgICBkZXN0aW5hdGlvbixcclxuICAgICAgfSk7XHJcbiAgICAgIHJldHVybiBhY2N1bTtcclxuICAgIH0sIFtdKTtcclxufVxyXG5cclxuZXhwb3J0IGZ1bmN0aW9uIGd1ZXNzTW9kSWQoZmlsZU5hbWU6IHN0cmluZyk6IHN0cmluZyB7XHJcbiAgY29uc3QgbWF0Y2ggPSBmaWxlTmFtZS5tYXRjaCgvLShbMC05XSspLS8pO1xyXG4gIGlmIChtYXRjaCAhPT0gbnVsbCkge1xyXG4gICAgcmV0dXJuIG1hdGNoWzFdO1xyXG4gIH0gZWxzZSB7XHJcbiAgICByZXR1cm4gdW5kZWZpbmVkO1xyXG4gIH1cclxufVxyXG5cclxuZXhwb3J0IGFzeW5jIGZ1bmN0aW9uIHJlbW92ZURpcihmaWxlUGF0aDogc3RyaW5nKSB7XHJcbiAgY29uc3QgZmlsZVBhdGhzID0gYXdhaXQgd2Fsa0RpclBhdGgoZmlsZVBhdGgpO1xyXG4gIGZpbGVQYXRocy5zb3J0KChsaHMsIHJocykgPT4gcmhzLmZpbGVQYXRoLmxlbmd0aCAtIGxocy5maWxlUGF0aC5sZW5ndGgpO1xyXG4gIGZvciAoY29uc3QgZW50cnkgb2YgZmlsZVBhdGhzKSB7XHJcbiAgICB0cnkge1xyXG4gICAgICBhd2FpdCBmcy5yZW1vdmVBc3luYyhlbnRyeS5maWxlUGF0aCk7XHJcbiAgICB9IGNhdGNoIChlcnIpIHtcclxuICAgICAgbG9nKCdkZWJ1ZycsICdmYWlsZWQgdG8gcmVtb3ZlIGZpbGUnLCBlcnIpO1xyXG4gICAgfVxyXG4gIH1cclxufSJdfQ==