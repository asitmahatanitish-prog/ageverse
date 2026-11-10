import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";


// ======================================
// 1. FIREBASE CONFIGURATION
// ======================================

const firebaseConfig = {
  apiKey: "AIzaSyD1p7QysavkEfkTxRzQTltKl43uODz6Cug",
  authDomain: "age-calculator-ea3d5.firebaseapp.com",
  projectId: "age-calculator-ea3d5",
  storageBucket: "age-calculator-ea3d5.firebasestorage.app",
  messagingSenderId: "843544998360",
  appId: "1:843544998360:web:c47bbb954e9dc8b92d82ad",
  measurementId: "G-T778Z9LWBF"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const googleProvider = new GoogleAuthProvider();

// Firestore will load only when needed
let firestorePromise = null;

function getFirestoreTools() {
  if (!firestorePromise) {
    firestorePromise = import(
      "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js"
    ).then(module => ({
      db: module.getFirestore(app),
      doc: module.doc,
      getDoc: module.getDoc,
      setDoc: module.setDoc,
      serverTimestamp: module.serverTimestamp
    }));
  }

  return firestorePromise;
}

googleProvider.setCustomParameters({
  prompt: "select_account"
});

// ======================================
// 2. ELEMENTS AND HELPERS
// ======================================

const $ = id => document.getElementById(id);

let currentUser = null;
let currentName = "";
let ageTimer = null;
let selectedBirthDate = null;
let pendingBirthDateValue = "";
let isGoogleLoginInProgress = false;

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = String(value);
}

function showError(id, message) {
  setText(id, message);
}

function setButtonLoading(button, loading, text) {
  if (!button) return;

  button.disabled = loading;

  if (text) {
    button.textContent = text;
  }
}

// ======================================
// 3. PAGE NAVIGATION
// ======================================

function showPage(page) {
  const pages = {
    login: "loginPage",
    name: "namePage",
    app: "appPage"
  };

  Object.values(pages).forEach(id => {
    $(id)?.classList.add("hidden");
  });

  const target = pages[page];

  if (target) {
    $(target)?.classList.remove("hidden");
  }
}

function showSection(section) {
  if (section === "profile" && !currentUser) {
  return;
  }
  $("homeSection")?.classList.add("hidden");
  $("profileSection")?.classList.add("hidden");

  document.querySelectorAll(".nav-btn[data-page]")
    .forEach(button => {
      button.classList.remove("active");
    });

  if (section === "home") {
    $("homeSection")?.classList.remove("hidden");

    document.querySelector('[data-page="home"]')
      ?.classList.add("active");

  } else if (section === "profile") {
    $("profileSection")?.classList.remove("hidden");

    document.querySelector('[data-page="profile"]')
      ?.classList.add("active");

    loadProfile();
  }

  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


// ======================================
// 4. GOOGLE LOGIN
// ======================================

async function startGoogleLogin() {
  if (currentUser || isGoogleLoginInProgress) return;

  isGoogleLoginInProgress = true;

  const buttons = [
    $("googleLogin"),
    $("topGoogleLogin")
  ];

  buttons.forEach(button => {
    if (button) button.disabled = true;
  });

  showError("loginError", "");
  showError("calcError", "");

  try {
    await signInWithPopup(auth, googleProvider);

  } catch (error) {
    console.error("Google Login Error:", error);

    let message = "Unable to sign in. Please try again.";

    if (error.code === "auth/popup-closed-by-user") {
      message = "Login window was closed. Please try again.";
    } else if (error.code === "auth/popup-blocked") {
      message = "Popup blocked. Please allow popups in your browser.";
    } else if (error.code === "auth/network-request-failed") {
      message = "Network error. Please check your internet connection.";
    }

    showError("loginError", message);
    showError("calcError", message);

  } finally {
    isGoogleLoginInProgress = false;

    buttons.forEach(button => {
      if (button) button.disabled = false;
    });
  }
}

$("googleLogin")?.addEventListener("click", startGoogleLogin);

$("topGoogleLogin")?.addEventListener("click", startGoogleLogin);



// ======================================
// 5. AUTHENTICATION STATE
// ======================================

onAuthStateChanged(auth, async user => {
  currentUser = user;

  const profileNav = document.querySelector(
    '.nav-btn[data-page="profile"]'
  );

  if (!user) {
    currentName = "";

    if (ageTimer) {
      clearInterval(ageTimer);
      ageTimer = null;
    }

    selectedBirthDate = null;

    $("results")?.classList.add("hidden");

    // Show public Home Page
    showPage("app");
    showSection("home");

    setText("greeting", "Welcome to Ageverse");

    // Show Google Login button
    $("topGoogleLogin")?.classList.remove("hidden");

    // Hide Profile options
    $("topProfile")?.classList.add("hidden");
    profileNav?.classList.add("hidden");

    $("loader")?.classList.add("hidden");

    return;
  }

  // Logged-in user
  $("topGoogleLogin")?.classList.add("hidden");
  $("topProfile")?.classList.remove("hidden");
  profileNav?.classList.remove("hidden");

  try {
    const { db, doc, getDoc } = await getFirestoreTools();

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().name) {
      currentName = userSnap.data().name;
      openDashboard();

    } else {
      if ($("setupName")) {
        $("setupName").value = user.displayName || "";
      }

      showPage("name");
    }

  } catch (error) {
    console.error("Firebase Error:", error);

    showError(
      "nameError",
      "Unable to load your profile. Please check your internet connection."
    );

    showPage("name");

  } finally {
    $("loader")?.classList.add("hidden");
  }
});

// ======================================
// 6. SAVE USER NAME
// ======================================

$("saveName")?.addEventListener("click", async () => {
  if (!currentUser) return;

  const name = $("setupName")?.value.trim() || "";

  if (name.length < 2) {
    showError(
      "nameError",
      "Please enter at least 2 characters."
    );
    return;
  }

  showError("nameError", "");

  const button = $("saveName");

  setButtonLoading(button, true, "Saving...");

  try {
  const {
    db,
    doc,
    setDoc,
    serverTimestamp
  } = await getFirestoreTools();

  await setDoc(
    doc(db, "users", currentUser.uid),
      {
        name,
        email: currentUser.email || "",
        photoURL: currentUser.photoURL || "",
        updatedAt: serverTimestamp()
      },
      { merge: true }
    );

    await updateProfile(currentUser, {
      displayName: name
    });

    currentName = name;

    openDashboard();

  } catch (error) {
    console.error("Save Name Error:", error);

    showError(
      "nameError",
      "Unable to save your name. Please try again."
    );

  } finally {
    setButtonLoading(button, false);

    if (button) {
      button.innerHTML = 'Continue <span>→</span>';
    }
  }
});


// ==================================
// 7. OPEN DASHBOARD
// ======================================

function getSavedPhoto() {
  try {
    return localStorage.getItem("ageVerseProfilePhoto") || "";
  } catch (error) {
    console.warn("Photo storage unavailable:", error);
    return "";
  }
}

function updateProfilePhoto() {
  const photo = getSavedPhoto() || currentUser?.photoURL || "";

  if (photo && $("profilePhoto")) {
    $("profilePhoto").src = photo;
  }
}

function openDashboard() {
  showPage("app");

  $("topGoogleLogin")?.classList.add("hidden");
  $("topProfile")?.classList.remove("hidden");

  document.querySelector(
    '.nav-btn[data-page="profile"]'
  )?.classList.remove("hidden");

  setText("greeting", "Welcome, " + currentName);
  setText("profileName", currentName);
  setText("profileEmail", currentUser?.email || "");

  if ($("editNameInput")) {
    $("editNameInput").value = currentName;
  }

  setText(
    "topProfile",
    currentName.charAt(0).toUpperCase()
  );

  updateProfilePhoto();

  showSection("home");

  // Calculate previously selected DOB after login
  processPendingBirthDate();
}

// ======================================
// 8. PROFILE
// ======================================


async function loadProfile() {
  if (!currentUser) return;

  try {
    const { db, doc, getDoc } = await getFirestoreTools();

    const userRef = doc(db, "users", currentUser.uid);
    const snap = await getDoc(userRef);

    if (snap.exists()) {
      currentName = snap.data().name || currentName;
    }

    setText("profileName", currentName);
    setText("profileEmail", currentUser.email || "");
    setText("greeting", "Welcome, " + currentName);

    setText(
      "topProfile",
      currentName.charAt(0).toUpperCase()
    );

    if ($("editNameInput")) {
      $("editNameInput").value = currentName;
    }

    updateProfilePhoto();

  } catch (error) {
    console.error("Profile Load Error:", error);

    showError(
      "profileMessage",
      "Unable to load profile information."
    );
  }
}

// UPDATE PROFILE

$("updateProfile")?.addEventListener("click", async () => {
  if (!currentUser) return;

  const name = $("editNameInput")?.value.trim() || "";

  if (name.length < 2) {
    showError("profileMessage", "Enter a valid name.");
    return;
  }

  const button = $("updateProfile");

  setButtonLoading(button, true);

  const message = $("profileMessage");
if (message) {
  message.style.color = "#ffffff";
  message.textContent = "Saving...";
}

  try {
  const {
    db,
    doc,
    setDoc,
    serverTimestamp
  } = await getFirestoreTools();

  await setDoc(
    doc(db, "users", currentUser.uid),
    {
      name,
      email: currentUser.email || "",
      updatedAt: serverTimestamp()
    },
    { merge: true }
  );


    await updateProfile(currentUser, {
      displayName: name
    });

    currentName = name;

    setText("profileName", name);
    setText("greeting", "Welcome, " + name);

    setText(
      "topProfile",
      name.charAt(0).toUpperCase()
    );

    const message = $("profileMessage");

if (message) {
  message.style.color = "#22c55e";
  message.textContent = "Profile updated successfully!";

  setTimeout(() => {
    if (message.textContent === "Profile updated successfully!") {
      message.textContent = "";
      message.style.color = "";
    }
  }, 3000);
}

  } catch (error) {
    console.error("Profile Update Error:", error);

    showError(
      "profileMessage",
      "Unable to update profile. Please try again."
    );

  } finally {
    setButtonLoading(button, false);
  }
});

// ======================================
// 9. ACCURATE AGE CALCULATOR
// ======================================

// Create a UTC date without timezone shifting.
function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month, day));
}

// Today's local calendar date represented in UTC.
function getTodayUTC() {
  const now = new Date();

  return utcDate(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

// Leap year check.
function isLeapYear(year) {
  return (
    year % 4 === 0 &&
    (year % 100 !== 0 || year % 400 === 0)
  );
}

// Birthday in a particular year.
// February 29 becomes February 28 in non-leap years.
function birthdayInYear(birth, year) {
  const month = birth.getUTCMonth();
  const day = birth.getUTCDate();

  if (
    month === 1 &&
    day === 29 &&
    !isLeapYear(year)
  ) {
    return utcDate(year, 1, 28);
  }

  return utcDate(year, month, day);
}

// Calculate exact completed years, months and days.
function calculateAge(birth, today) {
  let years =
    today.getUTCFullYear() - birth.getUTCFullYear();

  let anniversary = birthdayInYear(
    birth,
    today.getUTCFullYear()
  );

  if (anniversary > today) {
    years--;

    anniversary = birthdayInYear(
      birth,
      today.getUTCFullYear() - 1
    );
  }

  let months = 0;
  let cursor = anniversary;

  while (months < 11) {
    const nextMonth = utcDate(
      cursor.getUTCFullYear(),
      cursor.getUTCMonth() + 1,
      1
    );

    const lastDay = utcDate(
      nextMonth.getUTCFullYear(),
      nextMonth.getUTCMonth() + 1,
      0
    ).getUTCDate();

    const next = utcDate(
      nextMonth.getUTCFullYear(),
      nextMonth.getUTCMonth(),
      Math.min(anniversary.getUTCDate(), lastDay)
    );

    if (next > today) break;

    cursor = next;
    months++;
  }

  const days = Math.floor(
    (today.getTime() - cursor.getTime()) / 86400000
  );

  return {
    years,
    months,
    days
  };
}

// Next birthday information.
function getBirthdayInfo(birth, today) {
  let year = today.getUTCFullYear();

  let next = birthdayInYear(birth, year);

  if (next < today) {
    year++;
    next = birthdayInYear(birth, year);
  }

  const diff = Math.round(
    (next.getTime() - today.getTime()) / 86400000
  );

  return {
    next,
    diff
  };
}

// Number formatting.
function formatNumber(number) {
  return Number(number).toLocaleString("en-IN");
}

// Date formatting.
function formatDate(date) {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

// Calculate elapsed time from local midnight on DOB.
function getBirthTimestamp(birth) {
  return new Date(
    birth.getUTCFullYear(),
    birth.getUTCMonth(),
    birth.getUTCDate()
  ).getTime();
}

// Update all age results.
function updateAgeReport() {
  if (!selectedBirthDate) return;

  const today = getTodayUTC();

  const age = calculateAge(
    selectedBirthDate,
    today
  );

  const totalMonths =
    age.years * 12 + age.months;

  const elapsedMs = Math.max(
    0,
    Date.now() - getBirthTimestamp(selectedBirthDate)
  );

  const totalSeconds = Math.floor(elapsedMs / 1000);
  const totalMinutes = Math.floor(totalSeconds / 60);
  const totalHours = Math.floor(totalMinutes / 60);
  const totalDays = Math.floor(totalHours / 24);
  const totalWeeks = Math.floor(totalDays / 7);

  setText("years", age.years);

  setText(
    "ageSub",
    `${age.months} months and ${age.days} days`
  );

  setText("totalMonths", formatNumber(totalMonths));
  setText("totalWeeks", formatNumber(totalWeeks));
  setText("totalDays", formatNumber(totalDays));
  setText("totalHours", formatNumber(totalHours));
  setText("totalMinutes", formatNumber(totalMinutes));
  setText("totalSeconds", formatNumber(totalSeconds));

  const birthday = getBirthdayInfo(
    selectedBirthDate,
    today
  );

  setText(
    "birthdayCountdown",
    birthday.diff === 0
      ? "Happy Birthday! 🎉"
      : `${birthday.diff} days to go`
  );

  setText(
    "birthdayDate",
    formatDate(birthday.next)
  );

  setText(
    "birthDay",
    selectedBirthDate.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC"
    })
  );

  setText(
    "birthDateText",
    formatDate(selectedBirthDate)
  );
}

// ======================================
// CALCULATE AGE
// ======================================

function runAgeCalculation(birth) {
  selectedBirthDate = birth;

  if (ageTimer) {
    clearInterval(ageTimer);
  }

  updateAgeReport();

  ageTimer = setInterval(
    updateAgeReport,
    1000
  );

  $("results")?.classList.remove("hidden");

  $("results")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// Process DOB saved before Google Login
function processPendingBirthDate() {
  if (!currentUser || !pendingBirthDateValue) return;

  const parts = pendingBirthDateValue.split("-").map(Number);

  const [year, month, day] = parts;

  const birth = utcDate(year, month - 1, day);

  pendingBirthDateValue = "";

  runAgeCalculation(birth);
}

// Validate DOB
function getValidBirthDate(value) {
  if (!value) return null;

  const parts = value.split("-");

  if (parts.length !== 3) return null;

  const [year, month, day] = parts.map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const birth = utcDate(year, month - 1, day);
  const today = getTodayUTC();

  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day ||
    birth > today
  ) {
    return null;
  }

  return birth;
}

// Calculate Button
$("calculateBtn")?.addEventListener("click", async () => {
  const value = $("dob")?.value || "";

  showError("calcError", "");

  if (!value) {
    showError("calcError", "Please select your birth date.");
    return;
  }

  const birth = getValidBirthDate(value);

  if (!birth) {
    showError("calcError", "Please enter a valid birth date.");
    return;
  }

  // Save selected DOB before login
  if (!currentUser) {
    pendingBirthDateValue = value;

    showError(
      "calcError",
      "Please sign in with Google to calculate your age."
    );

    await startGoogleLogin();

    return;
  }

  // Already logged in
  runAgeCalculation(birth);
});

// Maximum birth date = today.
if ($("dob")) {
  const now = new Date();

  $("dob").max = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0")
  ].join("-");
}

// ======================================
// 10. NAVIGATION
// ======================================

document.querySelectorAll(".nav-btn[data-page]")
  .forEach(button => {
    button.addEventListener("click", () => {
      showSection(button.dataset.page);
    });
  });

$("topProfile")?.addEventListener("click", () => {
  if (currentUser) {
    showSection("profile");
  }
});

// ======================================
// 11. DARK / LIGHT THEME
// ======================================

function setTheme(theme) {
  const selectedTheme =
    theme === "dark" ? "dark" : "light";

  document.documentElement.dataset.theme =
    selectedTheme;

  try {
    localStorage.setItem(
      "ageverse-theme",
      selectedTheme
    );
  } catch (error) {
    console.warn("Theme could not be saved:", error);
  }

  if ($("themeToggle")) {
    $("themeToggle").textContent =
      selectedTheme === "dark" ? "☀" : "☾";
  }
}

let savedTheme = "light";

try {
  savedTheme =
    localStorage.getItem("ageverse-theme") || "light";
} catch (error) {
  console.warn("Theme storage unavailable:", error);
}

setTheme(savedTheme);

function toggleTheme() {
  const currentTheme =
    document.documentElement.dataset.theme;

  setTheme(
    currentTheme === "dark" ? "light" : "dark"
  );
}

$("themeToggle")?.addEventListener(
  "click",
  toggleTheme
);

$("sideTheme")?.addEventListener(
  "click",
  toggleTheme
);

// ======================================
// 12. LOGOUT
// ======================================

$("logoutBtn")?.addEventListener("click", async () => {
  const confirmed = confirm(
    "Are you sure you want to sign out?"
  );

  if (!confirmed) return;

  try {
    if (ageTimer) {
      clearInterval(ageTimer);
      ageTimer = null;
    }

    await signOut(auth);

  } catch (error) {
    console.error("Logout Error:", error);

    alert(
      "Logout failed. Please try again."
    );
  }
});

// ======================================
// 13. PROFILE PHOTO
// ======================================

const photoInput = $("profilePhotoInput");
const choosePhotoBtn = $("choosePhotoBtn");
const profilePhoto = $("profilePhoto");

choosePhotoBtn?.addEventListener("click", () => {
  photoInput?.click();
});

photoInput?.addEventListener("change", () => {
  const file = photoInput.files?.[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select a valid image.");
    photoInput.value = "";
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("Please select an image smaller than 5 MB.");
    photoInput.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = event => {
    const img = new Image();

    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 300;

      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");

      if (!ctx) {
        alert("Unable to process this image.");
        return;
      }

      // Center crop to square without stretching.
      const cropSize = Math.min(
        img.width,
        img.height
      );

      const cropX = (img.width - cropSize) / 2;
      const cropY = (img.height - cropSize) / 2;

      ctx.drawImage(
        img,
        cropX,
        cropY,
        cropSize,
        cropSize,
        0,
        0,
        size,
        size
      );

      const imageData = canvas.toDataURL(
        "image/jpeg",
        0.75
      );

      try {
        localStorage.setItem(
          "ageVerseProfilePhoto",
          imageData
        );

        if (profilePhoto) {
          profilePhoto.src = imageData;
        }

        alert("Profile photo saved!");

      } catch (error) {
        console.error("Photo Storage Error:", error);

        alert(
          "Storage full. Please choose a smaller image."
        );
      }
    };

    img.onerror = () => {
      alert("Unable to open this image.");
    };

    img.src = event.target.result;
  };

  reader.onerror = () => {
    alert("Unable to read this image.");
  };

  reader.readAsDataURL(file);
});

// Load saved profile photo.
updateProfilePhoto();

// ======================================
// 14. PWA SERVICE WORKER
// ======================================

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("./service-worker.js")
      .then(registration => {
        console.log(
          "Ageverse Service Worker registered:",
          registration.scope
        );
      })
      .catch(error => {
        console.error(
          "Service Worker registration failed:",
          error
        );
      });
  });
}

// ======================================
// 15. BIRTHDAY NOTIFICATION SETTINGS
// ======================================

const birthdayNotifyBtn = $("birthdayNotifyBtn");
const birthdayNotifyStatus = $("birthdayNotifyStatus");

birthdayNotifyBtn?.addEventListener("click", async () => {
  if (!("Notification" in window)) {
    setText(
      "birthdayNotifyStatus",
      "Your browser does not support notifications."
    );
    return;
  }

  if (Notification.permission === "denied") {
    setText(
      "birthdayNotifyStatus",
      "Notifications are blocked. Please allow them in your browser site settings."
    );
    return;
  }

  try {
    let permission = Notification.permission;

    // Ask only after the user clicks the button.
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission !== "granted") {
      setText(
        "birthdayNotifyStatus",
        "Notification permission was not granted."
      );
      return;
    }

    if (!("serviceWorker" in navigator)) {
      setText(
        "birthdayNotifyStatus",
        "Service Worker is not supported."
      );
      return;
    }

    const registration =
      await navigator.serviceWorker.ready;

    await registration.showNotification("Ageverse", {
      body: "Birthday notification test is working! 🎉",
      icon: "./icon-192.png",
      badge: "./icon-192.png"
    });

    setText(
      "birthdayNotifyStatus",
      "Notification test successful! 🎉"
    );

  } catch (error) {
    console.error("Notification Error:", error);

    setText(
      "birthdayNotifyStatus",
      "Unable to show notification. Please check browser settings."
    );
  }
});

