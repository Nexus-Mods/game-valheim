import Promise from 'bluebird';
import path from 'path';
import semver from 'semver';
import { actions, fs, log, selectors, types, util } from 'vortex-api';

import * as payloadDeployer from './payloadDeployer';

import { CONF_MANAGER, GAME_ID, walkDirPath } from './common';

const WORLDS_PATH = path.resolve(util.getVortexPath('appData'),'..', 'LocalLow', 'IronGate', 'Valheim', 'vortex-worlds');
export function migrate110(api: types.IExtensionApi, oldVersion: string): Promise<void> {
  // if (semver.gte(oldVersion, '1.1.0')) {
  //   return Promise.resolve();
  // }
  // const t = api.translate;
  // api.sendNotification({
  //   id: 'valheim-update-1.1.0',
  //   type: 'info',
  //   message: 'Important Valheim Update Information',
  //   actions: [
  //     { title: 'More', action: (dismiss) => {
  //       api.showDialog('info', 'Valheim Update 1.1.0', {
  //         bbcode: t('Aside from updating the BepInEx payload to 5.4.22.[br][/br][br][/br]'
  //                 + 'This update adds a new button to the mods page "Update BepInEx" which allows '
  //                 + 'users to change the BepInEx version used by Vortex.[br][/br][br][/br]'
  //                 + 'Available versions are pulled directly from the BepInEx github repository, '
  //                 + 'and will maintain any existing configuration files in your game directory.[br][/br][br][/br]'
  //                 + 'If for any reason the BepInEx payload deployed by Vortex is not ideal for your mod setup, and you '
  //                 + 'require a custom version, the payload can be replaced manually using the "Open BepInEx Payload Folder" button '
  //                 + 'which will open the location of the payload itself in your file browser. Any changes there will be reflected in '
  //                 + 'your game directory upon deployment.'),
  //       }, [ { label: 'Close', action: () => dismiss(), default: true } ]);
  //     }}
  //   ],
  // });

  return Promise.resolve();
}

export function migrate1015(api: types.IExtensionApi, oldVersion: string): Promise<void> {
  return Promise.resolve();
}

export function migrate1013(api: types.IExtensionApi, oldVersion: string): Promise<void> {
  return Promise.resolve();
}

export function migrate109(api: types.IExtensionApi, oldVersion: string) {
  return Promise.resolve();
}

export function migrate106(api: types.IExtensionApi, oldVersion: string) {
  return Promise.resolve();
}

export function migrate104(api: types.IExtensionApi, oldVersion: string) {
  return Promise.resolve();
}

export function migrate103(api: types.IExtensionApi, oldVersion: string) {
  return Promise.resolve();
}
