import type { DefaultSession, DefaultUser } from 'next-auth';
import type { DefaultJWT } from 'next-auth/jwt';

/**
 * TailDeck role names
 */
type RoleName = 'OWNER' | 'ADMIN' | 'OPERATOR' | 'AUDITOR' | 'USER';

/**
 * Extend the default Auth.js types to include custom properties
 */
declare module 'next-auth' {
  interface Session extends DefaultSession {
    user: {
      id: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      /** User's roles for authorization */
      roles: RoleName[];
    };
  }

  interface User extends DefaultUser {
    id: string;
    /** OIDC groups from Authentik */
    groups?: string[];
  }
}

declare module 'next-auth/jwt' {
  interface JWT extends DefaultJWT {
    id?: string;
    accessTokenExpires?: number;
    /** User's roles embedded in JWT */
    roles?: RoleName[];
  }
}
