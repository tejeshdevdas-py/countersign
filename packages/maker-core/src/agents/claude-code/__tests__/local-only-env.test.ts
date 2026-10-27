import { afterEach, describe, expect, it } from 'vitest';

import type { AuthAdapter } from '../../../interfaces/auth-adapter.js';
import { CLAUDE_LOCAL_ONLY_ENV } from '../../shared/local-only-engine-config.js';
import { buildClaudeEnv } from '../env-builder.js';

function authWith(env: Record<string, string>): AuthAdapter {
  return {
    async getState() {
      return { authenticated: true };
    },
    async triggerLogin() {
      return { authenticated: true };
    },
    async logout() {},
    async getAuthEnv() {
      return env;
    },
  };
}

const EXPECTED_SWITCHES = {
  CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
  DISABLE_TELEMETRY: '1',
  DO_NOT_TRACK: '1',
  DISABLE_ERROR_REPORTING: '1',
  DISABLE_GROWTHBOOK: '1',
  DISABLE_AUTOUPDATER: '1',
  CLAUDE_CODE_DISABLE_OFFICIAL_MARKETPLACE_AUTOINSTALL: '1',
  OTEL_SDK_DISABLED: 'true',
};

describe('Countersign LOCAL_ONLY Claude Code env', () => {
  const saved = { ...process.env };

  afterEach(() => {
    for (const key of Object.keys(EXPECTED_SWITCHES)) {
      if (saved[key] === undefined) delete process.env[key];
      else process.env[key] = saved[key];
    }
  });

  it('lists exactly the switches read from the bundled CLI', () => {
    expect(CLAUDE_LOCAL_ONLY_ENV).toEqual(EXPECTED_SWITCHES);
  });

  it.each(['local', 'remote'] as const)('carries every switch in %s mode', async (mode) => {
    const env = await buildClaudeEnv(authWith({}), {}, { mode });

    expect(env).toMatchObject(EXPECTED_SWITCHES);
  });

  it('wins over values inherited from the user shell', async () => {
    process.env.DISABLE_TELEMETRY = '0';
    process.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC = '';
    process.env.OTEL_SDK_DISABLED = 'false';

    const env = await buildClaudeEnv(authWith({}), {});

    expect(env).toMatchObject(EXPECTED_SWITCHES);
  });

  it("keeps the user's own Claude login: native CLI auth is untouched", async () => {
    const env = await buildClaudeEnv(
      authWith({ CLAUDE_CONFIG_DIR: 'C:\\Users\\me\\.claude' }),
      { endpoint: 'http://127.0.0.1:9' },
      { nativeCliAuth: true },
    );

    expect(env).toMatchObject(EXPECTED_SWITCHES);
    expect(env.ANTHROPIC_BASE_URL).toBeUndefined();
    expect(env.CLAUDE_CODE_PROVIDER_MANAGED_BY_HOST).toBeUndefined();
    expect(env.ANTHROPIC_API_KEY).toBeUndefined();
    expect(env.CLAUDE_CODE_OAUTH_TOKEN).toBeUndefined();
  });

  it('still passes host credentials for gateway sessions', async () => {
    const env = await buildClaudeEnv(authWith({ ANTHROPIC_API_KEY: 'test-key' }), {
      endpoint: 'http://127.0.0.1:9',
    });

    expect(env.ANTHROPIC_API_KEY).toBe('test-key');
    expect(env.ANTHROPIC_BASE_URL).toBe('http://127.0.0.1:9');
    expect(env).toMatchObject(EXPECTED_SWITCHES);
  });
});

describe('Countersign LOCAL_ONLY: settings cannot re-enable a forced switch', () => {
  it('a host behaviour flag or auth env from settings does not win', async () => {
    const env = await buildClaudeEnv(
      authWith({ DISABLE_AUTOUPDATER: '0', CLAUDE_CODE_ENABLE_TELEMETRY: '1' }),
      {
        behaviorFlags: {
          DISABLE_TELEMETRY: '0',
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '',
          CLAUDE_CODE_ENABLE_TELEMETRY: '1',
          ENABLE_ENHANCED_TELEMETRY_BETA: '1',
        },
      },
    );

    expect(env).toMatchObject(EXPECTED_SWITCHES);
    expect(env.CLAUDE_CODE_ENABLE_TELEMETRY).toBeUndefined();
    expect(env.ENABLE_ENHANCED_TELEMETRY_BETA).toBeUndefined();
  });
});
