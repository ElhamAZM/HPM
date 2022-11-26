var SDFShader = {

  uniforms: {
    map: { type: 't', value: null },
    color: { type: 'v3', value: new THREE.Color('#fff') },
    smoothing: { type: 'f', value: 0.3 },
    threshold: { type: 'f', value: 0.4 }
  },

  vertexShader: [

    "varying vec2 vUv;",

    "void main() {",
      "vUv = uv;",
      "gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );",
    "}"

  ].join('\n'),

  // todo: outline
  // https://github.com/libgdx/libgdx/wiki/Distance-field-fonts#adding-an-outline
  // http://stackoverflow.com/questions/26155614/outlining-a-font-with-a-shader-and-using-distance-field

  fragmentShader: [

    "varying vec2 vUv;",

    "uniform sampler2D map;",
    "uniform vec3 color;",

    "uniform float smoothing;",
    "uniform float threshold;",

    "void main() {",
      // "vec4 texel = texture2D( map, vUv );",
      "float distance = texture2D( map, vUv ).a;",
      "float alpha = smoothstep( threshold - smoothing, threshold + smoothing, distance );",
      "gl_FragColor = vec4( color, alpha );",
    "}"

  ].join('\n')

};
