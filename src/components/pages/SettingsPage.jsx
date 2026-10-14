import { useEffect, useRef, useState } from "react";
import { MIN_PASSWORD_LENGTH } from "../../utils/auth";
import { readAvatarFile } from "../../utils/avatar";
import { safeAvatarSrc } from "../../utils/frontendSecurity";
import { shortAddress } from "../../utils/learnerStats";
import { WALLET_GUIDANCE } from "../../utils/onboarding";
import { validateRecipientName } from "../../utils/recipient";
import { WALLET_LABELS } from "../../utils/wallet";
import { AvatarFace } from "../auth/AvatarFace";
import { AnimatedDoodle } from "../doodles";
import { ThemeToggle, ZoomToggle } from "../layout/Navbar";
import { Badge, Button, Card } from "../ui/primitives";

function signInMethod(account) {
  if (account?.provider === "google" && account?.hasPassword) return "Google · password set";
  if (account?.provider === "google") return "Google";
  return account?.hasPassword ? "Email and password" : "Email";
}

function Field({
  id,
  label,
  type = "text",
  value,
  onChange,
  autoComplete,
  placeholder,
  required = false,
}) {
  const [visible, setVisible] = useState(false);
  const isPassword = type === "password";
  return (
    <label className="auth-field" htmlFor={id}>
      <span>{label}</span>
      <span className={isPassword ? "auth-password-wrap" : undefined}>
        <input
          id={id}
          type={isPassword && visible ? "text" : type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          required={required}
        />
        {isPassword ? (
          <button type="button" className="auth-password-toggle" onClick={() => setVisible((current) => !current)}>
            {visible ? "Hide" : "Show"}
          </button>
        ) : null}
      </span>
    </label>
  );
}

function SettingsPage({
  account,
  address,
  isFuji,
  walletName,
  lastWalletId,
  theme,
  onToggleTheme,
  zoom,
  onCycleZoom,
  reducedMotion,
  osReducedMotion = false,
  onToggleMotion,
  onReset,
  onConnectWallet,
  onReconnectWallet,
  onDisconnectWallet,
  onSignOut,
  onDeleteAccount,
  onUpdateAvatar,
  onChangePassword,
  onSetPassword,
  onUpdateProfile,
  showOps = false,
  onOpenOps,
  showIssuer = false,
  onOpenIssuer,
}) {
  const fileRef = useRef(null);
  const [name, setName] = useState(account?.name || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    setName(account?.name || "");
  }, [account?.name]);

  const lastWalletName = lastWalletId ? WALLET_LABELS[lastWalletId] : "";
  const canReconnect = Boolean(!address && lastWalletId);
  const hasPhoto = Boolean(safeAvatarSrc(account?.avatarUrl));
  const nameDirty = name.trim() !== (account?.name || "").trim();

  function clearStatus() {
    setError("");
    setMessage("");
  }

  async function handleAvatar(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || !onUpdateAvatar) return;
    setBusy("avatar");
    clearStatus();
    const parsed = await readAvatarFile(file);
    if (!parsed.ok) {
      setBusy("");
      setError(parsed.error);
      return;
    }
    const result = await onUpdateAvatar(parsed.avatarUrl);
    setBusy("");
    if (!result?.ok) {
      setError(result?.error || "Could not save that photo.");
      return;
    }
    setMessage("Profile photo updated.");
  }

  async function handleRemovePhoto() {
    if (!onUpdateAvatar) return;
    setBusy("avatar");
    clearStatus();
    const result = await onUpdateAvatar("");
    setBusy("");
    if (!result?.ok) {
      setError(result?.error || "Could not remove that photo.");
      return;
    }
    setMessage("Profile photo removed.");
  }

  async function handleName(event) {
    event.preventDefault();
    if (!onUpdateProfile) return;
    const recipient = validateRecipientName(name);
    if (!recipient.ok) {
      setError(recipient.error);
      setMessage("");
      return;
    }
    setBusy("name");
    clearStatus();
    const result = await onUpdateProfile({ name: recipient.name });
    setBusy("");
    if (!result?.ok) {
      setError(result?.error || "Could not save your name.");
      return;
    }
    setName(result.account?.name || recipient.name);
    setMessage("Display name saved.");
  }

  async function handlePassword(event) {
    event.preventDefault();
    const action = account?.hasPassword ? onChangePassword : onSetPassword;
    if (!action) return;
    setBusy("password");
    clearStatus();
    const result = account?.hasPassword
      ? await onChangePassword({ currentPassword, password, confirmPassword })
      : await onSetPassword({ password, confirmPassword });
    setBusy("");
    if (!result?.ok) {
      setError(result?.error || "Could not update password.");
      return;
    }
    setCurrentPassword("");
    setPassword("");
    setConfirmPassword("");
    setMessage(account?.hasPassword ? "Password updated." : "Password created. You can sign in with email now.");
  }

  async function handleDelete() {
    if (!onDeleteAccount) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      setConfirmReset(false);
      return;
    }
    setBusy("delete");
    clearStatus();
    const result = await onDeleteAccount();
    setBusy("");
    if (!result?.ok) {
      setConfirmDelete(false);
      setError(result?.error || "Could not delete this account.");
    }
  }

  function handleReset() {
    if (!confirmReset) {
      setConfirmReset(true);
      setConfirmDelete(false);
      return;
    }
    setConfirmReset(false);
    onReset?.();
    setMessage("Local quiz and puzzle cache cleared for this browser.");
  }

  return (
    <div className="page settings-page">
      <header className="page-header">
        <p className="kicker">Account</p>
        <h1>Profile</h1>
        <p className="lede">Progress follows this account. A wallet is only needed to mint.</p>
      </header>

      {error ? <p className="auth-error" role="alert">{error}</p> : null}
      {message ? <p className="auth-info" role="status">{message}</p> : null}

      <Card className="settings-block">
        <h2>Identity</h2>
        <div className="profile-identity">
          <div className="profile-avatar-edit">
            <AvatarFace account={account} className="profile-avatar-lg" />
            <div className="profile-avatar-actions">
              <input
                ref={fileRef}
                className="visually-hidden"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={handleAvatar}
                disabled={busy === "avatar"}
              />
              <Button
                variant="secondary"
                disabled={busy === "avatar"}
                onClick={() => fileRef.current?.click()}
              >
                {hasPhoto ? "Change photo" : "Upload photo"}
              </Button>
              {hasPhoto ? (
                <Button variant="ghost" disabled={busy === "avatar"} onClick={handleRemovePhoto}>
                  Remove
                </Button>
              ) : null}
            </div>
            <p className="note settings-copy">
              Photos are saved at high resolution for page zoom. Re-upload once if an older photo looks soft when zoomed.
            </p>
          </div>
          <div className="profile-identity-copy">
            <p className="profile-identity-name">{account?.name || "Learner"}</p>
            <p className="profile-email">{account?.email || "…"}</p>
            <p className="meta-line">{signInMethod(account)}</p>
          </div>
        </div>

        <form className="settings-form" onSubmit={handleName}>
          <Field
            id="settings-name"
            label="Display name"
            value={name}
            onChange={(value) => { clearStatus(); setName(value); }}
            autoComplete="name"
            placeholder="Your name"
            required
          />
          <Button type="submit" variant="secondary" disabled={busy === "name" || !nameDirty}>
            {busy === "name" ? "Saving…" : "Save name"}
          </Button>
        </form>
      </Card>

      <Card className="settings-block">
        <h2>{account?.hasPassword ? "Password" : "Create a password"}</h2>
        {account?.hasPassword ? (
          <p>Email sign-in password.</p>
        ) : (
          <p className="note">Optional, for email sign-in.</p>
        )}
        <form className="settings-form" onSubmit={handlePassword}>
          {account?.hasPassword ? (
            <Field
              id="settings-current-password"
              label="Current password"
              type="password"
              value={currentPassword}
              onChange={setCurrentPassword}
              autoComplete="current-password"
            />
          ) : null}
          <Field
            id="settings-new-password"
            label="New password"
            type="password"
            value={password}
            onChange={setPassword}
            autoComplete="new-password"
            placeholder={`${MIN_PASSWORD_LENGTH}+ characters`}
          />
          <Field
            id="settings-confirm-password"
            label="Confirm password"
            type="password"
            value={confirmPassword}
            onChange={setConfirmPassword}
            autoComplete="new-password"
          />
          <Button type="submit" variant="secondary" disabled={Boolean(busy)}>
            {account?.hasPassword ? "Update password" : "Create password"}
          </Button>
        </form>
      </Card>

      <Card className="settings-block">
        <h2>Wallet</h2>
        <div className="settings-wallet">
          <div className="settings-wallet-status">
            <p className="profile-wallet-status">
              {address ? `${walletName || "Wallet"} · ${shortAddress(address)}` : "Not connected"}
            </p>
            {address ? (
              <Badge tone={isFuji ? "success" : "warning"}>{isFuji ? "Avalanche Fuji" : "Not Fuji"}</Badge>
            ) : null}
          </div>
          <p className="note settings-copy">{WALLET_GUIDANCE.body}</p>
          <div className="settings-actions">
            {address ? (
              <Button variant="secondary" onClick={onDisconnectWallet}>Disconnect</Button>
            ) : canReconnect ? (
              <Button onClick={onReconnectWallet}>Reconnect {lastWalletName}</Button>
            ) : (
              <Button onClick={onConnectWallet}>Connect wallet</Button>
            )}
          </div>
        </div>
      </Card>

      <Card className="settings-block">
        <h2>Preferences</h2>
        <div className="settings-row">
          <div>
            <p className="settings-label">Theme</p>
            <p className="note">{theme === "dark" ? "Charcoal dark" : "Paper light"}</p>
          </div>
          <ThemeToggle theme={theme} onToggleTheme={onToggleTheme} />
        </div>
        <div className="settings-row">
          <div>
            <p className="settings-label">Page zoom</p>
            <p className="note">This device only</p>
          </div>
          <ZoomToggle zoom={zoom} onCycleZoom={onCycleZoom} />
        </div>
        <div className="settings-motion">
          <div className="settings-row">
            <div>
              <p className="settings-label">Motion</p>
              <p className="note">
                {reducedMotion ? "Reduced animation" : "Full motion"}
              </p>
            </div>
            <Button variant="secondary" onClick={() => onToggleMotion(!reducedMotion)}>
              {reducedMotion ? "Use full motion" : "Reduce animation"}
            </Button>
          </div>
          <p className="note settings-copy">
            Full motion plays doodle draw, forge, and verify effects, UI transitions, and smooth scrolling.
            Reduced animation shows still visuals for a calmer experience.
          </p>
          <div
            className={`settings-motion-preview ${reducedMotion ? "is-reduced" : "is-full"}`}
            aria-hidden="true"
          >
            <span className="settings-motion-pulse" />
            <AnimatedDoodle
              key={reducedMotion ? "reduced" : "full"}
              type="hammer"
              animation="forge"
              trigger="immediate"
              active
              loop={!reducedMotion}
              size={36}
              variant="accent"
            />
            <p className="meta-line">
              {reducedMotion ? "Preview · still" : "Preview · animating"}
            </p>
          </div>
          {osReducedMotion && !reducedMotion ? (
            <p className="note settings-copy">
              Your device prefers reduced motion. Full motion in Forjora is on for this site so you can test animations here.
            </p>
          ) : null}
          {osReducedMotion && reducedMotion ? (
            <p className="note settings-copy">
              Matches your device preference for reduced motion.
            </p>
          ) : null}
        </div>
      </Card>

      {showIssuer && onOpenIssuer ? (
        <Card className="settings-block">
          <h2>Issuer</h2>
          <p>
            Sign a Fuji authorization with the contract owner wallet. This does not mint, and it does not turn a Forjora claimed score into an issuer-attested credential.
          </p>
          <Button onClick={onOpenIssuer}>Open issuer</Button>
        </Card>
      ) : null}

      {showOps && onOpenOps ? (
        <Card className="settings-block">
          <h2>Operator</h2>
          <p>
            Question bank and learning analytics on Realtime Database. Not issuer attestation — seating and claimed credentials stay unchanged.
          </p>
          <Button onClick={onOpenOps}>Open ops</Button>
        </Card>
      ) : null}

      <Card className="settings-block">
        <h2>Session</h2>
        <p>Sign out on this device. Progress stays on the account.</p>
        <Button variant="secondary" onClick={onSignOut}>Sign out</Button>
      </Card>

      <Card className="settings-block settings-danger">
        <h2>Data</h2>
        <p>
          Reset clears this browser’s quiz and puzzle cache. Your account progress remains unless you delete your account.
        </p>
        <div className="settings-actions">
          <Button variant="danger" onClick={handleReset} disabled={!account}>
            {confirmReset ? "Confirm reset" : "Reset local progress"}
          </Button>
          {confirmReset ? (
            <Button variant="ghost" onClick={() => setConfirmReset(false)}>Cancel</Button>
          ) : null}
        </div>
        {onDeleteAccount ? (
          <>
            <p>Delete removes this account. On-chain credentials are not burned.</p>
            <div className="settings-actions">
              <Button variant="danger" onClick={handleDelete} disabled={busy === "delete"}>
                {confirmDelete ? "Confirm delete account" : "Delete account"}
              </Button>
              {confirmDelete ? (
                <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Cancel</Button>
              ) : null}
            </div>
          </>
        ) : null}
      </Card>
    </div>
  );
}

export default SettingsPage;
