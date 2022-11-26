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

var vsPost = `
attribute vec3 position;
attribute vec2 uv;
uniform mat4 modelViewMatrix; // optional
uniform mat4 projectionMatrix; // optional
uniform vec2 halfSizeNearPlane;
varying vec2 texCoord;
varying vec3 eyeDirection;

void main()
{
	texCoord = uv;
	eyeDirection = vec3((2.0 * halfSizeNearPlane * uv) - halfSizeNearPlane , -1.0);
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

var fsPost = `
#extension GL_EXT_frag_depth : enable
precision highp float;
precision highp int;

uniform sampler2D tLitSphere;
uniform int       shadingMode;
uniform int       colorMode;
uniform bool      useColor;
uniform sampler2D texGrad;
uniform sampler2D texNorm;
uniform sampler2D texDepth;
uniform float     invVPWidth;
uniform float     invVPHeight;
uniform float     enhancement;
uniform bool      enabled;
uniform bool      reflective;
uniform bool      invert;
uniform vec3      lightDirection;

varying vec2 texCoord;
varying vec3 eyeDirection;

// gradient operator window
vec4 A; vec4 B; vec4 C;
vec4 D; vec4 E; vec4 F;
vec4 G; vec4 H; vec4 I;

void fetchWindow()
{
	// precompute coordinates
	float xc = texCoord.s;
	float xl = texCoord.s - invVPWidth;
	float xr = texCoord.s + invVPWidth;
	float yc = texCoord.t;
	float yb = texCoord.t - invVPHeight;
	float yt = texCoord.t + invVPHeight;

	// fetch pixel window values
	A = texture2D(texGrad, vec2(xl, yt));
	B = texture2D(texGrad, vec2(xc, yt));
	C = texture2D(texGrad, vec2(xr, yt));
	D = texture2D(texGrad, vec2(xl, yc));
	E = texture2D(texGrad, vec2(xc, yc));
	F = texture2D(texGrad, vec2(xr, yc));
	G = texture2D(texGrad, vec2(xl, yb));
	H = texture2D(texGrad, vec2(xc, yb));
	I = texture2D(texGrad, vec2(xr, yb));
}

float tanh(in float c, in float e)
{
	float tanh_max = 4.0; // tanh(x) ~ 1 for x > 4.0
	float c_max = e * 16.0; // scaling intensity
	float exp_c = exp(-2.0 * ((c * c_max) / tanh_max));
	return clamp((1.0 - exp_c) / (1.0 + exp_c), -1.0, 1.0);
}

float scale(in float delta, in float kappa)
{
	float alpha = 0.1; // scaling invariant point
	float gamma = 1.0; // scaling magnitude
	float exp_kappa = gamma * exp(-kappa);
	return (alpha * exp_kappa + delta * (1.0 - alpha - alpha * exp_kappa)) / (alpha + delta * (exp_kappa - alpha - alpha * exp_kappa)); 
}

float smoothThreshold(in float value)
{
	// apply threshold with smoothened transition
	return smoothstep(0.95, 0.975, 1.0 - value);
}

float silhouetteWeight()
{
	// compute average thresholded depth differences in window
	return (smoothThreshold(abs(A.z - E.z)) + 
			smoothThreshold(abs(B.z - E.z)) + 
			smoothThreshold(abs(C.z - E.z)) +
			smoothThreshold(abs(D.z - E.z)) +
			smoothThreshold(abs(F.z - E.z)) +
			smoothThreshold(abs(G.z - E.z)) +
			smoothThreshold(abs(H.z - E.z)) +
			smoothThreshold(abs(I.z - E.z))) / 8.0;
}

vec3 hessian()
{
	// hessian matrix according to (https://en.wikipedia.org/wiki/Second_partial_derivative_test)
	float f_xx = F.x - D.x;
	float f_xy = F.y - D.y;
	float f_yx = B.x - H.x;
	float f_yy = B.y - H.y;
	
	return vec3(f_xx, f_yy, (f_xy + f_yx) / 2.0);
}

float curvature(in float w, in vec3 h, in float e) // (weight, hessian, enhancement)
{
	// use trace of hessian (f_xx + f_yy) get mapped mean curvature, limit effect strength by enhancement e
	float c = tanh(-(h.x + h.y) / 2.0, e);
	return (invert ? -c : c) * max(w - 0.5, 0.0);
}

vec4 sphereLighting(in vec3 n, in float c)
{
	vec4 color = vec4(1.0, 1.0, 1.0, 1.0);
	vec2 uv = vec2(0.5, 0.5);
	if (reflective)
	{
		n = reflect(normalize(eyeDirection), n);
		float l = 2.0 * sqrt(n.x*n.x + n.y*n.y + n.z*n.z);
		// use factor 0.97 to prevent border artifacts
		uv = (n.xy / l * 0.97) + vec2(0.5);
	}
	else
	{
		// use 0.495 instead of 0.5 to prevent the vector to touch the black border of the lit sphere
		uv = (n.xy * 0.495) + vec2(0.5);
	}
	
	// rotate UVs
	if (length(lightDirection.xy) > 0.1)
	{
		float rot = acos(dot(normalize(lightDirection.xy), vec2(0.0, 1.0))) * (lightDirection.x > 0.0 ? -1.0 : 1.0);
		float rot_sin = sin(rot);
		float rot_cos = cos(rot);
		uv -= 0.5;
		mat2 m = mat2(rot_cos, -rot_sin, rot_sin, rot_cos);
		uv = m * uv;
		uv += 0.5;
	}
	
	color = texture2D(tLitSphere, uv);
	return enabled ? color * scale(length(color), c) : color;
}

void main()
{
	// data
	fetchWindow();
	vec3  h = hessian();
	float w = silhouetteWeight();
	float c = curvature(w, h, enhancement);
	
	vec4 nTex = texture2D(texNorm, texCoord.st);
	vec3 n = nTex.xyz;

	if (nTex.w == 0.0)
	{
		discard;
		return;
	}
	n.z = abs(n.z);
	
	vec3 l = lightDirection;
	float darken = n.z < 0.0 ? 0.5 : 1.0;
	float diffuse = max(dot(n, l), 0.0) * darken;
	float color = useColor ? E.a : 1.0;
	vec4 sphere = sphereLighting(n, c);

	gl_FragDepthEXT = texture2D(texDepth, texCoord.st).r;

	if (shadingMode == 0)
	{
		gl_FragColor = vec4( vec3(1.0, 1.0, 1.0) * color * darken, 1.0);
		return;
	}
	if (shadingMode == 1)
	{
		vec3 tmp = vec3(1.0, 1.0, 1.0) * color * diffuse;
		gl_FragColor = vec4( enabled ? tmp * scale(length(tmp), c) : tmp, 1.0 );
		return;
	}
	if (shadingMode == 2)
	{
		gl_FragColor = sphere * color * darken;
		return;
	}
	if (shadingMode == 3)
	{
		gl_FragColor = vec4( vec3(1.0, 1.0, 1.0) * color, 1.0 );
		return;
	}
}
`;