import Promise from 'bluebird';
import semver from 'semver';
import { types } from 'vortex-api';

export function migrate102(api: types.IExtensionApi, oldVersion: string) {
  if (semver.gte(oldVersion, '1.0.2')) {
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
