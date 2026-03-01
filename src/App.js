import React, { useState, useEffect, useRef } from "react";
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
  Clock,
  Smartphone,
  Users,
  CheckSquare,
  XCircle,
  WifiOff,
} from "lucide-react";

// --- ERROR BOUNDARY ---
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }
  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 bg-red-50 min-h-screen flex flex-col items-center justify-center text-red-900 text-center">
          <h1 className="text-2xl font-bold mb-4">Something went wrong</h1>
          <pre className="bg-red-100 p-4 rounded text-left text-xs overflow-auto max-w-full">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={() => window.location.reload()}
            className="mt-6 px-6 py-3 bg-red-600 text-white rounded-lg font-bold"
          >
            Reload Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// --- CONFIGURATION ---
const firebaseConfig = {
  apiKey: "AIzaSyBmvJ7Gc7CMbWoxcrGvPub_rI6g_nUEDyc",
  authDomain: "qr-code-generator-46179.firebaseapp.com",
  projectId: "qr-code-generator-46179",
  storageBucket: "qr-code-generator-46179.firebasestorage.app",
  messagingSenderId: "817618481036",
  appId: "1:817618481036:web:4585bf8713719410e9f0a9",
  measurementId: "G-7Y6QXQMYNC",
};

// --- SETTINGS ---
const TEST_MODE = false;
const POPUP_COUNTDOWN_SEC = 15;

// HEARTBEAT LOGIC (Visual Only - Determines if they show as 'Away')
const HEARTBEAT_LIMIT_MS = 3 * 60 * 1000;

// HARD RESET TIMEOUT (40 Minutes)
// If user scans QR and hasn't been seen for 40 mins, force NEW ticket.
const ABANDONMENT_LIMIT_MS = 40 * 60 * 1000;

// RESCAN PENALTY (15 Minutes)
// If user scans a NEW QR code within 15 mins of their last ticket, reset them.
const RESCAN_PENALTY_MS = 15 * 60 * 1000;

// --- GEO-FENCING CONFIG ---
const GEOFENCE_RADIUS_METERS = 200;

const LOCATIONS_COORDS = {
  QCA1: { lat: 30.045325, lng: 31.467408 },
  QCA2: { lat: 30.11777, lng: 31.35576 },
  QCA3: { lat: 30.083269, lng: 31.334888 },
  QCA4: { lat: 30.054989, lng: 30.957067 },
  QCA5: { lat: 30.004325, lng: 31.422559 },
  QCA6: { lat: 29.970381, lng: 31.317037 },
  QCA7: { lat: 30.050963, lng: 31.20661 },
  QCA8: { lat: 30.150534, lng: 31.604949 },

  QGA1: { lat: 30.05675, lng: 31.346333 },
  QGA2: { lat: 30.05903, lng: 31.4942 },
  QGA3: { lat: 30.217583, lng: 31.46425 },
  QGA4: { lat: 29.968448, lng: 30.937903 },

  QCC1: { lat: 30.0605, lng: 31.40844 },
  QCC2: { lat: 30.0132757392, lng: 31.5177883952 },
  QCC4: { lat: 30.013314, lng: 31.29382 },
  QCC6: { lat: 30.10946, lng: 31.24688 },
  QCC7: { lat: 29.99974, lng: 31.17724 },
  QCC8: { lat: 30.29634409162722, lng: 31.745815026564205 },

  QCD1: { lat: 31.2383, lng: 29.96255 },
  QCD2: { lat: 31.21378, lng: 29.9443 },
  QCD3: { lat: 29.981705, lng: 30.980283 },
  QCD4: { lat: 29.957336, lng: 31.096139 },
  QCD5: { lat: 29.928994, lng: 31.039205 },
  QCD6: { lat: 29.99419, lng: 31.1436 },
};

const COLLECTION_NAME = "checkins";
const COUNTER_COLLECTION = "counters";
const DEVICES_COLLECTION = "registered_devices";
const SYSTEM_COLLECTION = "system";

const TOKEN_VALIDITY_SECONDS = 30;

const LOCATIONS = [
  "QCA1",
  "QCA2",
  "QCA3",
  "QCA4",
  "QCA5",
  "QCA6",
  "QCA7",
  "QCA8",
  "QGA1",
  "QGA2",
  "QGA3",
  "QGA4",
  "QCC1",
  "QCC2",
  "QCC4",
  "QCC6",
  "QCC7",
  "QCC8",
  "QCD1",
  "QCD2",
  "QCD3",
  "QCD4",
  "QCD5",
  "QCD6",
];

let app = null;
let db = null;
let auth = null;

// --- HELPERS ---
const formatNum = (n) => (n !== undefined && n !== null ? n.toString() : "");
const formatDate = (d) => (d ? d.toLocaleDateString("en-US") : "");
const formatTime = (d) => (d ? d.toLocaleTimeString("en-US") : "");

const getTodayStr = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const haversineDistance = (coords1, coords2) => {
  if (!coords1 || !coords2 || !coords1.lat || !coords2.lat) return Infinity;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371e3;
  const dLat = toRad(coords2.lat - coords1.lat);
  const dLon = toRad(coords2.lng - coords1.lng);
  const lat1 = toRad(coords1.lat);
  const lat2 = toRad(coords2.lat);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
};

const getLocationColor = (loc) => {
  if (loc.startsWith("QCA"))
    return "bg-yellow-100 hover:bg-yellow-200 text-yellow-900";
  if (loc.startsWith("QGA"))
    return "bg-green-100 hover:bg-green-200 text-green-900";
  if (loc.startsWith("QCC"))
    return "bg-blue-100 hover:bg-blue-200 text-blue-900";
  if (loc.startsWith("QCD"))
    return "bg-purple-100 hover:bg-purple-200 text-purple-900";
  return "bg-slate-50 hover:bg-slate-100 text-slate-700";
};

// Check if user is "Alive" based on heartbeat
const isUserAlive = (lastActiveTimestamp) => {
  if (!lastActiveTimestamp) return false;
  const diff = Date.now() - lastActiveTimestamp.toMillis();
  return diff < HEARTBEAT_LIMIT_MS;
};

export default function App() {
  return (
    <ErrorBoundary>
      <MainApp />
    </ErrorBoundary>
  );
}

function MainApp() {
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
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Close dropdown when clicking outside
  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest("#landing-loc-dropdown")) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

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

            {/* --- NEW CUSTOM COLOR-CODED DROPDOWN --- */}
            <div className="flex gap-2 mt-1">
              <div className="relative flex-1" id="landing-loc-dropdown">
                {/* The Visible Button */}
                <div
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className={`w-full p-2 border border-slate-300 rounded-lg cursor-pointer flex justify-between items-center transition-colors ${getLocationColor(
                    selectedLoc
                  )}`}
                >
                  <span className="font-bold">{selectedLoc}</span>
                  <span className="text-xs opacity-50">▼</span>
                </div>

                {/* The Dropdown List */}
                {isDropdownOpen && (
                  <div className="absolute top-full left-0 mt-1 w-full max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-1">
                    {LOCATIONS.map((loc) => (
                      <div
                        key={loc}
                        onClick={() => {
                          setSelectedLoc(loc);
                          setIsDropdownOpen(false);
                        }}
                        className={`p-2 mb-1 rounded cursor-pointer text-sm font-medium transition-colors ${getLocationColor(
                          loc
                        )} ${
                          selectedLoc === loc ? "ring-2 ring-slate-800" : ""
                        }`}
                      >
                        {loc}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={() => onSelect("kiosk", selectedLoc)}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700"
              >
                Launch
              </button>
            </div>
            {/* --------------------------------------- */}
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
  const lastSignalRef = useRef(null);

  const scansRef = useRef(recentScans);
  useEffect(() => {
    scansRef.current = recentScans;
  }, [recentScans]);

  useEffect(() => {
    if (!isReady || !db) return;

    // AUTOMATED CLEANUP (Every 60s)
    const cleanupInterval = setInterval(async () => {
      const now = Date.now();
      const q = query(
        collection(db, COLLECTION_NAME),
        where("locationId", "==", locationId),
        where("status", "in", ["waiting", "active"])
      );

      const snapshot = await getDocs(q);

      snapshot.docs.forEach(async (docSnap) => {
        const d = docSnap.data();
        const lastActive =
          d.lastActive?.toMillis() || d.timestamp?.toMillis() || 0;

        // Auto-Abandon after 40 mins
        if (now - lastActive > ABANDONMENT_LIMIT_MS) {
          try {
            await updateDoc(doc(db, COLLECTION_NAME, docSnap.id), {
              status: "abandoned",
            });
          } catch (e) {
            console.error(e);
          }
        }
      });
    }, 60000);

    return () => clearInterval(cleanupInterval);
  }, [isReady, locationId]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement)
      document.documentElement.requestFullscreen();
    else if (document.exitFullscreen) document.exitFullscreen();
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
          const serverTime = data.forceRefreshTimestamp?.toMillis() || 0;
          if (lastSignalRef.current === null) {
            lastSignalRef.current = serverTime;
            return;
          }
          if (serverTime !== lastSignalRef.current) {
            lastSignalRef.current = serverTime;
            window.location.href =
              window.location.origin + window.location.pathname;
          }
        }
      }
    );
    return () => unsub();
  }, [isReady]);

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
            formatDate(dt),
            formatTime(dt),
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
      const todayStr = getTodayStr();
      const allScans = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((u) => {
          const isActive = u.status === "waiting" || u.status === "active";
          const isToday = u.date === todayStr;
          const isAlive = isUserAlive(u.lastActive);
          return isActive && isToday && isAlive;
        });

      allScans.sort(
        (a, b) =>
          (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
      );
      setRecentScans(allScans.slice(0, 5));
    });
    return () => unsubscribe();
  }, [isReady, locationId]);

  const handleManualExit = () => {
    if (window.confirm("Exit Kiosk Mode?")) {
      window.location.href = window.location.origin + window.location.pathname;
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-900 text-white overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center p-8 border-r border-slate-700 relative">
        <button
          onClick={handleManualExit}
          className="absolute top-6 left-6 bg-slate-800 hover:bg-red-900 px-4 py-2 rounded-lg font-bold flex items-center shadow-lg border border-slate-600 transition-colors z-50"
        >
          <Building size={18} className="mr-2" /> {locationId}
        </button>
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
                      {formatTime(scan.timestamp?.toDate())}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <div className="bg-slate-800 px-4 py-2 rounded-lg text-green-400 font-mono font-bold text-2xl border border-slate-600">
                      #{scan.queueNumber}
                    </div>
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

  // Data State
  const [scans, setScans] = useState([]);
  const [storeStats, setStoreStats] = useState({});
  const [activeTurnMap, setActiveTurnMap] = useState({});

  // --- FILTERS STATE ---
  const [selectedLocations, setSelectedLocations] = useState([]); // Empty array = ALL
  const [isLocDropdownOpen, setIsLocDropdownOpen] = useState(false); // UI Toggle

  // CHANGED: Replaced single date/mode with Start and End dates
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(getTodayStr());

  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");

  const [isRefreshingKiosks, setIsRefreshingKiosks] = useState(false);
  const [refreshTrigger, setRefreshTrigger] = useState(0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const closeDropdown = (e) => {
      if (!e.target.closest("#loc-dropdown-container")) {
        setIsLocDropdownOpen(false);
      }
    };
    document.addEventListener("click", closeDropdown);
    return () => document.removeEventListener("click", closeDropdown);
  }, []);

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

  const handleKickUser = async (userDocId) => {
    if (!db || !window.confirm("Kick user from queue?")) return;
    try {
      await updateDoc(doc(db, COLLECTION_NAME, userDocId), {
        status: "abandoned",
      });
    } catch (e) {
      alert("Failed to kick user.");
    }
  };

  // --- FILTER LOGIC ---
  const applyFilters = (rawDocs) => {
    let data = rawDocs;

    // 1. CHANGED: Date Range Filter
    if (startDate && endDate) {
      // Create Date objects (Start of day vs End of day)
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);

      const end = new Date(endDate);
      end.setHours(23, 59, 59, 999);

      data = data.filter((d) => {
        if (!d.timestamp) return false; // Skip if no timestamp
        const scanTime = d.timestamp.toDate();
        return scanTime >= start && scanTime <= end;
      });
    }

    // 2. Time Filter
    data = data.filter((d) => {
      if (!d.timestamp) return false;
      const dt = d.timestamp.toDate();
      const docMinutes = dt.getHours() * 60 + dt.getMinutes();

      const [startH, startM] = startTime.split(":").map(Number);
      const [endH, endM] = endTime.split(":").map(Number);
      const startMinutes = startH * 60 + startM;
      const endMinutes = endH * 60 + endM;

      return docMinutes >= startMinutes && docMinutes <= endMinutes;
    });

    // 3. Location Filter (Multi-Select)
    if (selectedLocations.length > 0) {
      data = data.filter((d) => selectedLocations.includes(d.locationId));
    }

    return data;
  };

  const toggleLocationSelection = (loc) => {
    setSelectedLocations((prev) =>
      prev.includes(loc) ? prev.filter((l) => l !== loc) : [...prev, loc]
    );
  };

  const calculateTurns = (filteredData) => {
    const nowServingMap = {};
    LOCATIONS.forEach((loc) => {
      const locUsers = filteredData.filter(
        (d) =>
          d.locationId === loc &&
          (d.status === "waiting" || d.status === "active") &&
          isUserAlive(d.lastActive)
      );
      locUsers.sort((a, b) => Number(a.queueNumber) - Number(b.queueNumber));
      if (locUsers.length > 0) {
        nowServingMap[loc] = Number(locUsers[0].queueNumber);
      }
    });
    setActiveTurnMap(nowServingMap);
  };

  const calculateStoreStats = (filteredData) => {
    const stats = {};
    // Initialize for ALL locations so grid shows zeros even if filtered out
    LOCATIONS.forEach((loc) => {
      stats[loc] = { waiting: 0, unique_all: new Set(), abandoned: new Set() };
    });

    filteredData.forEach((d) => {
      // Safety check if location exists in our config
      if (stats[d.locationId]) {
        const uniqueId = d.userName || d.deviceId || "unknown";
        stats[d.locationId].unique_all.add(uniqueId);
        if (
          (d.status === "waiting" || d.status === "active") &&
          isUserAlive(d.lastActive)
        ) {
          stats[d.locationId].waiting++;
        } else if (d.status === "abandoned")
          stats[d.locationId].abandoned.add(uniqueId);
      }
    });

    const finalStats = {};
    LOCATIONS.forEach((loc) => {
      finalStats[loc] = {
        waiting: stats[loc].waiting,
        completed: stats[loc].unique_all.size,
        abandoned: stats[loc].abandoned.size,
      };
    });
    setStoreStats(finalStats);
  };

  const handleExport = async () => {
    if (!isReady || !db) return;
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);
    let data = snapshot.docs.map((doc) => doc.data());

    // Apply all active filters
    data = applyFilters(data);

    data.sort(
      (a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
    );
    const csvHeader = [
      "Location",
      "Queue Number",
      "Name",
      "Date",
      "Time",
      "Device ID",
      "Status",
      "Latitude",
      "Longitude",
    ].join(",");
    const csvRows = data.map((d) => {
      const dateObj = d.timestamp ? d.timestamp.toDate() : null;
      return [
        d.locationId,
        d.queueNumber,
        `"${d.userName || "Guest"}"`,
        `"${formatDate(dateObj)}"`,
        `"${formatTime(dateObj)}"`,
        `"${d.deviceId || ""}"`,
        d.status || "waiting",
        d.location?.lat || "",
        d.location?.lng || "",
      ].join(",");
    });
    const csvContent = [csvHeader, ...csvRows].join("\n");
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(
      new Blob([csvContent], { type: "text/csv" })
    );
    a.download = `Report_${startDate}_to_${endDate}.csv`;
    a.click();
  };

  useEffect(() => {
    if (!isReady || !db || !isAuthenticated) return;
    const q = query(collection(db, COLLECTION_NAME));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let rawData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));

      const filteredData = applyFilters(rawData);

      calculateTurns(filteredData);
      calculateStoreStats(filteredData);

      const activeQueue = filteredData
        .filter((u) => u.status === "waiting" || u.status === "active")
        .sort((a, b) => Number(a.queueNumber) - Number(b.queueNumber));
      const history = filteredData
        .filter((u) => u.status !== "waiting" && u.status !== "active")
        .sort(
          (a, b) =>
            (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0)
        );

      setScans([...activeQueue, ...history]);
    });
    return () => unsubscribe();
  }, [
    isReady,
    selectedLocations,
    startTime,
    endTime,
    startDate, // Updated dependency
    endDate, // Updated dependency
    isAuthenticated,
    refreshTrigger,
  ]);

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
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8 gap-4">
          <button
            onClick={onBack}
            className="p-2 bg-white rounded-lg hover:bg-slate-50"
          >
            <X size={20} />
          </button>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col xl:flex-row gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm">
          {/* Action Buttons */}
          <div className="flex gap-2">
            <button
              onClick={handleRemoteRefresh}
              disabled={isRefreshingKiosks}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold flex items-center text-sm"
            >
              {isRefreshingKiosks ? (
                <Loader size={16} className="animate-spin mr-2" />
              ) : (
                <Zap size={16} className="mr-2" />
              )}{" "}
              Reset Kiosks
            </button>
            <button
              onClick={() => setRefreshTrigger((prev) => prev + 1)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg font-bold flex items-center hover:bg-green-700 transition-colors text-sm"
            >
              <RefreshCw size={16} className="mr-2" /> Refresh
            </button>
          </div>

          <div className="h-px bg-slate-200 xl:w-px xl:h-auto xl:mx-2"></div>

          {/* Filter Controls */}
          <div className="flex flex-wrap gap-2 items-center flex-1">
            {/* CHANGED: Dual Date Picker (From - To) */}
            <div className="flex items-center border rounded-lg px-2 bg-slate-50 gap-2">
              <Calendar size={14} className="text-slate-400" />
              <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2">
                <div className="flex items-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">
                    From
                  </span>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="bg-transparent py-2 outline-none text-sm w-32 font-medium"
                  />
                </div>
                <span className="hidden sm:inline text-slate-300">|</span>
                <div className="flex items-center">
                  <span className="text-[10px] uppercase font-bold text-slate-400 mr-1">
                    To
                  </span>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="bg-transparent py-2 outline-none text-sm w-32 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* Time Filter */}
            <div className="flex items-center border rounded-lg px-2 bg-slate-50">
              <Clock size={14} className="text-slate-400 mr-2" />
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="bg-transparent py-2 outline-none text-sm"
              />
              <span className="mx-2 text-slate-400">-</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="bg-transparent py-2 outline-none text-sm"
              />
            </div>

            {/* Multi-Location Dropdown */}
            <div className="relative" id="loc-dropdown-container">
              <button
                onClick={() => setIsLocDropdownOpen(!isLocDropdownOpen)}
                className="flex items-center border rounded-lg px-3 py-2 bg-slate-50 text-sm hover:bg-slate-100"
              >
                <Filter size={14} className="text-slate-400 mr-2" />
                {selectedLocations.length === 0
                  ? "All Stores"
                  : `${selectedLocations.length} Selected`}
              </button>

              {isLocDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-48 max-h-60 overflow-y-auto bg-white border border-slate-200 rounded-lg shadow-xl z-50 p-2">
                  <div
                    onClick={() => setSelectedLocations([])}
                    className={`p-2 rounded cursor-pointer text-sm font-bold flex items-center ${
                      selectedLocations.length === 0
                        ? "bg-blue-50 text-blue-600"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    {selectedLocations.length === 0 ? (
                      <CheckSquare size={14} className="mr-2" />
                    ) : (
                      <div className="w-5" />
                    )}
                    All Stores
                  </div>
                  <div className="h-px bg-slate-100 my-1"></div>
                  {LOCATIONS.map((loc) => (
                    <div
                      key={loc}
                      onClick={() => toggleLocationSelection(loc)}
                      className={`p-2 mb-1 rounded cursor-pointer text-sm font-medium flex items-center transition-colors ${getLocationColor(
                        loc
                      )}`}
                    >
                      <div
                        className={`w-4 h-4 border rounded mr-2 flex items-center justify-center ${
                          selectedLocations.includes(loc)
                            ? "bg-slate-800 border-slate-800"
                            : "border-slate-400/40 bg-white"
                        }`}
                      >
                        {selectedLocations.includes(loc) && (
                          <CheckSquare size={10} className="text-white" />
                        )}
                      </div>
                      {loc}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="h-px bg-slate-200 xl:w-px xl:h-auto xl:mx-2"></div>

          {/* Export */}
          <button
            onClick={handleExport}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center text-sm"
          >
            <Download size={16} className="mr-2" /> CSV
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {LOCATIONS.map((loc) => {
            // Respect Filter Logic: If loc isn't in selected list (and list not empty), skip
            if (
              selectedLocations.length > 0 &&
              !selectedLocations.includes(loc)
            )
              return null;

            const stat = storeStats[loc] || {
              waiting: 0,
              completed: 0,
              abandoned: 0,
            };

            // Auto-Hide empty stores if showing "ALL" to save space, but show if explicitly selected
            if (
              stat.waiting === 0 &&
              stat.completed === 0 &&
              stat.abandoned === 0 &&
              selectedLocations.length === 0
            )
              return null;

            return (
              <div
                key={loc}
                className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 animate-in fade-in"
              >
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-bold text-lg text-slate-800">{loc}</h3>
                  <Building size={16} className="text-slate-400" />
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-blue-50 p-2 rounded-lg">
                    <div className="text-blue-600 font-bold text-xl">
                      {formatNum(stat.waiting)}
                    </div>
                    <div className="text-[10px] text-blue-400 font-bold uppercase">
                      Wait
                    </div>
                  </div>
                  <div className="bg-green-50 p-2 rounded-lg">
                    <div className="text-green-600 font-bold text-xl">
                      {formatNum(stat.completed)}
                    </div>
                    <div className="text-[10px] text-green-400 font-bold uppercase">
                      Done
                    </div>
                  </div>
                  <div className="bg-red-50 p-2 rounded-lg">
                    <div className="text-red-600 font-bold text-xl">
                      {formatNum(stat.abandoned)}
                    </div>
                    <div className="text-[10px] text-red-400 font-bold uppercase">
                      Lost
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Table */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 bg-slate-50 border-b flex justify-between text-sm font-semibold text-slate-500">
            <span>Detailed Logs ({scans.length})</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-6 py-4">Pos</th>
                  <th className="px-6 py-4">Loc</th>
                  <th className="px-6 py-4">#</th>
                  <th className="px-6 py-4">User</th>
                  <th className="px-6 py-4">Time</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {scans.map((s, index) => {
                  const isWaiting =
                    s.status === "waiting" || s.status === "active";
                  const isAlive = isUserAlive(s.lastActive);

                  let pos = "-";
                  let awayMins = 0;

                  if (isWaiting) {
                    if (isAlive) {
                      const aliveUsers = scans.filter(
                        (u) =>
                          (u.status === "waiting" || u.status === "active") &&
                          isUserAlive(u.lastActive) &&
                          u.locationId === s.locationId // Rank within their location
                      );
                      const myRank = aliveUsers.findIndex((u) => u.id === s.id);
                      pos = myRank === 0 ? "NOW" : myRank + 1;
                    } else {
                      pos = "Away";
                      if (s.lastActive) {
                        const diff = Date.now() - s.lastActive.toMillis();
                        awayMins = Math.floor(diff / 60000);
                      }
                    }
                  }

                  return (
                    <tr
                      key={s.id}
                      className={`hover:bg-slate-50 ${
                        !isAlive && isWaiting ? "opacity-50 bg-slate-100" : ""
                      }`}
                    >
                      <td className="px-6 py-4 font-bold text-blue-600">
                        {pos === "NOW" ? (
                          <div className="flex items-center px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full w-fit animate-pulse whitespace-nowrap">
                            <CheckCircle size={12} className="mr-1" /> NOW
                          </div>
                        ) : pos === "Away" ? (
                          <div className="flex flex-col">
                            <div className="flex items-center text-slate-400 text-xs font-bold">
                              <WifiOff size={12} className="mr-1" /> AWAY
                            </div>
                            <div className="text-[10px] text-red-400 font-medium">
                              {awayMins}m ago
                            </div>
                          </div>
                        ) : (
                          pos
                        )}
                      </td>
                      <td className="px-6 py-4">{s.locationId}</td>
                      <td className="px-6 py-4 font-bold">
                        #{formatNum(s.queueNumber)}
                      </td>
                      <td className="px-6 py-4">{s.userName}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">
                        {s.timestamp
                          ? `${formatDate(s.timestamp.toDate())} ${formatTime(
                              s.timestamp.toDate()
                            )}`
                          : ""}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`px-2 py-1 rounded text-xs uppercase font-bold ${
                            s.status === "completed"
                              ? "bg-green-100 text-green-700"
                              : s.status === "abandoned"
                              ? "bg-red-100 text-red-600"
                              : "bg-blue-100 text-blue-700"
                          }`}
                        >
                          {s.status || "waiting"}
                        </span>
                      </td>
                      <td className="px-6 py-4 flex gap-2 items-center">
                        {isWaiting && (
                          <button
                            onClick={() => handleKickUser(s.id)}
                            title="Kick User"
                            className="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100 transition-colors"
                          >
                            <XCircle size={18} />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
// --- SCREEN 4: SCANNER ---
function ScannerScreen({ token, locationId, isReady, user }) {
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [myQueueNumber, setMyQueueNumber] = useState(null);
  const [myDocId, setMyDocId] = useState(null);
  const [ticketTime, setTicketTime] = useState(null);
  const [peopleAhead, setPeopleAhead] = useState(null);
  const [isCheckedOut, setIsCheckedOut] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [statusFromDB, setStatusFromDB] = useState("waiting");

  // DEBUG STATE
  const [debugDist, setDebugDist] = useState(0);
  const [debugAcc, setDebugAcc] = useState(0);

  // --- GEOFENCE WATCHER ---
  useEffect(() => {
    if (!myDocId || isCheckedOut) return;
    if (!LOCATIONS_COORDS[locationId]) return;
    if (!navigator.geolocation) return;

    const watchId = navigator.geolocation.watchPosition(
      async (position) => {
        const userLat = position.coords.latitude;
        const userLng = position.coords.longitude;
        const accuracy = position.coords.accuracy;

        setDebugAcc(Math.round(accuracy));

        if (accuracy > 500) return;

        const dist = haversineDistance(
          { lat: userLat, lng: userLng },
          LOCATIONS_COORDS[locationId]
        );
        setDebugDist(Math.round(dist));

        // ✅ GRACE PERIOD (2 Mins)
        let isImmune = false;
        if (ticketTime) {
          const ageMs = Date.now() - ticketTime.toMillis();
          if (ageMs < 2 * 60 * 1000) {
            isImmune = true;
          }
        }

        // BUFFERED KICK LOGIC
        if (!isImmune && dist - accuracy > GEOFENCE_RADIUS_METERS) {
          if (db && myDocId) {
            try {
              await updateDoc(doc(db, COLLECTION_NAME, myDocId), {
                status: "abandoned",
              });
              setIsCheckedOut(true);
            } catch (e) {
              console.error("Geofence exit fail", e);
            }
          }
        }
      },
      (err) => console.log("Geo watch error", err),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
    );

    // HEARTBEAT + POLLING
    const pollInterval = setInterval(() => {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          if (db && myDocId && !isCheckedOut) {
            updateDoc(doc(db, COLLECTION_NAME, myDocId), {
              lastActive: serverTimestamp(),
            });
          }
        },
        (err) => console.warn("Poll Error:", err),
        { enableHighAccuracy: true, maximumAge: 0, timeout: 5000 }
      );
    }, 5000);

    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(pollInterval);
    };
  }, [myDocId, isCheckedOut, locationId, ticketTime]);

  useEffect(() => {
    // Only beep if peopleAhead is 0 AND not checked out
    if (status === "success" && !isCheckedOut && peopleAhead === 0) {
      const audio = new Audio(
        "https://actions.google.com/sounds/v1/alarms/beep_short.ogg"
      );
      audio.play().catch((e) => console.log("Audio failed", e));
    }
  }, [peopleAhead, status, isCheckedOut]);

  // ✅ CRITICAL: PEOPLE AHEAD CALCULATION WITH HEARTBEAT
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
        where("status", "in", ["waiting", "active"])
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const todayStr = getTodayStr();

        // 1. Get ONLY ALIVE users
        const activeUsers = snapshot.docs
          .map((d) => ({ ...d.data(), id: d.id }))
          .filter((u) => {
            return u.date === todayStr && isUserAlive(u.lastActive);
          })
          .sort((a, b) => Number(a.queueNumber) - Number(b.queueNumber));

        // 3. Find index
        const myIndex = activeUsers.findIndex(
          (u) => Number(u.queueNumber) === Number(myQueueNumber)
        );

        // 4. Update
        if (myIndex === -1) {
          setPeopleAhead(null);
        } else {
          setPeopleAhead(myIndex);
        }
      });
      return () => unsubscribe();
    }
  }, [status, myQueueNumber, isCheckedOut, locationId, isReady]);

  const generateNativeFingerprint = async () =>
    "fp_" + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!isReady || !db) return;
    if (!locationId) {
      setStatus("error");
      setErrorMsg("Invalid QR Code (Missing Location)");
      return;
    }
    const init = async () => {
      setStatus("initializing");
      const STORAGE_KEY = "secure_user_badge";
      try {
        let storedBadge = null;
        try {
          storedBadge = localStorage.getItem(STORAGE_KEY);
        } catch (e) {
          console.warn("Storage restricted");
        }
        const fp = await generateNativeFingerprint();
        setFingerprint(fp);
        if (storedBadge) {
          setDeviceId(storedBadge);
          const snap = await getDoc(doc(db, DEVICES_COLLECTION, storedBadge));
          if (snap.exists()) {
            setUserEmail(snap.data().email);
            setShowPermissionModal(true);
          } else setShowEmailModal(true);
        } else {
          setShowEmailModal(true);
        }
        setStatus("idle");
      } catch (e) {
        setStatus("error");
        setErrorMsg("Init failed: " + e.message);
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
      try {
        localStorage.setItem("secure_user_badge", badgeId);
      } catch (err) {}
      setDeviceId(badgeId);
      setUserEmail(emailInput);
      setShowEmailModal(false);
      setShowPermissionModal(true);
    } catch (e) {
      alert("Error: " + e.message);
    } finally {
      setIsRecovering(false);
    }
  };

  const confirmAndCheckIn = () => {
    if (!navigator.geolocation) {
      setStatus("error");
      setErrorMsg("Location tracking not supported.");
      return;
    }

    setShowPermissionModal(false);
    setStatus("locating");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userCoords = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        const targetCoords = LOCATIONS_COORDS[locationId];

        // --- NEW GEOFENCE BLOCK LOGIC ---
        if (targetCoords) {
          const dist = haversineDistance(userCoords, targetCoords);

          // We subtract the GPS accuracy to give the user the benefit of the doubt
          // if their phone's GPS is currently weak/drifting.
          if (dist - pos.coords.accuracy > GEOFENCE_RADIUS_METERS) {
            setStatus("blocked");
            setErrorMsg("You are too far from Location");
            return; // Stop the check-in process entirely
          }
        }
        // --------------------------------

        saveCheckIn(pos.coords);
      },
      (err) => {
        setStatus("error");
        setErrorMsg("Location permission denied.");
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  };

  const saveCheckIn = async (coords) => {
    setStatus("saving");
    try {
      const deviceQ = query(
        collection(db, COLLECTION_NAME),
        where("deviceId", "==", deviceId),
        where("status", "in", ["waiting", "active"]),
        where("locationId", "==", locationId),
        where("date", "==", getTodayStr())
      );
      const deviceSnap = await getDocs(deviceQ);

      let emailSnap = { docs: [] };
      if (userEmail) {
        const emailQ = query(
          collection(db, COLLECTION_NAME),
          where("userName", "==", userEmail),
          where("status", "in", ["waiting", "active"]),
          where("locationId", "==", locationId),
          where("date", "==", getTodayStr())
        );
        emailSnap = await getDocs(emailQ);
      }

      const existingDocs = [...deviceSnap.docs, ...emailSnap.docs];
      const uniqueDocs = existingDocs.filter(
        (v, i, a) => a.findIndex((v2) => v2.id === v.id) === i
      );

      if (uniqueDocs.length > 0) {
        const bestTicket = uniqueDocs[0];
        const ticketData = bestTicket.data();

        // Time Calculations
        const now = Date.now();
        const lastActiveTime = ticketData.lastActive
          ? ticketData.lastActive.toMillis()
          : 0;
        const ticketCreationTime = ticketData.timestamp
          ? ticketData.timestamp.toMillis()
          : 0;
        const ticketAge = now - ticketCreationTime;

        // Check if this is a Page Refresh (Safe) or New Scan
        const isRefresh = ticketData.tokenUsed === token;

        // RULE 1: HARD ABANDONMENT (> 40 mins inactive)
        if (now - lastActiveTime > ABANDONMENT_LIMIT_MS) {
          for (let docSnap of uniqueDocs) {
            await updateDoc(doc(db, COLLECTION_NAME, docSnap.id), {
              status: "abandoned",
            });
          }
          // Fall through to create NEW ticket
        }

        // RULE 2: RESCAN PENALTY (< 15 mins old & New Scan)
        else if (!isRefresh && ticketAge < RESCAN_PENALTY_MS) {
          console.log(
            "RESCAN PENALTY: User rescanned within 15 mins. Resetting."
          );
          for (let docSnap of uniqueDocs) {
            await updateDoc(doc(db, COLLECTION_NAME, docSnap.id), {
              status: "abandoned",
            });
          }
          // Fall through to create NEW ticket
        }

        // RULE 3: RESUME (Safe Refresh OR Old Ticket Rescan)
        else {
          setMyQueueNumber(ticketData.queueNumber);
          setMyDocId(bestTicket.id);
          setTicketTime(ticketData.timestamp);

          if (!isRefresh) {
            await updateDoc(doc(db, COLLECTION_NAME, bestTicket.id), {
              tokenUsed: token,
              lastActive: serverTimestamp(),
            });
          }

          setStatus("success");
          return;
        }
      }

      const todayStr = getTodayStr();
      const newRef = doc(collection(db, COLLECTION_NAME));
      const nowTimestamp = serverTimestamp();

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
          timestamp: nowTimestamp,
          status: "waiting",
          location: { lat: coords.latitude, lng: coords.longitude },
          tokenUsed: token,
          fingerprint,
          lastActive: nowTimestamp,
          date: todayStr,
        });
        return next;
      });
      setMyQueueNumber(qNum);
      setMyDocId(newRef.id);
      setTicketTime({ toMillis: () => Date.now() });
      setStatus("success");
    } catch (e) {
      setStatus("error");
      setErrorMsg("Check-in failed: " + e.message);
    }
  };

  if (status === "success") {
    if (statusFromDB === "abandoned")
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-red-50 text-center animate-in zoom-in">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-600">
            <XCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-red-800 mb-2">
            You Left the Area
          </h2>
          <p className="text-slate-600 mb-6">
            You must stay near the store to keep your spot.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold"
          >
            Start Over
          </button>
        </div>
      );
    if (isCheckedOut)
      return (
        <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-100 text-center animate-in zoom-in">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-gray-500">
            <LogOut size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            You have left the queue
          </h2>
          <button
            onClick={() => window.location.reload()}
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold"
          >
            New Check In
          </button>
        </div>
      );
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-green-50 text-center animate-in zoom-in relative">
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
            #{formatNum(myQueueNumber)}
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
              {/* ✅ SAFE LOADING STATE */}
              {peopleAhead === null ? (
                <Loader className="animate-spin inline" />
              ) : peopleAhead === 0 ? (
                "It's your turn!"
              ) : (
                formatNum(peopleAhead)
              )}
            </div>
          </div>
        </div>

        {/* DEBUG PANEL */}
        {LOCATIONS_COORDS[locationId] && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/50 text-white p-2 rounded text-[10px] font-mono pointer-events-none">
            DEBUG: Dist {debugDist}m (Limit {GEOFENCE_RADIUS_METERS}m) | Acc ±
            {debugAcc}m
          </div>
        )}
      </div>
    );
  }

  // --- NEW BLOCKED UI ---
  if (status === "blocked") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-red-50 text-center animate-in zoom-in">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-600">
          <XCircle size={32} />
        </div>
        <h2 className="text-xl font-bold text-red-800 mb-2">Access Denied</h2>
        <p className="text-slate-600 mb-6 font-medium">{errorMsg}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold transition-colors"
        >
          Try Again
        </button>

        {/* Optional: Show them exactly how far away they are for debugging */}
        {LOCATIONS_COORDS[locationId] && (
          <div className="mt-8 text-xs text-red-400 font-mono">
            Radius: {GEOFENCE_RADIUS_METERS}m
          </div>
        )}
      </div>
    );
  }
  // ----------------------

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
