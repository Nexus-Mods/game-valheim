import Promise from 'bluebird';
import path from 'path';
import semver from 'semver';
import { actions, fs, log, selectors, types, util } from 'vortex-api';

import * as payloadDeployer from './payloadDeployer';

import { CONF_MANAGER, GAME_ID, walkDirPath } from './common';

const WORLDS_PATH = path.resolve(util.getVortexPath('appData'),
  '..', 'LocalLow', 'IronGate', 'Valheim', 'vortex-worlds');

export function migrate1015(api: types.IExtensionApi, oldVersion: string): Promise<void> {
  // yet another bloody migration.... ugh!
  if (semver.gte(oldVersion, '1.0.15')) {
    return Promise.resolve();
  }

  const state = api.getState();
  const stagingFolder = selectors.installPathForGame(state, GAME_ID);
  const discoveryPath = util.getSafe(state,
    ['settings', 'gameMode', 'discovered', GAME_ID, 'path'], undefined);
  if (discoveryPath === undefined) {
    return Promise.resolve();
  }

  const relevantModTypes = ['', 'bepinex-root-mod'];
  const isConfManager = (mod: types.IMod) => {
    if (!relevantModTypes.includes(mod.type)) {
      return Promise.resolve(false);
    }

    const modPath = path.join(stagingFolder, mod.installationPath);
    return walkDirPath(modPath).then((entries) => {
      const confMan = entries.find(entry =>
        path.basename(entry.filePath.toLowerCase()) === CONF_MANAGER);
      return confMan !== undefined ? Promise.resolve(true) : Promise.resolve(false);
    })
    .catch(err => Promise.resolve(false));
  };

  const purge = () => {
    // Clean up before the madness
    return api.awaitUI()
      .then(() => {
        const modPaths = {
          '': path.join(discoveryPath, 'BepInEx', 'plugins'),
          'bepinex-root-mod': path.join(discoveryPath, 'BepInEx'),
        };
        return Promise.map(relevantModTypes, modType => {
          return fs.ensureDirWritableAsync(modPaths[modType])
            .then(() => api.emitAndAwait('purge-mods-in-path',
              GAME_ID, modType, modPaths[modType]));
      });
    })
    .then(() => api.store.dispatch(actions.setDeploymentNecessary(GAME_ID, true)));
  };

  const mods: { [modId: string]: types.IMod } =
    util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  return purge().then(() => Promise.reduce(Object.values(mods), (accum, iter) => {
    return (isConfManager(iter) as any)
      .then(res => {
        if (res) {
          api.store.dispatch(actions.setModType(GAME_ID, iter.id, 'val-conf-man'));
        }
        return Promise.resolve();
      });
  }));
}

export function migrate1013(api: types.IExtensionApi, oldVersion: string) {
  if (semver.gte(oldVersion, '1.0.13')) {
    return Promise.resolve();
  }

  const t = api.translate;
  const state = api.getState();
  const discoveryPath = util.getSafe(state,
    ['settings', 'gameMode', 'discovered', GAME_ID, 'path'], undefined);
  if (discoveryPath === undefined) {
    return Promise.resolve();
  }
  api.dismissNotification('val-103-conf-man-added');
  api.sendNotification({
    message: 'Ingame Mod Configuration Manager Removed',
    type: 'warning',
    allowSuppress: false,
    actions: [
      {
        title: 'More',
        action: (dismiss) => {
          api.showDialog('info', 'Ingame Mod Configuration Manager Removed',
          {
            bbcode: t('As you may be aware - Vortex used to have the BepInEx Configuration Manager '
              + 'plugin included in its BepInEx package. This plugin has now been removed from the package '
              + 'and is now offered as a toggleable mod on the mods page due to servers automatically kicking '
              + 'players with this plugin installed.'),
          },
          [ { label: 'Close', action: () => dismiss(), default: true } ]);
        },
      },
    ],
  });

  return api.awaitUI()
    .then(() => {
      const lastActive = selectors.lastActiveProfileForGame(state, GAME_ID);
      return payloadDeployer.onDidPurge(api, lastActive);
    });
}

export function migrate109(api: types.IExtensionApi, oldVersion: string) {
  if (semver.gte(oldVersion, '1.0.9')) {
    return Promise.resolve();
  }

  const state = api.getState();
  const discoveryPath = util.getSafe(state,
    ['settings', 'gameMode', 'discovered', GAME_ID, 'path'], undefined);
  if (discoveryPath === undefined) {
    return Promise.resolve();
  }

  const profiles: { [profileId: string]: types.IProfile } = util.getSafe(state, ['persistent', 'profiles'], {});
  const profileIds = Object.keys(profiles).filter(id => profiles[id].gameId === GAME_ID);
  if (profileIds.length === 0) {
    return Promise.resolve();
  }

  const mods: { [modId: string]: types.IMod } =
    util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const unstrippedMods = Object.keys(mods).filter(id => mods[id]?.type === 'unstripped-assemblies'
    && util.getSafe(state,
      ['persistent', 'mods', GAME_ID, id, 'attributes', 'modId'], undefined) === 15);
  if (unstrippedMods.length > 0) {
    return api.awaitUI()
      .then(() => {
        for (const profId of profileIds) {
          for (const modId of unstrippedMods) {
            api.store.dispatch(actions.setModEnabled(profId, modId, false));
          }
        }
        api.store.dispatch(actions.setDeploymentNecessary(GAME_ID, true));
      });
  }

  return Promise.resolve();
}

export function migrate106(api: types.IExtensionApi, oldVersion: string) {
  if (semver.gte(oldVersion, '1.0.6')) {
    return Promise.resolve();
  }

  const state = api.getState();
  const mods: { [modId: string]: types.IMod } =
    util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const worldMods = Object.keys(mods).filter(key => mods[key]?.type === 'better-continents-mod');
  if (worldMods.length > 0) {
    return api.awaitUI()
      .then(() => fs.ensureDirWritableAsync(WORLDS_PATH))
      // tslint:disable-next-line: max-line-length
      .then(() => api.emitAndAwait('purge-mods-in-path', GAME_ID, 'better-continents-mod', WORLDS_PATH));
  }

  return Promise.resolve();
}

export function migrate104(api: types.IExtensionApi, oldVersion: string) {
  if (semver.gte(oldVersion, '1.0.4')) {
    return Promise.resolve();
  }

  const state = api.getState();
  const mods: { [modId: string]: types.IMod } =
    util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const coreLibModId = Object.keys(mods).find(key =>
    util.getSafe(mods[key], ['attributes', 'IsCoreLibMod'], false));

  if (coreLibModId !== undefined) {
    api.store.dispatch(actions.setModAttribute(GAME_ID, coreLibModId, 'CoreLibType', 'core_lib'));
  }

  return Promise.resolve();
}

export function migrate103(api: types.IExtensionApi, oldVersion: string) {
  if (semver.gte(oldVersion, '1.0.3')) {
    return Promise.resolve();
  }

  const t = api.translate;

  api.sendNotification({
    message: 'Ingame Mod Configuration Manager added.',
    id: 'val-103-conf-man-added',
    type: 'info',
    allowSuppress: false,
    actions: [
      {
        title: 'More',
        action: (dismiss) => {
          api.showDialog('info', 'Ingame Mod Configuration Manager added',
          {
            bbcode: t('Some (but not all) Valheim mods come with configuration files allowing '
              + 'you to tweak mod specific settings. Once you\'ve installed one or several '
              + 'such mods, you can bring up the mod configuration manager ingame by pressing F1.'
              + '[br][/br][br][/br]'
              + 'Any settings you change ingame should be applied immediately and will be saved '
              + 'to the mods\' config files.'),
          },
          [ { label: 'Close', action: () => dismiss(), default: true } ]);
        },
      },
    ],
  });
}
