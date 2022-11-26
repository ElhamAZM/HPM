/**
 * Cuneiform WebGLViewer
 * http://viewer.cuneiform.de/
 *
 * Copyright 2017 - Denis Fisseler
 * TU Dortmund University, Department of Computer Science VII.
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with this program.  If not, see <http://www.gnu.org/licenses/>.
 */


var container, canvas;
var renderer, controls, stats, lightControls;
var scene, nexusObject, camera;
var bgScene, bgCamera;
var postScene, postCamera, postMaterial;
var scaleObject, scaleCamera, scaleMaterial;
var hpmLogo, logoScene;
var raycaster, mouse;
var mousePixel;
var textureLoader;
var litSpheres = ['textures/litsphere_clay0_512.png', 'textures/litsphere_clay1_512.png', 'textures/litsphere_shiny0_512.png', 'textures/litsphere_shiny1_512.png', 'textures/litsphere_metal0_.png', 'textures/litsphere_bronze_.png', 'textures/litsphere_metal1_.png', 'textures/litsphere_gold_.png'];
var currentLitSphere = 'LitClay';
var depthTarget;
var pickRequest = false;
var clickCtrlModified = false;
var pickScene;
var pickPoints = [];
var currentPickPoint = 0;
var pointGroup;
var canvasWidth, canvasHeight;
var cameraFOV = 35.0;
var nearPlane = 0.1;
var farPlane = 15000.0;
var gBufferMaterial;
var logDepthMaterial;
var logDepthStripeMaterial;
var bmtext, bmfont;
var textLabels = [];
var textScene;
var lightDirectionMode = false;
var measureMode = false;
//var localPlane = false;
//var globalPlane = false;
var saveScreenShot = false;
var info_overlay;
var rsFBO = [];
var rsRBO = [];
var rsTexGrad = undefined;
var rsTexNorm = undefined;
var rsTexDepth = undefined;
var propsLocal = {myPlane: 0.5};
var params =
{
	ShadingMode: 'LitSphere',
	ColorMode: 'Ambient Occlusion',
	LitSphere: 'Lit Clay',
	RadianceScaling: true,
	Enhancement: 0.5,
	Reflective: false,
	Invert: false,
	FlatShading: false,
	Orthographic: false,
	ShowAxis: false,
	ResetView: function ()
	{
		resetView();
	},
	ClearMeasureTapes: function ()
	{
		clearMeasureTapes();
	},
	Logout: function ()
	{
		logout();
	}
};

//const localPlane = new THREE.Plane( new THREE.Vector3( 0, -1, 0 ), 0.8 ); //

function getURLParameter(name)
{
	return decodeURIComponent((new RegExp('[?|&]' + name + '=' + '([^&;]+?)(&|#|;|$)').exec(location.search) || [null, ''])[1].replace(/\+/g, '%20')) || null;
}
function saveAsImage()
{
	var imgData,
	imgNode;
	try
	{
		var strMime = "image/jpeg";
		imgData = renderer.domElement.toDataURL(strMime);
		saveFile(imgData.replace(strMime, "image/octet-stream"), getURLParameter('model') + ".jpg");
	}
	catch (e)
	{
		console.log(e);
		return;
	}
}
var saveFile = function (strData, filename)
{
	var link = document.createElement('a');
	if (typeof link.download === 'string')
	{
		document.body.appendChild(link);
		link.download = filename;
		link.href = strData;
		link.click();
		document.body.removeChild(link);
	}
	else
	{
		location.replace(uri);
	}
}
function app()
{
	if (!Detector.webgl)
	{
		Detector.addGetWebGLMessage();
	}
	init();
	animate();
	initGui();
}
function initGui()
{
	var gui = new dat.GUI(
		{
			width: 300
		}
		);
	var f1 = gui.addFolder('Renderer');
	f1.add(params, 'ShadingMode', ['Color', 'Diffuse', 'LitSphere', 'Curvature']).name('Shading&nbsp;Mode').onChange(guiChanged);
	f1.add(params, 'LitSphere', ['Diffuse Clay', 'Lit Clay', 'Shiny Clay', 'Red Clay', 'Aluminum', 'Bronze', 'Steel', 'Gold']).onChange(guiChanged);
	f1.add(params, 'ColorMode', ['None', 'Ambient Occlusion', 'Surface Color']).onChange(guiChanged);
	f1.add(params, 'RadianceScaling').name('Radiance&nbsp;Scaling').onChange(guiChanged);
	f1.add(params, 'Enhancement', 0, 2).onChange(guiChanged);
	f1.add(params, 'Reflective').onChange(guiChanged);
	f1.add(params, 'Invert').onChange(guiChanged);
	f1.add(params, 'FlatShading').name('Flat Shading').onChange(guiChanged);
	f1.open();
	var f2 = gui.addFolder('View');
	f2.add(params, 'ShowAxis').name('Show&nbsp;Axis&nbsp;Object').onChange(guiChanged);
	f2.add(params, 'Orthographic').name('Orthographic&nbsp;Mode').onChange(guiChanged).listen();
	f2.add(params, 'ClearMeasureTapes').name('Clear&nbsp;Measure&nbsp;Tapes');
	f2.add(params, 'ResetView').name('Reset&nbsp;View');
	f2.open();
	gui.add(params, 'Logout').name('Logout');
	//folderLocal = gui.addFolder( 'Local Clipping' );
	//propsLocal = { get 'myPlane'() {return localPlane.constant;}, set 'myPlane'( v ) { localPlane.constant = v;}};
	//folderLocal.add( propsLocal, 'myPlane', -0.3, 1.25 ).onChange(guiChanged);
	gui.close();
}
function resetView(zoom)
{
	var nexus = nexusObject.instance.mesh;
	if (!nexus.sphere)
		return;
	var sp = nexus.sphere;
	var c = sp.center;
	var dist = (sp.radius / 2.0) / Math.tan(((cameraFOV / 2.0) * Math.PI / 180) / 2.0);
	if (zoom == true)
	{
		camera.position = new THREE.Vector3(c[0], c[1], c[2] + dist * 10.0);
		controls.target = new THREE.Vector3(c[0], c[1], c[2]);
		camera.up = new THREE.Vector3(0.0, 1.0, 0.0);
	}
	var position = new THREE.Vector3(c[0], c[1], c[2] + dist);
	var target = new THREE.Vector3(c[0], c[1], c[2]);
	var up = new THREE.Vector3(0.0, 1.0, 0.0);
	tweenCamera(position, target, up);
}
function updateCamera()
{
	var cameraTarget = controls.target;
	var cameraPosition = camera.position;
	var cameraUp = camera.up;
	if (params.Orthographic)
	{
		var orthoScaleFactor = Math.tan((cameraFOV / 2.0) * Math.PI / 180) * camera.position.clone().sub(controls.target).length();
		var oHeight = orthoScaleFactor;
		var oWidth = orthoScaleFactor * (canvasWidth / canvasHeight);
		if (camera.isPerspectiveCamera)
		{
			camera = new THREE.OrthographicCamera(-oWidth, oWidth, oHeight, -oHeight, nearPlane, farPlane);
		}
		else
		{
			camera.left = -oWidth;
			camera.right = oWidth;
			camera.top = oHeight;
			camera.bottom = -oHeight;
			camera.updateProjectionMatrix();
		}
	}
	else
	{
		if (camera.isOrthographicCamera)
		{
			camera = new THREE.PerspectiveCamera(cameraFOV, canvasWidth / canvasHeight, nearPlane, farPlane);
		}
	}
	camera.position.copy(cameraPosition);
	camera.up.copy(cameraUp);
	controls.handleCameraChange(camera);
	controls.update();
	lightControls.update();
}
function getShaderSource(id)
{
	return document.getElementById(id).textContent.replace(/^\s+|\s+$/g, '');
}
function toggleMeasureMode()
{
	measureMode = !measureMode;
}
function toggleLightDirectionMode()
{
	lightDirectionMode = !lightDirectionMode;
	controls.enabled = !lightDirectionMode;
	lightControls.enabled = lightDirectionMode;
}
function resetLightDirection()
{
	lightControls.reset();
}
//I don't know how to write a toggle for planes

//function togglelocalPlane()
//{
//	localPlane = !localPlane;
//	controls.enabled = !localPlane;
	//lightControls.enabled = lightDirectionMode;
//}


//function toggleglobalPlane()
//{
//	lightDirectionMode = !lightDirectionMode;
//	controls.enabled = !lightDirectionMode;
//	lightControls.enabled = lightDirectionMode;
//}



function toggleHD()
{
	if (typeof Nexus == 'undefined')
		return;
	if (hdMode)
	{
		Nexus.setTargetError(renderer.context, 1.0);
		Nexus.setMaxCacheSize(renderer.context, (256 * (1 << 30)));
		Nexus.setDrawBudget(renderer.context, (1 * (1 << 30)));
	}
	else
	{
		Nexus.setTargetError(renderer.context, 1.0);
		Nexus.setMaxCacheSize(renderer.context, (256 * (1 << 20)));
		Nexus.setDrawBudget(renderer.context, (1 * (1 << 20)));
	}
}
function toggleInfoWindow()
{
	if (info_overlay.style.display === "none")
	{
		info_overlay.style.display = "block";
	}
	else
	{
		info_overlay.style.display = "none";
	}
}



function initHTML()
{
	container = document.createElement('div');
	document.body.appendChild(container);
	canvas = document.createElement('canvas');
	canvasWidth = window.innerWidth;
	canvasHeight = window.innerHeight;
	var buttons_div = document.createElement('div');
	buttons_div.style.position = "absolute";
	buttons_div.classList.add("buttons");
	buttons_div.style.top = 0;
	buttons_div.style.left = 0;
	buttons_div.style.marginTop = "10px";
	buttons_div.style.marginLeft = "10px";
	container.appendChild(buttons_div);
	var info_div = document.createElement('div');
	info_div.classList.add("info_div");
	info_div.innerHTML = "<object type=\"text/html\" data=\"info.html\" ></object>";
	info_overlay = document.createElement('div');
	info_overlay.classList.add("overlay");
	info_overlay.style.display = "none";
	info_overlay.setAttribute("onclick", "toggleInfoWindow();");
	container.appendChild(info_overlay);
	info_overlay.appendChild(info_div); 
	createToggleButton(buttons_div, "skins/dark/measure.png", "<b>Measure Mode</b>\n- Double-click on the model, to place measure points.\n- Right-click on the button, to clear measure lines.", "toggleMeasureMode();", "clearMeasureTapes(); return false;");
	createToggleButton(buttons_div, "skins/dark/lightcontrol.png", "<b>Light Direction Mode</b>\n- Click + drag in the viewport, to set light direction.\n- Right-click on the button, to reset light direction.", "toggleLightDirectionMode();", "resetLightDirection(); return false;");
	//createToggleButton(buttons_div, "skins/dark/sections.png", "<b>Plane Section</b>", "togglelocalPlane();", "clearMeasureTapes(); return false;");
	//createToggleButton(buttons_div, "skins/dark/color.png", "<b>color Mode</b>", "toggleLightDirectionMode();", "resetLightDirection(); return false;");
	//createButton(buttons_div, "skins/dark/orthographic.png", "Reset View", "resetView();");
	createButton(buttons_div, "skins/dark/screenshot.png", "Save Screenshot", "saveAsImage();");
	//createButton(buttons_div, "images/link.svg", "<b>Copy Link to View</b>\nCopies a link to the clipboard, that can be used to \nreopen the model with the current camera parameters.", "copyLink();");
	//createToggleButton(buttons_div, "images/info.svg", "<b>Viewer Info</b>\nClick button to display viewer info.\n\nControls:\n- <i>Left-click + drag</i> in the viewport to rotate the model.\n- <i>Middle-click + drag</i> or <i>mouse-wheel</i> in the viewport to zoom.\n - <i>Right-click + drag</i> in the viewport to pan the viewport.\n- <i>Double-click</i> on the model to center the viewport on that point.", "toggleInfoWindow();");
}
function createButton(parent, image, tooltip, onclick)
{
	var div = document.createElement("div");
	div.classList.add("button");
	div.classList.add("tooltip");
	div.setAttribute("onclick", onclick);
	var tooltiptext = document.createElement("span");
	tooltiptext.classList.add("tooltiptext");
	tooltiptext.innerHTML = tooltip.replace(/(?:\r\n|\r|\n)/g, '<br />');
	div.appendChild(tooltiptext);
	var img = document.createElement("img");
	img.src = image;
	div.appendChild(img);
	parent.appendChild(div);
}
function createToggleButton(parent, image, tooltip, onclick, oncontextmenu, initialState)
{
	var div = document.createElement("div");
	div.classList.add("switch");
	div.classList.add("tooltip");
	div.setAttribute("onclick", onclick);
	if (oncontextmenu)
		div.setAttribute("oncontextmenu", oncontextmenu);
	var input = document.createElement("input");
	input.setAttribute("type", "checkbox");
	if (initialState)
		input.setAttribute("checked", "true");
	div.appendChild(input);
	var tooltiptext = document.createElement("span");
	tooltiptext.classList.add("tooltiptext");
	tooltiptext.innerHTML = tooltip.replace(/(?:\r\n|\r|\n)/g, '<br />');
	div.appendChild(tooltiptext);
	var img = document.createElement("img");
	img.src = image;
	div.appendChild(img);
	parent.appendChild(div);
}
function init()
{
	initHTML();
	raycaster = new THREE.Raycaster();
	mouse = new THREE.Vector2();
	mousePixel = new THREE.Vector2();
	renderer = new THREE.WebGLRenderer(
		{
			antialias: true,
			logarithmicDepthBuffer: false,
			alpha: false,
			preserveDrawingBuffer: true
		}
		);
	renderer.localClippingEnabled = true
	console.log("Using: ", Object.prototype.toString.call(renderer.context).slice(8, -1));
	localPlane = new THREE.Plane( new THREE.Vector3( 0, 1, 0 ), 0.8 );
	globalPlane = new THREE.Plane( new THREE.Vector3( - 1, 0, 0 ), 0.1 );
	renderer.setPixelRatio(window.devicePixelRatio);
	renderer.setSize(canvasWidth, canvasHeight);
	renderer.setClearColor(0x000000, 0);
	renderer.gammaInput = true;
	renderer.gammaOutput = true;
	renderer.shadowMap.enabled = true; //true
	renderer.shadowMap.renderReverseSided = false;
	container.appendChild(renderer.domElement);
	//const globalPlanes = [ globalPlane ],
    //       Empty = Object.freeze( [] );
	//renderer.clippingPlanes = Empty; // GUI sets it to globalPlanes
	

	camera = new THREE.PerspectiveCamera(cameraFOV, canvasWidth / canvasHeight, nearPlane, farPlane);
	camera.position.x = 0.0;
	camera.position.y = 0.0;
	camera.position.z = 300.0;
	camera.lookAt(new THREE.Vector3(0, 0, 0));
	controls = new THREE.TrackballControls(camera, renderer.domElement);
	controls.minDistance = 1.0;
	controls.maxDistance = 1000.0;
	controls.dynamicDampingFactor = 1.0;
	
	





	if (checkExtensions() == false)
		return;
	depthTarget = new THREE.WebGLRenderTarget(canvasWidth, canvasHeight);
	depthTarget.texture.format = THREE.RGBAFormat;
	textureLoader = new THREE.TextureLoader();
	setupBG();
	setupScene();
	initRadianceScalingFBO(canvasWidth, canvasHeight);
	setupPost();
	setupScaleObject();
	if (getURLParameter('camparams'))
	{
		applyCameraParamString(getURLParameter('camparams'));
	}
	if (getURLParameter('showstats'))
	{
		stats = new Stats();
		container.appendChild(stats.dom);
	}
	window.addEventListener('resize', onWindowResize, false); //no false in three.js code
	document.addEventListener('dblclick', onDocumentDoubleClick, false);
}
function setupFont(font)
{
	bmfont = font;
	bmtext = new TextBitmap(
		{
			imagePath: './js/three-bmfont-text/roboto-bold.png',
			text: 'Noli turbare crustulum meum.',
			width: 200,
			align: 'left',
			font: bmfont,
			lineHeight: font.common.lineHeight - 20,
			letterSpacing: 1,
			scale: 0.0005,
			rotate: false,
			color: "#FFFFFF",
			showHitBox: false
		}
		);
	bmtext.group.position.set(0, 0, 0);
	textScene = new THREE.Scene();
	textScene.add(bmtext.group);
}
function checkExtensions()
{
	var gl = renderer.context;
	var missingExtensions = "";
	if (gl.getSupportedExtensions().indexOf("WEBGL_draw_buffers") < 0)
	missingExtensions = missingExtensions + "WEBGL_draw_buffers\n"
	if (gl.getSupportedExtensions().indexOf("EXT_frag_depth") < 0)
	missingExtensions = missingExtensions + "EXT_frag_depth\n"
	if (gl.getSupportedExtensions().indexOf("WEBGL_depth_texture") < 0)
	missingExtensions = missingExtensions + "WEBGL_depth_texture\n"
	if (gl.getSupportedExtensions().indexOf("OES_texture_float") < 0)
	missingExtensions = missingExtensions + "OES_texture_float\n"
	if (gl.getSupportedExtensions().indexOf("OES_texture_float_linear") < 0)
	missingExtensions = missingExtensions + "OES_texture_float_linear\n"
	if (gl.getSupportedExtensions().indexOf("OES_standard_derivatives") < 0)
	missingExtensions = missingExtensions + "OES_standard_derivatives\n"
	if (gl.getSupportedExtensions().indexOf("EXT_frag_depth") < 0)
	missingExtensions = missingExtensions + "EXT_frag_depth\n"
	if (missingExtensions.length > 0)
	{
		alert("The following required WebGL extensions are missing:\n" + missingExtensions +
			  "\nPlease check at webglreport.com, if your graphics driver and browser support all of the WebGL extensions, listed above. This viewer has been tested to work with current versions of Google Chome and Mozilla Firefox.");
		return false;
	}
	return true;
}
function setupBG()
{
	bgCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	bgScene = new THREE.Scene();
	var textureLogo = textureLoader.load('textures/grey_gradient.png', function () //changed the background image
		{
			//localPlane = new THREE.Plane( new THREE.Vector3( 0, - 1, 0 ), 0.8 );
			//globalPlane = new THREE.Plane( new THREE.Vector3( - 1, 0, 0 ), 0.1 );
			textureLogo.minFilter = textureLogo.magFilter = THREE.LinearFilter;
			textureLogo.wrapS = textureLogo.wrapT = THREE.RepeatWrapping;
			textureLogo.repeat.set(512, 512);
			textureLogo.generateMipmaps = false;
			var bgMaterial = new THREE.ShaderMaterial(
				{
					vertexShader: vsGradient,
					fragmentShader: fsGradient,
					depthWrite: false,
					uniforms:
					{
						windowSize: { value: new THREE.Vector2(canvasWidth, canvasHeight) },
						texSize: { value: new THREE.Vector2(textureLogo.image.width, textureLogo.image.height) },
						colorBottom: { value: new THREE.Vector4(0.6, 0.6, 0.6, 1.0) },
						colorTop: { value: new THREE.Vector4(1.0, 1.0, 1.0, 1.0) },
						tLogo: { value: textureLogo }
					},
					//clippingPlanes: [ localPlane ]
				}
				);
			var bgPlane = new THREE.PlaneBufferGeometry(2, 2);
			var bgQuad = new THREE.Mesh(bgPlane, bgMaterial);

			bgScene.add(bgQuad);
		}
		);
}
function setupScene()
{
	scene = new THREE.Scene();
	var axisHelper = new THREE.AxisHelper(10);
	axisHelper.position.set(0, 0, 0);
	axisHelper.name = "axis";
	axisHelper.visible = false;
	scene.add(axisHelper);
	logDepthMaterial = new THREE.RawShaderMaterial(
		{
			uniforms:
			{
				flatShading: { value: 0 },
				farPlane: { value: farPlane }
			},
			vertexShader: vsLogDepth,
			fragmentShader: fsLogDepth,
			side: THREE.DoubleSide,
			clippingPlanes: [ localPlane ]
		}
		);
	logDepthStripeMaterial = new THREE.RawShaderMaterial(
		{
			uniforms:
			{
				stripeLength: { value: 1.0 },
				farPlane: { value: farPlane }
			},
			vertexShader: vsLogDepth,
			fragmentShader: fsLogDepthStripes,
			side: THREE.DoubleSide,
			clippingPlanes: [ localPlane ]
		}
		);
	axisHelper.material = logDepthMaterial;
	gBufferMaterial = new THREE.RawShaderMaterial(
		{
			uniforms:
			{
				flatShading: { value: 0 },
				colorChannel: { value: 0 },
				farPlane: { value: farPlane }
			},
			vertexShader: vsGBuffer,
			fragmentShader: fsGBuffer,
			side: THREE.DoubleSide,
			clippingPlanes: [ localPlane ]
		}
		);
	Nexus.setTargetError(renderer.context, 1.0);
	Nexus.setMaxCacheSize(renderer.context, (256 * (1 << 30)));
	Nexus.setDrawBudget(renderer.context, (1 * (1 << 30)));
	var model = getURLParameter('models/gargo.nxz') || "Cookie";
	nexusObject = new NexusObject('models/gargo.nxz', renderer, render, gBufferMaterial, nexusLoaded);
	nexusObject.name = "nexus";
	pointGroup = new THREE.Group();
	scene.add(pointGroup);
	var r = new XMLHttpRequest();
	r.open('GET', './js/three-bmfont-text/roboto-bold.json');
	r.onreadystatechange = function ()
	{
		if (r.readyState === 4 && r.status === 200)
		{
			setupFont(JSON.parse(r.responseText));
		}
	};
	r.send();
}
function nexusLoaded()
{
	if (!getURLParameter('camparams'))
	{
		resetView(true);
	}
}
function initRadianceScalingFBO(width, height)
{
	var gl = renderer.context;
	var extdb = gl.getExtension("WEBGL_draw_buffers");
	var extcbf = gl.getExtension("WEBGL_color_buffer_float");
	var extdt = gl.getExtension("WEBGL_depth_texture");
	var exttf = gl.getExtension("OES_texture_float");
	var exttfl = gl.getExtension("OES_texture_float_linear");
	var extsd = gl.getExtension("OES_standard_derivatives");
	var extfd = gl.getExtension("EXT_frag_depth");
	if (rsFBO[0] == null)
		rsFBO[0] = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER, rsFBO[0]);
	if (rsTexGrad == undefined)
	{
		rsTexGrad = new THREE.Texture();
		rsTexGrad.__webglTexture = gl.createTexture();
	}
	gl.bindTexture(gl.TEXTURE_2D, rsTexGrad.__webglTexture);
	rsTexGrad.__webglInit = false;
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	if (rsTexNorm == undefined)
	{
		rsTexNorm = new THREE.Texture();
		rsTexNorm.__webglTexture = gl.createTexture();
	}
	gl.bindTexture(gl.TEXTURE_2D, rsTexNorm.__webglTexture);
	rsTexNorm.__webglInit = false;
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.FLOAT, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	if (rsTexDepth == undefined)
	{
		rsTexDepth = new THREE.Texture();
		rsTexDepth.__webglTexture = gl.createTexture();
	}
	gl.bindTexture(gl.TEXTURE_2D, rsTexDepth.__webglTexture);
	rsTexDepth.__webglInit = false;
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.DEPTH_COMPONENT, width, height, 0, gl.DEPTH_COMPONENT, gl.UNSIGNED_INT, null);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	bufs = [extdb.COLOR_ATTACHMENT0_WEBGL, extdb.COLOR_ATTACHMENT1_WEBGL];
	extdb.drawBuffersWEBGL(bufs);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, bufs[0], gl.TEXTURE_2D, rsTexGrad.__webglTexture, 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, bufs[1], gl.TEXTURE_2D, rsTexNorm.__webglTexture, 0);
	gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.DEPTH_ATTACHMENT, gl.TEXTURE_2D, rsTexDepth.__webglTexture, 0);
	var FBOstatus = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
	if (FBOstatus != gl.FRAMEBUFFER_COMPLETE)
	{
		console.log("GL_FRAMEBUFFER_COMPLETE failed, CANNOT use rsFBO[0]\n");
	}
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	gl.bindRenderbuffer(gl.RENDERBUFFER, null);
}

//let localPosition = new Vector3()
//let normal = new Vector3(0, 1, 0)
//let clipPlane1 = new Plane().setFromNormalAndCoplanarPoint( normal, localPosition )
function setupPost()
{
	postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
	postMaterial = new THREE.RawShaderMaterial(
		{
			vertexShader: vsPost,
			fragmentShader: fsPost,
			uniforms:
			{
				tLitSphere: { value: textureLoader.load(litSpheres[1]) },
				useColor: { value: 1 },
				shadingMode: { value: 2 },
				invVPWidth: { value: 1.0 / canvasWidth },
				invVPHeight: { value: 1.0 / canvasHeight },
				lightDirection: { value: new THREE.Vector3(0.0, 0.0, 1.0) },
				enhancement: { value: 0.5 },
				enabled: { value: 1 },
				reflective: { value: 0 },
				invert: { value: 0 },
				texGrad: { value: rsTexGrad },
				texNorm: { value: rsTexNorm },
				texDepth: { value: rsTexDepth },
				//plane: {value: 0.5}
			},
			
			clippingPlanes: [ localPlane ]
		}
		);
	var postPlane = new THREE.PlaneBufferGeometry(2, 2);
	var postQuad = new THREE.Mesh(postPlane, postMaterial);
	postQuad.name = "plane";
	postScene = new THREE.Scene();
	postScene.add(postQuad);
	lightControls = new THREE.LightControls(postMaterial, renderer.domElement);
	lightControls.enabled = false;
	var pickMaterial = new THREE.ShaderMaterial(
		{
			vertexShader: vsPick,
			fragmentShader: fsPick,
			uniforms:
			{
				texDepth: { value: rsTexDepth }
			},
			clippingPlanes: [ localPlane ]

		}
		);
	var pickPlane = new THREE.PlaneBufferGeometry(2, 2);
	var pickQuad = new THREE.Mesh(pickPlane, pickMaterial);  //on the picMaterial plane should be applied





	pickScene = new THREE.Scene();
	pickScene.add(pickQuad);
	var logoTex = textureLoader.load('textures/HPM_logo_tr2.png');
	logoTex.generateMipmaps = false;
	logoTex.magFilter = THREE.LinearFilter;
	logoTex.minFilter = THREE.LinearFilter;
	hpmLogo = new THREE.Mesh(new THREE.PlaneGeometry(180, 60, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, map: logoTex } ));
	logoScene = new THREE.Scene();
	//hpmLogo.position.set(250, 250, 250);
	//hpmLogo.scale.set(1.0, -1.0, 1.0);
	logoScene.add(hpmLogo); //comment the large hpm



	//pickScene = new THREE.Scene();
	//pickScene.add(pickQuad);
	//var logoTex = textureLoader.load('textures/HPM_logo_tr2.png');
	//logoTex.generateMipmaps = false;
	//logoTex.magFilter = THREE.LinearFilter;
	//logoTex.minFilter = THREE.LinearFilter;
	//hpmLogo = new THREE.Mesh(new THREE.PlaneGeometry(180, 60, 1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, map: logoTex } ));
	//logoScene = new THREE.Scene();
	//hpmLogo.position.set(250, 250, 250);
	//hpmLogo.scale.set(1.0, -1.0, 1.0);
	//logoScene.add(hpmLogo); //comment the large hpm


}
function setupScaleObject()
{
	scaleMaterial = new THREE.MeshBasicMaterial(
		{
			vertexColors: THREE.VertexColors,
			clippingPlanes: [ localPlane ]
		}
		);
	scaleMaterial.depthTest = false;
	scaleObject = new THREE.Mesh(new THREE.BufferGeometry(), scaleMaterial);
	scaleCamera = new THREE.OrthographicCamera(0, canvasWidth, 0, canvasHeight, -1.0, 1.0);
}
function disposeNode(node)
{
	if (node instanceof THREE.Mesh)
	{
		if (node.geometry)
		{
			node.geometry.dispose();
		}
		if (node.material)
		{
			if (node.material instanceof THREE.MeshFaceMaterial)
			{
				$.each(node.material.materials, function (idx, mtrl)
				{
					if (mtrl.map)
						mtrl.map.dispose();
					if (mtrl.lightMap)
						mtrl.lightMap.dispose();
					if (mtrl.bumpMap)
						mtrl.bumpMap.dispose();
					if (mtrl.normalMap)
						mtrl.normalMap.dispose();
					if (mtrl.specularMap)
						mtrl.specularMap.dispose();
					if (mtrl.envMap)
						mtrl.envMap.dispose();
					mtrl.dispose();
				}
				);
			}
			else
			{
				if (node.material.map)
					node.material.map.dispose();
				if (node.material.lightMap)
					node.material.lightMap.dispose();
				if (node.material.bumpMap)
					node.material.bumpMap.dispose();
				if (node.material.normalMap)
					node.material.normalMap.dispose();
				if (node.material.specularMap)
					node.material.specularMap.dispose();
				if (node.material.envMap)
					node.material.envMap.dispose();
				node.material.dispose();
			}
		}
		node = undefined;
	}
}
function disposeHierarchy(node, callback)
{
	for (var i = node.children.length - 1; i >= 0; i--)
	{
		var child = node.children[i];
		disposeHierarchy(child, callback);
		callback(child);
		node.remove(child);
	}
}
function renderLogo()
{
	if (typeof hpmLogo !== 'undefined')
	{
		renderer.clearDepth();
		hpmLogo.position.set(canvasWidth - 185 + 90, canvasHeight - 65 + 30, 1.0);
		renderer.render(logoScene, scaleCamera);
	}
}
function renderScaleObject()
{
	if (!camera.isOrthographicCamera)
		return;
	var orthoScaleFactor = Math.tan((cameraFOV / 2.0) * Math.PI / 180) * camera.position.clone().sub(controls.target).length();
	var innerWidth = canvasWidth;
	var innerHeight = canvasHeight;
	var dBase = innerHeight / (orthoScaleFactor * 2.0);
	var xsize = 1.0 * dBase;
	var ysize = 0.025 * innerHeight;
	var numSegments = Math.floor((innerWidth * 0.25) / xsize);
	var scaleObjectSize = new THREE.Vector2(numSegments * xsize, ysize * 2.0);
	var posX = 5;
	var posY = innerHeight - scaleObjectSize.y - 5;
	var scaleUnit = "";
	var k = 0;
	for (var i = 0; i < 3; i++)
	{
		if (posX + 20 * xsize < innerWidth * 0.25)
		{
			xsize *= 10.0;
			k++;
		}
	}
	switch (k)
	{
	case 0:
		scaleUnit = "mm";
		m_scaleDPM = xsize * 1000.0;
		break;
	case 1:
		scaleUnit = "cm";
		m_scaleDPM = xsize * 100.0;
		break;
	case 2:
		scaleUnit = "dm";
		m_scaleDPM = xsize * 1.0;
		break;
	case 3:
		scaleUnit = "m";
		m_scaleDPM = xsize * 0.1;
		break;
	}
	var vertices = [];
	var colors = [];
	var col = 0.0;
	for (var i = 0; posX + i * xsize < innerWidth * 0.2; i++)
	{
		vertices.push(posX + (i) * xsize, posY + 1.0 * ysize, 0.0);
		colors.push(col, col, col);
		vertices.push(posX + (i) * xsize, posY + 2.0 * ysize, 0.0);
		colors.push(col, col, col);
		vertices.push(posX + (i + 1) * xsize, posY + 1.0 * ysize, 0.0);
		colors.push(col, col, col);
		vertices.push(posX + (i) * xsize, posY + 2.0 * ysize, 0.0);
		colors.push(col, col, col);
		vertices.push(posX + (i + 1) * xsize, posY + 2.0 * ysize, 0.0);
		colors.push(col, col, col);
		vertices.push(posX + (i + 1) * xsize, posY + 1.0 * ysize, 0.0);
		colors.push(col, col, col);
		var col2 = 1.0 - col;
		vertices.push(posX + (i) * xsize, posY + 0.0 * ysize, 0.0);
		colors.push(col2, col2, col2);
		vertices.push(posX + (i) * xsize, posY + 1.0 * ysize, 0.0);
		colors.push(col2, col2, col2);
		vertices.push(posX + (i + 1) * xsize, posY + 0.0 * ysize, 0.0);
		colors.push(col2, col2, col2);
		vertices.push(posX + (i) * xsize, posY + 1.0 * ysize, 0.0);
		colors.push(col2, col2, col2);
		vertices.push(posX + (i + 1) * xsize, posY + 1.0 * ysize, 0.0);
		colors.push(col2, col2, col2);
		vertices.push(posX + (i + 1) * xsize, posY + 0.0 * ysize, 0.0);
		colors.push(col2, col2, col2);
		col = col2;
	}
	if (typeof bmtext !== 'undefined')
	{
		bmtext.text = scaleUnit;
		bmtext.group.position.set(-1.0 + ((posX + i * xsize) / innerWidth * 2.0) + 0.075, -0.94, 0);
	}
	function disposeArray()
	{
		this.array = null;
	}
	var quads = new THREE.BufferGeometry();
	quads.addAttribute('position', new THREE.BufferAttribute(new Float32Array(vertices), 3).onUpload(disposeArray));
	quads.addAttribute('color', new THREE.BufferAttribute(new Float32Array(colors), 3).onUpload(disposeArray));
	scaleObject.geometry.dispose();
	scaleObject.geometry = quads;
	scaleObject.needsUpdate = true;
	renderer.render(scaleObject, scaleCamera);
	if (typeof textScene !== 'undefined')
	{
		renderer.render(textScene, postCamera);
	}
	quads.dispose();
	quads = undefined;
	vertices = undefined;
	colors = undefined;
}
function onWindowResize()
{
	canvasWidth = window.innerWidth;
	canvasHeight = window.innerHeight;
	renderer.setSize(canvasWidth, canvasHeight);
	camera.aspect = canvasWidth / canvasHeight;
	camera.updateProjectionMatrix();
	bgCamera.aspect = canvasWidth / canvasHeight;
	bgCamera.updateProjectionMatrix();
	scaleCamera.right = canvasWidth;
	scaleCamera.bottom = canvasHeight;
	scaleCamera.updateProjectionMatrix();
	depthTarget.setSize(canvasWidth, canvasHeight);
	initRadianceScalingFBO(canvasWidth, canvasHeight);
	bgScene.children[0].material.uniforms.windowSize.value = new THREE.Vector2(canvasWidth, canvasHeight);
	bgScene.children[0].material.needsUpdate = true;
	var plane_obj = postScene.getObjectByName("plane");
	if (typeof plane_obj != 'undefined')
	{
		plane_obj.material.uniforms.invVPWidth.value = (1.0 / canvasWidth);
		plane_obj.material.uniforms.invVPHeight.value = (1.0 / canvasHeight);
		plane_obj.material.needsUpdate = true;
	}
	controls.handleResize();
	lightControls.handleResize();
}
var touchtime = 0;
function onDocumentClick(event)
{
	if (touchtime == 0)
	{
		touchtime = new Date().getTime();
	}
	else
	{
		if (((new Date().getTime()) - touchtime) < 800)
		{
			onDocumentDoubleClick(event);
			touchtime = 0;
		}
		else
		{
			touchtime = new Date().getTime();
		}
	}
	clickCtrlModified = event.ctrlKey;
}
function onDocumentDoubleClick(event)
{
	event.preventDefault();
	mousePixel.x = event.clientX;
	mousePixel.y = event.clientY;
	mouse.x = (mousePixel.x / canvasWidth) * 2 - 1;
	mouse.y =  - (mousePixel.y / canvasHeight) * 2 + 1;
	pickRequest = true;
	clickCtrlModified = event.ctrlKey;
}
function guiChanged()
{
	var plane_obj = postScene.getObjectByName("plane");
	if (typeof plane_obj !== 'undefined')
	{
		var shadingMode = plane_obj.material.uniforms.shadingMode.value;
		switch (params.ShadingMode)
		{
		case 'Color':
			shadingMode = 0;
			break;
		case 'Diffuse':
			shadingMode = 1;
			break;
		case 'LitSphere':
			shadingMode = 2;
			break;
		case 'Curvature':
			shadingMode = 3;
			break;
		}
		plane_obj.material.uniforms.shadingMode.value = shadingMode;
		plane_obj.material.uniforms.useColor.value = (params.ColorMode == 'None') ? false : true;
		plane_obj.material.uniforms.enabled.value = params.RadianceScaling;
		plane_obj.material.uniforms.enhancement.value = params.Enhancement;
		plane_obj.material.uniforms.reflective.value = params.Reflective;
		plane_obj.material.clippingPlanes.localPlane = propsLocal.myPlane;
		//plane_obj.material.clippingPlanes = [ clipPlane1 ];
		if (params.LitSphere != currentLitSphere)
		{
			switch (params.LitSphere)
			{
			case 'Diffuse Clay':
				plane_obj.material.uniforms.tLitSphere.value = textureLoader.load(litSpheres[0]);
				break;
			case 'Lit Clay':
				plane_obj.material.uniforms.tLitSphere.value = textureLoader.load(litSpheres[1]);
				break;
			case 'Shiny Clay':
				plane_obj.material.uniforms.tLitSphere.value = textureLoader.load(litSpheres[2]);
				break;
			case 'Red Clay':
				plane_obj.material.uniforms.tLitSphere.value = textureLoader.load(litSpheres[3]);
				break;
			case 'Aluminum':
				plane_obj.material.uniforms.tLitSphere.value = textureLoader.load(litSpheres[4]);
				break;
			case 'Bronze':
				plane_obj.material.uniforms.tLitSphere.value = textureLoader.load(litSpheres[5]);
				break;
			case 'Steel':
				plane_obj.material.uniforms.tLitSphere.value = textureLoader.load(litSpheres[6]);
				break;
			case 'Gold':
				plane_obj.material.uniforms.tLitSphere.value = textureLoader.load(litSpheres[7]);
				break;
			}
			currentLitSphere = params.LitSphere;
		}
	}
	if (typeof nexusObject !== 'undefined')
	{
		if (params.ColorMode == 'Ambient Occlusion')
			nexusObject.material.uniforms.colorChannel.value = 0;
		else if (params.ColorMode == 'Surface Color')
			nexusObject.material.uniforms.colorChannel.value = 2;
		if (params.ShadingMode == 'Curvature')
			nexusObject.material.uniforms.colorChannel.value = 1;
		nexusObject.material.uniforms.flatShading.value = params.FlatShading;
	}
	var axis_obj = scene.getObjectByName("axis");
	if (typeof axis_obj !== 'undefined')
	{
		if (axis_obj.visible && !params.ShowAxis)
			axis_obj.visible = false;
		else if (!axis_obj.visible && params.ShowAxis)
			axis_obj.visible = true;
	}
	if (typeof camera !== 'undefined')
	{
		if ((params.Orthographic && camera.isPerspectiveCamera) || (!params.Orthographic && camera.isOrthographicCamera))
		{
			updateCamera();
		}
	}
}
function animate(time)
{
	updateCamera();
	if (stats !== undefined)
		stats.update();
	render();
	requestAnimationFrame(animate);
	TWEEN.update();
}
function tweenCamera(position, target, up)
{
	new TWEEN.Tween(camera.position).to(
	{
		x: position.x,
		y: position.y,
		z: position.z
	}, 500).easing(TWEEN.Easing.Quadratic.InOut).start();
	new TWEEN.Tween(controls.target).to(
	{
		x: target.x,
		y: target.y,
		z: target.z
	}, 500).easing(TWEEN.Easing.Quadratic.InOut).start();
	new TWEEN.Tween(camera.up).to(
	{
		x: up.x,
		y: up.y,
		z: up.z
	}, 500).easing(TWEEN.Easing.Quadratic.InOut).start();
}
function getCameraParamString()
{
	var res = [];
	res.push(camera.position.x);
	res.push(camera.position.y);
	res.push(camera.position.z);
	res.push(controls.target.x);
	res.push(controls.target.y);
	res.push(controls.target.z);
	res.push(camera.up.x);
	res.push(camera.up.y);
	res.push(camera.up.z);
	res.push(camera.isOrthographicCamera ? "o" : "p");
	for (var i = 0; i < 9; i++)
		res[i] = res[i].toFixed(4);
	return res.join("_");
}
function applyCameraParamString(str)
{
	var res = str.split("_");
	if (res.length < 9)
		return;
	for (var i = 0; i < 9; i++)
	{
		if (!isNaN(parseFloat(res[i])))
		{
			res[i] = parseFloat(res[i]);
		}
		else
		{
			console.log("Bad camera parameters.");
			return;
		}
	}
	camera.position.set(res[0], res[1], res[2]);
	controls.target.set(res[3], res[4], res[5]);
	camera.up.set(res[6], res[7], res[8]);
	if (res[9] === "o")
	{
		params.Orthographic = true;
	}
}
function copyTextToClipboard(text)
{
	var textArea = document.createElement("textarea");
	textArea.style.position = 'fixed';
	textArea.style.top = 0;
	textArea.style.left = 0;
	textArea.style.width = '2em';
	textArea.style.height = '2em';
	textArea.style.padding = 0;
	textArea.style.border = 'none';
	textArea.style.outline = 'none';
	textArea.style.boxShadow = 'none';
	textArea.style.background = 'transparent';
	textArea.value = text;
	document.body.appendChild(textArea);
	textArea.select();
	try
	{
		var successful = document.execCommand('copy');
	}
	catch (err)
	{
		console.log('Unable to copy');
	}
	document.body.removeChild(textArea);
}
function copyLink()
{
	copyTextToClipboard(window.location.href + "&camparams=" + getCameraParamString());
}
function perspectiveDepthToViewZ(invClipZ, near, far)
{
	function log2(d)
	{
		return Math.log(d) / Math.log(2.0);
	}
	function exp2(d)
	{
		return Math.pow(2.0, d);
	}
	var z_far = farPlane;
	var sC = 10.0;
	var f_depth = invClipZ * 2.0 - 1.0;
	f_depth = (exp2(0.5 * (f_depth + 1.0) * log2(z_far * sC + 1.0)) - 1.0) / sC;
	return f_depth;
}
const v4 = new THREE.Vector4();
const unpackDownscale = 255 / 256;
const unpackFactors = new THREE.Vector4(unpackDownscale / (256 * 256 * 256), unpackDownscale / (256 * 256), unpackDownscale / 256, unpackDownscale);
function unpackRGBAToDepth(rgbaBuffer)
{
	return v4.fromArray(rgbaBuffer).multiplyScalar(1 / 255).dot(unpackFactors);
}
function addMeasurePoint(pickPosition)
{
	var point = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 5), logDepthMaterial);
	point.position.set(pickPosition.x, pickPosition.y, pickPosition.z);
	pointGroup.add(point);
	pickPoints[currentPickPoint] = pickPosition;
	if (currentPickPoint == 1)
	{
		var l = pickPoints[1].clone().sub(pickPoints[0]).length();
		console.log("Measured length: " + l + "mm");
		var direction = new THREE.Vector3().subVectors(pickPoints[1], pickPoints[0]);
		var orientation = new THREE.Matrix4();
		orientation.lookAt(pickPoints[0], pickPoints[1], new THREE.Object3D().up);
		orientation.multiply(new THREE.Matrix4().set(1, 0, 0, 0, 0, 0, 1, 0, 0, -1, 0, 0, 0, 0, 0, 1));
		var edgeGeometry = new THREE.CylinderGeometry(0.05, 0.05, direction.length(), 8, 1);
		var edge = new THREE.Mesh(edgeGeometry, logDepthStripeMaterial.clone());
		edge.material.uniforms.stripeLength.value = 1.0 / direction.length();
		edge.applyMatrix(orientation);
		edge.position.x = (pickPoints[1].x + pickPoints[0].x) / 2;
		edge.position.y = (pickPoints[1].y + pickPoints[0].y) / 2;
		edge.position.z = (pickPoints[1].z + pickPoints[0].z) / 2;
		pointGroup.add(edge);
		var tmpText = new TextBitmap(
			{
				imagePath: './js/three-bmfont-text/roboto-bold.png',
				text: l.toFixed(2) + 'mm',
				width: 400,
				align: 'left',
				font: bmfont,
				lineHeight: bmfont.common.lineHeight - 20,
				letterSpacing: 1,
				scale: 0.01,
				rotate: false,
				color: "#FFFFFF",
				showHitBox: false
			}
			);
		tmpText.group.position.copy(edge.position);
		pointGroup.add(tmpText.group);
		textLabels.push(tmpText.group);
	}
	currentPickPoint = (currentPickPoint == 0) ? 1 : 0;
}
function clearMeasureTapes()
{
	disposeHierarchy(pointGroup, disposeNode);
	textLabels = [];
}
function logout()
{
	document.location.href = "../logout.php";
}
function updateTextLabels(labels)
{
	for (var i = 0, l = textLabels.length; i < l; i++)
	{
		var label = textLabels[i];
		label.up.copy(camera.up);
		label.lookAt(camera.position);
	}
}
function render()
{
	var gl = renderer.context;
	renderer.render(bgScene, bgCamera);
	gl.bindFramebuffer(gl.FRAMEBUFFER, rsFBO[0]);
	if (typeof nexusObject != 'undefined')
	{
		Nexus.beginFrame(renderer.context);
		renderer.render(nexusObject, camera);
		Nexus.endFrame(renderer.context);
	}
	gl.bindFramebuffer(gl.FRAMEBUFFER, null);
	renderer.autoClear = false;
	renderer.render(postScene, postCamera);
	updateTextLabels(textLabels);
	renderer.clearDepth();
	renderer.render(scene, camera);
	renderScaleObject();
	renderLogo();
	renderer.autoClear = true;
	if (pickRequest)
	{
		pickRequest = false;
		renderer.render(pickScene, postCamera, depthTarget, true);
		var buffer = new Uint8Array(4);
		renderer.readRenderTargetPixels(depthTarget, mousePixel.x, depthTarget.height - mousePixel.y, 1, 1, buffer);
		var depth = unpackRGBAToDepth(buffer);
		if ((buffer[0] !== 0.0) || (buffer[1] !== 0.0) || (buffer[2] !== 0.0))
		{
			var viewZ = -perspectiveDepthToViewZ(depth, camera.near, camera.far);
			var pickPosition = new THREE.Vector3();
			var projInv = new THREE.Matrix4();
			projInv.getInverse(camera.projectionMatrix);
			pickPosition.set(mouse.x, mouse.y, 0.5).applyMatrix4(projInv);
			if (camera.isPerspectiveCamera)
			{
				pickPosition.multiplyScalar(viewZ / pickPosition.z);
			}
			else
			{
				pickPosition.z = viewZ;
			}
			pickPosition.applyMatrix4(camera.matrixWorld);
			if (!clickCtrlModified && !measureMode)
			{
				var position = pickPosition.clone().sub(controls.target.clone().sub(camera.position));
				var target = pickPosition;
				tweenCamera(position, target, camera.up);
			}
			else
			{
				addMeasurePoint(pickPosition);
			}
		}
	}
}
