var SDFShader = {

  uniforms: {
    map: { type: 't', value: null },
    farPlane: { type: 'f', value: 15000.0 },
    color: { type: 'v3', value: new THREE.Color('#fff') },
    smoothing: { type: 'f', value: 0.2 },
    threshold: { type: 'f', value: 0.4 }
  },

  vertexShader: [

	"precision highp float;",
	"precision highp int;",
    "varying vec2 vUv;",
	"varying float flogz;",

    "void main() {",
      "vUv = uv;",
	  "gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
	  "// separate w position computation to ensure compatibility with ortho projection matrices",
	  "float glPositionW;",
	  "if (projectionMatrix[2].w == 0.0) // switch off for ortho",
	  "    glPositionW = -(modelViewMatrix * vec4(position, 1.0)).z;",
	  "else",
	  "    glPositionW = gl_Position.w;",
	  "// logarithmic depth buffer",
	  "float sC = 10.0;",
	  "flogz = glPositionW*sC + 1.0;",
    "}"

  ].join('\n'),

  // todo: outline
  // https://github.com/libgdx/libgdx/wiki/Distance-field-fonts#adding-an-outline
  // http://stackoverflow.com/questions/26155614/outlining-a-font-with-a-shader-and-using-distance-field

  fragmentShader: [

	"#extension GL_EXT_frag_depth : enable",
	"//#version 300 es",
	"precision highp float;",
	"precision highp int;",
	"uniform float farPlane;",
	"varying vec4 vColor;",
	"varying vec2 vUv;",
	"varying float flogz;",

    "uniform sampler2D map;",
    "uniform vec3 color;",

    "uniform float smoothing;",
    "uniform float threshold;",

    "void main() {",
      // "vec4 texel = texture2D( map, vUv );",
      "float distance = texture2D( map, vUv ).a;",
      "float alpha = smoothstep( threshold - smoothing, threshold + smoothing, distance );",
      "gl_FragColor = vec4( color, alpha );",
	  "	// logarithmic depth buffer",
	  "	float far = farPlane;",
	  "	float sC = 10.0;",
	  "	float Fcoef = 2.0 / log2(far*sC + 1.0);",
	  "	gl_FragDepthEXT = log2(flogz) * Fcoef * 0.5;",	  
    "}"

  ].join('\n')

};
