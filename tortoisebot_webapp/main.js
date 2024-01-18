var app = new Vue({

    el: '#app',

    // storing the state of the page
    data: {
        connected: false,
        ros: null,
        logs: [],
        loading: false,
        rosbridge_address: 'wss://i-08066925b0d9f372e.robotigniteacademy.com/586ea8cc-6457-4b9b-a53f-79e5881356fd/rosbridge/',
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
        // 3D stuff
        viewer: null,
        tfClient: null,
        urdfClient: null,
        // Action 
        goal: null,
        action: {
            goal: { x: 0.0, y: 0.0},
            feedback: { position: '', state: ''},
            result: { result: null },
            status: { status: 0, text: '' },
        }

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

                // Setting the 3D viewer
                this.setup3DViewer()
                
                // Setting map
                this.mapViewer = new ROS2D.Viewer({
                    divID: 'map',
                    width: 350,
                    height: 250
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
                // close 3D viewer
                this.unset3DViewer()
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

        // Used for send command Home
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
                width: 350,
                height: 250,
                topic: '/camera/image_raw',
                ssl: true,              
            })
        },

        // 3D model viewer 
        setup3DViewer() {
            this.viewer = new ROS3D.Viewer({
                background: '#000033',
                divID: 'div3DViewer',
                width: 350,
                height: 250,
                antialias: true,
                fixedFrame: 'odom'
            })

            // Add a grid.
            this.viewer.addObject(new ROS3D.Grid({
                color:'#004080',
                cellSize: 0.5,
                num_cells: 20
            }))

            // Setup a client to listen to TFs.
            this.tfClient = new ROSLIB.TFClient({
                ros: this.ros,
                angularThres: 0.01,
                transThres: 0.01,
                rate: 10.0
            })

            // Setup the URDF client.
            this.urdfClient = new ROS3D.UrdfClient({
                ros: this.ros,
                param: 'robot_description',
                tfClient: this.tfClient,
                // We use "path: location.origin + location.pathname"
                // instead of "path: window.location.href" to remove query params,
                // otherwise the assets fail to load
                path: location.origin + location.pathname,
                rootObject: this.viewer.scene,
                loader: ROS3D.COLLADA_LOADER_2
            })
        },
        unset3DViewer() {
            document.getElementById('div3DViewer').innerHTML = ''
        },

        // Action Server stuff
        sendGoal: function() {
            let actionClient = new ROSLIB.ActionClient({
                ros : this.ros,
                serverName : '/tortoisebot_as',
                actionName : 'course_web_dev_ros/WaypointActionAction'
            })

            this.goal = new ROSLIB.Goal({
                actionClient : actionClient,
                goalMessage: {
                    position: this.action.goal
                }
            })

            this.goal.on('status', (status) => {
                this.action.status = status
            })

            this.goal.on('feedback', (feedback) => {
                this.action.feedback = feedback
            })

            this.goal.on('result', (result) => {
                this.action.result = result
            })

            this.goal.send()
        },
        cancelGoal: function() {
            this.goal.cancel()
        },

        // Buttons actions 
        waypoint1: function(){
            this.action.goal = { x: 0.60, y: -0.45}
            this.sendGoal()
        },
        waypoint2: function(){
            this.action.goal = { x: 0.70, y: -0.04}
            this.sendGoal()
        },
        waypoint3: function(){
            this.action.goal = { x: 0.64, y: 0.49}
            this.sendGoal()
        },
        waypoint4: function(){
            this.action.goal = { x: 0.25, y: 0.52}
            this.sendGoal()
        },
        waypoint5: function(){
            this.action.goal = { x: 0.18, y: 0.04}
            this.sendGoal()
        },
        waypoint6: function(){
            this.action.goal = { x: -0.16, y: -0.02}
            this.sendGoal()
        },
        waypoint7: function(){
            this.action.goal = { x: -0.28, y: 0.49}
            this.sendGoal()
        },
        waypoint8: function(){
            this.action.goal = { x: -0.71, y: 0.50}
            this.sendGoal()
        },
        waypoint9: function(){
            this.action.goal = { x: -0.18, y: -0.47}
            this.sendGoal()
        },
        waypoint10: function(){
            this.action.goal = { x: -0.56, y: -0.49}
            this.sendGoal()
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