import { cache, choose } from "../utils/mod.ts";
import { timeMs } from "../utils/time.ts";
import { db } from "./db.ts";
import { getCurrentEdition } from "./mod.ts";
import { type getPosts } from "./posts.ts";
import { toPostShape } from "./utils.ts";

const sleptOnThresholds = [
    { views: 20, comments: 3 },
    { views: 50, comments: 5 },
    { views: 100, comments: 10 },
    { views: 200, comments: 20 },
];

const homePageSelectFields = `
  p.id, p.title, p.nsfw, p.password, p.triggers,
  p.author, p.updated, p.views, p.tags
`;

const recentUpdatedStmt = db.prepare(`
  SELECT ${homePageSelectFields}
  FROM post p
  WHERE p.deleted != 1
  ORDER BY p.updated DESC
  LIMIT 20
`);

const mostViewedStmt = db.prepare(`
  SELECT ${homePageSelectFields}
  FROM post p
  WHERE p.deleted != 1
  ORDER BY p.views DESC
  LIMIT 20
`);

const sleptOnStmt = db.prepare(`
      SELECT ${homePageSelectFields}, IFNULL(c.comment_count, 0) as comment_count
      FROM post p
      LEFT JOIN (
        SELECT "for", COUNT(*) AS comment_count
        FROM comment
        GROUP BY "for"
      ) c ON c."for" = p.id
      WHERE p.deleted != 1
        AND (IFNULL(p.views, 0) <= ? OR IFNULL(c.comment_count, 0) <= ?)
      ORDER BY RANDOM()
      LIMIT 15
`);

const currentEditionStmt = db.prepare(`
  SELECT ${homePageSelectFields}
  FROM post p
  WHERE p.deleted != 1
    AND json_extract(p.tags, '$.edition.value') = ?
  ORDER BY RANDOM()
  LIMIT 10
`);

const getHomepageFeedsInternal = (): {
    latest: ReturnType<typeof getPosts>["posts"];
    sleptOn: ReturnType<typeof getPosts>["posts"];
    currentEdition: ReturnType<typeof getPosts>["posts"];
    mostViewed: ReturnType<typeof getPosts>["posts"];
} => {
    const editionRows = currentEditionStmt.all(getCurrentEdition());
    const editionIds = new Set(editionRows.map((p) => p.id));

    let sleptOnCandidates: any[] = [];

    for (const { views, comments } of sleptOnThresholds) {
        sleptOnCandidates = sleptOnStmt.all(views, comments)
            .filter((p) => !editionIds.has(p.id));

        if (sleptOnCandidates.length >= 5) break;
    }

    const sleptOnRows = choose(sleptOnCandidates, 5);
    const sleptOnIds = new Set(sleptOnRows.map((p) => p.id));

    const recentUpdatedCandidates = recentUpdatedStmt.all()
        .filter((p) => !editionIds.has(p.id) && !sleptOnIds.has(p.id));
    const latestRows = choose(recentUpdatedCandidates, 5);
    const latestIds = new Set(latestRows.map((p) => p.id));

    const mostViewedCandidates = mostViewedStmt.all()
        .filter((p) =>
            !editionIds.has(p.id) &&
            !sleptOnIds.has(p.id) &&
            !latestIds.has(p.id)
        );
    const mostViewedRows = choose(mostViewedCandidates, 5);

    return {
        currentEdition: editionRows.length > 5
            ? choose(editionRows, 5).map(toPostShape)
            : editionRows.map(toPostShape),

        sleptOn: sleptOnRows.map(toPostShape),
        latest: latestRows.map(toPostShape),
        mostViewed: mostViewedRows.map(toPostShape),
    };
};

export const getHomepageFeeds = cache(getHomepageFeedsInternal, timeMs({ m: 10 }));
