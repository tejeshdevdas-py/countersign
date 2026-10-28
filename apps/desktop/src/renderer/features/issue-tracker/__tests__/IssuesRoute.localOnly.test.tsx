// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../IssueTrackerFeatureLayout', () => ({
  IssueTrackerFeatureLayout: () => <div>issue tracker page</div>,
}));

import { IssuesRoute } from '../IssuesRoute';

afterEach(() => cleanup());

describe('the /issues route in Countersign', () => {
  it('sends a direct visit back to the start page instead of the issue tracker', () => {
    render(
      <MemoryRouter initialEntries={['/issues']}>
        <Routes>
          <Route path="/" element={<div>start page</div>} />
          <Route path="/issues" element={<IssuesRoute />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('start page')).toBeTruthy();
    expect(screen.queryByText('issue tracker page')).toBeNull();
  });
});
