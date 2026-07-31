/**
 * @uptime/core — the derivation engine.
 *
 * This package exists exactly once and is consumed by every client (web today,
 * mobile next). That is the whole point: uptime, runs and outages are derived,
 * never stored, and a second copy of this logic is a second answer to "how many
 * days have I been up" — which is the one question the product cannot get wrong.
 *
 * Nothing in here may import React, Next, React Native, or the DOM. The tsconfig
 * omits the "dom" lib deliberately, so that constraint fails the build rather
 * than the review.
 */

export * from "./uptime";
export * from "./monitor";
export * from "./grid";
export * from "./month";
export * from "./day";
export * from "./levers";
export * from "./push";
export * from "./signals";
export * from "./outbox";
