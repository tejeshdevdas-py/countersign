import { describe, expect, it } from 'vitest';
import {
  composerNodesForBoundedPlainTextPaste,
  composerNodesForPlainTextPaste,
} from '@/session/composerPaste';
import { MAX_PASTED_TEXT_CHARS } from '@/session/composerRichInputProtocol';
import { serializeComposerDocument } from '@/session/composerDocument';
import { BRAND_IDENTITY } from '@cindy/maker-shared/brand-identity';

// Countersign: links follow BRAND_IDENTITY.primaryScheme (no legacy schemes).
const SCHEME = BRAND_IDENTITY.primaryScheme;

describe('mobile composer plain-text paste pipeline', () => {
  it('folds a long paste before inspecting links inside it', () => {
    const text = Array.from(
      { length: 24 },
      (_, index) => `line ${index + 1} ${SCHEME}://session/session-${index}`,
    ).join('\n');

    expect(composerNodesForPlainTextPaste(text)).toEqual([{
      type: 'pasted-text',
      text,
      display: 'Pasted text (24 lines)',
    }]);
  });

  it('turns bare session links, with and without a message anchor, into inline atoms', () => {
    const nodes = composerNodesForPlainTextPaste(
      `before ${SCHEME}://session/session-one and ${SCHEME}://session/session-two?message=message-2.`,
    );

    expect(nodes).toEqual([
      { type: 'text', text: 'before ' },
      {
        type: 'session-link',
        href: `${SCHEME}://session/session-one`,
        label: 'session-one',
        titled: false,
      },
      { type: 'text', text: ' and ' },
      {
        type: 'session-link',
        href: `${SCHEME}://session/session-two?message=message-2`,
        label: 'message-2',
        messageClientId: 'message-2',
        titled: false,
      },
      { type: 'text', text: '.' },
    ]);
  });

  it('uses markdown labels for sessions but always resolves message anchors from their body', () => {
    const nodes = composerNodesForPlainTextPaste(
      `[[WIP] 会话](${SCHEME}://session/session-one) [wrong title](${SCHEME}://session/session-two?message=message-2)`,
    );

    expect(nodes).toEqual([
      {
        type: 'session-link',
        href: `${SCHEME}://session/session-one`,
        label: 'WIP 会话',
        titled: true,
      },
      { type: 'text', text: ' ' },
      {
        type: 'session-link',
        href: `${SCHEME}://session/session-two?message=message-2`,
        label: 'message-2',
        messageClientId: 'message-2',
        titled: false,
      },
    ]);
  });

  it('turns project deep links into project atoms with desktop-compatible wire text', () => {
    const text = [
      `[Mobile App](${SCHEME}://project/%2FUsers%2Fdash%2FCode%2FMobile)`,
      ' then ',
      `${SCHEME}://project/C%3A%5CCode%5CDesktop`,
    ].join('');
    const nodes = composerNodesForPlainTextPaste(text);

    expect(nodes).toEqual([
      {
        type: 'mention',
        kind: 'project',
        label: 'Mobile App',
        raw: `[Mobile App](${SCHEME}://project/%2FUsers%2Fdash%2FCode%2FMobile)`,
        href: `${SCHEME}://project/%2FUsers%2Fdash%2FCode%2FMobile`,
        workingDir: '/Users/dash/Code/Mobile',
      },
      { type: 'text', text: ' then ' },
      {
        type: 'mention',
        kind: 'project',
        label: 'Desktop',
        raw: `${SCHEME}://project/C%3A%5CCode%5CDesktop`,
        href: `${SCHEME}://project/C%3A%5CCode%5CDesktop`,
        workingDir: 'C:\\Code\\Desktop',
      },
    ]);
    expect(serializeComposerDocument({ version: 1, nodes }).text).toBe(text);
  });

  it('keeps ordinary text as one editable text node', () => {
    expect(composerNodesForPlainTextPaste('ordinary paste')).toEqual([
      { type: 'text', text: 'ordinary paste' },
    ]);
  });

  it('rejects an oversized native clipboard fallback before constructing nodes', () => {
    expect(
      composerNodesForBoundedPlainTextPaste('x'.repeat(MAX_PASTED_TEXT_CHARS + 1)),
    ).toBeNull();
  });
});
