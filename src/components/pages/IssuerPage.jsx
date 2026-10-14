import { useMemo, useState } from "react";
import { CONTRACT_ADDRESS } from "../../utils/contract.js";
import { getFujiPublicClient } from "../../utils/fujiClient.js";
import {
  buildIssuerAuthorization,
  defaultAuthorizationDeadline,
  formatAuthorizationPackage,
  readContractOwner,
  readLearnerAuthorizationContext,
  snapshotFromCredential,
} from "../../utils/issuerAuthorization.js";
import { resolveCredentialStatus } from "../../utils/credentialStatus.js";
import { Button, Card } from "../ui/primitives";

function toDatetimeLocal(seconds) {
  const date = new Date(Number(seconds) * 1000);
  const pad = (value) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromDatetimeLocal(value) {
  const ms = Date.parse(value);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

function emptySnapshot() {
  return {
    totalPoints: "",
    puzzleMask: "",
    easyCorrect: "",
    mediumCorrect: "",
    hardCorrect: "",
    imageData: "",
  };
}

export default function IssuerPage({
  signerAddress,
  getWalletClient,
  switchToFuji,
  onBack,
}) {
  const [learner, setLearner] = useState("");
  const [snapshot, setSnapshot] = useState(emptySnapshot);
  const [nonce, setNonce] = useState("");
  const [deadline, setDeadline] = useState(() => defaultAuthorizationDeadline());
  const [current, setCurrent] = useState(null);
  const [lookedUp, setLookedUp] = useState(false);
  const [packageText, setPackageText] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const status = useMemo(
    () => (current ? resolveCredentialStatus(current) : null),
    [current]
  );

  function setField(key, value) {
    setSnapshot((prev) => ({ ...prev, [key]: value }));
    setPackageText("");
  }

  async function lookup(event) {
    event?.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    setPackageText("");
    try {
      const result = await readLearnerAuthorizationContext(getFujiPublicClient(), learner);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLearner(result.learner);
      setNonce(result.nonce);
      setCurrent(result.credential);
      setLookedUp(true);
      const next = snapshotFromCredential(result.credential);
      setSnapshot(next || emptySnapshot());
      setMessage(result.credential
        ? "Current Fuji token loaded. The signature will not replace it."
        : "No current token for this wallet. Enter the snapshot to authorize.");
    } catch (err) {
      setError(err?.shortMessage || err?.message || "Could not read the learner credential.");
    } finally {
      setBusy(false);
    }
  }

  async function sign() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await switchToFuji?.();
      const fresh = await readLearnerAuthorizationContext(getFujiPublicClient(), learner);
      if (!fresh.ok) throw new Error(fresh.error);
      if (fresh.nonce !== nonce) {
        setNonce(fresh.nonce);
        throw new Error("The learner nonce changed. Review it, then sign again.");
      }
      const client = await getWalletClient();
      const [account] = await client.getAddresses();
      const owner = await readContractOwner(getFujiPublicClient());
      const built = buildIssuerAuthorization({
        learner: fresh.learner,
        owner,
        signer: account,
        ...snapshot,
        nonce: fresh.nonce,
        deadline,
        verifyingContract: CONTRACT_ADDRESS,
      });
      if (!built.ok) throw new Error(built.error);
      if (signerAddress && account && account.toLowerCase() !== String(signerAddress).toLowerCase()) {
        throw new Error("Connect the contract owner wallet to sign.");
      }
      const signature = await client.signTypedData({
        account,
        domain: built.domain,
        types: built.types,
        primaryType: built.primaryType,
        message: built.message,
      });
      setPackageText(formatAuthorizationPackage(built.authorization, signature));
      setMessage("Authorization signed. This does not mint a credential.");
    } catch (err) {
      setError(err?.displayMessage || err?.shortMessage || err?.message || "Could not sign the authorization.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPackage() {
    if (!packageText) return;
    try {
      await navigator.clipboard.writeText(packageText);
      setMessage("Authorization copied.");
    } catch {
      setError("Could not copy the authorization.");
    }
  }

  return (
    <div className="page issuer-page">
      <header className="page-header">
        <p className="kicker">Issuer</p>
        <h1>Sign an authorization</h1>
        <p className="lede">
          Review a learner snapshot and sign it with the contract owner wallet.
          The signing key stays in the wallet. This page does not mint, and it does not
          replace the current token. The learner flow cannot submit this signature yet.
        </p>
        <div className="quiz-nav">
          <Button variant="secondary" onClick={onBack}>Back</Button>
        </div>
        {message ? <p className="meta-line" role="status">{message}</p> : null}
        {error ? <p className="meta-line feedback-banner-alert" role="alert">{error}</p> : null}
      </header>

      <Card className="section-block">
        <form className="settings-form" onSubmit={lookup}>
          <label className="auth-field" htmlFor="issuer-learner">
            <span>Learner wallet</span>
            <input
              id="issuer-learner"
              value={learner}
              onChange={(event) => {
                setLearner(event.target.value);
                setLookedUp(false);
                setPackageText("");
              }}
              autoComplete="off"
              spellCheck="false"
              placeholder="0x…"
            />
          </label>
          <Button type="submit" disabled={busy || !learner.trim()}>
            {busy ? "Working…" : "Look up"}
          </Button>
        </form>
      </Card>

      {lookedUp ? (
        <Card className="section-block">
          <h2>Current token</h2>
          {current && status ? (
            <>
              <p className="meta-line">{status.label}</p>
              <p className="note">
                Token {current.credentialId}. This record stays {status.label} until a later mint uses an authorization. This page does not send that mint.
              </p>
            </>
          ) : (
            <p className="note">No Fuji token is current for this wallet.</p>
          )}
        </Card>
      ) : null}

      <Card className="section-block">
        <h2>Authorization snapshot</h2>
        <p className="note">
          These are the scores the owner signature will cover. A claimed record stays Forjora claimed until a separate mint uses the signature.
        </p>
        <div className="settings-form">
          {[
            ["totalPoints", "Total points"],
            ["puzzleMask", "Puzzle mask"],
            ["easyCorrect", "Easy correct"],
            ["mediumCorrect", "Medium correct"],
            ["hardCorrect", "Hard correct"],
          ].map(([key, label]) => (
            <label className="auth-field" htmlFor={`issuer-${key}`} key={key}>
              <span>{label}</span>
              <input
                id={`issuer-${key}`}
                inputMode="numeric"
                value={snapshot[key]}
                onChange={(event) => setField(key, event.target.value)}
              />
            </label>
          ))}
          <label className="auth-field" htmlFor="issuer-image">
            <span>Artwork URI</span>
            <input
              id="issuer-image"
              value={snapshot.imageData}
              onChange={(event) => setField("imageData", event.target.value)}
              placeholder="ipfs:// or https://"
              spellCheck="false"
            />
          </label>
          <label className="auth-field" htmlFor="issuer-deadline">
            <span>Deadline</span>
            <input
              id="issuer-deadline"
              type="datetime-local"
              value={toDatetimeLocal(deadline)}
              onChange={(event) => {
                const next = fromDatetimeLocal(event.target.value);
                if (next != null) setDeadline(next);
                setPackageText("");
              }}
            />
          </label>
          <label className="auth-field" htmlFor="issuer-nonce">
            <span>Learner nonce</span>
            <input id="issuer-nonce" value={nonce} readOnly />
          </label>
          <Button onClick={sign} disabled={busy || !lookedUp || nonce === ""}>
            {busy ? "Working…" : "Sign authorization"}
          </Button>
        </div>
      </Card>

      {packageText ? (
        <Card className="section-block">
          <h2>Signed authorization</h2>
          <p className="note">
            Copy this package for a later mint. It is not a minted credential, and the learner app cannot submit it yet.
          </p>
          <label className="auth-field" htmlFor="issuer-package">
            <span>Package</span>
            <textarea id="issuer-package" className="issuer-package" readOnly rows={12} value={packageText} />
          </label>
          <Button variant="secondary" onClick={copyPackage}>Copy</Button>
        </Card>
      ) : null}
    </div>
  );
}
