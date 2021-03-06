
const bingMapsApiKey = 'AnFPaMaxN1xpYPU07vmKY0Ejl89tpzRIVdXsfQc2i_0mgFCiscaVpVtZzeR1Uqvn';
const url = 'http://molamola.us:8081/geoserver/nypad/wms?';

var bingStyles = [
    'RoadOnDemand',
    'Aerial',
    'AerialWithLabelsOnDemand',
    'CanvasDark',
    'OrdnanceSurvey'
];

var selectionLayerChoice = 'protectedArea';
var container = document.getElementById('popup');
var content = document.getElementById('popup-content');
var popupCloser = document.getElementById('popup-closer');

var overlay = new ol.Overlay({
    element: container,
    autoPan: true,
    autoPanAnimation: {
      duration: 250
    }
});

var map = new ol.Map({
    controls: [
        new ol.control.OverviewMap(),
        new ol.control.ScaleLine(
            {
                className: 'ol-scale-line',
                target: document.getElementById('scale-line')
            })
    ], 
    target: 'map',
    layers: [
        new ol.layer.Group({
            'title': 'Base maps',
            layers: [
                new ol.layer.Tile({
                    title: 'Bing Aerial',
                    type: 'base',
                    combine: true,
                    visible: false,
                    preload: Infinity,
                    source: new ol.source.BingMaps({
                        key: bingMapsApiKey,
                        imagerySet: bingStyles[1    ]
                    })
                }),
                new ol.layer.Tile({
                    title: 'Open Street Map',
                    type: 'base',
                    visible: true,
                    source: new ol.source.OSM()
                })
            ],
        })
    ],
    overlays: [overlay],
    view: new ol.View({
        center: [-8420005, 5286797],
        zoom: 7
    })
});
// Add layer switcher control.
var layerSwitcher2 = new ol.control.LayerSwitcher();
map.addControl(layerSwitcher2)



// Create a blank vector layer to draw on.
var userEditsSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: function (extent) {
        return 'http://molamola.us:8081/geoserver/nypad/wfs?service=WFS&' +
            'version=1.1.0' +
            '&request=GetFeature' +
            '&typename=' + 'nypad:user_edits' +
            '&outputFormat=application/json' +
            '&srsname=EPSG:26918&,EPSG:26918';
    },
    strategy: ol.loadingstrategy.bbox,
});
var userEditsLayer = new ol.layer.Vector({
    source: userEditsSource,
    style: new ol.style.Style({
        fill: new ol.style.Fill({
            color: 'rgba(255, 255, 255, 0.2)'
        }),
        stroke: new ol.style.Stroke({
            color: '#0000FF',
            width: 0.5
        }),
        image: new ol.style.Circle({
            radius: 7,
            fill: new ol.style.Fill({
                color: '#ffcc33'
            })
        })
    }),
    geometryName: 'geometry'
});

var draw, snap; // global so we can remove them later

/**
 * Handle change event.
 */
var typeSelect = document.getElementById('type');
typeSelect.onchange = function () {
    map.removeInteraction(draw);
    map.removeInteraction(snap);
    addInteractions();
};

function addInteractions() {
    if (typeSelect.value === 'Navigate') {
        map.removeInteraction();
    }
    else if (typeSelect.value === 'Modify') {
        var selectFeat = new ol.interaction.Select();
        map.addInteraction(selectFeat);
        console.log('selected');
        var selectedFeat = selectFeat.getFeatures();
        console.log(selectedFeat);  
        // var modifyFeat = new ol.interaction.Modify({
        //     features: selectedFeat
        // });
        // map.addInteraction(modifyFeat);
    }
    else {
        draw = new ol.interaction.Draw({
            source: userEditsSource,
            type: typeSelect.value,
            geometryName: 'geometry'
        });
        map.addInteraction(draw);

        // Save drawn features to the database.
        draw.on('drawend', function(event) {
            // Convert OL feature object into WKT format.
            var format = new ol.format.WKT();
            const geometry = format.writeGeometry(event.feature.getGeometry());

            content.innerHTML = `
                <input type='text' size='40' id='user-edit-name' placeholder='Enter a name for this feature'></input>
                <textarea cols='40' rows='4' id='user-edit-description' placeholder='Enter a description'></textarea>
                <input type="hidden" id='user-edit-geometry' value="${geometry}">
                <div>
                    <input type='button' onclick='saveUserEdit();' value='Save'>
                    <input type='button' onclick='popupCloser.click()' value='Cancel'>
                </div>`;
            if (!overlay.getPosition()) {
                overlay.setPosition(event.feature.getGeometry().getLastCoordinate());
            }
        });

        // snap = new ol.interaction.Snap({ source: userEditsSource });
        // map.addInteraction(snap);
    }
}
addInteractions();

// Save user added feature.
const saveUserEdit = () => {

    const name = document.getElementById('user-edit-name').value;
    const description = document.getElementById('user-edit-description').value;
    const geometry = document.getElementById('user-edit-geometry').value;

    if (name) {
        $.ajax({
            method: 'POST',
            url: '/transaction',
            contentType: 'application/x-www-form-urlencoded',
            data: {
                action: 'insert',
                name: `${name}`,
                description: `${description}`,
                feature: geometry,
            }
        })
        .error((e) => {
            console.log('EEEEEEEEEE');
            console.log(e);
        })
        .done(function() {
            // Refresh the source. to show the DB served data.
            userEditsSource.clear();
        });
        popupCloser.click();
    }
}


// Load Counties Shoreline layer (WMS)
var countiesLayer = new ol.layer.Image({
    source: new ol.source.ImageWMS({
        url: url,
        params: {
            'LAYERS': 'nypad:counties_shoreline',
        },
        serverType: 'geoserver'
    })
})
countiesLayer.setOpacity(0.8);
// Load Counties Shoreline vector layer (WFS)
const countyStyle = new ol.style.Style({
    fill: new ol.style.Fill({
        color: 'rgba(255, 255, 255, 0)'
    }),
    stroke: new ol.style.Stroke({
        color: '#888888',
        width: 2,
        lineDash: [4, 4]
    })
})

// when we move the mouse over a feature, we can change its style to
// highlight it temporarily
var countyHighlightStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: [43, 200, 37],
        width: 1
    }),
    fill: new ol.style.Fill({
        color: [0, 255, 0, 0.25]
    }),
    text: new ol.style.Text({
        font: '12px Calibri,sans-serif',
        fill: new ol.style.Fill({
          color: '#000'
        }),
        stroke: new ol.style.Stroke({
          color: '#f00',
          width: 3
        })
    }),
    zIndex: 100
});

// Style for selected feature
var featureSelectedStyle = new ol.style.Style({
    stroke: new ol.style.Stroke({
        color: [53, 122, 47],
        width: 3
    }),
    fill: new ol.style.Fill({
        color: [200, 255, 200, 0.2]
    }),
    text: new ol.style.Text({
        font: '12px Calibri,sans-serif',
        fill: new ol.style.Fill({
          color: '#000'
        }),
        stroke: new ol.style.Stroke({
          color: '#f00',
          width: 3
        })
    }),
    zIndex: 100
});


var countyVectorSource = new ol.source.Vector({
    format: new ol.format.GeoJSON(),
    url: function (extent) {
        return 'http://molamola.us:8081/geoserver/nypad/wfs?service=WFS&' +
            'version=1.1.0' +
            '&request=GetFeature' +
            '&typename=' + 'nypad:counties_shoreline' +
            '&outputFormat=application/json' +
            '&maxFeatures=100' +
            '&srsname=EPSG:3857&,EPSG:3857';
    },
    style: function(feature) {
        // if (selectionLayerChoice === 'county') {
        //     countyHighlightStyle.getText().setText(feature.get('name'));
        //     return countyHighlightStyle;
        // }
        // else {
        //     return null;
        // }
    },
    strategy: ol.loadingstrategy.bbox,
});

var countyVectorLayer = new ol.layer.Vector({
    source: countyVectorSource,
    style: countyStyle
})

countyVectorLayer.setSource(countyVectorSource);

function changeSelectionLayer(layer) {
    selectionLayerChoice = layer;
    // Clear selected feature overlay.
    vectorLayer.setSource();
    // Close info box.
    closer.click();
    // Remove drawing interactions.
    map.removeInteraction(draw);
    map.removeInteraction(snap);
    // Switch back to Navigate mode.
    typeSelect.value = 'Navigate';
}

var townsLayer = new ol.layer.Image({
    source: new ol.source.ImageWMS({
        url: url,
        params: {
            'LAYERS': 'nypad:cities_towns',
            'CQL_FILTER': cqlFilter || null,
        },
        serverType: 'geoserver'
    })
})
townsLayer.setOpacity(1);

var cqlFilter = '';
var nypadLayer = new ol.layer.Image({
    source: new ol.source.ImageWMS({
        url: url,
        params: {
            'LAYERS': 'nypad:nypad_2017',
            'CQL_FILTER': cqlFilter || null,
            'STYLES': 'nypad_gap_codes'
        },
        serverType: 'geoserver'
    })
})
nypadLayer.setOpacity(0.8);


var vectorSource = new ol.source.Vector({});
var vectorLayer = new ol.layer.Vector({
    source: null
});


// vectorLayer.events.register('loadend', vectorLayer, function(evt) {
//     map.zoomToExtent(vectorLayer.getDataExtent())
// });

map.addLayer(nypadLayer);
map.addLayer(townsLayer);
map.addLayer(countiesLayer);
map.addLayer(countyVectorLayer);
map.addLayer(userEditsLayer);
map.addLayer(vectorLayer);

var selected = null;
map.on('pointermove', function(e) {
    if (selected !== null) {
        selected.setStyle(undefined);
        selected = null;
      }
    
    map.forEachFeatureAtPixel(e.pixel, function(f) {
        if (selectionLayerChoice === 'county') {
            selected = f;
            f.setStyle(countyHighlightStyle);
            return true;
        }
        else {
            return false;
        }
    });
});

/**
 * Handle click events on the map
 * 
 * Zoom to clicked area if it is a feature.
 * Request feature as WFS to highlight.
 */
map.on('singleclick', function (evt) {

    var view = map.getView();
    var features = [];
    map.forEachFeatureAtPixel(evt.pixel, function(feature, layer) {
        features.push(feature);
    });
    if (features.length > 0 && features[0].get('type') === 'user_edit') {
        const {
            name,
            description,
        } = features[0].getProperties();

        content.innerHTML = `
            <div>${name}</div>
            <div>${description}</div>
            <div>
                <input type='button' onclick='popupCloser.click()' value='Close'>
            </div>`;
        if (!overlay.getPosition()) {
            overlay.setPosition(evt.coordinate);
        }

    }
    else {
        // Pick the feature layer to select
        let layerUrl = '';
        let selectLayer = '';
        let cqlFilter = '';
        let layerName = '';
        selectionLayerChoice = document.getElementsByName('selection-layer-filter');
        for (let i = 0; i < selectionLayerChoice.length; i++) { 
            if (selectionLayerChoice[i].checked) {
                selectLayer = selectionLayerChoice[i].value;
            }
        }
        switch (selectLayer) {
            case 'county':
                layerUrl = countiesLayer.getSource().getGetFeatureInfoUrl(
                    evt.coordinate, view.getResolution(), view.getProjection(),
                    { 'INFO_FORMAT': 'application/json', 'FEATURE_COUNT': 50 });
                break;
            case 'protectedArea':
            default:
                layerUrl = nypadLayer.getSource().getGetFeatureInfoUrl(
                    evt.coordinate, view.getResolution(), view.getProjection(),
                    { 'INFO_FORMAT': 'application/json', 'FEATURE_COUNT': 50 });
                break;
        }

        // Get feature information for clicked WMS layer.
        if (layerUrl) {
            fetch(layerUrl)
                .then((response) => {
                    return response.text();
                })
                .then((text) => {
                    var feature = JSON.parse(text)
                    if (feature && feature.features.length) {
                        // Set WMS request parameters for the chosen layer type.
                        if (selectLayer === 'protectedArea') {
                            cqlFilter = 'nypad_id = \'' + feature.features[0].properties.nypad_id + '\'';
                            layerName = 'nypad:nypad_2017';
                            populateInfoWindow(selectLayer, feature);
                        }
                        else {
                            cqlFilter = 'abbreviation = \'' + feature.features[0].properties.abbreviation + '\'';
                            layerName = 'nypad:counties_shoreline';
                            fetch(`/county_data?q=${feature.features[0].properties.abbreviation}`)
                                .then((response) => {
                                    return response.text();
                                })
                                .then((data) => {
                                    populateInfoWindow(selectLayer, JSON.parse(data));
                                });
                        }

                        // Load selected feature as a vector.
                        let featureUrl = 'http://molamola.us:8081/geoserver/nypad/wfs?service=WFS&' +
                            'version=1.1.0' +
                            '&request=GetFeature' +
                            '&typename=' + layerName +
                            '&CQL_FILTER=' + cqlFilter +
                            '&outputFormat=application/json' +
                            '&maxFeatures=50' +
                            '&srsname=EPSG:3857&,EPSG:3857';

                        // Retrieve feature vector and add to layer above raster
                        vectorSource = new ol.source.Vector({
                            format: new ol.format.GeoJSON(),
                            loader: function(extent, resolution, projection) {
                                var proj = projection.getCode();
                                var url = featureUrl
                                var xhr = new XMLHttpRequest();
                                xhr.open('GET', url);
                                var onError = function() {
                                    vectorSource.removeLoadedExtent(extent);
                                }
                                xhr.onerror = onError;
                                xhr.onload = function() {
                                    if (xhr.status == 200) {
                                        vectorSource.addFeatures(
                                        vectorSource.getFormat().readFeatures(xhr.responseText));
                                    } else {
                                        onError();
                                    }
                                }
                                xhr.send();
                            },
                            strategy: ol.loadingstrategy.bbox,
                        })
                        vectorLayer.setSource(vectorSource);
                        vectorLayer.setStyle(featureSelectedStyle);

                        // Zoom to loaded feature
                        // vectorSource.once('change', (event) => {
                        //     map.getView().fit(vectorLayer.getSource().getExtent(), (map.getSize()));
                        // })

                        // Zoom in to a reasonable level, but do not zoom out if the user has already zoomed in manually.
                        if (typeSelect.value === 'Navigate' && selectLayer !== 'county') {
                            view.animate({
                                center: evt.coordinate,
                                duration: 1000,
                                zoom: map.getView().getZoom() > 7 ? map.getView().getZoom() : 10
                            })
                        }
                    }
                });
        }
    }

});

// List features on user drawing layer
function listFeatures() {
    // console.log(vectorSource.getFeatures());
    var writer = new ol.format.GeoJSON();
    var geojsonStr = writer.writeFeatures(vectorSource.getFeatures());
    console.log(geojsonStr);
}

// Populate info window
function populateInfoWindow(layer, data) {
    document.getElementById('infowindow').style.display = 'unset';
    let html = '';
    if (layer === 'protectedArea') {
        const {
            loc_mang,
            loc_nm,
            loc_own,
            gap_sts,
            nypad_id,
            gis_acres
        } = data.features[0].properties;
        document.getElementById('infowindow-title').innerHTML = `${loc_nm}`;
        html = `<div class='attr-table'><div>Owner: ${loc_own}</div>
        <div>Agency: ${loc_mang}</div>
        <div>GAP Status: ${gap_sts}</div>
        <div>NYPAD ID: ${nypad_id}</div>    
        <div>Acres: ${formatNumber(gis_acres)}</div></div>`
    }
    else {
        const { total, gap_status } = data;
        const percent = 100 * (total.pa_acres / total.county_acres);
        document.getElementById('infowindow-title').innerHTML = `${total.name} County`;
        html = `<div class='attr-table'>
            <div># Protected areas: ${total.pa_count}</div>
            <div>Protected acreage: ${formatNumber(total.pa_acres)}</div>
            <div>Avg. PA acreage: ${formatNumber(total.pa_mean)}</div>
            <div>County acreage: ${formatNumber(total.county_acres)}</div>
            <div>County Protected area: ${parseInt(percent)}%</div>
            <div class="gap-status-head">GAP Status Statistics</div>`;
        gap_status.forEach((data) => {
            html += `<div>GAP ${data.gap_sts}</div>
            <div>Total features: ${formatNumber(data.total)}</div>
            <div>Total acreage: ${formatNumber(data.acres)}</div>
        `;
        });
        html += '</div>';
    }
    document.getElementById('infowindow-content').innerHTML = html;
}

// Feature Popup


popupCloser.onclick = function() {
    overlay.setPosition(undefined);
    closer.blur();
    return false;
};


// Area search function
function searchByArea(reset) {
    let acres = '';
    let operator = '';
    const compare = document.getElementsByName('area-search-filter'); 

    for (let i = 0; i < compare.length; i++) { 
        if (compare[i].checked) 
            operator = compare[i].value;
    }
    acres = document.getElementById('by_area').value;

    if (reset) {
        cqlFilter = (parseInt(acres, 10)) ? `gis_acres ${operator} ${acres}` : null;
    }
    else {
        document.getElementById('by_area').value = '';
        cqlFilter = null;
    }
    nypadLayer.getSource().updateParams({
        'LAYERS': 'nypad:nypad_2017',
        'CQL_FILTER': cqlFilter
    });
}

// GAP status filter function
function searchByGapStatus(status) {
    cqlFilter = status ? `gap_sts = '${status}'` : null;
    nypadLayer.getSource().updateParams({
        'LAYERS': 'nypad:nypad_2017',
        'CQL_FILTER': cqlFilter
    });
}

// Local name search function
function getLocalNameSearchResults(name) {
    cqlFilter = name ? `loc_nm = '${name}'` : null;
    nypadLayer.getSource().updateParams({
        'LAYERS': 'nypad:nypad_2017',
        'CQL_FILTER': cqlFilter
    });
}

// Style filter change event funtion
function changeLayerStyle(style) {
    nypadLayer.getSource().updateParams({
        'STYLES': style
    })
    document.getElementById('legend').src = `${url}Service=WMS&REQUEST=GetLegendGraphic&VERSION=1.0.0&FORMAT=image/png&WIDTH=50&HEIGHT=40&LAYER=nypad_postres:nypad_2017&STYLE=${style}&LEGEND_OPTIONS=countMatched:true`

}

// CQL Filter
function searchByCQLFilter() {
    console.log(document.getElementById('cql-filter-query').value);
    const query = document.getElementById('cql-filter-query').value;
    cqlFilter = query ? query : null;
    nypadLayer.getSource().updateParams({
        'LAYERS': 'nypad:nypad_2017',
        'CQL_FILTER': cqlFilter
    });
}
// DWITHIN(wkb_geometry, collectGeometries(queryCollection('nypad:nypad_2017','wkb_geometry','nypad_id = ''NYPAD-40507''')), 5000, meters)
// Close info window
var closer = document.getElementById('infowindow-closer');
closer.onclick = function() {
    document.getElementById('infowindow').style.display = 'none';
}


// Initialize jQuery UI plugins on page load.
$(document).ready(function() {
    // Initialize search select field for autocomplete.
    $('#local-name').select2({
        ajax: {
            url: '/autocomplete',
            dataType: 'json',
            data: function (params) {
                var query = {
                    q: params.term,
                }
                return query;
            }
        }
    });
    // jQuery Accordion control for the menu bar.
    $( "#accordion" ).accordion({
        heightStyle: "content"
    });

});

// Create infowindow container



function formatNumber(num) {
    if (typeof num  === 'undefined') return 'N/A';

    return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}


//// WIP: Feature drawing and saving code.
// draw.on('drawend', function(event) {
//     console.log(event.feature);
//     var writer = new ol.format.GeoJSON();
//     var geojsonStr = writer.writeFeatures(source.getFeatures());
//     console.log(JSON.parse(geojsonStr));
//     transactWFS('insert', event.feature);
// });

// var formatWFS = new ol.format.WFS();

// var formatGML = new ol.format.GML({
//     featureNS: 'http://molamola.us:8081/geoserver/nypad',
//     featureType: 'user_edits',
//     geometryName: "geometry",
//     srsName: 'EPSG:3857'    
// });
// var xs = new XMLSerializer();
// function transactWFS(mode, f) {
//     console.log(`transactWFS() = ${mode}`);
//     var node;
//         switch (mode) {
//             case 'insert':
//                 node = formatWFS.writeTransaction([f], null, null, formatGML);
//                 break;
//             case 'update':
//                 node = formatWFS.writeTransaction(null, [f], null, formatGML);
//                 break;
//             case 'delete':
//                 node = formatWFS.writeTransaction(null, null, [f], formatGML);
//                 break;
//         }
//         console.log(node);
//         var payload = xs.serializeToString(node);
//         console.log(payload);
//         $.ajax('http://molamola.us:8081/geoserver/wfs', {
//             service: 'WFS',
//             type: 'POST',
//             dataType: 'xml',
//             processData: false,
//             contentType: 'text/xml',
//             version: '1.1.0',
//             data: payload
//         })
//         .error((e) => {
//             console.log(e);
//         })
//         .done(function() {
//             // Refreshing the layer.
//             console.log('Reload userEditsSource');
//             userEditsSource.clear();
//         });
// }

//// WIP: Vector feature buffer tool
// var vectorSource = new ol.source.Vector({
// fetch('' +
//     'version=1.1.0' +
//     '&request=GetFeature' +
//     '&typename=nypad:nypad_2017&' +
//     'CQL_FILTER=' + cqlfilter + '&' +
//     'outputFormat=application/json&' +
//     'maxFeatures=50&' +
//     'srsname=EPSG:3857&,EPSG:3857')
//     .then((response) => {
//         return response.json()
//     })
//     .then((json) => {
//         var format = new ol.format.GeoJSON();
//         var features = format.readFeatures(json, {featureProjection: 'EPSG:3857'});
//         console.log(json);
//         var parser = new jsts.io.OL3Parser();
//         parser.inject(new ol.geom.Polygon());
//         for (var i = 0; i < features.length; i++) {
//             var feature = features[i];
//             // convert the OpenLayers geometry to a JSTS geometry
//             console.log(feature.getGeometry());
//             var jstsGeom = parser.read(feature.getGeometry());
//         console.log(jstsGeom);
//             // // create a buffer of 40 meters around each line
//             // var buffered = jstsGeom.buffer(40);
        
//             // // convert back from JSTS and replace the geometry on the feature
//             // feature.setGeometry(parser.write(buffered));
//         }
//         vectorSource.addFeatures(features);

//     })


// // Load Cities and Towns vector layer (WFS)
// const citiesStyle = new ol.style.Style({
//     fill: new ol.style.Fill({
//         color: 'rgba(255, 255, 255, 0)'
//     }),
//     stroke: new ol.style.Stroke({
//         color: '#FF8888',
//         width: 2,
//         // lineDash: [4, 4]
//     })
// })
// var citiesVectorSource = new ol.source.Vector({
//     format: new ol.format.GeoJSON(),
//     url: function (extent) {
//         return 'http://molamola.us:8081/geoserver/nypad/wfs?service=WFS&' +
//             'version=1.1.0' +
//             '&request=GetFeature' +
//             '&typename=' + 'nypad:cities_towns' +
//             '&outputFormat=application/json' +
//             // '&maxFeatures=100' +
//             '&srsname=EPSG:3857&,EPSG:3857';
//     },
//     style: function(feature) {
//     },
//     strategy: ol.loadingstrategy.bbox,
// });
// var citiesVectorLayer = new ol.layer.Vector({
//     source: citiesVectorSource,
//     style: citiesStyle
// })
// // citiesVectorLayer.setSource(citiesVectorSource);
// citiesVectorLayer.setOpacity(0.8);

