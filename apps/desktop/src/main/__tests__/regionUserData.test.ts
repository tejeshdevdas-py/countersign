import { describe, expect, it } from 'vitest';
import { resolveRegionUserDataDirName } from '../regionUserData';

/**
 * Countersign has one user-data identity: cn and global both use the productName
 * default `Countersign` (so no override is needed) and dev uses `CountersignDev`.
 * This module runs at the very start of main, so every region/packaging quadrant
 * is pinned here.
 */
describe('resolveRegionUserDataDirName', () => {
  const ARGV = ['Countersign.exe'] as const;

  it('packaged + global → null(Countersign 单一身份:与 cn 同为 productName 默认)', () => {
    expect(
      resolveRegionUserDataDirName({ isPackaged: true, region: 'global', argv: ARGV }),
    ).toBeNull();
  });

  it('packaged + cn → null(区域目录名 = productName 默认,保持原生行为)', () => {
    expect(
      resolveRegionUserDataDirName({ isPackaged: true, region: 'cn', argv: ARGV }),
    ).toBeNull();
  });

  it('dev(非 packaged)按区域选择正式 profile，隔离沙箱再基于它派生', () => {
    expect(
      resolveRegionUserDataDirName({ isPackaged: false, region: 'cn', argv: ARGV }),
    ).toBeNull();
    expect(
      resolveRegionUserDataDirName({ isPackaged: false, region: 'global', argv: ARGV }),
    ).toBeNull();
    expect(
      resolveRegionUserDataDirName({ isPackaged: false, region: 'dev', argv: ARGV }),
    ).toBe('CountersignDev');
  });

  it('显式 Chromium --user-data-dir 时不覆写,尊重调用方', () => {
    expect(
      resolveRegionUserDataDirName({
        isPackaged: true,
        region: 'global',
        argv: ['Countersign.exe', '--smoke-test', '--user-data-dir=C:\\tmp\\xdt-smoke-x'],
      }),
    ).toBeNull();
    expect(
      resolveRegionUserDataDirName({
        isPackaged: true,
        region: 'global',
        argv: ['Countersign.exe', '--user-data-dir', 'C:\\tmp\\xdt-smoke-x'],
      }),
    ).toBeNull();
  });

  it('XDT_USER_DATA_DIR 仍保留区域默认 profile 作为隔离 epoch 基线', () => {
    expect(
      resolveRegionUserDataDirName({
        isPackaged: false,
        region: 'global',
        argv: ARGV,
        envUserDataDir: '/tmp/custom-profile',
      }),
    ).toBeNull();
  });
});
