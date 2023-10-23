import turbowalk, { IEntry } from 'turbowalk';
import { fs, log, selectors, types, util } from 'vortex-api';

export declare type PackType = 'none' | 'core_lib' | 'unstripped_corlib';
export const GAME_ID = 'valheim';
export const GAME_ID_SERVER = 'valheimserver';
export const isValheimGame = (gameId: string) => [GAME_ID_SERVER, GAME_ID].includes(gameId);

export const STEAM_ID = '892970';

export const BETTER_CONT_EXT = '.bettercontinents';
export const VBUILD_EXT = '.vbuild';
export const FBX_EXT = '.fbx';
export const OBJ_EXT = '.obj';
export const INSLIMVML_IDENTIFIER = 'inslimvml.ini';
export const DOORSTOPPER_HOOK = 'winhttp.dll';
export const BIX_SVML = 'slimvml.loader.dll';
export const CONF_MANAGER = 'configurationmanager.dll';
export const ISVML_SKIP = [BIX_SVML, 'slimassist.dll', '0harmony.dll'];

export const NEXUS = 'www.nexusmods.com';

export const NAMESPACE = 'game-valheim';

// These are files which are crucial to Valheim's modding pattern and it appears
//  that many mods on Vortex are currently distributing these as part of their mod.
//  Needless to say, we don't want these deployed or reporting any conflicts as
//  Vortex is already distributing them.
export const IGNORABLE_FILES = [
  'LICENSE', 'manifest.json', 'BepInEx.cfg', '0Harmony.dll', 'doorstop_config.ini', 'icon.png', 'README.md',
  '0Harmony.xml', '0Harmony20.dll', 'BepInEx.dll', 'BepInEx.Harmony.dll', 'BepInEx.Harmony.xml',
  'BepInEx.Preloader.dll', 'BepInEx.Preloader.xml', 'BepInEx.xml', 'HarmonyXInterop.dll',
  'Mono.Cecil.dll', 'Mono.Cecil.Mdb.dll', 'Mono.Cecil.Pdb.dll', 'Mono.Cecil.Rocks.dll',
  'MonoMod.RuntimeDetour.dll', 'MonoMod.RuntimeDetour.xml', 'MonoMod.Utils.dll',
  'MonoMod.Utils.xml',
];

export interface IProps {
  api: types.IExtensionApi;
  state: types.IState;
  profile: types.IProfile;
  discovery: types.IDiscoveryResult;
}

export interface IArgument {
  argument: string;
  value?: string;
}

export interface ISCMDProps {
  gameId: string;
  steamAppId: number;
  callback?: (err: Error, data: any) => void;
  arguments: IArgument[];
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

export function genProps(api: types.IExtensionApi, profileId?: string): IProps {
  const state = api.getState();
  profileId = profileId !== undefined
    ? profileId
    : selectors.lastActiveProfileForGame(state, GAME_ID);
  const profile = selectors.profileById(state, profileId);
  if (profile?.gameId !== GAME_ID) {
    // This is too spammy.
    // log('debug', 'Invalid profile', { profile });
    return undefined;
  }
  const discovery = util.getSafe(state, ['settings', 'gameMode', 'discovered', GAME_ID], undefined);
  if (discovery?.path === undefined) {
    // log('debug', 'Game is not discovered', { profile, discovery });
    return undefined;
  }
  return { api, state, profile, discovery };
}

export function genInstructions(srcPath: string,
                                destPath: string,
                                entries: IEntry[]): types.IInstruction[] {
  return entries.filter(entry => !entry.isDirectory)
    .reduce((accum, iter) => {
      const destination: string = iter.filePath.replace(srcPath, destPath);
      accum.push({
        type: 'copy',
        source: iter.filePath,
        destination,
      });
      return accum;
    }, []);
}

export function guessModId(fileName: string): string {
  const match = fileName.match(/-([0-9]+)-/);
  if (match !== null) {
    return match[1];
  } else {
    return undefined;
  }
}

export async function removeDir(filePath: string, filterEntries?: (entry: IEntry) => boolean) {
  let filePaths = await walkDirPath(filePath);
  filePaths = !filterEntries ? filePaths : filePaths.filter(filterEntries);
  filePaths.sort((lhs, rhs) => rhs.filePath.length - lhs.filePath.length);
  for (const entry of filePaths) {
    try {
      await fs.removeAsync(entry.filePath);
    } catch (err) {
      log('debug', 'failed to remove file', err);
    }
  }
}

export function purge(api: types.IExtensionApi) {
  return new Promise<void>((resolve, reject) =>
    api.events.emit('purge-mods', true, (err) => err ? reject(err) : resolve()));
}

export function deploy(api: types.IExtensionApi) {
  return new Promise<void>((resolve, reject) =>
    api.events.emit('deploy-mods', (err) => err ? reject(err) : resolve()));
}