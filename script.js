import { initializeApp } from
  "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";

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

// Firebase Console > Project Settings > General
// থেকে নিজের Web App Configuration বসাও।


  
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

// Initialize Firebase


const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({
  prompt: "select_account"
});

// ======================================
// 2. ELEMENTS
// ======================================

const $ = id => document.getElementById(id);

const loader = $("loader");
const loginPage = $("loginPage");
const namePage = $("namePage");
const appPage = $("appPage");

let currentUser = null;
let currentName = "";

// ======================================
// 3. PAGE NAVIGATION
// ======================================

function showPage(page) {
  loginPage.classList.add("hidden");
  namePage.classList.add("hidden");
  appPage.classList.add("hidden");

  if (page === "login") loginPage.classList.remove("hidden");
  if (page === "name") namePage.classList.remove("hidden");
  if (page === "app") appPage.classList.remove("hidden");
}

function showSection(section) {
  $("homeSection").classList.add("hidden");
  $("profileSection").classList.add("hidden");

  document.querySelectorAll(".nav-btn[data-page]")
    .forEach(btn => btn.classList.remove("active"));

  if (section === "home") {
    $("homeSection").classList.remove("hidden");
    document.querySelector('[data-page="home"]')
      .classList.add("active");
  } else {
    $("profileSection").classList.remove("hidden");
    document.querySelector('[data-page="profile"]')
      .classList.add("active");
    loadProfile();
  }

  window.scrollTo(0, 0);
}

// ======================================
// 4. GOOGLE LOGIN
// ======================================

$("googleLogin").addEventListener("click", async () => {
  $("loginError").textContent = "";

  try {
    await signInWithPopup(auth, googleProvider);
  } catch (error) {
    console.error("Google Login Error:", error);
    $("loginError").textContent = error.message;
  }
});




// ======================================
// 5. AUTHENTICATION STATE
// ======================================

onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (!user) {
    showPage("login");
    loader.classList.add("hidden");
    return;
  }

  try {
    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists() && userSnap.data().name) {
      currentName = userSnap.data().name;
      openDashboard();
    } else {
      $("setupName").value = user.displayName || "";
      showPage("name");
    }

  } catch (error) {
    console.error(error);
    alert("Firebase Error: " + error.code + " - " + error.message);
    showPage("name");
  }

  loader.classList.add("hidden");
});

// ======================================
// 6. SAVE USER NAME
// ======================================

$("saveName").addEventListener("click", async () => {
  if (!currentUser) return;

  const name = $("setupName").value.trim();

  if (name.length < 2) {
    $("nameError").textContent =
      "Please enter at least 2 characters.";
    return;
  }

  $("nameError").textContent = "";
  $("saveName").disabled = true;
  $("saveName").textContent = "Saving...";

  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      name: name,
      email: currentUser.email,
      photoURL: currentUser.photoURL || "",
      createdAt: serverTimestamp()
    }, { merge: true });

    await updateProfile(currentUser, {
      displayName: name
    });

    currentName = name;
    openDashboard();

  } catch (error) {
    $("nameError").textContent = error.message;
  } finally {
    $("saveName").disabled = false;
    $("saveName").innerHTML = 'Continue <span>→</span>';
  }
});

// ======================================
// 7. OPEN DASHBOARD
// ======================================

function openDashboard() {
  showPage("app");

  $("greeting").textContent = "Welcome, " + currentName;
  

  $("profileName").textContent = currentName;
  $("profileEmail").textContent = currentUser.email || "";
  $("editNameInput").value = currentName;

  const photo = currentUser.photoURL;
  if (photo) $("profilePhoto").src = photo;

  $("topProfile").textContent =
    currentName.charAt(0).toUpperCase();

  showSection("home");
}

// ======================================
// 8. PROFILE
// ======================================

async function loadProfile() {
  if (!currentUser) return;

  try {
    const snap = await getDoc(
      doc(db, "users", currentUser.uid)
    );

    if (snap.exists()) {
      currentName = snap.data().name || currentName;
    }

    $("profileName").textContent = currentName;
    $("profileEmail").textContent = currentUser.email || "";
    $("editNameInput").value = currentName;

  } catch (error) {
    $("profileMessage").textContent = error.message;
  }
}

$("updateProfile").addEventListener("click", async () => {
  if (!currentUser) return;

  const name = $("editNameInput").value.trim();

  if (name.length < 2) {
    $("profileMessage").textContent =
      "Enter a valid name.";
    return;
  }

  $("profileMessage").textContent = "Saving...";

  try {
    await setDoc(doc(db, "users", currentUser.uid), {
      name: name,
      email: currentUser.email,
      photoURL: currentUser.photoURL || "",
      updatedAt: serverTimestamp()
    }, { merge: true });

    await updateProfile(currentUser, {
      displayName: name
    });

    currentName = name;
    $("profileName").textContent = name;
    $("greeting").textContent = "Welcome, " + name;
    $("homeName").textContent = name;
    $("topProfile").textContent =
      name.charAt(0).toUpperCase();

    $("profileMessage").textContent =
      "Profile updated successfully!";

  } catch (error) {
    $("profileMessage").textContent = error.message;
  }
});

// ======================================
// 9. AGE CALCULATOR
// ======================================

function utcDate(year, month, day) {
  return new Date(Date.UTC(year, month, day));
}

function calculateAge(birth, today) {
  let years = today.getUTCFullYear() -
              birth.getUTCFullYear();

  let months = today.getUTCMonth() -
               birth.getUTCMonth();

  let days = today.getUTCDate() -
             birth.getUTCDate();

  if (days < 0) {
    months--;

    const previousMonthDays = utcDate(
      today.getUTCFullYear(),
      today.getUTCMonth(),
      0
    ).getUTCDate();

    days += previousMonthDays;
  }

  if (months < 0) {
    years--;
    months += 12;
  }

  return { years, months, days };
}

function getBirthdayInfo(birth, today) {
  let year = today.getUTCFullYear();

  let next = utcDate(
    year,
    birth.getUTCMonth(),
    birth.getUTCDate()
  );

  if (next < today) {
    year++;
    next = utcDate(
      year,
      birth.getUTCMonth(),
      birth.getUTCDate()
    );
  }

  const diff = Math.round(
    (next - today) / 86400000
  );

  return { next, diff };
}

$("calculateBtn").addEventListener("click", () => {
  const value = $("dob").value;
  const error = $("calcError");

  error.textContent = "";

  if (!value) {
    error.textContent = "Please select your birth date.";
    return;
  }

  const [y, m, d] = value.split("-").map(Number);

  const birth = utcDate(y, m - 1, d);
  const today = utcDate(
    new Date().getFullYear(),
    new Date().getMonth(),
    new Date().getDate()
  );

  if (
    birth.getUTCFullYear() !== y ||
    birth.getUTCMonth() !== m - 1 ||
    birth.getUTCDate() !== d ||
    birth > today
  ) {
    error.textContent = "Please enter a valid past date.";
    return;
  }

  const age = calculateAge(birth, today);

  const totalDays = Math.round(
    (today - birth) / 86400000
  );

  const totalSeconds = totalDays * 86400;
  const totalMonths = age.years * 12 + age.months;

  $("years").textContent = age.years;
  $("ageSub").textContent =
    `${age.months} months and ${age.days} days`;

  $("totalMonths").textContent =
    totalMonths.toLocaleString();

  $("totalWeeks").textContent =
    Math.floor(totalDays / 7).toLocaleString();

  $("totalDays").textContent =
    totalDays.toLocaleString();

  $("totalHours").textContent =
    (totalDays * 24).toLocaleString();

  $("totalMinutes").textContent =
    (totalDays * 1440).toLocaleString();

  $("totalSeconds").textContent =
    totalSeconds.toLocaleString();

  const birthday = getBirthdayInfo(birth, today);

  $("birthdayCountdown").textContent =
    birthday.diff === 0
      ? "Happy Birthday! 🎉"
      : birthday.diff + " days to go";

  $("birthdayDate").textContent =
    birthday.next.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    });

  $("birthDay").textContent =
    birth.toLocaleDateString("en-US", {
      weekday: "long",
      timeZone: "UTC"
    });

  $("birthDateText").textContent =
    birth.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    });

  $("results").classList.remove("hidden");
  $("results").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
});

// Set maximum DOB to today
const now = new Date();
$("dob").max = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0")
].join("-");

// ======================================
// 10. NAVIGATION
// ======================================

document.querySelectorAll(".nav-btn[data-page]")
  .forEach(button => {
    button.addEventListener("click", () => {
      showSection(button.dataset.page);
    });
  });

$("topProfile").addEventListener("click", () => {
  showSection("profile");
});

// ======================================
// 11. DARK / LIGHT THEME
// ======================================

function setTheme(theme) {
  document.documentElement.dataset.theme = theme;
  localStorage.setItem("ageverse-theme", theme);

  $("themeToggle").textContent =
    theme === "dark" ? "☀" : "☾";
}

const savedTheme = localStorage.getItem("ageverse-theme") || "light";
setTheme(savedTheme);

$("themeToggle").addEventListener("click", () => {
  setTheme(
    document.documentElement.dataset.theme === "dark"
      ? "light"
      : "dark"
  );
});

$("sideTheme").addEventListener("click", () => {
  setTheme(
    document.documentElement.dataset.theme === "dark"
      ? "light"
      : "dark"
  );
});

// ======================================
// 12. LOGOUT
// ======================================

$("logoutBtn").addEventListener("click", async () => {
  const confirmed = confirm("Are you sure you want to sign out?");

  if (!confirmed) return;

  try {
    await signOut(auth);
  } catch (error) {
    alert("Logout failed: " + error.message);
  }
});
// PROFILE PHOTO - LOCAL STORAGE

const photoInput = document.getElementById("profilePhotoInput");
const choosePhotoBtn = document.getElementById("choosePhotoBtn");
const profilePhoto = document.getElementById("profilePhoto");

choosePhotoBtn.addEventListener("click", () => {
  photoInput.click();
});

photoInput.addEventListener("change", () => {
  const file = photoInput.files[0];

  if (!file) return;

  if (!file.type.startsWith("image/")) {
    alert("Please select an image.");
    return;
  }

  const reader = new FileReader();

  reader.onload = function (event) {
    const img = new Image();

    img.onload = function () {
      const canvas = document.createElement("canvas");
      const size = 300;

      canvas.width = size;
      canvas.height = size;

      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, size, size);

      const imageData = canvas.toDataURL("image/jpeg", 0.75);

      try {
        localStorage.setItem("ageVerseProfilePhoto", imageData);
        profilePhoto.src = imageData;
        alert("Profile photo saved!");
      } catch (error) {
        alert("Storage full. Please choose a smaller image.");
      }
    };

    img.src = event.target.result;
  };

  reader.readAsDataURL(file);
});

// Load saved photo
const savedPhoto = localStorage.getItem("ageVerseProfilePhoto");

if (savedPhoto) {
  profilePhoto.src = savedPhoto;
}
/* Ageverse PWA Service Worker Registration */

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
