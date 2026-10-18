import bcrypt from "bcryptjs";
import { Prisma, type ContentType, type Platform, type PostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { Role } from "@/lib/types";

type Db = Prisma.TransactionClient;

type AccountSpec = {
  email: string;
  password: string;
  name: string;
  role: Role;
};

let pending: Promise<void> | null = null;

export function bootstrap() {
  if (!pending) {
    pending = run().catch((error) => {
      pending = null;
      throw error;
    });
  }
  return pending;
}

function accountsFromEnv(): AccountSpec[] {
  const accounts: AccountSpec[] = [];
  const managementEmail = process.env.MANAGEMENT_EMAIL?.trim().toLowerCase();
  const managementPassword = process.env.MANAGEMENT_PASSWORD;
  if (managementEmail && managementPassword) {
    accounts.push({
      email: managementEmail,
      password: managementPassword,
      name: process.env.MANAGEMENT_NAME?.trim() || "Millie",
      role: "MANAGEMENT",
    });
  }
  const teamEmail = process.env.TEAM_EMAIL?.trim().toLowerCase();
  const teamPassword = process.env.TEAM_PASSWORD;
  if (teamEmail && teamPassword) {
    accounts.push({
      email: teamEmail,
      password: teamPassword,
      name: process.env.TEAM_NAME?.trim() || "Content team",
      role: "TEAM",
    });
  }
  if (process.env.EXTRA_USERS) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(process.env.EXTRA_USERS);
    } catch {
      throw new Error("EXTRA_USERS must be JSON.");
    }
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (!item || typeof item !== "object") continue;
        const record = item as Record<string, unknown>;
        const email = String(record.email ?? "").trim().toLowerCase();
        const password = String(record.password ?? "");
        const role = record.role === "MANAGEMENT" || record.role === "TEAM" ? record.role : null;
        if (!email || !password || !role) continue;
        accounts.push({
          email,
          password,
          name: String(record.name || email),
          role,
        });
      }
    }
  }
  for (const account of accounts) {
    if (account.password.length < 10) {
      throw new Error(`The password for ${account.email} must be at least 10 characters.`);
    }
  }
  return accounts;
}

async function upsertAccounts(db: Db, accounts: AccountSpec[]) {
  for (const account of accounts) {
    const existing = await db.user.findUnique({ where: { email: account.email } });
    if (!existing) {
      await db.user.create({
        data: {
          email: account.email,
          name: account.name,
          role: account.role,
          passwordHash: await bcrypt.hash(account.password, 10),
        },
      });
      continue;
    }
    const samePassword = await bcrypt.compare(account.password, existing.passwordHash);
    if (!samePassword || existing.name !== account.name || existing.role !== account.role) {
      await db.user.update({
        where: { id: existing.id },
        data: {
          name: account.name,
          role: account.role,
          passwordHash: samePassword ? undefined : await bcrypt.hash(account.password, 10),
        },
      });
    }
  }
}

function svg(title: string, line: string, portrait: boolean) {
  const height = portrait ? 1920 : 1080;
  const escape = (value: string) =>
    value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="${height}" viewBox="0 0 1080 ${height}">
      <rect width="1080" height="${height}" fill="#fff8f3"/>
      <rect width="1080" height="36" fill="#ed217a"/>
      <text x="72" y="220" font-family="Georgia" font-size="48" fill="#dc376e">MailBakes</text>
      <text x="72" y="${portrait ? 860 : 520}" font-family="Georgia" font-size="72" fill="#1e1a1c">${escape(title)}</text>
      <text x="72" y="${portrait ? 980 : 620}" font-family="Georgia" font-size="36" fill="#5c5148">${escape(line)}</text>
      <text x="72" y="${height - 120}" font-family="Georgia" font-size="32" fill="#dc376e">Cake in a card. Through the letterbox.</text>
    </svg>`,
  );
}

async function seedSamples(db: Db) {
  if (process.env.SEED_SAMPLE_CONTENT === "false") {
    await db.appMeta.upsert({
      where: { id: "sampleSeeded" },
      update: {},
      create: { id: "sampleSeeded", value: "disabled" },
    });
    return;
  }
  const [team, management] = await Promise.all([
    db.user.findFirst({ where: { role: "TEAM" } }),
    db.user.findFirst({ where: { role: "MANAGEMENT" } }),
  ]);
  if (!team || !management) return;

  const posts: {
    title: string;
    platforms: Platform[];
    contentType: ContentType;
    plannedDate: string;
    status: PostStatus;
    caption: string;
    creativeNotes: string;
    comment?: { kind: "CHANGES" | "REJECTION" | "APPROVAL"; body: string };
    portrait?: boolean;
  }[] = [
    {
      title: "A letterbox birthday",
      platforms: ["INSTAGRAM", "FACEBOOK"],
      contentType: "FEED",
      plannedDate: "2026-10-16",
      status: "APPROVED",
      caption:
        "Two slices, one card, straight through the letterbox. Vanilla and chocolate fudge, with their message printed inside. Baked this morning in Liverpool.",
      creativeNotes: "Use the pink heart card photo.",
      comment: { kind: "APPROVAL", body: "Approved." },
    },
    {
      title: "Packed for the post",
      platforms: ["TIKTOK", "INSTAGRAM"],
      contentType: "REEL",
      plannedDate: "2026-10-20",
      status: "PENDING_APPROVAL",
      caption: "From the tin to the letterbox. Freshly baked, wrapped, and posted the same day.",
      creativeNotes: "Short vertical film of packing a two-slice card.",
    },
    {
      title: "This morning's bake",
      platforms: ["INSTAGRAM", "FACEBOOK", "SNAPCHAT"],
      contentType: "STORY",
      plannedDate: "2026-10-18",
      status: "PENDING_APPROVAL",
      caption: "Lemon drizzle and red velvet on the bench. 400 Cake Cards before lunch.",
      creativeNotes: "Story frame, full bleed of the tray.",
      portrait: true,
    },
    {
      title: "Made in Liverpool",
      platforms: ["LINKEDIN"],
      contentType: "FEED",
      plannedDate: "2026-10-22",
      status: "APPROVED",
      caption:
        "MailBakes started in a family kitchen. Every Cake Card is now baked in our Liverpool bakery and handed to Royal Mail the same day. A small way to be there, even when you can't.",
      creativeNotes: "Bakery exterior, natural light.",
      comment: { kind: "APPROVAL", body: "Approved." },
    },
    {
      title: "The letterbox test",
      platforms: ["YOUTUBE_SHORTS", "TIKTOK"],
      contentType: "REEL",
      plannedDate: "2026-10-24",
      status: "PENDING_APPROVAL",
      caption:
        "Does it actually fit? One-slice and two-slice Cake Cards are made for a standard UK letterbox. A four-slice pack needs someone home.",
      creativeNotes: "Film a real letterbox, not a mock-up.",
    },
    {
      title: "Dispatch day",
      platforms: ["SNAPCHAT", "INSTAGRAM"],
      contentType: "STORY",
      plannedDate: "2026-10-19",
      status: "APPROVED",
      caption: "Bags packed, labels on, off to Royal Mail. Order before 4pm and we bake today.",
      creativeNotes: "Story sticker: Order by 4pm.",
      portrait: true,
      comment: { kind: "APPROVAL", body: "Approved." },
    },
    {
      title: "Christmas Cake Cards",
      platforms: ["INSTAGRAM", "FACEBOOK", "TIKTOK"],
      contentType: "FEED",
      plannedDate: "2026-10-28",
      status: "CHANGES_REQUESTED",
      caption:
        "Christmas designs are nearly ready. A little cake, a proper message, through their letterbox.",
      creativeNotes: "Waiting on the robin card photo.",
      comment: {
        kind: "CHANGES",
        body: "Can we wait until the robin design photo is in? The caption's lovely, but the creative still says coming soon.",
      },
    },
    {
      title: "Just because",
      platforms: ["INSTAGRAM"],
      contentType: "FEED",
      plannedDate: "2026-11-01",
      status: "DRAFT",
      caption: "No occasion needed. Sometimes the post is just: we made cake, and it fits through a letterbox.",
      creativeNotes: "",
    },
    {
      title: "Win a Cake Card",
      platforms: ["INSTAGRAM"],
      contentType: "FEED",
      plannedDate: "2026-10-21",
      status: "REJECTED",
      caption: "Giveaway: tell us who you'd send a Cake Card to.",
      creativeNotes: "",
      comment: {
        kind: "REJECTION",
        body: "Let's skip giveaways this month and keep the feed on the bakery and the letterbox. Happy to look at it again in the new year.",
      },
    },
  ];

  for (const item of posts) {
    const [year, month, day] = item.plannedDate.split("-").map(Number);
    const reviewed = item.status !== "DRAFT" && item.status !== "PENDING_APPROVAL";
    const image = new Uint8Array(svg(item.title, "MailBakes · Liverpool", Boolean(item.portrait))) as Uint8Array<ArrayBuffer>;
    await db.post.create({
      data: {
        title: item.title,
        platforms: item.platforms,
        contentType: item.contentType,
        plannedDate: new Date(Date.UTC(year, month - 1, day)),
        status: item.status,
        caption: item.caption,
        creativeNotes: item.creativeNotes,
        authorId: team.id,
        reviewerId: reviewed || item.comment ? management.id : null,
        reviewedAt: item.comment ? new Date("2026-10-17T09:30:00Z") : null,
        media: {
          create: {
            fileName: `${item.title}.svg`,
            mimeType: "image/svg+xml",
            sizeBytes: image.length,
            data: image,
          },
        },
        comments: item.comment
          ? {
              create: {
                authorId: management.id,
                kind: item.comment.kind,
                body: item.comment.body,
              },
            }
          : undefined,
      },
    });
  }

  await db.keyDate.createMany({
    data: [
      {
        title: "Christmas Cake Cards launch",
        date: new Date(Date.UTC(2026, 9, 22)),
        kind: "LAUNCH",
        notes: "Designs go on the site. Social can start the same day.",
        authorId: management.id,
      },
      {
        title: "Halloween delivery cut-off",
        date: new Date(Date.UTC(2026, 9, 30)),
        kind: "KEY_DATE",
        notes: "Order by 4pm for a next-day letterbox delivery.",
        authorId: team.id,
      },
    ],
  });

  await db.appMeta.create({ data: { id: "sampleSeeded", value: "yes" } });
}

async function run() {
  // Session locks escape Prisma's pool: lock and unlock can land on different
  // connections, and the next request waits forever. A transaction lock is
  // tied to the one connection this work uses, and it drops on commit.
  await prisma.$transaction(
    async (db) => {
      await db.$executeRaw`SELECT pg_advisory_xact_lock(8142018)`;
      await upsertAccounts(db, accountsFromEnv());
      const flag = await db.appMeta.findUnique({ where: { id: "sampleSeeded" } });
      if (!flag && (await db.post.count()) === 0) {
        await seedSamples(db);
      } else if (!flag) {
        await db.appMeta.create({ data: { id: "sampleSeeded", value: "existing" } });
      }
    },
    { timeout: 60_000 },
  );
}
