import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { keccak256, stringToHex } from "viem";
import {
  EIP712_NAME,
  EIP712_PRIMARY_TYPE,
  EIP712_TYPE_STRING,
  EIP712_TYPES,
  EIP712_VERSION,
  authorizationDomain,
  authorizationMessage,
  eip712TypeHash,
  imageHashFromUri,
} from "../src/utils/eip712Authorization.js";
import {
  AUTHORIZATION_WINDOW_SECONDS,
  buildIssuerAuthorization,
  defaultAuthorizationDeadline,
  formatAuthorizationPackage,
  snapshotFromCredential,
  validateAuthorizationDeadline,
} from "../src/utils/issuerAuthorization.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const sol = readFileSync(join(root, "contracts/SkillForgeCredential.sol"), "utf8");
const docs = readFileSync(join(root, "docs/AUTHORIZATION.md"), "utf8");

assert.equal(EIP712_NAME, "SkillForgeCredential");
assert.equal(EIP712_VERSION, "1");
assert.equal(EIP712_PRIMARY_TYPE, "Credential");
assert.equal(
  EIP712_TYPE_STRING,
  "Credential(address learner,uint256 totalPoints,uint256 puzzleMask,uint8 easyCorrect,uint8 mediumCorrect,uint8 hardCorrect,bytes32 imageHash,uint256 nonce,uint256 deadline)"
);
assert.equal(sol.includes(EIP712_TYPE_STRING), true);
assert.match(sol, /EIP712_NAME = "SkillForgeCredential"/);
assert.match(sol, /EIP712_VERSION = "1"/);
assert.equal(eip712TypeHash(), keccak256(stringToHex(EIP712_TYPE_STRING)));

const fields = EIP712_TYPES.Credential.map((item) => item.name);
assert.deepEqual(fields, [
  "learner",
  "totalPoints",
  "puzzleMask",
  "easyCorrect",
  "mediumCorrect",
  "hardCorrect",
  "imageHash",
  "nonce",
  "deadline",
]);
assert.equal(fields.includes("credentialId"), false);
assert.equal(EIP712_TYPE_STRING.includes("credentialId"), false);

const domain = authorizationDomain({
  chainId: 43113,
  verifyingContract: "0x3756be4955530Bba0844C4D2EcF35DB5ed7d90df",
});
assert.deepEqual(Object.keys(domain), ["name", "version", "chainId", "verifyingContract"]);
assert.equal(domain.name, EIP712_NAME);
assert.equal(domain.version, EIP712_VERSION);
assert.equal(domain.chainId, 43113);

const message = authorizationMessage({
  learner: "0x0000000000000000000000000000000000000001",
  totalPoints: 15n,
  puzzleMask: 1n,
  easyCorrect: 5,
  mediumCorrect: 0,
  hardCorrect: 0,
  imageData: "ipfs://art",
  nonce: 0n,
  deadline: 1n,
});
assert.equal(message.learner, "0x0000000000000000000000000000000000000001");
assert.equal(message.imageHash, imageHashFromUri("ipfs://art"));
assert.notEqual(message.imageHash, imageHashFromUri("ipfs://other"));

assert.match(docs, /name/);
assert.match(docs, /version/);
assert.match(docs, /chainId/);
assert.match(docs, /verifyingContract/);
assert.match(docs, /learner/);
assert.match(docs, /nonce/);
assert.match(docs, /deadline/);
assert.match(docs, /imageHash/);
assert.match(docs, /credentialId.*is \*\*not\*\* signed/);
assert.match(sol, /authorizationNonces\[msg\.sender\] = nonce \+ 1;/);
const consumeAt = sol.indexOf("authorizationNonces[msg.sender] = nonce + 1;");
const mintAt = sol.indexOf("_mintCredential(msg.sender, totalPoints, puzzleMask, easyCorrect, mediumCorrect, hardCorrect, imageData, true);");
assert.equal(consumeAt > 0 && mintAt > consumeAt, true);
assert.match(sol, /Ownable2Step/);
assert.match(sol, /MAX_POINTS = 80/);
assert.match(sol, /MAX_AUTHORIZATION_WINDOW = 7 days/);
assert.match(sol, /_mint\(learner, tokenId\)/);
assert.equal(sol.includes("_safeMint"), false);
assert.match(docs, /seven days/);
assert.match(docs, /per-learner nonce/);
assert.match(docs, /issuer pane/);
assert.match(docs, /does not mint/);

const issuerPage = readFileSync(join(root, "src/components/pages/IssuerPage.jsx"), "utf8");
const issuerHelper = readFileSync(join(root, "src/utils/issuerAuthorization.js"), "utf8");
assert.equal(issuerPage.includes("mintCredentialWithAuthorization"), false);
assert.equal(issuerHelper.includes("mintCredentialWithAuthorization"), false);
assert.equal(issuerPage.includes("sendTransaction"), false);
assert.equal(issuerHelper.includes("sendTransaction"), false);
assert.equal(issuerHelper.includes("writeContract"), false);
assert.equal(/privateKey|PRIVATE_KEY|mnemonic/i.test(issuerPage), false);
assert.match(issuerPage, /signTypedData/);

const now = 1_700_000_000;
const owner = "0x0000000000000000000000000000000000000002";
const learner = "0x0000000000000000000000000000000000000001";
const contract = "0x3756be4955530Bba0844C4D2EcF35DB5ed7d90df";
const built = buildIssuerAuthorization({
  learner,
  owner,
  signer: owner,
  totalPoints: 15,
  puzzleMask: 1,
  easyCorrect: 5,
  mediumCorrect: 0,
  hardCorrect: 0,
  imageData: "",
  nonce: 0,
  deadline: now + 3600,
  verifyingContract: contract,
  nowSeconds: now,
});
assert.equal(built.ok, true);
assert.equal(built.domain.name, EIP712_NAME);
assert.equal(built.domain.version, EIP712_VERSION);
assert.equal(built.domain.chainId, 43113);
assert.equal(built.domain.verifyingContract, contract);
assert.equal(built.primaryType, EIP712_PRIMARY_TYPE);
assert.equal(built.message.learner, learner);
assert.equal(built.message.imageHash, imageHashFromUri(""));
assert.equal(built.authorization.nonce, "0");
assert.equal(built.message.deadline, 1700003600n);
const packed = formatAuthorizationPackage(built.authorization, "0x" + "ab".repeat(65));
assert.match(packed, /"signature": "0xabab/);
assert.equal(JSON.parse(packed).learner, learner);

assert.equal(buildIssuerAuthorization({
  learner,
  owner,
  signer: learner,
  totalPoints: 15,
  puzzleMask: 1,
  easyCorrect: 5,
  mediumCorrect: 0,
  hardCorrect: 0,
  nonce: 0,
  deadline: now + 3600,
  verifyingContract: contract,
  nowSeconds: now,
}).ok, false);

assert.equal(validateAuthorizationDeadline(now + AUTHORIZATION_WINDOW_SECONDS + 1, now).ok, false);
assert.equal(validateAuthorizationDeadline(now, now).ok, false);
assert.equal(validateAuthorizationDeadline(now + 60, now).ok, true);
assert.equal(defaultAuthorizationDeadline(now), now + 24 * 60 * 60);
assert.equal(snapshotFromCredential(null), null);
assert.equal(snapshotFromCredential({
  score: { totalPoints: 15, easyCorrect: 5, mediumCorrect: 0, hardCorrect: 0 },
  puzzleMask: "1",
  image: "ipfs://art",
}).totalPoints, "15");

console.log("EIP-712 authorization model tests passed");
