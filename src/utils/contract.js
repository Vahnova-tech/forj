import { encodeFunctionData } from "viem";
import { matchingWalletAccount, parseContractAddress, readPublicEnv, validateMintParams } from "./frontendSecurity.js";
import { FUJI_CHAIN_ID, parseChainId } from "./wallet.js";

export const CREDENTIAL_ABI = [
  {
    inputs: [
      { name: "totalPoints", type: "uint256" },
      { name: "puzzleMask", type: "uint256" },
      { name: "easyCorrect", type: "uint8" },
      { name: "mediumCorrect", type: "uint8" },
      { name: "hardCorrect", type: "uint8" },
      { name: "imageData", type: "string" },
    ],
    name: "mintCredential",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "totalPoints", type: "uint256" },
      { name: "puzzleMask", type: "uint256" },
      { name: "easyCorrect", type: "uint8" },
      { name: "mediumCorrect", type: "uint8" },
      { name: "hardCorrect", type: "uint8" },
      { name: "imageData", type: "string" },
      { name: "deadline", type: "uint256" },
      { name: "signature", type: "bytes" },
    ],
    name: "mintCredentialWithAuthorization",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [{ name: "user", type: "address" }],
    name: "credentialOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "credentials",
    outputs: [
      { name: "totalPoints", type: "uint256" },
      { name: "puzzleMask", type: "uint256" },
      { name: "easyCorrect", type: "uint8" },
      { name: "mediumCorrect", type: "uint8" },
      { name: "hardCorrect", type: "uint8" },
      { name: "image", type: "string" },
      { name: "mintedAt", type: "uint256" },
      { name: "attested", type: "bool" },
    ],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "tokenURI",
    outputs: [{ name: "", type: "string" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "tokenId", type: "uint256" }],
    name: "ownerOf",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [],
    name: "owner",
    outputs: [{ name: "", type: "address" }],
    stateMutability: "view",
    type: "function",
  },
  {
    inputs: [{ name: "learner", type: "address" }],
    name: "authorizationNonces",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
];

export const CONTRACT_ADDRESS = parseContractAddress(readPublicEnv("VITE_CREDENTIAL_CONTRACT"));
export const FUJI_EXPLORER_TX = "https://testnet.snowtrace.io/tx/";
export const FUJI_EXPLORER_TOKEN = "https://testnet.snowtrace.io/token/";
export { FUJI_CHAIN_ID };

export function buildMintData({
  totalPoints,
  puzzleMask,
  easyCorrect,
  mediumCorrect,
  hardCorrect,
  imageData = "",
}) {
  const checked = validateMintParams({
    totalPoints,
    puzzleMask,
    easyCorrect,
    mediumCorrect,
    hardCorrect,
    imageData,
  });
  if (!checked.ok) {
    throw new Error(checked.error);
  }
  const { values } = checked;
  return encodeFunctionData({
    abi: CREDENTIAL_ABI,
    functionName: "mintCredential",
    args: [
      BigInt(values.totalPoints),
      BigInt(values.puzzleMask),
      values.easyCorrect,
      values.mediumCorrect,
      values.hardCorrect,
      values.imageData,
    ],
  });
}

export function prepareClaimedMint({
  account,
  expectedAccount,
  chainId,
  totalPoints,
  puzzleMask,
  easyCorrect,
  mediumCorrect,
  hardCorrect,
  imageData = "",
}) {
  if (!CONTRACT_ADDRESS) {
    return { ok: false, error: "The credential contract is not available yet." };
  }
  const from = matchingWalletAccount(account, expectedAccount);
  if (!from) {
    return { ok: false, error: "The connected wallet does not match this session." };
  }
  if (parseChainId(chainId) !== FUJI_CHAIN_ID) {
    return { ok: false, error: "Switch your wallet to Avalanche Fuji before minting." };
  }
  try {
    return {
      ok: true,
      to: CONTRACT_ADDRESS,
      account: from,
      value: 0n,
      data: buildMintData({
        totalPoints,
        puzzleMask,
        easyCorrect,
        mediumCorrect,
        hardCorrect,
        imageData,
      }),
    };
  } catch (err) {
    return { ok: false, error: err?.message || "Mint parameters are invalid." };
  }
}

export function puzzleToMask(acquiredPieces) {
  return acquiredPieces.reduce((mask, index) => mask | (1 << index), 0);
}

export function maskToPieces(mask) {
  const pieces = [];
  for (let i = 0; i < 16; i++) {
    if (mask & (1 << i)) pieces.push(i);
  }
  return pieces;
}
