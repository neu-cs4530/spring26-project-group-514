import { withAuth, type SafeUserInfo } from "@gamenite/shared";
import { blockUser } from "../services/block.service.ts";
import { type RestAPI } from "../types.ts";
import { z } from "zod";
import { checkAuth } from "../services/auth.service.ts";

/**
 * Handles blocking a user
 *
 * @param req request containing auth info and the username to block
 * @param res response either returning the blocked user's info or an error
 */
export const postBlock: RestAPI<SafeUserInfo> = async (req, res) => {
  const body = withAuth(z.object({ blockedUsername: z.string() })).safeParse(req.body);
  if (body.error) {
    res.status(400).send({ error: "Poorly-formed request" });
    return;
  }

  const user = await checkAuth(body.data.auth);
  if (!user) {
    res.status(403).send({ error: "Invalid credentials" });
    return;
  }

  try {
    const blocked = await blockUser(user.username, body.data.payload.blockedUsername);
    res.send(blocked);
  } catch (e) {
    res.status(400).send({ error: "Bad Request" });
  }
};
