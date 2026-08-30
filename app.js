// ============================================================
// SYMMETRY 2026
// QR PARTICIPANT VERIFICATION SYSTEM
// ============================================================


// ============================================================
// FIREBASE IMPORTS
// ============================================================

import { initializeApp } from
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";

import {
    getFirestore,
    collection,
    query,
    where,
    getDocs
} from
    "https://www.gstatic.com/firebasejs/11.10.0/firebase-firestore.js";


// ============================================================
// FIREBASE CONFIGURATION
// ============================================================
//
// Replace these values with the configuration from:
//
// Firebase Console
// → Project Settings
// → Your Apps
// → Web App
//
// IMPORTANT:
// Do NOT put a Firebase service-account private key here.
//

const firebaseConfig = {
  apiKey: "AIzaSyAiq2xnBHR5oRvRgTxVCuA1J2aJYS7nwrM",
  authDomain: "symmetry-annual-fest.firebaseapp.com",
  projectId: "symmetry-annual-fest",
  storageBucket: "symmetry-annual-fest.firebasestorage.app",
  messagingSenderId: "854008910944",
  appId: "1:854008910944:web:cf20ff04a22831cb6b5f05",
  measurementId: "G-FEDPP8GWRR"
};



// ============================================================
// INITIALIZE FIREBASE
// ============================================================

const app =
    initializeApp(firebaseConfig);


// ============================================================
// CONNECT TO FIRESTORE
// ============================================================
//
// Your Firestore database is named:
//
// symmetry
//
// Therefore we explicitly specify it here.
//

const db =
    getFirestore(
        app,
        "symmetry"
    );


// ============================================================
// PARTICIPANT COLLECTION
// ============================================================

const participantCollection =
    collection(
        db,
        "participant_list"
    );


// ============================================================
// DOM ELEMENTS
// ============================================================

const reader =
    document.getElementById(
        "reader"
    );

const resultSection =
    document.getElementById(
        "result-section"
    );

const resultCard =
    document.getElementById(
        "result-card"
    );

const scannerStatus =
    document.getElementById(
        "scanner-status"
    );

const scanAgainButton =
    document.getElementById(
        "scan-again"
    );


// ============================================================
// GLOBAL VARIABLES
// ============================================================

let scanner = null;

let scanning = false;

let processingScan = false;


// ============================================================
// HTML ESCAPE
// ============================================================
//
// Protects the page from HTML contained in Firebase data.
//

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {

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
// CONVERT FIREBASE VALUE TO BOOLEAN
// ============================================================
//
// This handles values such as:
//
// true
// false
// "true"
// "false"
// 1
// 0
//
// This makes event checking more robust.
//

function isTrue(value) {

    if (value === true) {

        return true;

    }


    if (value === 1) {

        return true;

    }


    if (
        typeof value === "string" &&
        value.toLowerCase() === "true"
    ) {

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
// 1. SYM26-MTGA6XXS
//
// 2. {"registration_id":"SYM26-MTGA6XXS"}
//
// 3. https://example.com/?registration_id=SYM26-MTGA6XXS
//
// ============================================================

function extractRegistrationId(
    decodedText
) {

    if (!decodedText) {

        return null;

    }


    decodedText =
        decodedText.trim();


    // --------------------------------------------------------
    // PLAIN REGISTRATION ID
    // --------------------------------------------------------

    if (
        decodedText
            .toUpperCase()
            .startsWith("SYM26-")
    ) {

        return decodedText;

    }


    // --------------------------------------------------------
    // JSON QR
    // --------------------------------------------------------

    try {

        const data =
            JSON.parse(
                decodedText
            );


        if (
            data &&
            data.registration_id
        ) {

            return String(
                data.registration_id
            ).trim();

        }

    } catch (error) {

        // Not JSON
    }


    // --------------------------------------------------------
    // URL QR
    // --------------------------------------------------------

    try {

        const url =
            new URL(
                decodedText
            );


        const registrationId =
            url.searchParams.get(
                "registration_id"
            );


        if (registrationId) {

            return registrationId.trim();

        }

    } catch (error) {

        // Not a URL
    }


    // --------------------------------------------------------
    // FALLBACK
    // --------------------------------------------------------

    return decodedText;

}


// ============================================================
// FIND PARTICIPANT IN FIRESTORE
// ============================================================

async function findParticipant(
    registrationId
) {

    console.log(
        "Searching Firestore..."
    );

    console.log(
        "Registration ID:",
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


    console.log(
        "Documents found:",
        snapshot.size
    );


    // --------------------------------------------------------
    // NO MATCH
    // --------------------------------------------------------

    if (
        snapshot.empty
    ) {

        return null;

    }


    // --------------------------------------------------------
    // FIRST MATCH
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

        scanning = false;

        return;

    }


    try {

        if (scanning) {

            await scanner.stop();

        }

    } catch (error) {

        console.log(
            "Scanner stop:",
            error
        );

    }


    try {

        scanner.clear();

    } catch (error) {

        console.log(
            "Scanner clear:",
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
        "================================="
    );

    console.log(
        "STARTING QR SCANNER"
    );

    console.log(
        "================================="
    );


    // --------------------------------------------------------
    // RESET
    // --------------------------------------------------------

    scanning = false;

    processingScan = false;


    // --------------------------------------------------------
    // HIDE OLD RESULT
    // --------------------------------------------------------

    resultSection.classList.add(
        "hidden"
    );

    scanAgainButton.classList.add(
        "hidden"
    );


    resultCard.innerHTML = "";


    scannerStatus.textContent =
        "Starting camera...";


    // --------------------------------------------------------
    // STOP PREVIOUS SCANNER
    // --------------------------------------------------------

    await stopScanner();


    // --------------------------------------------------------
    // CHECK CAMERA API
    // --------------------------------------------------------

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        scannerStatus.innerHTML = `

            <strong>
                Camera API unavailable.
            </strong>

            <br><br>

            Please use HTTPS and a modern browser.

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
            "Scanner creation failed:",
            error
        );


        scannerStatus.innerHTML = `

            <strong>
                QR scanner could not be initialized.
            </strong>

        `;

        return;

    }


    // ========================================================
    // SCANNER CONFIGURATION
    // ========================================================

    const scannerConfig = {

        fps: 10,


        qrbox: function (
            viewfinderWidth,
            viewfinderHeight
        ) {

            const minEdge =
                Math.min(
                    viewfinderWidth,
                    viewfinderHeight
                );


            const size =
                Math.floor(
                    minEdge * 0.70
                );


            return {

                width: size,

                height: size

            };

        },


        aspectRatio: 1.0

    };


    // ========================================================
    // METHOD 1
    // REAR CAMERA
    // ========================================================
    //
    // IMPORTANT:
    // `exact` is used here instead of `ideal`.
    //
    // This fixes the error you encountered:
    //
    // "'facingMode' should be string or object with exact as key"
    //
    // ========================================================

    try {

        console.log(
            "Trying rear camera..."
        );


        await scanner.start(

            {
                facingMode: {
                    exact: "environment"
                }
            },

            scannerConfig,

            onScanSuccess,

            onScanError

        );


        scanning = true;


        scannerStatus.textContent =
            "Camera ready — scan the participant QR code";


        console.log(
            "Rear camera started successfully."
        );


        return;

    } catch (error) {

        console.warn(
            "Rear camera failed:",
            error
        );

    }


    // ========================================================
    // METHOD 2
    // FALLBACK CAMERA
    // ========================================================

    try {

        console.log(
            "Trying available cameras..."
        );


        const cameras =
            await Html5Qrcode.getCameras();


        console.log(
            "Available cameras:",
            cameras
        );


        if (
            !cameras ||
            cameras.length === 0
        ) {

            throw new Error(
                "No cameras detected."
            );

        }


        // ----------------------------------------------------
        // DEFAULT CAMERA
        // ----------------------------------------------------

        let selectedCamera =
            cameras[0];


        // ----------------------------------------------------
        // SEARCH FOR REAR CAMERA
        // ----------------------------------------------------

        const rearCamera =
            cameras.find(
                camera => {

                    return /back|rear|environment/i
                        .test(
                            camera.label
                        );

                }
            );


        if (rearCamera) {

            selectedCamera =
                rearCamera;

        }


        console.log(
            "Selected camera:",
            selectedCamera
        );


        // ----------------------------------------------------
        // START SELECTED CAMERA
        // ----------------------------------------------------

        await scanner.start(

            selectedCamera.id,

            scannerConfig,

            onScanSuccess,

            onScanError

        );


        scanning = true;


        scannerStatus.textContent =
            "Camera ready — scan the participant QR code";


        console.log(
            "Fallback camera started successfully."
        );


    } catch (error) {

        console.error(
            "All camera attempts failed:",
            error
        );


        scanning = false;


        // ----------------------------------------------------
        // DETERMINE ERROR
        // ----------------------------------------------------

        let message =
            "Unable to open camera.";


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
                "The browser blocked camera access.";

        }


        // ----------------------------------------------------
        // DISPLAY ERROR
        // ----------------------------------------------------

        scannerStatus.innerHTML = `

            <strong>
                ${escapeHTML(message)}
            </strong>

            <br><br>

            Please allow camera access
            and reload the page.

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
    // PREVENT DUPLICATE PROCESSING
    // --------------------------------------------------------

    if (
        processingScan ||
        !scanning
    ) {

        return;

    }


    processingScan = true;


    console.log(
        "================================="
    );

    console.log(
        "QR CODE DETECTED"
    );

    console.log(
        "Raw QR:",
        decodedText
    );

    console.log(
        "================================="
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


    console.log(
        "Extracted registration ID:",
        registrationId
    );


    // --------------------------------------------------------
    // INVALID QR
    // --------------------------------------------------------

    if (!registrationId) {

        displayInvalid(
            "Invalid QR code"
        );

        return;

    }


    // --------------------------------------------------------
    // FIRESTORE SEARCH
    // --------------------------------------------------------

    try {

        const participant =
            await findParticipant(
                registrationId
            );


        // ----------------------------------------------------
        // FOUND
        // ----------------------------------------------------

        if (participant) {

            console.log(
                "Participant found:",
                participant
            );


            displayParticipant(
                participant
            );

        }


        // ----------------------------------------------------
        // NOT FOUND
        // ----------------------------------------------------

        else {

            console.log(
                "Participant not found."
            );


            displayInvalid(
                registrationId
            );

        }

    } catch (error) {

        console.error(
            "Firestore error:",
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
// html5-qrcode calls this continuously while searching.
//
// Do not display these errors to the user.
//

function onScanError(
    errorMessage
) {

    // Intentionally empty.

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


    // ========================================================
    // EVENT DEFINITIONS
    // ========================================================

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


    // ========================================================
    // EVENT HTML
    // ========================================================

    const eventHTML =
        events.map(
            event => {

                const active =
                    isTrue(
                        participant[
                            event.field
                        ]
                    );


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


    // ========================================================
    // PARTICIPANT CARD
    // ========================================================

    resultCard.innerHTML = `

        <div class="result-card">


            <!-- HEADER -->

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


            <!-- NAME -->

            <div class="participant-name">

                ${escapeHTML(
                    participant.name ||
                    "Unknown Participant"
                )}

            </div>


            <!-- REGISTRATION ID -->

            <div class="registration-id">

                ${escapeHTML(
                    participant.registration_id ||
                    ""
                )}

            </div>


            <!-- DETAILS -->

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
// DISPLAY INVALID PARTICIPANT
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
// DISPLAY FIREBASE ERROR
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


    console.error(
        "Firebase error details:",
        error
    );


    let errorMessage =
        "Unable to access the participant database.";


    // --------------------------------------------------------
    // PERMISSION ERROR
    // --------------------------------------------------------

    if (
        error.code ===
        "permission-denied"
    ) {

        errorMessage =
            "Firebase denied access to the participant database.";

    }


    // --------------------------------------------------------
    // NETWORK ERROR
    // --------------------------------------------------------

    else if (
        error.code ===
        "unavailable"
    ) {

        errorMessage =
            "Firebase is currently unavailable. Check your internet connection.";

    }


    resultCard.innerHTML = `

        <div class="error-card">


            <div class="invalid-icon">
                !
            </div>


            <div class="error-title">
                Database Error
            </div>


            <div class="error-message">

                ${escapeHTML(
                    errorMessage
                )}

                <br><br>

                <small>
                    ${escapeHTML(
                        error?.message ||
                        ""
                    )}
                </small>

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

        console.log(
            "Starting another scan..."
        );


        await startScanner();

    }
);


// ============================================================
// CAMERA DIAGNOSTICS
// ============================================================

console.log(
    "========================================"
);

console.log(
    "SYMMETRY 2026 QR SCANNER"
);

console.log(
    "========================================"
);


console.log(
    "Page:",
    window.location.href
);


console.log(
    "Secure context:",
    window.isSecureContext
);


console.log(
    "MediaDevices available:",
    !!navigator.mediaDevices
);


console.log(
    "getUserMedia available:",
    !!(
        navigator.mediaDevices &&
        navigator.mediaDevices.getUserMedia
    )
);


console.log(
    "Html5Qrcode available:",
    typeof Html5Qrcode !== "undefined"
);


console.log(
    "========================================"
);


// ============================================================
// START APPLICATION
// ============================================================

startScanner();
