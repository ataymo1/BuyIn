import type { ConvexHttpClient } from "convex/browser";
import type { Adapter, AdapterSession } from "next-auth/adapters";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export function ConvexAdapter(client: ConvexHttpClient): Adapter {
  return {
    async createUser(user) {
      const userId = await client.mutation(api.auth.createUser, {
        email: user.email,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
        emailVerified: user.emailVerified
          ? user.emailVerified.getTime()
          : undefined,
      });
      return {
        id: userId,
        email: user.email,
        name: user.name,
        image: user.image,
        emailVerified: user.emailVerified,
      };
    },

    async getUser(id) {
      const user = await client.query(api.auth.getUser, {
        id: id as Id<"users">,
      });
      if (!user) {
        return null;
      }
      return {
        id: user._id,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
      };
    },

    async getUserByEmail(email) {
      const user = await client.query(api.auth.getUserByEmail, { email });
      if (!user) {
        return null;
      }
      return {
        id: user._id,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
      };
    },

    async getUserByAccount({ provider, providerAccountId }) {
      const account = await client.query(api.auth.getAccountByProvider, {
        provider,
        providerAccountId,
      });
      if (!account) {
        return null;
      }
      const user = await client.query(api.auth.getUser, { id: account.userId });
      if (!user) {
        return null;
      }
      return {
        id: user._id,
        email: user.email,
        name: user.name ?? null,
        image: user.image ?? null,
        emailVerified: user.emailVerified ? new Date(user.emailVerified) : null,
      };
    },

    async updateUser(user) {
      if (!user.id) {
        throw new Error("User ID is required");
      }
      await client.mutation(api.auth.updateUser, {
        id: user.id as Id<"users">,
        name: user.name ?? undefined,
        image: user.image ?? undefined,
        emailVerified: user.emailVerified
          ? user.emailVerified.getTime()
          : undefined,
      });
      return {
        id: user.id,
        email: user.email!,
        name: user.name ?? null,
        image: user.image ?? null,
        emailVerified: user.emailVerified ?? null,
      };
    },

    async linkAccount(account) {
      await client.mutation(api.auth.createAccount, {
        userId: account.userId as Id<"users">,
        type: account.type,
        provider: account.provider,
        providerAccountId: account.providerAccountId,
        refresh_token: account.refresh_token ?? undefined,
        access_token: account.access_token ?? undefined,
        expires_at: account.expires_at ?? undefined,
        token_type: account.token_type ?? undefined,
        scope: account.scope ?? undefined,
        id_token: account.id_token ?? undefined,
        session_state: account.session_state as string | undefined,
      });
    },

    async unlinkAccount({ provider, providerAccountId }) {
      await client.mutation(api.auth.deleteAccount, {
        provider,
        providerAccountId,
      });
    },

    async createSession(session) {
      await client.mutation(api.auth.createSession, {
        userId: session.userId as Id<"users">,
        sessionToken: session.sessionToken,
        expires: session.expires.getTime(),
      });
      return session;
    },

    async getSessionAndUser(sessionToken) {
      const result = await client.query(api.auth.getSessionByToken, {
        sessionToken,
      });
      if (!(result?.session && result?.user)) {
        return null;
      }
      return {
        session: {
          sessionToken: result.session.sessionToken,
          userId: result.session.userId,
          expires: new Date(result.session.expires),
        },
        user: {
          id: result.user._id,
          email: result.user.email,
          name: result.user.name ?? null,
          image: result.user.image ?? null,
          emailVerified: result.user.emailVerified
            ? new Date(result.user.emailVerified)
            : null,
        },
      };
    },

    async updateSession(session) {
      await client.mutation(api.auth.updateSession, {
        sessionToken: session.sessionToken,
        expires: session.expires ? session.expires.getTime() : undefined,
        userId: session.userId as Id<"users"> | undefined,
      });
      return session as AdapterSession;
    },

    async deleteSession(sessionToken) {
      await client.mutation(api.auth.deleteSession, { sessionToken });
    },

    async createVerificationToken(token) {
      await client.mutation(api.auth.createVerificationToken, {
        identifier: token.identifier,
        token: token.token,
        expires: token.expires.getTime(),
      });
      return token;
    },

    async useVerificationToken({ identifier, token }) {
      const result = await client.mutation(api.auth.deleteVerificationToken, {
        identifier,
        token,
      });
      if (!result) {
        return null;
      }
      return {
        identifier: result.identifier,
        token: result.token,
        expires: new Date(result.expires),
      };
    },
  };
}
