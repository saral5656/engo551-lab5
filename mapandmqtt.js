
    // Initialize Leaflet Map
    var L = window.L;
    var map = L.map('map').setView([51.0447, -114.0719], 11);
    var client;
    var markers = [];
    var reconnectTimeout = 3000; // 3 seconds delay before attempting to reconnect

    // Add OpenStreetMap Tile Layer to Map
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);

    // MQTT Topic and Client ID
    var topic = 'ENGO551/SARA/MY_TEMPERATURE';
    var clientId = "client_" + Math.random().toString(36).substr(2, 9);

    // Function to start MQTT Connection (Need to change)
    function startConnection() {
        // Hide Connection Info and Show Button Container
        document.getElementById("connectionInfo").style.display = "none";
        document.getElementById("buttonContainer").style.display = "flex";

        // Generate Random Client ID
        clientId = "client_" + Math.random().toString(36).substr(2, 9);
        console.log("clientId:", clientId);

        // MQTT Broker Host and Port https://www.emqx.com/en/mqtt/public-mqtt5-broker
        var host = "broker.emqx.io";
        var port = 8084;

        // MQTT Broker URL
        var brokerUrl = "wss://" + host + ":" + port + "/mqtt";

        // Create MQTT Client
        client = new Paho.MQTT.Client(brokerUrl, clientId);

        // MQTT Connect
        var connectOptions = {
            onSuccess: function () {
                console.log('Connected to MQTT broker');

                // Enable Start Sending Location and End Connection Buttons and subscribe to MQTT Topic
                document.getElementById("startSendingLocationButton").disabled = false;
                document.getElementById("endConnectionButton").disabled = false;
                subscribeToTopic();
            },
            onFailure: function (error) {
                console.error('MQTT connection error:', error.errorMessage);
                client.connect(options);
            }
        };

    // Function to handle MQTT connection loss
    function onConnectionLost(response) {
    console.log("Connection lost:", response.errorMessage);
    document.getElementById("status_messages").innerHTML = "Connection Lost: " + response.errorMessage;
    
    // Try to reconnect after a delay
    setTimeout(MQTTconnect, reconnectTimeout);
}


        // Connect to MQTT Broker
        client.connect(connectOptions);
    }

    // Function to end MQTT Connection
    function endConnection() {
        try {
            client.disconnect();
        } catch (error) {
            console.error('Error disconnecting from MQTT broker:', error);
        } finally {
            document.getElementById("connectionInfo").style.display = "block";
            document.getElementById("buttonContainer").style.display = "none";
            clearMarkers();

            document.getElementById("startConnectionButton").disabled = false;
            document.getElementById("startSendingLocationButton").disabled = true;
            document.getElementById("stopSendingLocationButton").disabled = true;
            document.getElementById("endConnectionButton").disabled = true;
        }
    }
    // Function to start sending location
    function startSendingLocation() {
        getLocation();
        document.getElementById("startSendingLocationButton").disabled = true;
        document.getElementById("stopSendingLocationButton").disabled = false;
    }

    // Function to stop sending location
    function stopSendingLocation() {
        clearInterval();
        document.getElementById("startSendingLocationButton").disabled = false;
        document.getElementById("stopSendingLocationButton").disabled = true;
    }
    // Function to get current location
    function getLocation() {
        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(updateMapLocation);
        } else {
            alert('Geolocation is not supported by this browser.');
        }
    }

    // Function to update map location
    function updateMapLocation(position) {
        if (!client) {
            console.error('Client is not defined.');
            return;
        }

        //get position from device and random temperature
        var latitude = position.coords.latitude;
        var longitude = position.coords.longitude;
        var timestamp = new Date().toISOString();
        var temperature = getRandomTemperature(-40, 40);

        //set view on map
        map.setView([latitude, longitude], 15);

        //define point 
        var geoJsonMessage = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [longitude, latitude]
            },
            properties: {
                temperature: temperature,
                timestamp: timestamp
            }
        };

        //send and publish message to server
        var messageObject = new Paho.MQTT.Message(JSON.stringify(geoJsonMessage));
        messageObject.destinationName = topic;
        client.send(messageObject);
        console.log(`Message published to topic ${topic}:`, JSON.stringify(geoJsonMessage));
        
        // add marker to map
        var marker = L.marker([latitude, longitude])
            .bindPopup(`Temperature: ${temperature}°C<br>Coordinates: ${latitude}, ${longitude}<br>Timestamp: ${timestamp}`)
            .addTo(map);

        markers.push(marker);

        // Stop sending locations after one message
        stopSendingLocation();
    }

    //Function to subscribe to MQTT topic
    function subscribeToTopic() {
        client.subscribe(topic);
        console.log('Subscribed to topic:', topic);

        client.onMessageArrived = function (message) {
            var payload = message.payloadString;
            console.log('Message received:', payload);

            try {
                var geoJsonMessage = JSON.parse(payload);

                if (geoJsonMessage.type === "Feature" && geoJsonMessage.geometry && geoJsonMessage.geometry.type === "Point") {
                    
                    var timestamp = geoJsonMessage.properties.timestamp;
                    var coordinates = geoJsonMessage.geometry.coordinates;
                    var temperature = geoJsonMessage.properties.temperature;
                    
                    var marker = L.marker([coordinates[1], coordinates[0]])
                    .bindPopup(`Date: ${timestamp.substring(0, 10)}<br>
                        Time: ${timestamp.substring(11, 19)}<br>
                        Coordinates: ${coordinates[1]}, ${coordinates[0]}<br>
                        Temperature: ${temperature}°C`)

                        .addTo(map);

                    markers.push(marker);
                }
            } catch (error) {
                console.error('Error parsing GeoJSON message:', error);
            }
        };
    }

    // Function to clear map markers
    function clearMarkers() {
        for (var i = 0; i < markers.length; i++) {
            map.removeLayer(markers[i]);
        }
        markers = [];
    }

    // Function to get random temperature
    function getRandomTemperature(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    // Event listeners for map resize
    map.on('resize', function() {
        map.invalidateSize();
    });

    // Event listeners for button clicks
    map.on('click', function(e) {
        map.closePopup();
    });

// Function to show the topic selection modal
function showTopicSelection() {
    var modal = document.getElementById("topicModal");
    modal.style.display = "block";
}

// Function to close the topic selection modal
function closeTopicModal() {
    var modal = document.getElementById("topicModal");
    modal.style.display = "none";
}

// Function to publish message to selected topic
function publishMessage() {
    // Get the selected topic from the dropdown menu
    var topicSelect = document.getElementById("topicSelect");
    var selectedTopic = topicSelect.options[topicSelect.selectedIndex].value;

    var message = prompt("Enter the message to publish:");

    if (selectedTopic && message) {
        var messageObject = new Paho.MQTT.Message(message);
        messageObject.destinationName = selectedTopic;
        client.send(messageObject);
        console.log(`Message published to topic ${selectedTopic}: ${message}`);
        closeTopicModal(); // Close the modal after publishing
    } else {
        console.error("Invalid topic or message.");
    }
}

    document.getElementById("startConnectionButton").addEventListener("click", startConnection);
    document.getElementById("startSendingLocationButton").addEventListener("click", startSendingLocation);
    document.getElementById("stopSendingLocationButton").addEventListener("click", stopSendingLocation);
    document.getElementById("endConnectionButton").addEventListener("click", endConnection);
    