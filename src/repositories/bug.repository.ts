import { Prisma } from '@prisma/client';
import { prisma } from '../config/database';

/**
 * The only User columns safe to embed in a response. Anything else (notably
 * `passwordHash` and `twoFactorSecret`) must never leave the database.
 */
const PUBLIC_USER = {
  id: true,
  name: true,
  email: true,
  avatar: true,
} as const;

export const bugRepository = {
  findById: (id: string) =>
    prisma.bug.findUnique({
      where: { id },
      include: {
        // An explicit `select` is required here: `user: true` returned every
        // scalar column on User, so `GET /bugs/:id` serialized each commenter's
        // passwordHash and twoFactorSecret straight to the client. The list
        // query below already models the correct shape.
        comments: { include: { user: { select: PUBLIC_USER } } },
        assignee: { select: PUBLIC_USER },
        creator: { select: PUBLIC_USER },
        testResults: true,
        attachments: true,
      },
    }),

  create: (data: Prisma.BugUncheckedCreateInput) => prisma.bug.create({ data }),

  update: (id: string, data: Prisma.BugUncheckedUpdateInput) => prisma.bug.update({ where: { id }, data }),

  hardDelete: (id: string) => prisma.bug.delete({ where: { id } }),

  changeStatus: (id: string, status: Prisma.BugUpdateInput['status']) =>
    prisma.bug.update({
      where: { id },
      data: {
        status,
        closedAt: status === 'CLOSED' || status === 'VERIFIED' || status === 'REJECTED' ? new Date() : null,
      },
    }),

  assign: (id: string, assigneeId: string | null) =>
    prisma.bug.update({ where: { id }, data: { assigneeId } }),

  addComment: (data: Prisma.BugCommentUncheckedCreateInput) => prisma.bugComment.create({ data }),

  listComments: (bugId: string, skip = 0, take = 50) =>
    prisma.bugComment.findMany({
      where: { bugId },
      skip,
      take,
      orderBy: { createdAt: 'asc' },
      include: { user: { select: { id: true, email: true, name: true } } },
    }),

  countComments: (bugId: string) => prisma.bugComment.count({ where: { bugId } }),

  list: (where: Prisma.BugWhereInput = {}, skip = 0, take = 20) =>
    prisma.bug.findMany({
      where,
      skip,
      take,
      orderBy: { createdAt: 'desc' },
      include: {
        assignee: { select: PUBLIC_USER },
        creator: { select: PUBLIC_USER },
      },
    }),

  count: (where: Prisma.BugWhereInput = {}) => prisma.bug.count({ where }),
};
