import { app, remote } from 'electron';
import path from 'path';
import turbowalk, { IEntry } from 'turbowalk';
import { fs, selectors, types, util } from 'vortex-api';
import { DOORSTOPPER_HOOK, GAME_ID, IGNORABLE_FILES } from './common';

const invalidModFolders = ['denikson-bepinexpack_valheim', '1f31a-bepinex_valheim_full'];
const appUni = remote !== undefined ? remote.app : app;

interface IR2ModFile {
  relPath: string;
  basePath: string;
}

// TODO: resolve the location of the cache rather than searching for it in the
//  default location.
function getR2CacheLocation() {
  return path.join(appUni.getPath('appData'), 'r2modmanPlus-local', 'Valheim', 'cache');
}

export function userHasR2Installed() {
  try {
    fs.statSync(getR2CacheLocation());
    return true;
  } catch (err) {
    return false;
  }
}

export async function migrateR2ToVortex(api: types.IExtensionApi) {
  const start = async () => {
    const activityId = 'r2migrationactivity';
    api.sendNotification({
      id: activityId,
      type: 'activity',
      message: 'Migrating Mods',
      allowSuppress: false,
      noDismiss: true,
    });

    try {
      await startMigration(api);
      api.sendNotification({
        type: 'success',
        message: 'Mods migrated successfully',
        displayMS: 3000,
      });
    } catch (err) {
      api.showErrorNotification('Failed to migrate mods from R2 Mod Manager', err);
    }

    api.dismissNotification(activityId);
  };

  api.showDialog('info', 'r2modman Mods Migration',
  {
    bbcode: 'Vortex can import your mods installed with r2modman and allow you to manage them '
      + 'from inside Vortex. Please be aware that the mods will be imported in an '
      + 'uninstalled state and will have to be installed, enabled and deployed through '
      + 'Vortex before the mods are re-instated into the game.[br][/br][br][/br]'
      + 'Please note: [br][/br][br][/br][list]'
      + '[*]Mod configuration changes will not be imported - these need to be '
      + 're-added or imported manually from your preferred r2modman profile.'
      + '[*]Vortex will import ALL versions of the mods you have in your r2modman cache, even '
      + 'the outdated ones - it\'s up to you to look through the imported mods and install '
      + 'the ones you want active in-game.'
      + '[*]r2modman stores recently uninstalled mods in its cache meaning that Vortex might '
      + 'import mods you recently uninstalled in r2modman. You can simply choose to not '
      + 'install or remove them entirely after importing. '
      + '[/list][br][/br]It is still highly recommended to use a fresh vanilla copy of the game when '
      + 'starting to mod with Vortex.',
  }, [
    { label: 'Cancel', action: () => Promise.resolve() },
    { label: 'Start Migration', action: () => start() },
  ]);
}

async function startMigration(api: types.IExtensionApi) {
  const hasInvalidSeg = (segment: string) =>
    [DOORSTOPPER_HOOK].concat(invalidModFolders, IGNORABLE_FILES).includes(segment.toLowerCase());

  const state = api.getState();
  const discovery: types.IDiscoveryResult = selectors.discoveryByGame(state, GAME_ID);
  if (discovery?.path === undefined) {
    // Should never be possible.
    return;
  }

  const r2Path = getR2CacheLocation();
  let fileEntries: IEntry[] = [];
  await turbowalk(r2Path, entries => {
    const filtered = entries.filter(entry => {
      if (entry.isDirectory) {
        return false;
      }
      const segments = entry.filePath.split(path.sep);
      const isInvalid = segments.find(hasInvalidSeg) !== undefined;
      if (isInvalid) {
        return false;
      }
      return true;
    });
    fileEntries = fileEntries.concat(filtered);
  })
  .catch(err => ['ENOENT', 'ENOTFOUND'].includes(err.code)
    ? Promise.resolve() : Promise.reject(err));

  const verRgx = new RegExp(/^\d\.\d\.\d{1,4}$/);
  // tslint:disable-next-line: max-line-length
  const arcMap: { [arcName: string]: IR2ModFile[] } = fileEntries.reduce((accum, iter) => {
    const segments = iter.filePath.split(path.sep);
    const idx = segments.findIndex(seg => verRgx.test(seg));
    if (idx === -1) {
      // This is an invalid file entry, at least as far as the R2 cache file
      // structure was in 02/03/2021;
      return accum;
    }
    const modKey = segments.slice(idx - 1, idx + 1).join('_');
    if (accum[modKey] === undefined) {
      accum[modKey] = [];
    }
    const basePath = segments.slice(0, idx + 1).join(path.sep);
    const relPath = path.relative(basePath, iter.filePath);
    const pathExists = (accum[modKey].find(r2file =>
      r2file.relPath.split(path.sep)[0] === relPath.split(path.sep)[0]) !== undefined);
    if (!pathExists) {
      accum[modKey].push({ relPath, basePath });
    }
    return accum;
  }, {});

  const downloadsPath = selectors.downloadPathForGame(state, GAME_ID);
  const szip = new util.SevenZip();
  for (const modKey of Object.keys(arcMap)) {
    const archivePath = path.join(downloadsPath, modKey + '.zip');
    await szip.add(archivePath, arcMap[modKey]
      .map(r2ModFile => path.join(r2ModFile.basePath,
        r2ModFile.relPath.split(path.sep)[0])), { raw: ['-r'] });
  }
}
