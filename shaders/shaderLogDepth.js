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

var vsLogDepth = `
	//#version 300 es
	precision highp float;
	precision highp int;
	uniform mat4 modelViewMatrix; // optional
	uniform mat4 projectionMatrix; // optional
	uniform mat3 normalMatrix;
	attribute vec3 position;
	attribute vec4 color;
	attribute vec3 normal;
	attribute vec2 uv;
	varying vec4 vColor;
	varying vec3 vNormal;
	varying vec2 vUv;
	varying vec2 texCoord;
	varying float flogz;
	
	void main()
	{
		vColor = vec4(color.r, color.g, color.b, color.a);
		vNormal = normalMatrix * normal;
		vUv = uv;
		
		gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
		
		// separate w position computation to ensure compatibility with ortho projection matrices
		float glPositionW;
		if (projectionMatrix[2].w == 0.0) // switch off for ortho
			glPositionW = -(modelViewMatrix * vec4(position, 1.0)).z;
		else
			glPositionW = gl_Position.w;

		// logarithmic depth buffer
		float sC = 10.0;
		flogz = glPositionW*sC + 1.0;
	}
`;

var fsLogDepth = `
	#extension GL_EXT_frag_depth : enable
	//#version 300 es
	precision highp float;
	precision highp int;
	uniform float farPlane;
	varying vec4 vColor;
	varying vec2 vUv;
	varying float flogz;
	
	void main()
	{
		gl_FragColor = vColor;

		// logarithmic depth buffer
		float far = farPlane;
		float sC = 10.0;
		float Fcoef = 2.0 / log2(far*sC + 1.0);
		gl_FragDepthEXT = log2(flogz) * Fcoef * 0.5;
	}
`;

var fsLogDepthStripes = `
	#extension GL_EXT_frag_depth : enable
	//#version 300 es
	precision highp float;
	precision highp int;
	uniform float farPlane;
	uniform float stripeLength;
	varying vec4 vColor;
	varying vec2 vUv;
	varying float flogz;
	
	void main()
	{
		float total = floor(vUv.y * (1.0 / stripeLength));
		bool isEven = mod(total, 2.0) == 0.0;
		vec4 col1 = vec4(0.0,0.0,0.0,1.0);
		vec4 col2 = vec4(1.0,1.0,1.0,1.0);
		gl_FragColor = (isEven)? col1:col2;

		// logarithmic depth buffer
		float far = farPlane;
		float sC = 10.0;
		float Fcoef = 2.0 / log2(far*sC + 1.0);
		gl_FragDepthEXT = log2(flogz) * Fcoef * 0.5;
	}
`;