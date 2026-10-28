import { isServiceDisabled } from './services';

/**
 * Countersign: the app updater is off (isServiceDisabled('updater')); Countersign
 * is rebuilt from source instead. The cindy_helper tools check_app_update,
 * install_app_update and set_app_auto_update and the runtime catalog's note
 * about them describe that updater, so while it is off the model is not told
 * about them.
 */

/** The cindy_helper deps that register the app update tools; none while the updater is off. */
export function appUpdateToolDeps<Callbacks>(create: () => Callbacks): { appUpdate?: Callbacks } {
  if (isServiceDisabled('updater')) {
    return {};
  }
  return { appUpdate: create() };
}

/** The runtime catalog note: the updater sentence only while the updater runs. */
export function hostCapabilitiesNote(general: string, updaterSentence: string): string {
  if (isServiceDisabled('updater')) {
    return general;
  }
  return `${general}${updaterSentence}`;
}
