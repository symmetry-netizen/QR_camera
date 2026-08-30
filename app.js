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


async function startScanner() {

    console.log("====================================");
    console.log("STARTING SYMMETRY QR SCANNER");
    console.log("====================================");

    // Reset state
    scanning = false;
    processingScan = false;

    // Hide previous result
    resultSection.classList.add("hidden");
    scanAgainButton.classList.add("hidden");

    resultCard.innerHTML = "";

    scannerStatus.textContent =
        "Requesting camera permission...";


    // ========================================================
    // CHECK CAMERA API
    // ========================================================

    if (
        !navigator.mediaDevices ||
        !navigator.mediaDevices.getUserMedia
    ) {

        scannerStatus.innerHTML = `
            <strong>Camera API is unavailable.</strong>
            <br><br>
            Please use a modern browser over HTTPS.
        `;

        console.error(
            "navigator.mediaDevices.getUserMedia unavailable"
        );

        return;
    }


    // ========================================================
    // STOP PREVIOUS SCANNER
    // ========================================================

    await stopScanner();


    // ========================================================
    // REQUEST CAMERA PERMISSION
    // ========================================================
    //
    // IMPORTANT:
    // We intentionally DO NOT specify facingMode here.
    // This avoids the error you were getting.
    //

    let temporaryStream = null;

    try {

        temporaryStream =
            await navigator.mediaDevices.getUserMedia({

                video: true,

                audio: false

            });


        console.log(
            "Camera permission granted."
        );


    } catch (error) {

        console.error(
            "Camera permission error:",
            error
        );


        scannerStatus.innerHTML = `

            <strong>
                Camera permission was denied.
            </strong>

            <br><br>

            Please allow camera access for this website
            and reload the page.

        `;

        return;

    }


    // ========================================================
    // STOP TEMPORARY CAMERA STREAM
    // ========================================================

    if (temporaryStream) {

        temporaryStream
            .getTracks()
            .forEach(
                track => track.stop()
            );

    }


    // ========================================================
    // CREATE QR SCANNER
    // ========================================================

    try {

        scanner =
            new Html5Qrcode("reader");

    } catch (error) {

        console.error(
            "Html5Qrcode initialization error:",
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
    // GET AVAILABLE CAMERAS
    // ========================================================

    let cameras;

    try {

        cameras =
            await Html5Qrcode.getCameras();

    } catch (error) {

        console.error(
            "Unable to enumerate cameras:",
            error
        );


        scannerStatus.innerHTML = `

            <strong>
                Could not detect your camera.
            </strong>

            <br><br>

            Please check your browser's
            camera permissions.

        `;

        return;

    }


    console.log(
        "Available cameras:",
        cameras
    );


    // ========================================================
    // CHECK CAMERAS
    // ========================================================

    if (
        !cameras ||
        cameras.length === 0
    ) {

        scannerStatus.innerHTML = `

            <strong>
                No camera detected.
            </strong>

            <br><br>

            Please make sure your device
            has a working camera.

        `;

        return;

    }


    // ========================================================
    // SELECT CAMERA
    // ========================================================

    let selectedCamera =
        cameras[0];


    console.log(
        "Default camera:",
        selectedCamera
    );


    // ========================================================
    // FIND REAR CAMERA
    // ========================================================
    //
    // On some browsers camera labels are hidden until
    // permission is granted. Since permission was already
    // requested above, Safari/Chrome may now expose them.
    //

    const rearCamera =
        cameras.find(
            camera => {

                const label =
                    camera.label || "";

                return /back|rear|environment/i
                    .test(label);

            }
        );


    if (rearCamera) {

        selectedCamera =
            rearCamera;

        console.log(
            "Rear camera selected:",
            rearCamera
        );

    } else {

        console.log(
            "Rear camera not explicitly identified."
        );

        console.log(
            "Using first available camera."
        );

    }


    // ========================================================
    // QR SCANNER CONFIGURATION
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


            const boxSize =
                Math.floor(
                    minEdge * 0.70
                );


            return {

                width: boxSize,

                height: boxSize

            };

        },


        aspectRatio: 1.0

    };


    // ========================================================
    // START SCANNER USING CAMERA ID
    // ========================================================
    //
    // IMPORTANT:
    //
    // There is NO:
    //
    // facingMode
    //
    // anywhere here.
    //
    // We pass the camera ID directly.
    //

    try {

        console.log(
            "Starting camera:",
            selectedCamera.id
        );


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
            "===================================="
        );

        console.log(
            "CAMERA STARTED SUCCESSFULLY"
        );

        console.log(
            "===================================="
        );


    } catch (error) {

        console.error(
            "Camera start error:",
            error
        );


        scanning = false;


        scannerStatus.innerHTML = `

            <strong>
                Camera could not be started.
            </strong>

            <br><br>

            ${escapeHTML(
                error.message ||
                "Unknown camera error."
            )}

            <br><br>

            Please reload the page and
            allow camera access.

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
