import { Request, Response } from "express";
import { getPostCount, getPosts, getViewCount } from "../db.ts";
import description from "../../data/description.md" with { type: "text" };
import { clamp } from "../utils/mod.ts";
import { config } from "../config.ts";

function makeQueryLinkHelper(query: Record<string, any>) {
  return function addQueryParamsObject(
    newParams?: Record<string, string | undefined>,
  ) {
    const merged = { ...query, ...newParams };

    const cleaned = Object.fromEntries(
      Object.entries(merged).filter(([_, v]) => v != null),
    );

    const searchParams = new URLSearchParams(cleaned);
    return `?${searchParams.toString()}`;
  };
}

const descReplacements = {
  $WHATSAPP_URL: config.whatsappUrl,
}

export const getDescription = () => {
  let result = description;
  for (const [replacement, value] of Object.entries(descReplacements)) {
    result = result.replace(replacement, value);
  }

  return result;
}

export const get = (req: Request, res: Response) => {
  const rawSort = req.query.sort;
  const rawNsfw = req.query.nsfw;
  const page = Number(req.query.page) || 1;

  const sort = rawSort === "updated" || rawSort === "views"
    ? rawSort
    : undefined;
  const nsfw = rawNsfw === "yes" || rawNsfw === "no" ? rawNsfw : undefined;

  const results = getPosts({ sort, nsfw, page });
  const addQuery = makeQueryLinkHelper(req.query);

  const postCount = getPostCount();
  const viewCount = getViewCount();

  res.render("index", {
    whatsappUrl: config.whatsappUrl,
    results: results.posts,
    totalPages: results.totalPages,
    page,
    postCount,
    viewCount,
    currentSort: sort,
    currentNsfw: nsfw,
    description: getDescription(),
    queries: {
      sort_views: addQuery({ sort: "views", page: undefined }),
      sort_updated: addQuery({ sort: "updated", page: undefined }),
      nsfw_toggle: addQuery({
        page: undefined,
        nsfw: nsfw === "yes" ? "no" : "yes",
      }),
      next_link: addQuery({
        page: clamp(page + 1, 1, Math.ceil(postCount / 10)).toString(),
      }),
      prev_link: addQuery({
        page: clamp(page - 1, 1, Math.ceil(postCount / 10)).toString(),
      }),
    },
  });
};
