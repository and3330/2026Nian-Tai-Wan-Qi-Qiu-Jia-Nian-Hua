import { pgTable, serial, integer, text, timestamp, uniqueIndex, index } from "drizzle-orm/pg-core";
import { contestantsTable } from "./contestants";

export const contestantVotesTable = pgTable(
  "contestant_votes",
  {
    id: serial("id").primaryKey(),
    contestantId: integer("contestant_id")
      .notNull()
      .references(() => contestantsTable.id, { onDelete: "cascade" }),
    voterToken: text("voter_token").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqVoterContestant: uniqueIndex("contestant_votes_voter_contestant_uniq").on(t.voterToken, t.contestantId),
    byContestant: index("contestant_votes_by_contestant_idx").on(t.contestantId),
  }),
);

export type ContestantVoteRow = typeof contestantVotesTable.$inferSelect;
