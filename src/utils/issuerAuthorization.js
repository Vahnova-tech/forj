/**
 * Typed data for an owner-signed credential authorization.
 * Produces a signature package only. It does not submit a transaction.
 */
import { CONTRACT_ADDRESS, CREDENTIAL_ABI } from "./contract.js";
import { mapOnChainCredential } from "./credential.js";
import {
  EIP712_PRIMARY_TYPE,
  EIP712_TYPES,
  authorizationDomain,
  authorizationMessage,
} from "./eip712Authorization.js";
import { validateMintParams } from "./frontendSecurity.js";
import { normalizeAddress } from "./progress.js";
import { FUJI_CHAIN_ID } from "./wallet.js";

export const AUTHORIZATION_WINDOW_SECONDS = 7 * 24 * 60 * 60;
export const DEFAULT_AUTHORIZATION_TTL_SECONDS = 24 * 60 * 60;

export function defaultAuthorizationDeadline(nowSeconds = Math.floor(Date.now() / 1000)) {
  return nowSeconds + DEFAULT_AUTHORIZATION_TTL_SECONDS;
}

export function sameWallet(left, right) {
  const a = normalizeAddress(left);
  const b = normalizeAddress(right);
  return Boolean(a && b && a === b);
}

export function validateAuthorizationDeadline(deadline, nowSeconds = Math.floor(Date.now() / 1000)) {
  const value = typeof deadline === "bigint" ? Number(deadline) : Number(deadline);
  if (!Number.isInteger(value) || value <= nowSeconds) {
    return { ok: false, error: "Deadline must be in the future." };
  }
  if (value > nowSeconds + AUTHORIZATION_WINDOW_SECONDS) {
    return { ok: false, error: "Deadline must be within seven days." };
  }
  return { ok: true, deadline: value };
}

function parseNonce(value) {
  try {
    const nonce = typeof value === "bigint" ? value : BigInt(String(value ?? "").trim());
    if (nonce < 0n) return null;
    return nonce;
  } catch {
    return null;
  }
}

export function snapshotFromCredential(credential) {
  if (!credential) return null;
  const score = credential.score || {};
  return {
    totalPoints: String(score.totalPoints ?? credential.totalPoints ?? ""),
    puzzleMask: String(credential.puzzleMask ?? ""),
    easyCorrect: String(score.easyCorrect ?? credential.easyCorrect ?? ""),
    mediumCorrect: String(score.mediumCorrect ?? credential.mediumCorrect ?? ""),
    hardCorrect: String(score.hardCorrect ?? credential.hardCorrect ?? ""),
    imageData: String(credential.image || credential.imageUri || ""),
  };
}

export function buildIssuerAuthorization({
  learner,
  owner,
  signer,
  totalPoints,
  puzzleMask,
  easyCorrect,
  mediumCorrect,
  hardCorrect,
  imageData = "",
  nonce,
  deadline,
  verifyingContract = CONTRACT_ADDRESS,
  nowSeconds = Math.floor(Date.now() / 1000),
} = {}) {
  const contract = typeof verifyingContract === "string" ? verifyingContract.trim() : "";
  if (!/^0x[a-fA-F0-9]{40}$/.test(contract)) {
    return { ok: false, error: "The credential contract is not available yet." };
  }
  if (!sameWallet(signer, owner)) {
    return { ok: false, error: "Connect the contract owner wallet to sign." };
  }
  const learnerAddress = normalizeAddress(learner);
  if (!learnerAddress) {
    return { ok: false, error: "Enter a learner wallet address." };
  }
  const checked = validateMintParams({
    totalPoints,
    puzzleMask,
    easyCorrect,
    mediumCorrect,
    hardCorrect,
    imageData,
  });
  if (!checked.ok) return checked;
  const deadlineCheck = validateAuthorizationDeadline(deadline, nowSeconds);
  if (!deadlineCheck.ok) return deadlineCheck;
  const nonceValue = parseNonce(nonce);
  if (nonceValue == null) {
    return { ok: false, error: "Learner nonce is unavailable. Look up the wallet again." };
  }

  const { values } = checked;
  const message = authorizationMessage({
    learner: learnerAddress,
    totalPoints: BigInt(values.totalPoints),
    puzzleMask: BigInt(values.puzzleMask),
    easyCorrect: values.easyCorrect,
    mediumCorrect: values.mediumCorrect,
    hardCorrect: values.hardCorrect,
    imageData: values.imageData,
    nonce: nonceValue,
    deadline: BigInt(deadlineCheck.deadline),
  });

  const authorization = {
    learner: learnerAddress,
    totalPoints: String(values.totalPoints),
    puzzleMask: String(values.puzzleMask),
    easyCorrect: values.easyCorrect,
    mediumCorrect: values.mediumCorrect,
    hardCorrect: values.hardCorrect,
    imageData: values.imageData,
    nonce: nonceValue.toString(),
    deadline: String(deadlineCheck.deadline),
  };

  return {
    ok: true,
    domain: authorizationDomain({
      chainId: FUJI_CHAIN_ID,
      verifyingContract: contract,
    }),
    types: EIP712_TYPES,
    primaryType: EIP712_PRIMARY_TYPE,
    message,
    authorization,
  };
}

export function formatAuthorizationPackage(authorization, signature) {
  return JSON.stringify({
    learner: authorization.learner,
    totalPoints: authorization.totalPoints,
    puzzleMask: authorization.puzzleMask,
    easyCorrect: authorization.easyCorrect,
    mediumCorrect: authorization.mediumCorrect,
    hardCorrect: authorization.hardCorrect,
    imageData: authorization.imageData,
    nonce: authorization.nonce,
    deadline: authorization.deadline,
    signature,
  }, null, 2);
}

export async function readContractOwner(publicClient, contractAddress = CONTRACT_ADDRESS) {
  if (!publicClient || !contractAddress) return "";
  const owner = await publicClient.readContract({
    address: contractAddress,
    abi: CREDENTIAL_ABI,
    functionName: "owner",
  });
  return normalizeAddress(owner) || "";
}

export async function readLearnerAuthorizationContext(publicClient, learnerAddress, contractAddress = CONTRACT_ADDRESS) {
  const learner = normalizeAddress(learnerAddress);
  if (!publicClient || !contractAddress) {
    return { ok: false, error: "The credential contract is not available yet." };
  }
  if (!learner) return { ok: false, error: "Enter a learner wallet address." };

  const [tokenId, nonce] = await Promise.all([
    publicClient.readContract({
      address: contractAddress,
      abi: CREDENTIAL_ABI,
      functionName: "credentialOf",
      args: [learner],
    }),
    publicClient.readContract({
      address: contractAddress,
      abi: CREDENTIAL_ABI,
      functionName: "authorizationNonces",
      args: [learner],
    }),
  ]);

  let credential = null;
  if (tokenId && tokenId !== 0n) {
    const data = await publicClient.readContract({
      address: contractAddress,
      abi: CREDENTIAL_ABI,
      functionName: "credentials",
      args: [tokenId],
    });
    credential = mapOnChainCredential(tokenId, data, contractAddress);
  }

  return {
    ok: true,
    learner,
    nonce: nonce.toString(),
    credential,
  };
}
