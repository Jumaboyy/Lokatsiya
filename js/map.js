
// ========================================
// GEOSTAMP - MAP SYSTEM
// ========================================

let map;
let marker;
let currentLayer = null;

// Tanlangan lokatsiya
let selectedLocation = {
    lat: null,
    lon: null,
    address: ""
};

let loadedKmzPlacements = [];

function normalizeLocationText(value) {
    return String(value || "")
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, "");
}

function averageCoordinates(points) {
    if (!points.length) {
        return null;
    }

    const sum = points.reduce(function (acc, point) {
        acc.lat += point.lat;
        acc.lon += point.lon;
        return acc;
    }, { lat: 0, lon: 0 });

    return {
        lat: sum.lat / points.length,
        lon: sum.lon / points.length
    };
}

function parseCoordinatesFromText(rawText) {
    if (!rawText) {
        return [];
    }

    const points = [];
    const chunks = rawText
        .trim()
        .split(/\s+/)
        .filter(Boolean);

    chunks.forEach(function (chunk) {
        const values = chunk.split(",").map(function (item) {
            const value = Number(item);
            return Number.isFinite(value) ? value : null;
        }).filter(function (item) {
            return item !== null;
        });

        if (values.length >= 2) {
            const lon = values[0];
            const lat = values[1];
            if (Number.isFinite(lat) && Number.isFinite(lon)) {
                points.push({ lat: Number(lat), lon: Number(lon) });
            }
        }
    });

    return points;
}

function extractPlacemarkLocation(placemark) {
    if (!placemark) {
        return null;
    }

    const nameElement = placemark.getElementsByTagName("name")[0];
    const descriptionElement = placemark.getElementsByTagName("description")[0];
    const name = nameElement ? nameElement.textContent.trim() : "";
    const description = descriptionElement ? descriptionElement.textContent.trim() : "";

    const geometryCandidates = [
        placemark.getElementsByTagName("Point")[0],
        placemark.getElementsByTagName("LineString")[0],
        placemark.getElementsByTagName("Polygon")[0],
        placemark.getElementsByTagName("LinearRing")[0],
        placemark.getElementsByTagName("MultiGeometry")[0]
    ].filter(Boolean);

    let coordinates = [];

    geometryCandidates.forEach(function (node) {
        const allCoordinateNodes = node.getElementsByTagName("coordinates");
        for (let i = 0; i < allCoordinateNodes.length; i += 1) {
            const parsed = parseCoordinatesFromText(allCoordinateNodes[i].textContent || "");
            coordinates = coordinates.concat(parsed);
        }
    });

    if (!coordinates.length) {
        const directPoint = placemark.getElementsByTagName("coordinates")[0];
        if (directPoint) {
            coordinates = parseCoordinatesFromText(directPoint.textContent || "");
        }
    }

    if (!coordinates.length) {
        return null;
    }

    const location = averageCoordinates(coordinates);
    if (!location) {
        return null;
    }

    return {
        name: name || description || "Kadastr obyekti",
        description: description || name || "Kadastr obyekti",
        lat: location.lat,
        lon: location.lon
    };
}

function findBestKmzMatch(query, features) {
    const normalizedQuery = normalizeLocationText(query);

    if (!normalizedQuery || !features.length) {
        return null;
    }

    const exact = features.find(function (feature) {
        return normalizeLocationText(feature.name) === normalizedQuery ||
            normalizeLocationText(feature.description) === normalizedQuery;
    });

    if (exact) {
        return exact;
    }

    const contains = features.find(function (feature) {
        return normalizeLocationText(feature.name).includes(normalizedQuery) ||
            normalizeLocationText(feature.description).includes(normalizedQuery);
    });

    return contains || null;
}

async function loadKmzFile(file) {
    if (!file) {
        return false;
    }

    if (typeof JSZip === "undefined") {
        alert("KMZ faylni o'qish uchun JSZip kutubxonasi yuklanmagan!");
        return false;
    }

    const status = document.getElementById("locationStatus");
    if (status) {
        status.textContent = "KMZ fayl o'qilmoqda...";
    }

    try {
        const zip = await JSZip.loadAsync(file);
        const kmlFiles = Object.keys(zip.files).filter(function (name) {
            return name.toLowerCase().endsWith(".kml");
        });

        if (!kmlFiles.length) {
            throw new Error("KMZ ichida KML fayl topilmadi.");
        }

        const features = [];

        for (const kmlFileName of kmlFiles) {
            const fileEntry = zip.file(kmlFileName);
            if (!fileEntry) {
                continue;
            }

            const kmlText = await fileEntry.async("text");
            const parser = new DOMParser();
            const xml = parser.parseFromString(kmlText, "application/xml");
            const placemarks = xml.getElementsByTagName("Placemark");

            for (let i = 0; i < placemarks.length; i += 1) {
                const location = extractPlacemarkLocation(placemarks[i]);
                if (location) {
                    features.push(location);
                }
            }
        }

        if (!features.length) {
            throw new Error("KMZ ichida koordinatlar yoki obyektlar topilmadi.");
        }

        loadedKmzPlacements = features;

        const cadastralInput = document.getElementById("cadastralInput");
        const queryValue = cadastralInput ? cadastralInput.value.trim() : "";

        if (queryValue) {
            applyCadastralLocation(queryValue);
        } else {
            const firstFeature = features[0];
            setLocation(firstFeature.lat, firstFeature.lon);
            selectedLocation.address = firstFeature.name || "KMZ dan olingan lokatsiya";
            document.getElementById("locationStatus").textContent =
                "KMZ yuklandi. Birinchi obyekt xaritaga qo'yildi.";
        }

        return true;
    } catch (error) {
        console.error("KMZ yuklash xatosi:", error);
        if (status) {
            status.textContent = "KMZ faylni o'qishda xatolik yuz berdi.";
        }
        alert("KMZ faylni o'qib bo'lmadi. KML/koordinatlarning tuzilishini tekshiring.");
        return false;
    }
}

function applyCadastralLocation(query) {
    const status = document.getElementById("locationStatus");
    const normalizedQuery = query.trim();

    if (!normalizedQuery) {
        if (status) {
            status.textContent = "Kadastr raqamni kiriting.";
        }
        return;
    }

    if (!loadedKmzPlacements.length) {
        if (status) {
            status.textContent = "Avval KMZ fayl yuklang.";
        }
        return;
    }

    const match = findBestKmzMatch(normalizedQuery, loadedKmzPlacements);

    if (!match) {
        if (status) {
            status.textContent = "Kadastr raqamiga mos keladigan lokatsiya topilmadi.";
        }
        return;
    }

    setLocation(match.lat, match.lon);
    selectedLocation.address = match.name || `Kadastr: ${normalizedQuery}`;

    if (status) {
        status.textContent = `Kadastr bo‘yicha tanlandi: ${match.name}`;
    }
}

async function loadDefaultKmz() {
    try {
        const response = await fetch("./kmz/2025.04.08.kmz", { cache: "no-store" });
        if (!response.ok) {
            return false;
        }

        const blob = await response.blob();
        const file = new File([blob], "2025.04.08.kmz", { type: "application/vnd.google-earth.kmz" });
        return await loadKmzFile(file);
    } catch (error) {
        console.warn("Standart KMZ yuklanmadi:", error);
        return false;
    }
}

// ========================================
// MAP LAYERS
// ========================================

let mapLayers = {};

function createMapLayers() {

    // 1. Oddiy xarita
    mapLayers.street = L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            attribution: "&copy; OpenStreetMap contributors",
            maxZoom: 20,
            detectRetina: true,
            maxNativeZoom: 19
        }
    );

    // 2. Sun'iy yo'ldosh xaritasi
    mapLayers.satellite = L.tileLayer(
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
        {
            attribution: "Tiles &copy; Esri",
            maxZoom: 20,
            detectRetina: true,
            maxNativeZoom: 19
        }
    );

    mapLayers.satellite.on("tileerror", function() {
        if (currentLayer === mapLayers.satellite && mapLayers.street) {
            if (map) {
                map.removeLayer(mapLayers.satellite);
                map.addLayer(mapLayers.street);
            }

            currentLayer = mapLayers.street;

            document.querySelectorAll(".map-type-btn").forEach(function(button) {
                button.classList.toggle("active", button.dataset.mapType === "street");
            });

            const status = document.getElementById("locationStatus");
            if (status) {
                status.textContent = "Sun'iy yo'ldosh xarita mavjud emas, oddiy xarita ishlatilmoqda.";
            }
        }
    });
}

// ========================================
// MAP INITIALIZATION
// ========================================

function initMap() {

    const mapElement = document.getElementById("map");

    if (!mapElement) {
        console.error("Xarita elementi topilmadi!");
        return;
    }

    if (typeof L === "undefined") {
        mapElement.innerHTML =
            "<p style='padding:20px;color:red'>Leaflet yuklanmadi. Internetni tekshiring.</p>";
        return;
    }

    if (map) {
        map.remove();
        map = null;
    }

    createMapLayers();

    // Xarita boshlang'ich joylashuvi
    map = L.map("map", {
        zoomControl: false,
        scrollWheelZoom: true,
        touchZoom: true,
        doubleClickZoom: true,
        boxZoom: true,
        zoomSnap: 0.25,
        zoomDelta: 0.5,
        preferCanvas: true
    }).setView(
        [40.3734, 71.7978],
        12
    );

    // Boshlang'ich oddiy xarita
    currentLayer = mapLayers.street;
    currentLayer.addTo(map);

    const refreshMapSize = function() {
        if (!map) return;
        setTimeout(function() {
            map.invalidateSize();
        }, 120);
    };

    window.addEventListener("resize", refreshMapSize);
    window.addEventListener("orientationchange", refreshMapSize);

    if (typeof ResizeObserver !== "undefined") {
        const observer = new ResizeObserver(function() {
            refreshMapSize();
        });
        observer.observe(mapElement);
    }

    // Xarita bosilganda lokatsiya tanlash
    map.on("click", async function(event) {

        const lat = event.latlng.lat;
        const lon = event.latlng.lng;

        await setLocation(lat, lon);

    });

    setTimeout(function() {
        map.invalidateSize();
    }, 500);

    console.log("GeoStamp xaritasi ishga tushdi!");
}

// ========================================
// CHANGE MAP TYPE
// ========================================

function changeMapType(type) {

    if (!map) {
        console.error("Xarita hali ishga tushmagan!");
        return;
    }

    if (!mapLayers[type]) {
        console.error("Bunday xarita turi mavjud emas!");
        return;
    }

    if (type === "satellite" && mapLayers.satellite) {
        const status = document.getElementById("locationStatus");
        if (status) {
            status.textContent = "Sun'iy yo'ldosh xarita yuklanmoqda...";
        }
    }

    if (currentLayer) {
        map.removeLayer(currentLayer);
    }

    currentLayer = mapLayers[type];
    currentLayer.addTo(map);

    // Tugmalar ko'rinishini yangilash
    document.querySelectorAll(".map-type-btn").forEach(function(button) {
        button.classList.remove("active");
    });

    const activeButton = document.querySelector(
        `[data-map-type="${type}"]`
    );

    if (activeButton) {
        activeButton.classList.add("active");
    }

    setTimeout(function() {
        map.invalidateSize();
    }, 100);
}

// ========================================
// SET LOCATION
// ========================================

async function setLocation(lat, lon) {

    selectedLocation.lat = lat;
    selectedLocation.lon = lon;

    const latitudeInput = document.getElementById("latitudeInput");
    const longitudeInput = document.getElementById("longitudeInput");

    if (latitudeInput) latitudeInput.value = Number(lat).toFixed(6);
    if (longitudeInput) longitudeInput.value = Number(lon).toFixed(6);

    if (marker) {
        marker.setLatLng([lat, lon]);
    } else {
        marker = L.marker([lat, lon]).addTo(map);
    }

    map.panTo([lat, lon]);

    document.getElementById("latitude").textContent =
        Number(lat).toFixed(6);

    document.getElementById("longitude").textContent =
        Number(lon).toFixed(6);

    document.getElementById("locationStatus").textContent =
        "Joy tanlandi";

    if (typeof drawPhoto === "function") {
        drawPhoto();
    }

    try {
        const url =
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lon}&accept-language=uz`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Manzil topilmadi");
        }

        const data = await response.json();

        selectedLocation.address =
            data.display_name || "Manzil topilmadi";

        document.getElementById("locationStatus").textContent =
            selectedLocation.address;

    } catch(error) {
        selectedLocation.address = "Manzil aniqlanmadi";
        document.getElementById("locationStatus").textContent =
            "Koordinatalar saqlandi";
        console.error(error);
    }

    if (typeof drawPhoto === "function") {
        drawPhoto();
    }
}

// ========================================
// GPS LOCATION
// ========================================

function getCurrentLocation() {

    if (!navigator.geolocation) {
        alert("Brauzer GPS xizmatini qo'llab-quvvatlamaydi!");
        return;
    }

    navigator.geolocation.getCurrentPosition(

        function(position) {

            const lat = position.coords.latitude;
            const lon = position.coords.longitude;

            setLocation(lat, lon);

        },

        function(error) {

            alert(
                "GPS ishlamadi. Brauzerda lokatsiyaga ruxsat bering."
            );

            console.error(error);

        },

        {
            enableHighAccuracy: true,
            timeout: 15000,
            maximumAge: 0
        }

    );
}

// ========================================
// SEARCH LOCATION
// ========================================

async function searchLocation() {

    const input = document.getElementById("addressInput");

    const query = input.value.trim();

    if (!query) {
        alert("Manzil kiriting!");
        return;
    }

    document.getElementById("locationStatus").textContent =
        "Manzil qidirilmoqda...";

    try {

        const url =
            `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=1&accept-language=uz`;

        const response = await fetch(url);

        if (!response.ok) {
            throw new Error("Qidiruv xatosi");
        }

        const data = await response.json();

        if (!data.length) {

            document.getElementById("locationStatus").textContent =
                "Manzil topilmadi!";

            return;
        }

        await setLocation(
            Number(data[0].lat),
            Number(data[0].lon)
        );

    } catch(error) {

        document.getElementById("locationStatus").textContent =
            "Internet yoki qidiruv xizmatida xatolik.";

        console.error(error);
    }
}
