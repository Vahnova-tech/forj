# Issuer attestation

Issuer-attested credentials exist so a claimed score can later be **authorized**, not so the app can call every mint “verified.”

The learner UI still publishes **self-claimed** records. Attestation is a separate, privileged path: the contract owner signs a precise authorization; the learner (or a permitted submitter) then mints with that signature.

## Intent

- Bind the authorization to **this** SkillForgeCredential contract on **this** chain. A signature for another chain or another SkillForgeCredential contract does not mint here.  
- Bind it to one learner, one score snapshot, one puzzle mask, and one artwork hash. Another wallet cannot submit that signature.  
- Use it once. A second use of the same authorization fails.  
- Expire it. After the deadline it is no longer valid. An authorization cannot reach more than seven days into the future.  
- Use a per-learner nonce so a valid signature cannot be replayed.  
- If the issuer key is handed off, the new owner must accept it. A pending owner cannot attest until they accept. The issuer role cannot be abandoned. Old signatures from the previous owner do not authorize new mints.

The credential ID is assigned at mint. The signature authorizes the **content**, not a pre-chosen token number. `credentialId` is **not** signed.

Signed domain: `name`, `version`, `chainId`, `verifyingContract`. Signed payload includes `learner`, score snapshot, puzzle mask, `imageHash`, `nonce`, and `deadline`.

## Privileged roles

| Role | What they can do |
| --- | --- |
| Learner | Publish a **claimed** score to their own wallet |
| Issuer (contract owner) | Sign an attested authorization; hand the issuer role to a new owner who must accept it |
| Public | Open a shareable token URL. Looking it up does not attest a score |

A pending owner cannot attest until they accept. The issuer role cannot be abandoned. Signing keys never live in the learner browser.

## Threat model

Anyone can publish a claimed record within the score caps. That is self-publication, not an exam. Attested mint without the current owner’s signature fails. A used, expired, or wrong-chain / wrong-contract signature fails. The token cannot be transferred. App XP is not the credential. A stolen issuer key could attest until the owner completes a two-step handoff. This version has no pause. Already-minted tokens stay claimed or attested as minted. Claimed mint cannot be switched off on-chain.

Revocation, issuer organizations, and treating a claimed score as independently assessed are out of scope for this version.

## What a signature is not

It is not a degree, a proctored exam, or a general Avalanche certification. It is an on-chain statement that the issuer’s key authorized that score record.

Product copy must keep **claimed** and **attested** distinct. See [Credential](./CREDENTIAL.md).

## Relationship to the learner app

Learning, XP, and the puzzle can happen before a wallet is connected. Attestation only applies when an issuer chooses to sign and a mint uses that signature. Signing keys never live in the learner browser. The contract owner can open an issuer pane, review a learner snapshot, and sign that authorization with their wallet. The pane shows the signature for copy. It does not mint, and it does not replace the current token. The learner flow still cannot submit the signature. Wallet addresses, the credential contract, and mint scores are checked in the app before a transaction is sent. Any minted record from the learner flow remains claimed.

Issuer organizations, attested mint in the learner flow, and revocation are planned. They do not change the meaning of a claimed score.
