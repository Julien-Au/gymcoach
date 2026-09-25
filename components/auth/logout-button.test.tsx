import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LogoutButton } from './logout-button';

const { replaceMock, refreshMock } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  refreshMock: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, refresh: refreshMock }),
}));

describe('LogoutButton', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it('posts to the logout route and purges the session caches', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const deleteMock = vi.fn().mockResolvedValue(true);
    vi.stubGlobal('caches', {
      keys: vi
        .fn()
        .mockResolvedValue(['api-get', 'pages', 'start-url', 'static-assets']),
      delete: deleteMock,
    });

    render(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
    });
    // The user's cached API responses and page documents are gone; shared
    // static assets stay.
    expect(deleteMock).toHaveBeenCalledWith('api-get');
    expect(deleteMock).toHaveBeenCalledWith('pages');
    expect(deleteMock).toHaveBeenCalledWith('start-url');
    expect(deleteMock).not.toHaveBeenCalledWith('static-assets');
    expect(refreshMock).toHaveBeenCalled();
  });

  it('still navigates to /login when CacheStorage is unavailable', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);

    render(<LogoutButton />);
    await userEvent.click(screen.getByRole('button', { name: /log out/i }));

    await waitFor(() => expect(replaceMock).toHaveBeenCalledWith('/login'));
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', {
      method: 'POST',
    });
  });
});
