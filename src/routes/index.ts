import { Request, Response } from "express";
import { getPostCount, getPosts, getViewCount } from "../db.ts";

function makeQueryLinkHelper(query: Record<string, any>) {
  return function addQueryParamsObject(newParams?: Record<string, string>) {
    const merged = { ...query, ...newParams };

    const cleaned = Object.fromEntries(
      Object.entries(merged).filter(([_, v]) => v != null),
    );

    const searchParams = new URLSearchParams(cleaned);
    return `?${searchParams.toString()}`;
  };
}

export const get = (req: Request, res: Response) => {
  const rawSort = req.query.sort;
  const rawNsfw = req.query.nsfw;

  const sort = rawSort === "updated" || rawSort === "views"
    ? rawSort
    : undefined;
  const nsfw = rawNsfw === "yes" || rawNsfw === "no" ? rawNsfw : undefined;

  const results = getPosts({ sort, nsfw });
  const addQuery = makeQueryLinkHelper(req.query);

  const postCount = getPostCount();
  const viewCount = getViewCount();

  res.render("index", {
    results,
    postCount,
    viewCount,
    currentSort: sort,
    currentNsfw: nsfw,
    queries: {
      sort_views: addQuery({ sort: "views" }),
      sort_updated: addQuery({ sort: "updated" }),
      nsfw_toggle: addQuery({ nsfw: nsfw === "yes" ? "no" : "yes" }),
    },
  });
};
