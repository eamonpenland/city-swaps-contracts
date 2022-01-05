import { Account, types } from "../deps.ts";
import { Model } from "../src/model.ts";

export class MiamiCoin extends Model {
  name: string = "miamicoin-token";

  static TOKEN_NAME = "miamicoin";

  mint(amount: number, recipient: Account) {
    return this.callPublic("mint", [
      types.uint(amount),
      types.principal(recipient.address),
    ]);
  }

  transfer(
    amount: number,
    from: Account | string,
    to: Account | string,
    sender: Account
  ) {
    return this.callPublic(
      "transfer",
      [
        types.uint(amount),
        types.principal(typeof from === "string" ? from : from.address),
        types.principal(typeof to === "string" ? to : to.address),
        types.none(), // memo
      ],
      sender
    );
  }
}
