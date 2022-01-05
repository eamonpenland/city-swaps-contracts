import { describe, beforeEach, it, run } from "../deps.ts";
import { NewYorkCityCoin } from "../models/newyorkcitycoin.model.ts";
import { Context } from "../src/context.ts";

describe("[NewYorkCityCoin]", () => {
  let ctx: Context;
  let nyc: NewYorkCityCoin;

  beforeEach(() => {
    ctx = new Context();
    nyc = ctx.models.get(NewYorkCityCoin);
  });

  describe("mint()", () => {
    it("succeeds and mint desired amount of tokens", () => {
      const amount = 200;
      const recipient = ctx.accounts.get("wallet_2")!;

      // act
      const receipt = ctx.chain.mineBlock([nyc.mint(amount, recipient)])
        .receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);
      receipt.events.expectFungibleTokenMintEvent(
        amount,
        recipient.address,
        NewYorkCityCoin.TOKEN_NAME
      );
    });
  });

  describe("transfer()", () => {
    it("succeeds and transfer desired amount from one account to another", () => {
      const amount = 200;
      const from = ctx.accounts.get("wallet_2")!;
      const to = ctx.accounts.get("wallet_3")!;
      ctx.chain.mineBlock([nyc.mint(amount, from)]);

      // act
      const receipt = ctx.chain.mineBlock([
        nyc.transfer(amount, from, to, from),
      ]).receipts[0];

      // assert
      receipt.result.expectOk().expectBool(true);
      receipt.events.expectFungibleTokenTransferEvent(
        amount,
        from.address,
        to.address,
        NewYorkCityCoin.TOKEN_NAME
      );
    });
  });
});

run();
