// @vitest-environment jsdom

// Countersign: under the real LOCAL_ONLY the mail preview shows initials or the
// mail plugin's own contact photo, and never asks Gravatar (an email hash) or
// DuckDuckGo's icon service (the sender's domain) for an avatar.

import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LOCAL_ONLY } from '@cindy/maker-shared/local-only';
import type { MailMessage } from '@cindy/maker-shared/mail-message';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'en' } }),
}));
vi.mock('@/components/chat/GhostCardForm', () => ({ GhostCardForm: () => null }));

import { MailConversationView } from './MailConversationView';

const PLUGIN_PHOTO = 'https://contacts.plugin.example/person.png';

function message(overrides: Partial<MailMessage> = {}): MailMessage {
  return {
    accountId: 'account',
    messageId: 'm2',
    from: 'Person <person@company.example.com>',
    to: 'Other <other@partner.example.org>, Third <third@gmail.com>',
    cc: 'Copy <copy@company.example.com>',
    bcc: '',
    subject: 'Subject',
    date: '',
    bodyText: 'Body',
    bodyHtml: '',
    attachments: [],
    conversation: {
      threadId: 'thread',
      messages: [
        {
          messageId: 'm1',
          url: 'https://mail.example/m1',
          from: 'Earlier <earlier@vendor.example.net>',
          date: '',
          subject: '',
          snippet: 'earlier',
        },
        {
          messageId: 'm2',
          url: 'https://mail.example/m2',
          from: 'Person <person@company.example.com>',
          date: '',
          subject: '',
          snippet: 'body',
        },
      ],
    },
    ...overrides,
  } as MailMessage;
}

function renderConversation(mail: MailMessage) {
  const read = vi.fn(async () => ({ message: null }));
  return render(
    <MailConversationView mail={mail} openMailbox={null} read={read} retry={() => {}} />,
  );
}

function imageSources(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll('img'), (image) => image.getAttribute('src') ?? '');
}

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('mail participant avatars under LOCAL_ONLY', () => {
  it('shows initials and makes no avatar request when no photo is given', async () => {
    expect(LOCAL_ONLY).toBe(true);
    const digest = vi.fn(async () => new ArrayBuffer(32));
    vi.stubGlobal('crypto', { subtle: { digest } });

    const view = renderConversation(message());
    await act(async () => {});

    expect(screen.getByText('Other <other@partner.example.org>')).toBeTruthy();
    expect(imageSources(view.container).filter((src) => /^https?:/i.test(src))).toEqual([]);
    expect(digest).not.toHaveBeenCalled();
    expect(screen.getAllByText('P').length).toBeGreaterThan(0);
  });

  it("keeps the plugin's photo and falls back to initials, not to a public service", async () => {
    const digest = vi.fn(async () => new ArrayBuffer(32));
    vi.stubGlobal('crypto', { subtle: { digest } });

    const view = renderConversation(
      message({ participantPhotos: [{ email: 'person@company.example.com', url: PLUGIN_PHOTO }] }),
    );
    await act(async () => {});

    expect(new Set(imageSources(view.container))).toEqual(new Set([PLUGIN_PHOTO]));
    await act(async () => {
      view.container.querySelectorAll('img').forEach((image) => fireEvent.error(image));
    });
    expect(imageSources(view.container)).toEqual([]);
    expect(digest).not.toHaveBeenCalled();
  });
});
