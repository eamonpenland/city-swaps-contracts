import {
  describe,
  beforeEach,
  it,
  run,
  Account,
  assertNotEquals,
  assertEquals,
  types,
} from "../deps.ts";
import { Proposal } from "../models/proposal.model.ts";
import { MiamiCoin } from "../models/miamicoin.model.ts";
import { NewYorkCityCoin } from "../models/newyorkcitycoin.model.ts";
import { Context } from "../src/context.ts";

describe("[PROPOSE]", () => {
  let ctx: Context;
  let proposal: Proposal;
  let mia: MiamiCoin;
  let nyc: NewYorkCityCoin;
  let creator: Account;
  let funder: Account;
  let deployer: Account;

  beforeEach(() => {
    ctx = new Context();
    proposal = ctx.models.get(Proposal);
    mia = ctx.models.get(MiamiCoin);
    nyc = ctx.models.get(NewYorkCityCoin);
    creator = ctx.accounts.get("wallet_1")!;
    funder = ctx.accounts.get("wallet_2")!;
    deployer = ctx.accounts.get("deployer")!;
  });

  const category = "health";

  const hash = new TextEncoder().encode(
    "CF80CD8AED482D5D1527D7DC72FCEFF84E6326592848447D2DC0B0E87DFC9A90"
  );
  const hash2 = new TextEncoder().encode(
    "CF80CD8AED482D5D1527D7DC72FCEFF84E6326592848447D2DC0B0E87DFC9A99"
  );

  describe("create()", () => {
    it("succeeds and creates one proposal", () => {
      const receipt = ctx.chain.mineBlock([
        proposal.setCoin(deployer, mia.address),
        proposal.create(creator, mia.address, hash, category),
      ]).receipts[0];

      receipt.result.expectOk();
      proposal.getProposalCount().expectUint(1);
    });

    it("throws an error if coin is not supported", () => {
      const receipt = ctx.chain.mineBlock([
        proposal.create(creator, mia.address, hash, category),
      ]).receipts[0];

      receipt.result
        .expectErr()
        .expectUint(Proposal.Err.ERR_COIN_NOT_SUPPORTED);
    });
  });

  describe("edit()", () => {
    it("succeeds and edits one proposal", () => {
      ctx.chain.mineBlock([
        proposal.setCoin(deployer, mia.address),
        proposal.create(creator, mia.address, hash, category),
      ]);
      ctx.chain.mineBlock([proposal.edit(creator, 0, hash)]);
      proposal.getProposalCount().expectUint(1);
    });

    it("returns correct error code if editor is not the creator", () => {
      const editor = ctx.accounts.get("wallet_2")!;
      ctx.chain.mineBlock([
        proposal.setCoin(deployer, mia.address),
        proposal.create(creator, mia.address, hash, category),
      ]);
      const receipt = ctx.chain.mineBlock([proposal.edit(editor, 0, hash)])
        .receipts[0];

      receipt.result.expectErr().expectUint(Proposal.Err.ERR_UNAUTHORIZED);
    });

    it("returns correct error code if proposal not found", () => {
      const receipt = ctx.chain.mineBlock([proposal.edit(creator, 0, hash)])
        .receipts[0];

      receipt.result
        .expectErr()
        .expectUint(Proposal.Err.ERR_PROPOSAL_NOT_FOUND);
    });

    it("updates proposal hash", () => {
      ctx.chain.mineBlock([
        proposal.setCoin(deployer, mia.address),
        proposal.create(creator, mia.address, hash, category),
      ]);
      const initialProposal = proposal.getProposal(0);
      ctx.chain.mineBlock([proposal.edit(creator, 0, hash2)]);
      const editedProposal = proposal.getProposal(0);

      assertNotEquals(initialProposal, editedProposal);
    });
  });

  describe("fund()", () => {
    it("succeeds and transfers tokens", () => {
      const amount = 200;

      ctx.chain.mineBlock([
        proposal.setCoin(deployer, mia.address),
        proposal.create(creator, mia.address, hash, category),
        mia.mint(amount, funder),
      ]);

      const receipt = ctx.chain.mineBlock([
        proposal.fund(funder, mia.address, 0, 100),
      ]).receipts[0];

      // Transfer to proposal creator
      receipt.events.expectFungibleTokenTransferEvent(
        99,
        funder.address,
        creator.address,
        MiamiCoin.TOKEN_NAME
      );

      // Transfer to contract owner
      receipt.events.expectFungibleTokenTransferEvent(
        1,
        funder.address,
        proposal.address,
        MiamiCoin.TOKEN_NAME
      );
    });

    it("throws an error if user doesn't have enough city coins for proposal", () => {
      // fee is 1% so minting 1 less than amount - fee
      const amount = 98;

      ctx.chain.mineBlock([
        proposal.setCoin(deployer, mia.address),
        proposal.create(creator, mia.address, hash, category),
        mia.mint(amount, funder),
      ]);

      const receipt = ctx.chain.mineBlock([
        proposal.fund(funder, mia.address, 0, 100),
      ]).receipts[0];

      receipt.result
        .expectErr()
        .expectUint(Proposal.Err.ERR_INSUFFICIENT_FUNDS);
    });

    it("throws an error if user doesn't have enough city coins for fees", () => {
      // fee is 1% so minting amount - fee
      const amount = 99;

      ctx.chain.mineBlock([
        proposal.setCoin(deployer, mia.address),
        proposal.create(creator, mia.address, hash, category),
        mia.mint(amount, funder),
      ]);

      const receipt = ctx.chain.mineBlock([
        proposal.fund(funder, mia.address, 0, 100),
      ]).receipts[0];

      receipt.result
        .expectErr()
        .expectUint(Proposal.Err.ERR_FEE_TRANSFER_FAILED);
    });

    it("doesn't allow funding for non supported city coins", () => {
      const amount = 100;

      ctx.chain.mineBlock([
        proposal.setCoin(deployer, nyc.address),
        proposal.create(creator, nyc.address, hash, category),
        nyc.mint(amount, funder),
      ]);

      const receipt = ctx.chain.mineBlock([
        proposal.fund(funder, mia.address, 0, 100),
      ]).receipts[0];

      receipt.result
        .expectErr()
        .expectUint(Proposal.Err.ERR_COIN_NOT_SUPPORTED);
    });

    it("throws an error if user tries to fund with another city coin", () => {
      const amount = 100;
      ctx.chain.mineBlock([
        proposal.setCoin(deployer, mia.address),
        proposal.setCoin(deployer, nyc.address),
        proposal.create(creator, mia.address, hash, category),
        nyc.mint(amount, funder),
      ]);
      const receipt = ctx.chain.mineBlock([
        proposal.fund(funder, nyc.address, 0, 100),
      ]).receipts[0];

      receipt.result
        .expectErr()
        .expectUint(Proposal.Err.ERR_INCORRECT_FUNDING_SOURCE);
    });

    it("throws an error if proposal doesn't exist", () => {
      const receipt = ctx.chain.mineBlock([
        proposal.fund(funder, nyc.address, 1, 100),
      ]).receipts[0];

      receipt.result
        .expectErr()
        .expectUint(Proposal.Err.ERR_PROPOSAL_NOT_FOUND);
    });

    it("throws an error if proposal isn't active", () => {
      const amount = 200;

      ctx.chain.mineBlock([
        proposal.setCoin(deployer, mia.address),
        proposal.create(creator, mia.address, hash, category),
        mia.mint(amount, funder),
        proposal.toggleActive(creator, 0),
      ]);

      const receipt = ctx.chain.mineBlock([
        proposal.fund(funder, mia.address, 0, 100),
      ]).receipts[0];

      receipt.result.expectErr().expectUint(Proposal.Err.ERR_INACTIVE_PROPOSAL);
    });

    it("updates funding stats", () => {
      const amount = 200;

      ctx.chain.mineBlock([
        proposal.setCoin(deployer, mia.address),
        proposal.create(creator, mia.address, hash, category),
        mia.mint(amount, funder),
      ]);

      ctx.chain.mineBlock([proposal.fund(funder, mia.address, 0, 100)]);

      const stats = proposal.getFundingStats(mia.address, 2);

      assertEquals(stats, types.uint(99));
    });
  });

  describe("set-fee-rate()", () => {});

  describe("set-token()", () => {
    it("sets token if is deployer", () => {
      const receipt = ctx.chain.mineBlock([
        proposal.setCoin(deployer, nyc.address),
      ]).receipts[0];
      receipt.result.expectOk();
    });

    it("throws an error if caller isn't deployer", () => {
      const receipt = ctx.chain.mineBlock([
        proposal.setCoin(creator, nyc.address),
      ]).receipts[0];
      receipt.result.expectErr();
    });
  });
});

run();
