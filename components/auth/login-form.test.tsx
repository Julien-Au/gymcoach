import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// The router is irrelevant to these assertions; stub it so the component mounts.
vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }),
}));

// The demo flag/credentials are read at module load, so re-import after stubbing.
async function renderForm() {
  vi.resetModules();
  const { LoginForm } = await import('./login-form');
  return render(<LoginForm />);
}

describe('LoginForm demo banner', () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it('does not render the demo banner when NEXT_PUBLIC_DEMO_MODE is unset', async () => {
    await renderForm();
    expect(screen.queryByText('Demo account')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /log in as demo/i }),
    ).not.toBeInTheDocument();
  });

  it('shows the demo credentials and logs in with one click when demo mode is on', async () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true');
    vi.stubEnv('NEXT_PUBLIC_DEMO_EMAIL', 'demo@gymcoach.app');
    vi.stubEnv('NEXT_PUBLIC_DEMO_PASSWORD', 'gymcoachdemo');
    const fetchMock = vi
      .fn()
      .mockResolvedValue({ ok: true, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchMock);

    await renderForm();

    expect(screen.getByText('Demo account')).toBeInTheDocument();
    expect(
      screen.getByText('demo@gymcoach.app / gymcoachdemo'),
    ).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: /log in as demo/i }),
    );

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/login',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          email: 'demo@gymcoach.app',
          password: 'gymcoachdemo',
        }),
      }),
    );
  });
});
