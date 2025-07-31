import { Request, Response } from "express";
import { config } from "../config.ts";

/*
GET /post/:ulid/edit
    - delete post
    - edit post contents
POST /post/:ulid/edit

GET /admin/reports
GET /admin/reports/:id
POST /post/:id/report (w/ reason). 3 reports to hide a post and present it to admin for review as flagged.

POST /admin/post/:id/delete
POST /admin/post/:id/nsfw (yes/no)
POST /admin/comment/:ulid/delete
POST /admin/edition
POST /admin/edition/delete
*/

export const index = (_: Request, res: Response) => {
    res.render("admin", {
        whatsappUrl: config.whatsappUrl,
    });
};
