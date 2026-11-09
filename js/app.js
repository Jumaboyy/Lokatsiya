
document.addEventListener("DOMContentLoaded", function () {

    if (typeof initMap === "function") {
        initMap();
    }

    const imageInput = document.getElementById("imageInput");
    const selectImage = document.getElementById("selectImage");
    const downloadBtn = document.getElementById("downloadBtn");
    const replaceOriginalBtn = document.getElementById("replaceOriginalBtn");
    const latitudeInput = document.getElementById("latitudeInput");
    const longitudeInput = document.getElementById("longitudeInput");
    const cadastralInput = document.getElementById("cadastralInput");
    const cadastralSearchBtn = document.getElementById("cadastralSearchBtn");
    const kmzInput = document.getElementById("kmzInput");
    const selectKmzBtn = document.getElementById("selectKmzBtn");

    function updateExportButtonsState() {
        const hasImage = !!(typeof imageLoaded !== "undefined" && imageLoaded);
        const hasLocation = !!(
            typeof selectedLocation !== "undefined" &&
            Number.isFinite(selectedLocation.lat) &&
            Number.isFinite(selectedLocation.lon)
        );

        if (downloadBtn) {
            downloadBtn.disabled = !(hasImage && hasLocation);
        }

        if (replaceOriginalBtn) {
            replaceOriginalBtn.disabled = !(hasImage && hasLocation);
        }
    }

    if (selectImage && imageInput) {
        selectImage.addEventListener("click", function () {
            imageInput.click();
        });

        imageInput.addEventListener("change", function () {
            const file = this.files[0];
            if (!file) return;
            if (typeof loadImage === "function") {
                loadImage(file);
            }
        });
    }

    document.querySelectorAll(".map-type-btn").forEach(function (button) {
        button.addEventListener("click", function () {
            const type = button.dataset.mapType;
            if (typeof changeMapType === "function") {
                changeMapType(type);
            }
        });
    });

    if (downloadBtn) {
        downloadBtn.addEventListener("click", function () {
            if (typeof downloadPhotoWithGPS === "function") {
                downloadPhotoWithGPS();
            }
        });
    }

    if (replaceOriginalBtn) {
        replaceOriginalBtn.addEventListener("click", function () {
            if (typeof replaceOriginalImageWithGPS === "function") {
                replaceOriginalImageWithGPS();
            }
        });
    }

    if (selectKmzBtn && kmzInput) {
        selectKmzBtn.addEventListener("click", function () {
            kmzInput.click();
        });

        kmzInput.addEventListener("change", function () {
            const file = this.files[0];
            if (!file) return;
            if (file.name.toLowerCase().endsWith(".kmz")) {
                loadKmzFile(file);
            } else {
                alert("Iltimos, .kmz faylini tanlang!");
            }
        });
    }

    if (cadastralSearchBtn && cadastralInput) {
        cadastralSearchBtn.addEventListener("click", function () {
            applyCadastralLocation(cadastralInput.value);
        });

        cadastralInput.addEventListener("keydown", function (event) {
            if (event.key === "Enter") {
                event.preventDefault();
                applyCadastralLocation(cadastralInput.value);
            }
        });
    }
    if (latitudeInput && longitudeInput) {
        latitudeInput.addEventListener("input", function () {
            if (Number.isFinite(Number(this.value))) {
                selectedLocation.lat = Number(this.value);
                updateExportButtonsState();
            }
        });

        longitudeInput.addEventListener("input", function () {
            if (Number.isFinite(Number(this.value))) {
                selectedLocation.lon = Number(this.value);
                updateExportButtonsState();
            }
        });
    }

    updateExportButtonsState();

    if (typeof loadDefaultKmz === "function") {
        loadDefaultKmz();
    }

    console.log("GeoStamp ready");
});
