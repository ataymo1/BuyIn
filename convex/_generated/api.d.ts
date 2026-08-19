/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as auth from "../auth.js";
import type * as games from "../games.js";
import type * as groups from "../groups.js";
import type * as helpers from "../helpers.js";
import type * as migrations from "../migrations.js";
import type * as player_claims from "../player_claims.js";
import type * as player_merges from "../player_merges.js";
import type * as players from "../players.js";
import type * as poker_now_imports from "../poker_now_imports.js";
import type * as seasons from "../seasons.js";
import type * as stats from "../stats.js";
import type * as transactions from "../transactions.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  auth: typeof auth;
  games: typeof games;
  groups: typeof groups;
  helpers: typeof helpers;
  migrations: typeof migrations;
  player_claims: typeof player_claims;
  player_merges: typeof player_merges;
  players: typeof players;
  poker_now_imports: typeof poker_now_imports;
  seasons: typeof seasons;
  stats: typeof stats;
  transactions: typeof transactions;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
