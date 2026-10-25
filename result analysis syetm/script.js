// ---------------- FIREBASE IMPORTS ----------------
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import {
  getAuth, onAuthStateChanged, signOut,
  signInWithEmailAndPassword, createUserWithEmailAndPassword
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

// ---------------- GLOBAL VARIABLES ----------------
let db, auth, userId, userRole;
let isPageSetupDone = false;
let uploadedResultData = [];

// ---------------- FIREBASE CONFIG ----------------
const firebaseConfig = {
  apiKey: "AIzaSyBrpL2O1mMs8uZdOkBPB7UQAaoeWHpNNBc",
  authDomain: "svpcet-system.firebaseapp.com",
  projectId: "svpcet-system",
  storageBucket: "svpcet-system.firebasestorage.app",
  messagingSenderId: "610685576991",
  appId: "1:610685576991:web:a59f950060b66fb75d722a",
  measurementId: "G-8JLJGPN02J"
};

// ---------------- HELPER: Display message ----------------
const displayMessage = (message, type = 'error') => {
  const msg = document.createElement('div');
  msg.className = `custom-message ${type}`;
  msg.textContent = message;
  msg.style.position = 'fixed';
  msg.style.top = '16px';
  msg.style.right = '16px';
  msg.style.padding = '10px 14px';
  msg.style.borderRadius = '6px';
  msg.style.zIndex = 9999;
  msg.style.boxShadow = '0 4px 10px rgba(0,0,0,0.15)';
  msg.style.color = 'white';
  msg.style.background = type === 'success' ? '#10b981'
                    : type === 'warning' ? '#f59e0b'
                    : '#ef4444';
  document.body.appendChild(msg);
  setTimeout(() => msg.remove(), 2200);
};

// ---------------- INIT FIREBASE ----------------
async function initFirebase() {
  const app = initializeApp(firebaseConfig);
  db = getFirestore(app);
  auth = getAuth(app);
  console.log("Firebase initialized.");
}

// ---------------- LOGOUT ----------------
function handleLogout() {
  signOut(auth).then(() => window.location.href = "index.html");
}
function goToStudent() {
    window.location.href = "student.html";
}
window.checkScholarshipHybrid = async function() {
  const textInput = document.getElementById("inputText");
  const resultText = document.getElementById("result");
  const btnText = document.getElementById("btnText");
  const loadingSpinner = document.getElementById("loadingSpinner");
  const checkBtn = document.getElementById("checkBtn");

  if (!textInput || !textInput.value.trim()) {
    resultText.innerText = "Please enter some text to verify.";
    resultText.style.color = "orange";
    return;
  }

  const text = textInput.value.trim().toLowerCase();

  // Show loading
  if (btnText) btnText.innerText = "Checking...";
  if (loadingSpinner) loadingSpinner.style.display = "inline-block";
  if (checkBtn) checkBtn.disabled = true;
  resultText.innerText = "";

  try {
    // 1. RULE BASED DETECTION
    const hasBitly = text.includes("bit.ly");
    const hasXyz = text.includes(".xyz");
    const hasNet = text.includes(".net");
    const hasClaim = text.includes("claim");
    const hasFreeLink = text.includes("free") && text.includes("http");
    const hasUrgentLink = text.includes("urgent") && (text.includes("http") || text.includes("www"));

    if (hasBitly || hasXyz || hasNet || hasClaim || hasFreeLink || hasUrgentLink) {
      resultText.innerText = "Fake Scholarship ⚠️ (Detected by Rules)";
      resultText.style.color = "red";
      return;
    }

    // 2. ML BASED DETECTION (If rules pass)
    const response = await fetch("http://127.0.0.1:5000/predict", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ text: textInput.value.trim() })
    });

    const data = await response.json();

    if (data.error) {
      resultText.innerText = "Error: " + data.error;
      resultText.style.color = "red";
      return;
    }

    let resultMessage = "";
    if (data.prediction === 1) {
      resultMessage = "Fake Scholarship ⚠️";
      resultText.style.color = "red";
    } else {
      resultMessage = "Real Scholarship ✅";
      resultText.style.color = "green";
    }

    if (data.confidence !== undefined && data.confidence !== null) {
      resultMessage += `\nConfidence: ${data.confidence}%`;
      resultMessage += `\nReal Probability: ${data.real_probability}% | Fake Probability: ${data.fake_probability}%`;
    }

    if (data.keywords && data.keywords.length > 0) {
      resultMessage += `\nKeywords: ${data.keywords.join(", ")}`;
    }

    if (data.flags && data.flags.length > 0) {
      resultMessage += `\nFlags: ${data.flags.join(", ")}`;
    }

    if (data.urls_found && data.urls_found.length > 0) {
      resultMessage += `\nURLs Found: ${data.urls_found.length}`;
      if (data.suspicious_urls && data.suspicious_urls.length > 0) {
        resultMessage += `\nSuspicious URLs: ${data.suspicious_urls.join(", ")}`;
      }
    }

    resultText.innerText = resultMessage;

  } catch (err) {
    resultText.innerText = "Server error or CORS issue. Ensure Flask is running at http://127.0.0.1:5000.";
    resultText.style.color = "red";
    console.error(err);
  } finally {
    // Hide loading
    if (btnText) btnText.innerText = "🔍 Check Scholarship";
    if (loadingSpinner) loadingSpinner.style.display = "none";
    if (checkBtn) checkBtn.disabled = false;
  }
}
// ---------------- PAGE SETUP BY ROLE ----------------
function handleAuthAndPageSetup() {
  if (isPageSetupDone) return;
  isPageSetupDone = true;
  const page = window.location.pathname.split("/").pop();

  if (userRole === 'teacher' || userRole === 'admin') {
    if (page === 'teacher-upload.html') setupTeacherUploadPage();
    if (page === 'teacher-analysis-report.html' || page === 'teacher-dashboard.html')
      loadTeacherDashboardData();
  }
  if (userRole === 'student' && page === 'student-dashboard.html')
    renderStudentDashboard();
}

// ---------------- LOGIN HANDLERS ----------------
function setupTeacherLoginPage() {
  const form = document.getElementById("teacher-login-form");
  if (form) {
    form.addEventListener('submit', async e => {
      e.preventDefault();

      const email = document.getElementById("teacher-username").value.trim();
      const pass = document.getElementById("teacher-password").value.trim();

      try {
        await signInWithEmailAndPassword(auth, email, pass);
        displayMessage("Signed in successfully — redirecting...", "success");
        setTimeout(() => window.location.href = "teacher-upload.html", 700);
      } catch (err) {
        console.error("Login error:", err);
        displayMessage("Access denied. Invalid admin credentials.", "error");
      }
    });
  }
}

  // ---------------- DEMO STUDENT LOGIN (No Firebase) ----------------
const sForm = document.getElementById("student-login-form");
if (sForm) {
  sForm.addEventListener('submit', e => {
    e.preventDefault();

    const email = document.getElementById("student-username").value.trim();
    const pass = document.getElementById("student-password").value.trim();

    // Demo credentials (you can customize)
    const demoEmail = "student@demo.com";
    const demoPass = "student123";

    if (email === demoEmail && pass === demoPass) {
      displayMessage("Demo student login successful!", "success");
      localStorage.setItem("studentDemoLogin", "true"); // optional, to remember login
      setTimeout(() => window.location.href = "student-dashboard.html", 700);
    } else {
      displayMessage("Invalid demo credentials.", "error");
    }
  });
}


/// ---------------- UPLOAD PAGE ----------------
function setupTeacherUploadPage() {
  const form = document.getElementById('upload-form');
  const fileInput = document.getElementById('fileElem');
  const dropArea = document.getElementById('drop-area');
  const status = document.getElementById('file-name-display') || document.querySelector('.file-name-display');
  if (!form || !fileInput || !dropArea) return;

  // ---- Prevent page reload no matter what ----
  form.addEventListener("submit", e => e.preventDefault());

  // ---- Drag & drop ----
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(ev =>
    dropArea.addEventListener(ev, e => { e.preventDefault(); e.stopPropagation(); })
  );
  ['dragenter', 'dragover'].forEach(ev =>
    dropArea.addEventListener(ev, () => dropArea.classList.add('highlight'))
  );
  ['dragleave', 'drop'].forEach(ev =>
    dropArea.addEventListener(ev, () => dropArea.classList.remove('highlight'))
  );

  dropArea.addEventListener('drop', e => handleFiles(e.dataTransfer.files));
  fileInput.addEventListener('change', e => handleFiles(e.target.files));

  function handleFiles(files) {
    if (!files.length) return;
    const file = files[0];
    if (!file.name.endsWith('.csv')) {
      displayMessage("Please upload a CSV file.", "error");
      return;
    }
    if (!window.Papa) {
      displayMessage("PapaParse not loaded.", "error");
      return;
    }
    Papa.parse(file, {
  skipEmptyLines: true,
  complete: res => {
    // 🔍 Find the row that looks like the header (contains "UID" and "Total Marks")
    let headerRowIndex = res.data.findIndex(row =>
      Array.isArray(row) &&
      row.some(cell => typeof cell === "string" && cell.toLowerCase().includes("uid")) &&
      row.some(cell => typeof cell === "string" && cell.toLowerCase().includes("total"))
    );

    if (headerRowIndex === -1) {
      displayMessage("Could not detect header row in CSV.", "error");
      console.error("Header not found:", res.data.slice(0, 10));
      return;
    }

    // Extract headers and convert subsequent rows into objects
    const headers = res.data[headerRowIndex].map(h => h.trim());
    const rows = res.data.slice(headerRowIndex + 1);
    uploadedResultData = rows
      .map(r => {
        const obj = {};
        headers.forEach((h, i) => (obj[h] = r[i]));
        return obj;
      })
      .filter(r => Object.keys(r).length > 0 && r.UID);

    if (!uploadedResultData.length) {
      displayMessage("No student records found.", "error");
      console.log("CSV parse result (empty):", res.data.slice(0, 20));
      return;
    }

    displayMessage(`Loaded ${uploadedResultData.length} student records.`, "success");
    if (status)
      status.textContent = `File Ready: ${file.name} (${uploadedResultData.length} rows)`;

    console.log("✅ CSV parsed properly:", uploadedResultData.slice(0, 3));
  },
  error: err => displayMessage("Parse error: " + err.message, "error")
});
  }

  // ---- Upload button handler ----
  const uploadBtn = document.getElementById('upload-btn');
  if (uploadBtn) {
    uploadBtn.addEventListener('click', async () => {
      if (!uploadedResultData.length) {
        displayMessage("No CSV loaded.", "warning");
        return;
      }
      if (!userId) {
        displayMessage("User not signed in.", "error");
        return;
      }
      try {
        // --- CLEAN DATA before uploading ---
const cleanData = uploadedResultData.map(row => {
  const cleaned = {};
  for (const key in row) {
    if (key && key.trim() !== "") {
      let value = row[key];
      if (value === undefined || value === null) value = "";
      cleaned[key.trim()] = value;
    }
  }
  return cleaned;
});

if (!userId) {
  alert("User not logged in!");
  return;
}

if (!cleanData || cleanData.length === 0) {
  alert("No data to upload!");
  return;
}console.log("User ID:", userId);
console.log("Clean Data:", cleanData);

await setDoc(doc(db, "teacher_results", userId), {
  data: cleanData,
  uploadedAt: serverTimestamp(),
  fileName: fileInput.files[0]?.name || "results.csv"
});

console.log("Data successfully uploaded!");
alert("CSV uploaded successfully!");

        displayMessage("Upload successful! Redirecting...", "success");
console.log("Redirecting now to teacher-analysis-report.html");
setTimeout(() => {
  console.log("Redirect triggered!");
  window.location.href = "teacher-analysis-report.html";
}, 1000);

      } catch (err) {
        displayMessage("Upload failed: " + err.message, "error");
      }
    });
  }

  console.log("Teacher upload page ready.");
}


// ---------------- LOAD DASHBOARD / REPORT ----------------
async function loadTeacherDashboardData() {
  const page = window.location.pathname.split("/").pop();
  const container = document.querySelector('.dashboard-container');
  try {
    const docSnap = await getDoc(doc(db, "teacher_results", userId));
    if (!docSnap.exists()) {
      container.innerHTML = `<p>No data found. Upload a CSV first.</p>`;
      return;
    }
    const data = docSnap.data().data || [];
    if (page === 'teacher-analysis-report.html') setupIndividualReportLookup(data);
    else renderTeacherDashboard(data);
  } catch (err) {
    container.innerHTML = `<p class="text-red">Error: ${err.message}</p>`;
  }
}

// ---------------- TEACHER DASHBOARD (Modern Design + Charts + Top 5) ----------------
function renderTeacherDashboard(data) {
  console.log("Rendering teacher dashboard with TR data:", data);
  if (data.length > 0) {
    console.log("Sample Data Row for debugging:", data[0]);
  }

  // --- Helper 1: Dynamically find value matching keywords ---
  const findValueDynamic = (obj, keywords) => {
    // 1. Exact or strict alphanumeric match
    for (const k in obj) {
      const cleanK = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      for (const kw of keywords) {
        if (cleanK === kw) return obj[k];
      }
    }
    // 2. Substring match
    for (const k in obj) {
      const cleanK = k.toLowerCase();
      for (const kw of keywords) {
        if (cleanK.includes(kw)) return obj[k];
      }
    }
    return undefined;
  };

  // --- Helper 2: Safely extract number and maximum from string ---
  const extractMarks = (val1, val2) => {
    let obtained = 0;
    let max = null; 
    
    // Process obtained marks (val1)
    if (val1 !== null && val1 !== undefined) {
      const str = String(val1).trim();
      if (str.includes('/')) {
         const parts = str.split('/');
         const o = parseFloat(parts[0].replace(/[^\d.-]/g, ""));
         const m = parseFloat(parts[1].replace(/[^\d.-]/g, ""));
         if (!isNaN(o)) obtained = o;
         if (!isNaN(m) && m > 0) max = m;
      } else {
         const o = parseFloat(str.replace(/[^\d.-]/g, ""));
         if (!isNaN(o)) obtained = o;
      }
    }
    
    // Process explicit max marks (val2) if present
    if (val2 !== null && val2 !== undefined) {
      const m2 = parseFloat(String(val2).replace(/[^\d.-]/g, ""));
      if (!isNaN(m2) && m2 > 0) max = m2;
    }

    if (max === null || max === 0) max = 600; // Final fallback

    return { obtained, max };
  };

  // Generic fast numeric parser
  const toPureNum = (v) => {
    if (!v) return 0;
    const n = parseFloat(String(v).replace(/[^\d.-]/g, ""));
    return isNaN(n) ? 0 : n;
  };

  const totalStudents = data.length;

  const passStudents = data.filter(s => {
    const res = String(findValueDynamic(s, ["result", "status", "grade"]) || "").toLowerCase();
    if (res.includes("pass")) return true;
    if (res.includes("fail")) return false;

    // fallback computation
    const rawTotal = findValueDynamic(s, ["totalmarks", "total", "marksobtained", "grandtotal"]);
    const rawMax = findValueDynamic(s, ["maxmarks", "max", "maximum", "outof"]);
    const { obtained, max } = extractMarks(rawTotal, rawMax);
    return (obtained / max) * 100 >= 35;
  });

  const passCount = passStudents.length;
  const failCount = totalStudents - passCount;
  const passRate = totalStudents > 0 ? ((passCount / totalStudents) * 100).toFixed(1) : 0;

  // --- Division Logic ---
  let firstDiv = 0, secondDiv = 0, thirdDiv = 0, failDiv = 0;
  
  data.forEach((s, index) => {
    const rawTotal = findValueDynamic(s, ["totalmarks", "total", "marksobtained", "grandtotal"]);
    const rawMax = findValueDynamic(s, ["maxmarks", "max", "maximum", "outof"]);
    
    const { obtained, max } = extractMarks(rawTotal, rawMax);
    const percentage = (max > 0) ? (obtained / max) * 100 : 0;
    
    if (index === 0) {
      console.log(`[Debug Calc 1st row] - Obtained: ${obtained}, Max: ${max}, Percentage: ${percentage.toFixed(2)}%`);
    }

    if (percentage >= 60) firstDiv++;
    else if (percentage >= 50) secondDiv++;
    else if (percentage >= 40) thirdDiv++;
    else failDiv++;
  });

  // Assign Division Calculations to DOM elements
  const d1 = document.getElementById("div-1st");
  if (d1) d1.textContent = firstDiv;
  const d2 = document.getElementById("div-2nd");
  if (d2) d2.textContent = secondDiv;
  const d3 = document.getElementById("div-3rd");
  if (d3) d3.textContent = thirdDiv;
  const df = document.getElementById("div-fail");
  if (df) df.textContent = failDiv;

  // --- Average SGPA of class ---
  const avgSGPA = totalStudents > 0 ? (
    data.reduce((acc, s) => acc + toPureNum(findValueDynamic(s, ["sghpa", "sgpa", "spi"])), 0) / totalStudents
  ).toFixed(2) : "0.00";

  // --- Update dashboard summary cards ---
  const totalCountEl = document.getElementById("total-count");
  if (totalCountEl) totalCountEl.textContent = totalStudents;
  const passCountEl = document.getElementById("pass-count");
  if (passCountEl) passCountEl.textContent = passCount;
  const failCountEl = document.getElementById("fail-count");
  if (failCountEl) failCountEl.textContent = failCount;
  const passRateEl = document.getElementById("pass-rate");
  if (passRateEl) passRateEl.textContent = `${passRate}%`;
  const avgSgpaEl = document.getElementById("avg-sgpa");
  if (avgSgpaEl) avgSgpaEl.textContent = avgSGPA;

  // --- Top 5 Toppers ---
  const toppers = [...data]
  .map(s => {
    const roll = findValueDynamic(s, ["rollno", "roll", "seatno"]) || "—";
    const uid = findValueDynamic(s, ["uid", "prn", "id", "enrollment"]) || "—";
    const name = findValueDynamic(s, ["name", "studentname", "nameofstudent", "nameofexaminee"]) || "—";
    
    const rawTotal = findValueDynamic(s, ["totalmarks", "total", "marksobtained", "grandtotal"]);
    const rawMax = findValueDynamic(s, ["maxmarks", "max", "maximum", "outof"]);
    const { obtained, max } = extractMarks(rawTotal, rawMax);
    
    const sgpa = toPureNum(findValueDynamic(s, ["sgpa", "spi"]));
    const cgpa = toPureNum(findValueDynamic(s, ["cgpa", "cpi"]));

    return { roll, uid, name, obtained, sgpa, cgpa };
  })
  .sort((a, b) => b.obtained - a.obtained)
  .slice(0, 5);

  const toppersTable = document.getElementById("topper-table-body");
  if (toppersTable) {
    if (toppers.length === 0) {
      toppersTable.innerHTML = `<tr><td colspan="6" class="py-4 text-gray-400">No data found</td></tr>`;
    } else {
      toppersTable.innerHTML = toppers.map(t => `
        <tr class="hover:bg-gray-100 border-b">
          <td>${t.roll}</td>
          <td>${t.uid}</td>
          <td>${t.name}</td>
          <td>${t.obtained}</td>
          <td>${t.sgpa}</td>
          <td>${t.cgpa}</td>
        </tr>
      `).join("");
    }
  }

  // --- Charts setup ---
  const ctx1 = document.getElementById("performanceChart");
  const ctx2 = document.getElementById("gradePie");
  const ctx3 = document.getElementById("divisionPie");

  if (window.performanceChart && typeof window.performanceChart.destroy === "function") window.performanceChart.destroy();
  if (window.gradePie && typeof window.gradePie.destroy === "function") window.gradePie.destroy();
  if (window.divisionPieInstance && typeof window.divisionPieInstance.destroy === "function") window.divisionPieInstance.destroy();

  // Bar chart: Pass vs Fail
  if (ctx1) {
    window.performanceChart = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: ["Pass", "Fail"],
        datasets: [{
          label: "Students",
          data: [passCount, failCount],
          backgroundColor: ["#10b981", "#ef4444"],
          borderRadius: 8
        }]
      },
      options: {
        plugins: {
          title: { display: true, text: "Pass vs Fail", font: { size: 18 } },
          legend: { display: false }
        },
        scales: { y: { beginAtZero: true } }
      }
    });
  }

  // Pie chart: SGPA Distribution
  const s1 = data.filter(s => toPureNum(findValueDynamic(s, ["sgpa"])) >= 9).length;
  const s2 = data.filter(s => toPureNum(findValueDynamic(s, ["sgpa"])) >= 8 && toPureNum(findValueDynamic(s, ["sgpa"])) < 9).length;
  const s3 = data.filter(s => toPureNum(findValueDynamic(s, ["sgpa"])) >= 7 && toPureNum(findValueDynamic(s, ["sgpa"])) < 8).length;
  const s4 = totalStudents - (s1 + s2 + s3);

  if (ctx2) {
    window.gradePie = new Chart(ctx2, {
      type: "doughnut",
      data: {
        labels: ["≥9 SGPA", "8–9 SGPA", "7–8 SGPA", "<7 SGPA"],
        datasets: [{
          data: [s1, s2, s3, s4],
          backgroundColor: ["#22c55e", "#3b82f6", "#facc15", "#ef4444"]
        }]
      },
      options: {
        plugins: {
          title: { display: true, text: "SGPA Distribution", font: { size: 18 } },
          legend: { position: "bottom" }
        }
      }
    });
  }

  // Doughnut chart: Division Distribution
  if (ctx3) {
    window.divisionPieInstance = new Chart(ctx3, {
      type: "doughnut",
      data: {
        labels: ["First Division", "Second Division", "Third Division", "Fail"],
        datasets: [{
          data: [firstDiv, secondDiv, thirdDiv, failDiv],
          backgroundColor: ["#22c55e", "#3b82f6", "#eab308", "#ef4444"]
        }]
      },
      options: {
        plugins: {
          title: { display: true, text: "Division Distribution", font: { size: 18 } },
          legend: { position: "bottom" }
        }
      }
    });
  }

  console.log(`✅ Dashboard updated: Passes=${passCount}, Fails=${failCount}`);
  console.log(`✅ Division distribution: 1st=${firstDiv}, 2nd=${secondDiv}, 3rd=${thirdDiv}, Fail=${failDiv}`);
}


function setupIndividualReportLookup(data) {
  const btn = document.getElementById('lookup-btn-report');
  const inp = document.getElementById('student-uid-input');
  const out = document.getElementById('lookup-result-report');
  if (!btn || !inp || !out) return;
  btn.addEventListener('click', () => {
    const roll = inp.value.trim();
    const s = data.find(d => d.UID === roll || d['Roll No.'] === roll);
    if (!s) { out.innerHTML = `<p>No student found for ${roll}</p>`; return; }
    let html = `<h4>${s.Name || 'Student'} (${roll})</h4><ul>`;
    for (const k in s) html += `<li><b>${k}:</b> ${s[k]}</li>`;
    html += `</ul>`;
    out.innerHTML = html;
  });
}

// ---------------- STUDENT DASHBOARD ----------------
async function renderStudentDashboard() {
  const cont = document.querySelector(".dashboard-container");
  if (!cont) return;

  cont.innerHTML = `
    <div class="student-dashboard">
      <div class="header">
        <h2>🎓 Smart Result Analysis</h2>
        <p>Enter your Roll No / UID to view your detailed performance</p>
      </div>

      <div class="input-area">
        <input type="text" id="student-lookup-input" placeholder="Enter UID / Roll No" class="input-style"/>
        <button id="student-lookup-btn" class="btn-primary">Show Result</button>
      </div>

      <div id="student-result-display" class="result-display hidden">
        <div class="result-card">
          <h3 id="student-name"></h3>
          <p><b>UID:</b> <span id="student-uid"></span></p>
          <p><b>Total Marks:</b> <span id="student-total"></span></p>
          <p><b>Percentage:</b> <span id="student-percentage"></span>%</p>
          <p><b>Status:</b> <span id="student-status"></span></p>
        </div>

        <div class="chart-container">
          <canvas id="marksBarChart"></canvas>
        </div>
        <div class="chart-container">
          <canvas id="gradePieChart"></canvas>
        </div>
      </div>
    </div>
  `;

  const sampleResults = [
    { UID: "1001", Name: "Aarav Sharma", Total: 450, OutOf: 600, Subjects: { DS: 75, Math: 85, DBMS: 88, OS: 70, COA: 60, Java: 72 } },
    { UID: "1002", Name: "Riya Patel", Total: 380, OutOf: 600, Subjects: { DS: 68, Math: 60, DBMS: 75, OS: 55, COA: 65, Java: 57 } },
    { UID: "1003", Name: "Ishaan Mehta", Total: 295, OutOf: 600, Subjects: { DS: 40, Math: 50, DBMS: 45, OS: 55, COA: 55, Java: 50 } },
    { UID: "1004", Name: "Ananya Singh", Total: 520, OutOf: 600, Subjects: { DS: 90, Math: 85, DBMS: 88, OS: 80, COA: 90, Java: 87 } },
    { UID: "1005", Name: "Vivaan Joshi", Total: 270, OutOf: 600, Subjects: { DS: 40, Math: 35, DBMS: 45, OS: 40, COA: 50, Java: 60 } }
  ];

  const btn = document.getElementById("student-lookup-btn");
  const input = document.getElementById("student-lookup-input");
  const resultDisplay = document.getElementById("student-result-display");

  btn.addEventListener("click", () => {
    const uid = input.value.trim();
    const student = sampleResults.find(s => s.UID === uid);
    if (!student) {
      displayMessage("No record found for UID: " + uid, "error");
      return;
    }

    const percentage = ((student.Total / student.OutOf) * 100).toFixed(2);
    const status = percentage >= 35 ? "PASS ✅" : "FAIL ❌";
    const statusColor = percentage >= 35 ? "green" : "red";

    // Update Result Info
    document.getElementById("student-name").textContent = student.Name;
    document.getElementById("student-uid").textContent = student.UID;
    document.getElementById("student-total").textContent = `${student.Total} / ${student.OutOf}`;
    document.getElementById("student-percentage").textContent = percentage;
    const statusEl = document.getElementById("student-status");
    statusEl.textContent = status;
    statusEl.style.color = statusColor;
    resultDisplay.classList.remove("hidden");

    // Destroy old charts if they exist
    if (window.barChartInstance) window.barChartInstance.destroy();
    if (window.pieChartInstance) window.pieChartInstance.destroy();

    // Draw Bar Chart (Subject-wise Marks)
    const ctx1 = document.getElementById("marksBarChart");
    window.barChartInstance = new Chart(ctx1, {
      type: "bar",
      data: {
        labels: Object.keys(student.Subjects),
        datasets: [{
          label: "Marks Obtained",
          data: Object.values(student.Subjects),
          backgroundColor: [
            "#3b82f6","#10b981","#f59e0b","#ef4444","#8b5cf6","#06b6d4"
          ],
          borderRadius: 6
        }]
      },
      options: {
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, max: 100 } },
        animation: { duration: 1000 }
      }
    });

    // Draw Pie Chart (Grade Distribution)
    const ctx2 = document.getElementById("gradePieChart");
    window.pieChartInstance = new Chart(ctx2, {
      type: "pie",
      data: {
        labels: ["A (80-100)", "B (60-79)", "C (40-59)", "F (<40)"],
        datasets: [{
          data: [
            Object.values(student.Subjects).filter(m => m >= 80).length,
            Object.values(student.Subjects).filter(m => m >= 60 && m < 80).length,
            Object.values(student.Subjects).filter(m => m >= 40 && m < 60).length,
            Object.values(student.Subjects).filter(m => m < 40).length
          ],
          backgroundColor: ["#16a34a", "#3b82f6", "#f59e0b", "#ef4444"]
        }]
      },
      options: {
        plugins: {
          legend: { position: "bottom" }
        },
        animation: { duration: 1200 }
      }
    });
  });
}

// ---------------- MAIN ENTRY ----------------
document.addEventListener("DOMContentLoaded", async () => {
  await initFirebase();
  setupTeacherLoginPage();
  document.querySelectorAll('.btn-logout,.btn-outline-red')
    .forEach(b => b.addEventListener('click', handleLogout));

  onAuthStateChanged(auth, async (user) => {
  const page = window.location.pathname.split("/").pop();
  const secure = [
    "teacher-upload.html",
    "teacher-dashboard.html",
    "teacher-analysis-report.html",
    "student-dashboard.html"
  ];

  // 🧠 NEW: Check for demo student login (offline)
  const demoStudent = localStorage.getItem("studentDemoLogin");

  // ✅ If demo student is logged in, skip Firebase redirect logic
  if (demoStudent && page === "student-dashboard.html") {
    console.log("Demo student logged in (offline mode)");
    renderStudentDashboard();
    return; // prevent further checks
  }

  if (user) {
    userId = user.uid;
    const udoc = await getDoc(doc(db, "users", userId));
    if (!udoc.exists()) {
  await signOut(auth);
  displayMessage("Unauthorized account.", "error");
  return;
}

userRole = udoc.data().role;
    console.log("Logged-in role:", userRole);

const teacherPages = [
  "teacher-upload.html",
  "teacher-dashboard.html",
  "teacher-analysis-report.html"
];

const isTeacherPage = teacherPages.includes(page);
const isStudentPage = page === "student-dashboard.html";

// 🔥 First handle redirects
if (userRole === "admin" && !isTeacherPage) {
  console.log("Redirecting admin to upload page");
  window.location.href = "teacher-upload.html";
  return;
}

if (userRole === "student" && !isStudentPage) {
  console.log("Redirecting student to dashboard");
  window.location.href = "student-dashboard.html";
  return;
}

// ✅ THEN run page setup AFTER redirect logic
handleAuthAndPageSetup();

} else {
  if (secure.includes(page) && !demoStudent) {
    window.location.href = "index.html";
  }
}
});
});

// Polyfill UUID
if (typeof crypto.randomUUID === 'undefined') {
  crypto.randomUUID = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'
    .replace(/[xy]/g, c => {
      const r = Math.random()*16|0, v = c==='x'?r:(r&0x3|0x8);
      return v.toString(16);
    });
}
