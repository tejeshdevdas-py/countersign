/**
 * Countersign: Pi ships with the app and Pi core updates are off under
 * LOCAL_ONLY. A command that would update the core (alone or with the
 * extensions, as `pi update --all` does) is refused when it is parsed, before
 * any step runs, with one message. LOCAL_ONLY is the real value here (true in
 * this build).
 */
import { describe, expect, it } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';

import {
  PI_CORE_UPDATE_LOCAL_ONLY_MESSAGE,
  parsePiManagementArgs,
  parsePiManagementText,
} from '../managed-command.js';

describe('Pi management grammar under LOCAL_ONLY', () => {
  it('runs with LOCAL_ONLY on', () => {
    expect(LOCAL_ONLY).toBe(true);
  });

  it.each([
    'pi update',
    '/pi update --self',
    'pi update self',
    'pi update pi',
    'pi update --force',
    'pi update --self --force',
    'pi update --all',
    'pi update --all --force',
    'pi update --self --extensions',
    'pi update --extensions --self --force',
  ])('refuses %s with one message, before any step', (text) => {
    expect(parsePiManagementText(text)).toEqual({ error: PI_CORE_UPDATE_LOCAL_ONLY_MESSAGE });
  });

  it('refuses the tool form of the same commands', () => {
    expect(parsePiManagementArgs(['update', '--all'])).toEqual({
      error: PI_CORE_UPDATE_LOCAL_ONLY_MESSAGE,
    });
    expect(parsePiManagementArgs(['update', '--self'])).toEqual({
      error: PI_CORE_UPDATE_LOCAL_ONLY_MESSAGE,
    });
  });

  it('says what is off and what still works, without naming a host', () => {
    expect(PI_CORE_UPDATE_LOCAL_ONLY_MESSAGE).toMatch(/Pi core updates are off/);
    expect(PI_CORE_UPDATE_LOCAL_ONLY_MESSAGE).toMatch(/pi update --extensions/);
    expect(PI_CORE_UPDATE_LOCAL_ONLY_MESSAGE).not.toMatch(/github|cindy/i);
  });

  it.each([
    ['pi update --extensions', { action: 'command', command: { kind: 'extensions' } }],
    ['pi update npm:test', { action: 'update', source: 'npm:test' }],
    ['pi install npm:test', { action: 'install', source: 'npm:test' }],
    ['pi remove npm:test', { action: 'remove', source: 'npm:test' }],
    ['pi list', { action: 'command', command: { kind: 'list' } }],
    ['pi --version', { action: 'command', command: { kind: 'version' } }],
    ['pi update --help', { action: 'command', command: { kind: 'help', topic: 'update' } }],
  ])('still parses %s', (text, expected) => {
    expect(parsePiManagementText(text)).toEqual(expected);
  });
});
