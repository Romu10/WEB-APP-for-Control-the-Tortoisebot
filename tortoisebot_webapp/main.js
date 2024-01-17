var app = new Vue({

    el: '#app',

    // storing the state of the page
    data: {
        connected: false,
        ros: null,
        logs: [],
        loading: false,
        rosbridge_address: 'wss://i-016ab264be577d6bf.robotigniteacademy.com/65624ca6-92e5-402c-a347-1f183dcfb868/rosbridge/',
        port: '9090',

        // dragging data
        dragging: false,
        x: 'no',
        y: 'no',
        dragCircleStyle: {
            margin: '0px',
            top: '0px',
            left: '0px',
            display: 'none',
            width: '75px',
            height: '75px',
        },
        // joystick valules
        joystick: {
            vertical: 0,
            horizontal: 0,
        },
        // publisher
        pubInterval: null,
        // map
        mapViewer: null,
        mapGridClient: null,
        interval: null,

    },

    // helper methods to connect to ROS

    methods: {

        connect: function() {
            this.loading = true

            this.ros = new ROSLIB.Ros({
                url: this.rosbridge_address
            })

            this.ros.on('connection', () => {
                this.logs.unshift((new Date()).toTimeString() + ' - Connected!')
                this.connected = true
                this.loading = false
                
                // Interval for const topic publish with joint
                this.pubInterval = setInterval(this.publish, 100)
                
                // Setting up the robot camera
                this.setCamera()
                
                // Setting map
                this.mapViewer = new ROS2D.Viewer({
                    divID: 'map',
                    width: 420,
                    height: 360
                })

                // Setup the map client.
                this.mapGridClient = new ROS2D.OccupancyGridClient({
                    ros: this.ros,
                    rootObject: this.mapViewer.scene,
                    continuous: true,
                })
                // Scale the canvas to fit to the map
                this.mapGridClient.on('change', () => {
                    // Especifica el factor de escala adicional
                    const scaleFactor = 0.15; // Puedes ajustar este valor según tus necesidades

                    // Ajusta la escala del mapa multiplicando por el factor de escala
                    const newWidth = this.mapGridClient.currentGrid.width * scaleFactor;
                    const newHeight = this.mapGridClient.currentGrid.height * scaleFactor;
                    this.mapViewer.scaleToDimensions(newWidth, newHeight);

                    // Calcula el desplazamiento necesario para centrar el mapa
                    const offsetX = (newWidth - this.mapGridClient.currentGrid.width) / 1.9;
                    const offsetY = (newHeight - this.mapGridClient.currentGrid.height) / 1.9;

                    // Ajusta la posición del mapa
                    const newX = this.mapGridClient.currentGrid.pose.position.x - offsetX;
                    const newY = this.mapGridClient.currentGrid.pose.position.y - offsetY;
                    this.mapViewer.shift(newX, newY);
                });
            })

            this.ros.on('error', (error) => {
                this.logs.unshift((new Date()).toTimeString() + ` - Error: ${error}`)
            })

            this.ros.on('close', () => {
                this.logs.unshift((new Date()).toTimeString() + ' - Disconnected!')
                this.connected = false
                this.loading = false
                // Clean the interval variable
                clearInterval(this.pubInterval)
                // Clean the camera
                document.getElementById('divCamera').innerHTML = ''
                // close map
                document.getElementById('map').innerHTML = ''
            })
        },

        disconnect: function() {
            this.ros.close()
        },

        // Used for publish the joint values
        publish: function() {
            let topic = new ROSLIB.Topic({
                ros: this.ros,
                name: '/cmd_vel',
                messageType: 'geometry_msgs/Twist'
            })
            let message = new ROSLIB.Message({
                linear: { x: this.joystick.vertical, y: 0, z: 0, },
                angular: { x: 0, y: 0, z: this.joystick.horizontal, },
            })
            topic.publish(message)
        },

        // Used for send command with a button
        sendCommand: function() {
            let topic = new ROSLIB.Topic({
                ros: this.ros,
                name: '/cmd_vel',
                messageType: 'geometry_msgs/Twist'
            })
            let message = new ROSLIB.Message({
                linear: { x: 1, y: 0, z: 0, },
                angular: { x: 0, y: 0, z: 0.5, },
            })
            topic.publish(message)
        },

        // Used for starting dragging in the joint
        startDrag() {
            this.dragging = true
            this.x = this.y = 0
        },

        // Used for stop dragging in the joint
        stopDrag() {
            this.dragging = false
            this.x = this.y = 'no'
            this.dragCircleStyle.display = 'none'
            this.resetJoystickVals()
        },

        // Used for do dragging in the joint
        doDrag(event) {
            if (this.dragging) {
                this.x = event.offsetX
                this.y = event.offsetY
                let ref = document.getElementById('dragstartzone')
                this.dragCircleStyle.display = 'inline-block'

                let minTop = ref.offsetTop - parseInt(this.dragCircleStyle.height) / 2
                let maxTop = minTop + 200
                let top = this.y + minTop
                this.dragCircleStyle.top = `${top}px`

                let minLeft = ref.offsetLeft - parseInt(this.dragCircleStyle.width) / 2
                let maxLeft = minLeft + 200
                let left = this.x + minLeft
                this.dragCircleStyle.left = `${left}px`

                this.setJoystickVals()
            }
        },

        // Used for calculate the joint values
        setJoystickVals() {
            this.joystick.vertical = -1 * ((this.y / 200) - 0.5)
            this.joystick.horizontal = -1 * ((this.x / 200) - 0.5)
        },

        // Used for reset the joints
        resetJoystickVals() {
            this.joystick.vertical = 0
            this.joystick.horizontal = 0
        },

        // Connector to the web_video_server
        setCamera: function() {
            let without_wss = this.rosbridge_address.split('wss://')[1]
            console.log(without_wss)
            let domain = without_wss.split('/')[0] + '/' + without_wss.split('/')[1]
            console.log(domain)
            let host = domain 
            let viewer = new MJPEGCANVAS.Viewer({
                divID: 'divCamera',
                host: host,
                width: 320,
                height: 240,
                topic: '/camera/image_raw',
                ssl: true,              
            })
        },

    },

    mounted() {
        // page is ready
        window.addEventListener('mouseup', this.stopDrag)

        // map communication interval
        this.interval = setInterval(() => {
        if (this.ros != null && this.ros.isConnected) {
            this.ros.getNodes((data) => { }, (error) => { })
        }
    }, 10000)
    },

})