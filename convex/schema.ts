import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  ideas: defineTable({
    content: v.string(),
    type: v.union(v.literal("PROJECT"), v.literal("FEATURE")),
    parentProjectId: v.optional(v.id("ideas")),
    status: v.union(
      v.literal("INBOX"),
      v.literal("BACKLOG"),
      v.literal("IN_PROGRESS"),
      v.literal("DONE"),
    ),
    archived: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("byType", ["type"]) 
    .index("byParent", ["parentProjectId"]) 
    .index("byStatus", ["status"]),
});
