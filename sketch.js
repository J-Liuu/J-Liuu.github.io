let x = 40;

function setup() {
  createCanvas(850, 850, WEBGL);
  colorMode(HSB, 360, 100, 100);
  angleMode(DEGREES);

  stroke(71, 26, 92);
  strokeWeight(4);
}

function draw() {

  background(75, 79, 51);
  //in WEBGL mode i can use mouse to move around camera
  orbitControl(4,4);

  //Rotates Camera
  rotateX(80);

  beginShape(POINTS);
  for(theta = 0; theta < 60; theta += 1){   //theta duplicates the flower shape ring towards the center

  //Using power will make the petals look more sharper when changing from 1 to 2 or 3
    for(let phi = 0; phi <360; phi +=2){
      let r = (70 * pow(abs(sin(phi * 5/2)), 1) + 225) * theta/60;
      //polar cordinate of the sinwave, I noticed was that when its an odd number, the waves overlap. Using power will make petals look sharper when value is over 1

      let x = r * cos(phi);
      let y = r * sin(phi);
      // this is where you can edit the flower according to these variables, look further below for variable defintions!
      let z = 
          vShape(300, r/100, 0.8, 0.15, 1.5) - 200 + bumpiness(1.5, r/100, 12, phi); 


      //some general info; z turns shape into 3D, exponent makes gradual cone-like trumpet shape of the flowers stem. Eulers Constant helps prevent less warping outwards for the petals.
      vertex(x,y,z);
    }
  }

  endShape();
}

  //A   edits how high from the stem to the petals go before sprouting out
  //r   edits where the petals begin to bloom out
  //a   edits how big the cone of the flower is
  //b   edits the angle of the bloom
  //c   increases petal length
  function vShape(A, r, a, b, c){
    return A * pow(Math.E,-b * pow(abs(r), c)) * pow(abs(r), a);
  }


  //makes the flower petal edges have a slight bumpy and curvy look
  function bumpiness(A, r, f, angle){
    return 1 + A * pow(r, 2) * sin(f * angle);
  }