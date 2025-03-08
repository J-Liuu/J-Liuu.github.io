let canvasSize = 850;
let p5Canvas;
let autoRotate = true;
let autoRotateSpeed = 0.2;
let rotX = 80;
let rotY = 0;

function setup() {
    // Create the canvas with responsive sizing
    const containerWidth = document.getElementById('p5-container').offsetWidth;
    const containerHeight = document.getElementById('p5-container').offsetHeight;
    
    // Determine the canvas size based on the container
    canvasSize = Math.min(containerWidth, containerHeight);
    
    p5Canvas = createCanvas(canvasSize, canvasSize, WEBGL);
    p5Canvas.parent('p5-container');
    
    // Set up the visual style
    colorMode(HSB, 360, 100, 100);
    angleMode(DEGREES);
    stroke(71, 26, 92);
    strokeWeight(2);
    
    // Add event listener for window resize
    window.addEventListener('resize', windowResized);
}

function windowResized() {
    // Update canvas size when window is resized
    const containerWidth = document.getElementById('p5-container').offsetWidth;
    const containerHeight = document.getElementById('p5-container').offsetHeight;
    
    canvasSize = Math.min(containerWidth, containerHeight);
    resizeCanvas(canvasSize, canvasSize);
}

function draw() {
    // Clear the background
    background(225, 10, 10);
    
    // Add ambient light to improve visibility
    ambientLight(100, 100, 100);
    
    // Auto-rotate or use mouse control
    if (autoRotate) {
        rotY += autoRotateSpeed;
    } else {
        // Use orbit control for interaction
        orbitControl(4, 4);
    }
    
    // Set the camera angle
    rotateX(rotX);
    rotateY(rotY);
    
    // Scale the flower based on canvas size
    const scaleFactor = canvasSize / 850;
    scale(scaleFactor);
    
    // Draw the flower
    drawFlower();
}

function drawFlower() {
    beginShape(POINTS);
    
    // Flower generation parameters
    const thetaMax = 60;
    const phiStep = 1.5;
    
    // Create the flower shape
    for (let theta = 0; theta < thetaMax; theta += 1) {
        for (let phi = 0; phi < 360; phi += phiStep) {
            // Calculate the base radius using polar coordinates
            let r = (70 * pow(abs(sin(phi * 5/2)), 1) + 225) * theta/thetaMax;
            
            // Convert to Cartesian coordinates
            let x = r * cos(phi);
            let y = r * sin(phi);
            
            // Calculate Z value (height) using the custom functions
            let z = vShape(300, r/100, 0.8, 0.15, 1.5) - 200 + bumpiness(1.5, r/100, 12, phi);
            
            // Add the vertex to the shape
            vertex(x, y, z);
        }
    }
    
    endShape();
}

// V-shape function for the overall flower form
// A: height from stem to petals
// r: where petals begin to bloom
// a: cone size of the flower
// b: bloom angle
// c: petal length
function vShape(A, r, a, b, c) {
    return A * pow(Math.E, -b * pow(abs(r), c)) * pow(abs(r), a);
}

// Add a natural bumpiness to the petal edges
function bumpiness(A, r, f, angle) {
    return 1 + A * pow(r, 2) * sin(f * angle);
}

// Toggle auto-rotation when canvas is clicked
function mousePressed() {
    if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
        autoRotate = !autoRotate;
    }
}
