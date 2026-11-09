// PHOTO EDITOR

const canvas = document.getElementById('photoCanvas');
const ctx = canvas ? canvas.getContext('2d') : null;

let uploadedImage = new Image();
let imageLoaded = false;
let uploadedSourceFile = null;

function updateExportButtonsState() {
    const exportButtons = [
        document.getElementById("downloadBtn"),
        document.getElementById("replaceOriginalBtn")
    ];

    const hasImage = !!imageLoaded;
    const hasLocation = !!(
        typeof selectedLocation !== "undefined" &&
        Number.isFinite(selectedLocation.lat) &&
        Number.isFinite(selectedLocation.lon)
    );

    exportButtons.forEach(function (button) {
        if (button) {
            button.disabled = !(hasImage && hasLocation);
        }
    });
}

function buildExportFileName(fileName) {
    const safeName = (fileName || "photo").trim();
    const normalized = safeName.replace(/\.[^/.]+$/, "") || "photo";
    return `${normalized}.jpg`;
}

function getSourceFileName() {
    if (uploadedSourceFile && uploadedSourceFile.name) {
        return uploadedSourceFile.name;
    }

    return "photo.jpg";
}

function createGeotaggedDataURL(latitude, longitude) {
    if (!imageLoaded || !canvas) {
        throw new Error("Rasm yuklanmagan!");
    }

    const jpegData = canvas.toDataURL("image/jpeg", 0.95);
    return addExifGPS(jpegData, latitude, longitude);
}

// IMAGE UPLOAD


async function loadImage(file) {

    if (!file || !file.type.startsWith("image/")) {
        alert("Iltimos, rasm faylini tanlang!");
        return;
    }

    uploadedSourceFile = file;
    const reader = new FileReader();

    reader.onload = function(event) {

        const dataURL = event.target.result;
        const gps = file.type === "image/jpeg"
            ? readExifGPS(dataURL)
            : null;

        uploadedImage = new Image();

        uploadedImage.onload = async function() {

            canvas.width = uploadedImage.naturalWidth;
            canvas.height = uploadedImage.naturalHeight;

            imageLoaded = true;
            updateExportButtonsState();

            document.getElementById("emptyState").style.display = "none";
            canvas.style.display = "block";

            drawPhoto();

            if (gps) {
                await setLocation(gps.lat, gps.lon);
                document.getElementById("locationStatus").textContent =
                    "Rasmga yozilgan GPS topildi";
            } else {
                const latInput = document.getElementById("latitudeInput");
                const lonInput = document.getElementById("longitudeInput");
                if (latInput) latInput.value = "";
                if (lonInput) lonInput.value = "";
                console.log("Rasmda GPS lokatsiya mavjud emas.");
            }
        };

        uploadedImage.onerror = function() {
            alert("Rasmni ochib bo'lmadi!");
        };

        uploadedImage.src = dataURL;
    };

    reader.onerror = function() {
        alert("Rasm faylini o'qishda xatolik!");
    };

    reader.readAsDataURL(file);
}



// DRAW PHOTO

function drawPhoto() {
    if (!imageLoaded || !canvas || !ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(uploadedImage, 0, 0, canvas.width, canvas.height);

    const hasLocation =
        typeof selectedLocation !== 'undefined' &&
        selectedLocation.lat !== null &&
        selectedLocation.lon !== null;

    if (!hasLocation) return;

    drawLocationStamp();
}


// LOCATION STAMP

function drawLocationStamp() {
    if (!canvas || !ctx) return;

    const width = canvas.width;
    const height = canvas.height;

    const colorEl = document.getElementById('stampColor');
    const titleEl = document.getElementById('stampTitle');
    const dateEl = document.getElementById('dateInput');
    const positionEl = document.getElementById('stampPosition');
    const showAddressEl = document.getElementById('showAddress');
    const showCoordinatesEl = document.getElementById('showCoordinates');
    const showDateEl = document.getElementById('showDate');

    if (!colorEl || !titleEl || !dateEl || !positionEl || !showAddressEl || !showCoordinatesEl || !showDateEl) {
        return;
    }

    const color = colorEl.value;
    const title = titleEl.value;
    const address = selectedLocation.address || 'Manzil aniqlanmagan';
    const latitude = selectedLocation.lat.toFixed(6);
    const longitude = selectedLocation.lon.toFixed(6);
    const dateValue = dateEl.value;
    const position = positionEl.value;
    const showAddress = showAddressEl.checked;
    const showCoordinates = showCoordinatesEl.checked;
    const showDate = showDateEl.checked;

    const scale = Math.max(1, Math.min(width, height) / 700);
    const padding = 22 * scale;
    const fontSize = 22 * scale;
    const lineHeight = 34 * scale;
    const lines = [];

    if (title.trim()) {
        lines.push({
            text: title.toUpperCase(),
            font: `bold ${fontSize * 0.85}px Arial`
        });
    }

    if (showAddress) {
        lines.push({
            text: address,
            font: `${fontSize}px Arial`
        });
    }

    if (showCoordinates) {
        lines.push({
            text: `GPS: ${latitude}, ${longitude}`,
            font: `${fontSize * 0.75}px Arial`
        });
    }

    if (showDate && dateValue) {
        const date = new Date(dateValue);
        const formattedDate = date.toLocaleString('uz-UZ', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit'
        });

        lines.push({
            text: formattedDate,
            font: `${fontSize * 0.75}px Arial`
        });
    }

    if (lines.length === 0) return;

    ctx.save();
    ctx.font = `${fontSize}px Arial`;

    let maxTextWidth = 0;
    lines.forEach(line => {
        ctx.font = line.font;
        maxTextWidth = Math.max(maxTextWidth, ctx.measureText(line.text).width);
    });

    const boxWidth = maxTextWidth + padding * 2;
    const boxHeight = lines.length * lineHeight + padding * 2;
    const margin = 25 * scale;

    let x = margin;
    let y = height - boxHeight - margin;

    if (position === 'bottom-right') {
        x = width - boxWidth - margin;
    }

    if (position === 'top-left') {
        y = margin;
    }

    if (position === 'top-right') {
        x = width - boxWidth - margin;
        y = margin;
    }

    ctx.fillStyle = 'rgba(0, 0, 0, 0.72)';
    ctx.beginPath();

    if (typeof ctx.roundRect === 'function') {
        ctx.roundRect(x, y, boxWidth, boxHeight, 12 * scale);
    } else {
        ctx.rect(x, y, boxWidth, boxHeight);
    }

    ctx.fill();

    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';

    let textY = y + padding + lineHeight / 2;
    lines.forEach((line, index) => {
        ctx.font = line.font;
        ctx.fillText(line.text, x + padding, textY + index * lineHeight);
    });

    ctx.restore();
}

// ========================================
// GEOSTAMP - EXIF GPS SYSTEM
// ========================================

// EXIF GPS koordinatalarini o'qish
function readExifGPS(dataURL) {
    try {
        if (typeof piexif === "undefined") return null;

        const exif = piexif.load(dataURL);
        const gps = exif.GPS;

        const lat = gps[piexif.GPSIFD.GPSLatitude];
        const lon = gps[piexif.GPSIFD.GPSLongitude];

        const latRef = gps[piexif.GPSIFD.GPSLatitudeRef];
        const lonRef = gps[piexif.GPSIFD.GPSLongitudeRef];

        if (!lat || !lon || !latRef || !lonRef) {
            return null;
        }

        function toDecimal(value) {
            return value[0][0] / value[0][1] +
                (value[1][0] / value[1][1]) / 60 +
                (value[2][0] / value[2][1]) / 3600;
        }

        let latitude = toDecimal(lat);
        let longitude = toDecimal(lon);

        if (latRef === "S") latitude *= -1;
        if (lonRef === "W") longitude *= -1;

        return {
            lat: latitude,
            lon: longitude
        };

    } catch (error) {
        console.log("Rasmda EXIF GPS topilmadi:", error);
        return null;
    }
}


// Rasmga GPS koordinatalarini yozish
function addExifGPS(jpegData, latitude, longitude) {

    if (typeof piexif === "undefined") {
        throw new Error("Piexif kutubxonasi yuklanmagan!");
    }

    const gps = {};

    gps[piexif.GPSIFD.GPSVersionID] = [2, 3, 0, 0];

    gps[piexif.GPSIFD.GPSLatitudeRef] =
        latitude < 0 ? "S" : "N";

    gps[piexif.GPSIFD.GPSLatitude] =
        piexif.GPSHelper.degToDmsRational(Math.abs(latitude));

    gps[piexif.GPSIFD.GPSLongitudeRef] =
        longitude < 0 ? "W" : "E";

    gps[piexif.GPSIFD.GPSLongitude] =
        piexif.GPSHelper.degToDmsRational(Math.abs(longitude));

    const exifObject = {
        "0th": {},
        "Exif": {},
        "GPS": gps
    };

    const exifBytes = piexif.dump(exifObject);

    return piexif.insert(exifBytes, jpegData);
}


// Tayyor rasmni GPS bilan yuklab olish
function applyCurrentGPSToImage() {
    if (!imageLoaded) {
        alert("Avval rasm yuklang!");
        return;
    }

    const latInput = document.getElementById("latitudeInput");
    const lonInput = document.getElementById("longitudeInput");

    if (!latInput || !lonInput) {
        alert("Kordinatalar maydoni topilmadi!");
        return;
    }

    const lat = Number(latInput.value);
    const lon = Number(lonInput.value);

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        alert("Korrect koordinatalarni kiriting!");
        return;
    }

    selectedLocation.lat = lat;
    selectedLocation.lon = lon;
    updateExportButtonsState();

    document.getElementById("latitude").textContent = Number(lat).toFixed(6);
    document.getElementById("longitude").textContent = Number(lon).toFixed(6);

    const status = document.getElementById("locationStatus");
    if (status) {
        status.textContent = "Kordinatalar tayyorlandi. JPG yuklab olish tugmasini bosing.";
    }

    try {
        createGeotaggedDataURL(lat, lon);
    } catch (error) {
        console.error(error);
        alert("GPS ma'lumotini tayyorlashda xatolik yuz berdi!");
    }
}

function downloadPhotoWithGPS() {
    if (!imageLoaded) {
        alert("Avval rasm yuklang!");
        return;
    }

    if (!Number.isFinite(selectedLocation.lat) || !Number.isFinite(selectedLocation.lon)) {
        alert("Mapdan yoki koordinatalardan joy tanlang!");
        return;
    }

    try {
        const finalImage = createGeotaggedDataURL(
            selectedLocation.lat,
            selectedLocation.lon
        );

        const link = document.createElement("a");
        link.href = finalImage;
        link.download = buildExportFileName(getSourceFileName());
        document.body.appendChild(link);
        link.click();
        link.remove();

        const status = document.getElementById("locationStatus");
        if (status) {
            status.textContent = "GPS bilan JPG fayl yuklab olindi";
        }
    } catch (error) {
        console.error(error);
        alert("GPS ma'lumotini rasmga yozib bo'lmadi!");
    }
}

async function replaceOriginalImageWithGPS() {
    if (!imageLoaded) {
        alert("Avval rasm yuklang!");
        return;
    }

    if (!Number.isFinite(selectedLocation.lat) || !Number.isFinite(selectedLocation.lon)) {
        alert("Mapdan yoki koordinatalardan joy tanlang!");
        return;
    }

    try {
        const finalImage = createGeotaggedDataURL(
            selectedLocation.lat,
            selectedLocation.lon
        );

        const fileName = buildExportFileName(getSourceFileName());
        const blob = await (await fetch(finalImage)).blob();

        if (window.showSaveFilePicker) {
            try {
                const handle = await window.showSaveFilePicker({
                    suggestedName: fileName,
                    types: [{
                        description: "JPEG images",
                        accept: { "image/jpeg": [".jpg", ".jpeg"] }
                    }]
                });

                const writable = await handle.createWritable();
                await writable.write(blob);
                await writable.close();

                const status = document.getElementById("locationStatus");
                if (status) {
                    status.textContent = `Fayl saqlandi: ${fileName}`;
                }
                return;
            } catch (pickerError) {
                console.warn("showSaveFilePicker bekor qilindi yoki qo'llab-quvvatlanmadi:", pickerError);
            }
        }

        const link = document.createElement("a");
        link.href = finalImage;
        link.download = fileName;
        link.setAttribute("download", fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();

        const status = document.getElementById("locationStatus");
        if (status) {
            status.textContent = `Fayl saqlash oynasi ochildi: ${fileName}`;
        }
    } catch (error) {
        console.error(error);
        alert("Asl nom bilan saqlashda xatolik yuz berdi!");
    }
}
