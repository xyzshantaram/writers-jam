import { Request, Response } from "express";
import { clamp, makeQueryLinkHelper } from "../utils/mod.ts";
import { getPosts } from "../db/mod.ts";
import { config } from "../config.ts";
import { editionMap, editions } from "../utils/editions.ts";
import { errors } from "../error.ts";
import { ValidationError } from "../errors/general.ts";

export const index = (_: Request, res: Response) => {
    // Filter out "No edition" (id 0) and deleted editions for the list
    const visibleEditions = editions.filter(e => e.id !== 0 && !e.deleted);
    
    return res.render("editions", {
        editions: visibleEditions,
        whatsappUrl: config.whatsappUrl,
    });
};

export const view = (req: Request, res: Response) => {
    const id = Number(req.params.id);
    if (isNaN(id)) {
        return errors.render(res, ...ValidationError("Invalid edition ID"));
    }

    const edition = editionMap.get(id);
    if (!edition) {
        return errors.render(res, ...ValidationError("Edition not found"));
    }

    const updateQuery = makeQueryLinkHelper(req.query);
    const page = Number(req.query.page) || 1;

    // Use existing getPosts logic but strictly filtered by edition
    const results = getPosts({
        page,
        edition: id,
        sort: "updated", // Default sort
        order: "desc",   // Default order
    });

    return res.render("view-edition", {
        edition,
        results,
        links: {
            nextPage: updateQuery({
                page: String(clamp(page + 1, 1, results.totalPages)),
            }),
            prevPage: updateQuery({
                page: String(clamp(page - 1, 1, results.totalPages)),
            }),
            firstPage: updateQuery({
                page: "1",
            }),
            lastPage: updateQuery({
                page: results.totalPages.toString(),
            }),
        },
        page,
        whatsappUrl: config.whatsappUrl,
    });
};
