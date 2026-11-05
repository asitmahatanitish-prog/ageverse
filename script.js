import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";

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
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();
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

function setText(id, value) {
  const element = $(id);
  if (element) element.textContent = value;
}

function showError(id, message) {
  setText(id, message);
}

// ======================================
// 3. PAGE NAVIGATION
// ======================================

function showPage(page) {
  ["loginPage", "namePage", "appPage"].forEach(id => {
    $(id)?.classList.add("hidden");
  });

  const pageIds = {
    login: "loginPage",
    name: "namePage",
    app: "appPage"
  };

  $(pageIds[page])?.classList.remove("hidden");
}

function showSection(section) {
  $("homeSection")?.classList.add("hidden");
  $("profileSection")?.classList.add("hidden");

  document.querySelectorAll(".nav-btn[data-page]")
    .forEach(btn => btn.classList.remove("active"));

  if (section === "home") {
    $("homeSection")?.classList.remove("hidden");
    document.querySelector('[data-page="home"]')
      ?.classList.add("active");
  } else {
    $("profileSection")?.classList.remove("hidden");
    document.querySelector('[data-page="profile"]')
      ?.classList.add("active");

    loadProfile();
  }

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// ======================================
// 4. GOOGLE LOGIN
// ======================================

$("googleLogin")?.addEventListener("click", async () => {
  showError("loginError", "");

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Google Login Error:", error);
    showError("loginError", error.message);
  }
});

// ======================================
// 5. AUTHENTICATION STATE
// ======================================

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (!user) {
    currentName = "";
    showPage("login");
    $("loader")?.classList.add("hidden");
    return;
  }

  try {
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
    showError("nameError", error.message);
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
    showError("nameError", "Please enter at least 2 characters.");
    return;
  }

  showError("nameError", "");

  const button = $("saveName");
  button.disabled = true;
  button.textContent = "Saving...";

  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      name,
      email: currentUser.email || "",
      photoURL: currentUser.photoURL || "",
      updatedAt: serverTimestamp()
    }, { merge: true });

    await updateProfile(currentUser, {
      displayName: name
    });

    currentName = name;
    openDashboard();

  } catch (error) {
    console.error(error);
    showError("nameError", error.message);
  } finally {
    button.disabled = false;
    button.innerHTML = 'Continue <span>→</span>';
  }
});

// ======================================
// 7. OPEN DASHBOARD
// ======================================

function openDashboard() {
  showPage("app");

  setText("greeting", "Welcome, " + currentName);
  setText("profileName", currentName);
  setText("profileEmail", currentUser?.email || "");

  if ($("editNameInput")) {
    $("editNameInput").value = currentName;
  }

  setText("topProfile", currentName.charAt(0).toUpperCase());

  let savedPhoto = "";

try {
  savedPhoto = localStorage.getItem("ageVerseProfilePhoto") || "";
} catch (error) {
  console.warn("Photo storage unavailable:", error);
}
  const photo = savedPhoto || currentUser?.photoURL;

  if (photo && $("profilePhoto")) {
    $("profilePhoto").src = photo;
  }

  showSection("home");
}

// ======================================
// 8. PROFILE
// ======================================

async function loadProfile() {
  if (!currentUser) return;

  try {
    const snap = await getDoc(doc(db, "users", currentUser.uid));

    if (snap.exists()) {
      currentName = snap.data().name || currentName;
    }

    setText("profileName", currentName);
    setText("profileEmail", currentUser.email || "");
    setText("greeting", "Welcome, " + currentName);

    if ($("editNameInput")) {
      $("editNameInput").value = currentName;
    }

  } catch (error) {
    showError("profileMessage", error.message);
  }
}

$("updateProfile")?.addEventListener("click", async () => {
  if (!currentUser) return;

  const name = $("editNameInput")?.value.trim() || "";

  if (name.length < 2) {
    showError("profileMessage", "Enter a valid name.");
    return;
  }

  const button = $("updateProfile");
  button.disabled = true;
  showError("profileMessage", "Saving...");

  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      name,
      email: currentUser.email || "",
      updatedAt: serverTimestamp()
    }, { merge: true });

    await updateProfile(currentUser, {
      displayName: name
    });

    currentName = name;

    setText("profileName", name);
    setText("greeting", "Welcome, " + name);
    setText("topProfile", name.charAt(0).toUpperCase());

    showError("profileMessage", "Profile updated successfully!");

  } catch (error) {
    showError("profileMessage", error.message);
  } finally {
    button.disabled = false;
  }
});

// ======================================
// 9. ACCURATE AGE CALCULATOR
// ======================================

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month, day));
}

function getTodayUTC() {
  const now = new Date();

  return utcDate(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

// Returns the birthday date in a particular year.
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

function isLeapYear(year) {
  return year % 4 === 0 &&
    (year % 100 !== 0 || year % 400 === 0);
}

function calculateAge(birth, today) {
  let years = today.getUTCFullYear() -
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
      Math.min(anniversary.getUTCDate(), lastDay)
    );

    if (next > today) break;

    cursor = next;
    months++;
  }

  const days = Math.floor(
    (today - cursor) / 86400000
  );

  return { years, months, days };
}

function getBirthdayInfo(birth, today) {
  let year = today.getUTCFullYear();

  let next = birthdayInYear(birth, year);

  if (next < today) {
    year++;
    next = birthdayInYear(birth, year);
  }

  const diff = Math.round(
    (next - today) / 86400000
  );

  return { next, diff };
}

function formatNumber(number) {
  return Number(number).toLocaleString("en-IN");
}

function formatDate(date) {
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

function updateAgeReport() {
  if (!selectedBirthDate) return;

  const now = new Date();
  const today = getTodayUTC();

  const age = calculateAge(selectedBirthDate, today);
  const totalMonths = age.years * 12 + age.months;

  // Total elapsed time from UTC birth date to current instant.
  const birthTimestamp = selectedBirthDate.getTime();
  const elapsedMs = Math.max(0, now.getTime() - birthTimestamp);

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

  const birthday = getBirthdayInfo(selectedBirthDate, today);

  setText(
    "birthdayCountdown",
    birthday.diff === 0
      ? "Happy Birthday! 🎉"
      : `${birthday.diff} days to go`
  );

  setText("birthdayDate", formatDate(birthday.next));

  setText(
    "birthDay",
    selectedBirthDate.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC"
    })
  );

  setText("birthDateText", formatDate(selectedBirthDate));
}

$("calculateBtn")?.addEventListener("click", () => {
  const value = $("dob")?.value || "";
  showError("calcError", "");

  if (!value) {
    showError("calcError", "Please select your birth date.");
    return;
  }

  const [year, month, day] = value.split("-").map(Number);

  const birth = utcDate(year, month - 1, day);
  const today = getTodayUTC();

  if (
    birth.getUTCFullYear() !== year ||
    birth.getUTCMonth() !== month - 1 ||
    birth.getUTCDate() !== day ||
    birth > today
  ) {
    showError("calcError", "Please enter a valid birth date.");
    return;
  }

  selectedBirthDate = birth;

  if (ageTimer) {
    clearInterval(ageTimer);
  }

  updateAgeReport();

  // Refresh total time every second.
  ageTimer = setInterval(updateAgeReport, 1000);

  $("results")?.classList.remove("hidden");

  $("results")?.scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// Maximum birth date = today
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
  showSection("profile");
});

// ======================================
// 11. DARK / LIGHT THEME
// ======================================

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;

  try {
    localStorage.setItem("ageverse-theme", theme);
  } catch (error) {
    console.warn("Theme could not be saved:", error);
  }

  if ($("themeToggle")) {
    $("themeToggle").textContent =
      theme === "dark" ? "☀" : "☾";
  }
}

let savedTheme = "light";

try {
  savedTheme = localStorage.getItem("ageverse-theme") || "light";
} catch (error) {
  console.warn(error);
}

setTheme(savedTheme);

function toggleTheme() {
  setTheme(
    document.documentElement.dataset.theme === "dark"
      ? "light"
      : "dark"
  );
}

$("themeToggle")?.addEventListener("click", toggleTheme);
$("sideTheme")?.addEventListener("click", toggleTheme);

// ======================================
// 12. LOGOUT
// ======================================

$("logoutBtn")?.addEventListener("click", async () => {
  const confirmed = confirm("Are you sure you want to sign out?");

  if (!confirmed) return;

  try {
    if (ageTimer) clearInterval(ageTimer);
    await signOut(auth);
  } catch (error) {
    alert("Logout failed: " + error.message);
  }
});

// ======================================
// 13. PROFILE PHOTO - LOCAL STORAGE
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
    alert("Please select an image.");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    alert("Please select an image smaller than 5 MB.");
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
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = canvas.toDataURL("image/jpeg", 0.75);

      try {
        localStorage.setItem("ageVerseProfilePhoto", imageData);

        if (profilePhoto) {
          profilePhoto.src = imageData;
        }

        alert("Profile photo saved!");
      } catch (error) {
        alert("Storage full. Please choose a smaller image.");
      }
    };

    img.onerror = () => {
      alert("Unable to open this image.");
    };

    img.src = event.target.result;
  };

  reader.readAsDataURL(file);
});

// Load saved photo
try {
  const savedPhoto = localStorage.getItem("ageVerseProfilePhoto");

  if (savedPhoto && profilePhoto) {
    profilePhoto.src = savedPhoto;
  }
} catch (error) {
  console.warn("Saved photo could not be loaded:", error);
}

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
        console.error("Service Worker registration failed:", error);
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
    birthdayNotifyStatus.textContent =
      "Your browser does not support notifications.";
    return;
  }

  // Permission already blocked
  if (Notification.permission === "denied") {
    birthdayNotifyStatus.textContent =
      "Notifications are blocked. Please open Chrome Settings > Site settings > Notifications and allow notifications for Ageverse.";
    return;
  }

  try {
    let permission = Notification.permission;

    // Ask permission only after user clicks
    if (permission === "default") {
      permission = await Notification.requestPermission();
    }

    if (permission === "granted") {

      birthdayNotifyStatus.textContent =
        "Notifications enabled successfully! 🎉";

      const registration = await navigator.serviceWorker.ready;

      await registration.showNotification("Ageverse", {
        body: "Birthday notifications are enabled!",
        icon: "./icon-192.png",
        badge: "./icon-192.png"
      });

    } else if (permission === "denied") {

      birthdayNotifyStatus.textContent =
        "Please go to Chrome Settings > Site settings > Notifications and enable notifications for Ageverse.";

    }

  } catch (error) {
    console.error("Notification Error:", error);

    birthdayNotifyStatus.textContent =
      "Unable to enable notifications. Please check your browser settings.";
  }
});


