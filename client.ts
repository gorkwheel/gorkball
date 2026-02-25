/**
 * On-chain client — wraps Anchor program interactions.
 */

import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
  SYSVAR_RENT_PUBKEY,
} from "@solana/web3.js";
import {
  AnchorProvider,
  Program,
  Wallet,
  BN,
  web3,
} from "@coral-xyz/anchor";
import { logger } from "./logger";
import IDL from "../idl/gorkwheel_program.json";

export interface GlobalStateData {
  admin: PublicKey;
  keeper: PublicKey;
  paused: boolean;
  lastUpdateTs: number;
  globalRewardIndex: bigint;
  usdcMint: PublicKey;
  rewardVault: PublicKey;
  maxPerMinute: number;
  maxPerDay: number;
  dailyDistributed: number;
  dayStartTs: number;
  bump: number;
}

export class GorkwheelClient {
  private program: Program;
  private globalStatePda: PublicKey;
  private globalStateBump: number;

  constructor(
    private connection: Connection,
    private keeper: Keypair,
    programId: PublicKey
  ) {
    const wallet = new Wallet(keeper);
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
      preflightCommitment: "confirmed",
    });
    this.program = new Program(IDL as any, programId, provider);
    [this.globalStatePda, this.globalStateBump] = PublicKey.findProgramAddressSync(
      [Buffer.from("global_state")],
      programId
    );
  }

  async fetchGlobalState(): Promise<GlobalStateData> {
    const raw = await (this.program.account as any).globalState.fetch(
      this.globalStatePda
    );
    return {
      admin: raw.admin,
      keeper: raw.keeper,
      paused: raw.paused,
      lastUpdateTs: raw.lastUpdateTs.toNumber(),
      globalRewardIndex: BigInt(raw.globalRewardIndex.toString()),
      usdcMint: raw.usdcMint,
      rewardVault: raw.rewardVault,
      maxPerMinute: raw.maxPerMinute.toNumber(),
      maxPerDay: raw.maxPerDay.toNumber(),
      dailyDistributed: raw.dailyDistributed.toNumber(),
      dayStartTs: raw.dayStartTs.toNumber(),
      bump: raw.bump,
    };
  }

  async getVaultBalance(rewardVault: PublicKey): Promise<number> {
    const balance = await this.connection.getTokenAccountBalance(rewardVault);
    return Number(balance.value.amount);
  }

  async updateIndex(
    amountUsdc: number,
    gorkMint: PublicKey,
    dryRun: boolean
  ): Promise<string | null> {
    if (dryRun) {
      logger.info(`[DRY RUN] Would call update_index(amount=${amountUsdc})`);
      return null;
    }

    const tx = await (this.program.methods as any)
      .updateIndex(new BN(amountUsdc))
      .accounts({
        caller: this.keeper.publicKey,
        globalState: this.globalStatePda,
        gorkMint,
      })
      .signers([this.keeper])
      .rpc({ commitment: "confirmed" });

    return tx;
  }

  get programId(): PublicKey {
    return this.program.programId;
  }

  get keeperPublicKey(): PublicKey {
    return this.keeper.publicKey;
  }
}
