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
 *
 * -----------------------------------------------------------------------------------
 * Radiance scaling method adapted from:
 * Romain Vergne, Romain Pacanowski, Pascal Barla, Xavier Granier, Christophe Schlick.
 * Radiance Scaling for Versatile Surface Enhancement.
 * I3D '10: Proc. symposium on Interactive 3D graphics and games, 
 * Feb 2010, Boston, United States. ACM, 2010.
 */

var vsGBuffer = `
//#version 300 es
precision highp float;
precision highp int;
uniform mat4 modelViewMatrix; // optional
uniform mat4 projectionMatrix; // optional
uniform mat3 normalMatrix;
uniform float farPlane;
attribute vec3 position;
attribute vec4 color;
attribute vec2 uv;
attribute vec3 normal;
varying vec4 vColor;
varying vec3 vNormal;
varying float vDepth;
varying vec3 vEcPos;
varying vec2 vUv;
varying float flogz;

void main()
{				
	vColor = vec4(color.r, color.g, color.b, color.a);
	vNormal = normalMatrix * normal;
	vEcPos = (modelViewMatrix * vec4(position, 1.0)).xyz; // store result in ec_pos first to avoid one matrix multiplication
	vUv = uv;
	vDepth  = log(-vEcPos.z);
	
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

var fsGBuffer = `
#extension GL_OES_standard_derivatives : enable
#extension GL_EXT_draw_buffers : enable
#extension GL_EXT_frag_depth : enable
//#version 300 es
precision highp float;
precision highp int;
uniform bool flatShading;
uniform int colorChannel;
uniform float farPlane;
varying vec4 vColor;
varying vec3 vNormal;
varying float vDepth;
varying vec3 vEcPos;
varying vec2 vUv;
varying float flogz;
//layout(location = 0) out vec4 out_grad;
//layout(location = 1) out vec4 out_normal;

void main()
{
	float eps = 0.01;
	float fs = 0.3;
	vec3 exPosDx = dFdx(vEcPos);
	vec3 exPosDy = dFdy(vEcPos);
	
	vec3 n = flatShading ? normalize(cross(exPosDx, exPosDy)) : normalize(vNormal);
	if (!gl_FrontFacing) n = -n; // handle backfaces correctly
	
	float gs  = abs(n.z < eps ? 1.0 / eps : 1.0 / n.z);
	gs = pow(gs, fs);
	vec2 grad = -n.xy * gs;

	float color = 1.0;
	if (colorChannel == 0) color = vColor.r;
	if (colorChannel == 1) color = vColor.g;
	if (colorChannel == 2) color = vColor.b;
	if (colorChannel == 3) color = vColor.a;
	gl_FragData[0] = vec4(grad.x, grad.y, vDepth, color);
	gl_FragData[1] = vec4(n, 1.0);

	// logarithmic depth buffer
	float far = farPlane;
	float sC = 10.0;
	float Fcoef = 2.0 / log2(far*sC + 1.0);
	gl_FragDepthEXT = log2(flogz) * Fcoef * 0.5;
}
`;