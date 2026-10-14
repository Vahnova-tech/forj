import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "./hooks/useWallet";
import { useTheme } from "./hooks/useTheme";
import { useZoom } from "./hooks/useZoom";
import { useWalletModal } from "./hooks/useWalletModal";
import { useAuth } from "./hooks/useAuth";
import { useProgression } from "./hooks/useProgression";
import { AchievementFeedback } from "./components/achievements/AchievementFeedback";
import AppShell from "./components/layout/AppShell";
import Quiz from "./components/Quiz";
import PuzzleBoard from "./components/PuzzleBoard";
import Certificate from "./components/Certificate";
import Landing from "./components/Landing";
import EmptyState from "./components/EmptyState";
import AboutPage from "./components/pages/AboutPage";
import SettingsPage from "./components/pages/SettingsPage";
import OpsPage from "./components/pages/OpsPage";
import IssuerPage from "./components/pages/IssuerPage";
import ProgressPage from "./components/pages/ProgressPage";
import LearnPage from "./components/pages/LearnPage";
import LeaderboardPage from "./components/pages/LeaderboardPage";
import PublicProfilePage from "./components/pages/PublicProfilePage";
import CredentialLookupPage from "./components/pages/CredentialLookupPage";
import NotFoundPage from "./components/pages/NotFoundPage";
import AuthModal, { ProfileSetup } from "./components/auth/AuthModal";
import LegalPage from "./components/pages/LegalPage";
import forgeCertificate from "./assets/forge-certificate.jpg";
import {
  PROGRESS_VIEWS,
  applySectionResult,
  clearProgress,
  emptyProgress,
  loadProgress,
  mergeSeenQuestionIds,
  saveProgress,
} from "./utils/progress";
import { redeemPiece } from "./utils/puzzle";
import { awardQuizFragments, convertFragmentsToPieces } from "./utils/fragments";
import { acknowledgeQuizStarted, recordLearningActivity } from "./utils/quizTrigger";
import { xpAmountFor } from "./utils/progression/xp";
import { EMPTY_STATES } from "./utils/onboarding";
import {
  parseCredentialLocation,
  parseLookupQuery,
  publicCredentialPath,
} from "./utils/credentialLookup";
import { pageFromPathname, publicProfilePath, publicProfileSlugFromPath } from "./utils/routes";
import { adoptLinkedWalletProgress, migrateAndHydrate } from "./utils/backend/migrate";
import { writeQuizProgress } from "./utils/backend/progressSync";
import { normalizeAddress } from "./utils/progress";
import { isOperator } from "./utils/rtdb/operators";
import { hydratePublishedBanks } from "./utils/rtdb/questionBank";
import { getFujiPublicClient } from "./utils/fujiClient";
import { readContractOwner, sameWallet } from "./utils/issuerAuthorization";

const VIEWS = PROGRESS_VIEWS;
const PUBLIC_PAGES = new Set([
  "landing",
  "about",
  "lookup",
  "privacy",
  "terms",
  "not-found",
  "leaderboard",
  "public-profile",
]);

function pageFromLocation() {
  if (typeof window === "undefined") return "landing";
  return pageFromPathname(window.location.pathname, window.location.search);
}

function scrollToId(id, reducedMotion) {
  const el = document.getElementById(id);
  el?.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth" });
}

function App() {
  const auth = useAuth();
  const { linkWallet, verifyEmail } = auth;
  const wallet = useWallet();
  const theme = useTheme();
  const zoom = useZoom();
  const { closeModal, openModal, open } = useWalletModal();
  const walletModal = { open, openModal, closeModal };
  const [page, setPage] = useState(pageFromLocation);
  const [view, setView] = useState(VIEWS.SECTIONS);
  const [activeSection, setActiveSection] = useState(null);
  const [forgeTrackId, setForgeTrackId] = useState("fundamentals");
  const [totalPoints, setTotalPoints] = useState(0);
  const [spentPoints, setSpentPoints] = useState(0);
  const [acquiredPieces, setAcquiredPieces] = useState([]);
  const [sectionScores, setSectionScores] = useState({});
  const [completedSections, setCompletedSections] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [recipientName, setRecipientName] = useState("");
  const [puzzleFragments, setPuzzleFragments] = useState(0);
  const [fragmentKeys, setFragmentKeys] = useState({});
  const [fragmentPieceCredits, setFragmentPieceCredits] = useState(0);
  const [seenQuestionIds, setSeenQuestionIds] = useState([]);
  const [activitiesSinceQuiz, setActivitiesSinceQuiz] = useState(0);
  const [quizThreshold, setQuizThreshold] = useState(0);
  const [pendingKnowledgeCheck, setPendingKnowledgeCheck] = useState(false);
  const [lastQuizRewards, setLastQuizRewards] = useState(null);
  const [hydratedOwner, setHydratedOwner] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authView, setAuthView] = useState("signup");
  const [authOobCode, setAuthOobCode] = useState("");
  const [authBanner, setAuthBanner] = useState("");
  const [onboardError, setOnboardError] = useState("");
  const [onboardBusy, setOnboardBusy] = useState(false);
  const [locationKey, setLocationKey] = useState(() =>
    typeof window === "undefined" ? "/" : `${window.location.pathname}${window.location.search}`
  );
  const [progressRevision, setProgressRevision] = useState(0);
  const [walletLinkError, setWalletLinkError] = useState("");
  const [opsAllowed, setOpsAllowed] = useState(false);
  const [issuerAllowed, setIssuerAllowed] = useState(false);
  const authActionHandled = useRef(false);
  const walletAdoptedFor = useRef(null);
  const userImage = forgeCertificate;
  const account = auth.account;
  const ownerId = account?.id || null;
  const isAuthenticated = Boolean(account?.emailVerified);
  const progressReady = Boolean(ownerId && hydratedOwner === ownerId);
  const stage = auth.stage;
  const progression = useProgression(ownerId, {
    sectionScores,
    acquiredPieces,
    attempts,
  }, {
    ready: progressReady,
    displayName: account?.name || "",
    walletAddress: wallet.address || account?.walletAddress || "",
    revision: progressRevision,
  });

  const applyProgress = useCallback((snapshot) => {
    const next = snapshot || emptyProgress();
    setView(next.view);
    setActiveSection(next.activeSection);
    setTotalPoints(next.totalPoints);
    setSpentPoints(next.spentPoints);
    setAcquiredPieces(next.acquiredPieces);
    setSectionScores(next.sectionScores);
    setCompletedSections(next.completedSections);
    setAttempts(next.attempts);
    setRecipientName(next.recipientName || "");
    setPuzzleFragments(next.puzzleFragments || 0);
    setFragmentKeys(next.fragmentKeys || {});
    setFragmentPieceCredits(next.fragmentPieceCredits || 0);
    setSeenQuestionIds(next.seenQuestionIds || []);
    setActivitiesSinceQuiz(next.activitiesSinceQuiz || 0);
    setQuizThreshold(next.quizThreshold || 0);
    setPendingKnowledgeCheck(Boolean(next.pendingKnowledgeCheck));
  }, []);

  useEffect(() => {
    if (!ownerId) {
      setHydratedOwner(null);
      walletAdoptedFor.current = null;
      setWalletLinkError("");
      applyProgress(emptyProgress());
      setPage((current) => (PUBLIC_PAGES.has(current) ? current : "landing"));
      return undefined;
    }
    let cancelled = false;
    (async () => {
      let snapshot = loadProgress(ownerId);
      if (auth.user) {
        try {
          const hydrated = await migrateAndHydrate(auth.user, snapshot);
          if (!cancelled && hydrated?.quiz) snapshot = hydrated.quiz;
        } catch {
          // Keep the local snapshot if backend sync is unavailable.
        }
      }
      if (cancelled) return;
      applyProgress(snapshot);
      setHydratedOwner(ownerId);
      if (snapshot.recipientName === "" && account?.name) {
        setRecipientName(account.name);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [account?.name, applyProgress, auth.user, ownerId]);

  useEffect(() => {
    if (!isAuthenticated || !ownerId) {
      setOpsAllowed(false);
      return undefined;
    }
    let cancelled = false;
    isOperator(ownerId)
      .then((allowed) => {
        if (!cancelled) setOpsAllowed(Boolean(allowed));
      })
      .catch(() => {
        if (!cancelled) setOpsAllowed(false);
      });
    hydratePublishedBanks().catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, ownerId]);

  useEffect(() => {
    const address = wallet.address;
    if (!address) {
      setIssuerAllowed(false);
      return undefined;
    }
    let cancelled = false;
    readContractOwner(getFujiPublicClient())
      .then((owner) => {
        if (!cancelled) setIssuerAllowed(sameWallet(owner, address));
      })
      .catch(() => {
        if (!cancelled) setIssuerAllowed(false);
      });
    return () => {
      cancelled = true;
    };
  }, [wallet.address]);

  useEffect(() => {
    if (!progressReady) return;
    const snapshot = {
      view,
      activeSection,
      totalPoints,
      spentPoints,
      acquiredPieces,
      sectionScores,
      completedSections,
      attempts,
      recipientName,
      puzzleFragments,
      fragmentKeys,
      fragmentPieceCredits,
      seenQuestionIds,
      activitiesSinceQuiz,
      quizThreshold,
      pendingKnowledgeCheck,
    };
    saveProgress(ownerId, snapshot);
    writeQuizProgress(ownerId, snapshot).catch(() => {});
  }, [
    activeSection,
    acquiredPieces,
    activitiesSinceQuiz,
    attempts,
    completedSections,
    fragmentKeys,
    fragmentPieceCredits,
    ownerId,
    pendingKnowledgeCheck,
    progressReady,
    puzzleFragments,
    quizThreshold,
    recipientName,
    sectionScores,
    seenQuestionIds,
    spentPoints,
    totalPoints,
    view,
  ]);

  useEffect(() => {
    const address = normalizeAddress(wallet.address);
    if (!ownerId || !auth.user || !address || !progressReady) return undefined;
    const key = `${ownerId}:${address}`;
    if (walletAdoptedFor.current === key) return undefined;

    let cancelled = false;
    (async () => {
      setWalletLinkError("");
      if (normalizeAddress(account?.walletAddress) !== address) {
        const linked = await linkWallet(address);
        if (cancelled) return;
        if (!linked.ok) {
          setWalletLinkError(linked.error || "Could not link this wallet to your account.");
          walletAdoptedFor.current = `fail:${key}`;
          return;
        }
      }
      try {
        const adopted = await adoptLinkedWalletProgress(auth.user, address);
        if (cancelled) return;
        walletAdoptedFor.current = key;
        if (adopted?.adopted && adopted.quiz) {
          applyProgress(adopted.quiz);
          setProgressRevision((value) => value + 1);
        }
      } catch {
        if (!cancelled) walletAdoptedFor.current = key;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    account?.walletAddress,
    applyProgress,
    auth.user,
    linkWallet,
    ownerId,
    progressReady,
    wallet.address,
  ]);

  useEffect(() => {
    if (!walletLinkError) return undefined;
    const timer = window.setTimeout(() => setWalletLinkError(""), 7000);
    return () => window.clearTimeout(timer);
  }, [walletLinkError]);

  useEffect(() => {
    if (wallet.address && open) closeModal();
  }, [closeModal, open, wallet.address]);

  const goLearnHome = useCallback(() => {
    setView(VIEWS.SECTIONS);
    setActiveSection(null);
    setPage("learn");
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || authActionHandled.current) return undefined;
    const params = new URLSearchParams(window.location.search);
    const mode = params.get("mode");
    const oobCode = params.get("oobCode") || params.get("verifyEmail") || params.get("reset") || "";
    if (!mode && !params.get("verifyEmail") && !params.get("reset") && !params.get("oobCode")) {
      return undefined;
    }
    authActionHandled.current = true;
    if ((mode === "verifyEmail" || params.get("verifyEmail")) && oobCode) {
      setAuthOobCode(oobCode);
      setAuthView("verify");
      setAuthOpen(true);
      setAuthBanner("Confirming your email…");
      void verifyEmail(oobCode).then((result) => {
        if (!result?.ok) {
          setAuthBanner(result?.error || "Could not verify that link. Try resending the email.");
          setAuthView("verify");
          setAuthOpen(true);
          return;
        }
        if (result.signedIn && result.account?.emailVerified) {
          setAuthBanner(result.message || "Email verified.");
          setAuthOpen(false);
          goLearnHome();
          return;
        }
        setAuthBanner(result.message || "Email verified. Sign in to continue.");
        setAuthView("signin");
        setAuthOpen(true);
      });
    } else if (mode === "resetPassword" || params.get("reset")) {
      setAuthOobCode(oobCode);
      setAuthView("reset");
      setAuthBanner("Choose a new password for your account.");
      setAuthOpen(true);
    }
    ["mode", "oobCode", "apiKey", "lang", "verifyEmail", "reset"].forEach((key) => params.delete(key));
    const next = `${window.location.pathname}${params.toString() ? `?${params}` : ""}`;
    window.history.replaceState({}, "", next);
    return undefined;
  }, [goLearnHome, verifyEmail]);

  const startSection = useCallback((id) => {
    setActiveSection(id);
    setView(VIEWS.QUIZ);
    setPage("learn");
    setLastQuizRewards(null);
    const cadence = acknowledgeQuizStarted({
      activitiesSinceQuiz,
      quizThreshold,
      pendingKnowledgeCheck,
    });
    setActivitiesSinceQuiz(cadence.activitiesSinceQuiz);
    setQuizThreshold(cadence.quizThreshold);
    setPendingKnowledgeCheck(cadence.pendingKnowledgeCheck);
    progression.startQuiz(id);
  }, [activitiesSinceQuiz, pendingKnowledgeCheck, progression, quizThreshold]);

  const handleLessonComplete = useCallback((lessonId) => {
    progression.completeLesson(lessonId);
    const cadence = recordLearningActivity({
      activitiesSinceQuiz,
      quizThreshold,
      pendingKnowledgeCheck,
    });
    setActivitiesSinceQuiz(cadence.activitiesSinceQuiz);
    setQuizThreshold(cadence.quizThreshold);
    setPendingKnowledgeCheck(cadence.pendingKnowledgeCheck);
  }, [activitiesSinceQuiz, pendingKnowledgeCheck, progression, quizThreshold]);

  const handleQuizComplete = useCallback((result) => {
    setSectionScores((prev) => {
      const next = applySectionResult(prev, result);
      setTotalPoints(next.totalPoints);
      return next.sectionScores;
    });
    setCompletedSections((prev) =>
      prev.includes(result.sectionId) ? prev : [...prev, result.sectionId]
    );
    setAttempts((prev) => [...prev, result]);
    if (Array.isArray(result.questionIds) && result.questionIds.length) {
      setSeenQuestionIds((prev) => mergeSeenQuestionIds(prev, result.questionIds));
    }

    let fragmentsAwarded = 0;
    let piecesUnlocked = [];
    setPuzzleFragments((prevFragments) => {
      const awarded = awardQuizFragments(
        { puzzleFragments: prevFragments, fragmentKeys },
        result
      );
      fragmentsAwarded = awarded.awarded;
      setFragmentKeys(awarded.state.fragmentKeys);
      const converted = convertFragmentsToPieces({
        puzzleFragments: awarded.state.puzzleFragments,
        fragmentKeys: awarded.state.fragmentKeys,
        fragmentPieceCredits,
        acquiredPieces,
      });
      piecesUnlocked = converted.unlocked;
      setFragmentPieceCredits(converted.state.fragmentPieceCredits || 0);
      if (converted.unlocked.length) {
        setAcquiredPieces(converted.state.acquiredPieces);
        setSpentPoints(converted.state.spentPoints);
        for (const index of converted.unlocked) {
          progression.unlockPiece(index);
        }
      }
      setLastQuizRewards({
        sectionId: result.sectionId,
        fragmentsAwarded,
        puzzleFragments: converted.state.puzzleFragments,
        piecesUnlocked,
        puzzlePieceCount: converted.state.acquiredPieces?.length ?? acquiredPieces.length,
        xpAwarded:
          xpAmountFor("QUIZ_COMPLETED", { difficulty: result.sectionId }) +
          (result.perfect ? xpAmountFor("QUIZ_PERFECT") : 0),
        firstCompletion: awarded.firstCompletion,
        perfect: awarded.perfect,
      });
      return converted.state.puzzleFragments;
    });

    progression.completeQuiz(result);
  }, [acquiredPieces, fragmentKeys, fragmentPieceCredits, progression]);

  const goToPuzzle = useCallback(() => {
    setView(VIEWS.PUZZLE);
    setPage("credentials");
  }, []);

  const handleAcquirePiece = useCallback((index) => {
    setAcquiredPieces((prev) => {
      const result = redeemPiece({ totalPoints, acquiredPieces: prev, sectionScores }, index);
      if (!result.ok) return prev;
      setSpentPoints(result.spentPoints);
      progression.unlockPiece(index);
      return result.acquiredPieces;
    });
  }, [progression, sectionScores, totalPoints]);

  const handleFullReset = useCallback(() => {
    if (ownerId) {
      clearProgress(ownerId);
      progression.clear();
    }
    applyProgress(emptyProgress());
    setView(VIEWS.SECTIONS);
    setPage("learn");
  }, [applyProgress, ownerId, progression]);

  useEffect(() => {
    if (isAuthenticated && page === "landing") goLearnHome();
  }, [goLearnHome, isAuthenticated, page]);

  // Always dismiss the auth dialog once the learner is verified/signed in.
  useEffect(() => {
    if (!isAuthenticated || !authOpen) return;
    setAuthOpen(false);
    setAuthBanner("");
    setAuthOobCode("");
  }, [authOpen, isAuthenticated]);

  const openLookup = useCallback((tokenId = "", walletAddress = "") => {
    const href = publicCredentialPath({ tokenId, wallet: walletAddress });
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", href);
      setLocationKey(`${window.location.pathname}${window.location.search}`);
    }
    setPage("lookup");
  }, []);

  function openAuth(nextView = "signup") {
    setAuthBanner("");
    setAuthView(nextView);
    setAuthOpen(true);
  }

  function closeAuth() {
    setAuthOpen(false);
    setAuthBanner("");
  }

  function finishAuth() {
    setAuthOpen(false);
    setAuthBanner("");
    setAuthOobCode("");
    if (PUBLIC_PAGES.has(page) && page !== "landing") return;
    goLearnHome();
  }

  function openLegal(topic) {
    setAuthOpen(false);
    const path = topic === "terms" ? "/terms" : "/privacy";
    if (typeof window !== "undefined") {
      window.history.pushState({}, "", path);
      setLocationKey(path);
    }
    setPage(topic === "terms" ? "terms" : "privacy");
  }

  useEffect(() => {
    function onPop() {
      setLocationKey(`${window.location.pathname}${window.location.search}`);
      setPage(pageFromPathname(window.location.pathname, window.location.search));
    }
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    const previous = document.title;
    if (page === "not-found") {
      document.title = "Forjora · Page not found";
      return () => {
        document.title = previous;
      };
    }
    return undefined;
  }, [page]);

  function handleNavigate(nextPage, options = {}) {
    if (typeof window !== "undefined" && (nextPage === "privacy" || nextPage === "terms")) {
      const path = nextPage === "terms" ? "/terms" : "/privacy";
      window.history.pushState({}, "", path);
      setLocationKey(path);
      setPage(nextPage);
      return;
    }
    if (typeof window !== "undefined" && nextPage === "lookup") {
      const href = publicCredentialPath({});
      if (window.location.pathname !== "/credential" || window.location.search) {
        window.history.pushState({}, "", href);
      }
      setLocationKey(`${window.location.pathname}${window.location.search}`);
    } else if (typeof window !== "undefined" && nextPage === "leaderboard") {
      if (window.location.pathname !== "/" || window.location.search) {
        // Keep SPA path clean unless already on a public profile URL.
        if (!window.location.pathname.startsWith("/u/")) {
          window.history.pushState({}, "", "/");
          setLocationKey("/");
        }
      }
    } else if (typeof window !== "undefined" && nextPage === "public-profile") {
      const href = publicProfilePath(options.slug || "");
      if (href !== "/" && window.location.pathname !== href) {
        window.history.pushState({}, "", href);
        setLocationKey(href);
      }
      setPage("public-profile");
      return;
    } else if (typeof window !== "undefined") {
      const location = parseCredentialLocation(window.location.pathname, window.location.search);
      const query = parseLookupQuery(window.location.search);
      if (location.isPublicRoute || query.tokenId || query.wallet || window.location.pathname.startsWith("/u/")) {
        window.history.pushState({}, "", "/");
        setLocationKey("/");
      }
    }
    if (!isAuthenticated) {
      if (nextPage === "learn") {
        setPage("landing");
        requestAnimationFrame(() => scrollToId("how-it-works", theme.reducedMotion));
        return;
      }
      if (nextPage === "credentials") {
        setPage("landing");
        requestAnimationFrame(() => scrollToId("credential", theme.reducedMotion));
        return;
      }
      if (nextPage === "progress" || nextPage === "settings") {
        openAuth("signin");
        return;
      }
    }
    if (nextPage === "landing") {
      if (typeof window !== "undefined" && window.location.pathname !== "/") {
        window.history.pushState({}, "", "/");
        setLocationKey("/");
      }
      setPage("landing");
      return;
    }
    if (nextPage === "learn") {
      setView(VIEWS.SECTIONS);
      setActiveSection(null);
    }
    setPage(nextPage);
  }

  const restoring = auth.restoring || (isAuthenticated && !progressReady);

  async function handleProfileContinue(input) {
    if (onboardBusy) return;
    setOnboardError("");
    setOnboardBusy(true);
    try {
      const result = await auth.completeProfile(input);
      if (!result.ok) setOnboardError(result.error || "Could not save your name.");
    } catch (error) {
      setOnboardError(error.message || "Could not save your name.");
    } finally {
      setOnboardBusy(false);
    }
  }

  function renderAppContent() {
    if (page === "privacy") return <LegalPage topic="privacy" />;
    if (page === "terms") return <LegalPage topic="terms" />;
    if (page === "not-found") {
      return (
        <NotFoundPage
          path={typeof window !== "undefined" ? window.location.pathname : ""}
          onHome={() => handleNavigate("landing")}
          onLookup={() => handleNavigate("lookup")}
          onAbout={() => handleNavigate("about")}
        />
      );
    }
    if (page === "about") {
      return <AboutPage onNavigate={handleNavigate} isAuthenticated={isAuthenticated} />;
    }
    if (page === "lookup") {
      return (
        <CredentialLookupPage
          key={locationKey}
          pathname={typeof window !== "undefined" ? window.location.pathname : "/credential"}
          search={typeof window !== "undefined" ? window.location.search : ""}
          onHistoryChange={(href) => setLocationKey(href)}
        />
      );
    }
    if (page === "public-profile") {
      return (
        <PublicProfilePage
          slug={publicProfileSlugFromPath(typeof window !== "undefined" ? window.location.pathname : "")}
          isAuthenticated={isAuthenticated}
          onBoard={() => handleNavigate("leaderboard")}
          onHome={() => handleNavigate("landing")}
          onSignIn={() => openAuth("signin")}
        />
      );
    }
    if (page === "leaderboard") {
      return (
        <LeaderboardPage
          learnerId={ownerId}
          progression={progression}
          isAuthenticated={isAuthenticated}
          onToggleOptIn={(optIn) => progression.setLeaderboardPreference({
            optIn,
            displayName: account?.name || progression.state?.leaderboard?.displayName || "Learner",
          })}
          onToggleHideWallet={(nextHide) => progression.setLeaderboardPreference({
            hideWallet: nextHide,
            displayName: account?.name || progression.state?.leaderboard?.displayName || "Learner",
            walletAddress: wallet.address || account?.walletAddress || "",
          })}
          onLearn={() => (isAuthenticated ? goLearnHome() : handleNavigate("learn"))}
          onSignIn={() => openAuth("signin")}
          onOpenProfile={(slug) => handleNavigate("public-profile", { slug })}
        />
      );
    }
    if (restoring) {
      return (
        <EmptyState
          doodle={EMPTY_STATES.restoring.doodle}
          title={EMPTY_STATES.restoring.title}
          body={EMPTY_STATES.restoring.body}
        />
      );
    }
    if (!isAuthenticated || page === "landing") {
      return (
        <Landing
          signedIn={isAuthenticated}
          onStart={() => (isAuthenticated ? goLearnHome() : openAuth("signup"))}
          onSignIn={() => openAuth("signin")}
          onExploreCredentials={() => handleNavigate("lookup")}
        />
      );
    }
    if (stage === "profile") {
      return (
        <ProfileSetup
          account={account}
          busy={onboardBusy}
          error={onboardError}
          onContinue={handleProfileContinue}
        />
      );
    }
    if (page === "settings") {
      return (
        <SettingsPage
          account={account}
          address={wallet.address}
          isFuji={wallet.isFuji}
          walletName={wallet.walletName}
          lastWalletId={wallet.lastWalletId}
          theme={theme.theme}
          onToggleTheme={theme.toggleTheme}
          zoom={zoom.zoom}
          onCycleZoom={zoom.cycleZoom}
          reducedMotion={theme.reducedMotion}
          osReducedMotion={theme.osReducedMotion}
          onToggleMotion={theme.setReducedMotion}
          onReset={handleFullReset}
          onConnectWallet={openModal}
          onReconnectWallet={() => wallet.connect(wallet.lastWalletId)}
          onDisconnectWallet={() => {
            wallet.disconnect();
            auth.unlinkWallet();
          }}
          onSignOut={() => {
            auth.signOut();
            setPage("landing");
          }}
          onDeleteAccount={async () => {
            const result = await auth.deleteAccount();
            if (result.ok) setPage("landing");
            return result;
          }}
          onUpdateAvatar={auth.updateAvatar}
          onChangePassword={auth.changePassword}
          onSetPassword={auth.setPassword}
          onUpdateProfile={auth.updateProfile}
          showOps={opsAllowed}
          onOpenOps={() => setPage("ops")}
          showIssuer={issuerAllowed}
          onOpenIssuer={() => setPage("issuer")}
        />
      );
    }
    if (page === "ops") {
      if (!opsAllowed) {
        return (
          <EmptyState
            title="Ops locked"
            body="This operator surface is only available to allowlisted accounts."
            actionLabel="Back to settings"
            onAction={() => setPage("settings")}
          />
        );
      }
      return (
        <OpsPage
          uid={ownerId}
          onBack={() => setPage("settings")}
        />
      );
    }
    if (page === "issuer") {
      if (!issuerAllowed) {
        return (
          <EmptyState
            title="Issuer locked"
            body="This signing surface is only available to the credential contract owner wallet."
            actionLabel="Back to settings"
            onAction={() => setPage("settings")}
          />
        );
      }
      return (
        <IssuerPage
          signerAddress={wallet.address}
          getWalletClient={wallet.getWalletClient}
          switchToFuji={wallet.switchToFuji}
          onBack={() => setPage("settings")}
        />
      );
    }
    if (page === "progress") {
      return (
        <ProgressPage
          address={wallet.address || account?.walletAddress}
          walletName={wallet.walletName}
          chainId={wallet.chainId}
          isFuji={wallet.isFuji}
          sectionScores={sectionScores}
          totalPoints={totalPoints}
          spentPoints={spentPoints}
          acquiredPieces={acquiredPieces}
          attempts={attempts}
          publicClient={wallet.publicClient}
          onContinue={startSection}
          onLearn={goLearnHome}
          onPuzzle={() => {
            setForgeTrackId("fundamentals");
            setView(VIEWS.PUZZLE);
            setPage("learn");
          }}
          onCredentials={() => setPage("credentials")}
          onLookup={openLookup}
          progression={progression}
        />
      );
    }
    if (page === "credentials") {
      return (
          <Certificate
            address={wallet.address || account?.walletAddress}
            totalPoints={totalPoints}
            acquiredPieces={acquiredPieces}
            sectionScores={sectionScores}
            recipientName={recipientName || account?.name || ""}
            onRecipientName={setRecipientName}
            getWalletClient={wallet.getWalletClient}
            publicClient={wallet.publicClient}
            switchToFuji={wallet.switchToFuji}
            onRetry={handleFullReset}
            userImage={userImage}
            onLookup={openLookup}
            onClaimed={progression.claimCredential}
            progress={progression.state}
            achievements={progression.achievements}
            puzzleFragments={puzzleFragments}
            onPuzzle={(trackId) => {
              setForgeTrackId(trackId || "fundamentals");
              setView(VIEWS.PUZZLE);
              setPage("learn");
            }}
            onLearn={goLearnHome}
            onProgress={() => setPage("progress")}
            onConnectWallet={openModal}
            injectorConnected={Boolean(wallet.address)}
            isFuji={wallet.isFuji}
            chainId={wallet.chainId}
            switchingNetwork={wallet.switching}
            networkError={wallet.error}
          />
      );
    }
    if (view === VIEWS.QUIZ && activeSection) {
      return (
        <Quiz
          sectionId={activeSection}
          onComplete={handleQuizComplete}
          onBack={goLearnHome}
          seenQuestionIds={seenQuestionIds}
          rewardSummary={lastQuizRewards}
          puzzlePieceCount={acquiredPieces.length}
          onGoToPuzzle={goToPuzzle}
        />
      );
    }
    if (view === VIEWS.PUZZLE) {
      return (
        <PuzzleBoard
          totalPoints={totalPoints}
          spentPoints={spentPoints}
          acquiredPieces={acquiredPieces}
          sectionScores={sectionScores}
          puzzleFragments={puzzleFragments}
          trackId={forgeTrackId}
          onAcquirePiece={handleAcquirePiece}
          onContinue={() => {
            setView(VIEWS.CERTIFICATE);
            setPage("credentials");
          }}
          onBack={goLearnHome}
          userImage={userImage}
        />
      );
    }
    return (
      <LearnPage
        progression={progression}
        sectionScores={sectionScores}
        totalPoints={totalPoints}
        completedSections={completedSections}
        onSelectSection={startSection}
        onGoToPuzzle={() => {
          setForgeTrackId("fundamentals");
          setView(VIEWS.PUZZLE);
        }}
        onCompleteLesson={handleLessonComplete}
        onCredentials={() => setPage("credentials")}
        pendingKnowledgeCheck={pendingKnowledgeCheck}
      />
    );
  }

  return (
    <>
      <AppShell
        page={page}
        onNavigate={handleNavigate}
        isAuthenticated={isAuthenticated}
        account={account}
        wallet={wallet}
        theme={theme.theme}
        onToggleTheme={theme.toggleTheme}
        zoom={zoom.zoom}
        onCycleZoom={zoom.cycleZoom}
        walletModal={walletModal}
        onOpenAuth={openAuth}
        profile={{
          onDisconnectWallet: () => {
            wallet.disconnect();
            auth.unlinkWallet();
          },
          onOpenPreferences: () => handleNavigate("settings"),
          onSignOut: () => {
            auth.signOut();
            setPage("landing");
          },
        }}
      >
        {walletLinkError ? (
          <div className="feedback-banner feedback-banner-alert" role="alert">
            <div className="feedback-banner-copy">
              <p className="kicker">Wallet link</p>
              <p>{walletLinkError}</p>
            </div>
            <button type="button" className="btn btn-ghost" onClick={() => setWalletLinkError("")}>
              Dismiss
            </button>
          </div>
        ) : null}
        {progression.feedback?.length > 0 && (
          <div className="achievement-feedback-stack">
            <AchievementFeedback
              feedback={progression.feedback}
              onDismiss={progression.clearFeedback}
              onView={() => {
                setPage("progress");
                progression.clearFeedback();
              }}
            />
            <div className="feedback-banner" role="status">
              {progression.feedback.slice(0, 3).map((item, index) => (
                <p key={`${item.kind}-${index}`}>
                  {item.kind === "xp" && `+${item.amount} XP`}
                  {item.kind === "level-up" && `Level ${item.level}`}
                  {item.kind === "achievement" && `Achievement: ${item.name}`}
                  {item.kind === "unlock" && `Unlocked ${item.scope}`}
                  {item.kind === "streak-milestone" && `${item.days}-day streak`}
                  {item.kind === "puzzle-complete" && "Puzzle complete"}
                </p>
              ))}
              <button type="button" className="btn btn-ghost" onClick={progression.clearFeedback}>Dismiss</button>
            </div>
          </div>
        )}
        {renderAppContent()}
      </AppShell>
      <AuthModal
        open={authOpen}
        view={authView}
        onChangeView={(next) => {
          setAuthBanner("");
          setAuthView(next);
        }}
        onClose={closeAuth}
        onSuccess={finishAuth}
        auth={auth}
        pendingEmail={account?.email}
        oobCode={authOobCode}
        banner={authBanner}
        onOpenLegal={openLegal}
      />
    </>
  );
}

export default App;
