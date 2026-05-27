import { relations } from "drizzle-orm";
import { agents } from "./agents";
import { files } from "./files";
import { members, invitations } from "./organizations";
import { agentSessions, documents, messages, votes } from "./sessions";
import { accounts, authSessions, users } from "./users";

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  authSessions: many(authSessions),
  agentSessions: many(agentSessions),
  files: many(files),
  members: many(members),
  invitations: many(invitations),
}));

export const agentSessionsRelations = relations(agentSessions, ({ one, many }) => ({
  user: one(users, {
    fields: [agentSessions.userId],
    references: [users.id],
  }),
  messages: many(messages),
  agents: many(agents),
  files: many(files),
  votes: many(votes),
  documents: many(documents),
}));
