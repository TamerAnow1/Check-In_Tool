import React, { useState, useEffect } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  serverTimestamp,
  query,
  onSnapshot,
  where,
  runTransaction,
  doc,
  setDoc,
  getDoc,
  updateDoc,
  limit,
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  CheckCircle,
  Loader,
  X,
  Info,
  Download,
  Building,
  LayoutDashboard,
  Filter,
  Calendar,
  Lock,
  Mail,
  RefreshCw,
  Zap,
  LogOut,
  Maximize,
  Clock, // Icon for timeout
  AlertTriangle, // Icon for warning
  Smartphone, // Icon for scanner
} from "lucide-react";

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyD8eWUJQD8_LS8Be0seSpIRovBMzV-chO8",
  authDomain: "qr-code-generator-46179.firebaseapp.com",
  projectId: "qr-code-generator-46179",
  storageBucket: "qr-code-generator-46179.firebasestorage.app",
  messagingSenderId: "817618481036",
  appId: "1:817618481036:web:4585bf8713719410e9f0a9",
  measurementId: "G-7Y6QXQMYNC",
};

// --- TIMEOUT SETTINGS ---
// Set TEST_MODE = true to test quickly (10 seconds instead of 5 minutes)
const TEST_MODE = false;

// 5 Minutes (in ms) if Production, or 10 Seconds if Testing
const CHECK_INTERVAL_MS = TEST_MODE ? 10 * 1000 : 5 * 60 * 1000;
// 15 Seconds Countdown
const TIMEOUT_SECONDS = 15;

// Constants
const COLLECTION_NAME = "checkins";
const COUNTER_COLLECTION = "counters";
const DEVICES_COLLECTION = "registered_devices";
const SYSTEM_COLLECTION = "system";

const TOKEN_VALIDITY_SECONDS = 30;
const LOCATIONS = Array.from({ length: 30 }, (_, i) => `QCA${i + 1}`);

// Global refs
let app = null;
let db = null;
let auth = null;

export default function App() {
  const [mode, setMode] = useState(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const view = params.get("view");
      if (view === "scanner") return "scanner";
      if (view === "kiosk") return "kiosk";
    }
    return "landing";
  });

  const [params, setParams] = useState(() => {
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      return {
        token: p.get("token"),
        locationId: p.get("locationId"),
      };
    }
    return {};
  });

  const [user, setUser] = useState(null);
  const [isFirebaseReady, setIsFirebaseReady] = useState(false);

  // --- HIDE SANDBOX UI ---
  useEffect(() => {
    const styleId = "sandbox-hider-styles";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.innerHTML = `
        iframe[style*="position: fixed"][style*="bottom: 0"],
        #__next > div > a[href*="codesandbox"],
        a[href*="codesandbox.io/s/"],
        #csb-status-bar { display: none !important; }
      `;
      document.head.appendChild(style);
    }
  }, []);

  // ✅ INSTANT LOADING
  useEffect(() => {
    if (!app) {
      try {
        app = initializeApp(firebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);
        signInAnonymously(auth).catch((err) =>
          console.error("Auth failed", err)
        );
        onAuthStateChanged(auth, (u) => {
          setUser(u);
          setIsFirebaseReady(true);
        });
      } catch (e) {
        console.error("Init Error", e);
      }
    }
  }, []);

  const handleModeSelect = (selectedMode, locationId = null) => {
    if (selectedMode === "kiosk") {
      setParams({ locationId });
      setMode("kiosk");
    } else if (selectedMode === "admin") {
      setMode("admin");
    } else if (selectedMode === "scanner") {
      const timestamp = Math.floor(Date.now() / 1000 / TOKEN_VALIDITY_SECONDS);
      setParams({ token: `secure-${timestamp}`, locationId: "QCA1" });
      setMode("scanner");
    } else {
      setMode(selectedMode);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-slate-800 font-sans">
      {mode === "landing" && <LandingScreen onSelect={handleModeSelect} />}
      {mode === "kiosk" && (
        <KioskScreen isReady={isFirebaseReady} locationId={params.locationId} />
      )}
      {mode === "scanner" && (
        <ScannerScreen
          token={params.token}
          locationId={params.locationId}
          isReady={isFirebaseReady}
          user={user}
        />
      )}
      {mode === "admin" && (
        <AdminScreen
          isReady={isFirebaseReady}
          onBack={() => setMode("landing")}
        />
      )}
    </div>
  );
}

// --- SCREEN 1: LANDING ---
function LandingScreen({ onSelect }) {
  const [selectedLoc, setSelectedLoc] = useState("QCA1");
  return (
    <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center space-y-8 bg-slate-50 animate-in fade-in duration-700">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold text-slate-900">
          Enterprise Check-In
        </h1>
        <p className="text-slate-500">Select operation mode:</p>
      </div>
      <div className="grid gap-4 w-full max-w-md">
        <div className="bg-white p-6 rounded-xl border-2 border-blue-100 hover:border-blue-500 transition-all text-left">
          <div className="flex items-center mb-4">
            <div className="bg-blue-100 p-3 rounded-full mr-4 text-blue-600">
              <Building size={24} />
            </div>
            <div>
              <h3 className="font-bold text-lg">Location Display</h3>
              <p className="text-sm text-slate-400">Setup a kiosk screen</p>
            </div>
          </div>
          <div className="mt-4">
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Select Location
            </label>
            <div className="flex gap-2 mt-1">
              <select
                value={selectedLoc}
                onChange={(e) => setSelectedLoc(e.target.value)}
                className="flex-1 p-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {LOCATIONS.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
              </select>
              <button
                onClick={() => onSelect("kiosk", selectedLoc)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                Launch
              </button>
            </div>
          </div>
        </div>
        <button
          onClick={() => onSelect("admin")}
          className="flex items-center justify-center p-6 bg-white border-2 border-slate-200 rounded-xl hover:border-slate-800 transition-all group"
        >
          <div className="bg-slate-100 p-3 rounded-full mr-4 group-hover:bg-slate-800 group-hover:text-white transition-colors">
            <LayoutDashboard size={24} />
          </div>
          <div className="text-left">
            <h3 className="font-bold text-lg">Admin Dashboard</h3>
            <p className="text-sm text-slate-400">View all locations</p>
          </div>
        </button>
        <button
          onClick={() => onSelect("scanner")}
          className="flex items-center justify-center p-4 bg-green-50 border border-green-200 rounded-xl hover:bg-green-100 transition-all text-green-700"
        >
          <Smartphone size={20} className="mr-2" />
          <span className="font-medium">Test Scanner (QCA1)</span>
        </button>
      </div>
    </div>
  );
}

// --- SCREEN 2: KIOSK ---
function KioskScreen({ isReady, locationId }) {
  const [token, setToken] = useState("");
  const [timeLeft, setTimeLeft] = useState(TOKEN_VALIDITY_SECONDS);
  const [scanUrl, setScanUrl] = useState("");
  const [recentScans, setRecentScans] = useState([]);
  const [isUrlValid, setIsUrlValid] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [loadTime] = useState(Date.now());

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) document.exitFullscreen();
    }
  };

  useEffect(() => {
    let wakeLock = null;
    const requestWakeLock = async () => {
      try {
        if ("wakeLock" in navigator) {
          wakeLock = await navigator.wakeLock.request("screen");
          setWakeLockActive(true);
        }
      } catch (err) {
        console.error("Wake Lock failed:", err);
        setWakeLockActive(false);
      }
    };
    requestWakeLock();
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") requestWakeLock();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      if (wakeLock) wakeLock.release();
    };
  }, []);

  useEffect(() => {
    if (!isReady || !db) return;
    const unsub = onSnapshot(
      doc(db, SYSTEM_COLLECTION, "global_commands"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          if ((data.forceRefreshTimestamp?.toMillis() || 0) > loadTime)
            window.location.reload();
        }
      }
    );
    return () => unsub();
  }, [isReady, loadTime]);

  const handleDownloadCSV = async () => {
    if (!isReady || !db) return;
    setIsDownloading(true);
    try {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("locationId", "==", locationId)
      );
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map((doc) => doc.data());
      data.sort(
        (a, b) =>
          (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
      );
      const csvContent = [
        ["Queue Number", "Name", "Date", "Time", "Device ID", "Status"].join(
          ","
        ),
        ...data.map((d) => {
          const dt = d.timestamp ? d.timestamp.toDate() : new Date();
          return [
            d.queueNumber,
            `"${d.userName}"`,
            dt.toLocaleDateString(),
            dt.toLocaleTimeString(),
            `"${d.deviceId}"`,
            d.status || "N/A",
          ].join(",");
        }),
      ].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = window.URL.createObjectURL(blob);
      a.download = `${locationId}_Report.csv`;
      a.click();
    } catch (e) {
      alert("Export failed");
    } finally {
      setIsDownloading(false);
    }
  };

  useEffect(() => {
    const generateToken = () => {
      const timestamp = Math.floor(Date.now() / 1000 / TOKEN_VALIDITY_SECONDS);
      const newToken = `secure-${timestamp}`;
      setToken(newToken);
      setTimeLeft(TOKEN_VALIDITY_SECONDS);
      let currentUrl = window.location.href.split("?")[0];
      const qrParams = `view=scanner&token=${newToken}&locationId=${locationId}`;
      if (!currentUrl.startsWith("http")) {
        setScanUrl(`https://example.com/check-in-demo?${qrParams}`);
        setIsUrlValid(false);
      } else {
        setScanUrl(`${currentUrl}?${qrParams}`);
        setIsUrlValid(true);
      }
    };
    generateToken();
    const interval = setInterval(generateToken, TOKEN_VALIDITY_SECONDS * 1000);
    const timer = setInterval(
      () => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)),
      1000
    );
    return () => {
      clearInterval(interval);
      clearInterval(timer);
    };
  }, [locationId]);

  useEffect(() => {
    if (!isReady || !db) return;
    const safeQ = query(
      collection(db, COLLECTION_NAME),
      where("locationId", "==", locationId)
    );
    const unsubscribe = onSnapshot(safeQ, (snapshot) => {
      const allScans = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      allScans.sort(
        (a, b) =>
          (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
      );
      setRecentScans(allScans.slice(0, 5));
    });
    return () => unsubscribe();
  }, [isReady, locationId]);

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-900 text-white overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center p-8 border-r border-slate-700 relative">
        <div className="absolute top-6 left-6 bg-blue-600 px-4 py-2 rounded-lg font-bold flex items-center shadow-lg">
          <Building size={18} className="mr-2" /> {locationId}
        </div>
        <button
          onClick={toggleFullScreen}
          className="absolute top-6 right-6 bg-slate-800 hover:bg-slate-700 p-2 rounded-full border border-slate-600 transition-colors"
        >
          <Maximize size={20} />
        </button>
        <h2 className="text-3xl font-bold mb-10 tracking-wider">
          SCAN TO CHECK IN
        </h2>
        {!isUrlValid && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-yellow-500/20 border border-yellow-500 text-yellow-100 p-3 rounded-lg text-sm flex items-start gap-2 text-left">
            <Info size={18} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>Preview Mode:</strong> This QR uses a fallback URL.
            </div>
          </div>
        )}
        <div className="bg-white p-4 rounded-3xl shadow-2xl shadow-blue-500/20 w-[500px] h-[500px] flex items-center justify-center border-[10px] border-white">
          {scanUrl ? (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                scanUrl
              )}`}
              alt="QR"
              className="w-full h-full object-contain"
            />
          ) : (
            <Loader className="text-slate-400 animate-spin" size={64} />
          )}
        </div>
        <div className="mt-12 text-center">
          <div className="text-6xl font-mono font-bold text-blue-400">
            {timeLeft}s
          </div>
          <p className="text-slate-400 text-lg mt-2">
            Code refreshes automatically
          </p>
        </div>
      </div>
      <div className="w-full md:w-[450px] bg-slate-800 p-6 flex flex-col border-l border-slate-700 shadow-2xl z-10">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
            {locationId} Feed
          </h3>
          <div className="flex gap-2">
            {wakeLockActive && (
              <div className="px-2 py-1 bg-green-900/30 border border-green-500 text-green-400 text-[10px] rounded uppercase font-bold flex items-center">
                <Zap size={10} className="mr-1" /> ON
              </div>
            )}
            <button
              onClick={handleDownloadCSV}
              disabled={!isReady || isDownloading}
              className="flex items-center px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50"
            >
              {isDownloading ? (
                <Loader size={14} className="animate-spin" />
              ) : (
                <Download size={14} />
              )}
              <span className="ml-2">CSV</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {!isReady ? (
            <div className="text-center text-slate-500 mt-10">
              <Loader className="animate-spin mx-auto mb-2" /> Connecting...
            </div>
          ) : recentScans.length === 0 ? (
            <p className="text-slate-500 text-center italic mt-10">
              Waiting for scans...
            </p>
          ) : (
            recentScans.map((scan) => (
              <div
                key={scan.id}
                className="bg-slate-700 p-5 rounded-xl border-l-4 border-green-500 animate-in fade-in slide-in-from-right duration-500 shadow-sm"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-bold text-white text-lg">
                      {scan.userName}
                    </div>
                    <div className="text-slate-300 text-sm mt-1">
                      {scan.timestamp?.toDate().toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="bg-slate-800 px-4 py-2 rounded-lg text-green-400 font-mono font-bold text-2xl border border-slate-600">
                      #{scan.queueNumber}
                    </div>
                    {scan.status === "completed" && (
                      <span className="text-[10px] text-slate-400 mt-1 uppercase tracking-wider font-bold">
                        Checked Out
                      </span>
                    )}
                    {scan.status === "abandoned" && (
                      <span className="text-[10px] text-red-400 mt-1 uppercase tracking-wider font-bold">
                        Timed Out
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// --- SCREEN 3: ADMIN DASHBOARD ---
function AdminScreen({ isReady, onBack }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [passwordInput, setPasswordInput] = useState("");
  const [authError, setAuthError] = useState("");
  const [scans, setScans] = useState([]);
  const [filterLoc, setFilterLoc] = useState("ALL");
  const [filterDate, setFilterDate] = useState(
    new Date().toISOString().split("T")[0]
  );
  const [isRefreshingKiosks, setIsRefreshingKiosks] = useState(false);

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === "Anowforthewin") setIsAuthenticated(true);
    else setAuthError("Incorrect Password");
  };
  const handleRemoteRefresh = async () => {
    if (!db || !window.confirm("Reload ALL Kiosk screens?")) return;
    setIsRefreshingKiosks(true);
    try {
      await setDoc(
        doc(db, SYSTEM_COLLECTION, "global_commands"),
        { forceRefreshTimestamp: serverTimestamp() },
        { merge: true }
      );
      alert("Signal Sent!");
    } catch (e) {
      alert("Failed.");
    } finally {
      setIsRefreshingKiosks(false);
    }
  };
  const handleExport = async () => {
    if (!isReady || !db) return;
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);
    let data = snapshot.docs.map((doc) => doc.data());
    if (filterLoc !== "ALL")
      data = data.filter((d) => d.locationId === filterLoc);
    if (filterDate) {
      const sDate = new Date(filterDate).toDateString();
      data = data.filter((d) => d.timestamp?.toDate().toDateString() === sDate);
    }
    data.sort(
      (a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
    );
    const csvContent = [
      ["Location", "Queue Number", "Name", "Time", "Status"].join(","),
      ...data.map((d) =>
        [
          d.locationId,
          d.queueNumber,
          `"${d.userName}"`,
          d.timestamp?.toDate().toLocaleTimeString(),
          d.status || "waiting",
        ].join(",")
      ),
    ].join("\n");
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(
      new Blob([csvContent], { type: "text/csv" })
    );
    a.download = `Report.csv`;
    a.click();
  };

  useEffect(() => {
    if (!isReady || !db || !isAuthenticated) return;
    const q = query(collection(db, COLLECTION_NAME));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      if (filterLoc !== "ALL")
        data = data.filter((d) => d.locationId === filterLoc);
      if (filterDate) {
        const sDate = new Date(filterDate).toDateString();
        data = data.filter(
          (d) => d.timestamp?.toDate().toDateString() === sDate
        );
      }
      data.sort(
        (a, b) =>
          (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
      );
      setScans(data.slice(0, 200));
    });
    return () => unsubscribe();
  }, [isReady, filterLoc, filterDate, isAuthenticated]);

  if (!isAuthenticated)
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full">
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">
            Admin Access
          </h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              className="w-full px-4 py-2 border rounded-lg"
              placeholder="Password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />
            {authError && (
              <p className="text-red-500 text-sm text-center">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold"
            >
              Unlock
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full py-3 text-slate-500"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8 gap-4">
          <button onClick={onBack} className="p-2 bg-white rounded-lg">
            <X size={20} />
          </button>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
        <div className="flex gap-4 mb-8">
          <button
            onClick={handleRemoteRefresh}
            disabled={isRefreshingKiosks}
            className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold"
          >
            {isRefreshingKiosks ? "Sending..." : "Force Refresh Kiosks"}
          </button>
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold"
          >
            Export CSV
          </button>
        </div>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b">
              <tr>
                <th className="px-6 py-4">Loc</th>
                <th className="px-6 py-4">#</th>
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {scans.map((s) => (
                <tr key={s.id}>
                  <td className="px-6 py-4">{s.locationId}</td>
                  <td className="px-6 py-4 font-bold">#{s.queueNumber}</td>
                  <td className="px-6 py-4">{s.userName}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        s.status === "completed"
                          ? "bg-gray-100 text-gray-500"
                          : s.status === "abandoned"
                          ? "bg-red-100 text-red-500"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {s.status || "waiting"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- SCREEN 4: SCANNER (Updated with Inactivity Modal) ---
function ScannerScreen({ token, locationId, isReady, user }) {
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [myQueueNumber, setMyQueueNumber] = useState(null);
  const [myDocId, setMyDocId] = useState(null);
  const [peopleAhead, setPeopleAhead] = useState(0);
  const [isCheckedOut, setIsCheckedOut] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [emailInput, setEmailInput] = useState("");

  const [lastInteraction, setLastInteraction] = useState(Date.now());
  const [showInactivityModal, setShowInactivityModal] = useState(false);
  const [countdown, setCountdown] = useState(TIMEOUT_SECONDS);

  // ✅ 1. INACTIVITY MONITORING (5 Mins)
  useEffect(() => {
    // Only run if user is waiting, not checked out, and not already seeing modal
    if (status !== "success" || isCheckedOut || !myDocId) return;

    const interval = setInterval(() => {
      // Check difference between NOW and Last Interaction
      if (Date.now() - lastInteraction > CHECK_INTERVAL_MS) {
        if (!showInactivityModal) {
          setShowInactivityModal(true);
          setCountdown(TIMEOUT_SECONDS);
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [status, lastInteraction, showInactivityModal, myDocId, isCheckedOut]);

  // ✅ 2. COUNTDOWN TIMER (Inside Modal)
  useEffect(() => {
    if (!showInactivityModal) return;
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          handleUserTimeout(); // Time is up!
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [showInactivityModal]);

  // ✅ 3. HANDLE TIMEOUT (ABANDON QUEUE)
  const handleUserTimeout = async () => {
    setShowInactivityModal(false);
    setIsCheckedOut(true); // Treat as checked out visually
    if (db && myDocId) {
      try {
        await updateDoc(doc(db, COLLECTION_NAME, myDocId), {
          status: "abandoned",
        });
      } catch (e) {
        console.error("Update failed", e);
      }
    }
  };

  // ✅ 4. HANDLE "I'M HERE" (KEEP QUEUE)
  const handleUserPresent = async () => {
    setShowInactivityModal(false);
    setLastInteraction(Date.now()); // Reset clock
    if (db && myDocId) {
      // Optional: Update lastActive timestamp in DB
      await updateDoc(doc(db, COLLECTION_NAME, myDocId), {
        lastActive: serverTimestamp(),
      });
    }
  };

  // Sound Logic
  useEffect(() => {
    if (status === "success" && !isCheckedOut && peopleAhead === 0) {
      const audio = new Audio(
        "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
      );
      audio.play().catch((e) => console.log("Audio failed", e));
    }
  }, [peopleAhead, status, isCheckedOut]);

  // Queue Counter
  useEffect(() => {
    if (
      status === "success" &&
      myQueueNumber &&
      !isCheckedOut &&
      isReady &&
      db
    ) {
      const q = query(
        collection(db, COLLECTION_NAME),
        where("locationId", "==", locationId),
        where("status", "==", "waiting")
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const count = snapshot.docs
          .map((d) => d.data())
          .filter((user) => user.queueNumber < myQueueNumber).length;
        setPeopleAhead(count);
      });
      return () => unsubscribe();
    }
  }, [status, myQueueNumber, isCheckedOut, locationId, isReady]);

  // Manual Checkout
  const handleCheckout = async () => {
    if (!myDocId) return;
    setIsCheckingOut(true);
    try {
      await updateDoc(doc(db, COLLECTION_NAME, myDocId), {
        status: "completed",
        checkoutTime: serverTimestamp(),
      });
      setIsCheckedOut(true);
    } catch (e) {
      alert("Error");
    } finally {
      setIsCheckingOut(false);
    }
  };

  // ID & Checkin Logic
  const generateNativeFingerprint = async () =>
    "fp_" + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!isReady || !db) return;
    const init = async () => {
      setStatus("initializing");
      const STORAGE_KEY = "secure_user_badge";
      try {
        let storedBadge = localStorage.getItem(STORAGE_KEY);
        const fp = await generateNativeFingerprint();
        setFingerprint(fp);
        if (storedBadge) {
          setDeviceId(storedBadge);
          const snap = await getDoc(doc(db, DEVICES_COLLECTION, storedBadge));
          if (snap.exists()) {
            setUserEmail(snap.data().email);
            setShowPermissionModal(true);
          } else setShowEmailModal(true);
        } else setShowEmailModal(true);
        setStatus("idle");
      } catch (e) {
        setStatus("error");
        setErrorMsg("Init failed");
      }
    };
    init();
  }, [isReady]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!emailInput.includes("@")) return alert("Invalid Email");
    setIsRecovering(true);
    try {
      const badgeId = "badge_" + Date.now().toString(36);
      await setDoc(doc(db, DEVICES_COLLECTION, badgeId), {
        email: emailInput,
        fingerprint: fingerprint,
      });
      localStorage.setItem("secure_user_badge", badgeId);
      setDeviceId(badgeId);
      setUserEmail(emailInput);
      setShowEmailModal(false);
      setShowPermissionModal(true);
    } catch (e) {
      alert("Error");
    } finally {
      setIsRecovering(false);
    }
  };

  const confirmAndCheckIn = () => {
    setShowPermissionModal(false);
    setStatus("locating");
    if (!navigator.geolocation) return setStatus("error");
    navigator.geolocation.getCurrentPosition(
      (pos) => saveCheckIn(pos.coords),
      () => setStatus("error")
    );
  };

  const saveCheckIn = async (coords) => {
    setStatus("saving");
    try {
      const duplicateQ = query(
        collection(db, COLLECTION_NAME),
        where("deviceId", "==", deviceId),
        where("tokenUsed", "==", token)
      );
      const duplicateSnap = await getDocs(duplicateQ);
      if (!duplicateSnap.empty) {
        const existingDoc = duplicateSnap.docs[0];
        const d = existingDoc.data();
        setMyQueueNumber(d.queueNumber);
        setMyDocId(existingDoc.id);
        if (d.status === "completed" || d.status === "abandoned")
          setIsCheckedOut(true);
        setStatus("success");
        return;
      }
    } catch (e) {
      console.warn(e);
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const newRef = doc(collection(db, COLLECTION_NAME));
    try {
      const qNum = await runTransaction(db, async (t) => {
        const cRef = doc(db, COUNTER_COLLECTION, locationId);
        const cSnap = await t.get(cRef);
        let next = 1;
        if (cSnap.exists() && cSnap.data().date === todayStr)
          next = cSnap.data().count + 1;
        t.set(cRef, { date: todayStr, count: next, locationId });
        t.set(newRef, {
          userName: userEmail,
          locationId,
          queueNumber: next,
          deviceId,
          timestamp: serverTimestamp(),
          status: "waiting",
          location: { lat: coords.latitude, lng: coords.longitude },
          tokenUsed: token,
          fingerprint,
        });
        return next;
      });
      setMyQueueNumber(qNum);
      setMyDocId(newRef.id);
      setStatus("success");
    } catch (e) {
      setStatus("error");
      setErrorMsg("Failed to check in");
    }
  };

  // --- UI STATES ---
  if (status === "success") {
    // 1. CHECKED OUT SCREEN (Either Manual or Timeout)
    if (isCheckedOut)
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-100 text-center animate-in zoom-in">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-gray-500">
            <LogOut size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            You have left the queue
          </h2>
          <p className="text-gray-500 mb-6">Your spot has been removed.</p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold"
          >
            New Check In
          </button>
        </div>
      );

    // 2. ACTIVE QUEUE SCREEN
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-green-50 text-center animate-in zoom-in relative">
        {/* --- INACTIVITY MODAL --- */}
        {showInactivityModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in">
            <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl text-center">
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4 text-yellow-600 animate-pulse">
                <AlertTriangle size={32} />
              </div>
              <h3 className="text-2xl font-bold text-slate-800">
                Are you there?
              </h3>
              <p className="text-slate-500 mb-6">Confirm to keep your spot.</p>
              <div className="text-5xl font-mono font-bold text-red-500 mb-6">
                00:{countdown.toString().padStart(2, "0")}
              </div>
              <div className="flex flex-col gap-3">
                <button
                  onClick={handleUserPresent}
                  className="w-full py-3 bg-green-600 text-white rounded-xl font-bold active:scale-95"
                >
                  YES, I'M HERE!
                </button>
                <button
                  onClick={handleCheckout}
                  className="w-full py-3 bg-gray-200 text-gray-700 rounded-xl font-bold"
                >
                  Leave Queue
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600">
          <CheckCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-green-800 mb-2">
          Check-In Successful
        </h2>
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-green-200 mt-4 mb-6 w-full max-w-xs">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">
            {locationId} Ticket
          </div>
          <div className="text-6xl font-black text-slate-800">
            #{myQueueNumber}
          </div>
          <div className="text-sm font-semibold text-blue-600 mt-2">
            {userEmail}
          </div>
        </div>
        <div className="w-full max-w-xs mb-8">
          <div
            className={`${
              peopleAhead === 0 ? "bg-green-600" : "bg-blue-600"
            } text-white p-4 rounded-xl shadow-md transition-colors`}
          >
            <div className="text-xs uppercase font-bold opacity-80 mb-1">
              Users Remaining Before You
            </div>
            <div className="text-4xl font-bold">
              {peopleAhead === 0 ? "It's your turn!" : peopleAhead}
            </div>
          </div>
        </div>
        <button
          onClick={handleCheckout}
          disabled={isCheckingOut}
          className="w-full max-w-xs py-4 bg-red-500 text-white rounded-xl font-bold shadow-lg flex items-center justify-center"
        >
          {isCheckingOut ? (
            <Loader className="animate-spin mr-2" />
          ) : (
            <LogOut className="mr-2" />
          )}{" "}
          Checkout / Leave Queue
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col items-center justify-center">
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80">
          <div className="bg-white p-8 rounded-2xl max-w-sm w-full">
            <div className="flex justify-center mb-4 text-blue-600">
              <Mail size={40} />
            </div>
            <h3 className="text-xl font-bold mb-2 text-center">
              Identity Check
            </h3>
            <form onSubmit={handleEmailSubmit}>
              <input
                type="email"
                required
                className="w-full px-4 py-3 border rounded-xl mb-4"
                placeholder="Email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
              <button
                type="submit"
                disabled={isRecovering}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold"
              >
                {isRecovering ? "Verifying..." : "Continue"}
              </button>
            </form>
          </div>
        </div>
      )}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full">
            <h3 className="text-lg font-bold mb-2">
              Check in at {locationId}?
            </h3>
            <button
              onClick={confirmAndCheckIn}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold"
            >
              Allow & Check In
            </button>
          </div>
        </div>
      )}
      <div className="text-center">
        {status !== "idle" && (
          <Loader className="animate-spin mx-auto mb-4 text-blue-500" />
        )}
        <p className="text-slate-500">
          {status === "idle" || status === "initializing"
            ? "Verifying..."
            : "Saving..."}
        </p>
        {errorMsg && <p className="text-red-500 mt-2">{errorMsg}</p>}
      </div>
    </div>
  );
}
