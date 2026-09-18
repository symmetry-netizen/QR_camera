// ============================================================
// SYMMETRY 2026
// QR PARTICIPANT VERIFICATION + CHECK-IN SYSTEM
// ============================================================
//
// Backend: Firebase Firestore.
// Lookup key: registration_id (a FIELD on each participant doc,
// e.g. "SYM26-MTYM771D") — verification is now a query rather
// than a direct getDoc() by document ID, since the document ID
// is no longer assumed to equal the registration_id.
//
// Attendance is recorded as a STRING field: attendance = "yes",
// alongside a checked_in_at server timestamp.
//
// ============================================================

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
    getFirestore,
    collection,
    query,
    where,
    limit,
    getDocs,
    updateDoc,
    serverTimestamp
} from
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";


// ============================================================
// FIREBASE CONFIGURATION
// ============================================================

const firebaseConfig = {
    apiKey: "AIzaSyAiq2xnBHR5oRvRgTxVCuA1J2aJYS7nwrM",
    authDomain: "symmetry-annual-fest.firebaseapp.com",
    projectId: "symmetry-annual-fest",
    storageBucket: "symmetry-annual-fest.firebasestorage.app",
    messagingSenderId: "854008910944",
    appId: "1:854008910944:web:cf20ff04a22831cb6b5f05",
    measurementId: "G-FEDPP8GWRR"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app, "symmetry");
const PARTICIPANT_COLLECTION = "participant_list";


// ============================================================
// DOM ELEMENTS
// ============================================================

const reader = document.getElementById("reader");
const resultSection = document.getElementById("result-section");
const resultCard = document.getElementById("result-card");
const scannerStatus = document.getElementById("scanner-status");
const scanAgainButton = document.getElementById("scan-again");


// ============================================================
// GLOBAL STATE
// ============================================================

let scanner = null;
let scanning = false;
let processingScan = false;


// ============================================================
// HTML ESCAPE
// ============================================================

function escapeHTML(value) {

    if (value === null || value === undefined) return "";

    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ============================================================
// CONVERT FIREBASE VALUE TO "YES/TRUE"-LIKE STRING OR BOOLEAN
// ============================================================
//
// Used to check whether attendance has already been marked.
// Accepts "yes" (new format), true/1 (legacy), for safety.
//

function isAttended(value) {

    if (value === true || value === 1) return true;

    if (typeof value === "string" && value.trim().toLowerCase() === "yes") {
        return true;
    }

    return false;
}


// ============================================================
// EXTRACT REGISTRATION ID FROM QR
// ============================================================
//
// Supported:
//
// 1. SYM26-MTYM771D
//
// 2. {"registration_id":"SYM26-MTYM771D", ...}
//    (or {"participantID":"SYM26-MTYM771D", ...} for backward
//    compatibility with older registration payloads)
//
// 3. https://example.com/?registration_id=SYM26-MTYM771D
//
// ============================================================

function extractRegistrationId(decodedText) {

    if (!decodedText) return null;

    decodedText = decodedText.trim();

    // --------------------------------------------------------
    // PLAIN REGISTRATION ID
    // --------------------------------------------------------

    if (decodedText.toUpperCase().startsWith("SYM26-")) {
        return decodedText;
    }

    // --------------------------------------------------------
    // JSON QR (registration.js payload)
    // --------------------------------------------------------

    try {

        const data = JSON.parse(decodedText);

        if (data && data.registration_id) {
            return String(data.registration_id).trim();
        }

        if (data && data.participantID) {
            return String(data.participantID).trim();
        }

    } catch (error) {
        // Not JSON
    }

    // --------------------------------------------------------
    // URL QR
    // --------------------------------------------------------

    try {

        const url = new URL(decodedText);

        const registrationId =
            url.searchParams.get("registration_id") ||
            url.searchParams.get("participant_id");

        if (registrationId) return registrationId.trim();

    } catch (error) {
        // Not a URL
    }

    // --------------------------------------------------------
    // FALLBACK
    // --------------------------------------------------------

    return decodedText;
}


// ============================================================
// FIND PARTICIPANT IN FIRESTORE (by registration_id field)
// ============================================================

async function findParticipant(registrationId) {

    console.log("Looking up participant with registration_id:", registrationId);

    const participantsRef = collection(db, PARTICIPANT_COLLECTION);

    const participantQuery = query(
        participantsRef,
        where("registration_id", "==", registrationId),
        limit(1)
    );

    const snapshot = await getDocs(participantQuery);

    if (snapshot.empty) {
        console.log("No matching participant document.");
        return null;
    }

    const docSnap = snapshot.docs[0];

    return {
        ref: docSnap.ref,
        ...docSnap.data()
    };
}


// ============================================================
// MARK PARTICIPANT ATTENDANCE
// ============================================================
//
// attendance is stored as the string "yes"; checked_in_at
// remains a server timestamp.
//

async function markAttendance(participantRef) {

    await updateDoc(participantRef, {
        attendance: "yes",
        checked_in_at: serverTimestamp()
    });
}


// ============================================================
// SCANNER LIFECYCLE
// ============================================================

async function stopScanner() {

    if (!scanner) {
        scanning = false;
        return;
    }

    try {
        if (scanning) await scanner.stop();
    } catch (error) {
        console.log("Scanner stop:", error);
    }

    try {
        scanner.clear();
    } catch (error) {
        console.log("Scanner clear:", error);
    }

    scanner = null;
    scanning = false;
}


async function startScanner() {

    scanning = false;
    processingScan = false;

    resultSection.classList.add("hidden");
    scanAgainButton.classList.add("hidden");
    resultCard.innerHTML = "";

    scannerStatus.textContent = "Requesting camera permission...";

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {

        scannerStatus.innerHTML =
            "<strong>Camera API is unavailable.</strong><br><br>" +
            "Please use a modern browser over HTTPS.";

        return;
    }

    await stopScanner();

    let temporaryStream = null;

    try {

        temporaryStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false
        });

    } catch (error) {

        console.error("Camera permission error:", error);

        scannerStatus.innerHTML =
            "<strong>Camera permission was denied.</strong><br><br>" +
            "Please allow camera access for this website and reload the page.";

        return;
    }

    if (temporaryStream) {
        temporaryStream.getTracks().forEach(track => track.stop());
    }

    try {
        scanner = new Html5Qrcode("reader");
    } catch (error) {

        console.error("Html5Qrcode initialization error:", error);

        scannerStatus.innerHTML =
            "<strong>QR scanner could not be initialized.</strong>";

        return;
    }

    let cameras;

    try {
        cameras = await Html5Qrcode.getCameras();
    } catch (error) {

        console.error("Unable to enumerate cameras:", error);

        scannerStatus.innerHTML =
            "<strong>Could not detect your camera.</strong><br><br>" +
            "Please check your browser's camera permissions.";

        return;
    }

    if (!cameras || cameras.length === 0) {

        scannerStatus.innerHTML =
            "<strong>No camera detected.</strong><br><br>" +
            "Please make sure your device has a working camera.";

        return;
    }

    let selectedCamera = cameras[0];

    const rearCamera = cameras.find(camera => {
        const label = camera.label || "";
        return /back|rear|environment/i.test(label);
    });

    if (rearCamera) selectedCamera = rearCamera;

    const scannerConfig = {

        fps: 10,

        qrbox: function (viewfinderWidth, viewfinderHeight) {

            const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
            const boxSize = Math.floor(minEdge * 0.70);

            return { width: boxSize, height: boxSize };
        },

        aspectRatio: 1.0
    };

    try {

        await scanner.start(
            selectedCamera.id,
            scannerConfig,
            onScanSuccess,
            onScanError
        );

        scanning = true;

        scannerStatus.textContent =
            "Camera ready — scan the participant QR code";

    } catch (error) {

        console.error("Camera start error:", error);

        scanning = false;

        scannerStatus.innerHTML =
            "<strong>Camera could not be started.</strong><br><br>" +
            escapeHTML(error.message || "Unknown camera error.") +
            "<br><br>Please reload the page and allow camera access.";
    }
}


// ============================================================
// QR SCAN SUCCESS
// ============================================================

async function onScanSuccess(decodedText, decodedResult) {

    if (processingScan || !scanning) return;

    processingScan = true;

    console.log("QR CODE DETECTED:", decodedText);

    await stopScanner();

    scannerStatus.textContent = "QR detected — verifying participant...";

    const registrationId = extractRegistrationId(decodedText);

    if (!registrationId) {
        displayInvalid("Invalid QR code");
        return;
    }

    try {

        const participant = await findParticipant(registrationId);

        if (!participant) {
            displayInvalid(registrationId);
            return;
        }

        if (isAttended(participant.attendance)) {
            displayAlreadyCheckedIn(participant);
            return;
        }

        await markAttendance(participant.ref);

        // Reflect the update locally without a second read.
        participant.attendance = "yes";

        displayParticipant(participant);

    } catch (error) {

        console.error("Firestore error:", error);

        displayDatabaseError(error);
    }
}


function onScanError(errorMessage) {
    // Intentionally empty — html5-qrcode calls this continuously
    // while searching for a code.
}


// ============================================================
// DISPLAY: PARTICIPANT VERIFIED + CHECKED IN
// ============================================================

function displayParticipant(participant) {

    resultSection.classList.remove("hidden");
    scanAgainButton.classList.remove("hidden");

    scannerStatus.textContent = "Participant verified — checked in.";

    const events = [
        { name: "Entropy", field: "event_entropy" },
        { name: "Inquisition", field: "event_inquisition" },
        { name: "Overflow", field: "event_overflow" },
        { name: "Predic", field: "event_predic" },
        { name: "Recursion", field: "event_recursion" },
        { name: "Representation", field: "event_representation" },
        { name: "Sudoku", field: "event_sudoku" }
    ];

    const eventHTML = events.map(event => {

        const active = isAttended(participant[event.field]) ||
            participant[event.field] === true;

        return `
            <div class="event ${active ? "event-active" : "event-inactive"}">
                ${active ? "✓" : "—"} ${escapeHTML(event.name)}
            </div>
        `;

    }).join("");

    resultCard.innerHTML = `
        <div class="result-card">

            <div class="result-header">
                <div class="valid-icon">✓</div>
                <div>
                    <div class="result-title">Participant Verified</div>
                    <div class="result-subtitle">Checked in just now</div>
                </div>
            </div>

            <div class="participant-name">
                ${escapeHTML(participant.name || "Unknown Participant")}
            </div>

            <div class="registration-id">
                ${escapeHTML(participant.registration_id || "")}
            </div>

            <div class="details">

                <div class="detail">
                    <div class="detail-label">Institute</div>
                    <div class="detail-value">${escapeHTML(participant.institute || "—")}</div>
                </div>

                <div class="detail">
                    <div class="detail-label">Email</div>
                    <div class="detail-value">${escapeHTML(participant.email || "—")}</div>
                </div>

                <div class="detail">
                    <div class="detail-label">Food Preference</div>
                    <div class="detail-value">${escapeHTML(participant.foodPreference || "—")}</div>
                </div>

                <div class="detail">
                    <div class="detail-label">Check-in Status</div>
                    <div class="detail-value">Checked in</div>
                </div>

            </div>

            <div class="events">
                <div class="events-title">Registered Events</div>
                <div class="event-list">${eventHTML}</div>
            </div>

        </div>
    `;
}


// ============================================================
// DISPLAY: ALREADY CHECKED IN
// ============================================================

function displayAlreadyCheckedIn(participant) {

    resultSection.classList.remove("hidden");
    scanAgainButton.classList.remove("hidden");

    scannerStatus.textContent = "This participant has already checked in.";

    let checkedInAt = "—";

    if (participant.checked_in_at && participant.checked_in_at.toDate) {
        checkedInAt = participant.checked_in_at.toDate().toLocaleString();
    }

    resultCard.innerHTML = `
        <div class="error-card">
            <div class="invalid-icon">!</div>
            <div class="error-title">Already Checked In</div>
            <div class="error-message">
                <strong>${escapeHTML(participant.name || "This participant")}</strong>
                already checked in at:
                <br><br>
                <strong>${escapeHTML(checkedInAt)}</strong>
            </div>
        </div>
    `;
}


// ============================================================
// DISPLAY: PARTICIPANT NOT FOUND
// ============================================================

function displayInvalid(registrationId) {

    resultSection.classList.remove("hidden");
    scanAgainButton.classList.remove("hidden");

    scannerStatus.textContent = "QR scanned — participant not found.";

    resultCard.innerHTML = `
        <div class="error-card">
            <div class="invalid-icon">✕</div>
            <div class="error-title">Participant Not Found</div>
            <div class="error-message">
                No registered participant was found for:
                <br><br>
                <strong>${escapeHTML(registrationId)}</strong>
            </div>
        </div>
    `;
}


// ============================================================
// DISPLAY: DATABASE ERROR
// ============================================================

function displayDatabaseError(error) {

    resultSection.classList.remove("hidden");
    scanAgainButton.classList.remove("hidden");

    scannerStatus.textContent = "Unable to verify participant.";

    let errorMessage = "Unable to access the participant database.";

    if (error.code === "permission-denied") {
        errorMessage = "Firebase denied access to the participant database.";
    } else if (error.code === "unavailable") {
        errorMessage = "Firebase is currently unavailable. Check your internet connection.";
    }

    resultCard.innerHTML = `
        <div class="error-card">
            <div class="invalid-icon">!</div>
            <div class="error-title">Database Error</div>
            <div class="error-message">
                ${escapeHTML(errorMessage)}
                <br><br>
                <small>${escapeHTML(error?.message || "")}</small>
            </div>
        </div>
    `;
}


// ============================================================
// SCAN AGAIN
// ============================================================

scanAgainButton.addEventListener("click", async function () {
    await startScanner();
});


// ============================================================
// START APPLICATION
// ============================================================

startScanner();
