document.addEventListener('DOMContentLoaded', function () {
    function showLoading(message) {
        var loadingElement = document.getElementById('loading');
        var loadingText = document.getElementById('loading-text');
        loadingText.textContent = message;
        loadingElement.style.display = 'flex'; // Muestra el contenedor de carga
    }
    
    function hideLoading() {
        document.getElementById('loading').style.display = 'none'; // Oculta el contenedor de carga
    }
    
    function toggleExportButton(enable) {
        var exportButton = document.getElementById('export-data');
        exportButton.disabled = !enable;
        exportButton.style.opacity = enable ? '1' : '0.5';
        exportButton.style.cursor = enable ? 'pointer' : 'not-allowed';
    }
    
    // Inicialización
    showLoading('Cargando el mapa y los datos, espere un momento...');

    var map = L.map('map').setView([-37.4702, -72.3521], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
    }).addTo(map);

    var defaultClusterOptions = {
        maxClusterRadius: 80 // Radio por defecto para clusters
    };

    var filteredClusterOptions = {
        maxClusterRadius: 30 // Radio para clusters al filtrar por comuna
    };

    var markers = L.markerClusterGroup(defaultClusterOptions); // Grupo de clusters con opciones por defecto
    var allData = [];
    var tableBody = document.querySelector('#table tbody');
    var isFilteringByComuna = false; // Variable para controlar si se filtra por comuna
    var markerMap = {}; // Mapa para almacenar los identificadores de los marcadores
    window.allData = allData; // Exponer allData globalmente

    // Inicializar la capa de polígonos
    var regionsLayer = L.geoJSON(null, {
        style: function () {
            return {
                color: 'blue', // Color de los bordes de los polígonos
                weight: 2,
                opacity: 0.6, // Opacidad de los bordes de los polígonos
                fillOpacity: 0.2 // Opacidad del relleno de los polígonos
            };
        }
    }).addTo(map);

    // Cargar el GeoJSON de regiones
    function loadRegions() {
        fetch('https://scastro2024.github.io/regiones/regiones.geojson')
            .then(response => response.json())
            .then(data => {
                regionsLayer.clearLayers(); // Limpiar la capa de regiones antes de agregar nuevas
                regionsLayer.addData(data); // Añadir los datos de regiones a la capa
            })
            .catch(error => {
                console.error('Error al cargar el GeoJSON de regiones:', error);
            });
    }

    // Llamar a la función para cargar el GeoJSON de regiones
    loadRegions();

    // Cargar el GeoJSON de locales comerciales
    fetch('https://scastro2024.github.io/IMPORTADORAMOTORS/LOCALES%20COMERCIALES.geojson')
        .then(response => response.json())
        .then(data => {
            allData = data.features;
            window.allData = allData; // Actualizar allData global
            updateMap(allData);
            populateFilters(data);
            updateTable(allData); // Cargar la tabla con los datos iniciales
            hideLoading(); // Ocultar carga después de inicializar
        })
        .catch(error => {
            console.error('Error al cargar el GeoJSON:', error);
            hideLoading();
        });

    function updateMap(features) {
        markers.clearLayers(); // Limpiar los clusters

        var newMarkers = L.geoJSON(features, {
            onEachFeature: function (feature, layer) {
                if (feature.properties && feature.properties.NOMBRE) {
                    // Crear enlaces de Google Maps y Apple Maps
                    var lat = feature.geometry.coordinates[1];
                    var lng = feature.geometry.coordinates[0];
                    var googleMapsLink = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                    var appleMapsLink = `https://maps.apple.com/?daddr=${lat},${lng}`;
                    
                    // Construir el contenido del popup
                    var popupContent = `
                        <strong>${feature.properties.NOMBRE}</strong><br>
                        <a href="${googleMapsLink}" target="_blank">Abrir en Google Maps</a><br>
                        <a href="${appleMapsLink}" target="_blank">Abrir en Apple Maps</a>
                    `;
                    
                    layer.bindPopup(popupContent);
                    markerMap[feature.properties.NOMBRE] = layer; // Mapear el nombre del local al marcador
                    layer.on('click', function () {
                        highlightRow(feature.properties.NOMBRE);
                    });
                }
            }
        });

        if (isFilteringByComuna) {
            map.eachLayer(function (layer) {
                if (layer instanceof L.GeoJSON) {
                    map.removeLayer(layer); // Eliminar cualquier capa de marcador individual
                }
            });
            map.addLayer(newMarkers); // Añadir los nuevos marcadores directamente
        } else {
            markers.addLayer(newMarkers);
            map.addLayer(markers);
        }

        if (features.length > 0) {
            var bounds = newMarkers.getBounds();
            map.flyToBounds(bounds, { duration: 1.5 });
        }

        document.getElementById('local-count').textContent = `N° Locales filtrados: ${features.length}`;
        hideLoading();
    }

    function populateFilters(data) {
        var regions = [...new Set(data.features.map(f => f.properties.REGION))].sort();
        var paises = [...new Set(data.features.map(f => f.properties.PAIS))].sort();
        var regionFilter = document.getElementById('region-filter');
        var paisFilter = document.getElementById('pais-filter');
        var comunaFilter = document.getElementById('comuna-filter');

        regions.forEach(region => {
            var option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            regionFilter.appendChild(option);
        });

        paises.forEach(pais => {
            var option = document.createElement('option');
            option.value = pais;
            option.textContent = pais;
            paisFilter.appendChild(option);
        });

        regionFilter.addEventListener('change', function () {
            showLoading('Aplicando filtro por región, espere un momento...');
            var selectedRegion = this.value;
            var filteredData = selectedRegion ? allData.filter(f => f.properties.REGION === selectedRegion) : allData;
            updateMap(filteredData);
            updateComunaFilter(filteredData);
            updatePaisFilter(filteredData, selectedRegion);

            // Habilitar o deshabilitar el filtro de país según la región seleccionada
            if (selectedRegion === 'REGION DE LOS LAGOS') {
                paisFilter.disabled = false;
            } else {
                paisFilter.disabled = true;
                paisFilter.value = ''; // Limpiar la selección del filtro de país
                updatePaisFilter(allData); // Actualizar las opciones del filtro de país
            }
            hideLoading();
        });

        comunaFilter.addEventListener('change', function () {
            showLoading('Aplicando filtro por comuna, espere un momento...');
            var selectedComuna = this.value;
            var filteredData = selectedComuna ? allData.filter(f => f.properties.COMUNA === selectedComuna) : allData;
            isFilteringByComuna = true; // Marcar que estamos filtrando por comuna
            toggleExportButton(true); // Habilitar el botón de exportar

            // Limpiar los marcadores individuales y añadir los filtrados sin clustering
            markers.clearLayers();
            var comunaMarkers = L.geoJSON(filteredData, {
                onEachFeature: function (feature, layer) {
                    if (feature.properties && feature.properties.NOMBRE) {
                        // Crear enlaces de Google Maps y Apple Maps
                        var lat = feature.geometry.coordinates[1];
                        var lng = feature.geometry.coordinates[0];
                        var googleMapsLink = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                        var appleMapsLink = `https://maps.apple.com/?daddr=${lat},${lng}`;
                        
                        // Construir el contenido del popup
                        var popupContent = `
                            <strong>${feature.properties.NOMBRE}</strong><br>
                            <a href="${googleMapsLink}" target="_blank">Abrir en Google Maps</a><br>
                            <a href="${appleMapsLink}" target="_blank">Abrir en Apple Maps</a>
                        `;
                        
                        layer.bindPopup(popupContent);
                        markerMap[feature.properties.NOMBRE] = layer; // Mapear el nombre del local al marcador
                        layer.on('click', function () {
                            highlightRow(feature.properties.NOMBRE);
                        });
                    }
                }
            });

            // Añadir los marcadores al mapa directamente
            map.addLayer(comunaMarkers);

            if (filteredData.length > 0) {
                var bounds = comunaMarkers.getBounds();
                map.fitBounds(bounds); // Ajustar el zoom a la comuna
            }

            document.getElementById('local-count').textContent = `N° Locales filtrados: ${filteredData.length}`;
            updateTable(filteredData); // Actualizar la tabla con los datos filtrados
            hideLoading();
        });

        paisFilter.addEventListener('change', function () {
            showLoading('Aplicando filtro por país, espere un momento...');
            var selectedPais = this.value;
            var filteredData = selectedPais ? allData.filter(f => f.properties.PAIS === selectedPais) : allData;
            isFilteringByComuna = false; // Desmarcar el filtro por comuna
            toggleExportButton(false); // Deshabilitar el botón de exportar
            updateMap(filteredData);
            updateRegionFilter(filteredData);
            updateComunaFilter(filteredData);
            hideLoading();
        });

        document.getElementById('clear-filters').addEventListener('click', function () {
            showLoading('Limpiando filtros, espere un momento...'); // Mostrar mensaje de carga
            setTimeout(() => {
                // Reiniciar los filtros
                regionFilter.value = '';
                comunaFilter.value = '';
                paisFilter.value = '';
                comunaFilter.disabled = true; // Deshabilitar el filtro de comuna
                paisFilter.disabled = true; // Deshabilitar el filtro de país

                // Limpiar los marcadores individuales y volver a añadirlos como clusters
                map.eachLayer(function (layer) {
                    if (layer instanceof L.GeoJSON && layer !== regionsLayer) {
                        map.removeLayer(layer); // Eliminar cualquier capa de marcador individual, pero no la capa de polígonos
                    }
                });

                markers.clearLayers(); // Limpiar el grupo de clusters
                var allMarkers = L.geoJSON(allData, {
                    onEachFeature: function (feature, layer) {
                        if (feature.properties && feature.properties.NOMBRE) {
                            // Crear enlaces de Google Maps y Apple Maps
                            var lat = feature.geometry.coordinates[1];
                            var lng = feature.geometry.coordinates[0];
                            var googleMapsLink = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
                            var appleMapsLink = `https://maps.apple.com/?daddr=${lat},${lng}`;
                            
                            // Construir el contenido del popup
                            var popupContent = `
                                <strong>${feature.properties.NOMBRE}</strong><br>
                                <a href="${googleMapsLink}" target="_blank">Abrir en Google Maps</a><br>
                                <a href="${appleMapsLink}" target="_blank">Abrir en Apple Maps</a>
                            `;
                            
                            layer.bindPopup(popupContent);
                            markerMap[feature.properties.NOMBRE] = layer; // Mapear el nombre del local al marcador
                            layer.on('click', function () {
                                highlightRow(feature.properties.NOMBRE);
                            });
                        }
                    }
                });
                markers.addLayer(allMarkers);
                map.addLayer(markers); // Añadir de nuevo los marcadores al grupo de clusters

                // Ajustar el zoom del mapa al estado original
                var bounds = L.geoJSON(allData).getBounds();
                map.fitBounds(bounds);

                // Reiniciar el conteo de locales filtrados
                document.getElementById('local-count').textContent = `N° Locales filtrados: ${allData.length}`;

                // Actualizar la tabla con todos los datos
                updateTable(allData);

                hideLoading(); // Ocultar el mensaje de carga
                isFilteringByComuna = false; // Asegurarse de que no se está filtrando por comuna
                toggleExportButton(false); // Deshabilitar el botón de exportar
            }, 0); // Asegura que la función se ejecute después de que el navegador haya mostrado el mensaje
        });

        // Inicialmente deshabilitar el filtro de comuna y país
        comunaFilter.disabled = true;
        paisFilter.disabled = true;
    }

    function updateTable(data) {
        // Limpiar la tabla existente
        tableBody.innerHTML = '';

        // Añadir nuevas filas a la tabla
        data.forEach(item => {
            var row = document.createElement('tr');
            row.innerHTML = `
                <td>${item.properties.NOMBRE || 'N/A'}</td>
                <td>${item.properties.DIRECCION || 'N/A'}</td>
                <td>${item.properties.GIRO || 'N/A'}</td>
            `;
            row.dataset.nombre = item.properties.NOMBRE; // Añadir un atributo para identificar la fila
            row.addEventListener('click', function () {
                highlightRow(item.properties.NOMBRE);
            });
            tableBody.appendChild(row);
        });
    }

    function highlightRow(name) {
        // Eliminar el resaltado de las filas previamente seleccionadas
        var rows = tableBody.querySelectorAll('tr');
        rows.forEach(row => {
            row.classList.remove('highlighted');
            if (markerMap[name] && markerMap[name].getPopup().getContent() === row.dataset.nombre) {
                row.classList.add('highlighted');
            }
        });

        // Ajustar el scroll de la tabla para que la fila seleccionada sea visible
        var highlightedRow = tableBody.querySelector('.highlighted');
        if (highlightedRow) {
            highlightedRow.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function updateRegionFilter(data) {
        var regions = [...new Set(data.map(f => f.properties.REGION))].sort();
        var regionFilter = document.getElementById('region-filter');
        var options = regionFilter.querySelectorAll('option:not(:first-child)');
        options.forEach(option => option.remove());

        regions.forEach(region => {
            var option = document.createElement('option');
            option.value = region;
            option.textContent = region;
            regionFilter.appendChild(option);
        });
    }

    function updateComunaFilter(data) {
        var comunas = [...new Set(data.map(f => f.properties.COMUNA))].sort();
        var comunaFilter = document.getElementById('comuna-filter');
        var options = comunaFilter.querySelectorAll('option:not(:first-child)');
        options.forEach(option => option.remove());

        comunas.forEach(comuna => {
            var option = document.createElement('option');
            option.value = comuna;
            option.textContent = comuna;
            comunaFilter.appendChild(option);
        });

        comunaFilter.disabled = comunas.length === 0; // Deshabilitar si no hay comunas
    }

    function updatePaisFilter(data, selectedRegion) {
        var paises = selectedRegion === 'REGION DE LOS LAGOS'
            ? [...new Set(data.map(f => f.properties.PAIS))].sort()
            : [];
        var paisFilter = document.getElementById('pais-filter');
        var options = paisFilter.querySelectorAll('option:not(:first-child)');
        options.forEach(option => option.remove());

        paises.forEach(pais => {
            var option = document.createElement('option');
            option.value = pais;
            option.textContent = pais;
            paisFilter.appendChild(option);
        });
    }

    document.getElementById('toggle-table').addEventListener('click', function () {
        var table = document.getElementById('table');
        var button = this;

        if (table.classList.contains('hidden')) {
            table.classList.remove('hidden');
            button.textContent = 'OCULTAR TABLA';
        } else {
            table.classList.add('hidden');
            button.textContent = 'MOSTRAR TABLA';
        }
    });

    document.getElementById('export-data').addEventListener('click', function () {
        if (isFilteringByComuna) {
            showLoading('Preparando la descarga de datos, espere un momento...');
            var filteredData = allData.filter(f => f.properties.COMUNA === document.getElementById('comuna-filter').value);
            var worksheet = XLSX.utils.json_to_sheet(filteredData.map(f => f.properties));
            var workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Datos Filtrados');
            XLSX.writeFile(workbook, 'datos_filtrados.xlsx');
            hideLoading();
        } else {
            alert('SEBE SELECCIONAR UNA COMUNA PARA EXPORTAR DATOS.');
        }
    });
});
