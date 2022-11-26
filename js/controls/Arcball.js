

THREE.ArcballControls = function (object, domElement)
{
    var ab_quat = new THREE.Matrix4(); ab_quat.identity();
    var ab_last = new THREE.Matrix4(); ab_quat.identity();
    var ab_next = new THREE.Matrix4(); ab_quat.identity();

    // the distance from the origin to the eye
    var ab_zoom = 1.0;
    var ab_zoom2 = 1.0;
    // the radius of the arcball
    var ab_sphere = 1.0;
    var ab_sphere2 = 1.0;
    // the distance from the origin of the plane that intersects
    // the edge of the visible sphere (tangent to a ray from the eye)
    var ab_edge = 1.0;
    // whether we are using a sphere or plane
    var ab_planar = false;
    var ab_planedist = 0.5;

    var ab_start = new THREE.Vector3(0, 0, 1);
    var ab_curr = new THREE.Vector3(0, 0, 1);
    var ab_eye = new THREE.Vector3(0, 0, 1);
    var ab_eyedir = new THREE.Vector3(0, 0, 1);
    var ab_up = new THREE.Vector3(0, 1, 0);
    var ab_out = new THREE.Vector3(1, 0, 0);

    var ab_glp = new THREE.Matrix4(); ab_quat.identity();
    var ab_glm = new THREE.Matrix4(); ab_quat.identity();
    var ab_glv = new THREE.Vector4(0, 0, 640, 480);

    //========================================================================================
    // set arcball zoom  (float, THREE.Vector3, THREE.Vector3, THREE.Martix4, THREE.Vector4)
    //========================================================================================
    function arcball_setzoom(radius, eye, up, projMatrix, viewport)
    {
	    ab_eye = eye * (1.0 / sqrt(eye.dot(eye))); // store eye vector
	    ab_zoom2 = ab_eye * ab_eye;
	    ab_zoom = sqrt(ab_zoom2); // store eye distance
	    ab_sphere = radius; // sphere radius
	    ab_sphere2 = ab_sphere * ab_sphere;
	    ab_eyedir = ab_eye * (1.0 / ab_zoom); // distance to eye
	    ab_edge = ab_sphere2 / ab_zoom; // plane of visible edge
  
	    if (ab_sphere <= 0.0) // trackball mode
	    {
		    ab_planar = true;
            ab_up = up;
            ab_out.crossVectors(ab_eyedir, ab_up);
		    ab_planedist = (0.0 - ab_sphere) * ab_zoom;
	    }
	    else
	    {
		    ab_planar = false;
	    }
	
	    ab_glp = projMatrix;
        ab_glv = viewport;
    }

    //========================================================================================
    // convert the quaternion into a rotation matrix (THREE.Martix4, float, float, float, float)
    //========================================================================================
    function quaternion(q, x, y, z, w)
    {
        var x2 = x * x;
        var y2 = y * y;
        var z2 = z * z;
        var xy = x * y;
        var xz = x * z;
        var yz = y * z;
        var wx = w * x;
        var wy = w * y;
        var wz = w * z;
        
        mat = q;
        mat.elements[0] = 1 - 2 * y2 - 2 * z2;
        mat.elements[1] = 2 * xy + 2 * wz;
        mat.elements[2] = 2 * xz - 2 * wy;

        mat.elements[4] = 2 * xy - 2 * wz;
        mat.elements[5] = 1 - 2 * x2 - 2 * z2;
        mat.elements[6] = 2 * yz + 2 * wx;

        mat.elements[8] = 2 * xz + 2 * wy;
        mat.elements[9] = 2 * yz - 2 * wx;
        mat.elements[10] = 1 - 2 * x2 - 2 * y2;

        return mat;
    }


    //========================================================================================
    // find the intersection with the sphere
    //========================================================================================
    function sphere_coords(mx, my)
    {
        var width = ab_glv.z;
        var height = ab_gl.w;
        var radius = min(width / 2.0, height / 2.0) * ab_sphere;
        var center = new THREE.Vector3(width / 2.0, height / 2.0, -min(width / 2.0, height / 2.0));
        var v = THREE.Vector3((mx - center.x) / radius, (my - center.y) / radius, 0.0);
        var mag = v.x * v.x + v.y * v.y;
        if (mag > 1.0)
        {
            v.normalize();
        }
	    else
        {
            v.z = sqrt(1.0 - mag);
        }
        return v;
    }

    //========================================================================================
    // get intersection with plane for "trackball" style rotation
    //========================================================================================
    function planar_coords(mx, my)
    {
        var ax, ay, az;
        
        gluUnProject(mx, my, 0, ab_glm, ab_glp, ab_glv, &ax, &ay, &az);
        var m = new THREE.Vector3(ax, ay, az).sub(ab_eye);
        // intersect the point with the trackball plane
        var t = (ab_planedist - ab_zoom) / (ab_eyedir.dot(m));
        var d = ab_eye.clone().add(m.multiplyScalar(t));

        return vec(d * ab_up, d * ab_out, 0.0);
    }

    //========================================================================================
    // reset the arcball
    //========================================================================================
    function arcball_reset()
    {
        ab_quat.identity();
        ab_last.identity();
    }

    //========================================================================================
    // begin arcball rotation
    //========================================================================================
    function arcball_start(mx, my)
    {
        // saves a copy of the current rotation for comparison
        ab_last = ab_quat;
        if (ab_planar) ab_start = planar_coords(mx, my);
        else ab_start = sphere_coords(mx, my);
    }

    // update current arcball rotation
    function arcball_move(mx, my)
    {
        if (ab_planar)
        {
            ab_curr = planar_coords(mx, my);
            if (ab_curr.equals(ab_start)) return;

            // d is motion since the last position
            var d = ab_curr.sub(ab_start);

            var angle = d.length() * 0.5;
            var cosa = Math.cos(angle);
            var sina = Math.sin(angle);
            // p is perpendicular to d
            vec p = new THREE.Vector3();
            p = ((ab_out.clone().multiplyScalar(d.x)).sub(ab_up.clone().multiplyScalar(d.y))).normalize().multiplyScalar(sina);

            ab_next.makeRotationFromQuaternion(new THREE.Quaternion(p.x, p.y, p.z, cosa));
            ab_quat.multiplyMatrices(ab_last, ab_next)
            // planar style only ever relates to the last point
            quatcopy(ab_last, ab_quat);
            ab_start = ab_curr;

        }
        else
        {
            ab_curr = sphere_coords(mx, my);
            if (ab_curr.equals(ab_start))
            { // avoid potential rare divide by tiny
                ab_quat = ab_last;
                return;
            }

            // use a dot product to get the angle between them
            // use a cross product to get the vector to rotate around
            var cos2a = ab_start.dot(ab_curr);
            var sina = Math.sqrt((1.0 - cos2a) * 0.5);
            var cosa = Math.sqrt((1.0 + cos2a) * 0.5);
            var cross = ab_start.clone().cross(ab_curr).normalize().multiplyScalar(sina);
            ab_next.makeRotationFromQuaternion(new THREE.Quaternion(cross.x, cross.y, cross.z, cosa));

            // update the rotation matrix
            ab_quat.multiplyMatrices(ab_last, ab_next)
        }
    }

    //========================================================================================
    // export and import arcball state matrices
    //========================================================================================
    function arcball_export_quat_matrix()
    {
        return ab_quat;
    }

    function arcball_export_last_matrix()
    {
        return ab_last;
    }

    function arcball_import_quat_matrix(new_ab_quat)
    {
        // sanity
        //for (int i = 0; i < 16; i++) if (mathtools::is_ind(new_ab_quat[i])) return;

        //for (int i = 0; i < 16; i++) ab_quat[i] = new_ab_quat[i];
    }

    function arcball_import_last_matrix(new_ab_last) {
        // sanity
        //for (int i = 0; i < 16; i++) if (mathtools::is_ind(new_ab_last[i])) return;

        //for (int i = 0; i < 16; i++) ab_last[i] = new_ab_last[i];
    }
}