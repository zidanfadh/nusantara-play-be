import { UserThrottlerGuard } from './user-throttler.guard';

/** Exposes the protected getTracker for the test. */
class TestableGuard extends UserThrottlerGuard {
  tracker(req: Record<string, unknown>) {
    return this.getTracker(req);
  }
}

describe('UserThrottlerGuard.getTracker (P3)', () => {
  const guard = Object.create(TestableGuard.prototype) as TestableGuard;

  it('tracks a logged-in user by user id', async () => {
    await expect(
      guard.tracker({ user: { id: 'user-1' }, ip: '203.0.113.5' }),
    ).resolves.toBe('user:user-1');
  });

  it('tracks two users behind the same IP separately', async () => {
    const a = await guard.tracker({ user: { id: 'a' }, ip: '203.0.113.5' });
    const b = await guard.tracker({ user: { id: 'b' }, ip: '203.0.113.5' });
    expect(a).not.toBe(b);
  });

  it('tracks an anonymous request by IP', async () => {
    await expect(guard.tracker({ ip: '203.0.113.5' })).resolves.toBe(
      'ip:203.0.113.5',
    );
  });

  it('treats a user without a usable id as anonymous', async () => {
    await expect(
      guard.tracker({ user: { id: '' }, ip: '203.0.113.5' }),
    ).resolves.toBe('ip:203.0.113.5');
    await expect(
      guard.tracker({ user: { id: 42 }, ip: '203.0.113.5' }),
    ).resolves.toBe('ip:203.0.113.5');
  });

  it('never mixes the user and IP key spaces', async () => {
    const asUser = await guard.tracker({ user: { id: '203.0.113.5' } });
    const asIp = await guard.tracker({ ip: '203.0.113.5' });
    expect(asUser).not.toBe(asIp);
  });

  it('falls back to "unknown" when there is no IP', async () => {
    await expect(guard.tracker({})).resolves.toBe('ip:unknown');
  });
});
