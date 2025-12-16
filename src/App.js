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
  RefreshCw, // Icon for recovery
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

// ✅ 30-Second QR Refresh
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
        /* Hide CodeSandbox bottom-right button */
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
  // -------------------------------------

  // ✅ CHANGED: Removed setTimeout for Instant Loading
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

// --- SCREEN 2: KIOSK ---
function KioskScreen({ isReady, locationId }) {
  const [token, setToken] = useState("");
  const [timeLeft, setTimeLeft] = useState(TOKEN_VALIDITY_SECONDS);
  const [scanUrl, setScanUrl] = useState("");
  const [recentScans, setRecentScans] = useState([]);
  const [isUrlValid, setIsUrlValid] = useState(true);
  const [isDownloading, setIsDownloading] = useState(false);

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
        ["Queue Number", "Name", "Date", "Time", "Device ID"].join(","),
        ...data.map((d) => {
          const dt = d.timestamp ? d.timestamp.toDate() : new Date();
          return [
            d.queueNumber,
            `"${d.userName}"`,
            dt.toLocaleDateString(),
            dt.toLocaleTimeString(),
            `"${d.deviceId}"`,
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

      // Detect Preview
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
    <div className="flex flex-col md:flex-row h-screen bg-slate-900 text-white">
      <div className="flex-1 flex flex-col items-center justify-center p-8 border-r border-slate-700 relative">
        <div className="absolute top-6 left-6 bg-blue-600 px-4 py-2 rounded-lg font-bold flex items-center shadow-lg">
          <Building size={18} className="mr-2" /> {locationId}
        </div>

        <h2 className="text-2xl font-bold mb-8 tracking-wider">
          SCAN TO CHECK IN
        </h2>

        {!isUrlValid && (
          <div className="absolute top-20 left-4 right-4 bg-yellow-500/20 border border-yellow-500 text-yellow-100 p-3 rounded-lg text-sm flex items-start gap-2 text-left">
            <Info size={18} className="mt-0.5 flex-shrink-0" />
            <div>
              <strong>Preview Mode:</strong> This QR uses a fallback URL.
            </div>
          </div>
        )}

        <div className="bg-white p-4 rounded-xl shadow-2xl shadow-blue-500/20 w-64 h-64 flex items-center justify-center">
          {scanUrl ? (
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(
                scanUrl
              )}`}
              alt="Scan this QR code"
              className="w-full h-full object-contain"
            />
          ) : (
            <Loader className="text-slate-400 animate-spin" />
          )}
        </div>

        <div className="mt-8 text-center">
          <div className="text-4xl font-mono font-bold text-blue-400">
            {timeLeft}s
          </div>
          <p className="text-slate-400 text-sm mt-2">
            Code refreshes automatically
          </p>
        </div>
      </div>

      <div className="w-full md:w-96 bg-slate-800 p-6 overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold flex items-center">
            <div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>
            {locationId} Feed
          </h3>
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

        <div className="flex-1 overflow-y-auto space-y-4">
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
                className="bg-slate-700 p-4 rounded-lg border-l-4 border-green-500 animate-in fade-in slide-in-from-right duration-500"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <div className="font-bold text-white">{scan.userName}</div>
                    <div className="text-slate-300 text-xs mt-1">
                      {scan.timestamp?.toDate().toLocaleTimeString()}
                    </div>
                  </div>
                  <div className="bg-slate-800 px-3 py-1 rounded text-green-400 font-mono font-bold text-lg">
                    #{scan.queueNumber}
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

  const handleLogin = (e) => {
    e.preventDefault();
    if (passwordInput === "Anowforthewin") {
      setIsAuthenticated(true);
      setAuthError("");
    } else {
      setAuthError("Incorrect Password");
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
        ["Location", "Queue Number", "Name", "Date", "Time", "Device ID"].join(
          ","
        ),
        ...data.map((d) => {
          const dt = d.timestamp ? d.timestamp.toDate() : new Date();
          return [
            d.locationId,
            d.queueNumber,
            `"${d.userName}"`,
            dt.toLocaleDateString(),
            dt.toLocaleTimeString(),
            `"${d.deviceId}"`,
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
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Password
              </label>
              <input
                type="password"
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                placeholder="Enter password"
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                autoFocus
              />
            </div>
            {authError && (
              <p className="text-red-500 text-sm text-center font-medium">
                {authError}
              </p>
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
            <div className="flex items-center bg-white px-3 py-2 rounded-lg border border-slate-200">
              <Filter size={16} className="text-slate-400 mr-2" />
              <select
                value={filterLoc}
                onChange={(e) => setFilterLoc(e.target.value)}
                className="bg-transparent outline-none text-sm font-medium"
              >
                <option value="ALL">All 30 Locations</option>
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>
                    {l}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center bg-white px-3 py-2 rounded-lg border border-slate-200">
              <Calendar size={16} className="text-slate-400 mr-2" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="bg-transparent outline-none text-sm font-medium text-slate-700"
              />
            </div>

            <button
              onClick={handleExport}
              className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-bold"
            >
              <Download size={16} className="mr-2" /> Export CSV
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-slate-500 text-sm font-semibold uppercase">
              Total Scans
            </div>
            <div className="text-3xl font-bold text-slate-800">
              {scans.length}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-slate-500 text-sm font-semibold uppercase">
              Active Locations
            </div>
            <div className="text-3xl font-bold text-blue-600">
              {filterLoc === "ALL"
                ? new Set(scans.map((s) => s.locationId)).size
                : 1}
            </div>
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="text-slate-500 text-sm font-semibold uppercase">
              Live Feed
            </div>
            <div className="flex items-center mt-1">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse mr-2"></div>
              <span className="text-sm text-green-600 font-medium">
                {isReady ? "Real-time updates active" : "Connecting..."}
              </span>
            </div>
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
                  Time
                </th>
                <th className="px-6 py-4 text-xs font-semibold text-slate-500 uppercase">
                  Device ID
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {!isReady ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-8 text-center text-slate-400"
                  >
                    Loading data...
                  </td>
                </tr>
              ) : scans.length === 0 ? (
                <tr>
                  <td
                    colSpan="5"
                    className="px-6 py-8 text-center text-slate-400"
                  >
                    No records found.
                  </td>
                </tr>
              ) : (
                scans.map((scan) => (
                  <tr
                    key={scan.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">
                        {scan.locationId}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-slate-700">
                      #{scan.queueNumber}
                    </td>
                    <td className="px-6 py-4 text-slate-800">
                      {scan.userName}
                    </td>
                    <td className="px-6 py-4 text-slate-500 text-sm">
                      {scan.timestamp?.toDate().toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-slate-400 text-xs font-mono">
                      {scan.deviceId?.substring(0, 8)}...
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// --- SCREEN 4: SCANNER (Updated with 3-minute Buffer & Instant Check) ---
function ScannerScreen({ token, locationId, isReady, user }) {
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [myQueueNumber, setMyQueueNumber] = useState(null);

  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [emailInput, setEmailInput] = useState("");

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
            const data = deviceSnap.data();
            setUserEmail(data.email);
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

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!emailInput.includes("@") || emailInput.length < 5) {
      alert("Please enter a valid email address.");
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
        const existingDoc = querySnapshot.docs[0];
        finalBadgeId = existingDoc.id;
        console.log("Recovered Old ID:", finalBadgeId);
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

    const MAX_RETRIES = 5;
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

    // ✅ CHANGED: Tuned for "Regular 3 Minute Buffer" + Clock Safety
    // Past Buffer: 8 windows (8 * 30s = 4 mins) -> Safe for slow typing.
    // Future Buffer: 2 windows (2 * 30s = 1 min) -> Fixes "1 second remaining" bug.
    const PAST_BUFFER = 8;
    const FUTURE_BUFFER = 2;

    const isValid =
      token.startsWith("secure-") &&
      tokenTimestamp >= currentTimestamp - PAST_BUFFER &&
      tokenTimestamp <= currentTimestamp + FUTURE_BUFFER;

    if (!isValid) {
      console.log("Debug: Token", tokenTimestamp, "Current", currentTimestamp);
      setErrorMsg("QR Code Invalid. Please refresh and scan again.");
      setStatus("error");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const counterRef = doc(db, COUNTER_COLLECTION, locationId);
    const newCheckInRef = doc(collection(db, COLLECTION_NAME));

    while (attempt < MAX_RETRIES && !success) {
      try {
        attempt++;

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
            });

            return nextNum;
          }
        );

        setMyQueueNumber(assignedQueueNumber);
        setStatus("success");
        success = true;
      } catch (err) {
        console.warn(`Attempt ${attempt} failed:`, err);

        if (attempt >= MAX_RETRIES) {
          console.error("Max retries reached", err);
          setErrorMsg("System busy. Please try scanning again.");
          setStatus("error");
        } else {
          const waitTime = Math.floor(Math.random() * 450) + 50;
          await new Promise((resolve) => setTimeout(resolve, waitTime));
        }
      }
    }
  };

  if (status === "success") {
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
        <p className="text-xs text-slate-400">
          ID: {deviceId.substring(0, 12)}...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col items-center justify-center">
      {/* --- MODAL 1: FIRST TIME EMAIL ENTRY --- */}
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
                className="w-full px-4 py-3 border border-slate-300 rounded-xl mb-4 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
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
                    <RefreshCw className="animate-spin mr-2" size={20} />
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

      {/* --- MODAL 2: PERMISSION & CHECK-IN --- */}
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
            <div className="flex gap-2">
              <button
                onClick={confirmAndCheckIn}
                className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold"
              >
                Allow & Check In
              </button>
            </div>
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
