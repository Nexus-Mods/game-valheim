import Promise from 'bluebird';
import { app as appIn, remote } from 'electron';
import path from 'path';
import semver from 'semver';
import { actions, fs, types, util } from 'vortex-api';

import { GAME_ID } from './common';

const appuni = appIn || remote.app;
const WORLDS_PATH = path.resolve(appuni.getPath('appData'),
  '..', 'LocalLow', 'IronGate', 'Valheim', 'vortex-worlds');

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
