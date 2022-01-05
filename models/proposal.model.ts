import { Account, types } from "../deps.ts";
import { Model } from "../src/model.ts";

enum Err {
  ERR_UNAUTHORIZED = 401,
  ERR_PROPOSAL_NOT_FOUND = 1000,
  ERR_INVALID_VALUE = 1001,
  ERR_INSUFFICIENT_FUNDS = 1002,
  ERR_FEE_TRANSFER_FAILED = 1003,
  ERR_COIN_NOT_SUPPORTED = 1004,
  ERR_INCORRECT_FUNDING_SOURCE = 1005,
  ERR_INACTIVE_PROPOSAL = 1006,
}

export class Proposal extends Model {
  name: string = "proposal";
  static Err = Err;

  create(creator: Account, token: string, hash: Uint8Array, category: string) {
    return this.callPublic(
      "create",
      [types.principal(token), types.buff(hash), types.ascii(category)],
      creator
    );
  }

  edit(editor: Account, proposalId: number, hash: Uint8Array) {
    return this.callPublic(
      "edit",
      [types.uint(proposalId), types.buff(hash)],
      editor
    );
  }

  toggleActive(editor: Account, proposalId: number) {
    return this.callPublic("toggle-active", [types.uint(proposalId)], editor);
  }

  fund(funder: Account, token: string, proposalId: number, amount: number) {
    return this.callPublic(
      "fund",
      [types.principal(token), types.uint(proposalId), types.uint(amount)],
      funder
    );
  }

  setFeeRate(owner: Account, fee: number) {
    return this.callPublic("set-fee-rate", [types.uint(fee)], owner);
  }

  getFeeRate() {
    return this.callReadOnly("get-fee-rate").result;
  }

  getProposal(proposalId: number) {
    return this.callReadOnly("get-proposal", [types.uint(proposalId)]).result;
  }

  getProposalCount() {
    return this.callReadOnly("get-proposal-count").result;
  }

  setCoin(owner: Account, token: string) {
    return this.callPublic("set-token", [types.principal(token)], owner);
  }

  getCoin(token: string) {
    return this.callReadOnly("get-coin-or-err", [types.principal(token)])
      .result;
  }

  getCategoryStats(token: string, block: number, category: string) {
    return this.callReadOnly("get-category-stats-at-block-or-default", [
      types.principal(token),
      types.uint(block),
      types.ascii(category),
    ]).result;
  }

  getFundingStats(token: string, block: number) {
    return this.callReadOnly("get-funding-stats-at-block-or-default", [
      types.principal(token),
      types.uint(block),
    ]).result;
  }
}

export interface Proposal {
  poster: string;
  category: string;
  token: string;
  funded_amount: number;
  hash: string;
  active: boolean;
}
