
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

googleProvider.setCustomParameters({
  prompt: "select_account"
});


// ======================================
// 2. FIRESTORE LAZY LOADING
// ======================================

let firestorePromise = null;

function getFirestoreTools() {
  if (!firestorePromise) {
    firestorePromise = import(
      "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js"
    )
      .then(module => ({
        db: module.getFirestore(app),
        doc: module.doc,
        getDoc: module.getDoc,
        setDoc: module.setDoc,
        serverTimestamp: module.serverTimestamp
      }))
      .catch(error => {
        firestorePromise = null;
        throw error;
      });
  }

  return firestorePromise;
}


// ======================================
// 3. ELEMENTS AND GLOBAL VARIABLES
// ======================================

const $ = id => document.getElementById(id);

let currentUser = null;
let currentName = "";

let ageTimer = null;
let birthdayTimer = null;

let selectedBirthDate = null;
let pendingBirthDateValue = "";

let isGoogleLoginInProgress = false;
let authReady = false;

const STORAGE_KEYS = {
  theme: "ageverse-theme",
  photo: "ageVerseProfilePhoto",
  dob: "ageverse-birth-date",
  notification: "ageverse-birthday-notification",
  lastNotification: "ageverse-last-birthday-notification"
};


// ======================================
// 4. STORAGE HELPERS
// ======================================

function storageGet(key) {
  try {
    return localStorage.getItem(key);
  } catch (error) {
    console.warn("Storage unavailable:", error);
    return null;
  }
}

function storageSet(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (error) {
    console.warn("Storage save failed:", error);
    return false;
  }
}

function storageRemove(key) {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn("Storage remove failed:", error);
  }
}


// ======================================
// 4.1 ACCOUNT-SPECIFIC STORAGE
// ======================================

function getUserStorageKey(key) {
  if (!currentUser) return null;

  return `${key}:${currentUser.uid}`;
}


// ======================================
// 5. COMMON HELPERS
// ======================================

function setText(id, value) {
  const element = $(id);

  if (element) {
    element.textContent = String(value);
  }
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

function stopAgeTimer() {
  if (ageTimer) {
    clearInterval(ageTimer);
    ageTimer = null;
  }
}

function stopBirthdayTimer() {
  if (birthdayTimer) {
    clearInterval(birthdayTimer);
    birthdayTimer = null;
  }
}


// ======================================
// 6. PAGE NAVIGATION
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
// 7. GOOGLE LOGIN
// ======================================

async function startGoogleLogin() {

  if (currentUser || isGoogleLoginInProgress) {
    return;
  }

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

    const messages = {
      "auth/popup-closed-by-user":
        "Login window was closed. Please try again.",

      "auth/popup-blocked":
        "Popup blocked. Please allow popups in your browser.",

      "auth/network-request-failed":
        "Network error. Please check your internet connection.",

      "auth/unauthorized-domain":
        "This domain is not authorized in Firebase.",

      "auth/operation-not-allowed":
        "Google Login is not enabled in Firebase."
    };

    const message =
      messages[error.code] ||
      "Unable to sign in. Please try again.";

    showError("loginError", message);
    showError("calcError", message);

  } finally {

    isGoogleLoginInProgress = false;

    buttons.forEach(button => {
      if (button) button.disabled = false;
    });
  }
}


$("googleLogin")?.addEventListener(
  "click",
  startGoogleLogin
);

$("topGoogleLogin")?.addEventListener(
  "click",
  startGoogleLogin
);


// ======================================
// 8. AUTHENTICATION STATE
// ======================================

onAuthStateChanged(auth, async user => {

  currentUser = user;
  authReady = true;

  const profileNav = document.querySelector(
    '.nav-btn[data-page="profile"]'
  );

  if (!user) {

    currentName = "";

    stopAgeTimer();
    stopBirthdayTimer();

    selectedBirthDate = null;
    pendingBirthDateValue = "";

    if ($("dob")) {
      $("dob").value = "";
    }

    $("results")?.classList.add("hidden");

    showError("calcError", "");

    showPage("app");
    showSection("home");

    setText("greeting", "Welcome to Ageverse");

    $("topGoogleLogin")?.classList.remove("hidden");

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

    const { db, doc, getDoc } =
      await getFirestoreTools();

    if (auth.currentUser?.uid !== user.uid) {
      return;
    }

    const userRef = doc(db, "users", user.uid);

    const userSnap = await getDoc(userRef);

    if (auth.currentUser?.uid !== user.uid) {
      return;
    }

    if (
      userSnap.exists() &&
      userSnap.data().name
    ) {

      currentName = userSnap.data().name;

      openDashboard();

    } else {

      if ($("setupName")) {
        $("setupName").value =
          user.displayName || "";
      }

      showPage("name");
    }

  } catch (error) {

    console.error("Firebase Error:", error);

    showPage("app");

    showSection("home");

    setText(
      "greeting",
      user.displayName || "Welcome to Ageverse"
    );

    showError(
      "calcError",
      "Unable to load your profile. Please check your internet connection and refresh the page."
    );

  } finally {

    $("loader")?.classList.add("hidden");
  }

});


// ======================================
// 9. SAVE USER NAME
// ======================================

$("saveName")?.addEventListener(
  "click",
  async () => {

    if (!currentUser) return;

    const name =
      $("setupName")?.value.trim() || "";

    if (name.length < 2) {

      showError(
        "nameError",
        "Please enter at least 2 characters."
      );

      return;
    }

    showError("nameError", "");

    const button = $("saveName");

    setButtonLoading(
      button,
      true,
      "Saving..."
    );

    try {

      const {
        db,
        doc,
        setDoc,
        serverTimestamp
      } = await getFirestoreTools();

      if (!auth.currentUser) return;

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
        button.innerHTML =
          'Continue <span>→</span>';
      }
    }
  }
);


// ======================================
// 10. PROFILE PHOTO HELPERS
// ======================================

function getSavedPhoto() {

  const key = getUserStorageKey(
    STORAGE_KEYS.photo
  );

  return key
    ? storageGet(key) || ""
    : "";
}


function updateProfilePhoto() {

  const photo =
    getSavedPhoto() ||
    currentUser?.photoURL ||
    "";

  if (photo && $("profilePhoto")) {
    $("profilePhoto").src = photo;
  }
}


// ======================================
// 11. OPEN DASHBOARD
// ======================================

function openDashboard() {

  if (!currentUser) return;

  showPage("app");

  $("topGoogleLogin")?.classList.add("hidden");

  $("topProfile")?.classList.remove("hidden");

  document.querySelector(
    '.nav-btn[data-page="profile"]'
  )?.classList.remove("hidden");

  setText(
    "greeting",
    "Welcome, " + currentName
  );

  setText("profileName", currentName);

  setText(
    "profileEmail",
    currentUser.email || ""
  );

  if ($("editNameInput")) {
    $("editNameInput").value = currentName;
  }

  setText(
    "topProfile",
    currentName.charAt(0).toUpperCase()
  );

  updateProfilePhoto();

  showSection("home");

  // Restore account-specific DOB.

  const dobKey = getUserStorageKey(
    STORAGE_KEYS.dob
  );

  const savedDOB = dobKey
    ? storageGet(dobKey)
    : null;

  if (savedDOB) {

    const birth = getValidBirthDate(savedDOB);

    if (birth) {

      if ($("dob")) {
        $("dob").value = savedDOB;
      }

      runAgeCalculation(birth, false);

    } else {

      if (dobKey) {
        storageRemove(dobKey);
      }
    }
  }

  processPendingBirthDate();

  // Start automatic birthday checking.

  startBirthdayChecking();
}


// ======================================
// 12. PROFILE
// ======================================

async function loadProfile() {

  if (!currentUser) return;

  const user = currentUser;

  try {

    const { db, doc, getDoc } =
      await getFirestoreTools();

    const userRef = doc(db, "users", user.uid);

    const snap = await getDoc(userRef);

    if (auth.currentUser?.uid !== user.uid) {
      return;
    }

    if (snap.exists()) {
      currentName =
        snap.data().name || currentName;
    }

    setText("profileName", currentName);

    setText(
      "profileEmail",
      user.email || ""
    );

    setText(
      "greeting",
      "Welcome, " + currentName
    );

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


// ======================================
// 13. UPDATE PROFILE
// ======================================

$("updateProfile")?.addEventListener(
  "click",
  async () => {

    if (!currentUser) return;

    const name =
      $("editNameInput")?.value.trim() || "";

    if (name.length < 2) {

      const message = $("profileMessage");

      if (message) {
        message.style.color = "#e65c6a";
        message.textContent =
          "Enter a valid name.";
      }

      return;
    }

    const user = currentUser;

    const button = $("updateProfile");
    const message = $("profileMessage");

    setButtonLoading(button, true);

    if (message) {
      message.style.color = "";
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
        doc(db, "users", user.uid),
        {
          name,
          email: user.email || "",
          updatedAt: serverTimestamp()
        },
        { merge: true }
      );

      await updateProfile(user, {
        displayName: name
      });

      if (auth.currentUser?.uid !== user.uid) {
        return;
      }

      currentName = name;

      setText("profileName", name);

      setText(
        "greeting",
        "Welcome, " + name
      );

      setText(
        "topProfile",
        name.charAt(0).toUpperCase()
      );

      if (message) {

        message.style.color = "#22c55e";

        message.textContent =
          "Profile updated successfully!";

        setTimeout(() => {

          if (
            message.textContent ===
            "Profile updated successfully!"
          ) {
            message.textContent = "";
            message.style.color = "";
          }

        }, 3000);
      }

    } catch (error) {

      console.error(
        "Profile Update Error:",
        error
      );

      if (message) {
        message.style.color = "#e65c6a";

        message.textContent =
          "Unable to update profile. Please try again.";
      }

    } finally {

      setButtonLoading(button, false);
    }
  }
);


// ======================================
// 14. ACCURATE AGE CALCULATOR
// ======================================

// UTC calendar date.

function utcDate(year, month, day) {

  return new Date(
    Date.UTC(year, month, day)
  );
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
    (
      year % 100 !== 0 ||
      year % 400 === 0
    )
  );
}


// Birthday in a particular year.

function birthdayInYear(birth, year) {

  const month = birth.getUTCMonth();
  const day = birth.getUTCDate();

  // February 29 becomes February 28.

  if (
    month === 1 &&
    day === 29 &&
    !isLeapYear(year)
  ) {
    return utcDate(year, 1, 28);
  }

  return utcDate(year, month, day);
}


// Calculate completed years, months and days.

function calculateAge(birth, today) {

  let years =
    today.getUTCFullYear() -
    birth.getUTCFullYear();

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
      Math.min(
        anniversary.getUTCDate(),
        lastDay
      )
    );

    if (next > today) break;

    cursor = next;
    months++;
  }

  const days = Math.floor(
    (today.getTime() - cursor.getTime()) /
    86400000
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

  let next = birthdayInYear(
    birth,
    year
  );

  if (next < today) {

    year++;

    next = birthdayInYear(
      birth,
      year
    );
  }

  const diff = Math.round(
    (
      next.getTime() -
      today.getTime()
    ) / 86400000
  );

  return {
    next,
    diff
  };
}


// Number formatting.

function formatNumber(number) {

  return Number(number).toLocaleString(
    "en-IN"
  );
}


// Date formatting.

function formatDate(date) {

  return date.toLocaleDateString(
    "en-IN",
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    }
  );
}


// ======================================
// 15. UPDATE AGE REPORT
// ======================================

function updateAgeReport() {

  if (!selectedBirthDate) return;

  const today = getTodayUTC();

  const age = calculateAge(
    selectedBirthDate,
    today
  );

  const totalMonths =
    age.years * 12 + age.months;

  // Calculate elapsed time from local midnight.

  const elapsedMs = Math.max(
    0,
    Date.now() -
    new Date(
      selectedBirthDate.getUTCFullYear(),
      selectedBirthDate.getUTCMonth(),
      selectedBirthDate.getUTCDate()
    ).getTime()
  );

  const totalSeconds = Math.floor(
    elapsedMs / 1000
  );

  const totalMinutes = Math.floor(
    totalSeconds / 60
  );

  const totalHours = Math.floor(
    totalMinutes / 60
  );

  // Calendar-based total days.

  const totalDays = Math.floor(
    (
      today.getTime() -
      selectedBirthDate.getTime()
    ) / 86400000
  );

  const totalWeeks = Math.floor(
    totalDays / 7
  );

  setText("years", age.years);

  setText(
    "ageSub",
    `${age.months} months and ${age.days} days`
  );

  setText(
    "totalMonths",
    formatNumber(totalMonths)
  );

  setText(
    "totalWeeks",
    formatNumber(totalWeeks)
  );

  setText(
    "totalDays",
    formatNumber(totalDays)
  );

  setText(
    "totalHours",
    formatNumber(totalHours)
  );

  setText(
    "totalMinutes",
    formatNumber(totalMinutes)
  );

  setText(
    "totalSeconds",
    formatNumber(totalSeconds)
  );

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
    selectedBirthDate.toLocaleDateString(
      "en-US",
      {
        weekday: "long",
        timeZone: "UTC"
      }
    )
  );

  setText(
    "birthDateText",
    formatDate(selectedBirthDate)
  );
}


// ======================================
// 16. RUN AGE CALCULATION
// ======================================

function runAgeCalculation(
  birth,
  saveDate = true
) {

  selectedBirthDate = birth;

  if (ageTimer) {
    clearInterval(ageTimer);
  }

  if (saveDate) {

    const year = birth.getUTCFullYear();

    const month = String(
      birth.getUTCMonth() + 1
    ).padStart(2, "0");

    const day = String(
      birth.getUTCDate()
    ).padStart(2, "0");

    const dobKey = getUserStorageKey(
      STORAGE_KEYS.dob
    );

    if (dobKey) {
      storageSet(
        dobKey,
        `${year}-${month}-${day}`
      );
    }
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

  // Check birthday after calculation.

  checkBirthdayNotification();
}


// ======================================
// 17. PENDING DOB
// ======================================

function processPendingBirthDate() {

  if (
    !currentUser ||
    !pendingBirthDateValue
  ) {
    return;
  }

  const birth = getValidBirthDate(
    pendingBirthDateValue
  );

  if (!birth) {

    pendingBirthDateValue = "";

    showError(
      "calcError",
      "Please select a valid birth date again."
    );

    return;
  }

  pendingBirthDateValue = "";

  runAgeCalculation(birth);
}


// ======================================
// 18. VALIDATE DOB
// ======================================

function getValidBirthDate(value) {

  if (!value) return null;

  const parts = value.split("-");

  if (parts.length !== 3) {
    return null;
  }

  const [
    year,
    month,
    day
  ] = parts.map(Number);

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day)
  ) {
    return null;
  }

  const birth = utcDate(
    year,
    month - 1,
    day
  );

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


// ======================================
// 19. CALCULATE BUTTON
// ======================================

$("calculateBtn")?.addEventListener(
  "click",
  async () => {

    const value = $("dob")?.value || "";

    showError("calcError", "");

    if (!value) {

      showError(
        "calcError",
        "Please select your birth date."
      );

      return;
    }

    const birth = getValidBirthDate(value);

    if (!birth) {

      showError(
        "calcError",
        "Please enter a valid birth date."
      );

      return;
    }

    // Google Login is mandatory for calculation.

    if (!currentUser) {

      pendingBirthDateValue = value;

      showError(
        "calcError",
        "Please sign in with Google to calculate your age."
      );

      await startGoogleLogin();

      return;
    }

    runAgeCalculation(birth);
  }
);


// Maximum DOB = Today.

if ($("dob")) {

  const now = new Date();

  $("dob").max = [
    now.getFullYear(),

    String(
      now.getMonth() + 1
    ).padStart(2, "0"),

    String(
      now.getDate()
    ).padStart(2, "0")

  ].join("-");
}


// ======================================
// 20. NAVIGATION
// ======================================

document.querySelectorAll(
  ".nav-btn[data-page]"
).forEach(button => {

  button.addEventListener(
    "click",
    () => {

      const page = button.dataset.page;

      if (
        page === "profile" &&
        !currentUser
      ) {
        return;
      }

      showSection(page);
    }
  );
});


$("topProfile")?.addEventListener(
  "click",
  () => {

    if (currentUser) {
      showSection("profile");
    }
  }
);


// ======================================
// 21. DARK / LIGHT THEME
// ======================================

function setTheme(theme) {

  const selectedTheme =
    theme === "dark"
      ? "dark"
      : "light";

  document.documentElement.dataset.theme =
    selectedTheme;

  storageSet(
    STORAGE_KEYS.theme,
    selectedTheme
  );

  if ($("themeToggle")) {

    $("themeToggle").textContent =
      selectedTheme === "dark"
        ? "☀"
        : "☾";
  }
}


const savedTheme =
  storageGet(STORAGE_KEYS.theme) ||
  "light";

setTheme(savedTheme);


function toggleTheme() {

  const currentTheme =
    document.documentElement.dataset.theme;

  setTheme(
    currentTheme === "dark"
      ? "light"
      : "dark"
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
// 22. LOGOUT
// ======================================

$("logoutBtn")?.addEventListener(
  "click",
  async () => {

    const confirmed = confirm(
      "Are you sure you want to sign out?"
    );

    if (!confirmed) return;

    try {

      stopAgeTimer();
      stopBirthdayTimer();

      pendingBirthDateValue = "";

      selectedBirthDate = null;

      await signOut(auth);

    } catch (error) {

      console.error(
        "Logout Error:",
        error
      );

      alert(
        "Logout failed. Please try again."
      );
    }
  }
);


// ======================================
// 23. PROFILE PHOTO
// ======================================

const photoInput = $("profilePhotoInput");

const choosePhotoBtn = $("choosePhotoBtn");

const profilePhoto = $("profilePhoto");


choosePhotoBtn?.addEventListener(
  "click",
  () => {

    photoInput?.click();
  }
);


photoInput?.addEventListener(
  "change",
  () => {

    const file = photoInput.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {

      alert(
        "Please select a valid image."
      );

      photoInput.value = "";

      return;
    }

    if (file.size > 5 * 1024 * 1024) {

      alert(
        "Please select an image smaller than 5 MB."
      );

      photoInput.value = "";

      return;
    }

    const reader = new FileReader();

    reader.onload = event => {

      const img = new Image();

      img.onload = () => {

        const canvas =
          document.createElement("canvas");

        const size = 300;

        canvas.width = size;
        canvas.height = size;

        const ctx = canvas.getContext("2d");

        if (!ctx) {

          alert(
            "Unable to process this image."
          );

          return;
        }

        // Center crop.

        const cropSize = Math.min(
          img.width,
          img.height
        );

        const cropX =
          (img.width - cropSize) / 2;

        const cropY =
          (img.height - cropSize) / 2;

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

        const imageData =
          canvas.toDataURL(
            "image/jpeg",
            0.75
          );

        // Save photo for current account only.

        const photoKey = getUserStorageKey(
          STORAGE_KEYS.photo
        );

        if (!photoKey) {

          alert(
            "Please sign in with Google first."
          );

          return;
        }

        const saved = storageSet(
          photoKey,
          imageData
        );

        if (saved) {

          if (profilePhoto) {
            profilePhoto.src = imageData;
          }

          alert(
            "Profile photo saved!"
          );

        } else {

          alert(
            "Storage full. Please choose a smaller image."
          );
        }
      };

      img.onerror = () => {

        alert(
          "Unable to open this image."
        );
      };

      img.src = event.target.result;
    };

    reader.onerror = () => {

      alert(
        "Unable to read this image."
      );
    };

    reader.readAsDataURL(file);
  }
);


// Load saved profile photo.

updateProfilePhoto();


// ======================================
// 24. PWA SERVICE WORKER
// ======================================

let serviceWorkerRegistration = null;

if ("serviceWorker" in navigator) {

  window.addEventListener(
    "load",
    async () => {

      try {

        serviceWorkerRegistration =
          await navigator.serviceWorker.register(
            "./service-worker.js"
          );

        console.log(
          "Ageverse Service Worker registered:",
          serviceWorkerRegistration.scope
        );

      } catch (error) {

        console.error(
          "Service Worker registration failed:",
          error
        );
      }
    }
  );
}


// ======================================
// 25. AUTOMATIC BIRTHDAY NOTIFICATION
// ======================================

// Account-specific notification setting.

function isBirthdayNotificationEnabled() {

  const key = getUserStorageKey(
    STORAGE_KEYS.notification
  );

  return key
    ? storageGet(key) === "enabled"
    : false;
}


// Check whether today is the birthday.

function isTodayBirthday(birth) {

  if (!birth) return false;

  const today = getTodayUTC();

  const birthday = birthdayInYear(
    birth,
    today.getUTCFullYear()
  );

  return (
    birthday.getUTCMonth() ===
      today.getUTCMonth() &&
    birthday.getUTCDate() ===
      today.getUTCDate()
  );
}


// Prevent duplicate notifications.

function getTodayNotificationKey() {

  const now = new Date();

  return [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(2, "0"),
    String(
      now.getDate()
    ).padStart(2, "0")
  ].join("-");
}


// Show birthday notification.

async function showBirthdayNotification() {

  if (!currentUser) return;

  if (!("Notification" in window)) {
    return;
  }

  if (Notification.permission !== "granted") {
    return;
  }

  if (!isBirthdayNotificationEnabled()) {
    return;
  }

  if (!selectedBirthDate) return;

  if (!isTodayBirthday(selectedBirthDate)) {
    return;
  }

  const todayKey =
    getTodayNotificationKey();

  // Account-specific notification history.

  const notificationKey = getUserStorageKey(
    STORAGE_KEYS.lastNotification
  );

  const lastNotification = notificationKey
    ? storageGet(notificationKey)
    : null;

  if (lastNotification === todayKey) {
    return;
  }

  try {

    let registration =
      serviceWorkerRegistration;

    if (!registration) {

      registration =
        await navigator.serviceWorker.ready;
    }

    await registration.showNotification(
      "Happy Birthday! 🎂",
      {
        body:
          "Today is your birthday! Have a wonderful day from Ageverse. 🎉",

        icon: "./icon-192.png",

        badge: "./icon-192.png",

        tag: "ageverse-birthday-" + todayKey,

        renotify: false
      }
    );

    if (notificationKey) {
      storageSet(
        notificationKey,
        todayKey
      );
    }

    setText(
      "birthdayNotifyStatus",
      "Birthday reminder delivered! 🎉"
    );

  } catch (error) {

    console.error(
      "Birthday Notification Error:",
      error
    );
  }
}


// Check birthday notification.

function checkBirthdayNotification() {

  if (
    !currentUser ||
    !selectedBirthDate
  ) {
    return;
  }

  if (!isBirthdayNotificationEnabled()) {
    return;
  }

  showBirthdayNotification();
}


// Start automatic birthday checking.

function startBirthdayChecking() {

  stopBirthdayTimer();

  if (!currentUser) return;

  if (!selectedBirthDate) return;

  checkBirthdayNotification();

  // Check every minute.

  birthdayTimer = setInterval(
    () => {

      if (
        document.visibilityState === "visible"
      ) {

        checkBirthdayNotification();
      }

    },
    60000
  );
}


// Check again when user returns to the page.

document.addEventListener(
  "visibilitychange",
  () => {

    if (
      document.visibilityState === "visible" &&
      currentUser
    ) {

      checkBirthdayNotification();
    }
  }
);


// ======================================
// 26. BIRTHDAY NOTIFICATION SETTINGS
// ======================================

const birthdayNotifyBtn =
  $("birthdayNotifyBtn");

const birthdayNotifyStatus =
  $("birthdayNotifyStatus");


birthdayNotifyBtn?.addEventListener(
  "click",
  async () => {

    if (!currentUser) {

      setText(
        "birthdayNotifyStatus",
        "Please sign in with Google first."
      );

      return;
    }

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

      let permission =
        Notification.permission;

      // Request permission after user interaction.

      if (permission === "default") {

        permission =
          await Notification.requestPermission();
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

      serviceWorkerRegistration =
        await navigator.serviceWorker.ready;

      // Save notification setting for current account.

      const notificationKey = getUserStorageKey(
        STORAGE_KEYS.notification
      );

      if (!notificationKey) {
        return;
      }

      storageSet(
        notificationKey,
        "enabled"
      );

      setText(
        "birthdayNotifyStatus",
        "Automatic birthday reminders enabled! 🎉"
      );

      // Check immediately.

      checkBirthdayNotification();

      // Start automatic checking.

      startBirthdayChecking();

    } catch (error) {

      console.error(
        "Notification Setup Error:",
        error
      );

      setText(
        "birthdayNotifyStatus",
        "Unable to enable notifications. Please check browser settings."
      );
    }
  }
);


// ======================================
// 27. INITIALIZATION
// ======================================

// Restore saved theme and profile photo.

updateProfilePhoto();

// Authentication observer handles login state.

// No unnecessary Firestore loading here.

// Wait for Firebase authentication state.

console.log(
  "Ageverse initialized successfully."
);
