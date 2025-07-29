import { Request, Response } from "express";
import { clamp, makeQueryLinkHelper } from "../utils/mod.ts";
import { getPosts } from "../db.ts";
import { config } from "../config.ts";
import { editions, parseEdition } from "../utils/editions.ts";

export const index = (req: Request, res: Response) => {
    const updateQuery = makeQueryLinkHelper(req.query);

    const {
        sort: rawSort,
        search,
        nsfw: rawNsfw,
        order: rawOrder,
        edition: rawEdition,
    } = req.query;
    const page = Number(req.query.page) || 1;
    const nsfw = rawNsfw === "no" ? rawNsfw : "yes";
    const sort = rawSort === "views" ? rawSort : "updated";
    const order = rawOrder === "asc" ? rawOrder : "desc";

    const edition = parseEdition(rawEdition);

    const results = getPosts({
        nsfw,
        sort,
        page,
        order,
        search: String(search || ""),
        edition: edition.noEdition ? undefined : (edition.zero ? 0 : edition.number),
    });

    return res.render("posts", {
        results,
        links: {
            nextPage: updateQuery({
                page: String(clamp(page + 1, 1, results.totalPages)),
            }),
            prevPage: updateQuery({
                page: String(clamp(page - 1, 1, results.totalPages)),
            }),
        },
        currentEdition: edition.noEdition ? undefined : edition.number,
        editions,
        nsfw,
        sort,
        page,
        order,
        search,
        hasQuery: Object.keys(req.query).length > 0,
        whatsappUrl: config.whatsappUrl,
    });
};
