import { Request, Response } from "express";
import { getHomepageFeeds, getPostCount, getViewCount } from "../db.ts";
import description from "../../data/description.md" with { type: "text" };
import { config } from "../config.ts";

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

export const get = (_: Request, res: Response) => {
  const postCount = getPostCount();
  const viewCount = getViewCount();

  res.render("index", {
    whatsappUrl: config.whatsappUrl,
    postCount,
    viewCount,
    description: getDescription(),
    feeds: getHomepageFeeds()
  });
};
