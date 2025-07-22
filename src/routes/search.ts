import { Request, Response } from "express";
import { clamp, makeQueryLinkHelper } from "../utils/mod.ts";
import { getPosts } from "../db.ts";
import { config } from "../config.ts";

export const index = (req: Request, res: Response) => {
    const updateQuery = makeQueryLinkHelper(req.query);
    
    const { sort: rawSort, search, nsfw: rawNsfw, order: rawOrder } = req.query;
    const page = Number(req.query.page) || 1;
    const nsfw = rawNsfw === "yes" ? rawNsfw : "no";
    const sort = rawSort === "views" ? rawSort : "updated";
    const order = rawOrder === "asc" ? rawOrder : "desc";

    const results = getPosts({
        nsfw, sort, page, order, search: String(search || "")
    })

    console.log(results);

    return res.render('posts', {
        results,
        links: {
            nextPage: updateQuery({ page: String(clamp(page + 1, 1, results.totalPages) )}),
            prevPage: updateQuery({ page: String(clamp(page - 1, 1, results.totalPages)) })
        },
        nsfw,
        sort,
        page,
        order,
        search,
        whatsappUrl: config.whatsappUrl
    });
}