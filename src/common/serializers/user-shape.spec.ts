import {
  PUBLIC_USER_FIELDS,
  omitFields,
  stripPrivateUserFields,
  toPublicUser,
} from './user-shape';

const fullUser = {
  id: 'user-1',
  supabase_user_id: '00000000-0000-0000-0000-000000000001',
  email: 'someone@example.test',
  full_name: 'Some One',
  role: 'kurator_daerah',
  status: 'active',
  phone: '+62 812 0000 0000',
  avatar_url: 'https://example.test/a.png',
  bio: 'bio',
  daerah_id: 'daerah-1',
  institution: 'KPOTI',
  expertise: ['gasing'],
  last_login_at: new Date('2026-11-01T00:00:00Z'),
  created_at: new Date('2026-01-01T00:00:00Z'),
  updated_at: new Date('2026-01-02T00:00:00Z'),
  created_by: null,
  updated_by: null,
};

describe('user-shape', () => {
  describe('toPublicUser', () => {
    it('keeps exactly the public fields', () => {
      const result = toPublicUser(fullUser);

      expect(result).toEqual({
        id: 'user-1',
        full_name: 'Some One',
        avatar_url: 'https://example.test/a.png',
        institution: 'KPOTI',
      });
      expect(Object.keys(result as object).sort()).toEqual(
        [...PUBLIC_USER_FIELDS].sort(),
      );
    });

    it('fills missing optional fields with null', () => {
      expect(toPublicUser({ id: 'u', full_name: 'N' })).toEqual({
        id: 'u',
        full_name: 'N',
        avatar_url: null,
        institution: null,
      });
    });

    it('returns null for a missing user', () => {
      expect(toPublicUser(null)).toBeNull();
      expect(toPublicUser(undefined)).toBeNull();
    });
  });

  describe('stripPrivateUserFields', () => {
    it('removes supabase_user_id and last_login_at and keeps the rest', () => {
      const result = stripPrivateUserFields(fullUser);

      expect(result).not.toHaveProperty('supabase_user_id');
      expect(result).not.toHaveProperty('last_login_at');
      expect(result).toMatchObject({
        id: 'user-1',
        email: 'someone@example.test',
        phone: '+62 812 0000 0000',
      });
    });

    it('does not mutate the input', () => {
      const input = { ...fullUser };
      stripPrivateUserFields(input);
      expect(input).toHaveProperty('supabase_user_id');
    });

    it('passes null and undefined through', () => {
      expect(stripPrivateUserFields(null)).toBeNull();
      expect(stripPrivateUserFields(undefined)).toBeUndefined();
    });
  });

  it('omitFields removes the given keys only', () => {
    expect(omitFields({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 });
  });
});
