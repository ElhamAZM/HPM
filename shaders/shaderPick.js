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

var vsPick = `
precision highp float;
varying vec2 texCoord;

void main()
{
	texCoord = uv;
	gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

var fsPick = `
#include <packing>
precision highp float;
uniform sampler2D texDepth;

varying vec2 texCoord;

void main()
{
	// encode depth as rgba
	gl_FragColor = packDepthToRGBA(texture2D(texDepth, texCoord.st).r);
}
`;
