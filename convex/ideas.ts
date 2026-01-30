// Once you run `npm run convex:dev`, prefer importing from `./_generated/server` for typed helpers
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const listInbox = query({
  args: {},
  handler: async (ctx) => {
    const ideas = await ctx.db
      .query("ideas")
      .withIndex("byStatus", (q) => q.eq("status", "INBOX"))
      .order("desc")
      .collect();
    return ideas.filter((i) => !i.archived);
  },
});

export const listProjects = query({
  args: {},
  handler: async (ctx) => {
    const projects = await ctx.db
      .query("ideas")
      .withIndex("byType", (q) => q.eq("type", "PROJECT"))
      .order("desc")
      .collect();
    return projects.filter((p) => !p.archived);
  },
});

export const listFeaturesByProject = query({
  args: { projectId: v.id("ideas") },
  handler: async (ctx, { projectId }) => {
    const features = await ctx.db
      .query("ideas")
      .withIndex("byParent", (q) => q.eq("parentProjectId", projectId))
      .order("desc")
      .collect();
    return features.filter((f) => !f.archived);
  },
});

export const createProject = mutation({
  args: { content: v.string() },
  handler: async (ctx, { content }) => {
    const now = Date.now();
    return await ctx.db.insert("ideas", {
      content,
      type: "PROJECT",
      parentProjectId: undefined,
      status: "BACKLOG",
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const createFeature = mutation({
  args: {
    content: v.string(),
    parentProjectId: v.optional(v.id("ideas")),
    status: v.optional(
      v.union(v.literal("INBOX"), v.literal("BACKLOG"), v.literal("IN_PROGRESS"), v.literal("DONE"))
    ),
  },
  handler: async (ctx, { content, parentProjectId, status }) => {
    if (parentProjectId) {
      const parent = await ctx.db.get(parentProjectId);
      if (!parent || parent.type !== "PROJECT") throw new Error("Invalid project");
    }
    const now = Date.now();
    return await ctx.db.insert("ideas", {
      content,
      type: "FEATURE",
      parentProjectId,
      status: status ?? "INBOX",
      archived: false,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateIdea = mutation({
  args: {
    id: v.id("ideas"),
    content: v.optional(v.string()),
    status: v.optional(
      v.union(v.literal("INBOX"), v.literal("BACKLOG"), v.literal("IN_PROGRESS"), v.literal("DONE"))
    ),
    archived: v.optional(v.boolean()),
    parentProjectId: v.optional(v.union(v.id("ideas"), v.null())),
  },
  handler: async (ctx, { id, ...patch }) => {
    const idea = await ctx.db.get(id);
    if (!idea) throw new Error("Idea not found");
    
    // Convert null to undefined for parentProjectId
    const updateData: any = { ...patch, updatedAt: Date.now() };
    if (updateData.parentProjectId === null) {
      updateData.parentProjectId = undefined;
    }
    
    await ctx.db.patch(id, updateData);
    return id;
  },
});

export const updateStatus = mutation({
  args: { id: v.id("ideas"), status: v.union(v.literal("INBOX"), v.literal("BACKLOG"), v.literal("IN_PROGRESS"), v.literal("DONE")) },
  handler: async (ctx, { id, status }) => {
    const idea = await ctx.db.get(id);
    if (!idea) throw new Error("Idea not found");
    await ctx.db.patch(id, { status, updatedAt: Date.now() });
    return id;
  },
});

export const archiveIdea = mutation({
  args: { id: v.id("ideas") },
  handler: async (ctx, { id }) => {
    const idea = await ctx.db.get(id);
    if (!idea) throw new Error("Idea not found");
    await ctx.db.patch(id, { archived: true, updatedAt: Date.now() });
    return id;
  },
});

export const deleteIdea = mutation({
  args: { id: v.id("ideas") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return id;
  },
});
