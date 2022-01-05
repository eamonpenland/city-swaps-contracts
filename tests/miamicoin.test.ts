import { describe, beforeEach, it, run } from "../deps.ts";
import { MiamiCoin } from "../models/miamicoin.model.ts";
import { Context } from "../src/context.ts";

describe("[MiamiCoin]", () => {
  let ctx: Context;
  let mia: MiamiCoin;

  beforeEach(() => {
    ctx = new Context();
    mia = ctx.models.get(MiamiCoin);
  });

  describe("mint()", () => {
    it("succeeds and mint desired amount of tokens", () => {
      const amount = 200;
      const recipient = ctx.accounts.get("wallet_2")!;

      // act
      const receipt = ctx.chain.mineBlock([mia.mint(amount, recipient)])
        .receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);
      receipt.events.expectFungibleTokenMintEvent(
        amount,
        recipient.address,
        MiamiCoin.TOKEN_NAME
      );
    });
  });

  describe("transfer()", () => {
    it("succeeds and transfer desired amount from one account to another", () => {
      const amount = 200;
      const from = ctx.accounts.get("wallet_2")!;
      const to = ctx.accounts.get("wallet_3")!;
      ctx.chain.mineBlock([mia.mint(amount, from)]);

      // act
      const receipt = ctx.chain.mineBlock([
        mia.transfer(amount, from, to, from),
      ]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);
      receipt.events.expectFungibleTokenTransferEvent(
        amount,
        from.address,
        to.address,
        MiamiCoin.TOKEN_NAME
      );
    });
  });
});

run();
