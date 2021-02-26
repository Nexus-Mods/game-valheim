import turbowalk, { IEntry } from 'turbowalk';
import { log, selectors, types, util } from 'vortex-api';

export const GAME_ID = 'valheim';
export const STEAM_ID = '892970';

export const VBUILD_EXT = '.vbuild';
export const INSLIMVML_IDENTIFIER = 'inslimvml.ini';
export const DOORSTOPPER_HOOK = 'winhttp.dll';

// These are files which are crucial to Valheim's modding pattern and it appears
//  that many mods on Vortex are currently distributing these as part of their mod.
//  Needless to say, we don't want these deployed or reporting any conflicts as
//  Vortex is already distributing them.
export const IGNORABLE_FILES = [
  'manifest.json', 'BepInEx.cfg', '0Harmony.dll', 'doorstop_config.ini',
  '0Harmony.xml', '0Harmony20.dll', 'BepInEx.dll', 'BepInEx.Harmony.dll', 'BepInEx.Harmony.xml',
  'BepInEx.Preloader.dll', 'BepInEx.Preloader.xml', 'BepInEx.xml', 'HarmonyXInterop.dll',
  'Mono.Cecil.dll', 'Mono.Cecil.Mdb.dll', 'Mono.Cecil.Pdb.dll', 'Mono.Cecil.Rocks.dll',
  'MonoMod.RuntimeDetour.dll', 'MonoMod.RuntimeDetour.xml', 'MonoMod.Utils.dll',
  'MonoMod.Utils.xml',
];

export interface IProps {
  state: types.IState;
  profile: types.IProfile;
  discovery: types.IDiscoveryResult;
}

export async function walkDirPath(dirPath: string): Promise<IEntry[]> {
  let fileEntries: IEntry[] = [];
  await turbowalk(dirPath, (entries: IEntry[]) => {
    fileEntries = fileEntries.concat(entries);
  })
  .catch({ systemCode: 3 }, () => Promise.resolve())
  .catch(err => ['ENOTFOUND', 'ENOENT'].includes(err.code)
    ? Promise.resolve() : Promise.reject(err));

  return fileEntries;
}

export function isInSlimVMLInstalled(api: types.IExtensionApi) {
  const state = api.getState();
  const mods: { [modId: string]: types.IMod } =
    util.getSafe(state, ['persistent', 'mods', GAME_ID], {});
  const profileId = selectors.lastActiveProfileForGame(state, GAME_ID);
  const profile = selectors.profileById(state, profileId);
  const enabledMods = Object.keys(mods)
    .filter(key => util.getSafe(profile, ['modState', key, 'enabled'], false));
  return enabledMods.find(key => mods[key]?.type === 'inslimvml-mod-loader') !== undefined;
}

export function genProps(context: types.IExtensionContext, profileId?: string): IProps {
  const state = context.api.getState();
  profileId = profileId !== undefined
    ? profileId
    : selectors.lastActiveProfileForGame(state, GAME_ID);
  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId !== GAME_ID) {
    log('debug', 'Invalid profile', { profile });
    return undefined;
  }
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  if (discovery?.path === undefined) {
    log('debug', 'Game is not discovered', { profile, discovery });
    return undefined;
  }
  return { state, profile, discovery };
}
