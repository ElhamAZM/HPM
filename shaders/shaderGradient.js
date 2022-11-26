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

var vsGradient = `
void main(void)
{
	gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
}
`;

var fsGradient = `
uniform vec2 windowSize;
uniform vec4 colorBottom;
uniform vec4 colorTop;
uniform sampler2D tLogo;
uniform vec2 texSize;

highp float rand(vec2 co)
{
	highp float a  = 12.9898;
	highp float b  = 78.233;
	highp float c  = 43758.5453;
	highp float dt = dot(co.xy, vec2(a, b));
	highp float sn = mod(dt, 3.14);
	return fract(sin(sn) * c);
}

vec2 rotate(vec2 v, float a)
{
	float s = sin(a);
	float c = cos(a);
	mat2 m = mat2(c, -s, s, c);
	return m * v;
}

void main(void)
{
	float MAX_PIXEL_MIX = 32.0; // mixing distance

	vec2 normalisedFragCoord = gl_FragCoord.xy / windowSize;
	float inverseHeight = 1.0 / windowSize.y;

	// perturb the coordinate in y direction by a random amount
	float randomValue = rand(normalisedFragCoord);
	float perturbedFragCoordY = normalisedFragCoord.y + randomValue * inverseHeight * MAX_PIXEL_MIX;
	vec2 rotUV = rotate(gl_FragCoord.xy, 0.3) / windowSize;
	vec2 tCoord = vec2(rotUV.x * windowSize.x / windowSize.y * texSize.y / texSize.x, rotUV.y) * 8.0;
	gl_FragColor = mix(colorBottom, colorTop, perturbedFragCoordY) + vec4( vec3(1.0, 1.0, 1.0) * texture2D(tLogo, tCoord).a, 1.0) * 0.05;
}
`;