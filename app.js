// ============================================================
// SYMMETRY 2026 — QR PARTICIPANT VERIFICATION
// ============================================================


// ============================================================
// FIREBASE IMPORTS
// ============================================================

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";

import {
    getFirestore,
    collection,
    query,
    where,
    getDocs
} from
    "https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js";


// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
//
// IMPORTANT:
// Replace the values below with your actual Firebase config.
//
// Do NOT put a Firebase service-account private key here.
//

const firebaseConfig = {

    apiKey: "YOUR_API_KEY",

    authDomain:
        "YOUR_PROJECT_ID.firebaseapp.com",

    projectId:
        "YOUR_PROJECT_ID",

    storageBucket:
        "YOUR_PROJECT_ID.firebasestorage.app",

    messagingSenderId:
        "YOUR_MESSAGING_SENDER_ID",

    appId:
        "YOUR_APP_ID",

    measurementId:
        "YOUR_MEASUREMENT_ID"
};


// ============================================================
// INITIALIZE FIREBASE
// ============================================================

const app = initializeApp(firebaseConfig);


// ============================================================
// CONNECT TO FIRESTORE
// ============================================================
//
// Your screenshot shows that your Firestore database is named
// "symmetry", so we explicitly connect to that database.
//

const db = getFirestore(app, "symmetry");


// ============================================================
// FIRESTORE COLLECTION
// ============================================================

const participantCollection =
    collection(db, "participant_list");


// ============================================================
// DOM ELEMENTS
// ============================================================

const reader =
    document.getElementById("reader");

const resultSection =
    document.getElementById("result-section");

const resultCard =
    document.getElementById("result-card");

const scannerStatus =
    document.getElementById("scanner-status");

const scanAgainButton =
    document.getElementById("scan-again");


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let scanner = null;

let scanning = false;

let processingScan = false;


// ============================================================
// HTML ESCAPE FUNCTION
// ============================================================
//
// Prevents Firebase data from being interpreted as HTML.
//

function escapeHTML(value) {

    if (value === null || value === undefined) {
        return "";
    }

    return String(value)

        .replace(/&/g, "&amp;")

        .replace(/</g, "&lt;")

        .replace(/>/g, "&gt;")

        .replace(/"/g, "&quot;")

        .replace(/'/g, "&#039;");
}


// ============================================================
// GET REGISTRATION ID FROM QR
// ============================================================
//
// Supported QR formats:
//
// 1. SYM26-MTGA6XXS
//
// 2. {"registration_id":"SYM26-MTGA6XXS"}
//
// 3. https://example.com/?registration_id=SYM26-MTGA6XXS
//
// ============================================================

function extractRegistrationId(decodedText) {

    if (!decodedText) {
        return null;
    }

    decodedText =
        decodedText.trim();


    // --------------------------------------------------------
    // FORMAT 1
    // Plain registration ID
    // --------------------------------------------------------

    if (
        decodedText
            .toUpperCase()
            .startsWith("SYM26-")
    ) {

        return decodedText;

    }


    // --------------------------------------------------------
    // FORMAT 2
    // JSON
    // --------------------------------------------------------

    try {

        const data =
            JSON.parse(decodedText);


        if (
            data &&
            data.registration_id
        ) {

            return String(
                data.registration_id
            ).trim();

        }

    } catch (error) {

        // Not JSON — continue

    }


    // --------------------------------------------------------
    // FORMAT 3
    // URL
    // --------------------------------------------------------

    try {

        const url =
            new URL(decodedText);


        const registrationId =
            url.searchParams.get(
                "registration_id"
            );


        if (registrationId) {

            return registrationId.trim();

        }

    } catch (error) {

        // Not a URL — continue

    }


    // --------------------------------------------------------
    // FALLBACK
    // --------------------------------------------------------
    //
    // If the QR contains something other than the formats
    // above, treat the entire QR content as the ID.
    //

    return decodedText;

}


// ============================================================
// FIND PARTICIPANT IN FIRESTORE
// ============================================================

async function findParticipant(registrationId) {

    console.log(
        "Searching Firebase for:",
        registrationId
    );


    const participantQuery =
        query(

            participantCollection,

            where(
                "registration_id",
                "==",
                registrationId
            )

        );


    const snapshot =
        await getDocs(
            participantQuery
        );


    // --------------------------------------------------------
    // PARTICIPANT NOT FOUND
    // --------------------------------------------------------

    if (snapshot.empty) {

        return null;

    }


    // --------------------------------------------------------
    // GET FIRST MATCH
    // --------------------------------------------------------

    const document =
        snapshot.docs[0];


    return {

        documentId:
            document.id,

        ...document.data()

    };

}


// ============================================================
// STOP SCANNER
// ============================================================

async function stopScanner() {

    if (!scanner) {
        return;
    }


    try {

        if (scanning) {

            await scanner.stop();

        }

    } catch (error) {

        console.log(
            "Scanner stop error:",
            error
        );

    }


    try {

        scanner.clear();

    } catch (error) {

        console.log(
            "Scanner clear error:",
            error
        );

    }


    scanner = null;

    scanning = false;

}


// ============================================================
// START SCANNER
// ============================================================

async function startScanner() {

    console.log(
        "Starting QR scanner..."
    );


    // --------------------------------------------------------
    // RESET STATE
    // --------------------------------------------------------

    processingScan = false;

    scanning = false;


    // --------------------------------------------------------
    // HIDE PREVIOUS RESULT
    // --------------------------------------------------------

    resultSection.classList.add(
        "hidden"
    );

    scanAgainButton.classList.add(
        "hidden"
    );


    resultCard.innerHTML = "";


    scannerStatus.textContent =
        "Requesting camera access...";


    // --------------------------------------------------------
    // STOP EXISTING SCANNER
    // --------------------------------------------------------

    await stopScanner();


    // --------------------------------------------------------
    // CAMERA SUPPORT CHECK
    // --------------------------------------------------------

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        scannerStatus.innerHTML = `

            <strong>
                Camera is not available.
            </strong>

            <br><br>

            Please open this website using
            <strong>HTTPS</strong> or
            <strong>localhost</strong>.

        `;

        return;

    }


    // --------------------------------------------------------
    // CREATE SCANNER
    // --------------------------------------------------------

    try {

        scanner =
            new Html5Qrcode(
                "reader"
            );

    } catch (error) {

        console.error(
            "Scanner creation error:",
            error
        );


        scannerStatus.textContent =
            "Unable to initialize QR scanner.";

        return;

    }


    // --------------------------------------------------------
    // SCANNER CONFIG
    // --------------------------------------------------------

    const scannerConfig = {

        fps: 10,

        qrbox:
            function (
                viewfinderWidth,
                viewfinderHeight
            ) {

                const minEdge =
                    Math.min(
                        viewfinderWidth,
                        viewfinderHeight
                    );


                const boxSize =
                    Math.floor(
                        minEdge * 0.70
                    );


                return {

                    width:
                        boxSize,

                    height:
                        boxSize

                };

            },

        aspectRatio: 1.0

    };


    // --------------------------------------------------------
    // CAMERA CONFIGURATION
    // --------------------------------------------------------

    const cameraConfig = {

        facingMode: {
            ideal: "environment"
        }

    };


    // --------------------------------------------------------
    // START CAMERA
    // --------------------------------------------------------

    try {

        await scanner.start(

            cameraConfig,

            scannerConfig,

            onScanSuccess,

            onScanError

        );


        scanning = true;


        scannerStatus.textContent =
            "Camera ready — scan the participant QR code";


        console.log(
            "Camera started successfully."
        );


    } catch (error) {

        console.error(
            "Camera start error:",
            error
        );


        scanning = false;


        let message =
            "Unable to access the camera.";


        // ----------------------------------------------------
        // ERROR TYPES
        // ----------------------------------------------------

        if (
            error.name ===
            "NotAllowedError"
        ) {

            message =
                "Camera permission was denied.";

        }


        else if (
            error.name ===
            "NotFoundError"
        ) {

            message =
                "No camera was found on this device.";

        }


        else if (
            error.name ===
            "NotReadableError"
        ) {

            message =
                "The camera is already being used by another application.";

        }


        else if (
            error.name ===
            "SecurityError"
        ) {

            message =
                "Camera access was blocked by the browser.";

        }


        scannerStatus.innerHTML = `

            <strong>
                ${message}
            </strong>

            <br><br>

            Make sure camera permission is allowed
            and open this website through
            <strong>HTTPS</strong> or
            <strong>localhost</strong>.

        `;

    }

}


// ============================================================
// QR SCAN SUCCESS
// ============================================================

async function onScanSuccess(
    decodedText,
    decodedResult
) {

    // --------------------------------------------------------
    // PREVENT MULTIPLE SCANS
    // --------------------------------------------------------

    if (
        processingScan ||
        !scanning
    ) {

        return;

    }


    processingScan = true;


    console.log(
        "QR detected:",
        decodedText
    );


    // --------------------------------------------------------
    // STOP CAMERA
    // --------------------------------------------------------

    await stopScanner();


    scannerStatus.textContent =
        "QR detected — verifying participant...";


    // --------------------------------------------------------
    // EXTRACT REGISTRATION ID
    // --------------------------------------------------------

    const registrationId =
        extractRegistrationId(
            decodedText
        );


    if (!registrationId) {

        displayInvalid(
            "Invalid QR data"
        );

        return;

    }


    console.log(
        "Registration ID:",
        registrationId
    );


    // --------------------------------------------------------
    // FIREBASE LOOKUP
    // --------------------------------------------------------

    try {

        const participant =
            await findParticipant(
                registrationId
            );


        // ----------------------------------------------------
        // PARTICIPANT FOUND
        // ----------------------------------------------------

        if (participant) {

            displayParticipant(
                participant
            );

        }


        // ----------------------------------------------------
        // PARTICIPANT NOT FOUND
        // ----------------------------------------------------

        else {

            displayInvalid(
                registrationId
            );

        }

    }


    // --------------------------------------------------------
    // FIREBASE ERROR
    // --------------------------------------------------------

    catch (error) {

        console.error(
            "Firebase error:",
            error
        );


        displayDatabaseError(
            error
        );

    }

}


// ============================================================
// QR SCAN ERROR
// ============================================================
//
// This fires constantly while the scanner is looking for a QR.
// Therefore we intentionally do not display errors here.
//

function onScanError(errorMessage) {

    // Normal scanning noise.
    // Do not display anything.

}


// ============================================================
// DISPLAY PARTICIPANT
// ============================================================

function displayParticipant(
    participant
) {

    resultSection.classList.remove(
        "hidden"
    );

    scanAgainButton.classList.remove(
        "hidden"
    );


    scannerStatus.textContent =
        "Participant verified successfully.";


    // --------------------------------------------------------
    // EVENT LIST
    // --------------------------------------------------------

    const events = [

        {
            name: "Entropy",
            field: "event_entropy"
        },

        {
            name: "Inquisition",
            field: "event_inquisition"
        },

        {
            name: "Overflow",
            field: "event_overflow"
        },

        {
            name: "Predic",
            field: "event_predic"
        },

        {
            name: "Recursion",
            field: "event_recursion"
        },

        {
            name: "Representation",
            field: "event_representation"
        },

        {
            name: "Sudoku",
            field: "event_sudoku"
        }

    ];


    // --------------------------------------------------------
    // GENERATE EVENT HTML
    // --------------------------------------------------------

    const eventHTML =
        events.map(
            event => {

                const active =
                    participant[
                        event.field
                    ] === true;


                return `

                    <div class="
                        event
                        ${
                            active
                                ? "event-active"
                                : "event-inactive"
                        }
                    ">

                        ${
                            active
                                ? "✓"
                                : "—"
                        }

                        ${escapeHTML(
                            event.name
                        )}

                    </div>

                `;

            }
        ).join("");


    // --------------------------------------------------------
    // PARTICIPANT CARD
    // --------------------------------------------------------

    resultCard.innerHTML = `

        <div class="result-card">

            <div class="result-header">

                <div class="valid-icon">
                    ✓
                </div>

                <div>

                    <div class="result-title">
                        Participant Verified
                    </div>

                    <div class="result-subtitle">
                        Registration found in Firebase
                    </div>

                </div>

            </div>


            <div class="participant-name">

                ${escapeHTML(
                    participant.name ||
                    "Unknown Participant"
                )}

            </div>


            <div class="registration-id">

                ${escapeHTML(
                    participant.registration_id ||
                    ""
                )}

            </div>


            <div class="details">


                <!-- INSTITUTE -->

                <div class="detail">

                    <div class="detail-label">
                        Institute
                    </div>

                    <div class="detail-value">

                        ${escapeHTML(
                            participant.institute ||
                            "—"
                        )}

                    </div>

                </div>


                <!-- DEPARTMENT -->

                <div class="detail">

                    <div class="detail-label">
                        Department
                    </div>

                    <div class="detail-value">

                        ${escapeHTML(
                            participant.department ||
                            "—"
                        )}

                    </div>

                </div>


                <!-- YEAR -->

                <div class="detail">

                    <div class="detail-label">
                        Year
                    </div>

                    <div class="detail-value">

                        ${escapeHTML(
                            participant.year ||
                            "—"
                        )}

                    </div>

                </div>


                <!-- EMAIL -->

                <div class="detail">

                    <div class="detail-label">
                        Email
                    </div>

                    <div class="detail-value">

                        ${escapeHTML(
                            participant.email ||
                            "—"
                        )}

                    </div>

                </div>


                <!-- FOOD -->

                <div class="detail">

                    <div class="detail-label">
                        Food Preference
                    </div>

                    <div class="detail-value">

                        ${escapeHTML(
                            participant.food_preference ||
                            "—"
                        )}

                    </div>

                </div>


                <!-- STATUS -->

                <div class="detail">

                    <div class="detail-label">
                        Registration Status
                    </div>

                    <div class="detail-value">

                        ${escapeHTML(
                            participant.status ||
                            "—"
                        )}

                    </div>

                </div>


            </div>


            <!-- EVENTS -->

            <div class="events">

                <div class="events-title">

                    Registered Events

                </div>


                <div class="event-list">

                    ${eventHTML}

                </div>

            </div>


        </div>

    `;

}


// ============================================================
// DISPLAY INVALID QR
// ============================================================

function displayInvalid(
    registrationId
) {

    resultSection.classList.remove(
        "hidden"
    );

    scanAgainButton.classList.remove(
        "hidden"
    );


    scannerStatus.textContent =
        "QR scanned — participant not found.";


    resultCard.innerHTML = `

        <div class="error-card">

            <div class="invalid-icon">
                ✕
            </div>


            <div class="error-title">
                Participant Not Found
            </div>


            <div class="error-message">

                No registered participant was found
                for:

                <br><br>

                <strong>
                    ${escapeHTML(
                        registrationId
                    )}
                </strong>

            </div>

        </div>

    `;

}


// ============================================================
// DISPLAY DATABASE ERROR
// ============================================================

function displayDatabaseError(
    error
) {

    resultSection.classList.remove(
        "hidden"
    );

    scanAgainButton.classList.remove(
        "hidden"
    );


    scannerStatus.textContent =
        "Unable to verify participant.";


    resultCard.innerHTML = `

        <div class="error-card">

            <div class="invalid-icon">
                !
            </div>


            <div class="error-title">
                Firebase Error
            </div>


            <div class="error-message">

                The participant could not be
                verified.

                <br><br>

                Please check your Firebase
                configuration and Firestore
                security rules.

            </div>

        </div>

    `;

}


// ============================================================
// SCAN AGAIN BUTTON
// ============================================================

scanAgainButton.addEventListener(
    "click",
    async function () {

        await startScanner();

    }
);


// ============================================================
// CAMERA DIAGNOSTICS
// ============================================================

console.log(
    "================================="
);

console.log(
    "SYMMETRY 2026 QR SCANNER"
);

console.log(
    "================================="
);


console.log(
    "Secure context:",
    window.isSecureContext
);


console.log(
    "Camera API:",
    !!navigator.mediaDevices
);


console.log(
    "getUserMedia:",
    !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
    )
);


// ============================================================
// START APPLICATION
// ============================================================

startScanner();
