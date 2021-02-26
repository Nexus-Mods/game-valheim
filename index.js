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
        const buildShareAssembly = path.join(gamePath, 'InSlimVML', 'Mods', 'CR-BuildShare_VML.dll');
        return tests_1.isDependencyRequired(context.api, {
            dependentModType: 'vbuild-mod',
            masterModType: 'inslimvml-mod',
            masterName: 'BuildShare',
            masterURL: 'https://www.nexusmods.com/valheim/mods/5',
            requiredFiles: [buildShareAssembly],
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
        const testRes = findInstrMatch(instructions, 'cr-buildshare_vml.dll', path.basename)
            || findInstrMatch(instructions, '_vml.dll', mod);
        return bluebird_1.default.Promise.Promise.resolve(testRes);
    }, { name: 'InSlimVML Mod' });
    context.registerModType('vbuild-mod', 10, isSupported, () => path.join(getGamePath(), 'AdvancedBuilder', 'Builds'), (instructions) => {
        const res = findInstrMatch(instructions, common_1.VBUILD_EXT, path.extname);
        return bluebird_1.default.Promise.Promise.resolve(res);
    }, { name: 'BuildShare Mod' });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJpbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQSx3REFBZ0M7QUFDaEMsMkNBQTZCO0FBQzdCLDJDQUF3RDtBQUN4RCxtRUFBcUQ7QUFFckQscUNBQ2lEO0FBQ2pELDZDQUN5RTtBQUN6RSxtQ0FBK0M7QUFFL0MsTUFBTSxhQUFhLEdBQUcsQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQ3hELFNBQVMsU0FBUyxDQUFDLEtBQUs7SUFDdEIsT0FBTyxPQUFPLEdBQUcsS0FBSyxHQUFHLE9BQU8sQ0FBQztBQUNuQyxDQUFDO0FBRUQsU0FBUyxRQUFRO0lBQ2YsT0FBTyxpQkFBSSxDQUFDLGVBQWUsQ0FBQyxXQUFXLENBQUMsQ0FBQyxpQkFBUSxDQUFDLENBQUM7U0FDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ2pDLENBQUM7QUFFRCxTQUFTLGdCQUFnQixDQUFDLFFBQVE7SUFDaEMsT0FBTyxlQUFFLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQztTQUM3QixJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEtBQUssaUJBQWlCLENBQUMsS0FBSyxTQUFTLENBQUM7UUFDekYsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDaEIsUUFBUSxFQUFFLE9BQU87WUFDakIsT0FBTyxFQUFFO2dCQUNQLEtBQUssRUFBRSxpQkFBUTtnQkFDZixVQUFVLEVBQUUsQ0FBQyxlQUFlLENBQUM7Z0JBQzdCLFVBQVUsRUFBRSxXQUFXO2FBQ3hCO1NBQ0YsQ0FBQztRQUNGLENBQUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1NBQzlCLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN2QyxDQUFDO0FBRUQsU0FBZSwwQkFBMEIsQ0FBQyxHQUF3QixFQUFFLEtBQWE7O1FBQy9FLE1BQU0sQ0FBQyxHQUFHLEdBQUcsQ0FBQyxTQUFTLENBQUM7UUFDeEIsTUFBTSxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUMsSUFBSSxFQUNyRCxvQkFBb0IsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO1FBRTdDLE1BQU0sSUFBSSxHQUNOLGlCQUFJLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQyxZQUFZLEVBQUUsTUFBTSxFQUFFLGdCQUFPLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztRQUVuRSxNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxFQUFFLFdBQUMsT0FBQSxPQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsMENBQUUsSUFBSSxNQUFLLHVCQUF1QixDQUFBLEVBQUEsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUM7UUFDakgsSUFBSSxnQkFBZ0IsRUFBRTtZQUNwQixPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztTQUMxQjtRQUNELElBQUk7WUFDRixNQUFNLGVBQUUsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztZQUNyQyxPQUFPO1NBQ1I7UUFBQyxPQUFPLEdBQUcsRUFBRTtZQUNaLE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7Z0JBQ3JDLEdBQUcsQ0FBQyxVQUFVLENBQUMsTUFBTSxFQUFFLCtCQUErQixFQUFFO29CQUN0RCxNQUFNLEVBQUUsQ0FBQyxDQUFDLG1GQUFtRjswQkFDM0YsMEdBQTBHOzBCQUMxRyxzR0FBc0c7MEJBQ3RHLGlCQUFpQixFQUFFLEVBQUUsT0FBTyxFQUFFLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFBRSxFQUFFLENBQUM7aUJBQ3ZELEVBQUU7b0JBQ0QsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxNQUFNLENBQUMsSUFBSSxpQkFBSSxDQUFDLFlBQVksRUFBRSxDQUFDLEVBQUU7b0JBQ2xFO3dCQUNFLEtBQUssRUFBRSxnQ0FBZ0M7d0JBQ3ZDLE1BQU0sRUFBRSxHQUFHLEVBQUUsQ0FBQyxpQkFBSSxDQUFDLEdBQUcsQ0FBQywyQ0FBMkMsQ0FBQzs2QkFDaEUsS0FBSyxDQUFDLEdBQUcsQ0FBQyxFQUFFLENBQUMsSUFBSSxDQUFDOzZCQUNsQixPQUFPLENBQUMsR0FBRyxFQUFFLENBQUMsT0FBTyxFQUFFLENBQUM7cUJBQzVCO2lCQUNGLENBQUMsQ0FBQztZQUNMLENBQUMsQ0FBQyxDQUFDO1NBQ0o7SUFDSCxDQUFDO0NBQUE7QUFFRCxTQUFTLGlCQUFpQixDQUFDLE9BQWdDLEVBQUUsU0FBaUM7SUFDNUYsTUFBTSxLQUFLLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNyQyxNQUFNLE9BQU8sR0FBbUIsc0JBQVMsQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDL0QsT0FBTyxJQUFJLGtCQUFRLENBQU8sQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFDNUMsT0FBTyxlQUFFLENBQUMsc0JBQXNCLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQzthQUN2RCxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsZUFBRSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQzthQUNyRixJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsZUFBRSxDQUFDLHNCQUFzQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksRUFBRSxpQkFBaUIsRUFBRSxRQUFRLENBQUMsQ0FBQyxDQUFDO2FBQzdGLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQyxlQUFlLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxPQUFPLGFBQVAsT0FBTyx1QkFBUCxPQUFPLENBQUUsRUFBRSxDQUFDLENBQUM7YUFDOUQsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDO2FBQ3JCLEtBQUssQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsQ0FBQyxDQUFDO0lBQy9CLENBQUMsQ0FBQztTQUNELElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQywwQkFBMEIsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsQ0FBQyxDQUFDLENBQUM7QUFDdEYsQ0FBQztBQUVELFNBQVMsUUFBUSxDQUFDLFFBQWdCO0lBQ2hDLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsU0FBUyxFQUFFLFNBQVMsQ0FBQyxDQUFDO0FBQ25ELENBQUM7QUFFRCxTQUFTLElBQUksQ0FBQyxPQUFnQztJQUM1QyxPQUFPLENBQUMsWUFBWSxDQUFDO1FBQ25CLEVBQUUsRUFBRSxnQkFBTztRQUNYLElBQUksRUFBRSxTQUFTO1FBQ2YsU0FBUyxFQUFFLElBQUk7UUFDZixTQUFTLEVBQUUsUUFBUTtRQUNuQixZQUFZLEVBQUUsUUFBUTtRQUN0QixJQUFJLEVBQUUsYUFBYTtRQUNuQixVQUFVLEVBQUUsR0FBRyxFQUFFLENBQUMsYUFBYTtRQUMvQixnQkFBZ0I7UUFDaEIsS0FBSyxFQUFFLFNBQVMsQ0FBQyxFQUFFLENBQUMsaUJBQWlCLENBQUMsT0FBTyxFQUFFLFNBQVMsQ0FBQztRQUN6RCxhQUFhLEVBQUU7WUFDYixhQUFhO1NBQ2Q7UUFDRCxXQUFXLEVBQUU7WUFDWCxVQUFVLEVBQUUsaUJBQVE7U0FDckI7UUFDRCxPQUFPLEVBQUU7WUFDUCxVQUFVLEVBQUUsQ0FBQyxpQkFBUTtZQUNyQixZQUFZLEVBQUUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUM7WUFDMUMsZUFBZSxFQUFFLHdCQUFlO1lBQ2hDLFlBQVksRUFBRSx3QkFBZTtTQUM5QjtLQUNGLENBQUMsQ0FBQztJQUVILE1BQU0sV0FBVyxHQUFHLEdBQUcsRUFBRTs7UUFDdkIsTUFBTSxLQUFLLEdBQVcsaUJBQVEsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUN4QyxPQUFPLENBQUMsT0FBQSxLQUFLLGFBQUwsS0FBSyx1QkFBTCxLQUFLLENBQUUsU0FBUywwQ0FBRSxJQUFJLE1BQUssU0FBUyxDQUFDO1lBQzNDLENBQUMsQ0FBQyxLQUFLLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsR0FBRyxDQUFDO0lBQ2pDLENBQUMsQ0FBQztJQUVGLE1BQU0sV0FBVyxHQUFHLENBQUMsTUFBYyxFQUFFLEVBQUUsQ0FBQyxDQUFDLE1BQU0sS0FBSyxnQkFBTyxDQUFDLENBQUM7SUFDN0QsTUFBTSxjQUFjLEdBQUcsQ0FBQyxZQUFrQyxFQUNsQyxJQUEyQyxFQUFFLEVBQUUsQ0FDN0MsWUFBWSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsS0FBSyxDQUFDLElBQUksS0FBSyxNQUFNLENBQUM7V0FDdkIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLFNBQVMsQ0FBQztJQUVsRixNQUFNLGNBQWMsR0FBRyxDQUFDLFlBQWtDLEVBQ2xDLE9BQWUsRUFDZixHQUErQixFQUFFLEVBQUU7UUFDekQsSUFBSSxHQUFHLEtBQUssU0FBUyxFQUFFO1lBQ3JCLEdBQUcsR0FBRyxDQUFDLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxDQUFDO1NBQ3hCO1FBQ0QsT0FBTyxjQUFjLENBQUMsWUFBWSxFQUFFLENBQUMsS0FBSyxFQUFFLEVBQUUsQ0FDNUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLEVBQUUsS0FBSyxPQUFPLENBQUMsV0FBVyxFQUFFLENBQUMsQ0FBQztJQUMvRCxDQUFDLENBQUM7SUFFRixNQUFNLGdCQUFnQixHQUFHLEdBQUcsRUFBRSxDQUFDLDRCQUFvQixDQUFDLE9BQU8sQ0FBQyxHQUFHLEVBQUU7UUFDL0QsZ0JBQWdCLEVBQUUsZUFBZTtRQUNqQyxhQUFhLEVBQUUsc0JBQXNCO1FBQ3JDLFVBQVUsRUFBRSxXQUFXO1FBQ3ZCLFNBQVMsRUFBRSwyQ0FBMkM7S0FDdkQsQ0FBQyxDQUFDO0lBRUgsTUFBTSxhQUFhLEdBQUcsR0FBRyxFQUFFO1FBQ3pCLE1BQU0sUUFBUSxHQUFHLFdBQVcsRUFBRSxDQUFDO1FBQy9CLE1BQU0sa0JBQWtCLEdBQUcsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsV0FBVyxFQUFFLE1BQU0sRUFBRSx1QkFBdUIsQ0FBQyxDQUFDO1FBQzdGLE9BQU8sNEJBQW9CLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRTtZQUN2QyxnQkFBZ0IsRUFBRSxZQUFZO1lBQzlCLGFBQWEsRUFBRSxlQUFlO1lBQzlCLFVBQVUsRUFBRSxZQUFZO1lBQ3hCLFNBQVMsRUFBRSwwQ0FBMEM7WUFDckQsYUFBYSxFQUFFLENBQUUsa0JBQWtCLENBQUU7U0FDdEMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDO0lBRUYsT0FBTyxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsRUFBRSxvQkFBb0IsRUFBRSxnQkFBZ0IsQ0FBQyxDQUFDO0lBQ2hGLE9BQU8sQ0FBQyxZQUFZLENBQUMsaUJBQWlCLEVBQUUsZUFBZSxFQUFFLGdCQUFnQixDQUFDLENBQUM7SUFFM0UsT0FBTyxDQUFDLFlBQVksQ0FBQyxpQkFBaUIsRUFBRSxvQkFBb0IsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUM3RSxPQUFPLENBQUMsWUFBWSxDQUFDLGlCQUFpQixFQUFFLGVBQWUsRUFBRSxhQUFhLENBQUMsQ0FBQztJQUV4RSxPQUFPLENBQUMsaUJBQWlCLENBQUMsc0JBQXNCLEVBQUUsRUFBRSxFQUFFLDRCQUFlLEVBQUUsK0JBQWtCLENBQUMsQ0FBQztJQUMzRixPQUFPLENBQUMsaUJBQWlCLENBQUMsa0JBQWtCLEVBQUUsRUFBRSxFQUFFLGdDQUFtQixFQUFFLG1DQUFzQixDQUFDLENBQUM7SUFDL0YsT0FBTyxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixFQUFFLEVBQUUsRUFBRSx1QkFBVSxFQUFFLDZCQUFnQixDQUFDLENBQUM7SUFFOUUsT0FBTyxDQUFDLGVBQWUsQ0FBQyxzQkFBc0IsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFDMUUsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSw2QkFBb0IsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDcEYsT0FBTyxrQkFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3JELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxzQkFBc0IsRUFBRSxDQUFDLENBQUM7SUFFdkMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxlQUFlLEVBQUUsRUFBRSxFQUFFLFdBQVcsRUFDdEQsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxXQUFXLEVBQUUsTUFBTSxDQUFDLEVBQUUsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFLMUYsTUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDO1FBQzdCLE1BQU0sR0FBRyxHQUFHLENBQUMsS0FBYSxFQUFFLEVBQUUsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLEdBQUcsU0FBUyxDQUFDLE1BQU0sQ0FBQztZQUM5RCxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDO1lBQy9DLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFDUCxNQUFNLE9BQU8sR0FBRyxjQUFjLENBQUMsWUFBWSxFQUFFLHVCQUF1QixFQUFFLElBQUksQ0FBQyxRQUFRLENBQUM7ZUFDL0UsY0FBYyxDQUFDLFlBQVksRUFBRSxVQUFVLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDbkQsT0FBTyxrQkFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ25ELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxlQUFlLEVBQUUsQ0FBQyxDQUFDO0lBRWhDLE9BQU8sQ0FBQyxlQUFlLENBQUMsWUFBWSxFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsRUFBRSxpQkFBaUIsRUFBRSxRQUFRLENBQUMsRUFDaEgsQ0FBQyxZQUFrQyxFQUFFLEVBQUU7UUFDckMsTUFBTSxHQUFHLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFBRSxtQkFBVSxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuRSxPQUFPLGtCQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLENBQUM7SUFDL0MsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLGdCQUFnQixFQUFFLENBQUMsQ0FBQztJQUVqQyxPQUFPLENBQUMsZUFBZSxDQUFDLHVCQUF1QixFQUFFLEVBQUUsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUMzRSxDQUFDLFlBQWtDLEVBQUUsRUFBRTtRQUNyQyxNQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsSUFBSSxDQUFDLG9CQUFvQixFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDbkUsTUFBTSxTQUFTLEdBQUcsY0FBYyxDQUFDLFlBQVksRUFDM0MsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsV0FBVyxFQUFFLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7UUFDNUQsT0FBTyxrQkFBUSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ3JELENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSx1QkFBdUIsRUFBRSxDQUFDLENBQUM7SUFFeEMsT0FBTyxDQUFDLGVBQWUsQ0FBQyxrQkFBa0IsRUFBRSxFQUFFLEVBQUUsV0FBVyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLEVBQUUsU0FBUyxDQUFDLEVBQ3RHLENBQUMsWUFBa0MsRUFBRSxFQUFFO1FBQ3JDLE1BQU0sT0FBTyxHQUFHLENBQUMsUUFBZ0IsRUFBRSxFQUFFO1lBQ25DLE1BQU0sUUFBUSxHQUFHLFFBQVEsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQzFDLEtBQUssTUFBTSxJQUFJLElBQUksYUFBYSxFQUFFO2dCQUNoQyxJQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQUU7b0JBQzNCLE9BQU8sSUFBSSxDQUFDO2lCQUNiO2FBQ0Y7WUFDRCxPQUFPLEtBQUssQ0FBQztRQUNmLENBQUMsQ0FBQztRQUNGLE1BQU0sU0FBUyxHQUFHLGNBQWMsQ0FBQyxZQUFZLEVBQUUsQ0FBQyxLQUFLLEVBQUUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUNqRixPQUFPLGtCQUFRLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDbkQsQ0FBQyxFQUFFLEVBQUUsSUFBSSxFQUFFLGtCQUFrQixFQUFFLENBQUMsQ0FBQztJQUVuQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsRUFBRTtRQUNoQixPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxhQUFhLEVBQUUsQ0FBTyxTQUFTLEVBQUUsRUFBRSxnREFDckQsT0FBQSxlQUFlLENBQUMsWUFBWSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQSxHQUFBLENBQUMsQ0FBQztRQUVwRCxPQUFPLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxXQUFXLEVBQUUsQ0FBTyxTQUFTLEVBQUUsRUFBRSxnREFDbkQsT0FBQSxlQUFlLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxTQUFTLENBQUMsQ0FBQSxHQUFBLENBQUMsQ0FBQztJQUNwRCxDQUFDLENBQUMsQ0FBQztJQUVILE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVELGtCQUFlLElBQUksQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCBCbHVlYmlyZCBmcm9tICdibHVlYmlyZCc7XHJcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAncGF0aCc7XHJcbmltcG9ydCB7IGZzLCBzZWxlY3RvcnMsIHR5cGVzLCB1dGlsIH0gZnJvbSAndm9ydGV4LWFwaSc7XHJcbmltcG9ydCAqIGFzIHBheWxvYWREZXBsb3llciBmcm9tICcuL3BheWxvYWREZXBsb3llcic7XHJcblxyXG5pbXBvcnQgeyBHQU1FX0lELCBnZW5Qcm9wcywgSUdOT1JBQkxFX0ZJTEVTLCBJTlNMSU1WTUxfSURFTlRJRklFUixcclxuICBJUHJvcHMsIFNURUFNX0lELCBWQlVJTERfRVhUIH0gZnJvbSAnLi9jb21tb24nO1xyXG5pbXBvcnQgeyBpbnN0YWxsQ29yZVJlbW92ZXIsIGluc3RhbGxJblNsaW1Nb2RMb2FkZXIsIGluc3RhbGxWQnVpbGRNb2QsXHJcbiAgdGVzdENvcmVSZW1vdmVyLCB0ZXN0SW5TbGltTW9kTG9hZGVyLCB0ZXN0VkJ1aWxkIH0gZnJvbSAnLi9pbnN0YWxsZXJzJztcclxuaW1wb3J0IHsgaXNEZXBlbmRlbmN5UmVxdWlyZWQgfSBmcm9tICcuL3Rlc3RzJztcclxuXHJcbmNvbnN0IFNUT1BfUEFUVEVSTlMgPSBbJ2NvbmZpZycsICdwbHVnaW5zJywgJ3BhdGNoZXJzJ107XHJcbmZ1bmN0aW9uIHRvV29yZEV4cChpbnB1dCkge1xyXG4gIHJldHVybiAnKF58LyknICsgaW5wdXQgKyAnKC98JCknO1xyXG59XHJcblxyXG5mdW5jdGlvbiBmaW5kR2FtZSgpOiBhbnkge1xyXG4gIHJldHVybiB1dGlsLkdhbWVTdG9yZUhlbHBlci5maW5kQnlBcHBJZChbU1RFQU1fSURdKVxyXG4gICAgLnRoZW4oZ2FtZSA9PiBnYW1lLmdhbWVQYXRoKTtcclxufVxyXG5cclxuZnVuY3Rpb24gcmVxdWlyZXNMYXVuY2hlcihnYW1lUGF0aCkge1xyXG4gIHJldHVybiBmcy5yZWFkZGlyQXN5bmMoZ2FtZVBhdGgpXHJcbiAgICAudGhlbihmaWxlcyA9PiAoZmlsZXMuZmluZChmaWxlID0+IGZpbGUudG9Mb3dlckNhc2UoKSA9PT0gJ3N0ZWFtX2FwcGlkLnR4dCcpICE9PSB1bmRlZmluZWQpXHJcbiAgICAgID8gUHJvbWlzZS5yZXNvbHZlKHtcclxuICAgICAgICBsYXVuY2hlcjogJ3N0ZWFtJyxcclxuICAgICAgICBhZGRJbmZvOiB7XHJcbiAgICAgICAgICBhcHBJZDogU1RFQU1fSUQsXHJcbiAgICAgICAgICBwYXJhbWV0ZXJzOiBbJy1mb3JjZS1nbGNvcmUnXSxcclxuICAgICAgICAgIGxhdW5jaFR5cGU6ICdnYW1lc3RvcmUnLFxyXG4gICAgICAgIH0sXHJcbiAgICAgIH0pXHJcbiAgICAgIDogUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCkpXHJcbiAgICAuY2F0Y2goZXJyID0+IFByb21pc2UucmVqZWN0KGVycikpO1xyXG59XHJcblxyXG5hc3luYyBmdW5jdGlvbiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyhhcGk6IHR5cGVzLklFeHRlbnNpb25BcGksIHByb3BzOiBJUHJvcHMpOiBQcm9taXNlPHZvaWQ+IHtcclxuICBjb25zdCB0ID0gYXBpLnRyYW5zbGF0ZTtcclxuICBjb25zdCBleHBlY3RlZEZpbGVQYXRoID0gcGF0aC5qb2luKHByb3BzLmRpc2NvdmVyeS5wYXRoLFxyXG4gICAgJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnNlY3VyaXR5LmRsbCcpO1xyXG5cclxuICBjb25zdCBtb2RzOiB7IFttb2RJZDogc3RyaW5nXTogdHlwZXMuSU1vZCB9XHJcbiAgICA9IHV0aWwuZ2V0U2FmZShwcm9wcy5zdGF0ZSwgWydwZXJzaXN0ZW50JywgJ21vZHMnLCBHQU1FX0lEXSwge30pO1xyXG5cclxuICBjb25zdCBoYXNVbnN0cmlwcGVkTW9kID0gT2JqZWN0LmtleXMobW9kcykuZmlsdGVyKGtleSA9PiBtb2RzW2tleV0/LnR5cGUgPT09ICd1bnN0cmlwcGVkLWFzc2VtYmxpZXMnKS5sZW5ndGggPiAwO1xyXG4gIGlmIChoYXNVbnN0cmlwcGVkTW9kKSB7XHJcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XHJcbiAgfVxyXG4gIHRyeSB7XHJcbiAgICBhd2FpdCBmcy5zdGF0QXN5bmMoZXhwZWN0ZWRGaWxlUGF0aCk7XHJcbiAgICByZXR1cm47XHJcbiAgfSBjYXRjaCAoZXJyKSB7XHJcbiAgICByZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xyXG4gICAgICBhcGkuc2hvd0RpYWxvZygnaW5mbycsICdNaXNzaW5nIHVuc3RyaXBwZWQgYXNzZW1ibGllcycsIHtcclxuICAgICAgICBiYmNvZGU6IHQoJ1ZhbGhlaW1cXCdzIGFzc2VtYmxpZXMgYXJlIGRpc3RyaWJ1dGVkIGluIGFuIFwib3B0aW1pc2VkXCIgc3RhdGUgdG8gcmVkdWNlIHJlcXVpcmVkICdcclxuICAgICAgICArICdkaXNrIHNwYWNlLiBUaGlzIHVuZm9ydHVuYXRlbHkgbWVhbnMgdGhhdCBWYWxoZWltXFwncyBtb2RkaW5nIGNhcGFiaWxpdGllcyBhcmUgYWxzbyBhZmZlY3RlZC57e2JyfX17e2JyfX0nXHJcbiAgICAgICAgKyAnSW4gb3JkZXIgdG8gbW9kIFZhbGhlaW0sIHRoZSB1bm9wdGltaXNlZC91bnN0cmlwcGVkIGFzc2VtYmxpZXMgYXJlIHJlcXVpcmVkIC0gcGxlYXNlIGRvd25sb2FkIHRoZXNlICdcclxuICAgICAgICArICdmcm9tIHRoZSBuZXh1cy4nLCB7IHJlcGxhY2U6IHsgYnI6ICdbYnJdWy9icl0nIH0gfSksXHJcbiAgICAgIH0sIFtcclxuICAgICAgICB7IGxhYmVsOiAnQ2FuY2VsJywgYWN0aW9uOiAoKSA9PiByZWplY3QobmV3IHV0aWwuVXNlckNhbmNlbGVkKCkpIH0sXHJcbiAgICAgICAge1xyXG4gICAgICAgICAgbGFiZWw6ICdEb3dubG9hZCBVbnN0cmlwcGVkIEFzc2VtYmxpZXMnLFxyXG4gICAgICAgICAgYWN0aW9uOiAoKSA9PiB1dGlsLm9wbignaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvMTUnKVxyXG4gICAgICAgICAgICAuY2F0Y2goZXJyID0+IG51bGwpXHJcbiAgICAgICAgICAgIC5maW5hbGx5KCgpID0+IHJlc29sdmUoKSksXHJcbiAgICAgICAgfSxcclxuICAgICAgXSk7XHJcbiAgICB9KTtcclxuICB9XHJcbn1cclxuXHJcbmZ1bmN0aW9uIHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQ6IHR5cGVzLklFeHRlbnNpb25Db250ZXh0LCBkaXNjb3Zlcnk6IHR5cGVzLklEaXNjb3ZlcnlSZXN1bHQpIHtcclxuICBjb25zdCBzdGF0ZSA9IGNvbnRleHQuYXBpLmdldFN0YXRlKCk7XHJcbiAgY29uc3QgcHJvZmlsZTogdHlwZXMuSVByb2ZpbGUgPSBzZWxlY3RvcnMuYWN0aXZlUHJvZmlsZShzdGF0ZSk7XHJcbiAgcmV0dXJuIG5ldyBCbHVlYmlyZDx2b2lkPigocmVzb2x2ZSwgcmVqZWN0KSA9PiB7XHJcbiAgICByZXR1cm4gZnMuZW5zdXJlRGlyV3JpdGFibGVBc3luYyhtb2RzUGF0aChkaXNjb3ZlcnkucGF0aCkpXHJcbiAgICAgIC50aGVuKCgpID0+IGZzLmVuc3VyZURpcldyaXRhYmxlQXN5bmMocGF0aC5qb2luKGRpc2NvdmVyeS5wYXRoLCAnSW5TbGltVk1MJywgJ01vZHMnKSkpXHJcbiAgICAgIC50aGVuKCgpID0+IGZzLmVuc3VyZURpcldyaXRhYmxlQXN5bmMocGF0aC5qb2luKGRpc2NvdmVyeS5wYXRoLCAnQWR2YW5jZWRCdWlsZGVyJywgJ0J1aWxkcycpKSlcclxuICAgICAgLnRoZW4oKCkgPT4gcGF5bG9hZERlcGxveWVyLm9uV2lsbERlcGxveShjb250ZXh0LCBwcm9maWxlPy5pZCkpXHJcbiAgICAgIC50aGVuKCgpID0+IHJlc29sdmUoKSlcclxuICAgICAgLmNhdGNoKGVyciA9PiByZWplY3QoZXJyKSk7XHJcbiAgfSlcclxuICAudGhlbigoKSA9PiBlbnN1cmVVbnN0cmlwcGVkQXNzZW1ibGllcyhjb250ZXh0LmFwaSwgeyBzdGF0ZSwgcHJvZmlsZSwgZGlzY292ZXJ5IH0pKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbW9kc1BhdGgoZ2FtZVBhdGg6IHN0cmluZykge1xyXG4gIHJldHVybiBwYXRoLmpvaW4oZ2FtZVBhdGgsICdCZXBJbkV4JywgJ3BsdWdpbnMnKTtcclxufVxyXG5cclxuZnVuY3Rpb24gbWFpbihjb250ZXh0OiB0eXBlcy5JRXh0ZW5zaW9uQ29udGV4dCkge1xyXG4gIGNvbnRleHQucmVnaXN0ZXJHYW1lKHtcclxuICAgIGlkOiBHQU1FX0lELFxyXG4gICAgbmFtZTogJ1ZhbGhlaW0nLFxyXG4gICAgbWVyZ2VNb2RzOiB0cnVlLFxyXG4gICAgcXVlcnlQYXRoOiBmaW5kR2FtZSxcclxuICAgIHF1ZXJ5TW9kUGF0aDogbW9kc1BhdGgsXHJcbiAgICBsb2dvOiAnZ2FtZWFydC5qcGcnLFxyXG4gICAgZXhlY3V0YWJsZTogKCkgPT4gJ3ZhbGhlaW0uZXhlJyxcclxuICAgIHJlcXVpcmVzTGF1bmNoZXIsXHJcbiAgICBzZXR1cDogZGlzY292ZXJ5ID0+IHByZXBhcmVGb3JNb2RkaW5nKGNvbnRleHQsIGRpc2NvdmVyeSksXHJcbiAgICByZXF1aXJlZEZpbGVzOiBbXHJcbiAgICAgICd2YWxoZWltLmV4ZScsXHJcbiAgICBdLFxyXG4gICAgZW52aXJvbm1lbnQ6IHtcclxuICAgICAgU3RlYW1BUFBJZDogU1RFQU1fSUQsXHJcbiAgICB9LFxyXG4gICAgZGV0YWlsczoge1xyXG4gICAgICBzdGVhbUFwcElkOiArU1RFQU1fSUQsXHJcbiAgICAgIHN0b3BQYXR0ZXJuczogU1RPUF9QQVRURVJOUy5tYXAodG9Xb3JkRXhwKSxcclxuICAgICAgaWdub3JlQ29uZmxpY3RzOiBJR05PUkFCTEVfRklMRVMsXHJcbiAgICAgIGlnbm9yZURlcGxveTogSUdOT1JBQkxFX0ZJTEVTLFxyXG4gICAgfSxcclxuICB9KTtcclxuXHJcbiAgY29uc3QgZ2V0R2FtZVBhdGggPSAoKSA9PiB7XHJcbiAgICBjb25zdCBwcm9wczogSVByb3BzID0gZ2VuUHJvcHMoY29udGV4dCk7XHJcbiAgICByZXR1cm4gKHByb3BzPy5kaXNjb3Zlcnk/LnBhdGggIT09IHVuZGVmaW5lZClcclxuICAgICAgPyBwcm9wcy5kaXNjb3ZlcnkucGF0aCA6ICcuJztcclxuICB9O1xyXG5cclxuICBjb25zdCBpc1N1cHBvcnRlZCA9IChnYW1lSWQ6IHN0cmluZykgPT4gKGdhbWVJZCA9PT0gR0FNRV9JRCk7XHJcbiAgY29uc3QgaGFzSW5zdHJ1Y3Rpb24gPSAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSxcclxuICAgICAgICAgICAgICAgICAgICAgICAgICBwcmVkOiAoaW5zdDogdHlwZXMuSUluc3RydWN0aW9uKSA9PiBib29sZWFuKSA9PlxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgaW5zdHJ1Y3Rpb25zLmZpbmQoaW5zdHIgPT4gKGluc3RyLnR5cGUgPT09ICdjb3B5JylcclxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICYmIChwcmVkKGluc3RyKSkpICE9PSB1bmRlZmluZWQ7XHJcblxyXG4gIGNvbnN0IGZpbmRJbnN0ck1hdGNoID0gKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10sXHJcbiAgICAgICAgICAgICAgICAgICAgICAgICAgcGF0dGVybjogc3RyaW5nLFxyXG4gICAgICAgICAgICAgICAgICAgICAgICAgIG1vZD86IChpbnB1dDogc3RyaW5nKSA9PiBzdHJpbmcpID0+IHtcclxuICAgIGlmIChtb2QgPT09IHVuZGVmaW5lZCkge1xyXG4gICAgICBtb2QgPSAoaW5wdXQpID0+IGlucHV0O1xyXG4gICAgfVxyXG4gICAgcmV0dXJuIGhhc0luc3RydWN0aW9uKGluc3RydWN0aW9ucywgKGluc3RyKSA9PlxyXG4gICAgICBtb2QoaW5zdHIuc291cmNlKS50b0xvd2VyQ2FzZSgpID09PSBwYXR0ZXJuLnRvTG93ZXJDYXNlKCkpO1xyXG4gIH07XHJcblxyXG4gIGNvbnN0IGluU2xpbVZtbERlcFRlc3QgPSAoKSA9PiBpc0RlcGVuZGVuY3lSZXF1aXJlZChjb250ZXh0LmFwaSwge1xyXG4gICAgZGVwZW5kZW50TW9kVHlwZTogJ2luc2xpbXZtbC1tb2QnLFxyXG4gICAgbWFzdGVyTW9kVHlwZTogJ2luc2xpbXZtbC1tb2QtbG9hZGVyJyxcclxuICAgIG1hc3Rlck5hbWU6ICdJblNsaW1WTUwnLFxyXG4gICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvMjEnLFxyXG4gIH0pO1xyXG5cclxuICBjb25zdCB2YnVpbGREZXBUZXN0ID0gKCkgPT4ge1xyXG4gICAgY29uc3QgZ2FtZVBhdGggPSBnZXRHYW1lUGF0aCgpO1xyXG4gICAgY29uc3QgYnVpbGRTaGFyZUFzc2VtYmx5ID0gcGF0aC5qb2luKGdhbWVQYXRoLCAnSW5TbGltVk1MJywgJ01vZHMnLCAnQ1ItQnVpbGRTaGFyZV9WTUwuZGxsJyk7XHJcbiAgICByZXR1cm4gaXNEZXBlbmRlbmN5UmVxdWlyZWQoY29udGV4dC5hcGksIHtcclxuICAgICAgZGVwZW5kZW50TW9kVHlwZTogJ3ZidWlsZC1tb2QnLFxyXG4gICAgICBtYXN0ZXJNb2RUeXBlOiAnaW5zbGltdm1sLW1vZCcsXHJcbiAgICAgIG1hc3Rlck5hbWU6ICdCdWlsZFNoYXJlJyxcclxuICAgICAgbWFzdGVyVVJMOiAnaHR0cHM6Ly93d3cubmV4dXNtb2RzLmNvbS92YWxoZWltL21vZHMvNScsXHJcbiAgICAgIHJlcXVpcmVkRmlsZXM6IFsgYnVpbGRTaGFyZUFzc2VtYmx5IF0sXHJcbiAgICB9KTtcclxuICB9O1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgnaW5zbGltLWRlcC10ZXN0JywgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsIGluU2xpbVZtbERlcFRlc3QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJUZXN0KCdpbnNsaW0tZGVwLXRlc3QnLCAnbW9kLWluc3RhbGxlZCcsIGluU2xpbVZtbERlcFRlc3QpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVyVGVzdCgndmJ1aWxkLWRlcC10ZXN0JywgJ2dhbWVtb2RlLWFjdGl2YXRlZCcsIHZidWlsZERlcFRlc3QpO1xyXG4gIGNvbnRleHQucmVnaXN0ZXJUZXN0KCd2YnVpbGQtZGVwLXRlc3QnLCAnbW9kLWluc3RhbGxlZCcsIHZidWlsZERlcFRlc3QpO1xyXG5cclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLWNvcmUtcmVtb3ZlcicsIDIwLCB0ZXN0Q29yZVJlbW92ZXIsIGluc3RhbGxDb3JlUmVtb3Zlcik7XHJcbiAgY29udGV4dC5yZWdpc3Rlckluc3RhbGxlcigndmFsaGVpbS1pbnNsaW12bScsIDIwLCB0ZXN0SW5TbGltTW9kTG9hZGVyLCBpbnN0YWxsSW5TbGltTW9kTG9hZGVyKTtcclxuICBjb250ZXh0LnJlZ2lzdGVySW5zdGFsbGVyKCd2YWxoZWltLXZidWlsZCcsIDIwLCB0ZXN0VkJ1aWxkLCBpbnN0YWxsVkJ1aWxkTW9kKTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ2luc2xpbXZtbC1tb2QtbG9hZGVyJywgMjAsIGlzU3VwcG9ydGVkLCBnZXRHYW1lUGF0aCxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IGhhc1ZNTEluaSA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgSU5TTElNVk1MX0lERU5USUZJRVIsIHBhdGguYmFzZW5hbWUpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoaGFzVk1MSW5pKTtcclxuICAgIH0sIHsgbmFtZTogJ0luU2xpbVZNTCBNb2QgTG9hZGVyJyB9KTtcclxuXHJcbiAgY29udGV4dC5yZWdpc3Rlck1vZFR5cGUoJ2luc2xpbXZtbC1tb2QnLCAxMCwgaXNTdXBwb3J0ZWQsXHJcbiAgICAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0luU2xpbVZNTCcsICdNb2RzJyksIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIC8vIFVuZm9ydHVuYXRlbHkgdGhlcmUgYXJlIGN1cnJlbnRseSBubyBpZGVudGlmaWVycyB0byBkaWZmZXJlbnRpYXRlIGJldHdlZW5cclxuICAgICAgLy8gIEJlcEluRXggYW5kIEluU2xpbVZNTCBtb2RzIGFuZCB0aGVyZWZvcmUgY2Fubm90IGF1dG9tYXRpY2FsbHkgYXNzaWduXHJcbiAgICAgIC8vICB0aGlzIG1vZFR5cGUgYXV0b21hdGljYWxseS4gV2UgZG8ga25vdyB0aGF0IENSLUFkdmFuY2VkQnVpbGRlci5kbGwgaXMgYW4gSW5TbGltXHJcbiAgICAgIC8vICBtb2QsIGJ1dCB0aGF0J3MgYWJvdXQgaXQuXHJcbiAgICAgIGNvbnN0IHZtbFN1ZmZpeCA9ICdfdm1sLmRsbCc7XHJcbiAgICAgIGNvbnN0IG1vZCA9IChpbnB1dDogc3RyaW5nKSA9PiAoaW5wdXQubGVuZ3RoID4gdm1sU3VmZml4Lmxlbmd0aClcclxuICAgICAgICA/IHBhdGguYmFzZW5hbWUoaW5wdXQpLnNsaWNlKC12bWxTdWZmaXgubGVuZ3RoKVxyXG4gICAgICAgIDogJyc7XHJcbiAgICAgIGNvbnN0IHRlc3RSZXMgPSBmaW5kSW5zdHJNYXRjaChpbnN0cnVjdGlvbnMsICdjci1idWlsZHNoYXJlX3ZtbC5kbGwnLCBwYXRoLmJhc2VuYW1lKVxyXG4gICAgICAgIHx8IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgJ192bWwuZGxsJywgbW9kKTtcclxuICAgICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKHRlc3RSZXMpO1xyXG4gICAgfSwgeyBuYW1lOiAnSW5TbGltVk1MIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd2YnVpbGQtbW9kJywgMTAsIGlzU3VwcG9ydGVkLCAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0FkdmFuY2VkQnVpbGRlcicsICdCdWlsZHMnKSxcclxuICAgIChpbnN0cnVjdGlvbnM6IHR5cGVzLklJbnN0cnVjdGlvbltdKSA9PiB7XHJcbiAgICAgIGNvbnN0IHJlcyA9IGZpbmRJbnN0ck1hdGNoKGluc3RydWN0aW9ucywgVkJVSUxEX0VYVCwgcGF0aC5leHRuYW1lKTtcclxuICAgICAgcmV0dXJuIEJsdWViaXJkLlByb21pc2UuUHJvbWlzZS5yZXNvbHZlKHJlcyk7XHJcbiAgICB9LCB7IG5hbWU6ICdCdWlsZFNoYXJlIE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCd1bnN0cmlwcGVkLWFzc2VtYmxpZXMnLCAyMCwgaXNTdXBwb3J0ZWQsIGdldEdhbWVQYXRoLFxyXG4gICAgKGluc3RydWN0aW9uczogdHlwZXMuSUluc3RydWN0aW9uW10pID0+IHtcclxuICAgICAgY29uc3QgdGVzdFBhdGggPSBwYXRoLmpvaW4oJ3Vuc3RyaXBwZWRfbWFuYWdlZCcsICdtb25vLnBvc2l4LmRsbCcpO1xyXG4gICAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsXHJcbiAgICAgICAgKGluc3RyKSA9PiBpbnN0ci5zb3VyY2UudG9Mb3dlckNhc2UoKS5pbmNsdWRlcyh0ZXN0UGF0aCkpO1xyXG4gICAgICByZXR1cm4gQmx1ZWJpcmQuUHJvbWlzZS5Qcm9taXNlLnJlc29sdmUoc3VwcG9ydGVkKTtcclxuICAgIH0sIHsgbmFtZTogJ1Vuc3RyaXBwZWQgQXNzZW1ibGllcycgfSk7XHJcblxyXG4gIGNvbnRleHQucmVnaXN0ZXJNb2RUeXBlKCdiZXBpbmV4LXJvb3QtbW9kJywgMjUsIGlzU3VwcG9ydGVkLCAoKSA9PiBwYXRoLmpvaW4oZ2V0R2FtZVBhdGgoKSwgJ0JlcEluRXgnKSxcclxuICAoaW5zdHJ1Y3Rpb25zOiB0eXBlcy5JSW5zdHJ1Y3Rpb25bXSkgPT4ge1xyXG4gICAgY29uc3QgbWF0Y2hlciA9IChmaWxlUGF0aDogc3RyaW5nKSA9PiB7XHJcbiAgICAgIGNvbnN0IHNlZ21lbnRzID0gZmlsZVBhdGguc3BsaXQocGF0aC5zZXApO1xyXG4gICAgICBmb3IgKGNvbnN0IHN0b3Agb2YgU1RPUF9QQVRURVJOUykge1xyXG4gICAgICAgIGlmIChzZWdtZW50cy5pbmNsdWRlcyhzdG9wKSkge1xyXG4gICAgICAgICAgcmV0dXJuIHRydWU7XHJcbiAgICAgICAgfVxyXG4gICAgICB9XHJcbiAgICAgIHJldHVybiBmYWxzZTtcclxuICAgIH07XHJcbiAgICBjb25zdCBzdXBwb3J0ZWQgPSBoYXNJbnN0cnVjdGlvbihpbnN0cnVjdGlvbnMsIChpbnN0cikgPT4gbWF0Y2hlcihpbnN0ci5zb3VyY2UpKTtcclxuICAgIHJldHVybiBCbHVlYmlyZC5Qcm9taXNlLlByb21pc2UucmVzb2x2ZShzdXBwb3J0ZWQpO1xyXG4gICAgfSwgeyBuYW1lOiAnQmVwSW5FeCBSb290IE1vZCcgfSk7XHJcblxyXG4gIGNvbnRleHQub25jZSgoKSA9PiB7XHJcbiAgICBjb250ZXh0LmFwaS5vbkFzeW5jKCd3aWxsLWRlcGxveScsIGFzeW5jIChwcm9maWxlSWQpID0+XHJcbiAgICAgIHBheWxvYWREZXBsb3llci5vbldpbGxEZXBsb3koY29udGV4dCwgcHJvZmlsZUlkKSk7XHJcblxyXG4gICAgY29udGV4dC5hcGkub25Bc3luYygnZGlkLXB1cmdlJywgYXN5bmMgKHByb2ZpbGVJZCkgPT5cclxuICAgICAgcGF5bG9hZERlcGxveWVyLm9uRGlkUHVyZ2UoY29udGV4dCwgcHJvZmlsZUlkKSk7XHJcbiAgfSk7XHJcblxyXG4gIHJldHVybiB0cnVlO1xyXG59XHJcblxyXG5leHBvcnQgZGVmYXVsdCBtYWluO1xyXG4iXX0=