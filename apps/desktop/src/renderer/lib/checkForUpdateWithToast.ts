import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import { toast } from '@/lib/toast';

type Translate = (key: string) => string;

export async function checkForUpdateWithToast(t: Translate): Promise<void> {
  // Countersign has no update service: there is nothing to check, and no handler to call.
  if (LOCAL_ONLY) {
    toast.warning(t('titleBar.updateCheckToast.manifestFailed'));
    return;
  }
  let result: Awaited<ReturnType<typeof window.electronAPI.checkForUpdate>>['result'];
  try {
    ({ result } = await window.electronAPI.checkForUpdate());
  } catch {
    toast.error(t('titleBar.updateCheckToast.manifestFailed'));
    return;
  }
  switch (result) {
    case 'idle':
      toast.success(t('titleBar.updateCheckToast.alreadyLatest'));
      break;
    case 'downloading':
      toast.warning(t('titleBar.updateCheckToast.downloading'));
      break;
    case 'ready':
      toast.success(t('titleBar.updateCheckToast.ready'));
      break;
    case 'manifest_failed':
      toast.error(t('titleBar.updateCheckToast.manifestFailed'));
      break;
    case 'download_failed':
      toast.error(t('titleBar.updateCheckToast.downloadFailed'));
      break;
    case 'manual_download':
      toast.warning(t('titleBar.updateCheckToast.manualDownload'));
      break;
  }
}
