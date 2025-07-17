import Cap from "@cap.js/server";
import { Request, Response } from "express";

export const cap = new Cap({
  tokens_store_path: ".data/cap-state.json",
});

export const challenge = (_: Request, res: Response) => {
  res.json(cap.createChallenge());
};

export const redeem = async (req: Request, res: Response) => {
  const { token, solutions } = req.body;
  if (!token || !solutions) {
    return res.status(400).json({ success: false });
  }
  res.json(await cap.redeemChallenge({ token, solutions }));
};
