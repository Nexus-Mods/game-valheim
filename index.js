"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
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
const bluebird_1 = __importDefault(require("bluebird"));
const path = __importStar(require("path"));
const vortex_api_1 = require("vortex-api");
const payloadDeployer = __importStar(require("./payloadDeployer"));
const common_1 = require("./common");
const installers_1 = require("./installers");
const tests_1 = require("./tests");
const STOP_PATTERNS = ['config', 'plugins', 'patchers'];
function toWordExp(input) {
    return '(^|/)' + input + '(/|$)';
}
function findGame() {
    return vortex_api_1.util.GameStoreHelper.findByAppId([common_1.STEAM_ID])
        .then(game => game.gamePath);
}
function requiresLauncher(gamePath) {
    return vortex_api_1.fs.readdirAsync(gamePath)
        .then(files => (files.find(file => file.toLowerCase() === 'steam_appid.txt') !== undefined)
        ? Promise.resolve({
            launcher: 'steam',
            addInfo: {
                appId: common_1.STEAM_ID,
                parameters: ['-force-glcore'],
                launchType: 'gamestore',
            },
        })
        : Promise.resolve(undefined))
        .catch(err => Promise.reject(err));
}
function ensureUnstrippedAssemblies(api, props) {
    return __awaiter(this, void 0, void 0, function* () {
        const t = api.translate;
        const expectedFilePath = path.join(props.discovery.path, 'unstripped_managed', 'mono.security.dll');
        const mods = vortex_api_1.util.getSafe(props.state, ['persistent', 'mods', common_1.GAME_ID], {});
        const hasUnstrippedMod = Object.keys(mods).filter(key => { var _a; return ((_a = mods[key]) === null || _a === void 0 ? void 0 : _a.type) === 'unstripped-assemblies'; }).length > 0;
        if (hasUnstrippedMod) {
            return Promise.resolve();
        }
        try {
            yield vortex_api_1.fs.statAsync(expectedFilePath);
            return;
        }
        catch (err) {
            return new Promise((resolve, reject) => {
                api.showDialog('info', 'Missing unstripped assemblies', {
                    bbcode: t('Valheim\'s assemblies are distributed in an "optimised" state to reduce required '
                        + 'disk space. This unfortunately means that Valheim\'s modding capabilities are also affected.{{br}}{{br}}'
                        + 'In order to mod Valheim, the unoptimised/unstripped assemblies are required - please download these '
                        + 'from the nexus.', { replace: { br: '[br][/br]' } }),
                }, [
                    { label: 'Cancel', action: () => reject(new vortex_api_1.util.UserCanceled()) },
                    {
                        label: 'Download Unstripped Assemblies',
                        action: () => vortex_api_1.util.opn('https://www.nexusmods.com/valheim/mods/15')
                            .catch(err => null)
                            .finally(() => resolve()),
                    },
                ]);
            });
        }
    });
}
function prepareForModding(context, discovery) {
    const state = context.api.getState();
    const profile = vortex_api_1.selectors.activeProfile(state);
    return new bluebird_1.default((resolve, reject) => {
        return vortex_api_1.fs.ensureDirWritableAsync(modsPath(discovery.path))
            .then(() => vortex_api_1.fs.ensureDirWritableAsync(path.join(discovery.path, 'InSlimVML', 'Mods')))
            .then(() => vortex_api_1.fs.ensureDirWritableAsync(path.join(discovery.path, 'AdvancedBuilder', 'Builds')))
            .then(() => payloadDeployer.onWillDeploy(context, profile === null || profile === void 0 ? void 0 : profile.id))
            .then(() => resolve())
            .catch(err => reject(err));
    })
        .then(() => ensureUnstrippedAssemblies(context.api, { state, profile, discovery }));
}
function modsPath(gamePath) {
    return path.join(gamePath, 'BepInEx', 'plugins');
}
function main(context) {
    context.registerGame({
        id: common_1.GAME_ID,
        name: 'Valheim',
        mergeMods: true,
        queryPath: findGame,
        queryModPath: modsPath,
        logo: 'gameart.jpg',
        executable: () => 'valheim.exe',
        requiresLauncher,
        setup: discovery => prepareForModding(context, discovery),
        requiredFiles: [
            'valheim.exe',
        ],
        environment: {
            SteamAPPId: common_1.STEAM_ID,
        },
        details: {
            steamAppId: +common_1.STEAM_ID,
            stopPatterns: STOP_PATTERNS.map(toWordExp),
            ignoreConflicts: common_1.IGNORABLE_FILES,
            ignoreDeploy: common_1.IGNORABLE_FILES,
        },
    });
    const getGamePath = () => {
        var _a;
        const props = common_1.genProps(context);
        return (((_a = props === null || props === void 0 ? void 0 : props.discovery) === null || _a === void 0 ? void 0 : _a.path) !== undefined)
            ? props.discovery.path : '.';
    };
    const isSupported = (gameId) => (gameId === common_1.GAME_ID);
    const hasInstruction = (instructions, pred) => instructions.find(instr => (instr.type === 'copy')
        && (pred(instr))) !== undefined;
    const findInstrMatch = (instructions, pattern, mod) => {
        if (mod === undefined) {
            mod = (input) => input;
        }
        return hasInstruction(instructions, (instr) => mod(instr.source).toLowerCase() === pattern.toLowerCase());
    };
    const inSlimVmlDepTest = () => tests_1.isDependencyRequired(context.api, {
        dependentModType: 'inslimvml-mod',
        masterModType: 'inslimvml-mod-loader',
        masterName: 'InSlimVML',
        masterURL: 'https://www.nexusmods.com/valheim/mods/21',
    });
    const vbuildDepTest = () => {
        const gamePath = getGamePath();
        const advancedBuilderAssembly = path.join(gamePath, 'InSlimVML', 'Mods', 'CR-AdvancedBuilder.dll');
        return tests_1.isDependencyRequired(context.api, {
            dependentModType: 'vbuild-mod',
            masterModType: 'inslimvml-mod',
            masterName: 'AdvancedBuilder',
            masterURL: 'https://www.nexusmods.com/valheim/mods/5',
            requiredFiles: [advancedBuilderAssembly],
        });
    };
    context.registerTest('inslim-dep-test', 'gamemode-activated', inSlimVmlDepTest);
    context.registerTest('inslim-dep-test', 'mod-installed', inSlimVmlDepTest);
    context.registerTest('vbuild-dep-test', 'gamemode-activated', vbuildDepTest);
    context.registerTest('vbuild-dep-test', 'mod-installed', vbuildDepTest);
    context.registerInstaller('valheim-core-remover', 20, installers_1.testCoreRemover, installers_1.installCoreRemover);
    context.registerInstaller('valheim-inslimvm', 20, installers_1.testInSlimModLoader, installers_1.installInSlimModLoader);
    context.registerInstaller('valheim-vbuild', 20, installers_1.testVBuild, installers_1.installVBuildMod);
    context.registerModType('inslimvml-mod-loader', 20, isSupported, getGamePath, (instructions) => {
        const hasVMLIni = findInstrMatch(instructions, common_1.INSLIMVML_IDENTIFIER, path.basename);
        return bluebird_1.default.Promise.Promise.resolve(hasVMLIni);
    }, { name: 'InSlimVML Mod Loader' });
    context.registerModType('inslimvml-mod', 10, isSupported, () => path.join(getGamePath(), 'InSlimVML', 'Mods'), (instructions) => {
        const vmlSuffix = '_vml.dll';
        const mod = (input) => (input.length > vmlSuffix.length)
            ? path.basename(input).slice(-vmlSuffix.length)
            : '';
        const testRes = findInstrMatch(instructions, 'cr-advancedbuilder.dll', path.basename)
            || findInstrMatch(instructions, '_vml.dll', mod);
        return bluebird_1.default.Promise.Promise.resolve(testRes);
    }, { name: 'InSlimVML Mod' });
    context.registerModType('vbuild-mod', 10, isSupported, () => path.join(getGamePath(), 'AdvancedBuilder', 'Builds'), (instructions) => {
        const res = findInstrMatch(instructions, common_1.VBUILD_EXT, path.extname);
        return bluebird_1.default.Promise.Promise.resolve(res);
    }, { name: 'AdvancedBuild Mod' });
    context.registerModType('unstripped-assemblies', 20, isSupported, getGamePath, (instructions) => {
        const testPath = path.join('unstripped_managed', 'mono.posix.dll');
        const supported = hasInstruction(instructions, (instr) => instr.source.toLowerCase().includes(testPath));
        return bluebird_1.default.Promise.Promise.resolve(supported);
    }, { name: 'Unstripped Assemblies' });
    context.registerModType('bepinex-root-mod', 25, isSupported, () => path.join(getGamePath(), 'BepInEx'), (instructions) => {
        const matcher = (filePath) => {
            const segments = filePath.split(path.sep);
            for (const stop of STOP_PATTERNS) {
                if (segments.includes(stop)) {
                    return true;
                }
            }
            return false;
        };
        const supported = hasInstruction(instructions, (instr) => matcher(instr.source));
        return bluebird_1.default.Promise.Promise.resolve(supported);
    }, { name: 'BepInEx Root Mod' });
    context.once(() => {
        context.api.onAsync('will-deploy', (profileId) => __awaiter(this, void 0, void 0, function* () { return payloadDeployer.onWillDeploy(context, profileId); }));
        context.api.onAsync('did-purge', (profileId) => __awaiter(this, void 0, void 0, function* () { return payloadDeployer.onDidPurge(context, profileId); }));
    });
    return true;
}
exports.default = main;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsMkNBQTZCO0FBQzdCLDJDQUF3RDtBQUN4RCxtRUFBcUQ7QUFFckQscUNBQ2lEO0FBQ2pELDZDQUN5RTtBQUN6RSxtQ0FBK0M7QUFFL0MsTUFBTSxhQUFhLEdBQUcsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3hELFNBQVMsU0FBUyxDQUFDLEtBQUs7SUFDdEIsT0FBTyxPQUFPLEdBQUcsS0FBSyxHQUFHLE9BQU8sQ0FBQztBQUNuQyxDQUFDO0FBRUQsU0FBUyxRQUFRO0lBQ2YsT0FBTyxpQkFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxpQkFBUSxDQUFDLENBQUM7U0FDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLFFBQVE7SUFDaEMsT0FBTyxlQUFFLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztTQUM3QixJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEtBQUssaUJBQWlCLENBQUMsS0FBSyxTQUFTLENBQUM7UUFDekYsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDaEIsUUFBUSxFQUFFLE9BQU87WUFDakIsT0FBTyxFQUFFO2dCQUNQLEtBQUssRUFBRSxpQkFBUTtnQkFDZixVQUFVLEVBQUUsQ0FBQyxlQUFlLENBQUM7Z0JBQzdCLFVBQVUsRUFBRSxXQUFXO2FBQ3hCO1NBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxD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TyxDQUFDLFdBQVcsRUFBRSxDQUFPLFNBQVMsRUFBRSxFQUFFLGdEQUNuRCxPQUFBLGVBQWUsQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQyxDQUFBLEdBQUEsQ0FBQyxDQUFDO0lBQ3BELENBQUMsQ0FBQyxDQUFDO0lBRUgsT0FBTyxJQUFJLENBQUM7QUFDZCxDQUFDO0FBRUQsa0JBQWUsSUFBSSxDQUFDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IEJsdWViaXJkIGZyb20gJ2JsdWViaXJkJztcclxuaW1wb3J0ICogYXMgcGF0aCBmcm9tICdwYXRoJztcclxuaW1wb3J0IHsgZnMsIHNlbGVjdG9ycywgdHlwZXMsIHV0aWwgfSBmcm9tICd2b3J0ZXgtYXBpJztcclxuaW1wb3J0ICogYXMgcGF5bG9hZERlcGxveWVyIGZyb20gJy4vcGF5bG9hZERlcGxveWVyJztcclxuXHJcbmltcG9ydCB7IEdBTUVfSUQsIGdlblByb3BzLCBJR05PUkFCTEVfRklMRVMsIElOU0xJTVZNTF9JREVOVElGSUVSLFxyXG4gIElQcm9wcywgU1RFQU1fSUQsIFZCVUlMRF9FWFQgfSBmcm9tICcuL2NvbW1vbic7XHJcbmltcG9ydCB7IGluc3RhbGxDb3JlUmVtb3ZlciwgaW5zdGFsbEluU2xpbU1vZExvYWRlciwgaW5zdGFsbFZCdWlsZE1vZCxcclxuICB0ZXN0Q29yZVJlbW92ZXIsIHRlc3RJblNsaW1Nb2RMb2FkZXIsIHRlc3RWQnVpbGQgfSBmcm9tICcuL2luc3RhbGxlcnMnO1xyXG5pbXBvcnQgeyBpc0RlcGVuZGVuY3lSZXF1aXJlZCB9IGZyb20gJy4vdGVzdHMnO1xyXG5cclxuY29uc3QgU1RPUF9QQVRURVJOUyA9IFsnY29uZmlnJywgJ3BsdWdpbnMnLCAncGF0Y2hlcnMnXTtcclxuZnVuY3Rpb24gdG9Xb3JkRXhwKGlucHV0KSB7XHJcbiAgcmV0dXJuICcoXnwvKScgKyBpbnB1dCArICcoL3wkKSc7XHJcbn1cclxuXHJcbmZ1bmN0aW9uIGZpbmRHYW1lKCk6IGFueSB7XHJcbiAgcmV0dXJuIHV0aWwuR2FtZVN0b3JlSGVscGVyLmZpbmRCeUFwcElkKFtTVEVBTV9JRF0pXHJcbiAgICAudGhlbihnYW1lID0+IGdhbWUuZ2FtZVBhdGgpO1xyXG59XHJcblxyXG5mdW5jdGlvbiByZXF1aXJlc0xhdW5jaGVyKGdhbWVQYXRoKSB7XHJcbiAgcmV0dXJuIGZzLnJlYWRkaXJBc3luYyhnYW1lUGF0aClcclxuICAgIC50aGVuKGZpbGVzID0+IChmaWxlcy5maW5kKGZpbGUgPT4gZmlsZS50b0xvd2VyQ2FzZSgpID09PSAnc3RlYW1fYXBwaWQudHh0JykgIT09IHVuZGVmaW5lZClcclxuICAgICAgPyBQcm9taXNlLnJlc29sdmUoe1xyXG4gICAgICAgIGxhdW5jaGVyOiAnc3RlYW0nLFxyXG4gICAgICAgIGFkZEluZm86IHtcclxuICAgICAgICAgIGFwcElkOiBTVEVBTV9JRCxcclxuICAgICAgICAgIHBhcmFtZXRlcnM6IFsnLWZvcmNlLWdsY29yZSddLFxyXG4gICAgICAgICAgbGF1bmNoVHlwZTogJ2dhbWVzdG9yZScsXHJcbiAgICAgICAgfSxcclxuICAgICAgfSlcclxuICAgICAgOiBQcm9taXNlLnJlc29sdmUodW5kZWZpbmVkKSlcclxuICAgIC5jYXRjaChlcnIgPT4gUHJvbWlzZS5yZWplY3QoZXJyKSk7XHJcbn1cclxuXHJcbmFzeW5jIGZ1bmN0aW9uIGVuc3VyZVVuc3RyaXBwZWRBc3NlbWJsaWVzKGFwaTogdHlwZXMuSUV4dGVuc2lvbkFwaSwgcHJvcHM6IElQcm9wcyk6IFByb21pc2U8dm9pZD4ge1xyXG4gIGNvbnN0IHQgPSBhcGkudHJhbnNsYXRlO1xyXG4gIGNvbnN0IGV4cGVjdGVkRmlsZVBhdGggPSBwYXRoLmpvaW4ocHJvcHMuZGlzY292ZXJ5LnBhdGgsXHJcbiAgICAndW5zdHJpcHBlZF9tYW5hZ2VkJywgJ21vbm8uc2VjdXJpdHkuZGxsJyk7XHJcblxyXG4gIGNvbnN0IG1vZHM6IHsgW21vZElkOiBzdHJpbmddOiB0eXBlcy5JTW9kIH1cclxuICAgID0gdXRpbC5nZXRTYWZlKHByb3BzLnN0YXRlLCBbJ3BlcnNpc3RlbnQnLCAnbW9kcycsIEdBTUVfSURdLCB7fSk7XHJcblxyXG4gIGNvbnN0IGhhc1Vuc3RyaXBwZWRNb2QgPSBPYmplY3Qua2V5cyhtb2RzKS5maWx0ZXIoa2V5ID0+IG1vZHNba2V5XT8udHlwZSA9PT0gJ3Vuc3RyaXBwZWQtYXNzZW1ibGllcycpLmxlbmd0aCA+IDA7XHJcbiAgaWYgKGhhc1Vuc3RyaXBwZWRNb2QpIHtcclxuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcclxuICB9XHJcbiAgdHJ5IHtcclxuICAgIGF3YWl0IGZzLnN0YXRBc3luYyhleHBlY3RlZEZpbGVQYXRoKTtcclxuICAgIHJldHVybjtcclxuICB9IGNhdGNoIChlcnIpIHtcclxuICAgIHJldHVybiBuZXcgUHJvbWlzZSgocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICAgIGFwaS5zaG93RGlhbG9nKCdpbmZvJywgJ01pc3NpbmcgdW5zdHJpcHBlZCBhc3NlbWJsaWVzJywge1xyXG4gICAgICAgIGJiY29kZTogdCgnVmFsaGVpbVxcJ3MgYXNzZW1ibGllcyBhcmUgZGlzdHJpYnV0ZWQgaW4gYW4gXCJvcHRpbWlzZWRcIiBzdGF0ZSB0byByZWR1Y2UgcmVxdWlyZWQgJ1xyXG4gICAgICAgICsgJ2Rpc2sgc3BhY2UuIFRoaXMgdW5mb3J0dW5hdGVseSBtZWFucyB0aGF0IFZhbGhlaW1cXCdzIG1vZGRpbmcgY2FwYWJpbGl0aWVzIGFyZSBhbHNvIGFmZmVjdGVkLnt7YnJ9fXt7YnJ9fSdcclxuICAgICAgICArICdJbiBvcmRlciB0byBtb2QgVmFsaGVpbSwgdGhlIHVub3B0aW1pc2VkL3Vuc3RyaXBwZWQgYXNzZW1ibGllcyBhcmUgcmVxdWlyZWQgLSBwbGVhc2UgZG93bmxvYWQgdGhlc2UgJ1xyXG4gICAgICAgICsgJ2Zyb20gdGhlIG5leHVzLicsIHsgcmVwbGFjZTogeyBicjogJ1ticl1bL2JyXScgfSB9KSxcclxuICAgICAgfSwgW1xyXG4gICAgICAgIHsgbGFiZWw6ICdDYW5jZWwnLCBhY3Rpb246ICgpID0+IHJlamVjdChuZXcgdXRpbC5Vc2VyQ2FuY2VsZWQoKSkgfSxcclxuICAgICAgICB7XHJcbiAgICAgICAgICBsYWJlbDogJ0Rvd25sb2FkIFVuc3RyaXBwZWQgQXNzZW1ibGllcycsXHJcbiAgICAgICAgICBhY3Rpb246ICgpID0+IHV0aWwub3BuKCdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy8xNScpXHJcbiAgICAgICAgICAgIC5jYXRjaChlcnIgPT4gbnVsbClcclxuICAgICAgICAgICAgLmZpbmFsbHkoKCkgPT4gcmVzb2x2ZSgpKSxcclxuICAgICAgICB9LFxyXG4gICAgICBdKTtcclxuICAgIH0pO1xyXG4gIH1cclxufVxyXG5cclxuZnVuY3Rpb24gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dDogdHlwZXMuSUV4dGVuc2lvbkNvbnRleHQsIGRpc2NvdmVyeTogdHlwZXMuSURpc2NvdmVyeVJlc3VsdCkge1xyXG4gIGNvbnN0IHN0YXRlID0gY29udGV4dC5hcGkuZ2V0U3RhdGUoKTtcclxuICBjb25zdCBwcm9maWxlOiB0eXBlcy5JUHJvZmlsZSA9IHNlbGVjdG9ycy5hY3RpdmVQcm9maWxlKHN0YXRlKTtcclxuICByZXR1cm4gbmV3IEJsdWViaXJkPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcclxuICAgIHJldHVybiBmcy5lbnN1cmVEaXJXcml0YWJsZUFzeW5jKG1vZHNQYXRoKGRpc2NvdmVyeS5wYXRoKSlcclxuICAgICAgLnRoZW4oKCkgPT4gZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhwYXRoLmpvaW4oZGlzY292ZXJ5LnBhdGgsICdJblNsaW1WTUwnLCAnTW9kcycpKSlcclxuICAgICAgLnRoZW4oKCkgPT4gZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhwYXRoLmpvaW4oZGlzY292ZXJ5LnBhdGgsICdBZHZhbmNlZEJ1aWxkZXInLCAnQnVpbGRzJykpKVxyXG4gICAgICAudGhlbigoKSA9PiBwYXlsb2FkRGVwbG95ZXIub25XaWxsRGVwbG95KGNvbnRleHQsIHByb2ZpbGU/LmlkKSlcclxuICAgICAgLnRoZW4oKCkgPT4gcmVzb2x2ZSgpKVxyXG4gICAgICAuY2F0Y2goZXJyID0+IHJlamVjdChlcnIpKTtcclxuICB9KVxyXG4gIC50aGVuKCgpID0+IGVuc3VyZVVuc3RyaXBwZWRBc3NlbWJsaWVzKGNvbnRleHQuYXBpLCB7IHN0YXRlLCBwcm9maWxlLCBkaXNjb3ZlcnkgfSkpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtb2RzUGF0aChnYW1lUGF0aDogc3RyaW5nKSB7XHJcbiAgcmV0dXJuIHBhdGguam9pbihnYW1lUGF0aCwgJ0JlcEluRXgnLCAncGx1Z2lucycpO1xyXG59XHJcblxyXG5mdW5jdGlvbiBtYWluKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0KSB7XHJcbiAgY29udGV4dC5yZWdpc3RlckdhbWUoe1xyXG4gICAgaWQ6IEdBTUVfSUQsXHJcbiAgICBuYW1lOiAnVmFsaGVpbScsXHJcbiAgICBtZXJnZU1vZHM6IHRydWUsXHJcbiAgICBxdWVyeVBhdGg6IGZpbmRHYW1lLFxyXG4gICAgcXVlcnlNb2RQYXRoOiBtb2RzUGF0aCxcclxuICAgIGxvZ286ICdnYW1lYXJ0LmpwZycsXHJcbiAgICBleGVjdXRhYmxlOiAoKSA9PiAndmFsaGVpbS5leGUnLFxyXG4gICAgcmVxdWlyZXNMYXVuY2hlcixcclxuICAgIHNldHVwOiBkaXNjb3ZlcnkgPT4gcHJlcGFyZUZvck1vZGRpbmcoY29udGV4dCwgZGlzY292ZXJ5KSxcclxuICAgIHJlcXVpcmVkRmlsZXM6IFtcclxuICAgICAgJ3ZhbGhlaW0uZXhlJyxcclxuICAgIF0sXHJcbiAgICBlbnZpcm9ubWVudDoge1xyXG4gICAgICBTdGVhbUFQUElkOiBTVEVBTV9JRCxcclxuICAgIH0sXHJcbiAgICBkZXRhaWxzOiB7XHJcbiAgICAgIHN0ZWFtQXBwSWQ6ICtTVEVBTV9JRCxcclxuICAgICAgc3RvcFBhdHRlcm5zOiBTVE9QX1BBVFRFUk5TLm1hcCh0b1dvcmRFeHApLFxyXG4gICAgICBpZ25vcmVDb25mbGljdHM6IElHTk9SQUJMRV9GSUxFUyxcclxuICAgICAgaWdub3JlRGVwbG95OiBJR05PUkFCTEVfRklMRVMsXHJcbiAgICB9LFxyXG4gIH0pO1xyXG5cclxuICBjb25zdCBnZXRHYW1lUGF0aCA9ICgpID0+IHtcclxuICAgIGNvbnN0IHByb3BzOiBJUHJvcHMgPSBnZW5Qcm9wcyhjb250ZXh0KTtcclxuICAgIHJldHVybiAocHJvcHM/LmRpc2NvdmVyeT8ucGF0aCAhPT0gdW5kZWZpbmVkKVxyXG4gICAgICA/IHByb3BzLmRpc2NvdmVyeS5wYXRoIDogJy4nO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGlzU3VwcG9ydGVkID0gKGdhbWVJZDogc3RyaW5nKSA9PiAoZ2FtZUlkID09PSBHQU1FX0lEKTtcclxuICBjb25zdCBoYXNJbnN0cnVjdGlvbiA9IChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIHByZWQ6IChpbnN0OiB0eXBlcy5JSW5zdHJ1Y3Rpb24pID0+IGJvb2xlYW4pID0+XHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBpbnN0cnVjdGlvbnMuZmluZChpbnN0ciA9PiAoaW5zdHIudHlwZSA9PT0gJ2NvcHknKVxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgJiYgKHByZWQoaW5zdHIpKSkgIT09IHVuZGVmaW5lZDtcclxuXHJcbiAgY29uc3QgZmluZEluc3RyTWF0Y2ggPSAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBwYXR0ZXJuOiBzdHJpbmcsXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgbW9kPzogKGlucHV0OiBzdHJpbmcpID0+IHN0cmluZykgPT4ge1xyXG4gICAgaWYgKG1vZCA9PT0gdW5kZWZpbmVkKSB7XHJcbiAgICAgIG1vZCA9IChpbnB1dCkgPT4gaW5wdXQ7XHJcbiAgICB9XHJcbiAgICByZXR1cm4gaGFzSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb25zLCAoaW5zdHIpID0+XHJcbiAgICAgIG1vZChpbnN0ci5zb3VyY2UpLnRvTG93ZXJDYXNlKCkgPT09IHBhdHRlcm4udG9Mb3dlckNhc2UoKSk7XHJcbiAgfTtcclxuXHJcbiAgY29uc3QgaW5TbGltVm1sRGVwVGVzdCA9ICgpID0+IGlzRGVwZW5kZW5jeVJlcXVpcmVkKGNvbnRleHQuYXBpLCB7XHJcbiAgICBkZXBlbmRlbnRNb2RUeXBlOiAnaW5zbGltdm1sLW1vZCcsXHJcbiAgICBtYXN0ZXJNb2RUeXBlOiAnaW5zbGltdm1sLW1vZC1sb2FkZXInLFxyXG4gICAgbWFzdGVyTmFtZTogJ0luU2xpbVZNTCcsXHJcbiAgICBtYXN0ZXJVUkw6ICdodHRwczovL3d3dy5uZXh1c21vZHMuY29tL3ZhbGhlaW0vbW9kcy8yMScsXHJcbiAgfSk7XHJcblxyXG4gIGNvbnN0IHZidWlsZERlcFRlc3QgPSAoKSA9PiB7XHJcbiAgICBjb25zdCBnYW1lUGF0aCA9IGdldEdhbWVQYXRoKCk7XHJcbiAgICBjb25zdCBhZHZhbmNlZEJ1aWxkZXJBc3NlbWJseSA9IHBhdGguam9pbihnYW1lUGF0aCwgJ0luU2xpbVZNTCcsICdNb2RzJywgJ0NSLUFkdmFuY2VkQnVpbGRlci5kbGwnKTtcclxuICAgIHJldHVybiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgICBkZXBlbmRlbnRNb2RUeXBlOiAndmJ1aWxkLW1vZCcsXHJcbiAgICAgIG1hc3Rlck1vZFR5cGU6ICdpbnNsaW12bWwtbW9kJyxcclxuICAgICAgbWFzdGVyTmFtZTogJ0FkdmFuY2VkQnVpbGRlcicsXHJcbiAgICAgIG1hc3RlclVSTDogJ2h0dHBzOi8vd3d3Lm5leHVzbW9kcy5jb20vdmFsaGVpbS9tb2RzLzUnLFxyXG4gICAgICByZXF1aXJlZEZpbGVzOiBbIGFkdmFuY2VkQnVpbGRlckFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnaW5zbGltLWRlcC10ZXN0JywgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsIGluU2xpbVZtbERlcFRlc3QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJUZXN0KCdpbnNsaW0tZGVwLXRlc3QnLCAnbW9kLWluc3RhbGxlZCcsIGluU2xpbVZtbERlcFRlc3QpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgndmJ1aWxkLWRlcC10ZXN0JywgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsIHZidWlsZERlcFRlc3QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJUZXN0KCd2YnVpbGQtZGVwLXRlc3QnLCAnbW9kLWluc3RhbGxlZCcsIHZidWlsZERlcFRlc3QpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWNvcmUtcmVtb3ZlcicsIDIwLCB0ZXN0Q29yZVJlbW92ZXIsIGluc3RhbGxDb3JlUmVtb3Zlcik7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1pbnNsaW12bScsIDIwLCB0ZXN0SW5TbGltTW9kTG9hZGVyLCBpbnN0YWxsSW5TbGltTW9kTG9hZGVyKTtcclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLXZidWlsZCcsIDIwLCB0ZXN0VkJ1aWxkLCBpbnN0YWxsVkJ1aWxkTW9kKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ2luc2xpbXZtbC1tb2QtbG9hZGVyJywgMjAsIGlzU3VwcG9ydGVkLCBnZXRHYW1lUGF0aCxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IGhhc1ZNTEluaSA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgSU5TTElNVk1MX0lERU5USUZJRVIsIHBhdGguYmFzZW5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoaGFzVk1MSW5pKTtcclxuICAgIH0sIHsgbmFtZTogJ0luU2xpbVZNTCBNb2QgTG9hZGVyJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ2luc2xpbXZtbC1tb2QnLCAxMCwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0luU2xpbVZNTCcsICdNb2RzJyksIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIC8vIFVuZm9ydHVuYXRlbHkgdGhlcmUgYXJlIGN1cnJlbnRseSBubyBpZGVudGlmaWVycyB0byBkaWZmZXJlbnRpYXRlIGJldHdlZW5cclxuICAgICAgLy8gIEJlcEluRXggYW5kIEluU2xpbVZNTCBtb2RzIGFuZCB0aGVyZWZvcmUgY2Fubm90IGF1dG9tYXRpY2FsbHkgYXNzaWduXHJcbiAgICAgIC8vICB0aGlzIG1vZFR5cGUgYXV0b21hdGljYWxseS4gV2UgZG8ga25vdyB0aGF0IENSLUFkdmFuY2VkQnVpbGRlci5kbGwgaXMgYW4gSW5TbGltXHJcbiAgICAgIC8vICBtb2QsIGJ1dCB0aGF0J3MgYWJvdXQgaXQuXHJcbiAgICAgIGNvbnN0IHZtbFN1ZmZpeCA9ICdfdm1sLmRsbCc7XHJcbiAgICAgIGNvbnN0IG1vZCA9IChpbnB1dDogc3RyaW5nKSA9PiAoaW5wdXQubGVuZ3RoID4gdm1sU3VmZml4Lmxlbmd0aClcclxuICAgICAgICA/IHBhdGguYmFzZW5hbWUoaW5wdXQpLnNsaWNlKC12bWxTdWZmaXgubGVuZ3RoKVxyXG4gICAgICAgIDogJyc7XHJcbiAgICAgIGNvbnN0IHRlc3RSZXMgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsICdjci1hZHZhbmNlZGJ1aWxkZXIuZGxsJywgcGF0aC5iYXNlbmFtZSlcclxuICAgICAgICB8fCBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsICdfdm1sLmRsbCcsIG1vZCk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZSh0ZXN0UmVzKTtcclxuICAgIH0sIHsgbmFtZTogJ0luU2xpbVZNTCBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndmJ1aWxkLW1vZCcsIDEwLCBpc1N1cHBvcnRlZCwgKCkgPT4gcGF0aC5qb2luKGdldEdhbWVQYXRoKCksICdBZHZhbmNlZEJ1aWxkZXInLCAnQnVpbGRzJyksXHJcbiAgICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgICBjb25zdCByZXMgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsIFZCVUlMRF9FWFQsIHBhdGguZXh0bmFtZSk7XHJcbiAgICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShyZXMpO1xyXG4gICAgfSwgeyBuYW1lOiAnQWR2YW5jZWRCdWlsZCBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgndW5zdHJpcHBlZC1hc3NlbWJsaWVzJywgMjAsIGlzU3VwcG9ydGVkLCBnZXRHYW1lUGF0aCxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IHRlc3RQYXRoID0gcGF0aC5qb2luKCd1bnN0cmlwcGVkX21hbmFnZWQnLCAnbW9uby5wb3NpeC5kbGwnKTtcclxuICAgICAgY29uc3Qgc3VwcG9ydGVkID0gaGFzSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb25zLFxyXG4gICAgICAgIChpbnN0cikgPT4gaW5zdHIuc291cmNlLnRvTG93ZXJDYXNlKCkuaW5jbHVkZXModGVzdFBhdGgpKTtcclxuICAgICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKHN1cHBvcnRlZCk7XHJcbiAgICB9LCB7IG5hbWU6ICdVbnN0cmlwcGVkIEFzc2VtYmxpZXMnIH0pO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyTW9kVHlwZSgnYmVwaW5leC1yb290LW1vZCcsIDI1LCBpc1N1cHBvcnRlZCwgKCkgPT4gcGF0aC5qb2luKGdldEdhbWVQYXRoKCksICdCZXBJbkV4JyksXHJcbiAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgIGNvbnN0IG1hdGNoZXIgPSAoZmlsZVBhdGg6IHN0cmluZykgPT4ge1xyXG4gICAgICBjb25zdCBzZWdtZW50cyA9IGZpbGVQYXRoLnNwbGl0KHBhdGguc2VwKTtcclxuICAgICAgZm9yIChjb25zdCBzdG9wIG9mIFNUT1BfUEFUVEVSTlMpIHtcclxuICAgICAgICBpZiAoc2VnbWVudHMuaW5jbHVkZXMoc3RvcCkpIHtcclxuICAgICAgICAgIHJldHVybiB0cnVlO1xyXG4gICAgICAgIH1cclxuICAgICAgfVxyXG4gICAgICByZXR1cm4gZmFsc2U7XHJcbiAgICB9O1xyXG4gICAgY29uc3Qgc3VwcG9ydGVkID0gaGFzSW5zdHJ1Y3Rpb24oaW5zdHJ1Y3Rpb25zLCAoaW5zdHIpID0+IG1hdGNoZXIoaW5zdHIuc291cmNlKSk7XHJcbiAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ0JlcEluRXggUm9vdCBNb2QnIH0pO1xyXG5cclxuICBjb250ZXh0Lm9uY2UoKCkgPT4ge1xyXG4gICAgY29udGV4dC5hcGkub25Bc3luYygnd2lsbC1kZXBsb3knLCBhc3luYyAocHJvZmlsZUlkKSA9PlxyXG4gICAgICBwYXlsb2FkRGVwbG95ZXIub25XaWxsRGVwbG95KGNvbnRleHQsIHByb2ZpbGVJZCkpO1xyXG5cclxuICAgIGNvbnRleHQuYXBpLm9uQXN5bmMoJ2RpZC1wdXJnZScsIGFzeW5jIChwcm9maWxlSWQpID0+XHJcbiAgICAgIHBheWxvYWREZXBsb3llci5vbkRpZFB1cmdlKGNvbnRleHQsIHByb2ZpbGVJZCkpO1xyXG4gIH0pO1xyXG5cclxuICByZXR1cm4gdHJ1ZTtcclxufVxyXG5cclxuZXhwb3J0IGRlZmF1bHQgbWFpbjtcclxuIl19