
const width = "480";
const height = "240";
const pixelWidth = width;
const pixelHeight = height;
const totalPixels = pixelWidth * pixelHeight;
document.getElementById("screen").innerHTML = '<canvas id="myCanvas" width=' + width + ' height=' + height + ' style="border:1px solid #000000;">Your browser does not support the HTML5 canvas tag.</canvas>'
let canvas = document.getElementById("myCanvas");
let ctx = canvas.getContext("2d");

const speed = 0.1;
var rayInfo;
var forwardInput, backwardInput, rightInput, leftInput, upInput, downInput, rotateRightInput, rotateLeftInput, rotateUpInput, rotateDownInput;

class vec3 {

    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    add(v3) {
        return new vec3(this.x + v3.x, this.y + v3.y, this.z + v3.z);
    }

    subtract(v3) {
        return new vec3(this.x - v3.x, this.y - v3.y, this.z - v3.z);
    }

    multiply(num) {
        return new vec3(this.x * num, this.y * num, this.z * num);
    }

    squareVec3() {
        return new vec3(this.x * this.x, this.y * this.y, this.z * this.z);
    }

    mag() {
        return Math.sqrt((this.x * this.x) + (this.y * this.y) + (this.z * this.z));
    }

    normalized() {
        let mag = this.mag();
        return new vec3(this.x / mag, this.y / mag, this.z / mag)
    }

    cross(v3) {
        return new vec3((this.y * v3.z) - (v3.y * this.z), (v3.x * this.z) - (this.x * v3.z), (this.x * v3.y) - (v3.x * this.y));
    }

}
function calculateRay(rayInfo) // voxelMaterials: bytes, voxelColors float4s, voxelBufferRowSize, voxelBufferPlaneSize, maxRayDistance, playerCameraPosition vec3, playerWorldForward, playerWorldRight, playerWorldUp
{
    // this would be faster with a SIMD math library
    let resultHolder = new vec3(0, 0, 0); // setting the pixel to black by default
    let pointHolder = rayInfo.playerCameraPosition; // initializing the first point to the player's position
    let p = rayInfo.ray; // vector transformation getting the world space directions of the rays relative to the player
    let u1 = rayInfo.playerWorldRight.multiply(p.x);// p.x * rayInfo.playerWorldRight;
    let u2 = rayInfo.playerWorldUp.multiply(p.y)//p.y * rayInfo.playerWorldUp;
    let u3 = rayInfo.playerWorldForward.multiply(p.z);//p.z * rayInfo.playerWorldForward;
    let direction = u1.add(u2.add(u3));//u1 + u2 + u3; // the transformed ray direction in world space
    let anyDir0 = direction.x == 0 || direction.y == 0 || direction.z == 0; // preventing a division by zero
    let distanceTraveled = rayInfo.maxRayDistance * anyDir0;


    //calculate ray position and direction
    var rayDirX = direction.x;
    var rayDirY = direction.y;
    var rayDirZ = direction.z;


    //which box of the map we're in
    var mapX = parseInt(rayInfo.playerCameraPosition.x);
    var mapY = parseInt(rayInfo.playerCameraPosition.y);
    var mapZ = parseInt(rayInfo.playerCameraPosition.z);


    //length of ray from current position to next x or y-side
    var sideDistX;
    var sideDistY;
    var sideDistZ;

    //length of ray from one x or y-side to next x or y-side
    var deltaDistX = (rayDirX == 0) ? 1e30 : Math.abs(1 / rayDirX);
    var deltaDistY = (rayDirY == 0) ? 1e30 : Math.abs(1 / rayDirY);
    var deltaDistZ = (rayDirZ == 0) ? 1e30 : Math.abs(1 / rayDirZ);

    var perpWallDist;

    //what direction to step in x or y-direction (either +1 or -1)
    var stepX;
    var stepY;
    var stepZ;

    var hit = 0; //was there a wall hit?
    var side; //was a NS or a EW wall hit?

    //calculate step and initial sideDist
    if (rayDirX < 0)
    {
        stepX = -1;
        sideDistX = (rayInfo.playerCameraPosition.x - mapX) * deltaDistX;
    }
    else
    {
        stepX = 1;
        sideDistX = (mapX + 1.0 - rayInfo.playerCameraPosition.x) * deltaDistX;
    }
    if (rayDirY < 0)
    {
        stepY = -1;
        sideDistY = (rayInfo.playerCameraPosition.y - mapY) * deltaDistY;
    }
    else
    {
        stepY = 1;
        sideDistY = (mapY + 1.0 - rayInfo.playerCameraPosition.y) * deltaDistY;
    }
    if (rayDirZ < 0)
    {
        stepZ = -1;
        sideDistZ = (rayInfo.playerCameraPosition.z - mapZ) * deltaDistZ;
    }
    else
    {
        stepZ = 1;
        sideDistZ = (mapZ + 1.0 - rayInfo.playerCameraPosition.z) * deltaDistZ;
    }


    //perform DDA
    while (hit == 0)
    {
        //jump to next map square, either in x-direction, or in y-direction
        if ((sideDistX < sideDistY) && (sideDistX < sideDistZ))
        {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
        }
        else if (sideDistY < sideDistZ)
        {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
        }
        else
        {
            sideDistZ += deltaDistZ;
            mapZ += stepZ;
            side = 2;
        }

        const inBounds = 
        ((mapX < rayInfo.voxelBufferRowSize) && (mapX >= 0)) && 
        ((mapY < rayInfo.voxelBufferRowSize) && (mapY >= 0)) && 
        ((mapZ < rayInfo.voxelBufferRowSize) && (mapZ >= 0));


        //Check if ray has hit a wall
        if (!inBounds) {
            break;
        }

        const voxelIndexFlat = (mapX + (mapZ * rayInfo.voxelBufferRowSize) + (mapY * rayInfo.voxelBufferPlaneSize));

        if (rayInfo.voxelMaterials[voxelIndexFlat] > 0) {
            hit = 1;
            resultHolder = rayInfo.voxelColors[rayInfo.voxelMaterials[voxelIndexFlat]].multiply((1.0 - (distanceTraveled / rayInfo.maxRayDistance)));

            switch (side){
                case 0:
                    resultHolder = resultHolder.multiply(0.75,0.75,0.75);
                    break;
                case 2:
                    resultHolder = resultHolder.multiply(0.5,0.5,0.5);
                    break;
                default:
                    break;
            }

            return resultHolder;
        }


    }

    return resultHolder;
}



function rotateVectorAboutY(v, angle) {
    return new vec3((v.x * Math.cos(angle)) - (v.z * Math.sin(angle)), v.y, (v.x * Math.sin(angle)) + (v.z * Math.cos(angle)));
}

function createVoxelData(x, y, z) {
    var voxelData = [];
    for (let i = 0; i < x * y * z; i++) {
        if (Math.random() > .8) {
            voxelData.push(Math.floor(Math.random() * 256));
        }
        else {
            voxelData.push(0);
        }
    }
    return voxelData;
}
function createRays() {

    let fieldOfView = .66;


    let dirX = 0, dirY = 0, dirZ = 1; //initial direction vector
    let planeX = fieldOfView, planeY = fieldOfView / (pixelWidth / pixelHeight), planeZ = 0;// 0.66; //the 2d raycaster version of camera plane


    var rayDirections = [];
    for (let i = 0; i < totalPixels; i++) {
        rayDirections.push(new vec3(0, 0, 0)); // initializing this array to make porting this code easier
    }

    for (let x = 0; x < pixelWidth; x++) {
        for (let y = 0; y < pixelHeight; y++) {

            //calculate ray position and direction
            let cameraX = 2 * x / parseFloat(pixelWidth) - 1; //x-coordinate in camera space

            let cameraY = 2 * y / parseFloat(pixelHeight) - 1; 

            let rayDirX = dirX + planeX * cameraX;
            let rayDirY = dirY + planeY * cameraY;
            let rayDirZ = dirZ;


            rayDirections[x + (y * pixelWidth)] = new vec3(rayDirX, rayDirY, rayDirZ);

        }
    }




    return rayDirections;


}
function voxelPixels(imageData, rayInfo) {
    let data = imageData.data;
    for (let i = 0; i < totalPixels; i++) {
        rayInfo.ray = rayInfo.objectiveRayDirections[i];
        let pixel = calculateRay(rayInfo);
        let pixelIndex = i * 4;
        data[pixelIndex] = pixel.x * 255;     // red
        data[pixelIndex + 1] = pixel.y * 255; // green
        data[pixelIndex + 2] = pixel.z * 255; // blue
        data[pixelIndex + 3] = 255; // alpha
    }
    ctx.putImageData(imageData, 0, 0);
}




window.onload = function () {

    const imageData = ctx.createImageData(pixelWidth, pixelHeight);

    const xSize = 128;
    const ySize = 128;
    const zSize = 128;

    rayInfo = { // voxelMaterials: bytes, voxelColors float4s, voxelBufferRowSize, voxelBufferPlaneSize, maxRayDistance, playerCameraPosition vec3, playerWorldForward, playerWorldRight, playerWorldUp, ray
        voxelMaterials: createVoxelData(xSize, ySize, zSize),
        voxelColors: [],// [new vec3(0,0,0), new vec3(0,1,0), new vec3(0,0,1), new vec3(1,0,0)],
        voxelBufferRowSize: xSize,
        voxelBufferPlaneSize: xSize * zSize,
        maxRayDistance: 25,
        playerCameraPosition: new vec3(xSize / 2 - .5, ySize / 2 - .5, zSize / 2),
        playerWorldForward: new vec3(0.001, .001, 1).normalized(),
        playerWorldUp: new vec3(0, -1, 0),
        playerWorldRight: new vec3(0, 0, 1).normalized().cross(new vec3(0, 1, 0)),
        ray: new vec3(0, 0, 1),
        objectiveRayDirections: createRays()
    }
    rayInfo.playerWorldRight = rayInfo.playerWorldForward.cross(new vec3(0, 1, 0));

    for (let i = 0; i < 256; i++) {
        rayInfo.voxelColors.push(new vec3(Math.random(), Math.random(), Math.random()));
        //rayInfo.voxelColors[i] = rayInfo.voxelColors[i].squareVec3();
    }

    setInterval(function () { gameLoop(imageData, rayInfo) }, 16); // basically the game loop
}




function gameLoop(imageData, rayInfo) {

    voxelPixels(imageData, rayInfo);

    handleInput();
}

function handleInput() {
    let movDir = new vec3(0, 0, 0);
    if (forwardInput) {
        movDir = movDir.add(rayInfo.playerWorldForward.multiply(speed));
    }
    if (backwardInput) {
        movDir = movDir.subtract(rayInfo.playerWorldForward.multiply(speed));
    }
    if (leftInput) {
        movDir = movDir.subtract(rayInfo.playerWorldRight.multiply(speed));
    }
    if (rightInput) {
        movDir = movDir.add(rayInfo.playerWorldRight.multiply(speed));
    }
    if (upInput) {
        movDir = movDir.add(new vec3(0, speed, 0));
    }
    if (downInput) {
        movDir = movDir.add(new vec3(0, -speed, 0));
    }
    rayInfo.playerCameraPosition = rayInfo.playerCameraPosition.add(movDir); // moving the camera

    // rotating the camera
    if (rotateRightInput) {
        rayInfo.playerWorldForward = rotateVectorAboutY(rayInfo.playerWorldForward, speed * .25);
        rayInfo.playerWorldUp = rayInfo.playerWorldForward.cross(rayInfo.playerWorldRight); // recalculating the up vector
        rayInfo.playerWorldRight = rayInfo.playerWorldForward.cross(new vec3(0,1,0)); // recalculating the right vector
    }
    if (rotateLeftInput) {
        rayInfo.playerWorldForward = rotateVectorAboutY(rayInfo.playerWorldForward, -speed * .25);
        rayInfo.playerWorldUp = rayInfo.playerWorldForward.cross(rayInfo.playerWorldRight); // recalculating the up vector
        rayInfo.playerWorldRight = rayInfo.playerWorldForward.cross(new vec3(0,1,0)); // recalculating the right vector

    }

    if (rotateUpInput) {
        if (rayInfo.playerWorldForward.y < 1){
            rayInfo.playerWorldForward.y += speed * 0.25;
            rayInfo.playerWorldForward = rayInfo.playerWorldForward.normalized();
            rayInfo.playerWorldUp = rayInfo.playerWorldForward.cross(rayInfo.playerWorldRight); // recalculating the right vector
        };
    }
    if (rotateDownInput) {
        if (rayInfo.playerWorldForward.y > -1){
            rayInfo.playerWorldForward.y -= speed * 0.25;
            rayInfo.playerWorldForward = rayInfo.playerWorldForward.normalized();
            rayInfo.playerWorldUp = rayInfo.playerWorldForward.cross(rayInfo.playerWorldRight); // recalculating the right vector
        };
    }

    rayInfo.playerWorldForward = rayInfo.playerWorldForward.normalized();
    rayInfo.playerWorldRight = rayInfo.playerWorldRight.normalized();
    rayInfo.playerWorldUp = rayInfo.playerWorldUp.normalized();
    
    
}

function takeInput(event, keydown) {

    switch (event.keyCode) {
        case 87:
            // forward
            forwardInput = keydown;
            break;
        case 83:
            // back
            backwardInput = keydown;
            break;
        case 65:
            // left
            leftInput = keydown;
            break;
        case 68:
            // right
            rightInput = keydown;
            break;
        case 16:
            // down
            downInput = keydown;
            //event.preventDefault();
            break;
        case 32:
            // up
            upInput = keydown;
            break;
        case 37:
            // arrowLeft
            rotateLeftInput = keydown;
            break;
        case 39:
            // E
            rotateRightInput = keydown;
            break;
        case 38:
            // arrowRight
            rotateDownInput = keydown;
            break;
        case 40:
            // arrowdown
            rotateUpInput = keydown;
            break;
    }
}


document.addEventListener('keydown', function (event) {
    takeInput(event, true);
});

document.addEventListener('keyup', function (event) {
    takeInput(event, false);
});