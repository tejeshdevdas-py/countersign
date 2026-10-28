import fs from 'node:fs';
import path from 'node:path';
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { brandHomeStateName } from '@cindy/maker-shared/brand-identity';

// M-C1: a new SSH key is named after BRAND_IDENTITY (~/.ssh/countersign), not an
// installed Cindy's default ~/.ssh/cindy. ssh-keys.ts reads the home folder at load.
const state = vi.hoisted(() => ({ home: '' }));
const execFileMock = vi.hoisted(() => vi.fn());

vi.mock('node:os', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:os')>();
  const nodeFs = await import('node:fs');
  const nodePath = await import('node:path');
  state.home = nodeFs.mkdtempSync(nodePath.join(actual.tmpdir(), 'countersign-ssh-keys-'));
  return {
    ...actual,
    default: { ...actual, homedir: () => state.home },
    homedir: () => state.home,
  };
});

vi.mock('node:child_process', () => ({ execFile: execFileMock }));

import { generateNewKey } from '../ssh-keys.js';

type Callback = (error: Error | null, value?: { stdout: string; stderr: string }) => void;

beforeEach(() => {
  execFileMock
    .mockReset()
    .mockImplementation((_command: string, args: string[], callback: Callback) => {
      if (args.includes('-t')) {
        const keyPath = args[args.indexOf('-f') + 1]!;
        fs.writeFileSync(keyPath, 'private-key-placeholder');
        fs.writeFileSync(`${keyPath}.pub`, 'public-key-placeholder\n');
        callback(null, { stdout: '', stderr: '' });
        return;
      }
      callback(null, { stdout: '256 SHA256:placeholder comment (ED25519)\n', stderr: '' });
    });
});

afterAll(() => {
  fs.rmSync(state.home, { recursive: true, force: true });
});

describe('generateNewKey default name', () => {
  it('names the key and its comment after BRAND_IDENTITY, never cindy', async () => {
    const name = brandHomeStateName();
    const result = await generateNewKey({});

    expect(path.dirname(result.privateKeyPath)).toBe(path.join(state.home, '.ssh'));
    expect(path.basename(result.privateKeyPath)).toMatch(new RegExp(`^${name}(-\\d+)?$`));
    const keygen = execFileMock.mock.calls.find(([, args]) => (args as string[]).includes('-t'))!;
    const args = keygen[1] as string[];
    expect(args[args.indexOf('-C') + 1]).toMatch(new RegExp(`^${name}@`));
    expect(path.basename(result.privateKeyPath)).not.toMatch(/cindy/i);
    expect(args[args.indexOf('-C') + 1]).not.toMatch(/cindy/i);
  });

  it('falls back to the brand name when the given name has no safe characters', async () => {
    const result = await generateNewKey({ name: '***' });

    expect(path.basename(result.privateKeyPath)).toMatch(
      new RegExp(`^${brandHomeStateName()}(-\\d+)?$`),
    );
  });
});
