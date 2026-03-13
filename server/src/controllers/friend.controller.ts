import { type SafeUserInfo } from "@gamenite/shared";
import { getFriendsList } from "../services/friend.service.ts";
import { type RestAPI } from "../types.ts";

export const getList: RestAPI<SafeUserInfo[], { username: string }> = async (req, res) => {
  try {
    const friends = await getFriendsList(req.params.username);
    res.send(friends);
  } catch {
    res.status(404).send({ error: "User not found" });
  }
};
