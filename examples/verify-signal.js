// Verify a Z1N submitSignal tx without the indexer (ethers v6 + public RPC).
// NODE_PATH=/workspace/z1nwallet/node_modules node verify-signal.js [txHash]
"use strict";
const { ethers } = require("ethers");
const TX = process.argv[2] || "0x9f8e0ae3431832f7a8842f7505bd4334350422840753500fbc1b678c13ddd583";
const iface = new ethers.Interface([
  "function submitSignal(uint256 tokenId, bytes32 signalHash, string contentRef, uint8 symbolIndex, uint8 intent, bytes32 replyTo, uint64 clientTimestamp)",
]);
(async () => {
  const p = new ethers.JsonRpcProvider(process.env.POLYGON_RPC || "https://polygon.drpc.org", 137);
  const tx = await p.getTransaction(TX);
  if (!tx) throw new Error("tx not found");
  const { args: a } = iface.parseTransaction({ data: tx.data });
  const recomputed = ethers.keccak256(
    ethers.AbiCoder.defaultAbiCoder().encode(
      ["uint256", "string", "uint8", "uint8", "bytes32", "uint64"],
      [a.tokenId, a.contentRef, a.symbolIndex, a.intent, a.replyTo, a.clientTimestamp]
    )
  );
  const match = recomputed.toLowerCase() === a.signalHash.toLowerCase();
  console.log({ tx: TX, tokenId: a.tokenId.toString(), contentRef: a.contentRef,
    symbolIndex: Number(a.symbolIndex), intent: Number(a.intent), replyTo: a.replyTo,
    clientTimestamp: a.clientTimestamp.toString(), calldataSignalHash: a.signalHash,
    recomputedSignalHash: recomputed, match });
  if (!match) process.exit(2);
})().catch((e) => { console.error(e.message || e); process.exit(1); });
