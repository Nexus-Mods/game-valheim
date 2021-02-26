import Bluebird from 'bluebird';
import * as path from 'path';
import { fs, selectors, types, util } from 'vortex-api';
import * as payloadDeployer from './payloadDeployer';

import { GAME_ID, genProps, IGNORABLE_FILES, INSLIMVML_IDENTIFIER,
  IProps, STEAM_ID, VBUILD_EXT } from './common';
import { installCoreRemover, installInSlimModLoader, installVBuildMod,
  testCoreRemover, testInSlimModLoader, testVBuild } from './installers';
import { isDependencyRequired } from './tests';

const STOP_PATTERNS = ['config', 'plugins', 'patchers'];
function toWordExp(input) {
  return '(^|/)' + input + '(/|$)';
}

function findGame(): any {
  return util.GameStoreHelper.findByAppId([STEAM_ID])
    .then(game => game.gamePath);
}

function requiresLauncher(gamePath) {
  return fs.readdirAsync(gamePath)
    .then(files => (files.find(file => file.toLowerCase() === 'steam_appid.txt') !== undefined)
      ? Promise.resolve({
        launcher: 'steam',
        addInfo: {
          appId: STEAM_ID,
          parameters: ['-force-glcore'],
          launchType: 'gamestore',
        },
      })
      : Promise.resolve(undefined))
    .catch(err => Promise.reject(err));
}

async function ensureUnstrippedAssemblies(api: types.IExtensionApi, props: IProps): Promise<void> {
  const t = api.translate;
  const expectedFilePath = path.join(props.discovery.path,
    'unstripped_managed', 'mono.security.dll');

  const mods: { [modId: string]: types.IMod }
    = util.getSafe(props.state, ['persistent', 'mods', GAME_ID], {});

  const hasUnstrippedMod = Object.keys(mods).filter(key => mods[key]?.type === 'unstripped-assemblies').length > 0;
  if (hasUnstrippedMod) {
    return Promise.resolve();
  }
  try {
    await fs.statAsync(expectedFilePath);
    return;
  } catch (err) {
    return new Promise((resolve, reject) => {
      api.showDialog('info', 'Missing unstripped assemblies', {
        bbcode: t('Valheim\'s assemblies are distributed in an "optimised" state to reduce required '
        + 'disk space. This unfortunately means that Valheim\'s modding capabilities are also affected.{{br}}{{br}}'
        + 'In order to mod Valheim, the unoptimised/unstripped assemblies are required - please download these '
        + 'from the nexus.', { replace: { br: '[br][/br]' } }),
      }, [
        { label: 'Cancel', action: () => reject(new util.UserCanceled()) },
        {
          label: 'Download Unstripped Assemblies',
          action: () => util.opn('https://www.nexusmods.com/valheim/mods/15')
            .catch(err => null)
            .finally(() => resolve()),
        },
      ]);
    });
  }
}

function prepareForModding(context: types.IExtensionContext, discovery: types.IDiscoveryResult) {
  const state = context.api.getState();
  const profile: types.IProfile = selectors.activeProfile(state);
  return new Bluebird<void>((resolve, reject) => {
    return fs.ensureDirWritableAsync(modsPath(discovery.path))
      .then(() => fs.ensureDirWritableAsync(path.join(discovery.path, 'InSlimVML', 'Mods')))
      .then(() => fs.ensureDirWritableAsync(path.join(discovery.path, 'AdvancedBuilder', 'Builds')))
      .then(() => payloadDeployer.onWillDeploy(context, profile?.id))
      .then(() => resolve())
      .catch(err => reject(err));
  })
  .then(() => ensureUnstrippedAssemblies(context.api, { state, profile, discovery }));
}

function modsPath(gamePath: string) {
  return path.join(gamePath, 'BepInEx', 'plugins');
}

function main(context: types.IExtensionContext) {
  context.registerGame({
    id: GAME_ID,
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
      SteamAPPId: STEAM_ID,
    },
    details: {
      steamAppId: +STEAM_ID,
      stopPatterns: STOP_PATTERNS.map(toWordExp),
      ignoreConflicts: IGNORABLE_FILES,
      ignoreDeploy: IGNORABLE_FILES,
    },
  });

  const getGamePath = () => {
    const props: IProps = genProps(context);
    return (props?.discovery?.path !== undefined)
      ? props.discovery.path : '.';
  };

  const isSupported = (gameId: string) => (gameId === GAME_ID);
  const hasInstruction = (instructions: types.IInstruction[],
                          pred: (inst: types.IInstruction) => boolean) =>
                            instructions.find(instr => (instr.type === 'copy')
                                                    && (pred(instr))) !== undefined;

  const findInstrMatch = (instructions: types.IInstruction[],
                          pattern: string,
                          mod?: (input: string) => string) => {
    if (mod === undefined) {
      mod = (input) => input;
    }
    return hasInstruction(instructions, (instr) =>
      mod(instr.source).toLowerCase() === pattern.toLowerCase());
  };

  const inSlimVmlDepTest = () => isDependencyRequired(context.api, {
    dependentModType: 'inslimvml-mod',
    masterModType: 'inslimvml-mod-loader',
    masterName: 'InSlimVML',
    masterURL: 'https://www.nexusmods.com/valheim/mods/21',
  });

  const vbuildDepTest = () => {
    const gamePath = getGamePath();
    const advancedBuilderAssembly = path.join(gamePath, 'InSlimVML', 'Mods', 'CR-AdvancedBuilder.dll');
    return isDependencyRequired(context.api, {
      dependentModType: 'vbuild-mod',
      masterModType: 'inslimvml-mod',
      masterName: 'AdvancedBuilder',
      masterURL: 'https://www.nexusmods.com/valheim/mods/5',
      requiredFiles: [ advancedBuilderAssembly ],
    });
  };

  context.registerTest('inslim-dep-test', 'gamemode-activated', inSlimVmlDepTest);
  context.registerTest('inslim-dep-test', 'mod-installed', inSlimVmlDepTest);

  context.registerTest('vbuild-dep-test', 'gamemode-activated', vbuildDepTest);
  context.registerTest('vbuild-dep-test', 'mod-installed', vbuildDepTest);

  context.registerInstaller('valheim-core-remover', 20, testCoreRemover, installCoreRemover);
  context.registerInstaller('valheim-inslimvm', 20, testInSlimModLoader, installInSlimModLoader);
  context.registerInstaller('valheim-vbuild', 20, testVBuild, installVBuildMod);

  context.registerModType('inslimvml-mod-loader', 20, isSupported, getGamePath,
    (instructions: types.IInstruction[]) => {
      const hasVMLIni = findInstrMatch(instructions, INSLIMVML_IDENTIFIER, path.basename);
      return Bluebird.Promise.Promise.resolve(hasVMLIni);
    }, { name: 'InSlimVML Mod Loader' });

  context.registerModType('inslimvml-mod', 10, isSupported,
    () => path.join(getGamePath(), 'InSlimVML', 'Mods'), (instructions: types.IInstruction[]) => {
      // Unfortunately there are currently no identifiers to differentiate between
      //  BepInEx and InSlimVML mods and therefore cannot automatically assign
      //  this modType automatically. We do know that CR-AdvancedBuilder.dll is an InSlim
      //  mod, but that's about it.
      const vmlSuffix = '_vml.dll';
      const mod = (input: string) => (input.length > vmlSuffix.length)
        ? path.basename(input).slice(-vmlSuffix.length)
        : '';
      const testRes = findInstrMatch(instructions, 'cr-advancedbuilder.dll', path.basename)
        || findInstrMatch(instructions, '_vml.dll', mod);
      return Bluebird.Promise.Promise.resolve(testRes);
    }, { name: 'InSlimVML Mod' });

  context.registerModType('vbuild-mod', 10, isSupported, () => path.join(getGamePath(), 'AdvancedBuilder', 'Builds'),
    (instructions: types.IInstruction[]) => {
      const res = findInstrMatch(instructions, VBUILD_EXT, path.extname);
      return Bluebird.Promise.Promise.resolve(res);
    }, { name: 'AdvancedBuild Mod' });

  context.registerModType('unstripped-assemblies', 20, isSupported, getGamePath,
    (instructions: types.IInstruction[]) => {
      const testPath = path.join('unstripped_managed', 'mono.posix.dll');
      const supported = hasInstruction(instructions,
        (instr) => instr.source.toLowerCase().includes(testPath));
      return Bluebird.Promise.Promise.resolve(supported);
    }, { name: 'Unstripped Assemblies' });

  context.registerModType('bepinex-root-mod', 25, isSupported, () => path.join(getGamePath(), 'BepInEx'),
  (instructions: types.IInstruction[]) => {
    const matcher = (filePath: string) => {
      const segments = filePath.split(path.sep);
      for (const stop of STOP_PATTERNS) {
        if (segments.includes(stop)) {
          return true;
        }
      }
      return false;
    };
    const supported = hasInstruction(instructions, (instr) => matcher(instr.source));
    return Bluebird.Promise.Promise.resolve(supported);
    }, { name: 'BepInEx Root Mod' });

  context.once(() => {
    context.api.onAsync('will-deploy', async (profileId) =>
      payloadDeployer.onWillDeploy(context, profileId));

    context.api.onAsync('did-purge', async (profileId) =>
      payloadDeployer.onDidPurge(context, profileId));
  });

  return true;
}

export default main;
