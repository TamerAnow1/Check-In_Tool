import React, { useState, useEffect, useRef } from "react";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  serverTimestamp,
  query,
  orderBy,
  limit,
  onSnapshot,
  where,
  runTransaction,
  doc,
  setDoc,
  getDoc,
  updateDoc,
} from "firebase/firestore";
import { getAuth, signInAnonymously, onAuthStateChanged } from "firebase/auth";
import {
  AlertCircle,
  CheckCircle,
  MapPin,
  Smartphone,
  User,
  Loader,
  Shield,
  X,
  Info,
  Download,
  Fingerprint,
  Ticket,
  Building,
  LayoutDashboard,
  Filter,
  Calendar,
  Lock,
  Mail,
  RefreshCw,
  Zap,
  LogOut,
  Maximize, // New Icon for Fullscreen
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
        #csb-status-bar {
          display: none !important;
          visibility: hidden !important;
          pointer-events: none !important;
          opacity: 0 !important;
          z-index: -9999 !important;
        }
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
      setParams({
        token: `secure-${timestamp}`,
        locationId: "QCA1",
      });
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

// --- SCREEN 2: KIOSK (Visual Updates) ---
function KioskScreen({ isReady, locationId }) {
  const [token, setToken] = useState("");
  const [timeLeft, setTimeLeft] = useState(TOKEN_VALIDITY_SECONDS);
  const [scanUrl, setScanUrl] = useState("");
  const [recentScans, setRecentScans] = useState([]);
  const [isUrlValid, setIsUrlValid] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const [loadTime] = useState(Date.now());

  // Full Screen Toggle
  const toggleFullScreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
  };

  // Wake Lock
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

  // Remote Refresh
  useEffect(() => {
    if (!isReady || !db) return;
    const unsub = onSnapshot(
      doc(db, SYSTEM_COLLECTION, "global_commands"),
      (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data();
          const refreshTime = data.forceRefreshTimestamp?.toMillis() || 0;
          if (refreshTime > loadTime) window.location.reload();
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
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
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
      {/* LEFT SIDE: QR CODE */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 border-r border-slate-700 relative">
        <div className="absolute top-6 left-6 bg-blue-600 px-4 py-2 rounded-lg font-bold flex items-center shadow-lg">
          <Building size={18} className="mr-2" /> {locationId}
        </div>

        {/* FULLSCREEN BUTTON */}
        <button
          onClick={toggleFullScreen}
          className="absolute top-6 right-6 bg-slate-800 hover:bg-slate-700 p-2 rounded-full border border-slate-600 transition-colors"
          title="Enter Full Screen"
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

        {/* ✅ UPDATED QR CONTAINER: MUCH LARGER */}
        <div className="bg-white p-4 rounded-3xl shadow-2xl shadow-blue-500/20 w-[500px] h-[500px] flex items-center justify-center border-[10px] border-white">
          {scanUrl ? (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(
                scanUrl
              )}`}
              alt="Scan this QR code"
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

      {/* RIGHT SIDE: FEED */}
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

// --- SCREEN 3: ADMIN DASHBOARD (Unchanged) ---
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
    if (passwordInput === "Anowforthewin") {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Incorrect Password");
    }
  };

  const handleRemoteRefresh = async () => {
    if (!db) return;
    const confirmRef = window.confirm(
      "Are you sure? This will reload ALL Kiosk screens immediately."
    );
    if (!confirmRef) return;
    setIsRefreshingKiosks(true);
    try {
      await setDoc(
        doc(db, SYSTEM_COLLECTION, "global_commands"),
        { forceRefreshTimestamp: serverTimestamp() },
        { merge: true }
      );
      alert("Refresh Signal Sent!");
    } catch (e) {
      alert("Failed to send signal.");
    } finally {
      setIsRefreshingKiosks(false);
    }
  };

  const handleExport = async () => {
    if (!isReady || !db) return;
    try {
      const q = query(collection(db, COLLECTION_NAME));
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map((doc) => doc.data());

      if (filterLoc !== "ALL")
        data = data.filter((d) => d.locationId === filterLoc);
      if (filterDate) {
        const selectedDateStr = new Date(filterDate).toDateString();
        data = data.filter(
          (d) => d.timestamp?.toDate().toDateString() === selectedDateStr
        );
      }
      data.sort(
        (a, b) =>
          (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
      );
      const csvContent = [
        [
          "Location",
          "Queue Number",
          "Name",
          "Date",
          "Time",
          "Device ID",
          "Status",
        ].join(","),
        ...data.map((d) => {
          const dt = d.timestamp ? d.timestamp.toDate() : new Date();
          return [
            d.locationId,
            d.queueNumber,
            `"${d.userName}"`,
            dt.toLocaleDateString(),
            dt.toLocaleTimeString(),
            `"${d.deviceId}"`,
            d.status || "waiting",
          ].join(",");
        }),
      ].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Report_${filterLoc}_${filterDate}.csv`;
      a.click();
    } catch (e) {
      alert("Export failed");
    }
  };

  useEffect(() => {
    if (!isReady || !db || !isAuthenticated) return;
    const q = query(collection(db, COLLECTION_NAME));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      if (filterLoc !== "ALL") {
        data = data.filter((d) => d.locationId === filterLoc);
      }
      if (filterDate) {
        const selectedDateStr = new Date(filterDate).toDateString();
        data = data.filter((d) => {
          if (!d.timestamp) return false;
          return d.timestamp.toDate().toDateString() === selectedDateStr;
        });
      }
      data.sort(
        (a, b) =>
          (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
      );
      setScans(data.slice(0, 200));
    });
    return () => unsubscribe();
  }, [isReady, filterLoc, filterDate, isAuthenticated]);

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
        <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full">
          <div className="flex justify-center mb-6 text-blue-600">
            <Lock size={48} />
          </div>
          <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">
            Admin Access
          </h2>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              placeholder="Enter password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              autoFocus
            />
            {authError && (
              <p className="text-red-500 text-sm text-center">{authError}</p>
            )}
            <button
              type="submit"
              className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700"
            >
              Unlock Dashboard
            </button>
            <button
              type="button"
              onClick={onBack}
              className="w-full py-3 text-slate-500 font-medium hover:text-slate-700"
            >
              Cancel
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-center mb-8 gap-4">
          <div className="flex items-center gap-4">
            <button
              onClick={onBack}
              className="p-2 bg-white rounded-lg hover:bg-slate-50"
            >
              <X size={20} />
            </button>
            <h1 className="text-2xl font-bold text-slate-800">
              Admin Dashboard
            </h1>
          </div>
          <div className="flex flex-wrap gap-4 w-full md:w-auto items-center">
            <button
              onClick={handleRemoteRefresh}
              disabled={isRefreshingKiosks}
              className="flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-bold shadow-sm transition-colors"
            >
              <Zap size={16} className="mr-2" /> Force Refresh Kiosks
            </button>
            <div className="flex items-center bg-white px-3 py-2 rounded-lg border border-slate-200">
              <Filter size={16} className="text-slate-400 mr-2" />
              <select
                value={filterLoc}
                onChange={(e) => setFilterLoc(e.target.value)}
                className="bg-transparent outline-none text-sm font-medium"
              >
                <option value="ALL">All Locations</option>
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold"
            >
              <Download size={16} className="mr-2" /> Export CSV
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                  Location
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                  Queue #
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                  User
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scans.map((scan) => (
                <tr
                  key={scan.id}
                  className="hover:bg-slate-50 transition-colors"
                >
                  <td className="px-6 py-4">{scan.locationId}</td>
                  <td className="px-6 py-4 font-bold">#{scan.queueNumber}</td>
                  <td className="px-6 py-4">{scan.userName}</td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 rounded text-xs ${
                        scan.status === "completed"
                          ? "bg-gray-100 text-gray-500"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {scan.status || "waiting"}
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

// --- SCREEN 4: SCANNER (With Sound Notification) ---
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

  // ✅ SOUND NOTIFICATION LOGIC
  useEffect(() => {
    if (status === "success" && !isCheckedOut && peopleAhead === 0) {
      // Simple "Ding" sound
      const audio = new Audio(
        "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
      );
      audio
        .play()
        .catch((e) =>
          console.log("Audio play failed (user interaction needed first)", e)
        );
    }
  }, [peopleAhead, status, isCheckedOut]);

  const generateNativeFingerprint = async () => {
    const components = [
      navigator.userAgent,
      navigator.language,
      window.screen.colorDepth,
      window.screen.width + "x" + window.screen.height,
      new Date().getTimezoneOffset(),
      navigator.hardwareConcurrency || "unknown",
    ];
    const str = components.join("||");
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash;
    }
    return "fp_" + Math.abs(hash);
  };

  useEffect(() => {
    if (!isReady || !db) return;
    const identifyDevice = async () => {
      setStatus("initializing");
      const STORAGE_KEY = "secure_user_badge";
      try {
        let storedBadge = localStorage.getItem(STORAGE_KEY);
        const fp = await generateNativeFingerprint();
        setFingerprint(fp);

        if (storedBadge) {
          setDeviceId(storedBadge);
          const deviceRef = doc(db, DEVICES_COLLECTION, storedBadge);
          const deviceSnap = await getDoc(deviceRef);
          if (deviceSnap.exists()) {
            setUserEmail(deviceSnap.data().email);
            setShowPermissionModal(true);
          } else {
            setShowEmailModal(true);
          }
        } else {
          setShowEmailModal(true);
        }
        setStatus("idle");
      } catch (err) {
        console.error("ID Logic Error", err);
        setErrorMsg("Initialization failed. Please refresh.");
        setStatus("error");
      }
    };
    identifyDevice();
  }, [isReady]);

  // QUEUE COUNTER
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
        const waitingUsers = snapshot.docs.map((d) => d.data());
        const count = waitingUsers.filter(
          (user) => user.queueNumber < myQueueNumber
        ).length;
        setPeopleAhead(count);
      });
      return () => unsubscribe();
    }
  }, [status, myQueueNumber, isCheckedOut, locationId, isReady]);

  const handleCheckout = async () => {
    if (!myDocId) return;
    setIsCheckingOut(true);
    try {
      const docRef = doc(db, COLLECTION_NAME, myDocId);
      await updateDoc(docRef, {
        status: "completed",
        checkoutTime: serverTimestamp(),
      });
      setIsCheckedOut(true);
    } catch (e) {
      console.error("Checkout Error", e);
      alert("Could not check out. Please try again.");
    } finally {
      setIsCheckingOut(false);
    }
  };

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!emailInput.includes("@") || emailInput.length < 5) {
      alert("Please enter a valid email address.");
      return;
    }
    const emailRegex =
      /^[\w-\.]+@(gmail|outlook|speedo-delivery|topdeliveryeg)\.(com|art)$/i;

    if (!emailRegex.test(emailInput)) {
      alert("Access Denied: Please use a valid company email.");
      return;
    }

    setIsRecovering(true);
    const STORAGE_KEY = "secure_user_badge";
    try {
      const q = query(
        collection(db, DEVICES_COLLECTION),
        where("email", "==", emailInput),
        limit(1)
      );
      const querySnapshot = await getDocs(q);
      let finalBadgeId = "";
      if (!querySnapshot.empty) {
        finalBadgeId = querySnapshot.docs[0].id;
      } else {
        finalBadgeId =
          "badge_" +
          Math.random().toString(36).substr(2, 9) +
          Date.now().toString(36);
        await setDoc(doc(db, DEVICES_COLLECTION, finalBadgeId), {
          email: emailInput,
          fingerprint: fingerprint,
          firstSeen: serverTimestamp(),
        });
      }
      localStorage.setItem(STORAGE_KEY, finalBadgeId);
      setDeviceId(finalBadgeId);
      setUserEmail(emailInput);
      setShowEmailModal(false);
      setShowPermissionModal(true);
    } catch (err) {
      console.error("Registration failed", err);
      alert("System error. Please try again.");
    } finally {
      setIsRecovering(false);
    }
  };

  const confirmAndCheckIn = async () => {
    setShowPermissionModal(false);
    setStatus("locating");
    if (!navigator.geolocation) {
      setErrorMsg("Geolocation not supported.");
      setStatus("error");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => saveCheckIn(pos.coords),
      (err) => {
        setErrorMsg("Location access denied.");
        setStatus("error");
      },
      { enableHighAccuracy: true }
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
        const existingData = existingDoc.data();
        setMyQueueNumber(existingData.queueNumber);
        setMyDocId(existingDoc.id);

        if (existingData.status === "completed") {
          setIsCheckedOut(true);
        }

        setStatus("success");
        return;
      }
    } catch (e) {
      console.warn("Duplicate check warning:", e);
    }

    const MAX_RETRIES = 20;
    let attempt = 0;
    let success = false;

    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      if (!auth?.currentUser) {
        setErrorMsg("Network connection unstable.");
        setStatus("error");
        return;
      }
    }

    const currentTimestamp = Math.floor(
      Date.now() / 1000 / TOKEN_VALIDITY_SECONDS
    );
    const tokenTimestamp = parseInt(token.split("-")[1]);
    const PAST_BUFFER = 8;
    const FUTURE_BUFFER = 2;

    const isValid =
      token.startsWith("secure-") &&
      tokenTimestamp >= currentTimestamp - PAST_BUFFER &&
      tokenTimestamp <= currentTimestamp + FUTURE_BUFFER;

    if (!isValid) {
      setErrorMsg("QR Code Invalid. Please refresh and scan again.");
      setStatus("error");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const counterRef = doc(db, COUNTER_COLLECTION, locationId);
    const newCheckInRef = doc(collection(db, COLLECTION_NAME));
    const newDocId = newCheckInRef.id;

    while (attempt < MAX_RETRIES && !success) {
      try {
        attempt++;
        if (attempt > 1)
          setErrorMsg(`Queue busy, retrying (${attempt}/${MAX_RETRIES})...`);

        const assignedQueueNumber = await runTransaction(
          db,
          async (transaction) => {
            const counterDoc = await transaction.get(counterRef);
            let nextNum = 1;
            if (counterDoc.exists()) {
              const data = counterDoc.data();
              if (data.date === todayStr) {
                nextNum = data.count + 1;
              } else {
                nextNum = 1;
              }
            }
            transaction.set(counterRef, {
              date: todayStr,
              count: nextNum,
              locationId: locationId,
            });
            transaction.set(newCheckInRef, {
              userName: userEmail || "Anonymous",
              locationId: locationId,
              location: {
                lat: coords.latitude,
                lng: coords.longitude,
                accuracy: coords.accuracy,
              },
              tokenUsed: token,
              deviceId: deviceId,
              fingerprint: fingerprint,
              deviceInfo: navigator.userAgent,
              queueNumber: nextNum,
              timestamp: serverTimestamp(),
              status: "waiting",
            });
            return nextNum;
          }
        );

        setMyQueueNumber(assignedQueueNumber);
        setMyDocId(newDocId);
        setErrorMsg("");
        setStatus("success");
        success = true;
      } catch (err) {
        if (attempt >= MAX_RETRIES) {
          setErrorMsg("System busy. Please try scanning again.");
          setStatus("error");
        } else {
          const backoff = Math.min(5000, Math.pow(2, attempt) * 200);
          const jitter = Math.floor(Math.random() * 200);
          await new Promise((resolve) => setTimeout(resolve, backoff + jitter));
        }
      }
    }
  };

  if (status === "success") {
    if (isCheckedOut) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-100 text-center animate-in zoom-in duration-300">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-gray-500">
            <LogOut size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            You have checked out
          </h2>
          <p className="text-gray-500 mb-6">
            Thank you! You have been removed from the queue.
          </p>
          <div className="bg-white p-4 rounded shadow-sm text-sm">
            Ticket #{myQueueNumber} Completed
          </div>
        </div>
      );
    }
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-green-50 text-center animate-in zoom-in duration-300">
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
            } text-white p-4 rounded-xl shadow-md transition-colors duration-500`}
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
          className="w-full max-w-xs py-4 bg-red-500 text-white rounded-xl font-bold shadow-lg hover:bg-red-600 transition-all flex items-center justify-center"
        >
          {isCheckingOut ? (
            <Loader className="animate-spin mr-2" />
          ) : (
            <LogOut className="mr-2" />
          )}
          Checkout / Leave Queue
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col items-center justify-center">
      {showEmailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white p-8 rounded-2xl max-w-sm w-full shadow-2xl">
            <div className="flex justify-center mb-4 text-blue-600">
              <Mail size={40} />
            </div>
            <h3 className="text-xl font-bold mb-2 text-center text-slate-800">
              Identity Check
            </h3>
            <p className="text-sm text-slate-500 mb-6 text-center">
              Please confirm your email to verify your device.
            </p>
            <form onSubmit={handleEmailSubmit}>
              <input
                type="email"
                required
                className="w-full px-4 py-3 border border-slate-300 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="name@company.com"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
              />
              <button
                type="submit"
                disabled={isRecovering}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors flex items-center justify-center"
              >
                {isRecovering ? (
                  <>
                    <RefreshCw className="animate-spin mr-2" size={20} />{" "}
                    Verifying...
                  </>
                ) : (
                  "Continue"
                )}
              </button>
            </form>
          </div>
        </div>
      )}
      {showPermissionModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white p-6 rounded-2xl max-w-sm w-full shadow-2xl">
            <h3 className="text-lg font-bold mb-2">
              Check in at {locationId}?
            </h3>
            <p className="text-sm text-slate-500 mb-4">
              We need your Location to verify you are physically present.
              <br />
              <span className="text-xs font-semibold text-blue-600 mt-1 block">
                Checking in as: {userEmail}
              </span>
            </p>
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
            ? "Verifying Device..."
            : status === "locating"
            ? "Checking Location..."
            : "Saving Data..."}
        </p>
        {errorMsg && <p className="text-red-500 mt-2">{errorMsg}</p>}
      </div>
    </div>
  );
}

