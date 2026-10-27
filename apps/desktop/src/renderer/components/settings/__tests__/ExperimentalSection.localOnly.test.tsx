// @vitest-environment jsdom

import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../LspBetaCell', () => ({ LspBetaCell: () => <div data-testid="lsp" /> }));
vi.mock('../BetaChannelCell', () => ({ BetaChannelCell: () => <div data-testid="beta-channel" /> }));
vi.mock('@/hooks/useExperimentalFeatures', async (orig) => ({
  ...(await orig<typeof import('@/hooks/useExperimentalFeatures')>()),
  EXPERIMENTAL_FEATURES: [],
}));

import { ExperimentalSection } from '../ExperimentalSection';

afterEach(() => cleanup());

describe('ExperimentalSection in Countersign', () => {
  it('has no beta update channel cell even where the platform supports it', () => {
    (window as unknown as { electronAPI: unknown }).electronAPI = { supportsBetaUpdateChannel: true, platform: 'win32' };
    const { queryByTestId } = render(<ExperimentalSection />);
    expect(queryByTestId('beta-channel')).toBeNull();
    expect(queryByTestId('lsp')).not.toBeNull();
  });
});
