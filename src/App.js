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
  MapPin, // Added for manual check icon
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
          <button onClick={() => window.location.reload()} className="mt-6 px-6 py-3 bg-red-600 text-white rounded-lg font-bold">
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
  apiKey: "AIzaSyD8eWUJQD8_LS8Be0seSpIRovBMzV-chO8",
  authDomain: "qr-code-generator-46179.firebaseapp.com",
  projectId: "qr-code-generator-46179",
  storageBucket: "qr-code-generator-46179.firebasestorage.app",
  messagingSenderId: "817618481036",
  appId: "1:817618481036:web:4585bf8713719410e9f0a9",
  measurementId: "G-7Y6QXQMYNC",
};

// --- SETTINGS ---
const TEST_MODE = false;
const SAFETY_CLEANUP_MS = 24 * 60 * 60 * 1000;
const POPUP_COUNTDOWN_SEC = 15;

// --- GEO-FENCING CONFIG ---
const GEOFENCE_RADIUS_METERS = 100; 
const LOCATIONS_COORDS = {
  QCA5: { lat: 30.004567, lng: 31.422211 },
};

const COLLECTION_NAME = "checkins";
const COUNTER_COLLECTION = "counters";
const DEVICES_COLLECTION = "registered_devices";
const SYSTEM_COLLECTION = "system";

const TOKEN_VALIDITY_SECONDS = 30;
const LOCATIONS = Array.from({ length: 30 }, (_, i) => `QCA${i + 1}`);

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
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const haversineDistance = (coords1, coords2) => {
  if (!coords1 || !coords2) return 0;
  const toRad = (x) => (x * Math.PI) / 180;
  const R = 6371e3; // Earth radius in meters
  const dLat = toRad(coords2.lat - coords1.lat);
  const dLon = toRad(coords2.lng - coords1.lng);
  const lat1 = toRad(coords1.lat);
  const lat2 = toRad(coords2.lat);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
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
        signInAnonymously(auth).catch((err) => console.error("Auth failed", err));
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
        <h1 className="text-3xl font-bold text-slate-900">Enterprise Check-In</h1>
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
            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Select Location</label>
            <div className="flex gap-2 mt-1">
              <select
                value={selectedLoc}
                onChange={(e) => setSelectedLoc(e.target.value)}
                className="flex-1 p-2 border border-slate-300 rounded-lg bg-slate-50 focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {LOCATIONS.map((loc) => <option key={loc} value={loc}>{loc}</option>)}
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

  useEffect(() => { scansRef.current = recentScans; }, [recentScans]);

  useEffect(() => {
    if (!isReady || !db) return;
    const cleanupInterval = setInterval(async () => {
      const now = Date.now();
      const currentScans = scansRef.current;
      currentScans.forEach(async (user) => {
        if (user.status === "waiting") {
          const lastActive = user.lastActive?.toMillis() || user.timestamp?.toMillis() || 0;
          if (now - lastActive > SAFETY_CLEANUP_MS) {
            try { await updateDoc(doc(db, COLLECTION_NAME, user.id), { status: "abandoned" }); } catch (e) { console.error(e); }
          }
        }
      });
    }, 60000);
    return () => clearInterval(cleanupInterval);
  }, [isReady]);

  const toggleFullScreen = () => {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen();
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
      } catch (err) { console.error("Wake Lock failed:", err); setWakeLockActive(false); }
    };
    requestWakeLock();
    const handleVisibilityChange = () => { if (document.visibilityState === "visible") requestWakeLock(); };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => { document.removeEventListener("visibilitychange", handleVisibilityChange); if (wakeLock) wakeLock.release(); };
  }, []);

  useEffect(() => {
    if (!isReady || !db) return;
    const unsub = onSnapshot(doc(db, SYSTEM_COLLECTION, "global_commands"), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        const serverTime = data.forceRefreshTimestamp?.toMillis() || 0;
        if (lastSignalRef.current === null) { lastSignalRef.current = serverTime; return; }
        if (serverTime !== lastSignalRef.current) { lastSignalRef.current = serverTime; window.location.href = window.location.origin + window.location.pathname; }
      }
    });
    return () => unsub();
  }, [isReady]);

  const handleDownloadCSV = async () => {
    if (!isReady || !db) return;
    setIsDownloading(true);
    try {
      const q = query(collection(db, COLLECTION_NAME), where("locationId", "==", locationId));
      const snapshot = await getDocs(q);
      let data = snapshot.docs.map((doc) => doc.data());
      data.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      const csvContent = [
        ["Queue Number", "Name", "Date", "Time", "Device ID", "Status"].join(","),
        ...data.map((d) => {
          const dt = d.timestamp ? d.timestamp.toDate() : new Date();
          return [d.queueNumber, `"${d.userName}"`, formatDate(dt), formatTime(dt), `"${d.deviceId}"`, d.status || "N/A"].join(",");
        }),
      ].join("\n");
      const blob = new Blob([csvContent], { type: "text/csv" });
      const a = document.createElement("a");
      a.href = window.URL.createObjectURL(blob);
      a.download = `${locationId}_Report.csv`;
      a.click();
    } catch (e) { alert("Export failed"); } finally { setIsDownloading(false); }
  };

  useEffect(() => {
    const generateToken = () => {
      const timestamp = Math.floor(Date.now() / 1000 / TOKEN_VALIDITY_SECONDS);
      const newToken = `secure-${timestamp}`;
      setToken(newToken);
      setTimeLeft(TOKEN_VALIDITY_SECONDS);
      let currentUrl = window.location.href.split("?")[0];
      const qrParams = `view=scanner&token=${newToken}&locationId=${locationId}`;
      if (!currentUrl.startsWith("http")) { setScanUrl(`https://example.com/check-in-demo?${qrParams}`); setIsUrlValid(false); }
      else { setScanUrl(`${currentUrl}?${qrParams}`); setIsUrlValid(true); }
    };
    generateToken();
    const interval = setInterval(generateToken, TOKEN_VALIDITY_SECONDS * 1000);
    const timer = setInterval(() => setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
    return () => { clearInterval(interval); clearInterval(timer); };
  }, [locationId]);

  useEffect(() => {
    if (!isReady || !db) return;
    const safeQ = query(collection(db, COLLECTION_NAME), where("locationId", "==", locationId));
    const unsubscribe = onSnapshot(safeQ, (snapshot) => {
      const todayStr = getTodayStr();
      const allScans = snapshot.docs
        .map((doc) => ({ id: doc.id, ...doc.data() }))
        .filter((u) => (u.status === "waiting" || u.status === "active") && u.date === todayStr);
      
      allScans.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
      setRecentScans(allScans.slice(0, 5));
    });
    return () => unsubscribe();
  }, [isReady, locationId]);

  const handleManualExit = () => { if (window.confirm("Exit Kiosk Mode?")) { window.location.href = window.location.origin + window.location.pathname; } };

  return (
    <div className="flex flex-col md:flex-row h-screen bg-slate-900 text-white overflow-hidden">
      <div className="flex-1 flex flex-col items-center justify-center p-8 border-r border-slate-700 relative">
        <button onClick={handleManualExit} className="absolute top-6 left-6 bg-slate-800 hover:bg-red-900 px-4 py-2 rounded-lg font-bold flex items-center shadow-lg border border-slate-600 transition-colors z-50">
          <Building size={18} className="mr-2" /> {locationId}
        </button>
        <button onClick={toggleFullScreen} className="absolute top-6 right-6 bg-slate-800 hover:bg-slate-700 p-2 rounded-full border border-slate-600 transition-colors">
          <Maximize size={20} />
        </button>
        <h2 className="text-3xl font-bold mb-10 tracking-wider">SCAN TO CHECK IN</h2>
        {!isUrlValid && (
          <div className="absolute top-24 left-1/2 -translate-x-1/2 bg-yellow-500/20 border border-yellow-500 text-yellow-100 p-3 rounded-lg text-sm flex items-start gap-2 text-left">
            <Info size={18} className="mt-0.5 flex-shrink-0" />
            <div><strong>Preview Mode:</strong> This QR uses a fallback URL.</div>
          </div>
        )}
        <div className="bg-white p-4 rounded-3xl shadow-2xl shadow-blue-500/20 w-[500px] h-[500px] flex items-center justify-center border-[10px] border-white">
          {scanUrl ? <img src={`https://api.qrserver.com/v1/create-qr-code/?size=500x500&data=${encodeURIComponent(scanUrl)}`} alt="QR" className="w-full h-full object-contain" /> : <Loader className="text-slate-400 animate-spin" size={64} />}
        </div>
        <div className="mt-12 text-center">
          <div className="text-6xl font-mono font-bold text-blue-400">{timeLeft}s</div>
          <p className="text-slate-400 text-lg mt-2">Code refreshes automatically</p>
        </div>
      </div>
      <div className="w-full md:w-[450px] bg-slate-800 p-6 flex flex-col border-l border-slate-700 shadow-2xl z-10">
        <div className="flex items-center justify-between mb-8">
          <h3 className="text-2xl font-bold flex items-center"><div className="w-3 h-3 bg-green-500 rounded-full mr-3 animate-pulse"></div>{locationId} Feed</h3>
          <div className="flex gap-2">
            {wakeLockActive && <div className="px-2 py-1 bg-green-900/30 border border-green-500 text-green-400 text-[10px] rounded uppercase font-bold flex items-center"><Zap size={10} className="mr-1" /> ON</div>}
            <button onClick={handleDownloadCSV} disabled={!isReady || isDownloading} className="flex items-center px-3 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors disabled:opacity-50">
              {isDownloading ? <Loader size={14} className="animate-spin" /> : <Download size={14} />}<span className="ml-2">CSV</span>
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 pr-2">
          {!isReady ? <div className="text-center text-slate-500 mt-10"><Loader className="animate-spin mx-auto mb-2" /> Connecting...</div> : recentScans.length === 0 ? <p className="text-slate-500 text-center italic mt-10">Waiting for scans...</p> : recentScans.map((scan) => (
            <div key={scan.id} className="bg-slate-700 p-5 rounded-xl border-l-4 border-green-500 animate-in fade-in slide-in-from-right duration-500 shadow-sm">
              <div className="flex justify-between items-center">
                <div><div className="font-bold text-white text-lg">{scan.userName}</div><div className="text-slate-300 text-sm mt-1">{formatTime(scan.timestamp?.toDate())}</div></div>
                <div className="flex flex-col items-end"><div className="bg-slate-800 px-4 py-2 rounded-lg text-green-400 font-mono font-bold text-2xl border border-slate-600">#{scan.queueNumber}</div></div>
              </div>
            </div>
          ))}
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
  const [storeStats, setStoreStats] = useState({});
  const [activeTurnMap, setActiveTurnMap] = useState({});
  const [filterLoc, setFilterLoc] = useState("ALL");
  const [filterDate, setFilterDate] = useState(getTodayStr());
  const [dateMode, setDateMode] = useState("DAY");
  const [isRefreshingKiosks, setIsRefreshingKiosks] = useState(false);

  const handleLogin = (e) => { e.preventDefault(); if (passwordInput === "Anowforthewin") setIsAuthenticated(true); else setAuthError("Incorrect Password"); };

  const handleRemoteRefresh = async () => {
    if (!db || !window.confirm("Reload ALL Kiosk screens?")) return;
    setIsRefreshingKiosks(true);
    try { await setDoc(doc(db, SYSTEM_COLLECTION, "global_commands"), { forceRefreshTimestamp: serverTimestamp() }, { merge: true }); alert("Signal Sent!"); } catch (e) { alert("Failed."); } finally { setIsRefreshingKiosks(false); }
  };

  const handleKickUser = async (userDocId) => {
    if (!db || !window.confirm("Kick user from queue?")) return;
    try { await updateDoc(doc(db, COLLECTION_NAME, userDocId), { status: "abandoned" }); } catch (e) { alert("Failed to kick user."); }
  };

  const applyFilters = (rawDocs) => {
    let data = rawDocs;
    if (dateMode === "DAY") {
      data = data.filter(d => d.date === filterDate);
    } else if (dateMode === "WEEK") {
      const selectedStart = new Date(filterDate); 
      selectedStart.setHours(0, 0, 0, 0);
      const selectedEnd = new Date(selectedStart);
      selectedEnd.setDate(selectedEnd.getDate() + 7);
      
      data = data.filter((d) => { 
        if (!d.timestamp) return false; 
        const scanTime = d.timestamp.toDate(); 
        return scanTime >= selectedStart && scanTime < selectedEnd; 
      });
    }
    return data;
  };

  const calculateTurns = (filteredData) => {
    const nowServingMap = {};
    LOCATIONS.forEach(loc => {
      const locUsers = filteredData.filter(d => 
        d.locationId === loc && 
        (d.status === 'waiting' || d.status === 'active')
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
    LOCATIONS.forEach((loc) => { stats[loc] = { waiting: 0, unique_all: new Set(), abandoned: new Set() }; });
    filteredData.forEach((d) => {
      if (stats[d.locationId]) {
        const uniqueId = d.userName || d.deviceId || "unknown";
        stats[d.locationId].unique_all.add(uniqueId);
        if (d.status === "waiting" || d.status === "active") stats[d.locationId].waiting++;
        else if (d.status === "abandoned") stats[d.locationId].abandoned.add(uniqueId);
      }
    });
    const finalStats = {};
    LOCATIONS.forEach((loc) => { finalStats[loc] = { waiting: stats[loc].waiting, completed: stats[loc].unique_all.size, abandoned: stats[loc].abandoned.size }; });
    setStoreStats(finalStats);
  };

  const handleExport = async () => {
    if (!isReady || !db) return;
    const q = query(collection(db, COLLECTION_NAME));
    const snapshot = await getDocs(q);
    let data = snapshot.docs.map((doc) => doc.data());
    data = applyFilters(data);
    if (filterLoc !== "ALL") data = data.filter((d) => d.locationId === filterLoc);
    data.sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));
    const csvHeader = ["Location", "Queue Number", "Name", "Date", "Time", "Device ID", "Status", "Latitude", "Longitude"].join(",");
    const csvRows = data.map((d) => {
      const dateObj = d.timestamp ? d.timestamp.toDate() : null;
      return [d.locationId, d.queueNumber, `"${d.userName || "Guest"}"`, `"${formatDate(dateObj)}"`, `"${formatTime(dateObj)}"`, `"${d.deviceId || ""}"`, d.status || "waiting", d.location?.lat || "", d.location?.lng || ""].join(",");
    });
    const csvContent = [csvHeader, ...csvRows].join("\n");
    const a = document.createElement("a");
    a.href = window.URL.createObjectURL(new Blob([csvContent], { type: "text/csv" }));
    a.download = `Report_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  useEffect(() => {
    if (!isReady || !db || !isAuthenticated) return;
    const q = query(collection(db, COLLECTION_NAME));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let rawData = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      const dateFilteredData = applyFilters(rawData);
      calculateTurns(dateFilteredData);
      calculateStoreStats(dateFilteredData);
      
      let tableData = dateFilteredData;
      if (filterLoc !== "ALL") tableData = tableData.filter((d) => d.locationId === filterLoc);
      
      const activeQueue = tableData.filter(u => u.status === 'waiting' || u.status === 'active')
                                   .sort((a, b) => Number(a.queueNumber) - Number(b.queueNumber));
      const history = tableData.filter(u => u.status !== 'waiting' && u.status !== 'active')
                               .sort((a, b) => (b.timestamp?.toMillis() || 0) - (a.timestamp?.toMillis() || 0));

      setScans([...activeQueue, ...history]);
    });
    return () => unsubscribe();
  }, [isReady, filterLoc, filterDate, dateMode, isAuthenticated]);

  if (!isAuthenticated) return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-6">
      <div className="bg-white p-8 rounded-xl shadow-lg max-w-sm w-full">
        <h2 className="text-2xl font-bold text-center text-slate-800 mb-6">Admin Access</h2>
        <form onSubmit={handleLogin} className="space-y-4">
          <input type="password" className="w-full px-4 py-2 border rounded-lg" placeholder="Password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} autoFocus />
          {authError && <p className="text-red-500 text-sm text-center">{authError}</p>}
          <button type="submit" className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold">Unlock</button>
          <button type="button" onClick={onBack} className="w-full py-3 text-slate-500">Cancel</button>
        </form>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-100 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 gap-4">
          <button onClick={onBack} className="p-2 bg-white rounded-lg"><X size={20} /></button>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
        </div>
        <div className="flex flex-wrap gap-4 mb-8 bg-white p-4 rounded-xl shadow-sm items-center">
          <button onClick={handleRemoteRefresh} disabled={isRefreshingKiosks} className="px-4 py-2 bg-purple-600 text-white rounded-lg font-bold flex items-center">
            {isRefreshingKiosks ? <Loader size={16} className="animate-spin mr-2" /> : <Zap size={16} className="mr-2" />} Refresh Kiosks
          </button>
          <div className="flex items-center border rounded-lg overflow-hidden">
            <button onClick={() => setDateMode("DAY")} className={`px-3 py-2 text-sm font-bold ${dateMode === "DAY" ? "bg-blue-600 text-white" : "bg-slate-50 hover:bg-slate-100"}`}>Day View</button>
            <button onClick={() => setDateMode("WEEK")} className={`px-3 py-2 text-sm font-bold ${dateMode === "WEEK" ? "bg-blue-600 text-white" : "bg-slate-50 hover:bg-slate-100"}`}>Week View</button>
          </div>
          <div className="flex items-center border rounded-lg px-3 bg-slate-50">
            <Calendar size={16} className="text-slate-400 mr-2" />
            <input type="date" value={filterDate} onChange={(e) => setFilterDate(e.target.value)} className="bg-transparent py-2 outline-none" />
          </div>
          <div className="flex items-center border rounded-lg px-3 bg-slate-50 ml-auto">
            <Filter size={16} className="text-slate-400 mr-2" />
            <select value={filterLoc} onChange={(e) => setFilterLoc(e.target.value)} className="bg-transparent py-2 outline-none">
              <option value="ALL">Show All in Table</option>
              {LOCATIONS.map((l) => <option key={l} value={l}>{l}</option>)}
            </select>
          </div>
          <button onClick={handleExport} className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold flex items-center"><Download size={16} className="mr-2" /> CSV</button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
          {LOCATIONS.map((loc) => {
            if (filterLoc !== "ALL" && filterLoc !== loc) return null;
            const stat = storeStats[loc] || { waiting: 0, completed: 0, abandoned: 0 };
            if (stat.waiting === 0 && stat.completed === 0 && stat.abandoned === 0 && filterLoc === "ALL") return null;
            return (
              <div key={loc} className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
                <div className="flex items-center justify-between mb-3"><h3 className="font-bold text-lg text-slate-800">{loc}</h3><Building size={16} className="text-slate-400" /></div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-blue-50 p-2 rounded-lg"><div className="text-blue-600 font-bold text-xl">{formatNum(stat.waiting)}</div><div className="text-[10px] text-blue-400 font-bold uppercase">Wait</div></div>
                  <div className="bg-green-50 p-2 rounded-lg"><div className="text-green-600 font-bold text-xl">{formatNum(stat.completed)}</div><div className="text-[10px] text-green-400 font-bold uppercase">Unique Check-Ins</div></div>
                  <div className="bg-red-50 p-2 rounded-lg"><div className="text-red-600 font-bold text-xl">{formatNum(stat.abandoned)}</div><div className="text-[10px] text-red-400 font-bold uppercase">Lost</div></div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden">
          <div className="p-4 bg-slate-50 border-b flex justify-between text-sm font-semibold text-slate-500"><span>Detailed Logs ({scans.length})</span></div>
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
                  const isWaiting = s.status === 'waiting' || s.status === 'active';
                  return (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="px-6 py-4 font-bold text-blue-600">
                        {isWaiting ? (
                          index === 0 ? <div className="flex items-center px-2 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full w-fit animate-pulse whitespace-nowrap"><CheckCircle size={12} className="mr-1" /> NOW</div> : (index + 1)
                        ) : "-"}
                      </td>
                      <td className="px-6 py-4">{s.locationId}</td>
                      <td className="px-6 py-4 font-bold">#{formatNum(s.queueNumber)}</td>
                      <td className="px-6 py-4">{s.userName}</td>
                      <td className="px-6 py-4 text-sm text-slate-500">{s.timestamp ? `${formatDate(s.timestamp.toDate())} ${formatTime(s.timestamp.toDate())}` : ""}</td>
                      <td className="px-6 py-4"><span className={`px-2 py-1 rounded text-xs uppercase font-bold ${s.status === "completed" ? "bg-green-100 text-green-700" : s.status === "abandoned" ? "bg-red-100 text-red-600" : "bg-blue-100 text-blue-700"}`}>{s.status || "waiting"}</span></td>
                      <td className="px-6 py-4 flex gap-2 items-center">
                        {isWaiting && (
                          <button onClick={() => handleKickUser(s.id)} title="Kick User" className="bg-red-50 text-red-600 p-2 rounded hover:bg-red-100 transition-colors"><XCircle size={18} /></button>
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

// --- SCREEN 4: SCANNER (SAFE GEOFENCING WITH DEBUGGER) ---
function ScannerScreen({ token, locationId, isReady, user }) {
  const [status, setStatus] = useState("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [fingerprint, setFingerprint] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [myQueueNumber, setMyQueueNumber] = useState(null);
  const [myDocId, setMyDocId] = useState(null);
  const [peopleAhead, setPeopleAhead] = useState(null); // Default null to prevent flicker
  const [isCheckedOut, setIsCheckedOut] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [isRecovering, setIsRecovering] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [statusFromDB, setStatusFromDB] = useState("waiting");
  
  // DEBUG STATE
  const [debugDist, setDebugDist] = useState(0);
  const [debugAcc, setDebugAcc] = useState(0);

  // GEOFENCE WATCHER
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

        // Relaxed Accuracy Check: Allow up to 500m
        if (accuracy > 500) return;

        const dist = haversineDistance({ lat: userLat, lng: userLng }, LOCATIONS_COORDS[locationId]);
        setDebugDist(Math.round(dist));

        // KICK IF DEFINITELY OUT: Distance - Accuracy is still > Radius
        // Or if Distance > 500m (Way out)
        if (dist > 500 || (dist - accuracy) > GEOFENCE_RADIUS_METERS) {
          if (db && myDocId) {
            try { await updateDoc(doc(db, COLLECTION_NAME, myDocId), { status: "abandoned" }); setIsCheckedOut(true); } 
            catch (e) { console.error("Geofence exit fail", e); }
          }
        }
      },
      (err) => console.log("Geo watch error", err),
      { enableHighAccuracy: true, maximumAge: 10000 }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [myDocId, isCheckedOut, locationId]);

  // WAKE UP CHECK
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (myDocId && !isCheckedOut && LOCATIONS_COORDS[locationId]) {
           if (navigator.geolocation) {
             navigator.geolocation.getCurrentPosition(
              async (position) => {
                const dist = haversineDistance({ lat: position.coords.latitude, lng: position.coords.longitude }, LOCATIONS_COORDS[locationId]);
                // FORCE CHECK ON WAKE UP
                if (dist > GEOFENCE_RADIUS_METERS) {
                  await updateDoc(doc(db, COLLECTION_NAME, myDocId), { status: "abandoned" });
                  setIsCheckedOut(true);
                }
              },
              (err) => console.log("Wake check failed", err)
             );
           }
        }
        if (db && myDocId && !isCheckedOut) {
          updateDoc(doc(db, COLLECTION_NAME, myDocId), { lastActive: serverTimestamp() });
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [myDocId, isCheckedOut, locationId]);

  useEffect(() => {
    if (status === "success" && myDocId && !isCheckedOut) {
      const beat = setInterval(async () => {
        try { await updateDoc(doc(db, COLLECTION_NAME, myDocId), { lastActive: serverTimestamp() }); } catch (e) { console.error("Heartbeat fail", e); }
      }, 60000);
      return () => clearInterval(beat);
    }
  }, [status, myDocId, isCheckedOut]);

  useEffect(() => {
    if (myDocId) {
      const unsub = onSnapshot(doc(db, COLLECTION_NAME, myDocId), (docSnap) => {
        if (docSnap.exists()) {
          const d = docSnap.data();
          setStatusFromDB(d.status);
          if (d.status === "completed" || d.status === "abandoned") setIsCheckedOut(true);
        }
      });
      return () => unsub();
    }
  }, [myDocId]);

  useEffect(() => {
    if (status === "success" && !isCheckedOut && peopleAhead === 0) {
      const audio = new Audio("https://actions.google.com/sounds/v1/alarms/beep_short.ogg");
      audio.play().catch((e) => console.log("Audio failed", e));
    }
  }, [peopleAhead, status, isCheckedOut]);

  // ✅ CRITICAL UPDATE: UNIFIED SORTING LOGIC FOR SCANNER
  useEffect(() => {
    if (status === "success" && myQueueNumber && !isCheckedOut && isReady && db) {
      const q = query(collection(db, COLLECTION_NAME), where("locationId", "==", locationId), where("status", "in", ["waiting", "active"]));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const todayStr = getTodayStr();
        // 1. Get active users for today
        const activeUsers = snapshot.docs
          .map(d => ({ ...d.data(), id: d.id }))
          .filter(u => u.date === todayStr)
          // 2. Sort strictly numerically (Matches Admin)
          .sort((a, b) => Number(a.queueNumber) - Number(b.queueNumber));

        // 3. Find index
        const myIndex = activeUsers.findIndex(u => Number(u.queueNumber) === Number(myQueueNumber));
        
        // 4. Handle Not Found (-1) explicitly
        if (myIndex === -1) {
          setPeopleAhead(null); // Keep spinner if rank unknown
        } else {
          setPeopleAhead(myIndex);
        }
      });
      return () => unsubscribe();
    }
  }, [status, myQueueNumber, isCheckedOut, locationId, isReady]);

  const generateNativeFingerprint = async () => "fp_" + Math.random().toString(36).substr(2, 9);

  useEffect(() => {
    if (!isReady || !db) return;
    if (!locationId) { setStatus("error"); setErrorMsg("Invalid QR Code (Missing Location)"); return; }
    const init = async () => {
      setStatus("initializing");
      const STORAGE_KEY = "secure_user_badge";
      try {
        let storedBadge = null;
        try { storedBadge = localStorage.getItem(STORAGE_KEY); } catch (e) { console.warn("Storage restricted"); }
        const fp = await generateNativeFingerprint();
        setFingerprint(fp);
        if (storedBadge) {
          setDeviceId(storedBadge);
          const snap = await getDoc(doc(db, DEVICES_COLLECTION, storedBadge));
          if (snap.exists()) { setUserEmail(snap.data().email); setShowPermissionModal(true); } else setShowEmailModal(true);
        } else { setShowEmailModal(true); }
        setStatus("idle");
      } catch (e) { setStatus("error"); setErrorMsg("Init failed: " + e.message); }
    };
    init();
  }, [isReady]);

  const handleEmailSubmit = async (e) => {
    e.preventDefault();
    if (!emailInput.includes("@")) return alert("Invalid Email");
    setIsRecovering(true);
    try {
      const badgeId = "badge_" + Date.now().toString(36);
      await setDoc(doc(db, DEVICES_COLLECTION, badgeId), { email: emailInput, fingerprint: fingerprint });
      try { localStorage.setItem("secure_user_badge", badgeId); } catch (err) {}
      setDeviceId(badgeId);
      setUserEmail(emailInput);
      setShowEmailModal(false);
      setShowPermissionModal(true);
    } catch (e) { alert("Error: " + e.message); } finally { setIsRecovering(false); }
  };

  const confirmAndCheckIn = () => {
    if (!navigator.geolocation) { setStatus("error"); setErrorMsg("Location tracking not supported."); return; }
    setShowPermissionModal(false);
    setStatus("locating");
    navigator.geolocation.getCurrentPosition((pos) => saveCheckIn(pos.coords), (err) => { setStatus("error"); setErrorMsg("Location permission denied."); });
  };

  const saveCheckIn = async (coords) => {
    setStatus("saving");
    try {
      const zombieQ = query(collection(db, COLLECTION_NAME), where("deviceId", "==", deviceId), where("status", "in", ["waiting", "active"]));
      const zombieSnap = await getDocs(zombieQ);
      let resumeDoc = null;
      if (!zombieSnap.empty) {
        for (const docSnap of zombieSnap.docs) {
          const d = docSnap.data();
          if (d.tokenUsed === token) resumeDoc = docSnap;
          else await updateDoc(doc(db, COLLECTION_NAME, docSnap.id), { status: "abandoned" });
        }
      }
      if (resumeDoc) {
        const d = resumeDoc.data();
        setMyQueueNumber(d.queueNumber);
        setMyDocId(resumeDoc.id);
        setStatus("success");
        await updateDoc(doc(db, COLLECTION_NAME, resumeDoc.id), { lastActive: serverTimestamp() });
        return;
      }
      const todayStr = getTodayStr(); 
      const newRef = doc(collection(db, COLLECTION_NAME));
      const qNum = await runTransaction(db, async (t) => {
        const cRef = doc(db, COUNTER_COLLECTION, locationId);
        const cSnap = await t.get(cRef);
        let next = 1;
        if (cSnap.exists() && cSnap.data().date === todayStr) next = cSnap.data().count + 1;
        t.set(cRef, { date: todayStr, count: next, locationId });
        t.set(newRef, { userName: userEmail, locationId, queueNumber: next, deviceId, timestamp: serverTimestamp(), status: "waiting", location: { lat: coords.latitude, lng: coords.longitude }, tokenUsed: token, fingerprint, lastActive: serverTimestamp(), date: todayStr });
        return next;
      });
      setMyQueueNumber(qNum);
      setMyDocId(newRef.id);
      setStatus("success");
    } catch (e) { setStatus("error"); setErrorMsg("Check-in failed: " + e.message); }
  };

  if (status === "success") {
    if (statusFromDB === "abandoned") return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-red-50 text-center animate-in zoom-in">
        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6 text-red-600"><XCircle size={32} /></div>
        <h2 className="text-xl font-bold text-red-800 mb-2">You Left the Area</h2>
        <p className="text-slate-600 mb-6">You must stay near the store to keep your spot.</p>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-red-600 text-white rounded-xl font-bold">Start Over</button>
      </div>
    );
    if (isCheckedOut) return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-gray-100 text-center animate-in zoom-in">
        <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center mb-6 text-gray-500"><LogOut size={32} /></div>
        <h2 className="text-xl font-bold text-gray-800 mb-2">You have left the queue</h2>
        <button onClick={() => window.location.reload()} className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold">New Check In</button>
      </div>
    );
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 bg-green-50 text-center animate-in zoom-in relative">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-6 text-green-600"><CheckCircle size={32} /></div>
        <h2 className="text-xl font-bold text-green-800 mb-2">Check-In Successful</h2>
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-green-200 mt-4 mb-6 w-full max-w-xs">
          <div className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-1">{locationId} Ticket</div>
          <div className="text-6xl font-black text-slate-800">#{formatNum(myQueueNumber)}</div>
          <div className="text-sm font-semibold text-blue-600 mt-2">{userEmail}</div>
        </div>
        <div className="w-full max-w-xs mb-8">
          <div className={`${peopleAhead === 0 ? "bg-green-600" : "bg-blue-600"} text-white p-4 rounded-xl shadow-md transition-colors`}>
            <div className="text-xs uppercase font-bold opacity-80 mb-1">Users Remaining Before You</div>
            <div className="text-4xl font-bold">
              {/* ✅ SAFE LOADING STATE: Prevents "It's your turn" flicker */}
              {peopleAhead === null ? <Loader className="animate-spin inline" /> : (peopleAhead === 0 ? "It's your turn!" : formatNum(peopleAhead))}
            </div>
          </div>
        </div>
        
        {/* DEBUG PANEL - Remove this block in production if not needed */}
        {LOCATIONS_COORDS[locationId] && (
          <div className="absolute bottom-4 left-4 right-4 bg-black/50 text-white p-2 rounded text-[10px] font-mono pointer-events-none">
            DEBUG: Dist {debugDist}m (Limit {GEOFENCE_RADIUS_METERS}m) | Acc ±{debugAcc}m
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white p-6 flex flex-col items-center justify-center">
      {showEmailModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80"><div className="bg-white p-8 rounded-2xl max-w-sm w-full"><div className="flex justify-center mb-4 text-blue-600"><Mail size={40} /></div><h3 className="text-xl font-bold mb-2 text-center">Identity Check</h3><form onSubmit={handleEmailSubmit}><input type="email" required className="w-full px-4 py-3 border rounded-xl mb-4" placeholder="Email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)} /><button type="submit" disabled={isRecovering} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold">{isRecovering ? "Verifying..." : "Continue"}</button></form></div></div>}
      {showPermissionModal && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60"><div className="bg-white p-6 rounded-2xl max-w-sm w-full"><h3 className="text-lg font-bold mb-2">Check in at {locationId}?</h3><button onClick={confirmAndCheckIn} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold">Allow & Check In</button></div></div>}
      <div className="text-center">{status !== "idle" && <Loader className="animate-spin mx-auto mb-4 text-blue-500" />}<p className="text-slate-500">{status === "idle" || status === "initializing" ? "Verifying..." : "Saving..."}</p>{errorMsg && <p className="text-red-500 mt-2">{errorMsg}</p>}</div>
    </div>
  );
}